import { joinPath, dirOf, baseOf } from './paths.js';
import { mapLimit } from './concurrency.js';
import { parseNote, patchFrontmatter, filenameBase, uniqueFilename, isStale } from './markdown.js';
import { domainOf } from './notes.js';

const DB_NAME = 'vaultmarks';
const STORE_NAME = 'handles';
const STORE_KEY = 'store';
const TRASH_DIR = '.vaultmarks-trash';

export class VaultError extends Error {
  constructor(code, message) {
    super(message ?? code);
    this.name = 'VaultError';
    this.code = code;
  }
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withHandleStore(mode, run) {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, mode);
    const result = await run(tx.objectStore(STORE_NAME));
    await new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return result;
  } finally {
    db.close();
  }
}

// The stored record pairs the folder the user picked (the handle the browser
// granted access to) with the subfolder Vaultmarks uses for notes. Storing the
// child handle instead made Chrome's exact-path grant match fail, so the
// restore prompt never appeared and every popup asked for the folder again.
// Older versions stored the folder handle by itself; read it as the root.
async function readStoredStore() {
  const record = (await withHandleStore('readonly', (store) => idbRequest(store.get(STORE_KEY)))) ?? null;
  if (!record) return null;
  if (typeof record.getDirectoryHandle === 'function') return { handle: record, storePath: '' };
  return { handle: record.handle ?? null, storePath: record.storePath ?? '' };
}

export async function getStoredStore() {
  const stored = await readStoredStore();
  return stored?.handle ?? null;
}

export async function clearStoredStore() {
  await withHandleStore('readwrite', (store) => idbRequest(store.delete(STORE_KEY)));
}

async function putStoreHandle(record) {
  await withHandleStore('readwrite', (store) => idbRequest(store.put(record, STORE_KEY)));
}

export async function pickStore() {
  let picked;
  try {
    picked = await showDirectoryPicker({ id: 'vaultmarks', mode: 'readwrite' });
  } catch (error) {
    if (error?.name === 'AbortError') throw new VaultError('cancelled', 'Folder selection was cancelled');
    throw error;
  }

  let storePath = '';
  let settings;
  try {
    await picked.getDirectoryHandle('Bookmarks');
    storePath = 'Bookmarks';
    settings = {
      vaultName: picked.name,
      storePath,
      storeLabel: `${picked.name}/Bookmarks`,
      obsidianLinks: true,
    };
  } catch {
    settings = { vaultName: null, storePath, storeLabel: picked.name, obsidianLinks: false };
  }

  await putStoreHandle({ handle: picked, storePath });
  return settings;
}

export async function permissionOf(handle) {
  if (!handle) throw new VaultError('no-store');
  if (typeof handle.queryPermission !== 'function') return 'granted';
  return handle.queryPermission({ mode: 'readwrite' });
}

export async function requestPermission(handle) {
  if (!handle) throw new VaultError('no-store');
  if (typeof handle.requestPermission !== 'function') return 'granted';
  const current = await handle.queryPermission({ mode: 'readwrite' });
  if (current === 'granted') return 'granted';
  return handle.requestPermission({ mode: 'readwrite' });
}

async function requireWritableStore() {
  const stored = await readStoredStore();
  if (!stored?.handle) throw new VaultError('no-store');
  if ((await permissionOf(stored.handle)) !== 'granted') {
    throw new VaultError('needs-permission', 'Folder access needs to be granted again');
  }
  // Permission belongs to the picked root; operations act on the notes folder
  // below it. A missing Bookmarks folder surfaces as NotFoundError so the
  // caller forgets the stored handle and offers a fresh pick.
  return resolveDirectory(stored.handle, stored.storePath);
}

async function resolveDirectory(root, path, { create = false } = {}) {
  let handle = root;
  for (const segment of String(path).split('/')) {
    if (segment === '') continue;
    handle = await handle.getDirectoryHandle(segment, { create });
  }
  return handle;
}

async function resolveFile(root, key) {
  const parent = await resolveDirectory(root, dirOf(key));
  const name = baseOf(key);
  const handle = await parent.getFileHandle(name);
  return { handle, parent, name };
}

async function entryNames(dirHandle) {
  const names = [];
  for await (const [name] of dirHandle.entries()) names.push(name);
  return names;
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function copyFileInto(handle, targetDir, targetName) {
  const bytes = new Uint8Array(await (await handle.getFile()).arrayBuffer());
  const target = await targetDir.getFileHandle(targetName, { create: true });
  const writable = await target.createWritable();
  await writable.write(bytes);
  await writable.close();

  const written = new Uint8Array(await (await target.getFile()).arrayBuffer());
  if (!sameBytes(written, bytes)) {
    throw new VaultError('io', 'The copied file did not verify');
  }
}

async function copyTree(handle, target) {
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind === 'directory') {
      const sub = await target.getDirectoryHandle(name, { create: true });
      await copyTree(entry, sub);
    } else {
      await copyFileInto(entry, target, name);
    }
  }
}

