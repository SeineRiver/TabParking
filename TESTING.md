# Manual test checklist

- [ ] Load the unpacked extension, open several tabs in one window, and verify each appears with title, favicon when available, pinned indicator, and a live selected-tab count.
- [ ] Search by a title fragment, full URL fragment, and hostname. Verify matches are case-insensitive and clearing search restores the full list without changing selections.
- [ ] Open tabs at `www.example.com`, `docs.google.com`, and `drive.google.com`. Verify the domain controls show `example.com` (without `www`) and separate `docs.google.com` / `drive.google.com` groups.
- [ ] Use a domain checkbox to select and deselect all tabs in that group. Select one tab in a multi-tab domain and verify the group checkbox becomes indeterminate; select all and verify it becomes checked.
- [ ] With a search active, verify domain groups show only matching tabs and **Select all** selects only those filtered tabs. Verify **Clear** clears selections across the full open-tab list.
- [ ] Open a `chrome://` or other nonstandard URL. Verify it remains in the normal tab list with a non-standard URL label and does not appear in a domain group.
- [ ] Select individual tabs, use **Select all** and **Clear**, then save a named collection. Verify its name, date, count, and tabs appear.
- [ ] Check **Save and close selected tabs**. Verify the confirmation dialog appears; cancel once, then confirm and verify only selected tabs close after saving.
- [ ] Restore a complete collection and verify a new window opens, with tabs in their saved order as Chrome permits and pinned tabs pinned.
- [ ] Restore one saved tab and verify it opens in the current Chrome context.
- [ ] Rename a collection and verify the new name persists after closing and reopening the popup.
- [ ] Remove one saved tab, then delete a collection. Verify deletion requires confirmation and persists after reopening Chrome.
- [ ] Save a `chrome://` tab if Chrome exposes it, then restore the collection. Verify valid tabs restore and an error explains skipped unsupported URLs.
- [ ] Restart Chrome and verify saved collections remain available.
