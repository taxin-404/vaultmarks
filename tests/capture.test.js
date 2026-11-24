import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMeta, isSavableUrl, savePrefill, preferredPageUrl,
  findVideoObject, structuredMeta, siteMeta, xPostTextFromTitle, cleanFacebookTitle,
} from '../src/lib/capture.js';

test('normalizeMeta resolves images, caps descriptions and falls back to the host', () => {
  const meta = normalizeMeta({
    title: '   ',
    url: 'https://example.com/a',
    description: ' d '.repeat(600),
    image: '/cover.png',
    favicon: 'data:image/png;base64,x',
  }, 'https://example.com/a');
  assert.equal(meta.title, 'example.com');
  assert.equal(meta.image, 'https://example.com/cover.png');
  assert.equal(meta.description.length, 1000);
  assert.equal(meta.favicon, 'https://example.com/favicon.ico');
});

test('normalizeMeta never cuts an emoji in half at the description cap', () => {
  const prefix = 'a'.repeat(999);
  const meta = normalizeMeta({ title: 'T', description: `${prefix}🙂tail` }, 'https://example.com');
  assert.equal(meta.description.length, 999);
  assert.doesNotMatch(meta.description, /[\uD800-\uDBFF]$/);
});

test('normalizeMeta keeps an http favicon and trims the title', () => {
  const meta = normalizeMeta({
    title: '  A   page ', url: 'https://example.com', description: 'Hi',
    image: 'https://cdn.example.com/i.png', favicon: 'https://example.com/icon.png',
  }, 'https://example.com');
  assert.equal(meta.title, 'A page');
  assert.equal(meta.favicon, 'https://example.com/icon.png');
  assert.equal(meta.image, 'https://cdn.example.com/i.png');
});

test('isSavableUrl accepts only http and https', () => {
  assert.equal(isSavableUrl('https://example.com'), true);
  assert.equal(isSavableUrl('http://example.com'), true);
  assert.equal(isSavableUrl('chrome://settings'), false);
  assert.equal(isSavableUrl('file:///tmp/x'), false);
  assert.equal(isSavableUrl('not a url'), false);
});

test('preferredPageUrl trusts the page URL when it is savable', () => {
  // YouTube-style SPA: the tab still reports the first link, the page has
  // already pushed the current one.
  assert.equal(
    preferredPageUrl('https://www.youtube.com/watch?v=first', 'https://www.youtube.com/watch?v=current'),
    'https://www.youtube.com/watch?v=current',
  );
  assert.equal(
    preferredPageUrl('https://example.com/old', 'https://example.com/new#section'),
    'https://example.com/new#section',
  );
  assert.equal(preferredPageUrl('https://example.com/a', 'chrome://settings'), 'https://example.com/a');
  assert.equal(preferredPageUrl('chrome://settings', 'https://example.com/a'), 'https://example.com/a');
  assert.equal(preferredPageUrl('chrome://settings', 'file:///tmp/x'), '');
});

const oldVideo = {
  '@type': 'VideoObject',
  '@id': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  name: 'Never Gonna Give You Up',
  thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
};

const newVideo = {
  '@type': 'VideoObject',
  '@id': 'https://www.youtube.com/watch?v=NEWVIDEO123',
  name: 'The current video',
  description: 'What is playing now.',
  embedUrl: 'https://www.youtube.com/embed/NEWVIDEO123',
  thumbnailUrl: ['https://i.ytimg.com/vi/NEWVIDEO123/maxresdefault.jpg'],
};

test('findVideoObject picks the video whose URL matches the page', () => {
  const pageUrl = 'https://www.youtube.com/watch?v=NEWVIDEO123';
  assert.equal(findVideoObject([oldVideo, newVideo], pageUrl).name, 'The current video');
  assert.equal(findVideoObject([JSON.stringify(oldVideo), JSON.stringify(newVideo)], pageUrl).name, 'The current video');
  assert.equal(findVideoObject([oldVideo], pageUrl), null);
  assert.equal(findVideoObject([], pageUrl), null);
});

test('findVideoObject understands @graph, type arrays and shorts URLs', () => {
  const wrapped = { '@graph': [{ ...oldVideo }, { ...newVideo }] };
  assert.equal(
    findVideoObject([wrapped], 'https://www.youtube.com/watch?v=NEWVIDEO123').name,
    'The current video',
  );
  const short = {
    '@type': ['VideoObject', 'Thing'],
    '@id': 'https://www.youtube.com/watch?v=SHORT12345',
    name: 'A short',
    embedUrl: 'https://www.youtube.com/embed/SHORT12345',
  };
  assert.equal(findVideoObject([short], 'https://www.youtube.com/shorts/SHORT12345').name, 'A short');
});

