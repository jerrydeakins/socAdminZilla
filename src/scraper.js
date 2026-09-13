import { state } from './state.js';
import { save } from './storage.js';
import { norm, sleep, uid, isValidVKUrl, clampInt } from './utils.js';

export function parseVKDate(value) {
	let text = norm(value).toLowerCase().replace(/ё/g, "е");
	if (!text) return null;
	if (/^\d{10,13}$/.test(text)) {
		const n = Number(text);
		return new Date(n < 0xe8d4a51000 ? n * 1e3 : n);
	}
	const iso = Date.parse(text);
	if (!Number.isNaN(iso) && /(?:\d{4}-\d{2}-\d{2}|t\d{2}:)/i.test(text)) return new Date(iso);
	const now = /* @__PURE__ */ new Date();
	if (text.startsWith("сегодня")) return new Date(now.getFullYear(), now.getMonth(), now.getDate());
	if (text.startsWith("вчера")) return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
	const rel = text.match(/(\d+)\s*(секунд(?:а|ы)?|сек\.?|минут(?:а|ы)?|мин\.?|час(?:а|ов)?|ч\.?)/);
	if (rel) {
		const n = Number(rel[1]), u = rel[2];
		const d = /* @__PURE__ */ new Date();
		d.setTime(d.getTime() - (u.startsWith("сек") ? n * 1e3 : u.startsWith("мин") ? n * 6e4 : n * 36e5));
		return d;
	}
	const months = {
		"янв": 0,
		"января": 0,
		"фев": 1,
		"февраля": 1,
		"мар": 2,
		"марта": 2,
		"апр": 3,
		"апреля": 3,
		"май": 4,
		"мая": 4,
		"июн": 5,
		"июня": 5,
		"июл": 6,
		"июля": 6,
		"авг": 7,
		"августа": 7,
		"сен": 8,
		"сент": 8,
		"сентября": 8,
		"окт": 9,
		"октября": 9,
		"ноя": 10,
		"ноября": 10,
		"дек": 11,
		"декабря": 11
	};
	const parts = text.replace(",", " ").split(/\s+/);
	if (parts.length < 2) return null;
	const day = parseInt(parts[0].replace(".", ""), 10);
	const month = months[parts[1].replace(".", "")];
	if (!Number.isFinite(day) || month === void 0) return null;
	let year = now.getFullYear();
	if (parts[2] && /^\d{4}$/.test(parts[2])) year = Number(parts[2]);
	else if (month > now.getMonth()) year--;
	return new Date(year, month, day);
}

