function isRestorableUrl(url) {
  try {
    return ["http:", "https:", "ftp:", "file:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

export async function getCurrentWindowTabs() {
  return chrome.tabs.query({ currentWindow: true });
}

export function serializeTabs(tabs) {
  return tabs
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((tab) => ({
      id: crypto.randomUUID(),
      url: tab.url || "",
      title: tab.title || "Untitled tab",
      favIconUrl: tab.favIconUrl || "",
      pinned: Boolean(tab.pinned),
      originalIndex: tab.index,
    }));
}

export async function closeTabs(tabs) {
  const ids = tabs.map((tab) => tab.id).filter(Number.isInteger);
  if (ids.length) await chrome.tabs.remove(ids);
}

async function createTab(tab, createProperties) {
  if (!isRestorableUrl(tab.url)) {
    return { ok: false, reason: "unsupported" };
  }
  try {
    const created = await chrome.tabs.create({ ...createProperties, url: tab.url, pinned: tab.pinned });
    return { ok: true, tab: created };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

function orderedRestorableTabs(tabs) {
  const orderedTabs = tabs.slice().sort((a, b) => a.originalIndex - b.originalIndex);
  const restorable = orderedTabs.filter((tab) => isRestorableUrl(tab.url));
  return { orderedTabs, restorable };
}

export async function restoreCollection(tabs, destination = "new") {
  const { orderedTabs, restorable } = orderedRestorableTabs(tabs);
  if (!restorable.length) return { restored: 0, skipped: orderedTabs.length, destination };

  let restored = 0;
  if (destination === "current") {
    try {
      const currentWindow = await chrome.windows.getLastFocused();
      for (const tab of restorable) {
        const result = await createTab(tab, { windowId: currentWindow.id, active: false });
        if (result.ok) restored += 1;
      }
    } catch {
      return { restored: 0, skipped: orderedTabs.length, destination, error: "Chrome could not access the current window." };
    }
    return { restored, skipped: orderedTabs.length - restored, destination };
  }

  const incognito = destination === "incognito";
  let windowId;
  let windowCreationFailed = false;
  for (const tab of restorable) {
    try {
      if (!windowId) {
        const newWindow = await chrome.windows.create({ url: tab.url, focused: true, incognito });
        windowId = newWindow.id;
        const firstTab = newWindow.tabs?.[0];
        if (firstTab && tab.pinned) await chrome.tabs.update(firstTab.id, { pinned: true });
        restored += 1;
      } else {
        const result = await createTab(tab, { windowId, active: false, index: restored });
        if (result.ok) restored += 1;
      }
    } catch {
      // A failed URL should not prevent remaining saved tabs from restoring.
      windowCreationFailed = true;
    }
  }
  return {
    restored,
    skipped: orderedTabs.length - restored,
    destination,
    error: !restored && windowCreationFailed ? "Chrome could not create the requested window." : undefined,
  };
}

export async function restoreOneTab(tab) {
  const result = await createTab(tab, { active: true });
  return result.ok;
}

export async function restoreOneTabInCurrentWindow(tab) {
  try {
    const currentWindow = await chrome.windows.getLastFocused();
    const result = await createTab(tab, { windowId: currentWindow.id, active: true });
    return result.ok;
  } catch {
    return false;
  }
}
