
```dataviewjs
const pages = dv.pages('"Bookmarks"');

// Refreshed fields that Dataview has not re-read yet. The override is merged
// into search and card rendering, so a repaired note shows up immediately even
// when Dataview's page objects are read-only.
const metadataOverrides = new Map();

function pageField(page, key) {
    const path = page.file && page.file.path;
    const override = path ? metadataOverrides.get(path) : null;
    if (override && typeof override[key] === "string" && override[key] !== "") return override[key];
    return page[key];
}

function buildTree(pages) {
    const root = {};

    for (let page of pages) {
        let relativePath = page.file.folder.replace(/^Bookmarks\/?/, "");
        let parts = relativePath ? relativePath.split("/") : [];

        let nodePointer = root;
        for (let i = 0; i < parts.length; i++) {
            let part = parts[i];
            if (!nodePointer[part]) {
                nodePointer[part] = { _files: [], _subfolders: {} };
            }
            if (i === parts.length - 1) {
                nodePointer[part]._files.push(page);
            } else {
                nodePointer = nodePointer[part]._subfolders;
            }
        }

        if (parts.length === 0) {
            if (!root["_rootFiles"]) root["_rootFiles"] = [];
            root["_rootFiles"].push(page);
        }
    }
    return root;
}

function countItems(node) {
    let count = node._files ? node._files.length : 0;
    if (node._subfolders) {
        for (let key in node._subfolders) {
            count += countItems(node._subfolders[key]);
        }
    }
    return count;
}

// Extract clean domain hostname
function getDomain(urlStr) {
    if (!urlStr) return null;
    try {
        let cleanUrl = urlStr.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'https://' + cleanUrl;
        }
        return new URL(cleanUrl).hostname;
    } catch (e) {
        return null;
    }
}

// Fallback Bookmark SVG Icon encoded as Data URI (last resort, when nothing else loads)
const FALLBACK_ICON = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%23a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;

// Edit (pencil) icon used for the edit button
const EDIT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;

// Trash icon used for the delete button
const TRASH_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

// Refresh icon used to re-fetch a bookmark's missing metadata
const REFRESH_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"></path><path d="M21 3v6h-6"></path></svg>`;

// Small UI glyphs (all SVG, no emoji)
const SEARCH_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>`;
const FOLDER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-7.5l-2-2H4a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1Z"></path></svg>`;
const PLUS_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`;
const CLOSE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`;
// Folder disclosure chevron (rotates 90° when the folder is open)
const CHEVRON_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"></path></svg>`;

// --- Responsive (phone) styles ---
// Inline styles cannot hold media queries, so a small stylesheet is added to
// this block. It only targets `.bv-viewer` elements and only under 620px, so
// the desktop layout is unchanged. 16px inputs stop iOS from zooming on focus.
const VIEWER_CSS = `
.bv-viewer { max-width: 100%; }
.bv-viewer * { box-sizing: border-box; }
@media (max-width: 620px) {
  .bv-viewer .bv-search-input,
  .bv-viewer .bv-add-url,
  .bv-viewer .bv-add-select,
  .bv-viewer .bv-add-input { font-size: 16px !important; }

  .bv-viewer .bv-search-input { height: 40px !important; }
  .bv-viewer .bv-round-btn { width: 40px !important; height: 40px !important; }

  .bv-viewer .bv-add-row { gap: 8px !important; }
  .bv-viewer .bv-add-url { flex: 1 1 100% !important; min-width: 0 !important; height: 40px !important; }
  .bv-viewer .bv-add-select { flex: 1 1 120px !important; max-width: none !important; min-width: 0 !important; height: 40px !important; }
  .bv-viewer .bv-add-btn { flex: 0 0 auto !important; height: 40px !important; padding: 0 18px !important; font-size: 15px !important; }
  .bv-viewer .bv-add-input { height: 40px !important; }

  .bv-viewer .bv-folder-summary { padding: 8px 2px !important; min-height: 40px !important; font-size: 0.98em !important; }
  .bv-viewer .bv-folder-body { margin-left: 8px !important; padding-left: 10px !important; }

  .bv-viewer .bv-card-grid { gap: 10px !important; }
  .bv-viewer .bv-card { border-radius: 10px !important; }
  .bv-viewer .bv-thumb { width: 92px !important; height: 92px !important; min-width: 92px !important; margin: 7px !important; padding: 6px !important; }
  .bv-viewer .bv-card-content { padding: 9px 10px 9px 3px !important; gap: 4px !important; }
  .bv-viewer .bv-card-title { font-size: 0.98em !important; line-height: 1.3 !important; }
  .bv-viewer .bv-card-desc { font-size: 0.8em !important; }
  .bv-viewer .bv-card-url { font-size: 0.7em !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; word-break: normal !important; }
  .bv-viewer .bv-card-bottom { gap: 8px !important; }
  .bv-viewer .bv-action-btn { width: 36px !important; height: 36px !important; border-radius: 8px !important; }
}

/* Small phones (iPhone SE width and similar) */
@media (max-width: 380px) {
  .bv-viewer .bv-thumb { width: 72px !important; height: 72px !important; min-width: 72px !important; margin: 6px !important; padding: 5px !important; }
  .bv-viewer .bv-folder-body { margin-left: 8px !important; padding-left: 8px !important; }
  .bv-viewer .bv-card-content { padding: 8px 8px 8px 2px !important; }
  .bv-viewer .bv-card-title { font-size: 0.92em !important; }
  .bv-viewer .bv-card-desc { font-size: 0.76em !important; }
  .bv-viewer .bv-action-btn { width: 34px !important; height: 34px !important; }
}

.bv-viewer input:focus,
.bv-viewer select:focus,
.bv-viewer button:focus-visible,
.bv-viewer summary:focus-visible {
  outline: 2px solid #a78bfa !important;
  outline-offset: 2px;
}
`;

function injectViewerStyles() {
    if (typeof document === "undefined" || typeof dv === "undefined" || !dv.container) return;
    if (dv.container.classList) dv.container.classList.add("bv-viewer");
    // Replace any previous copy so edits to this block take effect immediately.
    const previous = document.getElementById("bv-viewer-styles");
    if (previous && previous.parentNode) previous.parentNode.removeChild(previous);
    const style = document.createElement("style");
    style.id = "bv-viewer-styles";
    style.textContent = VIEWER_CSS;
    (document.head || document.body).appendChild(style);
}

injectViewerStyles();

// Most notes in this vault keep their cover image in the body (`![](url)`)
// instead of frontmatter, so read it lazily (once per file) and cache it.
const bodyCoverCache = new Map();

function extractBodyCover(text) {
    if (!text) return "";
    const match = text.match(/!\[[^\]]*\]\(\s*(?:<([^>\n]+)>|([^)\s]+))(?:\s+"[^"]*")?\s*\)/);
    return match ? (match[1] || match[2] || "") : "";
}

function getBodyCover(page) {
    const path = page.file.path;
    if (!bodyCoverCache.has(path)) {
        const promise = (async () => {
            try {
                const file = app.vault.getAbstractFileByPath(path);
                if (!file) return "";
                return extractBodyCover(await app.vault.cachedRead(file));
            } catch (e) {
                return "";
            }
        })();
        bodyCoverCache.set(path, promise);
    }
    return bodyCoverCache.get(path);
}

