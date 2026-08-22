import { normalizeHostname } from "./tab-selection.js";

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

export function normalizeTag(tag) {
  return (tag || "").trim().replace(/\s+/g, " ");
}

export function normalizeTags(tags) {
  const seen = new Set();
  return (Array.isArray(tags) ? tags : [])
    .map(normalizeTag)
    .filter((tag) => tag && tag.length <= MAX_TAG_LENGTH)
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key) || seen.size >= MAX_TAGS) return false;
      seen.add(key);
      return true;
    });
}

export function withCollectionDefaults(collection) {
  return {
    ...collection,
    tags: normalizeTags(collection.tags),
    isFavorite: Boolean(collection.isFavorite),
    isPinned: Boolean(collection.isPinned),
    pinnedAt: collection.pinnedAt || null,
    updatedAt: collection.updatedAt || collection.savedAt,
    tabs: Array.isArray(collection.tabs) ? collection.tabs : [],
  };
}

export function matchesCollection(collection, query) {
  const search = query.trim().toLowerCase();
  if (!search) return true;
  const collectionValues = [collection.name, ...(collection.tags || [])];
  const tabValues = (collection.tabs || []).flatMap((tab) => [tab.title, tab.url, normalizeHostname(tab.url || "")]);
  return [...collectionValues, ...tabValues].some((value) => (value || "").toLowerCase().includes(search));
}

export function sortCollections(collections) {
  const timestamp = (value) => new Date(value || 0).getTime() || 0;
  return collections.slice().sort((first, second) => {
    const firstRank = first.isPinned ? 0 : first.isFavorite ? 1 : 2;
    const secondRank = second.isPinned ? 0 : second.isFavorite ? 1 : 2;
    if (firstRank !== secondRank) return firstRank - secondRank;
    if (firstRank === 0) {
      const pinnedDifference = timestamp(second.pinnedAt) - timestamp(first.pinnedAt);
      if (pinnedDifference) return pinnedDifference;
    }
    return timestamp(second.updatedAt || second.savedAt) - timestamp(first.updatedAt || first.savedAt);
  });
}

export function getTagOptions(collections) {
  const tags = new Map();
  collections.forEach((collection) => (collection.tags || []).forEach((tag) => {
    if (!tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag);
  }));
  return [...tags.values()].sort((first, second) => first.localeCompare(second));
}
