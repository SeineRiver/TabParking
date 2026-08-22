# Huy's Tab Parking

Huy's Tab Parking is a dependency-free Manifest V3 Chrome extension for saving selected tabs locally, organizing them into collections, and restoring them when you need them. It is intentionally private and offline: no account, backend, analytics, or cloud sync.

## Features

- Save selected tabs into a named collection, with URL, title, favicon, pinned state, and original tab order retained.
- Optionally save and close selected tabs, with an explicit confirmation before Chrome closes anything.
- Add selected tabs to an existing collection. URLs already in that collection are deduplicated, and the popup reports how many tabs were added or skipped.
- Quickly find open tabs by title, URL, or normalized hostname, then bulk-select all visible results or a complete domain group.
- Browse collections in their own compact popup view, search across collection names, saved tab titles/URLs/hostnames, and stored tags, and filter by pinned, favorite, or tag state.
- Pin and favorite collections for priority ordering. Pinned collections appear first, followed by favorites, then other recently updated collections.
- Restore an entire collection into a new window (the default) or the current window. Restore individual saved tabs with either destination as well.
- Handle unsupported or internal Chrome URLs safely: they remain visible in saved data but are skipped with useful feedback when Chrome cannot restore them.

## Privacy and local storage

All collections are stored only in `chrome.storage.local` on the current Chrome profile. They persist across Chrome restarts but are not synced between devices. The extension never sends tab data over the network and does not query or store activity from Incognito windows.

## Load in Chrome

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Choose **Load unpacked**, then select this project folder.
5. Pin **Huy's Tab Parking** from Chrome's Extensions menu and open its popup.

No build step or dependency installation is required. After editing source files, use the extension reload button on `chrome://extensions`.

## How to use it

1. Open the popup from a normal Chrome window.
2. Search, select individual tabs, select all visible results, or use a domain checkbox to select related tabs.
3. Enter a collection name and use **Save selected tabs**, or choose **Add to existing collection**.
4. Use the collections icon in the popup header to browse saved collections, prioritize them, and restore them.

The default save-and-close option is checked. You can uncheck it before saving; if it remains checked, a confirmation dialog is always required.

## Permissions

The manifest requests only two permissions:

- `tabs` — list tabs in the active window, read tab metadata needed for saving, create restored tabs/windows, and close explicitly selected tabs after confirmation.
- `storage` — persist collections locally with `chrome.storage.local`.

No host permissions, network permissions, or optional permissions are requested.

## Project structure

```text
manifest.json              Manifest V3 configuration
popup/                     Popup markup, styles, and UI state/event handling
modules/storage.js         Local collection persistence and metadata updates
modules/tabs.js            Chrome tab/window query, close, and restore operations
modules/tab-selection.js   Open-tab searching and domain grouping helpers
modules/collections.js     Collection search, filtering, tags, defaults, and sorting helpers
```

For the collection schema, backward-compatibility behavior, and restore details, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Limitations

- Chrome controls whether some URLs can be created or restored. Internal pages such as `chrome://` are saved when available but cannot be restored by the extension.
- Chrome may adjust exact tab placement for pinned tabs; saved order is otherwise restored where the browser permits.
- Collection metadata from older versions loads safely with default favorite, pin, and tag values.

## Development and testing

The project uses plain HTML, CSS, and JavaScript, so there are no package scripts to install. Validate changes by reloading the unpacked extension in Chrome and following the practical regression scenarios in [TESTING.md](TESTING.md).
