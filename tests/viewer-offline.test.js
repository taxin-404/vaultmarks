import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const viewer = await readFile(new URL('../obsidian/vaultmarks.md', import.meta.url), 'utf8');

// The viewer ships as one inline dataviewjs block, so pull the pure frontmatter
// rewriter out of it instead of running the whole block.
function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing from the viewer`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name} is unterminated`);
}

const applyFetchedMetadata = new Function(
  `${extractFunction(viewer, 'frontmatterScalar')}
   ${extractFunction(viewer, 'hostOf')}
   ${extractFunction(viewer, 'stripGitHubBoilerplate')}
   ${extractFunction(viewer, 'applyFetchedMetadata')}
   return applyFetchedMetadata;`,
)();

const offlineNote = `---
title: "Example"
url: "https://example.com"
created: 2026-11-20
metadata: pending
tags:
  - "bookmarks"
---

[Open original ↗](https://example.com)
`;

test('fetched metadata fills an offline note and clears the marker', () => {
  const next = applyFetchedMetadata(offlineNote, {
    title: 'Example',
    description: 'An example page.',
    image: 'https://example.com/cover.png',
    favicon: 'https://example.com/favicon.ico',
  });

  assert.match(next, /description: "An example page\."/);
  assert.match(next, /image: "https:\/\/example\.com\/cover\.png"/);
  assert.match(next, /favicon: "https:\/\/example\.com\/favicon\.ico"/);
  assert.doesNotMatch(next, /metadata: pending/);
  assert.match(next, /tags:\n {2}- "bookmarks"/);
  assert.match(next, /\[Open original ↗\]\(https:\/\/example\.com\)/);
});

test('a hand-typed description is kept and only missing fields are added', () => {
  const typed = offlineNote.replace(
    'metadata: pending',
    'description: "What I wrote offline"\nmetadata: pending',
  );
  const next = applyFetchedMetadata(typed, {
    title: 'Example',
    description: 'The page description.',
    image: '',
    favicon: '',
  });

  assert.match(next, /description: "What I wrote offline"/);
  assert.doesNotMatch(next, /The page description/);
  assert.doesNotMatch(next, /^image:/m);
  assert.doesNotMatch(next, /^favicon:/m);
  assert.doesNotMatch(next, /metadata: pending/);
});

test('a note without frontmatter is returned untouched', () => {
  const plain = 'Just a note.\n';
  assert.equal(applyFetchedMetadata(plain, { description: 'x', image: 'y', favicon: 'z' }), plain);
});

test('empty frontmatter fields are filled in place without duplicates', () => {
  const empty = offlineNote.replace(
    'metadata: pending',
    'description: ""\nimage: ""\nmetadata: pending',
  );
  const next = applyFetchedMetadata(empty, {
    description: 'An example page.',
    image: 'https://example.com/cover.png',
    favicon: 'https://example.com/favicon.ico',
  });

  assert.match(next, /^description: "An example page\."$/m);
  assert.match(next, /^image: "https:\/\/example\.com\/cover\.png"$/m);
  assert.doesNotMatch(next, /^description: ""$/m);
  assert.doesNotMatch(next, /^image: ""$/m);
  assert.equal((next.match(/^description:/gm) || []).length, 1);
  assert.equal((next.match(/^image:/gm) || []).length, 1);
  assert.doesNotMatch(next, /metadata: pending/);
});

test('GitHub boilerplate is removed but the repository words stay', () => {
  const github = offlineNote
    .replace('metadata: pending', 'description: "A useful repo. Contribute to a/b development by creating an account on GitHub."\nmetadata: pending')
    .replace('url: "https://example.com"', 'url: "https://github.com/a/b"');
  const next = applyFetchedMetadata(github, {
    description: 'Fetched description',
    image: '',
    favicon: '',
  }, 'https://github.com/a/b');

  assert.match(next, /^description: "A useful repo\."$/m);
  assert.doesNotMatch(next, /Contribute to/);
  assert.doesNotMatch(next, /Fetched description/);

  const other = github.replace('url: "https://github.com/a/b"', 'url: "https://example.com/a"');
  const kept = applyFetchedMetadata(other, { description: '', image: '', favicon: '' }, 'https://example.com/a');
  assert.match(kept, /Contribute to/);

  const empty = offlineNote
    .replace('metadata: pending', 'description: ""\nmetadata: pending')
    .replace('url: "https://example.com"', 'url: "https://github.com/a/b"');
  const boilerplateOnly = applyFetchedMetadata(empty, {
    description: 'Contribute to a/b development by creating an account on GitHub.',
    image: '',
    favicon: '',
  }, 'https://github.com/a/b');
  assert.match(boilerplateOnly, /^description: ""$/m);
});

test('offline saves are marked pending and backfilled once online', () => {
  assert.match(viewer, /if \(pending\) lines\.push\("metadata: pending"\)/);
  assert.match(viewer, /async function backfillPending/);
  assert.match(viewer, /navigator\.onLine === false/);
  assert.match(viewer, /applyFetchedMetadata\(raw, meta, page\.url\)/);
  assert.match(viewer, /pending: true/);
});

test('a card can refresh its own metadata and a new note renders immediately', () => {
  assert.match(viewer, /REFRESH_ICON_SVG/);
  assert.match(viewer, /async function refreshPage/);
  assert.match(viewer, /applyFetchedMetadata\(raw, meta, url\)/);
  assert.match(viewer, /rememberFetched\(page, next, before\)/);
  assert.match(viewer, /rememberCreatedNote\(note, \{ \.\.\.meta, folder \}\)/);
  assert.match(viewer, /renderAll\(searchInput\.value\.trim\(\)\)/);
  assert.match(viewer, /const description = pageField\(page, "description"\)/);
  assert.match(viewer, /"data-folder": folderPath/);
  assert.match(viewer, /openFolders\.has\(path\)/);
});

test('folders build their cards on first open, not up front', () => {
  assert.match(viewer, /const fill = \(\) => \{/);
  assert.match(viewer, /if \(body\.__bvFilled\) return;/);
  assert.match(viewer, /details\.__bvFill = fill;/);
  assert.match(viewer, /if \(forceOpen \|\| details\.open\) fill\(\);/);
  assert.match(viewer, /if \(details\.open && typeof details\.__bvFill === "function"\) details\.__bvFill\(\);/);
  // Restoring a nested folder can create another open folder, so the loop
  // must continue until no folder is left closed.
  assert.match(viewer, /let opened = true;\s*while \(opened\) \{/);
  assert.match(viewer, /details\.__bvFill\(\);\s*details\.open = true;\s*opened = true;/);
});
