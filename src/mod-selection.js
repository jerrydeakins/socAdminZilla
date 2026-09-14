import { state } from './state.js';
import { save } from './storage.js';
import { postKey } from './utils.js';
import { showModal } from './ui/modal.js';

let observer = null;
let syncing = false;

function selectedKeys() {
  return Array.isArray(state.selectedPosts) ? state.selectedPosts : [];
}

function setSelected(keys) {
  state.selectedPosts = [...new Set(keys.map(String))];
}

function toggleKeys(keys, checked) {
  const current = new Set(selectedKeys());
  for (const key of keys) {
    if (checked) current.add(String(key));
    else current.delete(String(key));
  }
  setSelected([...current]);
}

function addSelectionControls(box) {
  if (box.querySelector(':scope > [data-sa-selection-toolbar]')) return;

  const toolbar = document.createElement('div');
  toolbar.className = 'sa-mod-selection-toolbar';
  toolbar.dataset.saSelectionToolbar = '1';

  const allLabel = document.createElement('label');
  allLabel.className = 'sa-mod-selection-all';

  const allCheckbox = document.createElement('input');
  allCheckbox.type = 'checkbox';
  allCheckbox.dataset.saSelectAll = '';

  const allText = document.createElement('span');
  allText.textContent = 'Выбрать все';

  allLabel.append(allCheckbox, allText);

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.className = 'sa-btn';
  clearButton.dataset.saClearSelection = '';
  clearButton.textContent = 'Снять выбор';

  const count = document.createElement('span');
  count.className = 'sa-mod-selection-count';
  count.dataset.saSelectionCount = '';

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'sa-btn sa-danger';
  deleteButton.dataset.saDeleteSelected = '';
  deleteButton.disabled = true;
  deleteButton.textContent = 'Удалить выбранные';

  toolbar.append(allLabel, clearButton, count, deleteButton);
  box.prepend(toolbar);

  const allKeys = () => (state.db.posts || []).map(postKey).map(String);

  toolbar.querySelector('[data-sa-select-all]').onchange = (event) => {
    toggleKeys(allKeys(), event.currentTarget.checked);
    renderPanelAgain();
  };

  toolbar.querySelector('[data-sa-clear-selection]').onclick = () => {
    setSelected([]);
    renderPanelAgain();
  };

  toolbar.querySelector('[data-sa-delete-selected]').onclick = async (event) => {
    const button = event.currentTarget;
    const keys = selectedKeys().filter((key) =>
      (state.db.posts || []).some((post) => String(postKey(post)) === key)
    );
    if (!keys.length || button.disabled) return;

    button.disabled = true;

    try {
      const confirmed = await showModal({
        title: 'Массовое удаление',
        message: `Вы действительно хотите удалить выбранные посты (${keys.length}) из зоны модерации?`,
        confirmText: 'Удалить',
        cancelText: 'Отмена'
      });

      if (!confirmed) return;

      const keySet = new Set(keys);
      state.db.posts = (state.db.posts || []).filter((post) => !keySet.has(String(postKey(post))));
      if (state.selectedPost != null && keySet.has(String(state.selectedPost))) {
        state.selectedPost = null;
      }
      setSelected([]);
      await save();
      renderPanelAgain();
    } finally {
      button.disabled = false;
    }
  };
}

function addGroupSelectionControls(group) {
  const header = group.querySelector('.sa-mod-group-head');
  const posts = [...group.querySelectorAll('.sa-mod-group-posts [data-post]')];
  if (!header || !posts.length || header.querySelector('[data-sa-group-select]')) return;

  const keys = posts.map((post) => String(post.dataset.post));
  const selected = new Set(selectedKeys());

  const label = document.createElement('label');
  label.className = 'sa-mod-group-select';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.dataset.saGroupSelect = '';
  checkbox.setAttribute('aria-label', 'Выбрать все посты сообщества');

  const text = document.createElement('span');
  text.textContent = 'Все';

  label.append(checkbox, text);
  header.append(label);
  checkbox.checked = keys.every((key) => selected.has(key));
  checkbox.indeterminate = keys.some((key) => selected.has(key)) && !checkbox.checked;

  checkbox.onclick = (event) => event.stopPropagation();
  checkbox.onchange = (event) => {
    toggleKeys(keys, event.currentTarget.checked);
    renderPanelAgain();
  };
}

function addCardSelectionControl(card) {
  if (card.querySelector('[data-sa-post-select]')) return;

  const key = String(card.dataset.post);
  const label = document.createElement('label');
  label.className = 'sa-mod-post-select';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.dataset.saPostSelect = '';
  checkbox.setAttribute('aria-label', 'Выбрать пост');

  label.append(checkbox);
  card.prepend(label);
  checkbox.checked = selectedKeys().includes(key);
  checkbox.onclick = (event) => event.stopPropagation();
  checkbox.onchange = (event) => {
    toggleKeys([key], event.currentTarget.checked);
    renderPanelAgain();
  };
}

function syncSelectionUI() {
  if (syncing || !state.open || state.active !== 'moderation') return;

  const box = document.getElementById('sa-mod');
  if (!box || !state.db?.posts) return;

  syncing = true;
  try {
    const validKeys = new Set(state.db.posts.map(postKey).map(String));
    setSelected(selectedKeys().filter((key) => validKeys.has(String(key))));

    addSelectionControls(box);
    box.querySelectorAll('.sa-mod-group').forEach(addGroupSelectionControls);
    box.querySelectorAll('.sa-mod-group-posts [data-post]').forEach(addCardSelectionControl);

    const keys = state.db.posts.map(postKey).map(String);
    const selected = new Set(selectedKeys());
    const all = box.querySelector('[data-sa-select-all]');
    if (all) {
      all.checked = keys.length > 0 && keys.every((key) => selected.has(key));
      all.indeterminate = keys.some((key) => selected.has(key)) && !all.checked;
    }

    const count = box.querySelector('[data-sa-selection-count]');
    if (count) count.textContent = `Выбрано: ${selected.size}`;

    const deleteButton = box.querySelector('[data-sa-delete-selected]');
    if (deleteButton) deleteButton.disabled = selected.size === 0;
  } finally {
    syncing = false;
  }
}

function renderPanelAgain() {
  if (!document.getElementById('socadmin-panel')) return;
  import('./ui.js').then(({ renderModerationPanel }) => renderModerationPanel(true));
}

export function installModerationSelection() {
  if (observer) return;

  observer = new MutationObserver(() => syncSelectionUI());
  observer.observe(document.body, { childList: true, subtree: true });
  syncSelectionUI();
}
