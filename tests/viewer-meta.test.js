import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const viewer = await readFile(new URL('../obsidian/vaultmarks.md', import.meta.url), 'utf8');

// The viewer is one inline dataviewjs block: run only the pure HTML helpers
// here instead of the whole block (which needs Obsidian's `dv`).
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

const helpers = [
  'decodeEntities', 'parseHtmlAttributes', 'hostOf', 'cleanCoverImage',
  'stripGitHubBoilerplate', 'githubRepoCover', 'jsonLdType', 'jsonLdFirstImage',
  'collectJsonLdObjects', 'jsonLdGeneralMeta', 'jsonLdScripts', 'extractPageMeta',
];
const extractPageMeta = new Function(
  `${helpers.map((name) => extractFunction(viewer, name)).join('\n')}
   return extractPageMeta;`,
)();

test('extractPageMeta falls back to JSON-LD when Open Graph is missing', () => {
  const html = `
    <html><head>
      <title>Example &amp; Co</title>
      <script type="application/ld+json">
        {"@context": "https://schema.org", "@graph": [
          {"@type": "WebSite", "description": "The site tagline", "image": "/site.png"},
          {"@type": "BlogPosting", "description": " A post\\n about examples. ",
           "image": {"url": "/post.png"}}
        ]}
      </script>
    </head></html>`;

  const meta = extractPageMeta(html, 'https://example.com/post');
  assert.equal(meta.title, 'Example & Co');
  assert.equal(meta.description, 'A post about examples.');
  assert.equal(meta.image, 'https://example.com/post.png');
});

test('Open Graph wins over JSON-LD and the page URL is never a cover', () => {
  const html = `
    <meta property="og:description" content="Meta description">
    <meta property="og:image" content="https://example.com/og.png">
    <script type="application/ld+json">
      {"@type": "Article", "description": "JSON-LD description", "image": "https://example.com/ld.png"}
    </script>`;

  const meta = extractPageMeta(html, 'https://example.com/a');
  assert.equal(meta.description, 'Meta description');
  assert.equal(meta.image, 'https://example.com/og.png');

  const self = extractPageMeta(
    '<meta property="og:image" content="https://example.com/a">',
    'https://example.com/a',
  );
  assert.equal(self.image, '');
});

test('generic preview images are dropped', () => {
  const images = [
    'https://abs.twimg.com/rweb/ssr/default/v2/og/image.png',
    'https://s0.wp.com/i/blank.jpg',
    'https://example.com/spacer.gif',
    'https://pixel.wp.com/g.gif',
  ];
  for (const image of images) {
    const meta = extractPageMeta(
      `<meta property="og:image" content="${image}">`,
      'https://example.com/page',
    );
    assert.equal(meta.image, '', image);
  }
});

test('a generic meta image does not block the JSON-LD cover', () => {
  const html = `
    <meta property="og:image" content="https://abs.twimg.com/rweb/ssr/default/v2/og/image.png">
    <script type="application/ld+json">
      {"@type": "Article", "image": "https://example.com/real.png"}
    </script>`;
  const meta = extractPageMeta(html, 'https://example.com/a');
  assert.equal(meta.image, 'https://example.com/real.png');
});

test('GitHub repositories get a cover and lose the sign-up sentence', () => {
  const html = `
    <meta name="description" content="A useful repo. Contribute to a/b development by creating an account on GitHub.">
    <meta property="og:image" content="https://abs.twimg.com/rweb/ssr/default/v2/og/image.png">`;

  const meta = extractPageMeta(html, 'https://github.com/a/b');
  assert.equal(meta.description, 'A useful repo.');
  assert.equal(meta.image, 'https://opengraph.githubassets.com/1/a/b');

  const nonRepo = extractPageMeta('', 'https://github.com/topics/ai');
  assert.equal(nonRepo.image, '');

  const otherHost = extractPageMeta(
    '<meta name="description" content="Keep this. Contribute to a/b development by creating an account on GitHub.">',
    'https://example.com/a/b',
  );
  assert.match(otherHost.description, /Contribute to/);
});

test('JSON-LD image strings, arrays and broken scripts are handled', () => {
  const arrayImage = extractPageMeta(`
    <script type="application/ld+json">
      {"@type": "Product", "image": ["https://example.com/one.png", "https://example.com/two.png"]}
    </script>`, 'https://example.com/p');
  assert.equal(arrayImage.image, 'https://example.com/one.png');

  const broken = extractPageMeta(
    '<script type="application/ld+json">{not json}</script>',
    'https://example.com/p',
  );
  assert.equal(broken.description, '');
  assert.equal(broken.image, '');
});
