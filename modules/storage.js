const STORAGE_KEY = "tabParkingCollections";

export async function getCollections() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const collections = stored[STORAGE_KEY];
  return Array.isArray(collections) ? collections : [];
}

async function saveCollections(collections) {
  await chrome.storage.local.set({ [STORAGE_KEY]: collections });
}

export async function addCollection({ name, tabs }) {
  const collections = await getCollections();
  const collection = {
    id: crypto.randomUUID(),
    name: name.trim(),
    savedAt: new Date().toISOString(),
    tabs,
  };
  collections.unshift(collection);
  await saveCollections(collections);
  return collection;
}

export async function renameCollection(id, name) {
  const collections = await getCollections();
  const collection = collections.find((item) => item.id === id);
  if (!collection) throw new Error("That collection no longer exists.");
  collection.name = name.trim();
  await saveCollections(collections);
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
