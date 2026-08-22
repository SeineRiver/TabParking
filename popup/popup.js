import { addCollection, appendTabsToCollection, deleteCollection, getAppendSummary, getCollections, removeTabFromCollection, renameCollection, toggleCollectionFavorite, toggleCollectionPin, updateCollectionTags } from "../modules/storage.js";
import { closeTabs, getCurrentWindowTabs, restoreCollection, restoreOneTab, restoreOneTabInCurrentWindow, serializeTabs } from "../modules/tabs.js";
import { filterTabs, groupTabsByDomain, normalizeHostname } from "../modules/tab-selection.js";
import { getTagOptions, matchesCollection, sortCollections } from "../modules/collections.js";

const state = { tabs: [], collections: [], searchQuery: "", collectionSearchQuery: "", collectionsSearchQuery: "", collectionFilter: { type: "all", tag: "" }, destinationId: null, chooserOpener: null, activeView: "tabs" };
const $ = (selector) => document.querySelector(selector);
const openTabs = $("#open-tabs");
const collectionsList = $("#collections-list");
const status = $("#status");

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function renderActiveView() {
  const showCollections = state.activeView === "collections";
  $("#tab-selection-view").hidden = showCollections;
  $("#collections-view").hidden = !showCollections;
  const toggle = $("#collections-view-toggle");
  toggle.setAttribute("aria-label", showCollections ? "Back to tab parking" : "View parked collections");
  toggle.title = showCollections ? "Back to tab parking" : "View parked collections";
  toggle.firstElementChild.textContent = showCollections ? "←" : "☷";
}

function escapeText(value) {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}

function faviconError(event) { event.currentTarget.style.visibility = "hidden"; }

function visibleTabs() { return filterTabs(state.tabs, state.searchQuery); }
function hasActiveSearch() { return state.searchQuery.trim().length > 0; }

function updateSelectionSummary(filteredTabs = visibleTabs()) {
  const selectedCount = state.tabs.filter((tab) => tab.selected).length;
  const filteredSuffix = hasActiveSearch() ? ` · ${filteredTabs.length} matching` : "";
  $("#tab-count").textContent = `${state.tabs.length} tab${state.tabs.length === 1 ? "" : "s"}${filteredSuffix}`;
  $("#selected-count").textContent = `${selectedCount} tab${selectedCount === 1 ? "" : "s"} selected`;
}

function renderDomainGroups(filteredTabs = visibleTabs()) {
  const container = $("#domain-groups");
  const groups = groupTabsByDomain(filteredTabs);
  container.replaceChildren();
  $("#domain-groups-section").hidden = groups.length === 0;
  groups.forEach((group) => {
    const selectedCount = group.tabs.filter((tab) => tab.selected).length;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "domain-checkbox";
    checkbox.dataset.hostname = group.hostname;
    checkbox.checked = selectedCount === group.tabs.length;
    checkbox.indeterminate = selectedCount > 0 && selectedCount < group.tabs.length;
    checkbox.setAttribute("aria-label", `Select all ${group.tabs.length} tabs from ${group.hostname}`);

    const label = document.createElement("label");
    label.className = "domain-group";
    label.append(checkbox);
    const domainName = document.createElement("span");
    domainName.className = "domain-name";
    domainName.textContent = group.hostname;
    const count = document.createElement("span");
    count.className = "domain-count";
    count.textContent = `${group.tabs.length} tab${group.tabs.length === 1 ? "" : "s"}`;
    label.append(domainName, count);
    container.append(label);
  });
}

