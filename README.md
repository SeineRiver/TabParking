# Huy's Tab Parking

A small, local-only Chrome extension for saving selected tabs into named collections and restoring them later.

## Load in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this project folder.
4. Pin **Huy's Tab Parking** from Chrome's Extensions menu, then open its popup.

No build step or dependency install is required. After editing source files, click the extension's reload icon on `chrome://extensions`.

## Permissions

- `tabs`: lists tabs in the active window, reads their URL/title/favicon/pinned state, opens restored tabs, and closes explicitly selected tabs after confirmation.
- `storage`: saves collections in `chrome.storage.local`, which remains on the device across Chrome restarts.

The extension has no network calls, analytics, accounts, or cloud sync.


## Testing

See [TESTING.md](TESTING.md) for the practical manual test checklist.
