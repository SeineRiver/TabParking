# Architecture note

The popup is a small vanilla-JavaScript application. `popup/popup.js` owns rendering, interaction, dialogs, loading/empty/error states, and accessibility labels. `modules/storage.js` is the only persistence layer; it stores a single `tabParkingCollections` array in `chrome.storage.local`. `modules/tabs.js` isolates Chrome Tabs and Windows API operations.

Each collection has `{ id, name, savedAt, tabs }`. Each saved tab has `{ id, url, title, favIconUrl, pinned, originalIndex }`. Tabs are saved and restored after sorting by `originalIndex`; Chrome may still adjust placement for pinned tabs or browser rules.

Only `tabs` and `storage` are requested. The former is required to inspect/open/close tabs; the latter is required for persistent local collections. Unsupported Chrome-internal schemes and malformed URLs are retained in saved data but are skipped during restoration with an explanatory status message.