function renderOpenTabs() {
  const filteredTabs = visibleTabs();
  openTabs.replaceChildren();
  $("#tabs-loading").hidden = true;
  const noResults = $("#tabs-no-results");
  noResults.hidden = filteredTabs.length !== 0;
  noResults.textContent = hasActiveSearch() ? "No matching tabs. Try another title, URL, or domain." : "No open tabs in this window.";
  openTabs.hidden = filteredTabs.length === 0;
  updateSelectionSummary(filteredTabs);
  renderDomainGroups(filteredTabs);
  const template = $("#tab-item-template");
  filteredTabs.forEach((tab) => {
    const item = template.content.firstElementChild.cloneNode(true);
    const checkbox = item.querySelector("input");
    checkbox.checked = Boolean(tab.selected);
    checkbox.dataset.id = String(tab.id);
    checkbox.setAttribute("aria-label", `Select ${tab.title || tab.url || "tab"}`);
    const icon = item.querySelector("img");
    icon.src = tab.favIconUrl || "";
    icon.addEventListener("error", faviconError);
    item.querySelector(".tab-title").textContent = tab.title || tab.url || "Untitled tab";
    item.querySelector(".tab-title").title = tab.url || "";
    item.querySelector(".tab-kind").textContent = normalizeHostname(tab.url || "") ? "" : "Non-standard URL";
    item.querySelector(".pinned").textContent = tab.pinned ? "⌖" : "";
    openTabs.append(item);
  });
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(isoDate));
}

function filteredCollections() {
  const { type, tag } = state.collectionFilter;
  return sortCollections(state.collections.filter((collection) => {
    const matchesFilter = type === "all"
      || (type === "pinned" && collection.isPinned)
      || (type === "favorites" && collection.isFavorite)
      || (type === "tag" && collection.tags.some((item) => item.toLowerCase() === tag.toLowerCase()));
    return matchesFilter && matchesCollection(collection, state.collectionsSearchQuery);
  }));
}

function renderCollectionFilters() {
  const container = $("#collection-filters");
  container.replaceChildren();
  const options = [
    { label: "All", type: "all" },
    { label: "Pinned", type: "pinned" },
    { label: "Favorites", type: "favorites" },
    ...getTagOptions(state.collections).map((tag) => ({ label: tag, type: "tag", tag })),
  ];
  options.forEach((option) => {
    const button = document.createElement("button");
    const selected = state.collectionFilter.type === option.type && (option.type !== "tag" || state.collectionFilter.tag.toLowerCase() === option.tag.toLowerCase());
    button.type = "button";
    button.className = "collection-filter";
    button.dataset.type = option.type;
    if (option.tag) button.dataset.tag = option.tag;
    button.setAttribute("aria-pressed", String(selected));
    button.textContent = option.label;
    container.append(button);
  });
}

function renderCollectionTags(collection, container) {
  if (!collection.tags.length) {
    container.hidden = true;
    return;
  }
  collection.tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    const text = document.createElement("span");
    text.textContent = tag;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = `Remove ${tag}`;
    remove.setAttribute("aria-label", `Remove tag ${tag} from ${collection.name}`);
    remove.addEventListener("click", () => onRemoveTag(collection, tag));
    chip.append(text, remove);
    container.append(chip);
  });
}

