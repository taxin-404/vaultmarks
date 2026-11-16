import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';

// Runs the real src/lib/vaultfs.js against a Node-backed fake of the File
// System Access API and a throwaway vault on disk. This is the only place
// the destructive write paths (create, patch, rename, move, trash) run
// end-to-end.

const absent = (message) => Object.assign(new Error(message), { name: 'NotFoundError' });

// Test levers. The default fake behaves like a case-sensitive filesystem whose
// handles all support move(); tests flip these to exercise the copy fallback,
// a case-insensitive filesystem, or a write that fails part-way.
let caseInsensitiveLookup = false;
let allowFileMove = true;
let failWriteAfter = Infinity;
let writeAttempts = 0;

async function sameFakePath(a, b) {
  if (!a || !b) return false;
  try {
    return (await realpath(a)) === (await realpath(b));
  } catch {
    return a === b;
  }
}

class FakeFile {
  constructor(path) {
    this.path = path;
    this.name = basename(path);
    this.kind = 'file';
    if (!allowFileMove) this.move = undefined;
  }

  async getFile() {
    const [data, info] = await Promise.all([readFile(this.path), stat(this.path)]);
    return {
      name: this.name,
      text: async () => data.toString('utf8'),
      arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      lastModified: info.mtimeMs,
      size: info.size,
    };
  }

  async createWritable() {
    writeAttempts += 1;
    if (writeAttempts > failWriteAfter) {
      throw Object.assign(new Error('simulated write failure'), { name: 'QuotaExceededError' });
    }
    let buffer = null;
    const path = this.path;
    return {
      async write(data) {
        buffer = data;
      },
      async close() {
        await writeFile(path, buffer ?? '');
        buffer = null;
      },
    };
  }

  async move(targetDir, newName) {
    await rename(this.path, join(targetDir.path, newName));
    this.path = join(targetDir.path, newName);
    this.name = newName;
  }

  async isSameEntry(other) {
    return other?.kind === 'file' && sameFakePath(this.path, other.path);
  }
}

class FakeDir {
  constructor(path) {
    this.path = path;
    this.name = basename(path);
    this.kind = 'directory';
  }

  async getDirectoryHandle(name, { create = false } = {}) {
    const target = join(this.path, name);
    try {
      if ((await stat(target)).isDirectory()) return new FakeDir(target);
    } catch {
      if (caseInsensitiveLookup) {
        const hit = (await readdir(this.path)).find((entry) => entry.toLowerCase() === name.toLowerCase());
        if (hit && (await stat(join(this.path, hit))).isDirectory()) return new FakeDir(join(this.path, hit));
      }
      if (!create) throw absent(`${name} is not a directory`);
      await mkdir(target, { recursive: true });
      return new FakeDir(target);
    }
    throw new Error(`${name} exists and is not a directory`);
  }

  async getFileHandle(name, { create = false } = {}) {
    const target = join(this.path, name);
    try {
      if ((await stat(target)).isFile()) return new FakeFile(target);
    } catch {
      if (!create) throw absent(`${name} is not a file`);
      await writeFile(target, '');
      return new FakeFile(target);
    }
    throw new Error(`${name} exists and is not a file`);
  }

  async *entries() {
    for (const entry of await readdir(this.path, { withFileTypes: true })) {
      const target = join(this.path, entry.name);
      yield [entry.name, entry.isDirectory() ? new FakeDir(target) : new FakeFile(target)];
    }
  }

  async removeEntry(name) {
    await rm(join(this.path, name), { recursive: true });
  }

  async isSameEntry(other) {
    return other?.kind === 'directory' && sameFakePath(this.path, other.path);
  }
}

function makeRequest(result) {
  const request = {};
  queueMicrotask(() => {
    request.result = result;
    request.onsuccess?.();
  });
  return request;
}

// Mirrors the single handle record the extension keeps in IndexedDB. Unlike
// the old fake, writes are recorded so tests can assert what pickStore stored.
let storedValue = null;
let nextPick = null;

globalThis.showDirectoryPicker = async () => {
  if (!nextPick) throw new Error('no picker result queued');
  const picked = nextPick;
  nextPick = null;
  return picked;
};

