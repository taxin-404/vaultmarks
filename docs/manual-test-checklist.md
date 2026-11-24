# Vaultmarks manual test checklist

Automated coverage lives in `npm test`. This file is for the parts only a
human in a browser can do: the folder picker, real writes, Obsidian
rendering and permission loss.

## Setup

```bash
rm -rf /tmp/vaultmarks-test-vault
mkdir -p /tmp/vaultmarks-test-vault/Bookmarks
cp -a "/home/taxin/Documents/notes/Bookmarks/." /tmp/vaultmarks-test-vault/Bookmarks/
chromium --user-data-dir=/tmp/vaultmarks-chromium \
  --disable-extensions-except=/home/taxin/Work/vaultmarks \
  --load-extension=/home/taxin/Work/vaultmarks https://example.com
```

Load unpacked from `chrome://extensions` if the flag is not used.

## Panel save (unified)

- [ ] The toolbar icon opens the two-pane panel (collections sidebar + list +
      search) at 780×600: both panes are visible, the page itself does not
      scroll, and the sidebar and list scroll internally.
- [ ] **Save page** on a normal web page opens the save dialog prefilled with
      title, description and the last-used collection, with the captured cover
      shown at the top (read-only).
- [ ] On YouTube, open one video and switch to another one (same tab, no
      reload); **Save page** and **+** capture the video on screen — its URL,
      title, thumbnail and description — not the first video or the previous
      one. Autoplay switching while the panel is open behaves the same.
- [ ] On x.com while logged in, save a post: the title is
      *Author (@handle) on X*, the description is the post text, and the cover
      is the post's photo or video still instead of the X logo. A post that
      quotes another post saves the outer post's text.
- [ ] On facebook.com while logged in, save a post: the title has no `(1)`
      counter and no ` | Facebook` suffix, and the description is the post body,
      not the first comment.
- [ ] On a GitHub repository while logged in (logged-in GitHub sends no
      description meta tags there), **Save page** and **+** fill the
      description from the repository's About text and the cover from
      GitHub's social-preview card; a repository with no description still
      saves an empty one.
- [ ] Save a page that publishes no description (a Wikipedia article is the
      easy one): the description is the opening paragraph. A feed or app shell
      with no matching heading (Hacker News, a logged-out feed) still saves an
      empty description rather than a random teaser.
- [ ] Saving writes the note and it appears in the list immediately (and in an
      open library tab via `vault-changed`).
- [ ] With `chrome://settings` active, **Save page** and **+** both toast
      "This page can't be saved." and nothing else changes.
- [ ] Saving the same URL twice says **Already saved in &lt;collection&gt;**
      with **Open** and **Save anyway**; **Save anyway** writes a second note
      (`Name (2).md`).
- [ ] **+** opens Quick save with the name pre-filled and selected, and the
      collection defaulting to the last used one; <kbd>Enter</kbd> writes the
      note there and toasts "Saved".
- [ ] Typing over the name in Quick save names the file after it; clearing the
      name falls back to the page title.
- [ ] Quick save asks for the collection and writes into the one picked; the
      choice becomes the last-used one.
- [ ] **New** opens the empty form and defaults the collection to the selected
      one without changing the last-used one.
- [ ] The ⤢ button opens the same view as a full tab, where **Save page**, **+**
      and ⤢ are hidden (New stays) and the sidebar and list fill the window.
- [ ] The save form's **Save**/**Cancel** can never be clipped: the dialog
      scrolls inside the 600 px panel.
- [ ] Conflicting note: edit one in Obsidian between loading and saving it from
      the panel's detail form; the panel shows "This note changed in Obsidian.
      Reload and try again." and refuses the write until **Reload**.

## Library (Task 8)

- [ ] Onboarding appears on first open with no folder chosen.
- [ ] After picking `/tmp/vaultmarks-test-vault` the 239 notes render.
- [ ] Sidebar counts match: **All bookmarks** 239, and the collection counts
      add up (e.g. `Development` includes its subfolders).
- [ ] Search filters by title, description, domain and tag; <kbd>Esc</kbd>
      clears it; <kbd>/</kbd> focuses the box. Matches are highlighted.
- [ ] Sort switches between Newest, Oldest and Title A–Z; reopening the panel
      keeps the chosen order.
- [ ] Clicking a tag in a bookmark's details filters to that tag, the header
      shows a `#tag` chip, and clicking the chip clears the filter.
- [ ] <kbd>↑</kbd>/<kbd>↓</kbd> move the highlighted row, <kbd>Home</kbd>/
      <kbd>End</kbd> jump to the ends, <kbd>Enter</kbd> opens details,
      <kbd>e</kbd> edits, <kbd>d</kbd> deletes, <kbd>n</kbd> opens the new
      form, and <kbd>Esc</kbd> clears the selection or filters. Typing in the
      search box does not trigger these.