async function sameEntry(a, b) {
  if (!a || !b) return false;
  if (typeof a.isSameEntry === 'function') {
    try {
      return await a.isSameEntry(b);
    } catch {
      return false;
    }
  }
  return a === b;
}

async function moveHandle(handle, parent, targetDir, targetName) {
  if (typeof handle.move === 'function') {
    try {
      await handle.move(targetDir, targetName);
      return;
    } catch {
      // Fall through to the copy-and-verify path.
    }
  }

  await copyFileInto(handle, targetDir, targetName);

  try {
    await parent.removeEntry(handle.name);
  } catch {
    throw new VaultError('partial', `Copied to ${targetName}, but the original file could not be removed`);
  }
}

async function moveDirectoryHandle(handle, parent, targetParent, targetName) {
  if (typeof handle.move === 'function') {
    try {
      await handle.move(targetParent, targetName);
      return;
    } catch {
      // Fall through to the recursive copy-then-remove path.
    }
  }

  const target = await targetParent.getDirectoryHandle(targetName, { create: true });
  if (await sameEntry(target, handle)) {
    throw new VaultError('invalid-name', 'That collection is already in that place');
  }

  // Two-phase: copy and verify the whole tree before removing anything, so a
  // failure part-way leaves the original collection intact (spec line 89).
  await copyTree(handle, target);

  try {
    await parent.removeEntry(handle.name, { recursive: true });
  } catch {
    throw new VaultError('partial', `Copied to ${targetName}, but the original folder could not be removed`);
  }
}

async function collectMarkdown(dirHandle, prefix, files, directories) {
  for await (const [name, entry] of dirHandle.entries()) {
    if (name.startsWith('.')) continue;
    if (entry.kind === 'directory') {
      const path = joinPath(prefix, name);
      directories.push(path);
      await collectMarkdown(entry, path, files, directories);
    } else if (entry.kind === 'file' && /\.md$/i.test(name)) {
      files.push({ key: joinPath(prefix, name), handle: entry });
    }
  }
}

export async function scanStore(onProgress) {
  const root = await requireWritableStore();
  const files = [];
  const directories = [];
  await collectMarkdown(root, '', files, directories);

  const notes = [];
  let skipped = 0;
  let loaded = 0;

  await mapLimit(files, 8, async ({ key, handle }) => {
    try {
      const file = await handle.getFile();
      const text = await file.text();
      const { note } = parseNote(text, { key, lastModified: file.lastModified, size: file.size });
      if (note) notes.push(note);
      else skipped += 1;
    } catch {
      skipped += 1;
    }
    loaded += 1;
    if (onProgress) onProgress(loaded, files.length);
  });

  return { notes, skipped, directories: directories.sort() };
}

export async function readFileText(key) {
  const root = await requireWritableStore();
  const { handle } = await resolveFile(root, key);
  const file = await handle.getFile();
  return { text: await file.text(), lastModified: file.lastModified, size: file.size };
}

export async function writeNewFile(dir, base, text) {
  const root = await requireWritableStore();
  const targetDir = await resolveDirectory(root, dir, { create: true });
  const filename = uniqueFilename(base, await entryNames(targetDir));
  const handle = await targetDir.getFileHandle(filename, { create: true });
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
  return { key: joinPath(dir, filename) };
}

export async function updateFile(note, changes) {
  const root = await requireWritableStore();
  const { handle, parent, name } = await resolveFile(root, note.key);
  const text = await (await handle.getFile()).text();
  if (isStale(note, text)) {
    throw new VaultError('conflict', 'This note changed in Obsidian. Reload and try again.');
  }

  const patched = patchFrontmatter(text, changes);
  if (patched !== text) {
    const writable = await handle.createWritable();
    await writable.write(patched);
    await writable.close();
  }

  let currentName = name;
  if (Object.hasOwn(changes, 'title') && String(changes.title ?? '').trim() !== '') {
    const desired = `${filenameBase(changes.title, domainOf(note.url))}.md`;
    if (desired.toLowerCase() !== currentName.toLowerCase()) {
      const taken = (await entryNames(parent)).filter((entry) => entry.toLowerCase() !== currentName.toLowerCase());
      const next = uniqueFilename(desired.replace(/\.md$/i, ''), taken);
      await moveHandle(handle, parent, parent, next);
      currentName = next;
    }
  }

  return { key: joinPath(dirOf(note.key), currentName) };
}

