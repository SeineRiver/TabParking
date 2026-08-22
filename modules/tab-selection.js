const GROUPABLE_PROTOCOLS = new Set(["http:", "https:", "ftp:"]);

/** Returns a display-safe hostname, removing only the conventional www. prefix. */
export function normalizeHostname(url) {
  try {
    const parsed = new URL(url);
    if (!GROUPABLE_PROTOCOLS.has(parsed.protocol) || !parsed.hostname) return "";
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function filterTabs(tabs, query) {
  const search = query.trim().toLowerCase();
  if (!search) return tabs;
  return tabs.filter((tab) => {
    const hostname = normalizeHostname(tab.url || "");
    return [tab.title, tab.url, hostname].some((value) => (value || "").toLowerCase().includes(search));
  });
}

/** Groups only standard web tabs; internal and nonstandard URLs return no hostname. */
export function groupTabsByDomain(tabs) {
  const groups = new Map();
  tabs.forEach((tab) => {
    const hostname = normalizeHostname(tab.url || "");
    if (!hostname) return;
    if (!groups.has(hostname)) groups.set(hostname, []);
    groups.get(hostname).push(tab);
  });
  return [...groups.entries()].map(([hostname, groupedTabs]) => ({ hostname, tabs: groupedTabs }));
}