globalThis.indexedDB = {
  open() {
    const request = {};
    queueMicrotask(() => {
      request.result = {
        objectStoreNames: { contains: () => true },
        transaction: () => {
          const tx = {};
          tx.objectStore = () => ({
            get: () => makeRequest(storedValue),
            put: (value) => {
              storedValue = value;
              return makeRequest(undefined);
            },
            delete: () => {
              storedValue = null;
              return makeRequest(undefined);
            },
          });
          setTimeout(() => tx.oncomplete?.(), 0);
          return tx;
        },
        close() {},
      };
      request.onsuccess?.();
    });
    return request;
  },
};

const vaultfs = await import('../src/lib/vaultfs.js');
const { createNoteText } = await import('../src/lib/markdown.js');

const roots = [];

async function makeVault(files = {}) {
  const root = await mkdtemp(join(tmpdir(), 'vaultmarks-fs-'));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, content);
  }
  storedValue = new FakeDir(root);
  return root;
}

after(async () => {
  for (const root of roots) await rm(root, { recursive: true, force: true });
});

const ALPHA = [
  '---',
  'title: "Alpha"',
  'url: "https://alpha.example"',
  'created: 2026-01-02',
  'description: "First"',
  '# keep me',
  'custom: keep',
  'tags:',
  '  - "bookmarks"',
  '---',
  '',
  '![](https://alpha.example/c.png)',
  '',
  'Body line.',
  '',
  '[Open original ↗](https://alpha.example)',
  '',
].join('\n');

const CRLF_BETA = [
  '---',
  'title: "Beta"',
  'url: "https://beta.example"',
  'description: "Second"',
  '# note',
  'custom: yes',
  'tags:',
  '  - "bookmarks"',
  '---',
  '',
  'Beta body.',
  '',
].join('\r\n');

test('scanStore lists markdown notes, skips dot directories and non-md files', async () => {
  await makeVault({
    'Alpha.md': ALPHA,
    'Dev/Beta.md': ALPHA.replace('Alpha', 'Beta'),
    'Dev/readme.txt': 'not a note',
    '.vaultmarks-trash/old.md': '---\nurl: "https://x.example"\n---\n',
  });
  const { notes, skipped } = await vaultfs.scanStore();
  assert.equal(skipped, 0);
  assert.deepEqual(notes.map((note) => note.key).sort(), ['Alpha.md', 'Dev/Beta.md']);
});

test('scanStore also returns every non-hidden directory, including empty ones', async () => {
  const root = await makeVault({ 'Dev/Beta.md': ALPHA.replace('Alpha', 'Beta') });
  await mkdir(join(root, 'Empty'));
  await mkdir(join(root, 'Dev/Nested'));
  await mkdir(join(root, '.hidden'));
  const { directories } = await vaultfs.scanStore();
  assert.deepEqual(directories, ['Dev', 'Dev/Nested', 'Empty']);
});

test('createDirectory creates a nested collection under a parent', async () => {
  const root = await makeVault({});
  await vaultfs.createDirectory('Dev');
  const { path } = await vaultfs.createDirectory('Js', 'Dev');
  assert.equal(path, 'Dev/Js');
  assert.ok((await readdir(join(root, 'Dev'))).includes('Js'));
  await assert.rejects(() => vaultfs.createDirectory('Js', 'Dev'), (error) => error.code === 'exists');
  await assert.rejects(() => vaultfs.createDirectory('bad/name', 'Dev'), (error) => error.code === 'invalid-name');
});

test('writeNewFile creates a note and de-duplicates the filename', async () => {
  const root = await makeVault();
  const text = createNoteText({
    title: 'Smoke',
    url: 'https://example.com/s',
    created: '2026-11-15',
    description: 'd',
    image: '',
    favicon: '',
    tags: ['bookmarks'],
  });
  assert.equal((await vaultfs.writeNewFile('', 'Smoke', text)).key, 'Smoke.md');
  assert.equal((await vaultfs.writeNewFile('', 'Smoke', text)).key, 'Smoke (2).md');
  assert.deepEqual((await readdir(root)).sort(), ['Smoke (2).md', 'Smoke.md']);
});

