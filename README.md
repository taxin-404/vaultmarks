# Vaultmarks

A minimal, Raindrop-style bookmark library that stores every bookmark as a
Markdown note in your Obsidian vault. No server, no helper process, no
account: the extension talks to the folder you pick, and Obsidian shows the
full details of every bookmark.

- **Panel** — the toolbar icon opens a two-pane panel: a collections sidebar
  and the bookmark list with search, sized for a Chromium popup (780×600).
  **Save page** captures the page you are on (title, URL, description, cover,
  favicon, tags).
- **Tab** — the ⤢ button opens the same page as a full-width tab; the panel
  and the tab are one codebase and one dataset, so they can never drift.
- **Surgical writes** — editing a bookmark patches only the keys it owns and
  leaves the rest of the note (comments, unknown keys, body, line endings,
  BOM) exactly as Obsidian wrote it.

## Requirements

- Chromium 128+ (developed and tested on Chromium 155). The File System
  Access API is required; Firefox and Safari are not supported.
- An Obsidian vault folder. Vaultmarks looks for a `Bookmarks` subfolder
  inside the folder you pick and uses it when it exists.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder (`/home/taxin/Work/vaultmarks`).

## First run

On first run the panel shows **Choose your Obsidian vault folder**; clicking it
opens the library tab, where you pick your vault root (for example
`~/Documents/notes`). The picker runs in a tab because a folder-permission
prompt can otherwise close the popup. The grant covers reading and writing
inside that folder only.

Chromium can keep the folder grant between visits. When it asks, choose
**Allow on every visit**: Vaultmarks then opens the saved folder without
prompting, including after a browser restart. Choosing **Allow this time**
grants access only until the panel closes, so the next open shows the
**Reconnect folder** banner; one click re-grants access and rebuilds the list.

If you set up Vaultmarks with an older version, reconnect once and pick the
same vault root. Older versions stored the `Bookmarks` subfolder, which
Chromium cannot match to the grant on the root; after that single re-pick the
prompt is remembered.

## Usage

**Save page.** On a normal web page, click the toolbar icon and press
**Save page**. The title, description and cover are pre-filled, and the
collection defaults to the last one you used; adjust them, add tags and pick a
collection, then press **Save**. If the URL is already saved, Vaultmarks says
where it lives and offers **Open** or **Save anyway**. The note then appears in
the list, and its detail view offers **Open in Obsidian**.

**Panel and tab.** The panel and the full tab (opened with ⤢) are the same page:
search, list and detail are identical. Type in the search box (or press
<kbd>/</kbd>) to filter by title, description, URL, domain or tags;
<kbd>Esc</kbd> clears it. Click a collection in the sidebar to filter by folder.
Hover a row for three actions:

- 👁 **Details** — cover, title, URL, description, date, tags and collection,
  with **Open**, **Copy link**, **Edit**, **Move to…**, **Delete**,
  **Open in Obsidian** and **Close**.
- ✏️ **Edit** — change the title (this renames the file), URL, description,
  tags or collection.
- 🗑 **Delete** — moves the note to the hidden `.vaultmarks-trash` folder
  inside the store; nothing is hard-deleted.

**+ New** (top of the list) creates a note by hand. **+** next to
*Collections* creates a folder at the store root. Collections are plain
folders, so nested collections are made in Obsidian and show up here.

**Settings** (gear, sidebar header) shows the store folder, how many notes were
skipped, the version, and **Rescan** / **Change folder**.

### Conflicts

Vaultmarks remembers the exact bytes of every note it loaded. If a note
changes in Obsidian between loading and saving, the write is refused with
*"This note changed in Obsidian. Reload and try again."* and a **Reload**
button. Nothing is ever overwritten blindly.

## Data format

Each bookmark is one `.md` file using the same frontmatter keys as the
Obsidian Web Clipper:

```markdown
---
title: "Vaultwarden"
url: "https://vaultwarden.example"
created: 2026-07-28
description: "Lightweight, self-hosted Bitwarden-compatible password manager server."
image: "https://example.com/cover.png"
favicon: "https://example.com/favicon.ico"
tags:
  - "bookmarks"
  - "selfhosted"
---

![](https://example.com/cover.png)

Lightweight, self-hosted Bitwarden-compatible password manager server.

[Open original ↗](https://vaultwarden.example)
```

- `tags` always contains the base tag `bookmarks` (hidden from the UI). New
  notes always include it.
- `created` is written as a plain `YYYY-MM-DD` date.
- `image` and `favicon` are omitted when there is nothing to write; existing
  values are never truncated.
- **Cover fallback:** if a note has no `image` key, the first image in the
  body (`![](...)`) is used as the thumbnail; failing that, a favicon tile is
  shown. 167 of the existing notes keep their cover only in the body — they
  all display a cover without any rewriting.
- Filenames come from the title (capped at 120 characters / 200 bytes) and
  collisions get ` (2)`, ` (3)`, … case-insensitively.
- Notes with dot-prefixed names or folders are ignored, as are any files that
  are not `.md` or that have no `url`.

## Permissions

| Permission | Why |
| --- | --- |
| `activeTab` + `scripting` | Read the title, description, image and favicon of the page you are on, only when you press **Save page** in the panel. |
| `favicon` | Show site icons from Chromium's cache for notes that have no cover. |
| `storage` | Remember the folder handle and small settings (last collection, store label). |

There are no host permissions and no background service worker.

## Storage guarantees

- Vaultmarks reads and writes **only** inside the folder you pick. Nothing is
  uploaded anywhere.
- Deletes go to `<store>/.vaultmarks-trash/` as
  `ISO-timestamp--original-name.md`.
- `chrome.storage` holds only the folder handle and settings; the vault is
  the single source of truth.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Reconnect folder" banner | The folder grant ended: **Allow this time** was chosen, or browsing data was cleared. Click **Reconnect folder** and choose **Allow on every visit** next time. |
| "Folder not found; choose it again." | The folder moved or was renamed. Click the button and re-pick it. |
| "This page can't be saved." | Browser-internal pages (`chrome://…`, the Web Store, `file://`) can't be read. Use a normal web page. |
| "This note changed in Obsidian. Reload and try again." | The note changed after the library loaded it. Click **Reload**, re-apply your edit. |
| "Already saved in <collection>" | The URL is already in the vault; open it, or use **Save anyway** to add a second note. |

## Tests

```bash
npm test
```

Plain `node --test` with no dependencies: manifest/permissions, note parsing
(CRLF, BOM, quoted and inline tags, body-cover fallback), surgical patching,
filenames, the index/search/date/URI helpers, page-metadata capture, and the
extension pages (no inline scripts/handlers, wiring ids present).

`docs/manual-test-checklist.md` holds the parts a test cannot cover: the
folder picker, real writes in Chromium, and Obsidian rendering.