function renderCollections() {
  if (state.collectionFilter.type === "tag" && !getTagOptions(state.collections).some((tag) => tag.toLowerCase() === state.collectionFilter.tag.toLowerCase())) {
    state.collectionFilter = { type: "all", tag: "" };
  }
  const collections = filteredCollections();
  $("#collections-loading").hidden = true;
  $("#collection-count").textContent = `${state.collections.length} saved`;
  $("#collection-results").textContent = state.collections.length ? `${collections.length} matching collection${collections.length === 1 ? "" : "s"}` : "";
  $("#collections-empty").hidden = state.collections.length !== 0;
  $("#collections-no-results").hidden = state.collections.length === 0 || collections.length !== 0;
  collectionsList.replaceChildren();
  renderCollectionFilters();
  collections.forEach((collection) => {
    const card = document.createElement("article");
    card.className = "collection-card";
    const favoriteLabel = collection.isFavorite ? "Remove from favorites" : "Add to favorites";
    const pinLabel = collection.isPinned ? "Unpin collection" : "Pin collection";
    card.innerHTML = `<div class="collection-header"><div class="collection-heading"><div class="collection-title-row"><h3 class="collection-name" title="${escapeText(collection.name)}">${escapeText(collection.name)}</h3><div class="collection-name-actions"><button class="collection-icon rename" type="button" title="Rename collection" aria-label="Rename ${escapeText(collection.name)}">✎</button><button class="collection-icon delete" type="button" title="Delete collection" aria-label="Delete ${escapeText(collection.name)}">×</button></div></div><p class="collection-meta">${formatDate(collection.savedAt)} · ${collection.tabs.length} tab${collection.tabs.length === 1 ? "" : "s"}</p></div><div class="collection-actions"><button class="collection-icon pin" type="button" title="${pinLabel}" aria-label="${pinLabel}: ${escapeText(collection.name)}" aria-pressed="${collection.isPinned}">📌</button><button class="collection-icon favorite" type="button" title="${favoriteLabel}" aria-label="${favoriteLabel}: ${escapeText(collection.name)}" aria-pressed="${collection.isFavorite}">${collection.isFavorite ? "★" : "☆"}</button><button class="collection-icon restore-all" type="button" title="Restore in new window" aria-label="Restore ${escapeText(collection.name)} in a new window">↗</button><button class="collection-icon restore-current" type="button" title="Restore in current window" aria-label="Restore ${escapeText(collection.name)} in the current window">↪</button></div></div><div class="collection-tags" aria-label="Tags for ${escapeText(collection.name)}"></div><ul class="saved-tabs"></ul>`;
    renderCollectionTags(collection, card.querySelector(".collection-tags"));
    card.querySelector(".rename").addEventListener("click", () => onRename(collection));
    card.querySelector(".delete").addEventListener("click", () => onDelete(collection));
    card.querySelector(".favorite").addEventListener("click", () => onToggleFavorite(collection));
    card.querySelector(".pin").addEventListener("click", () => onTogglePin(collection));
    card.querySelector(".restore-all").addEventListener("click", () => onRestoreAll(collection));
    card.querySelector(".restore-current").addEventListener("click", () => onRestoreAll(collection, "current"));
    const list = card.querySelector(".saved-tabs");
    collection.tabs.slice().sort((a, b) => a.originalIndex - b.originalIndex).forEach((tab) => {
      const row = document.createElement("li");
      row.className = "saved-tab";
      row.innerHTML = `<img class="favicon" alt="" /><span class="tab-name" title="${escapeText(tab.url)}">${escapeText(tab.title || tab.url || "Untitled tab")}</span><button class="icon-button restore" type="button" title="Restore" aria-label="Restore ${escapeText(tab.title || tab.url)}"><span aria-hidden="true">↗</span></button><button class="icon-button restore-current" type="button" title="Restore in current window" aria-label="Restore ${escapeText(tab.title || tab.url)} in current window"><span aria-hidden="true">↪</span></button><button class="icon-button remove" type="button" title="Remove from collection" aria-label="Remove ${escapeText(tab.title || tab.url)} from collection"><span aria-hidden="true">×</span></button>`;
      const icon = row.querySelector("img"); icon.src = tab.favIconUrl || ""; icon.addEventListener("error", faviconError);
      row.querySelector(".restore").addEventListener("click", () => onRestoreOne(tab));
      row.querySelector(".restore-current").addEventListener("click", () => onRestoreOneInCurrentWindow(tab));
      row.querySelector(".remove").addEventListener("click", () => onRemoveTab(collection, tab));
      list.append(row);
    });
    collectionsList.append(card);
  });
}

async function refreshCollections() { state.collections = await getCollections(); renderCollections(); }

function confirmAction(title, message, confirmText = "Confirm") {
  const dialog = $("#confirm-dialog");
  $("#dialog-title").textContent = title;
  $("#dialog-message").textContent = message;
  $("#dialog-confirm").textContent = confirmText;
  dialog.showModal();
  return new Promise((resolve) => dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true }));
}

