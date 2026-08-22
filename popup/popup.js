import { addCollection, appendTabsToCollection, deleteCollection, getAppendSummary, getCollections, removeTabFromCollection, renameCollection } from "../modules/storage.js";
import { closeTabs, getCurrentWindowTabs, restoreCollection, restoreOneTab, serializeTabs } from "../modules/tabs.js";
import { filterTabs, groupTabsByDomain, normalizeHostname } from "../modules/tab-selection.js";

const state = { tabs: [], collections: [], searchQuery: "", collectionSearchQuery: "", destinationId: null, chooserOpener: null };
const $ = (selector) => document.querySelector(selector);
const openTabs = $("#open-tabs");
const collectionsList = $("#collections-list");
const status = $("#status");

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
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

function renderCollections() {
  $("#collections-loading").hidden = true;
  $("#collection-count").textContent = `${state.collections.length} saved`;
  $("#collections-empty").hidden = state.collections.length !== 0;
  collectionsList.replaceChildren();
  state.collections.forEach((collection) => {
    const card = document.createElement("article");
    card.className = "collection-card";
    card.innerHTML = `<div class="collection-header"><div><h3 class="collection-name">${escapeText(collection.name)}</h3><p class="collection-meta">${formatDate(collection.savedAt)} · ${collection.tabs.length} tab${collection.tabs.length === 1 ? "" : "s"}</p></div><div class="collection-actions"><button class="rename" type="button" aria-label="Rename ${escapeText(collection.name)}">Rename</button><button class="delete" type="button" aria-label="Delete ${escapeText(collection.name)}">Delete</button></div></div><button class="primary restore-all" type="button">Restore in new window</button><ul class="saved-tabs"></ul>`;
    card.querySelector(".rename").addEventListener("click", () => onRename(collection));
    card.querySelector(".delete").addEventListener("click", () => onDelete(collection));
    card.querySelector(".restore-all").addEventListener("click", () => onRestoreAll(collection));
    const list = card.querySelector(".saved-tabs");
    collection.tabs.slice().sort((a, b) => a.originalIndex - b.originalIndex).forEach((tab) => {
      const row = document.createElement("li");
      row.className = "saved-tab";
      row.innerHTML = `<img class="favicon" alt="" /><span class="tab-name" title="${escapeText(tab.url)}">${escapeText(tab.title || tab.url || "Untitled tab")}</span><button class="restore" type="button" aria-label="Restore ${escapeText(tab.title || tab.url)}">Restore</button><button class="remove" type="button" aria-label="Remove ${escapeText(tab.title || tab.url)} from collection">Remove</button>`;
      const icon = row.querySelector("img"); icon.src = tab.favIconUrl || ""; icon.addEventListener("error", faviconError);
      row.querySelector(".restore").addEventListener("click", () => onRestoreOne(tab));
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

async function onRestoreAll(collection) {
  setStatus("Restoring collection…");
  const result = await restoreCollection(collection.tabs);
  setStatus(result.skipped ? `Restored ${result.restored}; skipped ${result.skipped} unsupported or invalid URL${result.skipped === 1 ? "" : "s"}.` : `Restored ${result.restored} tabs in a new window.` , result.skipped > 0);
}

async function onRestoreOne(tab) {
  const restored = await restoreOneTab(tab);
  setStatus(restored ? "Tab restored." : "This URL cannot be restored by Chrome.", !restored);
}

async function onRename(collection) {
  const name = window.prompt("New collection name:", collection.name)?.trim();
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
    renderOpenTabs(); renderCollections();
  } catch (error) { setStatus(`Could not load extension data: ${error.message}`, true); }
}
init();
