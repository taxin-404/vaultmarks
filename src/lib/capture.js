import { domainOf, tagsFromText } from './notes.js';

function collapse(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

// Cut without splitting a surrogate pair, so the note never ends with half an
// emoji.
function clip(value, max) {
  const text = String(value ?? '');
  if (text.length <= max) return text;
  let end = Math.max(0, max);
  const code = text.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return text.slice(0, end);
}

function resolveHttpAsset(value, base) {
  const raw = String(value ?? '').trim();
  if (raw === '') return '';
  try {
    const url = new URL(raw, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

export function isSavableUrl(url) {
  try {
    const protocol = new URL(String(url)).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeMeta(raw, pageUrl) {
  const source = raw ?? {};
  const page = String(pageUrl ?? '');
  let origin = '';
  try {
    origin = new URL(page).origin;
  } catch {
    origin = '';
  }

  let favicon = resolveHttpAsset(source.favicon, page);
  if (favicon === '' && origin !== '' && origin !== 'null') favicon = `${origin}/favicon.ico`;

  return {
    title: collapse(source.title) || domainOf(page),
    url: isSavableUrl(page) ? page : '',
    description: clip(collapse(source.description), 1000),
    image: resolveHttpAsset(source.image, page).slice(0, 2000),
    favicon,
  };
}

export function savePrefill(meta, { lastCollection = '', selectedCollection = '' } = {}) {
  return {
    title: meta.title,
    url: meta.url,
    description: meta.description,
    image: meta.image,
    favicon: meta.favicon,
    tags: tagsFromText(meta.description),
    collection: lastCollection || selectedCollection || '',
  };
}

function extractMeta() {
  const meta = (selector) => document.querySelector(selector)?.content ?? '';

  // Rebuild the visible text of a subtree. Emoji are images on X, so their alt
  // text has to be included; innerText leaves them out.
  const textOf = (node) => {
    let out = '';
    for (const child of node.childNodes) {
      if (child.nodeType === 3) out += child.nodeValue;
      else if (child.nodeType === 1) {
        const tag = child.tagName.toLowerCase();
        out += tag === 'img'
          ? (child.getAttribute('alt') ?? '')
          : tag === 'br' ? ' ' : textOf(child);
      }
    }
    return out;
  };

  const squeeze = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const decode = (value) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  // Many sites ship no description at all (Wikipedia, for one). The opening
  // paragraph of the article is the next best thing, and it is still the page's
  // own words. Only used when every meta tag came back empty, and only on a
  // page that looks like one article: an h1 that matches the title. That keeps
  // app shells, challenge pages and feed homepages from donating a random
  // teaser as the description.
  const firstParagraph = () => {
    const roots = [
      document.querySelector('article'),
      document.querySelector('main'),
      document.querySelector('[role="main"]'),
    ];
    const pageTitle = String(document.title ?? '').toLowerCase();
    for (const root of roots) {
      if (!root) continue;
      const heading = [...root.querySelectorAll('h1')]
        .filter((el) => !el.closest('[hidden], [aria-hidden="true"]'))
        .map((el) => squeeze(el.textContent))
        .find((text) => text.length >= 3 && pageTitle.includes(text.toLowerCase()));
      if (!heading) continue;
      for (const p of root.querySelectorAll('p')) {
        if (p.closest('[hidden], [aria-hidden="true"]')) continue;
        const text = squeeze(p.textContent);
        if (text.length >= 100) return text.slice(0, 1200);
      }
    }
    return '';
  };

  // Logged-in Facebook serves no Open Graph tags; the post text sits in this
  // stable container. Comments use the same one, so pick the container closest
  // to the top of the document: the post itself, not the first comment.
  const fbPost = () => {
    const host = location.hostname.replace(/^www\./i, '').toLowerCase();
    if (!/(^|\.)facebook\.com$/.test(host)) return null;
    const nodes = [...document.querySelectorAll('[data-ad-preview="message"], [data-ad-comet-preview="message"]')];
    let best = null;
    let bestTop = Infinity;
    const scroll = window.scrollY || 0;
    for (const el of nodes) {
      const top = el.getBoundingClientRect().top + scroll;
      if (top < bestTop) {
        bestTop = top;
        best = el;
      }
    }
    const text = best ? squeeze(textOf(best)) : '';
    return text === '' ? null : { text: text.slice(0, 1600) };
  };

  // Logged-in GitHub drops the description meta tags on repository pages
  // (logged-out visitors still get them, and those win in siteMeta). The
  // repository's own text is in the About box, so read it from there.
  const githubAbout = () => {
    const host = location.hostname.replace(/^www\./i, '').toLowerCase();
    if (host !== 'github.com') return null;
    const node = document.querySelector('p[class*="SidebarAbout"][class*="description"]')
      || document.querySelector('[itemprop="description"]')
      || document.querySelector('.BorderGrid-cell > p.f4');
    const text = node ? squeeze(node.textContent) : '';
    return text === '' ? null : { text: text.slice(0, 1200) };
  };

  // While logged in, X leaves og:description empty and points og:image at a
  // generic logo, even though the post text and its media are in the DOM.
  // Read those here so the bookmark keeps the post the user is looking at.
  const xPost = () => {
    const host = location.hostname.replace(/^www\./i, '').toLowerCase();
    if (host !== 'x.com' && host !== 'twitter.com') return null;
    if (!/\/status(?:es)?\/\d+/.test(location.pathname)) return null;
    const article = document.querySelector('article[tabindex="-1"]') || document.querySelector('article');
    if (!article) return null;

    // A quoted post lives inside a link card. Its author, text and media must
    // not be mistaken for the post being saved.
    const quoted = (el) => el.closest('[role="link"][tabindex="0"]') !== null;
    const firstOwn = (selector) => [...article.querySelectorAll(selector)]
      .find((el) => !quoted(el)) ?? null;

    const textEl = firstOwn('[data-testid="tweetText"]');
    const nameEl = firstOwn('[data-testid="User-Name"]');
    const nameLink = [...(nameEl?.querySelectorAll('a[href]') ?? [])]
      .find((a) => !quoted(a) && squeeze(a.textContent) !== '') ?? null;
    const images = [...article.querySelectorAll('img')].filter((img) => !quoted(img));
    const photo = images.find((img) => /\/(?:media|amplify_video_thumb)\//.test(img.src));
    const avatar = images.find((img) => img.src.includes('/profile_images/'));

    return {
      text: textEl ? squeeze(textOf(textEl)).slice(0, 1600) : '',
      display: nameLink ? squeeze(nameLink.textContent) : '',
      handle: nameLink
        ? decode((nameLink.getAttribute('href') ?? '').replace(/^\/+/, '').split(/[/?#]/)[0])
        : '',
      photo: photo?.src ?? '',
      avatar: avatar?.src ?? '',
    };
  };

  const description = meta('meta[property="og:description"]')
    || meta('meta[name="description"]')
    || meta('meta[name="twitter:description"]')
    || '';

  return {
    title: meta('meta[property="og:title"]') || document.title || '',
    // The address bar is the source of truth. A canonical link can point at a
    // different page (and on single-page apps it can lag behind the URL the
    // user is actually looking at).
    url: location.href,
    description: description || firstParagraph(),
    image: meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]') || '',
    favicon: document.querySelector('link[rel~="icon"]')?.href || '',
    // YouTube (and other video sites) leave the Open Graph tags on the first
    // video when navigating inside the app, but their JSON-LD is updated.
    // Read it here and let the extension choose the entry for this URL.
    jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => script.textContent ?? '')
      .filter((text) => text.includes('VideoObject'))
      .slice(0, 10),
    xPost: xPost(),
    fbPost: fbPost(),
    githubAbout: githubAbout(),
  };
}

// Prefer the URL read from the page itself: it is updated by the page's own
// history calls, even when Chrome's tab object still reports the previous
// URL. Fall back to the tab URL for pages that refuse injection.
export function preferredPageUrl(tabUrl, capturedUrl) {
  if (isSavableUrl(capturedUrl)) return String(capturedUrl);
  return isSavableUrl(tabUrl) ? String(tabUrl) : '';
}

function collectObjects(value, out) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjects(item, out);
    return;
  }
  if (!value || typeof value !== 'object') return;
  out.push(value);
  if (Array.isArray(value['@graph'])) collectObjects(value['@graph'], out);
}

function videoIdOf(pageUrl) {
  try {
    const url = new URL(pageUrl);
    return url.searchParams.get('v')
      || url.pathname.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]+)/)?.[1]
      || '';
  } catch {
    return '';
  }
}

function isVideoObject(node) {
  const type = node?.['@type'];
  return type === 'VideoObject' || (Array.isArray(type) && type.includes('VideoObject'));
}

function firstImage(value) {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === 'string') return collapse(first);
  if (first && typeof first === 'object') return collapse(first.url ?? first.contentUrl ?? '');
  return '';
}

// Pick the VideoObject that describes this exact page. Sites that navigate
// inside the app (YouTube) keep every video they played in the JSON-LD; the
// newest one wins the tie-break because it is usually the richest.
export function findVideoObject(values, pageUrl) {
  const nodes = [];
  for (const value of values ?? []) {
    let parsed = value;
    if (typeof parsed === 'string') {
      if (!parsed.includes('VideoObject')) continue;
      try {
        parsed = JSON.parse(parsed);
      } catch {
        continue;
      }
    }
    collectObjects(parsed, nodes);
  }

  const id = videoIdOf(pageUrl);
  let best = null;
  let bestScore = -1;
  for (const node of nodes) {
    if (!isVideoObject(node)) continue;
    const fields = [node['@id'], node.url, node.embedUrl, node.mainEntityOfPage]
      .filter((value) => typeof value === 'string');
    const matches = fields.some((value) => value === pageUrl || (id !== '' && value.includes(id)));
    if (!matches) continue;
    const thumb = firstImage(node.thumbnailUrl ?? node.image);
    const score = (node.name ? 2 : 0) + (node.description ? 2 : 0) + (thumb ? 1 : 0) + (node.embedUrl ? 1 : 0);
    if (score >= bestScore) {
      best = node;
      bestScore = score;
    }
  }
  return best;
}

export function structuredMeta(raw, pageUrl) {
  const source = raw ?? {};
  const video = findVideoObject(source.jsonLd ?? [], pageUrl);
  if (!video) return source;
  return {
    ...source,
    title: collapse(video.name) || source.title || '',
    // Once the right video is known, do not fall back to Open Graph fields:
    // on these sites they belong to the previously played video. An empty
    // description or image is better than the wrong one.
    description: collapse(video.description),
    image: firstImage(video.thumbnailUrl ?? video.image),
  };
}

const X_HOSTS = new Set(['x.com', 'twitter.com', 'mobile.twitter.com']);
const FB_HOST = /(^|\.)facebook\.com$/;

// A repository with no description shows this in its About box. It is a UI
// placeholder, not something the repo says about itself.
const GITHUB_NO_ABOUT = /^No description, website, or topics provided\.?$/i;

// Logged-out GitHub appends this sentence to every repository description.
// It describes the sign-up page, not the repository, so it is not saved.
const GITHUB_BOILERPLATE = /\s*Contribute to [^\s/]+\/[^\s/]+ development by creating an account on GitHub\.?\s*$/i;

function githubAboutText(value) {
  const text = value && typeof value === 'object' ? collapse(value.text) : '';
  return GITHUB_NO_ABOUT.test(text) ? '' : text;
}

// X ships this as og:image on every logged-in page. It is a logo, not the
// page's picture, so it is never worth saving as a cover.
const X_PLACEHOLDER_IMAGE = /^https?:\/\/abs\.twimg\.com\/rweb\/ssr\/default\//i;

function hostOf(pageUrl) {
  try {
    return new URL(String(pageUrl ?? '')).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

// Top-level github.com paths that are not repository owners.
const GITHUB_NON_REPO = new Set([
  'about', 'account', 'apps', 'blog', 'codespaces', 'collections', 'contact',
  'dashboard', 'enterprise', 'events', 'explore', 'features', 'issues', 'join',
  'login', 'logout', 'marketplace', 'new', 'notifications', 'orgs',
  'organizations', 'pricing', 'pulls', 'readme', 'search', 'security',
  'sessions', 'settings', 'site', 'sponsors', 'topics', 'trending', 'users',
]);

// Logged-in GitHub also drops og:image on repository pages. The social
// preview service renders a card for any repository and ignores the cache key
// in the path, so the cover can be rebuilt from the repository URL.
function githubRepoCover(pageUrl) {
  if (hostOf(pageUrl) !== 'github.com') return '';
  let url;
  try {
    url = new URL(String(pageUrl));
  } catch {
    return '';
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return '';
  const [owner, repo] = parts;
  if (GITHUB_NON_REPO.has(owner.toLowerCase()) || GITHUB_NON_REPO.has(repo.toLowerCase())) return '';
  return `https://opengraph.githubassets.com/1/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

// `Author on X: "the post text" / X` is what X uses for og:title. It is the
// fallback when the post body has not rendered yet.
export function xPostTextFromTitle(title) {
  const match = /\son X: "(.*)" \/ X$/.exec(collapse(title));
  return match ? collapse(match[1]) : '';
}

// Strip the unread counter and the app suffix Facebook adds to titles, e.g.
// `(1) Beauty in chaos - NASA | Facebook`.
export function cleanFacebookTitle(title) {
  return collapse(title)
    .replace(/^\(\d+\)\s*/, '')
    .replace(/\s*\|\s*Facebook$/i, '')
    .trim();
}

// X keeps the post text only in the DOM: while logged in there is no meta
// description, and the image meta is a placeholder. Prefer what the page
// itself shows, and build the same author title the site uses publicly.
// Facebook is the same story, minus the title: no meta tags at all.
export function siteMeta(raw, pageUrl) {
  const source = raw ?? {};
  const host = hostOf(pageUrl);

  let out = source;
  if (X_HOSTS.has(host)) {
    if (X_PLACEHOLDER_IMAGE.test(String(out.image ?? '').trim())) out = { ...out, image: '' };
    const post = out.xPost;
    if (post && typeof post === 'object') {
      const display = collapse(post.display);
      const handle = collapse(post.handle).replace(/^@+/, '');
      const author = display === ''
        ? (handle === '' ? '' : `@${handle}`)
        : (handle === '' ? display : `${display} (@${handle})`);
      const text = collapse(post.text) || xPostTextFromTitle(out.title);
      out = {
        ...out,
        title: author === '' ? out.title : `${author} on X`,
        description: text === '' ? collapse(out.description) : text,
        image: String(post.photo ?? '').trim()
          || String(post.avatar ?? '').trim()
          || out.image,
      };
    }
  }

  if (FB_HOST.test(host)) {
    const title = cleanFacebookTitle(out.title);
    const post = out.fbPost;
    const text = post && typeof post === 'object' ? collapse(post.text) : '';
    out = {
      ...out,
      title: title === '' ? out.title : title,
      description: collapse(out.description) || text,
    };
  }

  // Logged-in GitHub serves repository pages without a description meta tag
  // and without og:image. The About box still has the repository's own
  // description, and a cover can be rebuilt from the repository URL.
  // Logged-out pages do have the meta tags, but their description ends with
  // GitHub's "Contribute to..." sign-up sentence, which is not saved.
  if (host === 'github.com') {
    const changes = {};
    const about = githubAboutText(out.githubAbout);
    const description = collapse(out.description);
    const cleaned = description.replace(GITHUB_BOILERPLATE, '').trim();
    if (cleaned !== description) {
      changes.description = about || cleaned;
    } else if (description === '' && about !== '') {
      changes.description = about;
    }
    if (collapse(out.image) === '') {
      const cover = githubRepoCover(pageUrl);
      if (cover !== '') changes.image = cover;
    }
    if (Object.keys(changes).length > 0) out = { ...out, ...changes };
  }

  return out;
}

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

async function readPage(tabId) {
  const results = await chrome.scripting.executeScript({ target: { tabId }, func: extractMeta });
  return results?.[0]?.result ?? null;
}

export async function captureActiveTab() {
  const [found] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!found) throw new Error('unsupported');

  // Re-read the tab instead of trusting the object from the query: the popup
  // can stay open while the page navigates (YouTube autoplay, SPA links).
  let tab = found;
  try {
    tab = await chrome.tabs.get(found.id);
  } catch {
    // Keep the queried tab if get() is not available.
  }
  if (!tab || !isSavableUrl(tab.url)) throw new Error('unsupported');

  let raw = null;
  let pageUrl = tab.url;
  const attempts = 5;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      raw = await readPage(tab.id);
    } catch {
      if (attempt === attempts - 1) throw new Error('unsupported');
      await delay(150);
      continue;
    }
    if (!raw) {
      if (attempt === attempts - 1) throw new Error('unsupported');
      await delay(150);
      continue;
    }
    // If the tab committed a navigation while the page was being read, read
    // the new document instead of mixing the old metadata with a new URL.
    let latest = tab;
    try {
      latest = await chrome.tabs.get(tab.id);
    } catch {
      // Keep the tab we already have.
    }
    if (latest && latest.url !== tab.url && isSavableUrl(latest.url)) {
      if (attempt === attempts - 1) break;
      tab = latest;
      await delay(150);
      continue;
    }
    pageUrl = preferredPageUrl(tab.url, raw.url);
    const waiting = Array.isArray(raw.jsonLd) && raw.jsonLd.length > 0
      && findVideoObject(raw.jsonLd, pageUrl) == null;
    if (!waiting || attempt === attempts - 1) break;
    // The page URL changed but its structured data has not caught up yet
    // (YouTube takes a few hundred milliseconds). Wait briefly and reread.
    await delay(250);
    try {
      tab = await chrome.tabs.get(tab.id);
    } catch {
      // Keep the tab we already have.
    }
  }

  pageUrl = preferredPageUrl(tab.url, raw?.url ?? '');
  return normalizeMeta(siteMeta(structuredMeta(raw, pageUrl), pageUrl), pageUrl);
}