test('findVideoObject prefers the richest matching entry', () => {
  const bare = { '@type': 'VideoObject', '@id': 'https://www.youtube.com/watch?v=NEWVIDEO123', name: 'Bare' };
  const rich = { ...newVideo };
  assert.equal(
    findVideoObject([rich, bare], 'https://www.youtube.com/watch?v=NEWVIDEO123').name,
    'The current video',
  );
});

test('structuredMeta replaces stale Open Graph fields with the current video', () => {
  const raw = {
    title: 'Old title', description: 'Old description', image: 'https://i.ytimg.com/vi/old.jpg',
    jsonLd: [oldVideo, newVideo],
  };
  const meta = structuredMeta(raw, 'https://www.youtube.com/watch?v=NEWVIDEO123');
  assert.equal(meta.title, 'The current video');
  assert.equal(meta.description, 'What is playing now.');
  assert.equal(meta.image, 'https://i.ytimg.com/vi/NEWVIDEO123/maxresdefault.jpg');
  assert.equal(structuredMeta({ title: 'Keep' }, 'https://example.com/a').title, 'Keep');
});

test('structuredMeta never keeps metadata from the previous video', () => {
  const bare = { '@type': 'VideoObject', '@id': 'https://www.youtube.com/watch?v=BARE1234567', name: 'Bare' };
  const meta = structuredMeta({
    title: 'Old', description: 'Old description', image: 'https://i.ytimg.com/vi/old.jpg', jsonLd: [bare],
  }, 'https://www.youtube.com/watch?v=BARE1234567');
  assert.equal(meta.title, 'Bare');
  assert.equal(meta.description, '');
  assert.equal(meta.image, '');
});

test('xPostTextFromTitle reads the post text out of an og:title', () => {
  assert.equal(
    xPostTextFromTitle('jack on X: "❤️" / X'),
    '❤️',
  );
  assert.equal(
    xPostTextFromTitle('NASA on X: "On Sunday, we launch." / X'),
    'On Sunday, we launch.',
  );
  assert.equal(xPostTextFromTitle('NASA (@NASA) / X'), '');
  assert.equal(xPostTextFromTitle(''), '');
});

test('siteMeta uses the post the page is showing instead of empty meta tags', () => {
  const raw = {
    title: 'X',
    description: '',
    image: 'https://abs.twimg.com/rweb/ssr/default/v2/og/image.png',
    xPost: {
      text: 'On Sunday, Nov. 29, our cargo mission lifts off.',
      display: 'NASA',
      handle: 'NASA',
      photo: 'https://pbs.twimg.com/media/HXhDFa4W4AAJZaF?format=jpg&name=900x900',
      avatar: 'https://pbs.twimg.com/profile_images/1/a_bigger.jpg',
    },
  };
  const meta = siteMeta(raw, 'https://x.com/NASA/status/2123520987698270687');
  assert.equal(meta.title, 'NASA (@NASA) on X');
  assert.equal(meta.description, 'On Sunday, Nov. 29, our cargo mission lifts off.');
  assert.equal(meta.image, 'https://pbs.twimg.com/media/HXhDFa4W4AAJZaF?format=jpg&name=900x900');
});

test('siteMeta falls back to og:title text, then the avatar', () => {
  const meta = siteMeta({
    title: 'jack on X: "❤️" / X',
    description: '',
    image: '',
    xPost: { text: '', display: 'jack', handle: '@jack', photo: '', avatar: 'https://pbs.twimg.com/profile_images/2/b.jpg' },
  }, 'https://x.com/jack/status/20');
  assert.equal(meta.title, 'jack (@jack) on X');
  assert.equal(meta.description, '❤️');
  assert.equal(meta.image, 'https://pbs.twimg.com/profile_images/2/b.jpg');
});

test('siteMeta drops the generic X image and leaves other sites alone', () => {
  const placeholder = 'https://abs.twimg.com/rweb/ssr/default/v2/og/image.png';
  assert.equal(siteMeta({ image: placeholder, xPost: null }, 'https://x.com/jack').image, '');
  const other = { title: 'T', image: 'https://example.com/i.png' };
  assert.equal(siteMeta(other, 'https://example.com/a').image, 'https://example.com/i.png');
  assert.equal(siteMeta(other, 'https://example.com/a'), other);
});

test('siteMeta handles a missing display name and handle', () => {
  const handleOnly = siteMeta({ title: 'X', xPost: { text: 'Hi', display: '', handle: '@someone' } }, 'https://twitter.com/a/status/1');
  assert.equal(handleOnly.title, '@someone on X');
  const bare = siteMeta({ title: 'X', description: 'Kept', xPost: { text: '', display: '', handle: '' } }, 'https://x.com/a/status/1');
  assert.equal(bare.title, 'X');
  assert.equal(bare.description, 'Kept');
});