test('updateFile patches frontmatter, renames on title change and keeps the body and other keys', async () => {
  const root = await makeVault({ 'Alpha.md': ALPHA });
  let { notes } = await vaultfs.scanStore();

  assert.equal((await vaultfs.updateFile(notes[0], { description: 'Changed' })).key, 'Alpha.md');
  const text = await readFile(join(root, 'Alpha.md'), 'utf8');
  assert.match(text, /description: "Changed"/);
  assert.match(text, /# keep me/);
  assert.match(text, /custom: keep/);
  assert.ok(text.includes('![](https://alpha.example/c.png)'));
  assert.ok(text.endsWith('[Open original ↗](https://alpha.example)\n'));

  ({ notes } = await vaultfs.scanStore());
  const renamed = await vaultfs.updateFile(notes[0], { title: 'Renamed Alpha' });
  assert.equal(renamed.key, 'Renamed Alpha.md');
  const names = await readdir(root);
  assert.ok(names.includes('Renamed Alpha.md'));
  assert.ok(!names.includes('Alpha.md'));
});

test('updateFile refuses a stale write with code conflict', async () => {
  const root = await makeVault({ 'Alpha.md': ALPHA });
  const { notes } = await vaultfs.scanStore();
  await vaultfs.updateFile(notes[0], { description: 'First change' });

  await assert.rejects(() => vaultfs.updateFile(notes[0], { description: 'Stale change' }), (error) => error.code === 'conflict');
  assert.doesNotMatch(await readFile(join(root, 'Alpha.md'), 'utf8'), /Stale change/);
});

test('CRLF, comments, unknown keys and the body survive a patch', async () => {
  const root = await makeVault({ 'Beta.md': CRLF_BETA });
  const { notes } = await vaultfs.scanStore();
  await vaultfs.updateFile(notes[0], { description: 'Third' });

  const text = await readFile(join(root, 'Beta.md'), 'utf8');
  assert.match(text, /description: "Third"/);
  assert.match(text, /# note/);
  assert.match(text, /custom: yes/);
  assert.ok(text.endsWith('Beta body.\r\n'));
  assert.equal(
    (text.match(/\n/g) ?? []).length,
    (text.match(/\r\n/g) ?? []).length,
    'every newline is CRLF',
  );
});

test('moveFile moves a note into a collection it creates', async () => {
  const root = await makeVault({ 'Alpha.md': ALPHA });
  const { notes } = await vaultfs.scanStore();

  const moved = await vaultfs.moveFile(notes[0], 'Dev/Js');
  assert.equal(moved.key, 'Dev/Js/Alpha.md');
  assert.ok((await readdir(join(root, 'Dev/Js'))).includes('Alpha.md'));
  assert.ok(!(await readdir(root)).includes('Alpha.md'));
});

test('trashFile moves a note into the hidden trash folder and the rescan hides it', async () => {
  const root = await makeVault({ 'Alpha.md': ALPHA });
  const { notes } = await vaultfs.scanStore();

  const { trashedAs } = await vaultfs.trashFile(notes[0]);
  assert.match(basename(trashedAs), /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z--Alpha\.md$/);
  assert.deepEqual(await readdir(join(root, '.vaultmarks-trash')), [basename(trashedAs)]);
  assert.ok(!(await readdir(root)).includes('Alpha.md'));
  assert.equal((await vaultfs.scanStore()).notes.length, 0);
});

test('createDirectory validates names and refuses duplicates case-insensitively', async () => {
  const root = await makeVault();
  assert.equal((await vaultfs.createDirectory('Dev')).path, 'Dev');
  assert.ok((await readdir(root)).includes('Dev'));
  await assert.rejects(() => vaultfs.createDirectory('dev'), (error) => error.code === 'exists');
  await assert.rejects(() => vaultfs.createDirectory('bad/name'), (error) => error.code === 'invalid-name');
  await assert.rejects(() => vaultfs.createDirectory('   '), (error) => error.code === 'invalid-name');
});

test('moveDirectory renames a folder in place, keeping notes byte-identical', async () => {
  const root = await makeVault({ 'Dev/Js/Alpha.md': ALPHA });
  const before = await readFile(join(root, 'Dev/Js/Alpha.md'), 'utf8');
  const { path } = await vaultfs.moveDirectory('Dev/Js', 'Dev/Web');
  assert.equal(path, 'Dev/Web');
  assert.ok((await readdir(join(root, 'Dev'))).includes('Web'));
  assert.ok(!(await readdir(join(root, 'Dev'))).includes('Js'));
  assert.equal(await readFile(join(root, 'Dev/Web/Alpha.md'), 'utf8'), before);
});

test('moveDirectory relocates a folder and creates missing parents', async () => {
  const root = await makeVault({ 'Dev/Alpha.md': ALPHA });
  await vaultfs.moveDirectory('Dev', 'Archive/Dev');
  assert.ok((await readdir(join(root, 'Archive'))).includes('Dev'));
  assert.ok(!(await readdir(root)).includes('Dev'));
  assert.equal((await vaultfs.scanStore()).notes[0].key, 'Archive/Dev/Alpha.md');
});

test('moveDirectory refuses a collision, a self-move and a descendant move', async () => {
  await makeVault({ 'Dev/Alpha.md': ALPHA, 'Other/Beta.md': ALPHA });
  await assert.rejects(() => vaultfs.moveDirectory('Dev', 'Other'), (e) => e.code === 'exists');
  await assert.rejects(() => vaultfs.moveDirectory('Dev', 'Dev'), (e) => e.code === 'invalid-name');
  await assert.rejects(() => vaultfs.moveDirectory('Dev', 'Dev/Inner'), (e) => e.code === 'invalid-name');
  await assert.rejects(() => vaultfs.moveDirectory('Dev', 'bad/../name'), (e) => e.code === 'invalid-name');
});

test('trashDirectory moves a folder and its nested notes into the hidden trash', async () => {
  const root = await makeVault({ 'Dev/Alpha.md': ALPHA, 'Dev/Js/Beta.md': ALPHA });
  const { trashedAs } = await vaultfs.trashDirectory('Dev');
  assert.match(basename(trashedAs), /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z--Dev$/);
  assert.deepEqual(await readdir(join(root, '.vaultmarks-trash')), [trashedAs]);
  const moved = join(root, '.vaultmarks-trash', trashedAs);
  assert.ok((await readdir(moved)).includes('Alpha.md'));
  assert.ok((await readdir(join(moved, 'Js'))).includes('Beta.md'));
  assert.ok(!(await readdir(root)).includes('Dev'));
  assert.equal((await vaultfs.scanStore()).notes.length, 0);
});

test('moveDirectory refuses a case-variant move into itself on case-insensitive filesystems', async () => {
  const root = await makeVault({ 'Dev/Alpha.md': ALPHA });
  caseInsensitiveLookup = true;
  try {
    await assert.rejects(() => vaultfs.moveDirectory('Dev', 'dev/Inner'), (e) => e.code === 'invalid-name');
  } finally {
    caseInsensitiveLookup = false;
  }
  assert.deepEqual(await readdir(root), ['Dev']);
  assert.deepEqual(await readdir(join(root, 'Dev')), ['Alpha.md']);
});

test('moveDirectory refuses a case-insensitive collision with a sibling', async () => {
  await makeVault({ 'Dev/Alpha.md': ALPHA, 'Other/Beta.md': ALPHA });
  await assert.rejects(() => vaultfs.moveDirectory('Dev', 'other'), (e) => e.code === 'exists');
});

test('moveDirectory allows a case-only rename of a collection', async () => {
  const root = await makeVault({ 'Dev/Alpha.md': ALPHA });
  const { path } = await vaultfs.moveDirectory('Dev', 'dev');
  assert.equal(path, 'dev');
  assert.deepEqual(await readdir(root), ['dev']);
  assert.equal(await readFile(join(root, 'dev/Alpha.md'), 'utf8'), ALPHA);
});

test('moveDirectory rejects a destination inside a hidden folder', async () => {
  await makeVault({ 'Dev/Alpha.md': ALPHA });
  await assert.rejects(() => vaultfs.moveDirectory('Dev', '.trash/Dev'), (e) => e.code === 'invalid-name');
});

test('moveDirectory copies files byte-for-byte when move() is unavailable', async () => {
  const root = await makeVault({ 'Dev/Alpha.md': ALPHA });
  const bytes = Buffer.from([0x00, 0xff, 0xfe, 0x41, 0x80, 0x0a, 0xc3, 0x28]);
  await writeFile(join(root, 'Dev/blob.bin'), bytes);
  allowFileMove = false;
  try {
    await vaultfs.moveDirectory('Dev', 'Archive/Dev');
  } finally {
    allowFileMove = true;
  }
  assert.deepEqual(await readFile(join(root, 'Archive/Dev/blob.bin')), bytes);
  assert.equal(await readFile(join(root, 'Archive/Dev/Alpha.md'), 'utf8'), ALPHA);
  assert.ok(!(await readdir(root)).includes('Dev'));
});

test('moveDirectory leaves the source intact when a copy fails part-way', async () => {
  const root = await makeVault({ 'Dev/A.md': ALPHA, 'Dev/B.md': ALPHA });
  allowFileMove = false;
  writeAttempts = 0;
  failWriteAfter = 1;
  try {
    await assert.rejects(() => vaultfs.moveDirectory('Dev', 'Dev2'));
  } finally {
    allowFileMove = true;
    failWriteAfter = Infinity;
    writeAttempts = 0;
  }
  assert.deepEqual((await readdir(join(root, 'Dev'))).sort(), ['A.md', 'B.md']);
});

// The folder picker grants access to the folder the user picked. Storing a
// child handle instead makes the browser unable to match the saved handle to
// that grant, so the popup asks for the folder again on every open. These
// tests pin the stored record to the picked root and keep access to the
// Bookmarks subfolder (or the root itself) as a separate path.
async function pickVault(root) {
  const picked = new FakeDir(root);
  nextPick = picked;
  const settings = await vaultfs.pickStore();
  return { picked, settings };
}

test('pickStore stores the picked root so the browser can restore its grant', async () => {
  const root = await makeVault({ 'Bookmarks/Alpha.md': ALPHA });
  const { picked, settings } = await pickVault(root);

  assert.equal(storedValue.storePath, 'Bookmarks');
  assert.equal(await storedValue.handle.isSameEntry(picked), true);
  assert.deepEqual(settings, {
    vaultName: basename(root),
    storePath: 'Bookmarks',
    storeLabel: `${basename(root)}/Bookmarks`,
    obsidianLinks: true,
  });
});

test('pickStore stores the picked root for a vault without a Bookmarks folder', async () => {
  const root = await makeVault({ 'Alpha.md': ALPHA });
  const { picked, settings } = await pickVault(root);

  assert.equal(storedValue.storePath, '');
  assert.equal(await storedValue.handle.isSameEntry(picked), true);
  assert.deepEqual(settings, {
    vaultName: null,
    storePath: '',
    storeLabel: basename(root),
    obsidianLinks: false,
  });
});

test('getStoredStore returns the picked root, the handle permission checks use', async () => {
  const root = await makeVault({ 'Bookmarks/Alpha.md': ALPHA });
  const { picked } = await pickVault(root);

  const handle = await vaultfs.getStoredStore();
  assert.equal(await handle.isSameEntry(picked), true);
});

test('scanStore reads notes from the Bookmarks folder after a pick', async () => {
  const root = await makeVault({ 'Bookmarks/Alpha.md': ALPHA, 'Loose.md': ALPHA });
  await pickVault(root);

  const { notes } = await vaultfs.scanStore();
  assert.deepEqual(notes.map((note) => note.key), ['Alpha.md']);
});

test('scanStore still reads a vault stored by an older version', async () => {
  const root = await makeVault({ 'Alpha.md': ALPHA });
  storedValue = new FakeDir(root);

  const { notes } = await vaultfs.scanStore();
  assert.deepEqual(notes.map((note) => note.key), ['Alpha.md']);
});

test('a removed Bookmarks folder surfaces as NotFoundError so the store is forgotten', async () => {
  const root = await makeVault({ 'Bookmarks/Alpha.md': ALPHA });
  await pickVault(root);
  await rm(join(root, 'Bookmarks'), { recursive: true });

  await assert.rejects(() => vaultfs.scanStore(), (error) => error.name === 'NotFoundError');
});