export async function moveFile(note, dir) {
  const root = await requireWritableStore();
  if (dir === note.dir) return { key: note.key };

  const { handle, parent, name } = await resolveFile(root, note.key);
  const targetDir = await resolveDirectory(root, dir, { create: true });
  const next = uniqueFilename(baseOf(name).replace(/\.md$/i, ''), await entryNames(targetDir));
  await moveHandle(handle, parent, targetDir, next);
  return { key: joinPath(dir, next) };
}

export async function trashFile(note) {
  const root = await requireWritableStore();
  const { handle, parent } = await resolveFile(root, note.key);
  const trashDir = await root.getDirectoryHandle(TRASH_DIR, { create: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const trashedAs = `${stamp}--${note.filename}`;
  await moveHandle(handle, parent, trashDir, trashedAs);
  return { trashedAs };
}

export async function trashDirectory(path) {
  const root = await requireWritableStore();
  const parent = await resolveDirectory(root, dirOf(path));
  const handle = await parent.getDirectoryHandle(baseOf(path));
  const trashDir = await root.getDirectoryHandle(TRASH_DIR, { create: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const trashedAs = `${stamp}--${baseOf(path)}`;
  await moveDirectoryHandle(handle, parent, trashDir, trashedAs);
  return { trashedAs };
}

function assertSegment(name) {
  const trimmed = String(name ?? '').trim();
  if (
    trimmed === '' ||
    trimmed === '.' ||
    trimmed === '..' ||
    trimmed.includes('/') ||
    /[\u0000-\u001f\u007f]/.test(trimmed) ||
    new TextEncoder().encode(trimmed).length > 200
  ) {
    throw new VaultError('invalid-name', 'That collection name is not allowed');
  }
  return trimmed;
}

export async function createDirectory(name, parent = '') {
  const trimmed = assertSegment(name);
  const root = await requireWritableStore();
  const parentDir = await resolveDirectory(root, String(parent));
  const existing = (await entryNames(parentDir)).filter((entry) => entry.toLowerCase() === trimmed.toLowerCase());
  if (existing.length > 0) throw new VaultError('exists', 'A collection with that name already exists');

  await parentDir.getDirectoryHandle(trimmed, { create: true });
  return { path: joinPath(String(parent), trimmed) };
}

// Walks the destination's parent segments without creating anything and refuses
// the move if any resolved directory is the source itself. The string checks
// above are case-sensitive, so on a case-insensitive filesystem a differently
// cased prefix (e.g. `dev` for `Dev`) only shows up once the handle is resolved.
async function assertNotInsideSource(root, sourceHandle, dest) {
  const parents = dest.split('/').slice(0, -1);
  let handle = root;
  for (const segment of parents) {
    if (await sameEntry(handle, sourceHandle)) {
      throw new VaultError('invalid-name', 'A collection cannot be moved inside itself');
    }
    try {
      handle = await handle.getDirectoryHandle(segment);
    } catch (error) {
      if (error?.name === 'NotFoundError') return;
      throw error;
    }
  }
  if (await sameEntry(handle, sourceHandle)) {
    throw new VaultError('invalid-name', 'A collection cannot be moved inside itself');
  }
}

export async function moveDirectory(path, destination) {
  const root = await requireWritableStore();
  const source = String(path);
  const segments = String(destination)
    .split('/')
    .filter((segment) => segment !== '');
  if (segments.some((segment) => segment.startsWith('.'))) {
    throw new VaultError('invalid-name', 'That collection name is not allowed');
  }
  const dest = segments.map((segment) => assertSegment(segment)).join('/');

  if (dest === '' || dest === source) throw new VaultError('invalid-name', 'That is the same collection');
  if (dest.startsWith(`${source}/`)) throw new VaultError('invalid-name', 'A collection cannot be moved inside itself');

  const sourceParent = await resolveDirectory(root, dirOf(source));
  const sourceHandle = await sourceParent.getDirectoryHandle(baseOf(source));
  await assertNotInsideSource(root, sourceHandle, dest);

  const destParent = await resolveDirectory(root, dirOf(dest), { create: true });
  const name = baseOf(dest);
  const clash = (await entryNames(destParent)).find((entry) => entry.toLowerCase() === name.toLowerCase());
  if (clash) {
    let clashHandle = null;
    try {
      clashHandle = await destParent.getDirectoryHandle(clash);
    } catch {
      clashHandle = null;
    }
    // A case-only rename clashes with itself; let it through.
    if (!clashHandle || !(await sameEntry(clashHandle, sourceHandle))) {
      throw new VaultError('exists', 'A collection with that name already exists');
    }
  }

  await moveDirectoryHandle(sourceHandle, sourceParent, destParent, name);
  return { path: dest };
}
