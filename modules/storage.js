import { normalizeTags, withCollectionDefaults } from "./collections.js";

const STORAGE_KEY = "tabParkingCollections";
export const MAX_COLLECTION_NAME_LENGTH = 48;

function validateCollectionName(name) {
  const normalizedName = name.trim();
  if (normalizedName.length > MAX_COLLECTION_NAME_LENGTH) {
    throw new Error(`Collection names can be at most ${MAX_COLLECTION_NAME_LENGTH} characters.`);
  }
  return normalizedName;
}

export async function getCollections() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const collections = stored[STORAGE_KEY];
  return Array.isArray(collections) ? collections.map(withCollectionDefaults) : [];
}

async function saveCollections(collections) {
  await chrome.storage.local.set({ [STORAGE_KEY]: collections });
}

export async function addCollection({ name, tabs }) {
  const collections = await getCollections();
  const timestamp = new Date().toISOString();
  const collection = {
    id: crypto.randomUUID(),
    name: validateCollectionName(name),
    savedAt: timestamp,
    updatedAt: timestamp,
    tags: [],
    isFavorite: false,
    isPinned: false,
    pinnedAt: null,
    tabs,
  };
  collections.unshift(collection);
  await saveCollections(collections);
  return collection;
}

export function normalizeTabUrl(url) {
  try {
    return new URL(url).href;
  } catch {
    return (url || "").trim().toLowerCase();
  }
}

export function getAppendSummary(existingTabs, tabsToAppend) {
  const knownUrls = new Set((existingTabs || []).map((tab) => normalizeTabUrl(tab.url)));
  const newTabs = [];
  let duplicates = 0;
  tabsToAppend.forEach((tab) => {
    const normalizedUrl = normalizeTabUrl(tab.url);
    if (knownUrls.has(normalizedUrl)) {
      duplicates += 1;
      return;
    }
    knownUrls.add(normalizedUrl);
    newTabs.push(tab);
  });
  return { newTabs, duplicates };
}

export async function appendTabsToCollection(id, tabs) {
  const collections = await getCollections();
  const collection = collections.find((item) => item.id === id);
  if (!collection) throw new Error("That collection no longer exists.");
  const summary = getAppendSummary(collection.tabs, tabs);
  if (summary.newTabs.length) {
    const lastOriginalIndex = Math.max(-1, ...collection.tabs.map((tab) => Number.isInteger(tab.originalIndex) ? tab.originalIndex : -1));
    const appendedTabs = summary.newTabs.map((tab, index) => ({ ...tab, originalIndex: lastOriginalIndex + index + 1 }));
    collection.tabs = [...collection.tabs, ...appendedTabs];
    collection.updatedAt = new Date().toISOString();
    await saveCollections(collections);
    summary.newTabs = appendedTabs;
  }
  return { ...summary, collection };
}

export async function renameCollection(id, name) {
  const collections = await getCollections();
  const collection = collections.find((item) => item.id === id);
  if (!collection) throw new Error("That collection no longer exists.");
  collection.name = validateCollectionName(name);
  await saveCollections(collections);
}

async function updateCollection(id, update) {
  const collections = await getCollections();
  const collection = collections.find((item) => item.id === id);
  if (!collection) throw new Error("That collection no longer exists.");
  Object.assign(collection, update, { updatedAt: new Date().toISOString() });
  await saveCollections(collections);
  return collection;
}

export async function updateCollectionTags(id, tags) {
  return updateCollection(id, { tags: normalizeTags(tags) });
}

export async function toggleCollectionFavorite(id) {
  const collections = await getCollections();
  const collection = collections.find((item) => item.id === id);
  if (!collection) throw new Error("That collection no longer exists.");
  return updateCollection(id, { isFavorite: !collection.isFavorite });
}

export async function toggleCollectionPin(id) {
  const collections = await getCollections();
  const collection = collections.find((item) => item.id === id);
  if (!collection) throw new Error("That collection no longer exists.");
  const isPinned = !collection.isPinned;
  return updateCollection(id, { isPinned, pinnedAt: isPinned ? new Date().toISOString() : null });
}

export async function deleteCollection(id) {
  const collections = await getCollections();
  await saveCollections(collections.filter((item) => item.id !== id));
}

export async function removeTabFromCollection(collectionId, tabId) {
  const collections = await getCollections();
  const collection = collections.find((item) => item.id === collectionId);
  if (!collection) throw new Error("That collection no longer exists.");
  collection.tabs = collection.tabs.filter((tab) => tab.id !== tabId);
  await saveCollections(collections);
  return collection.tabs.length;
}