test('cleanFacebookTitle drops the unread counter and the app suffix', () => {
  assert.equal(
    cleanFacebookTitle('(1) Beauty in chaos - NASA | Facebook'),
    'Beauty in chaos - NASA',
  );
  assert.equal(cleanFacebookTitle('NASA | Facebook'), 'NASA');
  assert.equal(cleanFacebookTitle('(12) Something'), 'Something');
  assert.equal(cleanFacebookTitle('(1)'), '');
});

test('siteMeta reads a Facebook post when the page has no meta tags', () => {
  const raw = {
    title: '(1) Beauty in chaos - NASA | Facebook',
    description: '',
    image: '',
    fbPost: { text: 'Beauty in chaos. This photo from Chandra is the clearest view yet.' },
  };
  const meta = siteMeta(raw, 'https://www.facebook.com/NASA/posts/pfbid02');
  assert.equal(meta.title, 'Beauty in chaos - NASA');
  assert.equal(meta.description, 'Beauty in chaos. This photo from Chandra is the clearest view yet.');
  const kept = siteMeta({ ...raw, description: 'Meta wins' }, 'https://web.facebook.com/a/posts/1');
  assert.equal(kept.description, 'Meta wins');
});

test('siteMeta reads the About box when logged-in GitHub drops the meta tags', () => {
  const raw = {
    title: 'hxreborn/morphe-patches: 🧩 Android patches for Viber',
    description: '',
    image: '',
    githubAbout: { text: '  🧩 Android   patches for Viber, BeReal and more. ' },
  };
  const meta = siteMeta(raw, 'https://github.com/hxreborn/morphe-patches');
  assert.equal(meta.description, '🧩 Android patches for Viber, BeReal and more.');

  const kept = siteMeta({ ...raw, description: 'Meta wins' }, 'https://github.com/hxreborn/morphe-patches');
  assert.equal(kept.description, 'Meta wins');
});

test('the GitHub About fallback stays on github.com and drops the empty-repo placeholder', () => {
  assert.equal(
    siteMeta({ description: '', githubAbout: { text: 'About the repo' } }, 'https://gist.github.com/a/b').description,
    '',
  );
  assert.equal(
    siteMeta({ description: '', githubAbout: { text: 'About the repo' } }, 'https://github.com.evil.test/a/b').description,
    '',
  );
  assert.equal(
    siteMeta({ description: '', githubAbout: { text: 'No description, website, or topics provided.' } }, 'https://github.com/a/b').description,
    '',
  );
  assert.equal(
    siteMeta({ description: '', githubAbout: null }, 'https://github.com/a/b').description,
    '',
  );
});

test('siteMeta rebuilds the cover for a logged-in GitHub repository', () => {
  const raw = { title: 'a/b', description: '', image: '', githubAbout: { text: 'About b' } };
  const meta = siteMeta(raw, 'https://github.com/a/b');
  assert.equal(meta.image, 'https://opengraph.githubassets.com/1/a/b');
  assert.equal(meta.description, 'About b');

  const file = siteMeta(raw, 'https://github.com/a/b/blob/main/README.md#readme');
  assert.equal(file.image, 'https://opengraph.githubassets.com/1/a/b');

  const kept = siteMeta({ ...raw, image: 'https://example.com/c.png' }, 'https://github.com/a/b');
  assert.equal(kept.image, 'https://example.com/c.png');
});

test('the GitHub cover fallback ignores non-repository pages and other hosts', () => {
  for (const url of [
    'https://github.com/taxin-404',
    'https://github.com/settings/profile',
    'https://github.com/features/actions',
    'https://github.com/search?q=x',
    'https://gist.github.com/a/b',
    'https://github.com.evil.test/a/b',
  ]) {
    assert.equal(siteMeta({ image: '' }, url).image, '', url);
  }
});

test('savePrefill carries the captured fields and prefers the last-used collection', () => {
  const meta = {
    title: 'T', url: 'https://e.com', description: 'D',
    image: 'https://e.com/i.png', favicon: 'https://e.com/f.ico',
  };
  assert.deepEqual(savePrefill(meta, { lastCollection: 'Dev', selectedCollection: '' }), {
    title: 'T', url: 'https://e.com', description: 'D',
    image: 'https://e.com/i.png', favicon: 'https://e.com/f.ico', tags: [], collection: 'Dev',
  });
  assert.equal(savePrefill(meta, { lastCollection: '', selectedCollection: 'Dev' }).collection, 'Dev');
  assert.equal(savePrefill(meta, {}).collection, '');
});

test('savePrefill turns hashtags in the description into tags', () => {
  const prefill = savePrefill({
    title: 'T', url: 'https://e.com', description: 'Leg day #fitness #shorts #l #1',
    image: '', favicon: '',
  });
  assert.deepEqual(prefill.tags, ['fitness', 'shorts']);
});
