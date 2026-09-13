import { normalizeCommunityUrl } from './utils.js';
import { state, DEFAULT_DB } from './state.js';

export function normalizeDB(db) {
  const value = db || {};
  value.sources ??= [];
  value.posts ??= [];
  value.publication ??= [];
  if (!Array.isArray(value.publication)) value.publication = [];
  value.settings ??= {};
  value.settings.homeCommunities ??= [];
  if (!Array.isArray(value.settings.homeCommunities)) value.settings.homeCommunities = [];
  if (!value.settings.homeCommunities.length && value.settings.homeCommunity) value.settings.homeCommunities = [value.settings.homeCommunity];
  value.settings.homeCommunity = value.settings.homeCommunities[0] || "";
  value.settings.communityLogos ??= {};
  value.settings.communityLogoUrls ??= {};
  if (!value.settings.communityLogos || typeof value.settings.communityLogos !== "object" || Array.isArray(value.settings.communityLogos)) value.settings.communityLogos = {};
  if (!value.settings.communityLogoUrls || typeof value.settings.communityLogoUrls !== "object" || Array.isArray(value.settings.communityLogoUrls)) value.settings.communityLogoUrls = {};
  value.sources.forEach((src) => {
    if (src && src.logo) {
      const key = normalizeCommunityUrl(src.url);
      if (key && !value.settings.communityLogos[key]) value.settings.communityLogos[key] = src.logo;
      delete src.logo;
    }
  });
  value.posts = Array.isArray(value.posts) ? value.posts : [];
  value.publication = value.publication.filter((p) => p);
  value.posts.forEach((p) => {
    if (p && !p.targetCommunity) p.targetCommunity = value.settings.homeCommunities[0] || "";
  });
  value.settings.postsCount ??= 10;
  value.settings.maxAge ??= 2;
  value.settings.requestPauseSeconds ??= 2;
  value.hashtags ??= [];
  value.emoji ??= [];
  value.templates ??= [];
  return value;
}

export async function load() {
  const x = await browser.storage.local.get("socadmin");
  state.db = normalizeDB(x.socadmin || structuredClone(DEFAULT_DB));
}

export async function save() {
  await browser.storage.local.set({ socadmin: state.db });
}

export function communityLogo(url) {
    const key = normalizeCommunityUrl(url);
    return key ? String(state.db.settings.communityLogos?.[key] || "") : "";
}
export async function fetchCommunityLogo(url) {
  const key = normalizeCommunityUrl(url);
  if (!key) return "";
  const cached = communityLogo(key);
  if (cached) return cached;
  try {
    const result = await browser.runtime.sendMessage({
      type: "fetchCommunityLogo",
      url: key
    });
    if (!result?.ok || !result.dataUrl) return "";
    state.db.settings.communityLogos[key] = result.dataUrl;
    if (result.imageUrl) state.db.settings.communityLogoUrls[key] = result.imageUrl;
    return result.dataUrl;
  } catch (_) {
    return "";
  }
}
export function settingsExportData() {
  return {
    format: "SocAdmin settings",
    version: 1,
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    sources: structuredClone(state.db.sources || []),
    settings: (() => {
      const settings = structuredClone(state.db.settings || {});
      delete settings.communityLogos;
      settings.communityLogoUrls = structuredClone(state.db.settings?.communityLogoUrls || {});
      return settings;
    })(),
    hashtags: structuredClone(state.db.hashtags || []),
    emoji: structuredClone(state.db.emoji || []),
    templates: structuredClone(state.db.templates || [])
  };
}
export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
export async function exportSettings() {
  downloadTextFile("socadmin-settings.json", JSON.stringify(settingsExportData(), null, 2));
}
export async function importSettings(file) {
  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error("Файл не является корректным JSON.");
  }
  if (!data || typeof data !== "object" || data.format !== "SocAdmin settings" || data.version !== 1) throw new Error("Это не файл настроек SocAdmin или его версия не поддерживается.");
  if (!Array.isArray(data.sources) || !data.settings || typeof data.settings !== "object" || !Array.isArray(data.hashtags) || !Array.isArray(data.emoji) || !Array.isArray(data.templates || [])) throw new Error("Структура файла настроек повреждена.");
  const imported = normalizeDB({
    sources: data.sources,
    settings: {
      ...data.settings,
      communityLogoUrls: structuredClone(data.settings.communityLogoUrls || {})
    },
    hashtags: data.hashtags,
    emoji: data.emoji,
    templates: data.templates || [],
    publication: []
  });
  state.db.sources = imported.sources;
  state.db.settings = imported.settings;
  state.db.hashtags = imported.hashtags;
  state.db.emoji = imported.emoji;
  state.db.templates = imported.templates;
  await fetchMissingCommunityLogos();
  await save();
}