// Colors for the card design
const COLORS = {
    cardBg: "#161226",
    leftPanelBg: "#100c1e",
    border: "rgba(167, 139, 250, 0.6)",
    title: "#c4b5fd",
    description: "#d7d3e3",
    url: "#a78bfa",
    domainLabel: "#a78bfa",
    highlight: "rgba(196, 181, 253, 0.32)",
    pageBg: "#14101f"
};

// The viewer paints its own dark surface so every heading and tree row stays
// readable when Obsidian's page is light.
dv.container.style.backgroundColor = COLORS.pageBg;
dv.container.style.color = COLORS.description;
dv.container.style.padding = "12px";
dv.container.style.borderRadius = "12px";
dv.container.style.boxSizing = "border-box";

// Shared style for the small edit/delete buttons on each card
const ACTION_BTN_STYLE = `flex-shrink: 0; background: transparent; border: 1px solid ${COLORS.border}; border-radius: 6px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: ${COLORS.title}; padding: 0; touch-action: manipulation;`;
const DELETE_ARMED_STYLE = `${ACTION_BTN_STYLE} border-color: #f87171; color: #f87171; background: rgba(248, 113, 113, 0.12);`;
const DELETE_HOVER_STYLE = `${ACTION_BTN_STYLE} border-color: rgba(248, 113, 113, 0.7); color: #f87171; opacity: 1;`;

// Styles for the "+" (add bookmark) button and its inline panel
const ADD_BTN_STYLE = `flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px solid ${COLORS.border}; border-radius: 8px; width: 36px; height: 36px; box-sizing: border-box; cursor: pointer; color: ${COLORS.title}; padding: 0; touch-action: manipulation;`;
const ADD_BTN_ACTIVE_STYLE = `${ADD_BTN_STYLE} opacity: 1; background: rgba(167, 139, 250, 0.12);`;
const CREATOR_STYLE = `display: flex; flex-direction: column; gap: 8px; padding: 12px; margin: 4px 0 10px; border: 1px solid ${COLORS.border}; border-radius: 10px; background: ${COLORS.cardBg};`;
const CREATOR_HIDDEN_STYLE = `display: none;`;
const CREATOR_MANUAL_HIDDEN_STYLE = `display: none; gap: 8px; flex-direction: column;`;
const CREATOR_MANUAL_STYLE = `display: flex; gap: 8px; flex-direction: column;`;

// --- Search helpers ---

function tokenize(term) {
    return term.toLowerCase().split(/\s+/).filter(Boolean);
}

function getSearchableFields(page) {
    const tagsVal = page.tags;
    return {
        title: (page.title || page.file.name || "").toLowerCase(),
        description: (pageField(page, "description") || "").toLowerCase(),
        url: (page.url || "").toLowerCase(),
        domain: (getDomain(page.url) || "").toLowerCase(),
        folder: (page.file && page.file.folder ? page.file.folder : "").toLowerCase(),
        tags: Array.isArray(tagsVal) ? tagsVal.join(" ").toLowerCase() : String(tagsVal || "").toLowerCase()
    };
}

// Returns -1 if any token is missing anywhere (AND logic across words),
// otherwise a relevance score (title matches weigh the most).
function scoreMatch(page, tokens) {
    const f = getSearchableFields(page);
    let score = 0;
    for (const tok of tokens) {
        let tokenScore = 0;
        if (f.title.includes(tok)) tokenScore += f.title.startsWith(tok) ? 6 : 4;
        if (f.domain.includes(tok)) tokenScore += 3;
        if (f.folder.includes(tok)) tokenScore += 2;
        if (f.description.includes(tok)) tokenScore += 2;
        if (f.url.includes(tok)) tokenScore += 1;
        if (f.tags.includes(tok)) tokenScore += 1;
        if (tokenScore === 0) return -1;
        score += tokenScore;
    }
    return score;
}

function filterAndSort(searchTerm) {
    if (!searchTerm) return pages;
    const tokens = tokenize(searchTerm);
    const scored = [];
    for (const p of pages) {
        const s = scoreMatch(p, tokens);
        if (s >= 0) scored.push({ page: p, score: s });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map(x => x.page);
}

function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

function highlightText(text, tokens) {
    const raw = String(text || "");
    if (!tokens || tokens.length === 0) return escapeHtml(raw);
    const escapedTokens = tokens
        .map(t => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .filter(Boolean)
        .sort((a, b) => b.length - a.length);
    if (escapedTokens.length === 0) return escapeHtml(raw);
    const re = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
    // Escape each piece separately: marking the already-escaped string could
    // cut an HTML entity in half (searching `amp` inside `&amp;`).
    return raw.split(re)
        .map((part, i) => i % 2 === 1
            ? `<mark style="background: ${COLORS.highlight}; color: inherit; border-radius: 3px; padding: 0 1px;">${escapeHtml(part)}</mark>`
            : escapeHtml(part))
        .join('');
}

// Icon fallback: the note's own captured icon -> Google's favicon service ->
// DuckDuckGo's icon service -> a letter tile (or the bundled SVG when there is
// no domain). Old handmade notes get a monogram until a real icon resolves.
function renderFaviconFallback(container, domain, faviconUrl) {
    const own = (typeof faviconUrl === "string" && /^(https?:|data:image\/)/i.test(faviconUrl)) ? faviconUrl : "";
    const googleFavicon = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : "";
    const duckFavicon = domain ? `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico` : "";
    const sources = [own, googleFavicon, duckFavicon].filter(Boolean);
    if (sources.length === 0) sources.push(FALLBACK_ICON);
    let index = 0;

    const iconImg = container.createEl("img", {
        attr: {
            src: sources[0],
            alt: domain ? `${domain} icon` : "Bookmark icon",
            loading: "lazy",
            decoding: "async",
            style: "width: 34px; height: 34px; border-radius: 6px; opacity: 0.95; background: #cbd5e1; padding: 3px; box-sizing: border-box;"
        }
    });

    const showLetter = () => {
        iconImg.remove();
        const match = (domain || "?").replace(/^www\./i, "").match(/[a-z0-9]/i);
        container.createEl("div", {
            text: (match ? match[0] : "?").toUpperCase(),
            attr: {
                style: "width: 34px; height: 34px; border-radius: 8px; background: #5a3fd1; color: #f5f2ff; display: flex; align-items: center; justify-content: center; font-size: 1.05em; font-weight: 700; line-height: 1; user-select: none;"
            }
        });
    };

    iconImg.onerror = () => {
        index += 1;
        if (index < sources.length) {
            iconImg.src = sources[index];
            return;
        }
        iconImg.onerror = null;
        if (domain) {
            showLetter();
            return;
        }
        iconImg.src = FALLBACK_ICON;
        iconImg.setAttribute("style", "width: 26px; height: 26px; opacity: 0.7;");
    };

    if (domain) {
        container.createEl("div", {
            text: domain,
            attr: {
                style: `margin-top: 8px; font-family: var(--font-monospace, monospace); font-size: 0.68em; color: ${COLORS.domainLabel}; opacity: 0.8; text-align: center; padding: 0 6px; word-break: break-all;`
            }
        });
    }
}

// Renders a cover image that fills the left panel, falling back to the
// favicon/domain treatment when the image fails to load.
function renderCoverImage(panel, src, domain, favicon, alt) {
    const img = panel.createEl("img", {
        attr: {
            src: src,
            alt: alt || (domain ? `${domain} preview` : "Bookmark preview"),
            loading: "lazy",
            decoding: "async",
            referrerpolicy: "no-referrer",
            style: "width: 100%; height: 100%; object-fit: cover; margin: -8px;"
        }
    });
    img.onerror = () => {
        img.onerror = null;
        panel.empty();
        renderFaviconFallback(panel, domain, favicon);
    };
}

// Body covers are read from disk one file at a time. Wait until a card is near
// the viewport, so a vault with hundreds of notes does not read every note up
// front.
const coverObserver = (typeof IntersectionObserver === "function")
    ? new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            coverObserver.unobserve(entry.target);
            const load = entry.target.__bvLoadCover;
            if (typeof load === "function") load();
        }
    }, { rootMargin: "300px 0px" })
    : null;

