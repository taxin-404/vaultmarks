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
  `${extractFunction(viewer, 'applyFetchedMetadata')}; return applyFetchedMetadata;`,
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

test('offline saves are marked pending and backfilled once online', () => {
  assert.match(viewer, /if \(pending\) lines\.push\("metadata: pending"\)/);
  assert.match(viewer, /async function backfillPending/);
  assert.match(viewer, /navigator\.onLine === false/);
  assert.match(viewer, /applyFetchedMetadata\(raw, meta\)/);
  assert.match(viewer, /pending: true/);
});
