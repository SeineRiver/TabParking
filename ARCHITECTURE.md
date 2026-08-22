# Architecture note

The popup is a small vanilla-JavaScript application. `popup/popup.js` owns rendering, interaction, dialogs, loading/empty/error states, and accessibility labels. `modules/storage.js` is the only persistence layer; it stores a single `tabParkingCollections` array in `chrome.storage.local`. `modules/tabs.js` isolates Chrome Tabs and Windows API operations.

Each collection has `{ id, name, savedAt, updatedAt, tags, isFavorite, isPinned, pinnedAt, tabs }`. Each saved tab has `{ id, url, title, favIconUrl, pinned, originalIndex }`. New collections initialize `updatedAt` to their saved time and start with no tags, favorite, or pin state. Older records are normalized in memory on load with safe defaults (`tags: []`, `isFavorite: false`, `isPinned: false`, `pinnedAt: null`) and are persisted in the expanded format on their next write. Adding tabs to an existing collection compares canonicalized URL strings, appends only URLs not already present, updates `updatedAt`, and assigns appended tabs later `originalIndex` values. Tags, favorites, and pin state also update `updatedAt` immediately. Tabs are saved and restored after sorting by `originalIndex`; Chrome may still adjust placement for pinned tabs or browser rules.

Collection search matches names, tags, saved-tab titles, complete URLs, and normalized hostnames. The collections view sorts pinned records first (most recently pinned first), then favorites, then ordinary records; the latter two groups sort by latest update.

Only `tabs` and `storage` are requested. The former is required to inspect/open/close tabs; the latter is required for persistent local collections. Unsupported Chrome-internal schemes and malformed URLs are retained in saved data but are skipped during restoration with an explanatory status message.

Full collection restore defaults to a new regular window. A separate direct action restores into the focused current window. No Incognito restore destination is offered, and the extension never queries or persists tabs from Incognito windows.