export function postNodes() {
const primary = Array.from(document.querySelectorAll("[data-testid=\"post\"]"));
	if (primary.length) return primary;
	return Array.from(document.querySelectorAll("[data-post-id]")).filter((n) => !n.parentElement?.closest("[data-post-id]"));
}
export function extractPost(post) {
	const normalizeTextNode = (node) => {
		const clone = node.cloneNode(true);
		clone.querySelectorAll(".PostHeaderTitle__authorLink,[data-testid=\"post_date_block_preview\"],[data-testid=\"primary-attachment\"],video,[role=\"button\"]").forEach((el) => el.remove());
		clone.querySelectorAll("img").forEach((img) => {
			const emoji = [
				img.getAttribute("alt"),
				img.getAttribute("aria-label"),
				img.getAttribute("data-emoji"),
				img.getAttribute("data-emoji-code"),
				img.getAttribute("data-code"),
				img.getAttribute("title")
			].map((v) => (v || "").trim()).filter(Boolean).find((v) => {
				try {
					return /[\p{Extended_Pictographic}]/u.test(v);
				} catch (_) {
					return false;
				}
			});
			if (emoji) img.replaceWith(document.createTextNode(emoji));
			else img.remove();
		});
		clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
		return norm(clone.innerText || clone.textContent || "");
	};
	const textSelectors = [
		"[data-testid=\"showmoretext-in-expanded\"]",
		"[data-testid=\"showmoretext\"]",
		"[data-testid=\"post_text\"]",
		".wall_post_text",
		".wall_text"
	];
	let text = "";
	for (const sel of textSelectors) post.querySelectorAll(sel).forEach((n) => {
		const value = normalizeTextNode(n);
		if (value.length > text.length) text = value;
	});
	const author = post.querySelector(".PostHeaderTitle__authorLink,[data-testid=\"post_author\"]");
	const dateNode = post.querySelector("[data-testid=\"post_date_block_preview\"],time[datetime],time,[data-tooltip*=\"202\"],[title*=\"202\"],[aria-label*=\"202\"],[data-testid*=\"date\"]");
	const dateRaw = dateNode?.getAttribute("datetime") || dateNode?.getAttribute("data-tooltip") || dateNode?.getAttribute("title") || dateNode?.getAttribute("aria-label") || dateNode?.innerText || "";
	const wallLink = post.querySelector("a[href*=\"/wall\"]");
	const postId = post.getAttribute("data-post-id") || "";
	const id = postId || post.id || wallLink?.getAttribute("href") || "";
	if (!id) return null;
	const images = [];
	const seen = /* @__PURE__ */ new Set();
	const addImage = (src, alt = "") => {
		if (!src || /^data:/i.test(src)) return;
		try {
			src = new URL(src, location.href).href;
		} catch (_) {}
		if (seen.has(src)) return;
		seen.add(src);
		images.push({
			src,
			alt
		});
	};
	let attachmentRoots = Array.from(post.querySelectorAll("[data-testid=\"primary-attachment\"],[data-testid=\"post_attachments\"],[data-testid*=\"attachment\"]"));
	attachmentRoots = attachmentRoots.filter((n) => !n.parentElement?.closest("[data-testid=\"primary-attachment\"],[data-testid=\"post_attachments\"],[data-testid*=\"attachment\"]"));
	(attachmentRoots.length ? attachmentRoots : [post]).forEach((root) => {
		root.querySelectorAll("img").forEach((img) => {
			const src = img.currentSrc || img.src || img.getAttribute("data-src") || img.getAttribute("data-original") || "";
			const w = Number(img.naturalWidth || img.width || 0);
			const h = Number(img.naturalHeight || img.height || 0);
			const alt = (img.alt || "").trim();
			if (!attachmentRoots.length && w > 0 && h > 0 && w < 100 && h < 100) return;
			if (!attachmentRoots.length && /emoji|смайл/i.test(alt)) return;
			addImage(src, alt);
		});
		root.querySelectorAll("[style*=\"background-image\"],[data-background-image]").forEach((el) => {
			const m = (el.getAttribute("data-background-image") || el.style.backgroundImage || "").match(/url\(["']?(.*?)["']?\)/i);
			if (m) addImage(m[1]);
		});
	});
	return {
		id,
		post_id: postId,
		url: wallLink ? new URL(wallLink.getAttribute("href"), location.origin).href : "",
		author: norm(author?.innerText || ""),
		author_url: author?.getAttribute("href") ? new URL(author.getAttribute("href"), location.origin).href : "",
		date: norm(dateRaw),
		text,
		images
	};
}
export function fallbackPostKey(node) {
return [
	node.querySelector("a[href*=\"/wall\"]")?.getAttribute("href") || "",
	node.querySelector("time[datetime],time,[data-testid*=\"date\"]")?.getAttribute("datetime") || "",
	norm(node.innerText || node.textContent || "").slice(0, 500)
	].join("|");
}
export async function collectInThisTab(msg) {
	const count = Math.max(1, Math.min(25, Number(msg.count || 10)));
	const maxAgeDays = Math.max(0, Math.min(2, Number(msg.maxAgeDays ?? 2)));
	const cutoff = /* @__PURE__ */ new Date(Date.now() - maxAgeDays * 864e5);
	const all = /* @__PURE__ */ new Map();
	let scrolls = 0, stagnant = 0, lastSignature = "";
	const MAX_SCROLLS = 8, deadline = Date.now() + 45e3;
	const collectVisible = () => {
		const nodes = postNodes();
		for (const node of nodes) {
			const item = extractPost(node);
			if (!item) continue;
			const key = item.post_id || item.id || item.url || fallbackPostKey(node);
			if (key) all.set(String(key), item);
		}
		return nodes;
	};
	const filtered = () => {
		const result = [];
		for (const item of all.values()) {
			const d = parseVKDate(item.date);
			if (d && d < cutoff) continue;
			result.push({
				...item,
				_date: d
			});
		}
		result.sort((a, b) => (b._date?.getTime() || 0) - (a._date?.getTime() || 0));
		return result.map(({ _date, ...item }) => item);
	};
	while (Date.now() < deadline && scrolls <= MAX_SCROLLS) {
		const nodes = collectVisible();
		const result = filtered();
		if (result.length >= count) return result.slice(0, count);
		const signature = nodes.map((n) => n.getAttribute("data-post-id") || n.id || fallbackPostKey(n)).join("|");
		stagnant = signature === lastSignature ? stagnant + 1 : 0;
		lastSignature = signature;
		const height = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
		const viewport = window.innerHeight || 800;
		const y = window.scrollY || window.pageYOffset || 0;
		if (y + viewport >= height - 8 || stagnant >= 2 || scrolls >= MAX_SCROLLS) return result.slice(0, count);
		const oldY = y;
		window.scrollBy(0, Math.max(700, viewport * .85));
		scrolls++;
		await sleep(2500);
		const newY = window.scrollY || window.pageYOffset || 0;
		if (Math.abs(newY - oldY) < 4) stagnant++;
	}
	return filtered().slice(0, count);
}
export function communityAvatarUrl() {
	const avatar = document.querySelector("[id^=\"community_avatar_\"]");
	if (!avatar) return "";
	const img = avatar.querySelector("img");
	if (!img) return "";
	const candidates = [
		img.getAttribute("src"),
		img.getAttribute("data-src"),
		img.getAttribute("data-original"),
		img.getAttribute("data-lazy-src")
	];
	for (const value of candidates) if (value?.trim()) return value.trim();
	const srcset = img.getAttribute("srcset");
	if (srcset) {
		const entries = srcset.split(",").map((v) => v.trim()).filter(Boolean);
		if (entries.length) return entries[entries.length - 1].split(/\s+/)[0];
	}
	return "";
}
export async function waitForCommunityAvatar(timeoutMs = 12000) {
	const immediate = communityAvatarUrl();
	if (immediate) return immediate;
	return await new Promise((resolve) => {
		let settled = false;
		const observer = new MutationObserver(() => {
			const value = communityAvatarUrl();
			if (value) finish(value);
		});
		const timer = setTimeout(() => finish(""), timeoutMs);
		const finish = (value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			observer.disconnect();
			resolve(value || "");
		};
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: [
				"src",
				"srcset",
				"class"
			]
		});
	});
}
export async function waitForPostContent(timeoutMs = 15000) {
	const hasExtractablePost = () => {
		const nodes = postNodes();
		for (const node of nodes) if (extractPost(node)) return true;
		return false;
	};
	if (hasExtractablePost()) return true;
	return await new Promise((resolve) => {
		let settled = false;
		let timer = null;
		const finish = (value) => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			observer.disconnect();
			resolve(value);
		};
		const observer = new MutationObserver(() => {
			if (hasExtractablePost()) finish(true);
		});
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true
		});
		timer = setTimeout(() => finish(false), timeoutMs);
		if (hasExtractablePost()) finish(true);
	});
}
export async function startFetch(){
  const source=state.db.sources.find(x=>x.id===state.selectedSource);
  if(!source){alert("Выбери источник.");return;}

  const count=clampInt(document.getElementById("sa-limit")?.value,1,25,10);
  const maxAgeDays=clampInt(state.db.settings.maxAge,0,2,2);
  const homeUrl=String((state.db.settings.homeCommunities||[])[0]||state.db.settings.homeCommunity||"").trim();
  
  if(!isValidVKUrl(homeUrl)){
    alert("Сначала укажи Домашнее сообщество в настройках.");
    state.active="settings";
    state.open=true;
    render();
    renderPanel();
    return;
  }

  state.db.settings.postsCount=count;
  state.db.settings.maxAge=maxAgeDays;
  await save();

  const pending={
    id:uid(),
    sourceUrl:source.url,
    homeUrl,
    count,
    maxAgeDays,
    startedAt:Date.now()
  };
  await browser.storage.local.set({socadminCollection:pending});
  location.href=source.url;
}