function whenNearViewport(el, load) {
    if (!coverObserver) {
        load();
        return;
    }
    el.__bvLoadCover = load;
    coverObserver.observe(el);
}

// Opens the underlying bookmark note in Obsidian so it can be edited directly.
// A new tab keeps the viewer itself open: `getLeaf(false)` would replace it.
function openNoteForEditing(page) {
    const file = app.vault.getAbstractFileByPath(page.file.path);
    if (file) {
        const leaf = app.workspace.getLeaf("tab");
        leaf.openFile(file);
    }
}

// Moves the note to Obsidian's configured trash (or the system trash when
// that is the user's setting) and resolves to true on success.
async function trashNote(page) {
    const file = app.vault.getAbstractFileByPath(page.file.path);
    if (!file) return false;
    try {
        if (app.fileManager && typeof app.fileManager.trashFile === "function") {
            await app.fileManager.trashFile(file);
        } else {
            await app.vault.trash(file, true);
        }
        bodyCoverCache.delete(page.file.path);
        return true;
    } catch (e) {
        console.error(`Bookmark Viewer: could not delete "${page.file.path}"`, e);
        return false;
    }
}

// Keeps the in-memory page list in step with a deletion; Dataview will fully
// refresh the block as well, this just avoids showing a stale card meanwhile.
function forgetPage(page) {
    try {
        const index = pages.indexOf(page);
        if (index !== -1 && typeof pages.splice === "function") pages.splice(index, 1);
    } catch (e) {
        // Dataview's DataArray may be read-only; ignoring is harmless.
    }
}

function renderCards(files, container, tokens) {
    tokens = tokens || [];
    const cardGrid = container.createEl("div", {
        cls: "bv-card-grid",
        attr: { style: "display: flex; flex-direction: column; gap: 14px; margin-top: 8px; margin-bottom: 12px;" }
    });

    for (let page of files) {
        const title = page.title || page.file.name;
        const url = page.url || "#";
        const description = pageField(page, "description") || "";
        const image = page.og_image || pageField(page, "image") || page.thumbnail || page.cover || page.banner || "";
        const favicon = pageField(page, "favicon") || "";
        const domain = getDomain(url);

        const card = cardGrid.createEl("div", {
            cls: "bv-card",
            attr: {
                style: `
                    display: flex;
                    background: ${COLORS.cardBg};
                    border: 1px solid ${COLORS.border};
                    border-radius: 12px;
                    overflow: hidden;
                    min-height: 92px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.35);
                `
            }
        });

        // Left panel: fixed square thumbnail (frontmatter or body image if present, otherwise favicon + domain label)
        const leftPanel = card.createEl("div", {
            cls: "bv-thumb",
            attr: {
                style: `width: 120px; height: 120px; min-width: 120px; align-self: center; background: ${COLORS.leftPanelBg}; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; padding: 8px; border-radius: 8px; margin: 8px;`
            }
        });

        if (image && typeof image === 'string' && image.startsWith('http')) {
            renderCoverImage(leftPanel, image, domain, favicon, title);
        } else {
            renderFaviconFallback(leftPanel, domain, favicon);
            // No frontmatter cover: use the body image when the note has one,
            // once the card is close to the viewport.
            whenNearViewport(leftPanel, () => {
                getBodyCover(page).then((cover) => {
                    if (cover && leftPanel.isConnected) {
                        leftPanel.empty();
                        renderCoverImage(leftPanel, cover, domain, favicon, title);
                    }
                });
            });
        }

        // Right side: content
        const content = card.createEl("div", {
            cls: "bv-card-content",
            attr: { style: "padding: 14px 18px 14px 4px; display: flex; flex-direction: column; justify-content: center; gap: 6px; flex-grow: 1; min-width: 0;" }
        });

        // Title: clamped to 2 lines, with search-term highlighting
        const titleEl = content.createEl("a", {
            href: url,
            cls: "external-link bv-card-title",
            attr: {
                style: `font-weight: bold; font-size: 1.05em; color: ${COLORS.title}; text-decoration: none; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;`
            }
        });
        titleEl.innerHTML = highlightText(title, tokens);

        // Description: clamped to 2 lines, with search-term highlighting
        if (description) {
            const descEl = content.createEl("p", {
                cls: "bv-card-desc",
                attr: { style: `margin: 0; font-size: 0.85em; color: ${COLORS.description}; opacity: 0.9; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;` }
            });
            descEl.innerHTML = highlightText(description, tokens);
        }

        // Bottom row: URL (no limit, wraps freely) + edit/delete buttons
        const bottomRow = content.createEl("div", {
            cls: "bv-card-bottom",
            attr: { style: "display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 2px;" }
        });

        bottomRow.createEl("span", {
            text: url,
            cls: "bv-card-url",
            attr: { style: `font-size: 0.78em; color: ${COLORS.url}; opacity: 0.8; word-break: break-all; flex: 1; min-width: 0;` }
        });

        const actions = bottomRow.createEl("div", {
            cls: "bv-card-actions",
            attr: { style: "display: flex; align-items: center; gap: 6px; flex-shrink: 0;" }
        });

        const refreshBtn = actions.createEl("button", {
            cls: "bv-action-btn",
            attr: {
                style: ACTION_BTN_STYLE,
                title: "Fetch missing description and cover",
                "aria-label": "Refresh this bookmark's metadata"
            }
        });
        refreshBtn.innerHTML = REFRESH_ICON_SVG;
        refreshBtn.onclick = (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            refreshPage(page, refreshBtn);
        };

        const editBtn = actions.createEl("button", {
            cls: "bv-action-btn",
            attr: {
                style: ACTION_BTN_STYLE,
                title: "Edit this bookmark note",
                "aria-label": "Edit this bookmark note"
            }
        });
        editBtn.innerHTML = EDIT_ICON_SVG;
        editBtn.onclick = (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            openNoteForEditing(page);
        };

        // Delete needs a second click within 3 seconds before the note is
        // trashed, so a stray click can never remove a bookmark.
        const deleteBtn = actions.createEl("button", {
            cls: "bv-action-btn",
            attr: {
                style: ACTION_BTN_STYLE,
                title: "Delete this bookmark note",
                "aria-label": "Delete this bookmark note"
            }
        });
        deleteBtn.innerHTML = TRASH_ICON_SVG;

        let armed = false;
        let armTimer = null;
        deleteBtn.addEventListener("mouseenter", () => {
            if (!armed) deleteBtn.setAttribute("style", DELETE_HOVER_STYLE);
        });
        deleteBtn.addEventListener("mouseleave", () => {
            if (!armed) deleteBtn.setAttribute("style", ACTION_BTN_STYLE);
        });

        const disarm = () => {
            armed = false;
            clearTimeout(armTimer);
            deleteBtn.setAttribute("style", ACTION_BTN_STYLE);
            deleteBtn.setAttribute("title", "Delete this bookmark note");
        };

        deleteBtn.onclick = async (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            if (!armed) {
                armed = true;
                deleteBtn.setAttribute("style", DELETE_ARMED_STYLE);
                deleteBtn.setAttribute("title", "Click again to delete (moves the note to trash)");
                armTimer = setTimeout(disarm, 3000);
                return;
            }
            clearTimeout(armTimer);
            const deleted = await trashNote(page);
            if (deleted) {
                forgetPage(page);
                // Keep the folder badges honest without rebuilding the tree
                // (which would collapse every open folder). Do this before the
                // card leaves the DOM so its ancestry is still readable.
                let parent = card.parentElement ? card.parentElement.closest("details") : null;
                while (parent) {
                    const badge = parent.querySelector("summary .bv-folder-count");
                    if (badge) badge.setText(String(Math.max(0, Number(badge.getText()) - 1)));
                    parent = parent.parentElement ? parent.parentElement.closest("details") : null;
                }
                card.remove();
                // A search result is fully expanded, so rebuilding is safe and
                // keeps the "N found" line accurate.
                if (searchInput.value.trim()) renderAll(searchInput.value.trim());
                else summaryEl.setText(`${pages.length} bookmark${pages.length === 1 ? '' : 's'}`);
            } else {
                const message = `Could not move “${page.title || page.file.name}” to trash.`;
                if (typeof Notice === "function") new Notice(message);
                summaryEl.setText(message);
                disarm();
            }
        };
    }
}