async function onSave(event) {
  event.preventDefault();
  const selected = state.tabs.filter((tab) => tab.selected);
  const name = $("#collection-name").value.trim();
  if (!selected.length) return setStatus("Choose at least one tab to save.", true);
  if (!name) return setStatus("Give this collection a name.", true);
  const closeAfterSave = $("#close-after-save").checked;
  if (closeAfterSave && !(await confirmAction("Close selected tabs?", `“${name}” will be saved first, then ${selected.length} selected tab${selected.length === 1 ? "" : "s"} will close.`, "Save and close"))) return;
  const button = $("#save-button"); button.disabled = true;
  try {
    await addCollection({ name, tabs: serializeTabs(selected) });
    if (closeAfterSave) await closeTabs(selected);
    $("#collection-name").value = ""; $("#close-after-save").checked = true;
    setStatus(closeAfterSave ? "Collection saved and selected tabs closed." : "Collection saved locally.");
    await refreshCollections();
    if (closeAfterSave) { state.tabs = await getCurrentWindowTabs(); renderOpenTabs(); }
  } catch (error) { setStatus(`Could not save collection: ${error.message}`, true); }
  finally { button.disabled = false; }
}

function recentlyUpdatedCollections() {
  return state.collections.slice().sort((first, second) => new Date(second.updatedAt || second.savedAt) - new Date(first.updatedAt || first.savedAt));
}

function renderCollectionChooser() {
  const list = $("#collection-chooser-list");
  const query = state.collectionSearchQuery.trim().toLowerCase();
  const allCollections = recentlyUpdatedCollections();
  const collections = allCollections.filter((collection) => collection.name.toLowerCase().includes(query));
  list.replaceChildren();
  $("#collection-chooser-loading").hidden = true;
  $("#collection-chooser-error").hidden = true;
  $("#collection-chooser-empty").hidden = allCollections.length !== 0;
  $("#collection-chooser-no-results").hidden = allCollections.length === 0 || collections.length !== 0;
  if (!collections.some((collection) => collection.id === state.destinationId)) state.destinationId = null;
  collections.forEach((collection) => {
    const choice = document.createElement("label");
    choice.className = "collection-choice";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "destination-collection";
    radio.value = collection.id;
    radio.checked = collection.id === state.destinationId;
    radio.setAttribute("aria-label", `Choose ${collection.name}`);
    const name = document.createElement("span");
    name.className = "choice-name";
    name.textContent = collection.name;
    const meta = document.createElement("span");
    meta.className = "choice-meta";
    meta.textContent = `${collection.tabs.length} tab${collection.tabs.length === 1 ? "" : "s"} · ${formatDate(collection.updatedAt || collection.savedAt)}`;
    choice.append(radio, name, meta);
    list.append(choice);
  });
  $("#add-dialog-confirm").disabled = !state.destinationId;
}

async function openAddToExistingChooser() {
  const selected = state.tabs.filter((tab) => tab.selected);
  if (!selected.length) return setStatus("Choose at least one tab to add.", true);
  state.destinationId = null;
  state.collectionSearchQuery = "";
  state.chooserOpener = $("#add-existing-button");
  $("#collection-search").value = "";
  $("#add-dialog-summary").textContent = `${selected.length} selected tab${selected.length === 1 ? "" : "s"} will be added to the collection you choose.`;
  $("#collection-chooser-loading").hidden = false;
  $("#collection-chooser-list").replaceChildren();
  $("#collection-chooser-empty").hidden = true;
  $("#collection-chooser-no-results").hidden = true;
  $("#collection-chooser-error").hidden = true;
  const dialog = $("#add-dialog");
  dialog.showModal();
  try {
    state.collections = await getCollections();
    renderCollections();
    renderCollectionChooser();
    $("#collection-search").focus();
  } catch (error) {
    $("#collection-chooser-loading").hidden = true;
    const chooserError = $("#collection-chooser-error");
    chooserError.textContent = `Could not load collections: ${error.message}`;
    chooserError.hidden = false;
  }
}

