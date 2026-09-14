import { state, ROOT_ID } from './state.js';
import { esc, setHTML, uid, clampInt, isValidVKUrl, faIcon, postKey, publicationPreviewText, normalizeCommunityUrl } from './utils.js';
import { save, communityLogo, fetchCommunityLogo, exportSettings, importSettings } from './storage.js';
import { startFetch } from './scraper.js';
import { showModal } from './ui/modal.js';

export function alignVKHeader() {
	const header = document.getElementById("page_header_cont");
	if (!header) return;
	header.style.setProperty("top", "40px", "important");
}
export function mountRoot(root) {
	const header = document.getElementById("page_header_cont");
	alignVKHeader();
	const preferred = header?.parentElement || document.querySelector(".layoutWrapper_root");
	const fallback = document.getElementById("page_layout") || document.body;
	const parent = preferred || fallback;
	if (!parent) return;
	if (header && header.parentElement === parent) {
		if (root.parentElement !== parent || root.nextElementSibling !== header) parent.insertBefore(root, header);
	} else if (root.parentElement !== parent) parent.insertBefore(root, parent.firstChild);
}
export function removePanel() {
	const p = document.getElementById("socadmin-panel");
	if (p) p.remove();
}
export function positionPanel() {
	const bar = document.getElementById("socadmin-bar");
	const panel = document.getElementById("socadmin-panel");
	if (!bar || !panel) return;
	const r = bar.getBoundingClientRect();
	panel.style.left = `${Math.max(8, r.left)}px`;
	panel.style.top = `${r.bottom}px`;
}
export function createPanel() {
	if (!state.open) return;
	removePanel();
	const panel = document.createElement("div");
	panel.id = "socadmin-panel";
	panel.className = "open";
	document.body.appendChild(panel);
	positionPanel();
}
export function render() {
	style();
	let root = document.getElementById(ROOT_ID);
	if (!root) {
		root = document.createElement("div");
		root.id = ROOT_ID;
	}
	mountRoot(root);
	removePanel();
	setHTML(root, `
<div id="socadmin-bar">
<span id="socadmin-brand">SocAdmin</span>
${[
		"posts",
		"moderation",
		"publication",
		"archive",
		"settings"
	].map((x, i) => `<button class="sa-tab ${state.open && state.active === x ? "active" : ""}" data-tab="${x}">${[
		"Посты",
		"Модерация",
		"Публикация",
		"Архив",
		"Настройки"
	][i]}</button>`).join("")}
<button id="socadmin-collapse" title="Свернуть">⌃</button>
</div>`);
	root.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => {
		const tab = b.dataset.tab;
		if (state.open && state.active === tab) {
			state.open = false;
			render();
			return;
		}
		state.active = tab;
		state.open = true;
		render();
		renderPanel();
	});
	root.querySelector("#socadmin-collapse").onclick = () => {
		state.open = !state.open;
		render();
		if (state.open) renderPanel();
	};
	if (state.open) {
		createPanel();
		renderPanel();
	}
}
export function panelShell(content) {
	const p = document.getElementById("socadmin-panel");
	if (p) {
		p.classList.toggle("sa-publication-panel", state.active === "publication");
		p.classList.toggle("sa-posts-panel", state.active === "posts");
		setHTML(p, content);
		positionPanel();
	}
}
export function renderPanel() {
	if (state.active === "posts") renderPostsPanel();
	if (state.active === "moderation") renderModerationPanel();
	if (state.active === "publication") renderPublicationPanel();
	if (state.active === "archive") renderArchivePanel();
	if (state.active === "settings") renderSettingsPanel();
}
export function renderPostsPanel() {
	panelShell(`<div class="sa-grid">
  <div class="sa-panel"><div class="sa-title">Источники</div><div id="sa-sources" class="sa-list"></div>
    <div class="sa-row"><input id="sa-source-url" class="sa-input" placeholder="https://vk.ru/community"></div>
    <button id="sa-add-source" class="sa-btn">Добавить источник</button>
  </div>
  <div class="sa-panel"><div class="sa-title">Посты</div>
    <div class="sa-row"><input id="sa-limit" class="sa-input" type="number" min="1" max="25" value="${Number(state.db.settings.postsCount ?? 10)}"></div>
    <button id="sa-fetch" class="sa-btn">Получить посты</button>
    <span id="sa-status" class="sa-muted"></span>
    <div id="sa-feed" class="sa-list" style="margin-top:7px"></div>
  </div>
</div>`);
	const sources = document.getElementById("sa-sources");
	setHTML(sources, state.db.sources.map((s) => {
		const logo = communityLogo(s.url);
		return `<div class="sa-card sa-source-card ${state.selectedSource === s.id ? "selected" : ""}" data-source="${s.id}"><div class="sa-source-logo-wrap">${logo ? `<img class="sa-source-logo" src="${esc(logo)}" alt="">` : `<div class="sa-source-logo-placeholder">VK</div>`}</div><div class="sa-source-info"><div class="sa-meta">${esc(s.name || s.alias)}</div><div class="sa-muted">${esc(s.url)}</div></div></div>`;
	}).join(""));
	sources.querySelectorAll("[data-source]").forEach((x) => x.onclick = () => {
		state.selectedSource = x.dataset.source;
		renderPostsPanel();
	});
	document.getElementById("sa-add-source").onclick = async () => {
		let u = document.getElementById("sa-source-url").value.trim();
		if (!/^https:\/\/vk\.(ru|com)\//i.test(u)) {
			alert("Разрешены только https://vk.ru/... и https://vk.com/...");
			return;
		}
		const s = {
			id: uid(),
			url: u,
			name: u.replace(/^https:\/\/vk\.(ru|com)\//i, "").replace(/\/.*$/, ""),
			alias: u
		};
		state.db.sources.push(s);
		state.selectedSource = s.id;
		await fetchCommunityLogo(u);
		await save();
		renderPostsPanel();
	};
	document.getElementById("sa-fetch").onclick = startFetch;
	renderFeed([]);
}

export function renderImages(images) {
	if (!Array.isArray(images) || !images.length) return "";
	return `<div class="sa-images">${images.map((img) => {
		const src = typeof img === "string" ? img : img?.src;
		if (!src) return "";
		return `<img src="${esc(src)}" alt="${esc(typeof img === "string" ? "" : img?.alt || "")}" loading="lazy">`;
	}).join("")}</div>`;
}
export function renderFeed(posts) {
	const box = document.getElementById("sa-feed");
	if (!box) return;
	setHTML(box, (posts || []).map((p) => `<div class="sa-card"><div class="sa-meta">${esc(p.author)} · ${esc(p.date)}</div><div class="sa-text">${esc(p.text || "(без текста)")}</div>${renderImages(p.images)}</div>`).join(""));
}

export function renderModerationPreview(p) {
	const images = Array.isArray(p.images) ? p.images : [];
	const first = images[0] && (typeof images[0] === "string" ? images[0] : images[0]?.src);
	const preview = String(p.text || "(без текста)").replace(/\s+/g, " ").trim();
	const short = preview.length > 250 ? preview.slice(0, 250) + "…" : preview;
	return `<div class="sa-card-preview">${first ? `<img class="sa-card-thumb" src="${esc(first)}" loading="lazy">` : ``}<div class="sa-card-preview-text"><div class="sa-meta">${esc(p.author)} · ${esc(p.date)}</div><div class="sa-text">${esc(short)}</div></div></div>`;
}

export function renderModerationEditor(p) {
	const panel = document.getElementById("sa-editor");
	if (!panel) return;
	if (!p) {
		setHTML(panel, `<div class="sa-panel sa-empty"><div class="sa-title">Редактор</div><div class="sa-muted">Выбери пост слева.</div></div>`);
		return;
	}
	const images = Array.isArray(p.images) ? p.images : [];
	setHTML(panel, `<div class="sa-panel sa-editor">
<div class="sa-title">Редактор поста</div>
<div class="sa-meta">${esc(p.author)} · ${esc(p.date)}</div>
<label>Целевое сообщество<select id="sa-target-community" class="sa-select">${(state.db.settings.homeCommunities || []).map((x) => `<option value="${esc(x)}" ${x === String(p.targetCommunity || "") ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
<label>Текст</label>
<div class="sa-editor-tools-wrap">
<div class="sa-editor-tools">
  <button id="sa-tool-emoji" class="sa-btn" type="button">😀 Emoji <span class="sa-tool-arrow">▼</span></button>
  <button id="sa-tool-hashtag" class="sa-btn" type="button"># Хэштеги <span class="sa-tool-arrow">▼</span></button>
  <button id="sa-tool-template" class="sa-btn" type="button">▤ Шаблоны <span class="sa-tool-arrow">▼</span></button>
</div>
<div id="sa-pop-emoji" class="sa-tool-pop"></div>
<div id="sa-pop-hashtag" class="sa-tool-pop"></div>
<div id="sa-pop-template" class="sa-tool-pop"></div>
</div>
<textarea id="sa-edit-text" class="sa-textarea">${esc(p.text || "")}</textarea>
<div class="sa-title" style="margin-top:9px">Изображения</div>
<div id="sa-edit-images" class="sa-editor-images">${images.map((img, i) => {
		const src = typeof img === "string" ? img : img?.src;
		if (!src) return "";
		return `<div class="sa-editor-image"><img src="${esc(src)}" loading="lazy"><button class="sa-btn sa-danger" data-del-img="${i}" title="Удалить изображение">×</button></div>`;
	}).join("")}</div>
<div class="sa-image-add-row"><input id="sa-add-image-url" class="sa-input" placeholder="URL изображения"><button id="sa-add-image" class="sa-add-image-btn" type="button" title="Добавить изображение" aria-label="Добавить изображение"><svg viewBox="0 0 448 512" aria-hidden="true"><path d="M416 208H272V64c0-17.7-14.3-32-32-32h-32c-17.7 0-32 14.3-32 32v144H32c-17.7 0-32 14.3-32 32v32c0 17.7 14.3 32 32 32h144v144c0 17.7 14.3 32 32 32h32c17.7 0 32-14.3 32-32V304h144c17.7 0 32-14.3 32-32v-32c0-17.7-14.3-32-32-32z"/></svg></button></div>
<div class="sa-row"><button id="sa-save-post" class="sa-btn">Сохранить</button><button id="sa-publish-post" class="sa-btn">Опубликовать</button><button id="sa-delete-post" class="sa-btn sa-danger">Удалить</button><span id="sa-editor-status" class="sa-muted"></span></div>
</div>`);
	const textArea = document.getElementById("sa-edit-text");
	const popEmoji = document.getElementById("sa-pop-emoji");
	const popHash = document.getElementById("sa-pop-hashtag");
	const popTpl = document.getElementById("sa-pop-template");
	const toolButtons = {
		emoji: document.getElementById("sa-tool-emoji"),
		hashtag: document.getElementById("sa-tool-hashtag"),
		template: document.getElementById("sa-tool-template")
	};
	const setArrow = (key, open) => {
		const arrow = toolButtons[key]?.querySelector(".sa-tool-arrow");
		if (arrow) arrow.textContent = open ? "▲" : "▼";
	};
	const closePops = () => {
		[
			popEmoji,
			popHash,
			popTpl
		].forEach((x) => x.classList.remove("open"));
		setArrow("emoji", false);
		setArrow("hashtag", false);
		setArrow("template", false);
	};
	const togglePop = (key, pop, items, fn, empty) => {
		const wasOpen = pop.classList.contains("open");
		closePops();
		if (wasOpen) return;
		fillPop(pop, items, fn, empty);
		pop.classList.add("open");
		setArrow(key, true);
	};
	const insertAtCursor = (value) => {
		const start = textArea.selectionStart, end = textArea.selectionEnd;
		const before = textArea.value.slice(0, start), after = textArea.value.slice(end);
		textArea.value = before + value + after;
		textArea.focus();
		const pos = start + value.length;
		textArea.setSelectionRange(pos, pos);
	};
	const fillPop = (pop, items, fn, empty) => {
		setHTML(pop, items.length ? items.map((x, i) => `<button type="button" class="sa-btn sa-tool-item" data-tool-item="${i}">${esc(typeof x === "string" ? x : x?.name || x?.text || "")}</button>`).join("") : `<span class="sa-muted">${empty}</span>`);
		pop.querySelectorAll("[data-tool-item]").forEach((b) => b.onclick = () => {
			fn(items[+b.dataset.toolItem]);
			closePops();
		});
	};
	document.getElementById("sa-tool-emoji").onclick = () => togglePop("emoji", popEmoji, state.db.emoji || [], (x) => insertAtCursor(String(x)), "Нет сохранённых emoji");
	document.getElementById("sa-tool-hashtag").onclick = () => togglePop("hashtag", popHash, state.db.hashtags || [], (x) => insertAtCursor((textArea.value && !/[\s]$/.test(textArea.value) ? " " : "") + String(x)), "Нет сохранённых хэштегов");
	document.getElementById("sa-tool-template").onclick = () => togglePop("template", popTpl, state.db.templates || [], (x) => insertAtCursor(String(x?.text ?? x ?? "")), "Нет сохранённых шаблонов");
	panel.querySelectorAll("[data-del-img]").forEach((b) => b.onclick = async () => {
		const idx = Number(b.dataset.delImg);
		p.images = (Array.isArray(p.images) ? p.images : []).filter((_, i) => i !== idx);
		await save();
		renderModerationPanel();
	});
	document.getElementById("sa-add-image").onclick = async () => {
		const input = document.getElementById("sa-add-image-url");
		const url = input.value.trim();
		const status = document.getElementById("sa-editor-status");
		if (!url) {
			if (status) status.textContent = "Укажи URL изображения.";
			return;
		}
		try {
			new URL(url);
		} catch (_) {
			if (status) status.textContent = "Некорректный URL изображения.";
			return;
		}
		p.images = Array.isArray(p.images) ? p.images : [];
		if (!p.images.some((img) => (typeof img === "string" ? img : img?.src) === url)) p.images.push(url);
		input.value = "";
		await save();
		renderModerationPanel(true);
	};
	document.getElementById("sa-save-post").onclick = async () => {
		const status = document.getElementById("sa-editor-status");
		p.text = document.getElementById("sa-edit-text").value;
		p.targetCommunity = document.getElementById("sa-target-community")?.value || "";
		await save();
		if (status) {
			status.textContent = "Сохранено";
			setTimeout(() => {
				if (status) status.textContent = "";
			}, 1800);
		}
	};
	document.getElementById("sa-publish-post").onclick = async () => {
		const key = postKey(p);
		if (!(state.db.publication || []).some((x) => postKey(x) === key)) state.db.publication.push(structuredClone(p));
		state.selectedPost = key;
		await save();
		renderModerationPanel(true);
		const status = document.getElementById("sa-editor-status");
		if (status) {
			status.textContent = "Пост отправлен в публикацию";
			setTimeout(() => {
				if (status) status.textContent = "";
			}, 2200);
		}
		const card = document.querySelector(`[data-post="${CSS.escape(key)}"]`);
		if (card) {
			card.classList.add("sa-queued");
			card.scrollIntoView({ block: "nearest" });
		}
	};
	document.getElementById("sa-delete-post").onclick = async () => {
		const isConfirmed = await showModal({
			title: "Удаление поста",
			message: "Вы действительно хотите удалить этот пост из зоны модерации?",
			confirmText: "Удалить",
			cancelText: "Отмена"
		});

		if (!isConfirmed) return;

		const key = postKey(p);
		state.db.posts = state.db.posts.filter((x) => postKey(x) !== key);
		state.selectedPost = null;
		await save();
		renderModerationPanel();
	};
}
export function renderModerationPanel(keepListScroll = true) {
	const oldBox = document.getElementById("sa-mod");
	const savedScrollTop = keepListScroll && oldBox ? oldBox.scrollTop : 0;
	const items = state.db.posts;
	const validKeys = new Set(items.map(postKey).map(String));
	state.selectedPosts = (state.selectedPosts || []).map(String).filter((key) => validKeys.has(key));
	let selected = items.find((p) => postKey(p) === String(state.selectedPost)) || items[0] || null;
	state.selectedPost = selected ? postKey(selected) : null;
	panelShell(`<div class="sa-mod-grid"><div class="sa-panel"><div class="sa-title">Зона модерации</div><div id="sa-mod" class="sa-list sa-mod-list"></div></div><div id="sa-editor"></div></div>`);
	const box = document.getElementById("sa-mod");

	if (!items.length) {
		setHTML(box, `<div class="sa-empty sa-muted">В зоне модерации нет постов.</div>`);
		renderModerationEditor(selected);
		return;
	}

	const groups = new Map();
	for (const p of items) {
		const sourceUrl = String(p.sourceUrl || "").trim();
		const groupKey = normalizeCommunityUrl(sourceUrl) || "__missing__";
		if (!groups.has(groupKey)) groups.set(groupKey, { sourceUrl, posts: [] });
		groups.get(groupKey).posts.push(p);
	}

	setHTML(box, `<div class="sa-mod-selection-toolbar">
		<label><input type="checkbox" data-mod-select-all> Выбрать все</label>
		<button type="button" class="sa-btn" data-mod-clear-selection>Снять выбор</button>
		<span class="sa-mod-selection-count" data-mod-selection-count></span>
		<button type="button" class="sa-btn sa-danger" data-mod-delete-selected disabled>Удалить выбранные</button>
	</div>` + Array.from(groups.values()).map((group) => {
		const sourceKey = normalizeCommunityUrl(group.sourceUrl);
		const source = (state.db.sources || []).find((s) => normalizeCommunityUrl(s?.url) === sourceKey);
		const logo = sourceKey ? communityLogo(sourceKey) : "";
		const name = source?.name || source?.alias || (sourceKey ? sourceKey : "Источник не указан");
		const url = source?.url || group.sourceUrl || "";

		const groupKeys = group.posts.map(postKey).map(String);
		const selectedKeys = new Set(state.selectedPosts || []);
		const groupSelected = groupKeys.length > 0 && groupKeys.every((key) => selectedKeys.has(key));

		return `<section class="sa-mod-group">
			<div class="sa-mod-group-head">
				${logo ? `<img class="sa-mod-group-logo" src="${esc(logo)}" alt="">` : `<div class="sa-mod-group-logo-placeholder">VK</div>`}
				<div class="sa-mod-group-info">
					<div class="sa-mod-group-name">${esc(name)}</div>
					${url ? `<div class="sa-mod-group-url">${esc(url)}</div>` : ""}
				</div>
				<label class="sa-mod-group-select"><input type="checkbox" data-mod-group-select data-group-keys="${esc(JSON.stringify(groupKeys))}" ${groupSelected ? "checked" : ""}> Все</label>
			</div>
			<div class="sa-mod-group-posts">
				${group.posts.map((p) => {
					const key = postKey(p);
					const queued = (state.db.publication || []).some((x) => postKey(x) === key);
					const checked = (state.selectedPosts || []).includes(String(key));
					return `<div class="sa-card ${key === state.selectedPost ? "selected" : ""} ${queued ? "sa-queued" : ""}" data-post="${esc(key)}"><label class="sa-mod-post-select"><input type="checkbox" data-mod-post-select ${checked ? "checked" : ""}> Выбрать</label>${renderModerationPreview(p)}${queued ? `<div class="sa-queued-note">✓ Отправлен в публикацию</div>` : ""}</div>`;
				}).join("")}
			</div>
		</section>`;
	}).join(""));

	if (savedScrollTop) box.scrollTop = savedScrollTop;

	const selectionKeys = () => new Set((state.selectedPosts || []).map(String));
	const rerenderSelection = () => renderModerationPanel(true);

	const selectAll = box.querySelector("[data-mod-select-all]");
	const allKeys = items.map(postKey).map(String);
	if (selectAll) {
		const selectedKeys = selectionKeys();
		selectAll.checked = allKeys.length > 0 && allKeys.every((key) => selectedKeys.has(key));
		selectAll.indeterminate = allKeys.some((key) => selectedKeys.has(key)) && !selectAll.checked;
		selectAll.onchange = () => {
			state.selectedPosts = selectAll.checked ? [...allKeys] : [];
			rerenderSelection();
		};
	}

	const count = box.querySelector("[data-mod-selection-count]");
	if (count) count.textContent = `Выбрано: ${(state.selectedPosts || []).length}`;

	box.querySelector("[data-mod-clear-selection]")?.addEventListener("click", () => {
		state.selectedPosts = [];
		rerenderSelection();
	});

	box.querySelector("[data-mod-delete-selected]")?.addEventListener("click", async (event) => {
		const button = event.currentTarget;
		const keys = [...(state.selectedPosts || [])].map(String);
		if (!keys.length) return;
		button.disabled = true;
		try {
			const isConfirmed = await showModal({
				title: "Массовое удаление",
				message: `Вы действительно хотите удалить выбранные посты (${keys.length}) из зоны модерации?`,
				confirmText: "Удалить",
				cancelText: "Отмена"
			});
			if (!isConfirmed) return;
			const keySet = new Set(keys);
			state.db.posts = state.db.posts.filter((post) => !keySet.has(String(postKey(post))));
			if (state.selectedPost != null && keySet.has(String(state.selectedPost))) state.selectedPost = null;
			state.selectedPosts = [];
			await save();
			renderModerationPanel();
		} finally {
			button.disabled = false;
		}
	});

	box.querySelectorAll("[data-mod-group-select]").forEach((checkbox) => {
		checkbox.indeterminate = JSON.parse(checkbox.dataset.groupKeys).some((key) => (state.selectedPosts || []).includes(String(key))) && !checkbox.checked;
		checkbox.onclick = (event) => event.stopPropagation();
		checkbox.onchange = () => {
			const keys = JSON.parse(checkbox.dataset.groupKeys).map(String);
			const selectedKeys = selectionKeys();
			for (const key of keys) checkbox.checked ? selectedKeys.add(key) : selectedKeys.delete(key);
			state.selectedPosts = [...selectedKeys];
			rerenderSelection();
		};
	});

	box.querySelectorAll("[data-mod-post-select]").forEach((checkbox) => {
		checkbox.onclick = (event) => event.stopPropagation();
		checkbox.onchange = () => {
			const key = String(checkbox.closest("[data-post]").dataset.post);
			const selectedKeys = selectionKeys();
			if (checkbox.checked) selectedKeys.add(key);
			else selectedKeys.delete(key);
			state.selectedPosts = [...selectedKeys];
			rerenderSelection();
		};
	});

	const deleteButton = box.querySelector("[data-mod-delete-selected]");
	if (deleteButton) deleteButton.disabled = !(state.selectedPosts || []).length;

	box.querySelectorAll("[data-post]").forEach((x) => x.onclick = (event) => {
		if (event.target.closest("input, label")) return;
		state.selectedPost = x.dataset.post;
		renderModerationPanel(true);
	});

	renderModerationEditor(selected);
}

export function renderPublicationPanel() {
	const items = state.db.publication || [];
	panelShell(`<div class="sa-panel"><div class="sa-title">Публикация</div><div class="sa-muted">Посты, подготовленные к публикации. Кнопки копирования используются как временный способ публикации.</div><div id="sa-publication-list" class="sa-list sa-publication-list" style="margin-top:7px"></div></div>`);
	const box = document.getElementById("sa-publication-list");
	setHTML(box, items.length ? items.map((p) => {
		const images = Array.isArray(p.images) ? p.images : [];
		const first = images[0] && (typeof images[0] === "string" ? images[0] : images[0]?.src);
		const key = postKey(p);
		return `<div class="sa-card sa-pub-card" data-pub-key="${esc(key)}">
<div class="sa-auto-confirm" hidden>
  <button class="sa-auto-ok" data-auto-confirm="${esc(key)}" title="Подтвердить" aria-label="Подтвердить">${faIcon("check")}</button>
  <button class="sa-auto-cancel" data-auto-cancel="${esc(key)}" title="Отменить" aria-label="Отменить">${faIcon("xmark")}</button>
</div>
<div class="sa-pub-head"><span>${esc(p.date || "")}</span><span class="sa-pub-sep">•</span><span>${esc(p.targetCommunity || "Целевое сообщество не указано")}</span></div>
${first ? `<img class="sa-pub-image" src="${esc(first)}" loading="lazy">` : ""}
<div class="sa-pub-body"><div class="sa-pub-text">${esc(publicationPreviewText(p) || "(без текста)")}</div></div>
<div class="sa-pub-actions">
  <div class="sa-pub-auto-row">
    <button class="sa-auto-btn" data-auto-pub="${esc(key)}" title="Автоматически вставить текст и изображения в уже открытый Новый пост" aria-label="Авто">${faIcon("wand")}<span>Авто</span></button>
  </div>
  <div class="sa-pub-button-row">
    <div class="sa-pub-actions-left">
      <button class="sa-action-blue" data-copy-text="${esc(key)}" title="Копировать текст" aria-label="Копировать текст">${faIcon("text")}</button>
      <button class="sa-action-blue" data-copy-image="${esc(key)}" title="Копировать изображение" aria-label="Копировать изображение">${faIcon("image")}</button>
      <button class="sa-action-orange sa-pub-edit" data-pub-edit="${esc(key)}" title="Редактировать" aria-label="Редактировать">${faIcon("edit")}</button>
    </div>
    <button class="sa-action-red" data-pub-del="${esc(key)}" title="Удалить" aria-label="Удалить">${faIcon("trash")}</button>
  </div>
  <span class="sa-muted" data-pub-status="${esc(key)}"></span>
</div>
</div>`;
	}).join("") : `<div class="sa-empty sa-muted">Очередь публикации пуста.</div>`);
	box.querySelectorAll("[data-auto-pub]").forEach((b) => b.onclick = async () => {
		const key = b.dataset.autoPub;
		const p = items.find((x) => postKey(x) === key);
		if (!p) return;
		const status = box.querySelector(`[data-pub-status="${CSS.escape(key)}"]`);
		const setStatus = (text) => {
			if (status) status.textContent = text;
		};
		try {
			const modal = document.querySelector("[data-testid=\"posting_modal_box\"][aria-modal=\"true\"]");
			if (!modal) throw new Error("Открой в VK окно «Новый пост» и повтори.");
			const textField = modal.querySelector("[data-testid=\"posting_base_screen_input_message\"][contenteditable=\"true\"]");
			if (!textField) throw new Error("Не найдено поле текста в окне «Новый пост».");
			textField.focus();
			const text = String(p.text || "");
			textField.replaceChildren();
			text.split("\n").forEach((line, i) => {
				if (i) textField.appendChild(document.createElement("br"));
				textField.appendChild(document.createTextNode(line));
			});
			textField.dispatchEvent(new InputEvent("input", {
				bubbles: true,
				inputType: "insertText",
				data: text
			}));
			textField.dispatchEvent(new Event("change", { bubbles: true }));
			const images = Array.isArray(p.images) ? p.images : [];
			if (images.length) {
				const fileInput = modal.querySelector("[data-testid=\"posting_base_screen_download_from_device\"]");
				if (!fileInput) throw new Error("Не найдено поле загрузки изображения в окне «Новый пост».");
				const dt = new DataTransfer();
				let loaded = 0;
				for (let i = 0; i < images.length; i++) {
					const raw = images[i];
					const src = typeof raw === "string" ? raw : raw?.src;
					if (!src) continue;
					const result = await browser.runtime.sendMessage({
						type: "fetchImage",
						url: src
					});
					if (!result?.ok) throw new Error(result?.error || "Не удалось получить изображение.");
					const bytes = new Uint8Array(result.bytes);
					const blob = new Blob([bytes], { type: result.type || "image/jpeg" });
					const ext = (blob.type || "image/jpeg").split("/")[1] || "jpg";
					const file = new File([blob], `socadmin-${Date.now()}-${i}.${ext}`, { type: blob.type || "image/jpeg" });
					dt.items.add(file);
					loaded++;
				}
				if (loaded) {
					fileInput.files = dt.files;
					fileInput.dispatchEvent(new Event("input", { bubbles: true }));
					fileInput.dispatchEvent(new Event("change", { bubbles: true }));
				}
			}
			const card = b.closest(".sa-pub-card");
			if (card) {
				card.classList.add("sa-auto-active");
				const confirm = card.querySelector(".sa-auto-confirm");
				if (confirm) confirm.hidden = false;
			}
			setStatus("Готово — данные вставлены в VK");
			setTimeout(() => setStatus(""), 1800);
		} catch (error) {
			setStatus(error?.message || "Не удалось выполнить авто-вставку");
		}
	});
	box.querySelectorAll("[data-auto-confirm]").forEach((b) => b.onclick = async () => {
		const key = b.dataset.autoConfirm;
		state.db.publication = state.db.publication.filter((p) => postKey(p) !== key);
		await save();
		renderPublicationPanel();
	});
	box.querySelectorAll("[data-auto-cancel]").forEach((b) => b.onclick = () => {
		const card = b.closest(".sa-pub-card");
		if (!card) return;
		card.classList.remove("sa-auto-active");
		const confirm = card.querySelector(".sa-auto-confirm");
		if (confirm) confirm.hidden = true;
	});
	box.querySelectorAll("[data-copy-text]").forEach((b) => b.onclick = async () => {
		const p = items.find((x) => postKey(x) === b.dataset.copyText);
		if (!p) return;
		const status = box.querySelector(`[data-pub-status="${CSS.escape(b.dataset.copyText)}"]`);
		try {
			await navigator.clipboard.writeText(String(p.text || ""));
			if (status) {
				status.textContent = "Текст скопирован";
				setTimeout(() => status.textContent = "", 1500);
			}
		} catch (e) {
			if (status) status.textContent = "Не удалось скопировать";
		}
	});
	box.querySelectorAll("[data-copy-image]").forEach((b) => b.onclick = async () => {
		const p = items.find((x) => postKey(x) === b.dataset.copyImage);
		if (!p) return;
		const status = box.querySelector(`[data-pub-status="${CSS.escape(b.dataset.copyImage)}"]`);
		const first = (Array.isArray(p.images) ? p.images : [])[0];
		const src = typeof first === "string" ? first : first?.src;
		if (!src) {
			if (status) status.textContent = "Нет изображения";
			return;
		}
		try {
			const result = await browser.runtime.sendMessage({
				type: "fetchImage",
				url: src
			});
			if (!result?.ok) throw new Error(result?.error || "Не удалось получить изображение.");
			const bytes = new Uint8Array(result.bytes);
			const blob = new Blob([bytes], { type: result.type || "image/png" });
			if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("clipboard-image");
			const type = blob.type || "image/png";
			await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
			if (status) {
				status.textContent = "Изображение скопировано";
				setTimeout(() => status.textContent = "", 1500);
			}
		} catch (_) {
			if (status) status.textContent = "Не удалось скопировать изображение";
		}
	});
	box.querySelectorAll("[data-pub-edit]").forEach((b) => b.onclick = async () => {
		const key = b.dataset.pubEdit;
		const idx = state.db.publication.findIndex((x) => postKey(x) === key);
		if (idx < 0) return;
		const p = state.db.publication.splice(idx, 1)[0];
		state.db.posts.push(p);
		state.selectedPost = key;
		await save();
		state.active = "moderation";
		state.open = true;
		render();
		renderPanel();
	});
	box.querySelectorAll("[data-pub-del]").forEach((b) => b.onclick = async () => {
		const key = b.dataset.pubDel;
		state.db.publication = state.db.publication.filter((p) => postKey(p) !== key);
		await save();
		renderPublicationPanel();
	});
}
export function renderArchivePanel() {
	panelShell(`<div class="sa-panel"><div class="sa-title">Архив</div><div class="sa-muted">Удалённые посты будут храниться здесь.</div></div>`);
}
export function renderSettingsPanel() {
	panelShell(`<div class="sa-panel">
<div class="sa-title">Настройки</div>
<div class="sa-title">Домашние сообщества</div>
<div id="sa-home-communities" class="sa-list"></div>
<div class="sa-row"><input id="sa-new-home-community" class="sa-input" type="url" placeholder="https://vk.ru/community"><button id="sa-add-home-community" class="sa-btn">Добавить</button></div>
<div class="sa-muted">Первое сообщество в списке используется по умолчанию для новых постов.</div>
<label>Количество постов<input id="sa-posts-count" class="sa-input" type="number" min="1" max="25" value="${Number(state.db.settings.postsCount ?? 10)}"></label>
<label>Максимальный возраст поста, дней<input id="sa-max-age" class="sa-input" type="number" min="0" max="2" value="${state.db.settings.maxAge ?? 2}"></label>
<div class="sa-row"><button id="sa-save-settings" class="sa-btn">Сохранить</button></div>
<hr><div class="sa-title">Импорт / экспорт</div>
<div class="sa-muted">Сохраняются источники, настройки, хэштеги, Emoji и шаблоны. Собранные посты в файл не входят.</div>
<div class="sa-row"><button id="sa-export-settings" class="sa-btn">Экспорт настроек</button><button id="sa-import-settings" class="sa-btn">Импорт настроек</button></div>
<input id="sa-import-file" type="file" accept="application/json,.json" style="display:none">
<hr><div class="sa-title">Хэштеги</div><div id="sa-hashtags" class="sa-chip-list"></div>
<div class="sa-row"><input id="sa-new-h" class="sa-input" placeholder="#пример"><button id="sa-add-h" class="sa-btn">Добавить</button></div>
<div class="sa-title">Emoji</div><div id="sa-emojis" class="sa-chip-list"></div>
<div class="sa-row"><input id="sa-new-e" class="sa-input" placeholder="🙂"><button id="sa-add-e" class="sa-btn">Добавить</button></div>
<hr><div class="sa-title">Шаблоны</div><div id="sa-templates" class="sa-list"></div>
<div class="sa-row"><input id="sa-new-template-name" class="sa-input" placeholder="Название шаблона"><textarea id="sa-new-template-text" class="sa-textarea" style="min-height:90px" placeholder="Текст шаблона"></textarea><button id="sa-add-template" class="sa-btn">Добавить</button></div>
</div>`);
	const homes = state.db.settings.homeCommunities || [];
	setHTML(document.getElementById("sa-home-communities"), homes.map((x, i) => `<div class="sa-card"><b>${i === 0 ? "По умолчанию: " : ""}</b>${esc(x)} <button data-rhome="${i}" class="sa-btn sa-danger">×</button></div>`).join("") || `<div class="sa-muted">Домашние сообщества не добавлены.</div>`);
	document.getElementById("sa-add-home-community").onclick = async () => {
		const v = document.getElementById("sa-new-home-community").value.trim();
		if (!isValidVKUrl(v)) {
			alert("Укажи ссылку https://vk.ru/... или https://vk.com/...");
			return;
		}
		if (homes.includes(v)) {
			alert("Это сообщество уже добавлено.");
			return;
		}
		homes.push(v);
		state.db.settings.homeCommunities = homes;
		state.db.settings.homeCommunity = homes[0] || "";
		await fetchCommunityLogo(v);
		await save();
		renderSettingsPanel();
	};
	document.querySelectorAll("[data-rhome]").forEach((b) => b.onclick = async () => {
		homes.splice(+b.dataset.rhome, 1);
		state.db.settings.homeCommunities = homes;
		state.db.settings.homeCommunity = homes[0] || "";
		await save();
		renderSettingsPanel();
	});
	setHTML(document.getElementById("sa-hashtags"), state.db.hashtags.map((x, i) => `<div class="sa-card">${esc(x)} <button data-rh="${i}" class="sa-btn sa-danger">×</button></div>`).join(""));
	setHTML(document.getElementById("sa-emojis"), state.db.emoji.map((x, i) => `<div class="sa-card">${esc(x)} <button data-re="${i}" class="sa-btn sa-danger">×</button></div>`).join(""));
	setHTML(document.getElementById("sa-templates"), (state.db.templates || []).map((x, i) => `<div class="sa-card"><b>${esc(x.name || "Без названия")}</b><div class="sa-muted">${esc(String(x.text || "").slice(0, 250))}</div><button data-rt="${i}" class="sa-btn sa-danger">×</button></div>`).join("") || `<div class="sa-muted">Шаблоны не добавлены.</div>`);
	document.getElementById("sa-export-settings").onclick = exportSettings;
	document.getElementById("sa-import-settings").onclick = () => document.getElementById("sa-import-file").click();
	document.getElementById("sa-import-file").onchange = async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (!confirm("Импорт заменит текущие источники, настройки, хэштеги, Emoji и шаблоны. Собранные посты и очередь публикации не будут удалены. Продолжить?")) {
			e.target.value = "";
			return;
		}
		try {
			await importSettings(file);
			state.selectedSource = null;
			renderSettingsPanel();
			alert("Настройки импортированы.");
		} catch (error) {
			alert(error?.message || String(error));
		} finally {
			e.target.value = "";
		}
	};
	document.getElementById("sa-save-settings").onclick = async () => {
		state.db.settings.postsCount = clampInt(document.getElementById("sa-posts-count").value, 1, 25, 10);
		state.db.settings.maxAge = clampInt(document.getElementById("sa-max-age").value, 0, 2, 2);
		state.db.settings.homeCommunities = homes;
		state.db.settings.homeCommunity = homes[0] || "";
		await save();
		renderSettingsPanel();
	};
	document.getElementById("sa-add-h").onclick = async () => {
		let v = document.getElementById("sa-new-h").value.trim();
		if (v) {
			v = "#" + v.replace(/^#+/, "");
			state.db.hashtags.push(v);
			await save();
			renderSettingsPanel();
		}
	};
	document.getElementById("sa-add-e").onclick = async () => {
		const v = document.getElementById("sa-new-e").value.trim();
		if (v) {
			state.db.emoji.push(v);
			await save();
			renderSettingsPanel();
		}
	};
	document.getElementById("sa-add-template").onclick = async () => {
		const name = document.getElementById("sa-new-template-name").value.trim();
		const text = document.getElementById("sa-new-template-text").value;
		if (!name || !text.trim()) {
			alert("Укажи название и текст шаблона.");
			return;
		}
		state.db.templates.push({
			id: uid(),
			name,
			text
		});
		await save();
		renderSettingsPanel();
	};
	document.querySelectorAll("[data-rh]").forEach((b) => b.onclick = async () => {
		state.db.hashtags.splice(+b.dataset.rh, 1);
		await save();
		renderSettingsPanel();
	});
	document.querySelectorAll("[data-re]").forEach((b) => b.onclick = async () => {
		state.db.emoji.splice(+b.dataset.re, 1);
		await save();
		renderSettingsPanel();
	});
	document.querySelectorAll("[data-rt]").forEach((b) => b.onclick = async () => {
		state.db.templates.splice(+b.dataset.rt, 1);
		await save();
		renderSettingsPanel();
	});
}