function renderTree(tree, parentEl, forceOpen, tokens, parentPath) {
    const folderNames = Object.keys(tree)
        .filter(name => name !== "_rootFiles")
        .sort((a, b) => a.localeCompare(b));

    for (const folderName of folderNames) {
        const node = tree[folderName];
        const totalCount = countItems(node);
        const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;

        const details = parentEl.createEl("details", {
            attr: { style: "margin: 3px 0;", "data-folder": folderPath }
        });

        if (forceOpen) {
            details.setAttribute("open", "");
        }

        // The summary is a full-width header row: chevron, folder, name, count.
        const summaryStyle = `display: flex; align-items: center; gap: 7px; list-style: none; cursor: pointer; padding: 4px 2px; color: ${COLORS.title}; font-weight: 600; font-size: 0.94em; user-select: none; touch-action: manipulation; -webkit-tap-highlight-color: transparent;`;
        const summary = details.createEl("summary", {
            cls: "bv-folder-summary",
            attr: { style: summaryStyle }
        });

        const chevronFor = (open) => `display: inline-flex; flex-shrink: 0; align-items: center; color: ${COLORS.title}; opacity: 0.8; transition: transform 120ms ease; transform: rotate(${open ? 90 : 0}deg);`;
        const chevron = summary.createEl("span", { attr: { style: chevronFor(!!forceOpen) } });
        chevron.innerHTML = CHEVRON_ICON_SVG;

        const folderIcon = summary.createEl("span", {
            attr: { style: `display: inline-flex; flex-shrink: 0; align-items: center; color: ${COLORS.title}; opacity: 0.85;` }
        });
        folderIcon.innerHTML = FOLDER_ICON_SVG;

        summary.createEl("span", {
            text: folderName,
            attr: { style: "min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" }
        });

        summary.createEl("span", {
            text: String(totalCount),
            cls: "bv-folder-count",
            attr: { style: `flex-shrink: 0; margin-left: 2px; padding: 1px 7px; border-radius: 999px; background: rgba(167, 139, 250, 0.14); color: ${COLORS.title}; font-size: 0.78em; font-weight: 500; opacity: 0.9;` }
        });

        details.addEventListener("toggle", () => {
            chevron.setAttribute("style", chevronFor(details.open));
            if (details.open && typeof details.__bvFill === "function") details.__bvFill();
        });

        // Children live inside an indented panel with a guide line, so each
        // nesting level is visibly one step deeper than its parent.
        const body = details.createEl("div", {
            cls: "bv-folder-body",
            attr: { style: "margin: 0 0 6px 8px; padding-left: 12px; border-left: 1px solid rgba(167, 139, 250, 0.25);" }
        });

        // Cards (and child folders) are built the first time this folder is
        // opened. Building all 243 cards up front made the viewer spend about
        // 80% of its render time on folders nobody had opened yet, including
        // cover and favicon requests for notes that were not on screen.
        const fill = () => {
            if (body.__bvFilled) return;
            body.__bvFilled = true;
            if (node._subfolders && Object.keys(node._subfolders).length > 0) {
                renderTree(node._subfolders, body, forceOpen, tokens, folderPath);
            }
            if (node._files && node._files.length > 0) {
                renderCards(node._files, body, tokens);
            }
        };
        details.__bvFill = fill;

        if (forceOpen || details.open) fill();
    }
}

// --- Fast add: create a bookmark note from a pasted link ---

// Notes created since this block rendered (Dataview's page list is a snapshot)
const addedThisSession = new Map();

function normalizeUrl(raw) {
    let value = String(raw || "").trim();
    if (!value) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = "https://" + value;
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
        return parsed.href;
    } catch (e) {
        return null;
    }
}

function guessTitleFromUrl(url) {
    try {
        const parsed = new URL(url);
        const segment = parsed.pathname.split("/").filter(Boolean).pop() || "";
        const cleaned = decodeURIComponent(segment)
            .replace(/\.(html?|php|aspx?|jsp)$/i, "")
            .replace(/[-_+]+/g, " ")
            .trim();
        return cleaned || parsed.hostname.replace(/^www\./, "");
    } catch (e) {
        return url;
    }
}

function decodeEntities(value) {
    return String(value || "")
        .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (m, dec) => String.fromCodePoint(parseInt(dec, 10)))
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&");
}

function parseHtmlAttributes(tagText) {
    const attrs = {};
    const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
    let match;
    while ((match = re.exec(tagText))) {
        attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
    }
    return attrs;
}

function hostOf(pageUrl) {
    try {
        return new URL(String(pageUrl || "")).hostname.replace(/^www\./i, "").toLowerCase();
    } catch (e) {
        return "";
    }
}

