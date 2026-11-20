![Vaultmarks](docs/brand/banner.svg)

# Vaultmarks

**Save on desktop. Read on your phone. Keep the files.**

![Chromium MV3](https://img.shields.io/badge/Chromium-MV3-6d4ae0?style=flat-square)
![No server](https://img.shields.io/badge/server-none-14101f?style=flat-square)
![Obsidian](https://img.shields.io/badge/Obsidian-vault-6d4ae0?style=flat-square)
![Markdown](https://img.shields.io/badge/storage-Markdown-c4b5fd?style=flat-square)

Vaultmarks saves the page you are on as a Markdown note in your Obsidian vault,
from the Chromium toolbar. The same folder opens as a searchable library inside
Obsidian, so the phone is a first-class reading surface. No server, no account,
no database: the files are the product.

![The Vaultmarks panel in dark mode](docs/brand/panel.png)

*The panel in dark mode: collections on the left, saved bookmarks on the right.*

## Two places, one library

<p align="center">
  <img src="docs/brand/phone.png" alt="The Vaultmarks viewer at phone width" width="390">
</p>

<p align="center"><em>The viewer at phone width: search, nested collections and editable cards.</em></p>

On the desktop, one click captures the page: title, URL, description, cover,
favicon and tags. The note lands in the collection you choose, in the same
format the Obsidian Web Clipper uses.

On the phone, open `obsidian/vaultmarks.md` in Obsidian. The viewer block reads
the same folder: search, nested collections, covers, edit and fast add, with
nothing to install beyond Dataview. Every bookmark stays a plain `.md` file, so
Obsidian Sync, git or any backup tool carries it.

## What you get

- **Panel** — the toolbar icon opens a two-pane panel: a collections sidebar
  and the bookmark list with search, sorting and keyboard navigation, sized
  for a Chromium popup (780×600). **Save page** captures the page you are on
  (title, URL, description, cover, favicon, tags); the **+** next to the
  search box saves it in one step.
- **Tab** — the expand button opens the same page as a full-width tab; the
  panel and the tab are one codebase and one dataset, so they can never drift.
- **Obsidian view** — `obsidian/vaultmarks.md` is a ready-made DataviewJS
  page that renders the same folder as a searchable, collapsible library,
  with covers, edit/delete and fast add. No extension needed to read it.
  Saved from a phone with no connection, the bookmark is written straight
  away and its description and cover are filled in on the next online open.
- **Surgical writes** — editing a bookmark patches only the keys it owns and
  leaves the rest of the note (comments, unknown keys, body, line endings,
  BOM) exactly as Obsidian wrote it.

## Requirements

- Chromium 128+ (developed and tested on Chromium 155). The File System
  Access API is required; Firefox and Safari are not supported.
- An Obsidian vault folder. Vaultmarks uses the `Bookmarks` subfolder inside
  the folder you pick when it exists.
- Node.js 20+ — only needed to run the tests.

## Install

1. Clone the repository, or use **Code → Download ZIP** and unzip it:

   ```bash
   git clone https://github.com/taxin-404/vaultmarks.git
   ```

2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the folder that contains
   `manifest.json` (the repository root).

After pulling an update, press the reload icon on the extension card and
reopen the panel.

## First run

On first run the panel shows **Choose your Obsidian vault folder**; clicking it
opens the library tab, where you pick your vault root (for example
`~/Documents/notes`). The picker runs in a tab because a folder-permission
prompt can otherwise close the popup. The grant covers reading and writing
inside that folder only.

Chromium can remember that grant. When it asks, choose **Allow on every
visit**: Vaultmarks then reopens the saved folder without prompting, including
after a restart. Choosing **Allow this time** grants access only until the panel
closes, so the next launch shows the **Reconnect folder** banner; one click
re-grants access and rebuilds the list.

If the banner comes back every time, Chrome is not keeping the grant: click
**Reconnect folder** and pick **Allow on every visit** in the prompt.

Vaultmarks used to store the `Bookmarks` subfolder instead of the vault root.
Chrome files the grant under the folder you picked, so that old record could
never match it and reconnected on every launch. On the first launch after
updating, the banner asks once to **Choose vault folder**; after that the
grant is remembered. A flat vault needs no action.

## Usage

**Save page.** On a normal web page, click the toolbar icon and press
**Save page**. The title, description and cover are pre-filled, and the
collection defaults to the last one you used; adjust them, add tags and pick a
collection, then press **Save**. If the URL is already saved, Vaultmarks says
where it lives and offers **Open** or **Save anyway**. The note then appears in
the list, and its detail view offers **Open in Obsidian**.

Capture follows the page itself: on sites that change content without a reload
(YouTube, for example) it reads the URL and the current video's structured
data, so the note matches what is on screen rather than the first video or the
previous page. On X, where a logged-in page has no meta description and points
its preview image at a logo, it reads the post text and media from the page:
the title becomes *Author (@handle) on X*, the description is the post, and the
cover is its photo or video still. Facebook posts work the same way without the
author title. When a page publishes no description at all — Wikipedia, for
instance — Vaultmarks falls back to the opening paragraph of the article, and
only when the page's heading matches its title, so app shells and feed pages
never donate an unrelated teaser.

**Quick save.** Press **+** next to the search box on a normal web page.
Vaultmarks captures the page and asks only two things: the collection and the
name, pre-filled with the page title and selected so you can type over it.
Press <kbd>Enter</kbd> to write the note; URL, description, cover, favicon,
the `bookmarks` tag and today's date all come from the page. A duplicate URL is
refused with *Already saved in ...* and the same **Open** / **Save anyway**
choices. Clearing the name falls back to the page title.

**New** (right side of the list header) opens the empty form when you need a
bookmark that is not the page you are on — paste the URL and fill it in by
hand.

**Panel and tab.** The panel and the full tab (opened with the expand button)
are the same page: search, list and detail are identical. The tab hides
**Save page** and **+** because there is no page to capture there; **New**
still works. Type in the search box (or press <kbd>/</kbd>) to filter by
title, description, URL, domain or tags; matches are highlighted and
<kbd>Esc</kbd> clears them. Click a collection in the sidebar to filter by
folder. The sort control in the list header switches between **Newest**,
**Oldest** and **Title A–Z**, and remembers the choice. Click a tag in a
bookmark's details to see everything with that tag; the chip in the header
clears the tag filter.

**Keyboard.** <kbd>/</kbd> search · <kbd>↑</kbd>/<kbd>↓</kbd> select ·
<kbd>Enter</kbd> details · <kbd>e</kbd> edit · <kbd>d</kbd> delete ·
<kbd>n</kbd> new · <kbd>Home</kbd>/<kbd>End</kbd> first/last ·
<kbd>Esc</kbd> clear the selection or filters.

Hover a row for three actions:

- **Details** — cover, title, URL, description, date, tags and collection,
  with **Open**, **Copy link**, **Edit**, **Move to...**, **Delete**,
  **Open in Obsidian** and **Close**.
- **Edit** — change the title (this renames the file), URL, description,
  tags or collection.
- **Delete** — asks in a small panel dialog, then moves the note to the hidden
  `.vaultmarks-trash` folder inside the store; nothing is hard-deleted.

**New** in the list header creates a note by hand. **+** next to
*Collections* creates a folder at the store root. Collections are plain
folders, so folders made in Obsidian appear here too. Drag a collection row
onto another one to nest it, or onto **All bookmarks** to move it back to the
root; Vaultmarks refuses a drop that would put a collection inside itself.

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
  shown. Notes that only ever stored a cover in the body still display one —
  no rewriting required.
- Any `.md` note with a `url` key is picked up, including notes made by the
  Obsidian Web Clipper. Unknown keys and the body are left untouched.
- Filenames come from the title (capped at 120 characters / 200 bytes) and
  collisions get ` (2)`, ` (3)`, ... case-insensitively.
- Notes with dot-prefixed names or folders are ignored, as are any files that
  are not `.md` or that have no `url`.

## Browse the library inside Obsidian

`obsidian/vaultmarks.md` is a DataviewJS page that renders the same
`Bookmarks` folder as a searchable, nested library — no extension needed to
read it, only Obsidian.

1. Install and enable the **Dataview** community plugin.
2. In **Settings → Community plugins → Dataview**, turn on **Enable
   JavaScript Queries**. Dataview does not run `dataviewjs` blocks without it.
3. Copy `obsidian/vaultmarks.md` into your vault (the root is fine) and open
   it; the block runs automatically.

What it does:

- **Folder tree** — collections and nested collections as plain, collapsible
  rows with item counts, sorted alphabetically, with a guide line that runs
  down from each folder's chevron.
- **Cards** — cover from the frontmatter `image` (falling back to the first
  body image), favicon tile when there is no cover, title, two-line
  description and the URL.
- **Search** — title, description, URL, tags and folder names, with matches
  highlighted. <kbd>Esc</kbd> clears it; folders auto-expand while searching.
- **Edit / Delete** — the pencil opens the note; the trash button arms itself
  and a second click moves the note to Obsidian's trash.
- **Fast add** — `+` next to the search box: paste a link, pick a collection
  and press <kbd>Enter</kbd>. The page fetches title, description, cover and
  favicon through Obsidian's `requestUrl` and writes a note in the format
  above. Duplicate URLs are detected; when a page cannot be reached
  (offline or blocked) it switches to a small Title/Description form so the
  bookmark can still be saved.
- **Phone layout** — controls, cards and the folder tree adapt to phone-width
  panes: 34–40px touch targets, 16px inputs so iOS does not zoom on focus, and
  a single-line ellipsised URL.

The page expects the notes in a top-level `Bookmarks` folder, exactly where
the extension writes them. If your store lives elsewhere, change the folder
in the first line of the block (`dv.pages('"Bookmarks"')`).

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
- Every bookmark is a plain file, so Obsidian Sync, git, Syncthing or any
  backup tool works unchanged. Uninstalling the extension or revoking the
  folder grant leaves every note in place.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Reconnect folder" banner | Chromium dropped the folder grant on restart. Click **Reconnect folder**. |
| "Folder not found; choose it again." | The folder moved or was renamed. Click the button and re-pick it. |
| "This page can't be saved." | Browser-internal pages (`chrome://...`, the Web Store, `file://`) can't be read. Use a normal web page. |
| "This note changed in Obsidian. Reload and try again." | The note changed after the library loaded it. Click **Reload**, re-apply your edit. |
| "Already saved in <collection>" | The URL is already in the vault; open it, or use **Save anyway** to add a second note. |
| **Open in Obsidian** does nothing | Obsidian must be installed and registered for `obsidian://` links in that browser. |
| The viewer note shows the code block instead of the library | Enable Dataview, then turn on **Enable JavaScript Queries** in its settings. |
| The viewer shows "0 bookmarks" | The notes are not in a top-level `Bookmarks` folder; point `dv.pages('"Bookmarks"')` at your store. |

## License

Vaultmarks is free software: you can redistribute it and/or modify it under
the terms of the **GNU General Public License, version 3**. It is distributed
in the hope that it will be useful, but **without any warranty**, without even
the implied warranty of merchantability or fitness for a particular purpose.

The full terms are in [`LICENSE`](LICENSE). If you distribute a modified
version, the GPL requires you to make the corresponding source available under
the same license.

## Repository layout

| Path | Contents |
| --- | --- |
| `manifest.json` | MV3 manifest; no background worker, no host permissions. |
| `src/library/` | The panel/tab page: HTML, CSS and the UI logic. |
| `src/lib/` | Note parsing and surgical writing, indexing and search, paths, File System Access, capture. |
| `icons/` | Toolbar and store icons. |
| `obsidian/` | The DataviewJS viewer page. |
| `tests/` | `node --test` suites. |
| `docs/` | Design notes, the manual test checklist, and `docs/brand/` with the logo assets, screenshots and guide. |

## Development

There is no build step. Edit the files, press the reload icon on the
extension card in `chrome://extensions`, and reopen the panel; the tab view
reloads with it.

### Tests

```bash
npm test
```

Plain `node --test` with no dependencies: manifest/permissions, note parsing
(CRLF, BOM, quoted and inline tags, body-cover fallback), surgical patching,
filenames, the index/search/date/URI helpers, page-metadata capture, and the
extension pages (no inline scripts/handlers, wiring ids present).

### Manual checks

`docs/manual-test-checklist.md` holds the parts a test cannot cover: the
folder picker, real writes in Chromium, and Obsidian rendering.

Brand assets, the palette and the voice rules live in
[`docs/brand/README.md`](docs/brand/README.md).
