# Architecture note

The popup is a small vanilla-JavaScript application. `popup/popup.js` owns rendering, interaction, dialogs, loading/empty/error states, and accessibility labels. `modules/storage.js` is the only persistence layer; it stores a single `tabParkingCollections` array in `chrome.storage.local`. `modules/tabs.js` isolates Chrome Tabs and Windows API operations.

Each collection has `{ id, name, savedAt, updatedAt, tabs }`. Each saved tab has `{ id, url, title, favIconUrl, pinned, originalIndex }`. New collections initialize `updatedAt` to their saved time. Adding tabs to an existing collection compares canonicalized URL strings, appends only URLs not already present, updates `updatedAt`, and assigns appended tabs later `originalIndex` values. Tabs are saved and restored after sorting by `originalIndex`; Chrome may still adjust placement for pinned tabs or browser rules.

Only `tabs` and `storage` are requested. The former is required to inspect/open/close tabs; the latter is required for persistent local collections. Unsupported Chrome-internal schemes and malformed URLs are retained in saved data but are skipped during restoration with an explanatory status message.

Full collection restore defaults to a new regular window. The popup can also explicitly restore into the focused window or, after `chrome.extension.isAllowedIncognitoAccess()` confirms the user setting, a new Incognito window. No manifest incognito mode or additional permission is required: Incognito access remains a user-controlled Chrome extension setting. The extension never queries or persists tabs from Incognito windows.