// Preview images that are not previews: X's logged-in logo, WordPress's
// tracking pixel and blank image, and common spacer files. A card with no
// cover looks better than one that shows a generic logo.
function cleanCoverImage(value, pageUrl) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (url === String(pageUrl || "").trim()) return "";
    const generic = [
        /^https?:\/\/abs\.twimg\.com\/rweb\/ssr\/default\//i,
        /^https?:\/\/s0\.wp\.com\/i\/blank\.jpg(?:[?#]|$)/i,
        /^https?:\/\/pixel\.wp\.com\//i,
        /^https?:\/\/feeds\.feedburner\.com\//i,
        /^https?:\/\/.*\/(?:spacer|transparent|blank|pixel|1x1)\.(?:gif|png)(?:[?#]|$)/i
    ];
    return generic.some((pattern) => pattern.test(url)) ? "" : url;
}

// Logged-out GitHub appends this sentence to every repository description.
// It describes the sign-up page, not the repository, so it is not saved.
function stripGitHubBoilerplate(value) {
    return String(value || "")
        .replace(/\s*Contribute to [^\s/]+\/[^\s/]+ development by creating an account on GitHub\.?\s*$/i, "")
        .trim();
}

// Logged-in GitHub drops og:image on repository pages. The social preview
// service renders a card for any repository from its URL.
function githubRepoCover(pageUrl) {
    if (hostOf(pageUrl) !== "github.com") return "";
    let url;
    try {
        url = new URL(String(pageUrl));
    } catch (e) {
        return "";
    }
    const nonRepo = new Set([
        "about", "account", "apps", "blog", "codespaces", "collections", "contact",
        "dashboard", "enterprise", "events", "explore", "features", "issues", "join",
        "login", "logout", "marketplace", "new", "notifications", "orgs",
        "organizations", "pricing", "pulls", "readme", "search", "security",
        "sessions", "settings", "site", "sponsors", "topics", "trending", "users"
    ]);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return "";
    const owner = parts[0];
    const repo = parts[1];
    if (nonRepo.has(owner.toLowerCase()) || nonRepo.has(repo.toLowerCase())) return "";
    return `https://opengraph.githubassets.com/1/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function jsonLdType(node) {
    const type = node && node["@type"];
    return String(Array.isArray(type) ? type[0] : type || "");
}

function jsonLdFirstImage(value) {
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = jsonLdFirstImage(item);
            if (found) return found;
        }
        return "";
    }
    if (value && typeof value === "object") {
        return String(value.url || value.contentUrl || "").trim();
    }
    return String(value || "").trim();
}

function collectJsonLdObjects(value, out) {
    if (Array.isArray(value)) {
        for (const item of value) collectJsonLdObjects(item, out);
        return;
    }
    if (!value || typeof value !== "object") return;
    out.push(value);
    if (Array.isArray(value["@graph"])) collectJsonLdObjects(value["@graph"], out);
}

// Many sites publish no Open Graph tags but do publish JSON-LD. Prefer
// article/product-like nodes over the site-wide WebSite/Organization block,
// so a homepage's tagline does not win over the page being saved.
function jsonLdGeneralMeta(values) {
    const nodes = [];
    for (const value of values || []) {
        let parsed = value;
        if (typeof parsed === "string") {
            if (!parsed.includes('"description"') && !parsed.includes('"image"')) continue;
            try {
                parsed = JSON.parse(parsed);
            } catch (e) {
                continue;
            }
        }
        collectJsonLdObjects(parsed, nodes);
    }

    const articleType = /^(article|newsarticle|blogposting|product|softwareapplication|book|recipe|event|videoobject)$/i;
    const preferred = nodes.filter((node) => articleType.test(jsonLdType(node)));
    const out = { description: "", image: "" };
    for (const node of preferred.concat(nodes)) {
        if (!out.description && node && typeof node.description === "string") {
            out.description = node.description.replace(/\s+/g, " ").trim();
        }
        if (!out.image && node) {
            out.image = jsonLdFirstImage(node.image || node.thumbnailUrl);
        }
        if (out.description && out.image) break;
    }
    return out;
}

function jsonLdScripts(html) {
    const values = [];
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = re.exec(html))) {
        const attrs = parseHtmlAttributes(match[1]);
        const type = String(attrs.type || "").split(";")[0].trim().toLowerCase();
        if (type === "application/ld+json") values.push(match[2].trim());
    }
    return values;
}

// Pulls title, description, cover and favicon out of a page's HTML.
function extractPageMeta(html, pageUrl) {
    const metaTags = [];
    const metaRe = /<meta\b[^>]*>/gi;
    let match;
    while ((match = metaRe.exec(html))) metaTags.push(parseHtmlAttributes(match[0]));

    const metaValue = (...keys) => {
        for (const key of keys) {
            const tag = metaTags.find((t) => (t.property || t.name || "").toLowerCase() === key);
            if (tag && tag.content) return tag.content.trim();
        }
        return "";
    };

    const absolute = (value) => {
        if (!value) return "";
        try {
            return new URL(value, pageUrl).href;
        } catch (e) {
            return "";
        }
    };

    const structured = jsonLdGeneralMeta(jsonLdScripts(html));
    const github = hostOf(pageUrl) === "github.com";

    let title = metaValue("og:title", "twitter:title");
    if (!title) {
        const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
        title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim() : "";
    }

    let description = metaValue("og:description", "description", "twitter:description")
        .replace(/\s+/g, " ")
        .trim();
    if (github) description = stripGitHubBoilerplate(description);
    if (!description) description = structured.description.replace(/\s+/g, " ").trim();
    if (github) description = stripGitHubBoilerplate(description);

    const metaImage = absolute(metaValue("og:image", "og:image:url", "twitter:image", "twitter:image:src"));
    let image = cleanCoverImage(metaImage, pageUrl);
    if (!image) image = cleanCoverImage(absolute(structured.image), pageUrl);
    image = image || githubRepoCover(pageUrl);

    let favicon = "";
    const linkRe = /<link\b[^>]*>/gi;
    while ((match = linkRe.exec(html))) {
        const attrs = parseHtmlAttributes(match[0]);
        const rel = (attrs.rel || "").toLowerCase();
        if (rel.split(/\s+/).includes("icon") || rel === "apple-touch-icon") {
            favicon = absolute(attrs.href);
            if (favicon) break;
        }
    }

    return { title, description, image, favicon };
}

async function fetchPageMeta(url) {
    if (typeof requestUrl !== "function") throw new Error("requestUrl is not available");
    const response = await requestUrl({
        url,
        headers: { Accept: "text/html,application/xhtml+xml" }
    });
    if (!response || (response.status && response.status >= 400)) {
        throw new Error(`HTTP ${response && response.status}`);
    }
    const html = response.text || "";
    if (!html) throw new Error("Empty response");
    return { ...extractPageMeta(html, url), url };
}

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((resolve, reject) => setTimeout(() => reject(new Error("Request timed out")), ms))
    ]);
}

function sanitizeFileName(name) {
    return String(name || "")
        .replace(/[\\/:*?"<>|#^\[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^\.+/, "")
        .slice(0, 100)
        .trim() || "Bookmark";
}

function uniqueNotePath(folder, baseName) {
    let candidate = `${folder}/${baseName}.md`;
    let counter = 2;
    while (app.vault.getAbstractFileByPath(candidate)) {
        candidate = `${folder}/${baseName} ${counter}.md`;
        counter += 1;
    }
    return candidate;
}

// Markdown ends a link at the first ")", so URLs like Wikipedia's
// `..._(software)` need angle brackets. Plain URLs keep the plain form.
function mdDestination(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (!/[\s()<>\\]/.test(raw)) return raw;
    return `<${raw.replace(/[<>\\]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`).replace(/\s/g, "%20")}>`;
}

function urlKey(url) {
    return String(url || "").replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();
}

function findExistingBookmark(url) {
    const key = urlKey(url);
    if (addedThisSession.has(key)) return addedThisSession.get(key);
    for (const page of pages) {
        const pageUrl = typeof page.url === "string" ? urlKey(page.url) : "";
        if (pageUrl && pageUrl === key) {
            return { title: page.title || page.file.name, folder: page.file.folder };
        }
    }
    return null;
}

async function createBookmarkNote({ url, title, description, image, favicon, folder, pending }) {
    const finalTitle = (title || guessTitleFromUrl(url)).trim() || url;
    const path = uniqueNotePath(folder || "Bookmarks", sanitizeFileName(finalTitle));
    const now = new Date();
    const created = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const lines = ["---", `title: ${JSON.stringify(finalTitle)}`, `url: ${JSON.stringify(url)}`, `created: ${created}`];
    if (description) lines.push(`description: ${JSON.stringify(description)}`);
    if (image) lines.push(`image: ${JSON.stringify(image)}`);
    if (favicon) lines.push(`favicon: ${JSON.stringify(favicon)}`);
    if (pending) lines.push("metadata: pending");
    lines.push("tags:", '  - "bookmarks"', "---", "");

    if (image) lines.push(`![](${mdDestination(image)})`, "");
    if (description) lines.push(description, "");
    lines.push(`[Open original ↗](${mdDestination(url)})`, "");

    await app.vault.create(path, lines.join("\n"));
    return { path, title: finalTitle };
}

// Dataview refreshes the block on its own schedule. Add the new note to the
// current list immediately so its card appears as soon as it is saved.
function rememberCreatedNote(note, meta) {
    const path = note.path;
    const slash = path.lastIndexOf("/");
    const page = {
        file: {
            path,
            name: note.title,
            basename: note.title,
            folder: slash === -1 ? "Bookmarks" : path.slice(0, slash)
        },
        title: note.title,
        url: meta.url,
        description: meta.description || "",
        image: meta.image || "",
        favicon: meta.favicon || "",
        tags: ["bookmarks"]
    };
    if (meta.pending) page.metadata = "pending";
    try {
        if (typeof pages.push !== "function") return;
        for (const existing of pages) {
            if (existing.file && existing.file.path === path) return;
        }
        pages.push(page);
    } catch (e) {
        // A read-only DataArray is harmless; Dataview adds the note next pass.
    }
}

// --- Search bar ---
const searchContainer = dv.container.createEl("div", {
    attr: { style: "display: flex; align-items: center; gap: 8px; margin-bottom: 4px;" }
});

const searchBox = searchContainer.createEl("div", {
    attr: { style: "position: relative; flex: 1; display: flex; align-items: center; min-width: 0;" }
});

const searchIcon = searchBox.createEl("span", {
    attr: { style: `position: absolute; left: 13px; top: 50%; transform: translateY(-50%); display: flex; color: ${COLORS.title}; opacity: 0.75; pointer-events: none;` }
});
searchIcon.innerHTML = SEARCH_ICON_SVG;

const searchInput = searchBox.createEl("input", {
    cls: "bv-search-input",
    attr: {
        type: "text",
        placeholder: "Search bookmarks (title, description, URL, tags)...",
        style: `flex: 1; width: 100%; height: 36px; box-sizing: border-box; padding: 0 14px 0 38px; border-radius: 8px; border: 1px solid ${COLORS.border}; background: ${COLORS.cardBg}; color: ${COLORS.description}; font-size: 0.95em;`
    }
});

const addBtn = searchContainer.createEl("button", {
    cls: "bv-round-btn",
    attr: {
        style: ADD_BTN_STYLE,
        title: "Add a bookmark from a link",
        "aria-label": "Add a bookmark from a link"
    }
});
addBtn.innerHTML = PLUS_ICON_SVG;
addBtn.addEventListener("mouseenter", () => addBtn.setAttribute("style", ADD_BTN_ACTIVE_STYLE));
addBtn.addEventListener("mouseleave", () => addBtn.setAttribute("style", ADD_BTN_STYLE));

// Inline "fast add" panel: paste a link, press Enter, the note is created.
const creatorPanel = dv.container.createEl("div", {
    cls: "bv-add-panel",
    attr: { style: CREATOR_HIDDEN_STYLE }
});

const creatorRow = creatorPanel.createEl("div", {
    cls: "bv-add-row",
    attr: { style: "display: flex; align-items: center; gap: 8px; flex-wrap: wrap;" }
});

const newUrlInput = creatorRow.createEl("input", {
    cls: "bv-add-url",
    attr: {
        type: "text",
        placeholder: "Paste a link and press Enter",
        title: "Title, description, cover and favicon are fetched automatically",
        style: `flex: 1 1 240px; min-width: 200px; height: 36px; box-sizing: border-box; padding: 0 12px; border-radius: 8px; border: 1px solid ${COLORS.border}; background: ${COLORS.leftPanelBg}; color: ${COLORS.description}; font-size: 0.92em;`
    }
});

const folderSelect = creatorRow.createEl("select", {
    cls: "bv-add-select",
    attr: {
        style: `flex: 0 1 auto; min-width: 150px; max-width: 220px; height: 36px; box-sizing: border-box; padding: 0 30px 0 10px; border-radius: 8px; border: 1px solid ${COLORS.border}; background-color: ${COLORS.leftPanelBg}; background-image: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNhNzhiZmEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJtNiA5IDYgNiA2LTYiLz48L3N2Zz4="); background-repeat: no-repeat; background-position: right 9px center; appearance: none; -webkit-appearance: none; color: ${COLORS.description}; font-size: 0.9em; font-family: inherit;`,
        title: "Collection for the new bookmark"
    }
});

const folderSet = new Set(["Bookmarks"]);
for (const page of pages) {
    if (page.file && page.file.folder) folderSet.add(page.file.folder);
}
for (const folder of Array.from(folderSet).sort((a, b) => a.localeCompare(b))) {
    folderSelect.createEl("option", {
        text: folder === "Bookmarks" ? "Bookmarks (root)" : folder.replace(/^Bookmarks\//, ""),
        attr: { value: folder }
    });
}

const createBtn = creatorRow.createEl("button", {
    cls: "bv-add-btn",
    text: "Add",
    attr: {
        style: `flex-shrink: 0; height: 36px; box-sizing: border-box; padding: 0 16px; border-radius: 8px; border: 1px solid ${COLORS.border}; background: rgba(167, 139, 250, 0.12); color: ${COLORS.title}; cursor: pointer; font-size: 0.9em; touch-action: manipulation;`,
        title: "Fetch the page and create the note"
    }
});

const cancelBtn = creatorRow.createEl("button", {
    cls: "bv-round-btn",
    attr: {
        style: `flex-shrink: 0; display: flex; align-items: center; justify-content: center; height: 36px; width: 36px; box-sizing: border-box; background: transparent; border: 1px solid ${COLORS.border}; border-radius: 8px; cursor: pointer; color: ${COLORS.title}; padding: 0; touch-action: manipulation;`,
        title: "Close",
        "aria-label": "Close the add panel"
    }
});
cancelBtn.innerHTML = CLOSE_ICON_SVG;

// Shown only when the page cannot be fetched (offline/blocked): a small
// "query" so the bookmark can still be saved by hand.
const manualRow = creatorPanel.createEl("div", {
    attr: { style: CREATOR_MANUAL_HIDDEN_STYLE }
});

const newTitleInput = manualRow.createEl("input", {
    cls: "bv-add-input",
    attr: {
        type: "text",
        placeholder: "Title",
        style: `height: 36px; box-sizing: border-box; padding: 0 12px; border-radius: 8px; border: 1px solid ${COLORS.border}; background: ${COLORS.leftPanelBg}; color: ${COLORS.description}; font-size: 0.92em;`
    }
});

const newDescInput = manualRow.createEl("input", {
    cls: "bv-add-input",
    attr: {
        type: "text",
        placeholder: "Description (optional)",
        style: `height: 36px; box-sizing: border-box; padding: 0 12px; border-radius: 8px; border: 1px solid ${COLORS.border}; background: ${COLORS.leftPanelBg}; color: ${COLORS.description}; font-size: 0.92em;`
    }
});

const createStatus = creatorPanel.createEl("div", {
    attr: { style: `font-size: 0.78em; color: ${COLORS.description}; opacity: 0.75; min-height: 1em;` }
});

let creatorOpen = false;
let manualMode = false;
let creating = false;
let pendingUrl = "";
let createRequestId = 0;

function setCreateStatus(text, isError) {
    createStatus.setText(text || "");
    createStatus.setAttribute("style", `font-size: 0.78em; min-height: 1em; color: ${isError ? "#f87171" : COLORS.description}; opacity: ${isError ? "1" : "0.75"};`);
}

function resetCreator() {
    manualMode = false;
    pendingUrl = "";
    creating = false;
    newUrlInput.value = "";
    newTitleInput.value = "";
    newDescInput.value = "";
    manualRow.setAttribute("style", CREATOR_MANUAL_HIDDEN_STYLE);
    createBtn.setText("Add");
    setCreateStatus("");
}

function setCreatorOpen(open) {
    creatorOpen = open;
    createRequestId += 1; // invalidates any in-flight fetch (cancel)
    creatorPanel.setAttribute("style", open ? CREATOR_STYLE : CREATOR_HIDDEN_STYLE);
    resetCreator();
    if (open) newUrlInput.focus();
}

function enterManualMode(url, message) {
    pendingUrl = url;
    manualMode = true;
    newTitleInput.value = guessTitleFromUrl(url);
    manualRow.setAttribute("style", CREATOR_MANUAL_STYLE);
    createBtn.setText("Save");
    setCreateStatus(message, true);
    newTitleInput.focus();
}

async function finishCreate(meta) {
    const folder = folderSelect.value || "Bookmarks";
    creating = true;
    createBtn.setText("Saving…");
    try {
        const note = await createBookmarkNote({ ...meta, folder });
        addedThisSession.set(urlKey(meta.url), { title: note.title, folder });
        rememberCreatedNote(note, { ...meta, folder });
        resetCreator();
        setCreateStatus(`Saved “${note.title}”.`);
        renderAll(searchInput.value.trim());
        newUrlInput.focus();
    } catch (e) {
        console.error("Bookmark Viewer: could not create the note", e);
        creating = false;
        createBtn.setText(manualMode ? "Save" : "Add");
        setCreateStatus(`Could not save the note: ${e.message || e}`, true);
    }
}

async function submitNewBookmark() {
    if (creating) return;

    if (manualMode) {
        const url = normalizeUrl(newUrlInput.value.trim()) || pendingUrl;
        if (!url) {
            setCreateStatus("That does not look like a valid http(s) link.", true);
            return;
        }
        const duplicate = findExistingBookmark(url);
        if (duplicate) {
            setCreateStatus(`Already saved as “${duplicate.title || "a bookmark"}”.`, true);
            return;
        }
        await finishCreate({
            url,
            title: newTitleInput.value.trim() || guessTitleFromUrl(url),
            description: newDescInput.value.trim(),
            image: "",
            favicon: "",
            pending: true
        });
        return;
    }

    const raw = newUrlInput.value.trim();
    if (!raw) {
        setCreateStatus("Paste a link first.", true);
        newUrlInput.focus();
        return;
    }

    const url = normalizeUrl(raw);
    if (!url) {
        setCreateStatus("That does not look like a valid http(s) link.", true);
        return;
    }

    const duplicate = findExistingBookmark(url);
    if (duplicate) {
        setCreateStatus(`Already saved as “${duplicate.title || "a bookmark"}”.`, true);
        return;
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enterManualMode(url, "You are offline. Check the title, then press Save.");
        return;
    }

    creating = true;
    const requestId = ++createRequestId;
    createBtn.setText("Fetching…");
    setCreateStatus("Fetching title, description and cover…");
    try {
        const meta = await withTimeout(fetchPageMeta(url), 12000);
        if (requestId !== createRequestId) return;
        await finishCreate({ url, ...meta });
    } catch (e) {
        if (requestId !== createRequestId) return;
        creating = false;
        enterManualMode(url, "Could not reach the page (offline or blocked). Check the title, then press Save.");
    }
}

function handleCreatorKeys(e) {
    if (e.key === "Enter") {
        e.preventDefault();
        submitNewBookmark();
    } else if (e.key === "Escape") {
        e.preventDefault();
        setCreatorOpen(false);
    }
}

newUrlInput.addEventListener("keydown", handleCreatorKeys);
newTitleInput.addEventListener("keydown", handleCreatorKeys);
newDescInput.addEventListener("keydown", handleCreatorKeys);
addBtn.onclick = () => setCreatorOpen(!creatorOpen);
createBtn.onclick = submitNewBookmark;
cancelBtn.onclick = () => setCreatorOpen(false);

const summaryEl = dv.container.createEl("div", {
    cls: "bv-status",
    attr: { style: `font-size: 0.78em; color: ${COLORS.description}; opacity: 0.6; margin-bottom: 10px; min-height: 1em;` }
});

const resultsContainer = dv.container.createEl("div", { cls: "bv-results" });

function renderAll(searchTerm) {
    // A refresh or a new note must not collapse the folder the user is
    // browsing. Search results are fully expanded anyway.
    const openFolders = new Set();
    if (!searchTerm) {
        resultsContainer.querySelectorAll("details[data-folder]").forEach((details) => {
            if (details.open) openFolders.add(details.getAttribute("data-folder"));
        });
    }

    resultsContainer.empty();
    if (coverObserver) coverObserver.disconnect();

    const filtered = filterAndSort(searchTerm);
    const tokens = searchTerm ? tokenize(searchTerm) : [];

    if (searchTerm) {
        summaryEl.setText(`${filtered.length} bookmark${filtered.length === 1 ? '' : 's'} found for "${searchTerm}"`);
    } else {
        summaryEl.setText(`${pages.length} bookmark${pages.length === 1 ? '' : 's'}`);
    }

    if (searchTerm && filtered.length === 0) {
        resultsContainer.createEl("div", {
            text: `No bookmarks match "${searchTerm}"`,
            attr: { style: `padding: 16px; color: ${COLORS.description}; opacity: 0.7; font-size: 0.9em;` }
        });
        return;
    }

    const tree = buildTree(filtered);
    renderTree(tree, resultsContainer, !!searchTerm, tokens);

    if (tree._rootFiles && tree._rootFiles.length > 0) {
        renderCards(tree._rootFiles, resultsContainer, tokens);
    }

    if (!searchTerm && openFolders.size > 0) {
        // Opening a folder builds its children, which may include another
        // folder that was open before the re-render. Repeat until the tree
        // that was visible is visible again.
        let opened = true;
        while (opened) {
            opened = false;
            resultsContainer.querySelectorAll("details[data-folder]").forEach((details) => {
                const path = details.getAttribute("data-folder");
                if (details.open || !openFolders.has(path)) return;
                if (typeof details.__bvFill === "function") details.__bvFill();
                details.open = true;
                opened = true;
            });
        }
    }
}

// Reads a single-line YAML scalar, enough for the fields this viewer writes.
function frontmatterScalar(line) {
    const raw = String(line || "").replace(/^\s*[^:]+:\s*/, "").trim();
    if (raw === "") return "";
    if (raw.startsWith('"')) {
        try {
            return String(JSON.parse(raw));
        } catch (e) {
            return raw.replace(/^"|"$/g, "");
        }
    }
    if (raw.startsWith("'")) return raw.replace(/^'|'$/g, "").replace(/''/g, "'");
    return raw;
}

// The metadata fields a card can show, as they stand in the note right now.
function frontmatterFields(markdown) {
    const match = String(markdown || "").match(/^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/);
    if (!match) return {};
    const fields = {};
    for (const line of match[1].split(/\r?\n/)) {
        const field = line.match(/^(description|image|favicon):\s*(.*)$/);
        if (field) fields[field[1]] = frontmatterScalar(line);
    }
    return fields;
}

// Rewrites a note that was saved while offline or repaired from a card: drop
// the pending marker and fill fields that are missing or empty. Values already
// in the note win, and the body is left alone.
function applyFetchedMetadata(markdown, meta, pageUrl) {
    const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/);
    if (!match) return markdown;

    const eol = match[0].indexOf("\r\n") !== -1 ? "\r\n" : "\n";
    const lines = match[1].split(/\r?\n/);
    const kept = lines.filter((line) => !/^\s*metadata:\s*pending\s*$/i.test(line));
    const fieldAt = (key) => kept.findIndex((line) => new RegExp("^" + key + ":").test(line.trim()));
    const incoming = meta && typeof meta === "object" ? meta : {};
    const github = hostOf(pageUrl || incoming.url) === "github.com";
    const additions = [];

    const applyField = (key, rawValue) => {
        const value = key === "description" && github ? stripGitHubBoilerplate(rawValue) : rawValue;
        const index = fieldAt(key);
        if (index === -1) {
            if (value) additions.push(key + ": " + JSON.stringify(value));
            return;
        }
        let current = frontmatterScalar(kept[index]);
        // GitHub's sign-up sentence describes the site, not the bookmark, so
        // it is removed even from a description that was already present.
        if (key === "description" && github) {
            const cleaned = stripGitHubBoilerplate(current);
            if (cleaned !== current) {
                kept[index] = "description: " + JSON.stringify(cleaned);
                current = cleaned;
            }
        }
        if (current === "" && value) {
            kept[index] = key + ": " + JSON.stringify(value);
        }
    };

    applyField("description", incoming.description);
    applyField("image", incoming.image);
    applyField("favicon", incoming.favicon);

    const tagsAt = kept.findIndex((line) => /^tags:/.test(line.trim()));
    if (tagsAt === -1) kept.push(...additions);
    else kept.splice(tagsAt, 0, ...additions);

    if (kept.join(eol) === lines.join(eol)) return markdown;

    return "---" + eol + kept.join(eol) + eol + "---" + markdown.slice(match[0].length);
}

// Dataview re-runs this block on refresh. Remember attempts for the life of
// the window so a site that keeps failing is not fetched on every pass.
const backfillTried = (() => {
    if (typeof globalThis !== "undefined") {
        if (!(globalThis.__vaultmarksBackfillTried instanceof Set)) {
            globalThis.__vaultmarksBackfillTried = new Set();
        }
        return globalThis.__vaultmarksBackfillTried;
    }
    return new Set();
})();
let backfillStarted = false;

function isPendingNote(page) {
    const value = page.metadata !== undefined
        ? page.metadata
        : (page.file && page.file.frontmatter && page.file.frontmatter.metadata);
    return typeof value === "string" && value.trim().toLowerCase() === "pending";
}

// Keeps the card in step with the note the viewer just wrote. Values are
// remembered by path because Dataview's page objects can be read-only.
function rememberFetched(page, markdown, before) {
    const path = page.file && page.file.path;
    const after = frontmatterFields(markdown);
    const override = (path && metadataOverrides.get(path)) || {};
    const previous = before || {};
    for (const key of ["description", "image", "favicon"]) {
        const old = String(previous[key] || "").trim();
        const value = String(after[key] || "").trim();
        if (value && value !== old) override[key] = value;
    }
    if (path && Object.keys(override).length > 0) metadataOverrides.set(path, override);
    try {
        for (const key of ["description", "image", "favicon"]) {
            if (override[key] && String(page[key] || "").trim() === "") page[key] = override[key];
        }
        delete page.metadata;
    } catch (e) {
        // Dataview pages can be read-only; the overrides carry the values.
    }
}

const refreshingPaths = new Set();

// Re-fetches a bookmark and fills only the fields that are empty. A card the
// user has already described or given a cover is never overwritten.
async function refreshPage(page, button) {
    const path = page.file && page.file.path;
    const url = String(page.url || "");
    if (!path || refreshingPaths.has(path)) return;
    if (!/^https?:\/\//i.test(url)) {
        summaryEl.setText("This bookmark has no http(s) URL to refresh.");
        return;
    }

    const title = page.title || page.file.name;
    const before = {
        description: String(pageField(page, "description") || ""),
        image: String(pageField(page, "image") || ""),
        favicon: String(pageField(page, "favicon") || "")
    };

    refreshingPaths.add(path);
    if (button) button.disabled = true;
    summaryEl.setText(`Refreshing “${title}”…`);
    try {
        const meta = await withTimeout(fetchPageMeta(url), 12000);
        const file = app.vault.getAbstractFileByPath(path);
        if (!file) throw new Error("the note is missing");
        const raw = await app.vault.read(file);
        const next = applyFetchedMetadata(raw, meta, url);
        if (next !== raw) await app.vault.modify(file, next);
        rememberFetched(page, next, before);
        renderAll(searchInput.value.trim());

        const after = frontmatterFields(next);
        const gained = ["description", "image", "favicon"].some((key) => {
            const value = String(after[key] || "").trim();
            return value !== "" && value !== String(before[key] || "").trim();
        });
        summaryEl.setText(gained ? `Updated “${title}”.` : `Nothing new to add for “${title}”.`);
    } catch (e) {
        console.warn(`Bookmark Viewer: could not refresh "${path}"`, e);
        const message = `Could not refresh “${title}”: ${e.message || e}`;
        summaryEl.setText(message);
        if (typeof Notice === "function") new Notice(message);
    } finally {
        refreshingPaths.delete(path);
        if (button) button.disabled = false;
    }
}

// Notes saved offline carry `metadata: pending`. Once there is a connection,
// fill in what the fetch can now provide. Three per block render, so a long
// offline queue never turns into a burst of requests.
async function backfillPending() {
    if (backfillStarted) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    backfillStarted = true;
    if (typeof requestUrl !== "function") return;

    const queue = [];
    for (const page of pages) {
        if (!isPendingNote(page)) continue;
        const path = page.file && page.file.path;
        if (!path || backfillTried.has(path)) continue;
        if (!/^https?:\/\//i.test(String(page.url || ""))) continue;
        queue.push(page);
        if (queue.length === 3) break;
    }

    let changed = false;
    for (const page of queue) {
        backfillTried.add(page.file.path);
        try {
            const meta = await withTimeout(fetchPageMeta(page.url), 12000);
            const file = app.vault.getAbstractFileByPath(page.file.path);
            if (!file) continue;
            const before = {
                description: String(pageField(page, "description") || ""),
                image: String(pageField(page, "image") || ""),
                favicon: String(pageField(page, "favicon") || "")
            };
            const raw = await app.vault.read(file);
            const next = applyFetchedMetadata(raw, meta, page.url);
            if (next === raw) continue;
            await app.vault.modify(file, next);
            rememberFetched(page, next, before);
            changed = true;
        } catch (e) {
            console.warn(`Bookmark Viewer: could not fill in "${page.file.path}"`, e);
        }
    }

    if (changed) renderAll(searchInput.value.trim());
}

let debounceTimer = null;
searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        renderAll(searchInput.value.trim());
    }, 120);
});

searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        searchInput.value = "";
        renderAll("");
        searchInput.blur();
    }
});

// Initial render (unfiltered, folders collapsed as usual)
renderAll("");

setTimeout(backfillPending, 600);
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("online", () => {
        backfillStarted = false;
        backfillPending();
    });
}
```