function addConfirmationMessage(collection, selectedCount, summary) {
  const duplicateDetail = summary.duplicates
    ? ` ${summary.duplicates} tab${summary.duplicates === 1 ? " is" : "s are"} already in “${collection.name}” and will not be added.`
    : " All selected tabs are new to this collection.";
  return `${selectedCount} selected tab${selectedCount === 1 ? "" : "s"} will close after adding to “${collection.name}”.${duplicateDetail}`;
}

async function addToExistingCollection() {
  const collection = state.collections.find((item) => item.id === state.destinationId);
  const selected = state.tabs.filter((tab) => tab.selected);
  if (!collection || !selected.length) return;
  const savedTabs = serializeTabs(selected);
  const preview = getAppendSummary(collection.tabs, savedTabs);
  const closeAfterSave = $("#close-after-save").checked;
  $("#add-dialog").close("add");
  if (closeAfterSave && !(await confirmAction("Close selected tabs?", addConfirmationMessage(collection, selected.length, preview), "Add and close"))) return;
  try {
    const result = await appendTabsToCollection(collection.id, savedTabs);
    if (closeAfterSave) await closeTabs(selected);
    await refreshCollections();
    if (!result.newTabs.length) {
      setStatus(closeAfterSave ? `All selected tabs are already in “${collection.name}”. Selected tabs closed.` : `All selected tabs are already in “${collection.name}”.`);
    } else {
      const duplicateDetail = result.duplicates ? ` ${result.duplicates} were already in this collection.` : "";
      setStatus(`Added ${result.newTabs.length} tab${result.newTabs.length === 1 ? "" : "s"} to “${collection.name}”.${duplicateDetail}${closeAfterSave ? " Selected tabs closed." : ""}`);
    }
    if (closeAfterSave) { state.tabs = await getCurrentWindowTabs(); renderOpenTabs(); }
  } catch (error) { setStatus(`Could not add tabs: ${error.message}`, true); }
}

function destinationLabel(destination) {
  if (destination === "current") return "the current window";
  return "a new window";
}

function reportRestoreResult(result) {
  if (result.error) {
    setStatus(`Could not restore collection: ${result.error}`, true);
    return;
  }
  if (!result.restored) {
    setStatus("No restorable tabs were found. Unsupported or invalid URLs were skipped.", true);
    return;
  }
  const message = `Restored ${result.restored} tab${result.restored === 1 ? "" : "s"} in ${destinationLabel(result.destination)}.`;
  setStatus(result.skipped ? `${message} Skipped ${result.skipped} unsupported or invalid URL${result.skipped === 1 ? "" : "s"}.` : message, result.skipped > 0);
}

async function onRestoreAll(collection, destination = "new") {
  setStatus(`Restoring collection in ${destinationLabel(destination)}…`);
  try {
    const result = await restoreCollection(collection.tabs, destination);
    reportRestoreResult(result);
  } catch (error) {
    setStatus(`Could not restore collection: ${error.message}`, true);
  }
}

async function onRestoreOne(tab) {
  const restored = await restoreOneTab(tab);
  setStatus(restored ? "Tab restored." : "This URL cannot be restored by Chrome.", !restored);
}

async function onRestoreOneInCurrentWindow(tab) {
  const restored = await restoreOneTabInCurrentWindow(tab);
  setStatus(restored ? "Tab restored in the current window." : "This URL cannot be restored in the current window.", !restored);
}

async function onRename(collection) {
  const name = window.prompt("New collection name (max 48 characters):", collection.name)?.trim();
  if (!name) return;
  try { await renameCollection(collection.id, name); await refreshCollections(); setStatus("Collection renamed."); }
  catch (error) { setStatus(error.message, true); }
}

async function onDelete(collection) {
  if (!(await confirmAction("Delete collection?", `Delete “${collection.name}” and its ${collection.tabs.length} saved tabs? This cannot be undone.`, "Delete"))) return;
  await deleteCollection(collection.id); await refreshCollections(); setStatus("Collection deleted.");
}