- [ ] An empty search or empty collection shows an explanation and action
      buttons; **Clear filters** returns the full list.
- [ ] Clicking a collection filters the list; clicking a row title opens the
      URL in a new tab.
- [ ] Switching away and back to the tab refreshes the list.
- [ ] No note is modified by browsing: compare `md5sum` of a few notes before
      and after.
- [ ] Create a collection with **+** and confirm the folder appears on disk
      and in the sidebar. Creating it again toasts the "already exists" error.
- [ ] With a collection selected, **+** creates a child inside it; with **All
      bookmarks** selected it creates at the store root.
- [ ] A folder that contains no notes still shows in the sidebar and in the
      new-bookmark collection dropdown.
- [ ] Rename a collection (hover → pencil): the folder and its notes move on disk
      and the sidebar selection follows.
- [ ] Move a collection by typing a new path (e.g. `Archive/Dev`): parents are
      created and the notes travel with it.
- [ ] Delete a collection with notes (hover → trash): it lands in
      `.vaultmarks-trash/` and disappears from the sidebar and the dropdown.
- [ ] Drag a collection row onto another collection: it nests there, the target
      expands, the source row dims, and the folder and its notes move on disk.
- [ ] Drag a nested collection onto **All bookmarks**: it returns to the top
      level and the selection follows if it was selected. Dragging a collection
      that is already at the top onto **All bookmarks** is not accepted and
      changes nothing.
- [ ] Drag a collection onto itself or one of its own descendants: no target
      outline appears and nothing changes.
- [ ] Drag a collection onto a collection that already has a child with that
      name: the "already exists" toast appears and neither folder changes.
- [ ] The hover pencil still renames/moves a collection after drag-and-drop.

## Permission loss (Task 8)

- [ ] Restart Chromium with the same profile and open the library: if the
      grant was not retained, the **Reconnect folder** banner appears and
      clicking it restores the list without a crash.
- [ ] After reconnecting, choose **Allow on every visit** in Chrome's prompt,
      restart Chromium and reopen the library: no banner appears.
- [ ] With a vault set up by an older version (the stored handle is the
      `Bookmarks` child, not the picked root), open the library: the banner
      reads "Vaultmarks needs one reconnection after the update" and its button
      is **Choose vault folder**; picking the vault root once clears it for
      later launches.
- [ ] Close the library, `mv /tmp/vaultmarks-test-vault /tmp/gone`, reopen
      the library: onboarding returns with "Folder not found; choose it
      again." and picking a folder recovers.

## Editing (Task 9)

- [ ] Hovering a row shows the eye, pencil and trash buttons; clicking the
      thumbnail or title still opens the URL.
- [ ] Detail view shows cover, title, URL, description, date, tags (without
      the base tag) and collection; **Copy link** copies; **Open in Obsidian**
      opens the note when the picker folder contained `Bookmarks`.
- [ ] Editing the title renames the file on disk; the description and tags
      patch only the frontmatter (body untouched).
- [ ] **Move to…** changes the folder on disk.
- [ ] Delete opens the panel's own confirmation dialog (not the browser's);
      **Cancel** and <kbd>Esc</kbd> leave the note in place, and **Move to
      trash** puts it in `.vaultmarks-trash`; the file is gone from its old
      location.
- [ ] **+** (quick save) and **New** both write the exact frontmatter shape
      (`title`, `url`, `created`, `description`, optional `image` / `favicon`,
      `tags` with `bookmarks`, blank line, cover, description,
      `[Open original ↗](url)`); quick save fills it from the page you are on.
- [ ] Conflict: open a note in an editor, change one byte, then save from the
      detail panel — the conflict message appears, **Reload** refreshes it,
      and the file on disk is unchanged until you save again.
- [ ] Injection: create a note whose title is
      `<img src=x onerror=alert(1)>`; the library shows the literal text and
      no alert fires.

## Real vault (Task 10)

- [ ] Load unpacked against `/home/taxin/Documents/notes` and browse
      read-only first: all bookmarks render, covers appear for the notes that
      only have body images, and no file changes.
- [ ] Save one real bookmark from the panel's **Save page**.
- [ ] In Obsidian, confirm the new note shows title, description, cover,
      favicon and tags, and that `Bookmark Viewer.md` lists it.
- [ ] Delete that bookmark from the library and confirm it is in
      `.vaultmarks-trash`.
- [ ] Restart Chromium and confirm the reconnect path.
