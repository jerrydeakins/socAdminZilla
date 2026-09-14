import { state } from './state.js';
import { save } from './storage.js';
import { postKey } from './utils.js';
import { showModal } from './ui/modal.js';

const style = document.createElement('style');
style.id = 'sa-moderation-selection-style';
style.textContent = `
.sa-mod-selection-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:7px 8px;margin-bottom:6px;border:1px solid rgba(0,0,0,.12);border-radius:7px;background:rgba(255,255,255,.35)}
.sa-mod-selection-all,.sa-mod-group-select,.sa-mod-post-select{display:inline-flex;align-items:center;gap:5px;cursor:pointer}
.sa-mod-selection-count{font-size:11px;font-weight:600;opacity:.75}
.sa-mod-group-head{position:relative}
.sa-mod-group-select{margin-left:auto;flex:0 0 auto;font-size:11px;font-weight:600}
.sa-mod-post-select{margin:-2px 0 5px 0;font-size:11px;font-weight:600;opacity:.8}
.sa-mod-post-select input,.sa-mod-group-select input,.sa-mod-selection-all input{margin:0}
.sa-mod-selection-toolbar .sa-btn:disabled{opacity:.45;cursor:default}
@media(prefers-color-scheme:dark){
.sa-mod-selection-toolbar{background:rgba(46,48,51,.40);border-color:rgba(255,255,255,.14)}
}
`;
document.documentElement.appendChild(style);

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
  toolbar.innerHTML = `
    <label class="sa-mod-selection-all">
      <input type="checkbox" data-sa-select-all>
      <span>Выбрать все</span>
    </label>
    <button type="button" class="sa-btn" data-sa-clear-selection>Снять выбор</button>
    <span class="sa-mod-selection-count" data-sa-selection-count></span>
    <button type="button" class="sa-btn sa-danger" data-sa-delete-selected disabled>Удалить выбранные</button>
  `;
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
  label.innerHTML = `<input type="checkbox" data-sa-group-select aria-label="Выбрать все посты сообщества"> <span>Все</span>`;
  header.append(label);

  const checkbox = label.querySelector('input');
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
  label.innerHTML = `<input type="checkbox" data-sa-post-select aria-label="Выбрать пост">`;
  card.prepend(label);

  const checkbox = label.querySelector('input');
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