async function onRemoveTab(collection, tab) {
  const remaining = await removeTabFromCollection(collection.id, tab.id);
  await refreshCollections(); setStatus(remaining ? "Tab removed from collection." : "Tab removed. The collection is now empty.");
}

async function onRemoveTag(collection, tag) {
  try {
    await updateCollectionTags(collection.id, collection.tags.filter((item) => item.toLowerCase() !== tag.toLowerCase()));
    await refreshCollections();
    setStatus(`Removed tag “${tag}”.`);
  } catch (error) { setStatus(`Could not remove tag: ${error.message}`, true); }
}

async function onToggleFavorite(collection) {
  try {
    const updated = await toggleCollectionFavorite(collection.id);
    await refreshCollections();
    setStatus(updated.isFavorite ? `Added “${collection.name}” to favorites.` : `Removed “${collection.name}” from favorites.`);
  } catch (error) { setStatus(`Could not update favorite: ${error.message}`, true); }
}

async function onTogglePin(collection) {
  try {
    const updated = await toggleCollectionPin(collection.id);
    await refreshCollections();
    setStatus(updated.isPinned ? `Pinned “${collection.name}”.` : `Unpinned “${collection.name}”.`);
  } catch (error) { setStatus(`Could not update pin: ${error.message}`, true); }
}

openTabs.addEventListener("change", (event) => {
  if (!event.target.matches(".tab-checkbox")) return;
  const tab = state.tabs.find((item) => item.id === Number(event.target.dataset.id));
  if (tab) {
    tab.selected = event.target.checked;
    updateSelectionSummary();
    renderDomainGroups();
  }
});
$("#domain-groups").addEventListener("change", (event) => {
  if (!event.target.matches(".domain-checkbox")) return;
  const hostname = event.target.dataset.hostname;
  groupTabsByDomain(visibleTabs()).find((group) => group.hostname === hostname)?.tabs.forEach((tab) => { tab.selected = event.target.checked; });
  renderOpenTabs();
});
$("#tab-search").addEventListener("input", (event) => { state.searchQuery = event.target.value; renderOpenTabs(); });
$("#select-all").addEventListener("click", () => { visibleTabs().forEach((tab) => { tab.selected = true; }); renderOpenTabs(); });
$("#clear-selection").addEventListener("click", () => { state.tabs.forEach((tab) => { tab.selected = false; }); renderOpenTabs(); });
$("#collections-view-toggle").addEventListener("click", () => {
  state.activeView = state.activeView === "tabs" ? "collections" : "tabs";
  renderActiveView();
});
$("#collections-search").addEventListener("input", (event) => {
  state.collectionsSearchQuery = event.target.value;
  renderCollections();
});
$("#collection-filters").addEventListener("click", (event) => {
  const button = event.target.closest(".collection-filter");
  if (!button) return;
  state.collectionFilter = { type: button.dataset.type, tag: button.dataset.tag || "" };
  renderCollections();
});
$("#save-form").addEventListener("submit", onSave);
$("#add-existing-button").addEventListener("click", openAddToExistingChooser);
$("#collection-search").addEventListener("input", (event) => {
  state.collectionSearchQuery = event.target.value;
  renderCollectionChooser();
});
$("#collection-chooser-list").addEventListener("change", (event) => {
  if (!event.target.matches('input[name="destination-collection"]')) return;
  state.destinationId = event.target.value;
  $("#add-dialog-confirm").disabled = false;
});
$("#add-to-existing-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "add") addToExistingCollection();
  else $("#add-dialog").close("cancel");
});
$("#add-dialog").addEventListener("close", () => {
  state.chooserOpener?.focus();
  state.chooserOpener = null;
});
async function init() {
  try {
    [state.tabs, state.collections] = await Promise.all([getCurrentWindowTabs(), getCollections()]);
    state.tabs.forEach((tab) => { tab.selected = false; });
    renderOpenTabs(); renderCollections(); renderActiveView();
  } catch (error) { setStatus(`Could not load extension data: ${error.message}`, true); }
}
init();
