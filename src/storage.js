import { state, DEFAULT_DB } from "./state.js";

export function normalizeDB(db) {
  const value = db || {};

  const sources = Array.isArray(value.sources)
    ? value.sources.map(src => {
        const item = { ...src };
        const key = normalizeCommunityUrl(item.url);

        if (!item.logo && value.settings?.communityLogos?.[key]) {
          item.logo = value.settings.communityLogos[key];
        }

        return item;
      })
    : [];

  const posts = Array.isArray(value.posts)
    ? value.posts.map(post => ({ ...post }))
    : [];

  const settings = {
    ...DEFAULT_DB.settings,
    ...(value.settings || {})
  };

  if (!Array.isArray(settings.homeCommunities)) {
    settings.homeCommunities = [];
  }

  if (settings.homeCommunity && !settings.homeCommunities.includes(settings.homeCommunity)) {
    settings.homeCommunities.unshift(settings.homeCommunity);
  }

  settings.homeCommunities = settings.homeCommunities
    .filter(Boolean)
    .map(x => String(x).trim())
    .filter(Boolean);

  settings.homeCommunity = settings.homeCommunities[0] || "";

  if (!settings.communityLogos || typeof settings.communityLogos !== "object") {
    settings.communityLogos = {};
  }

  if (!settings.communityLogoUrls || typeof settings.communityLogoUrls !== "object") {
    settings.communityLogoUrls = {};
  }

  if (!Array.isArray(value.publication)) {
    value.publication = [];
  }

  if (!Array.isArray(value.archive)) {
    value.archive = [];
  }

  return {
    ...DEFAULT_DB,
    ...value,
    sources,
    posts,
    publication: Array.isArray(value.publication) ? value.publication : [],
    archive: Array.isArray(value.archive) ? value.archive : [],
    settings,
    hashtags: Array.isArray(value.hashtags) ? value.hashtags : [],
    emoji: Array.isArray(value.emoji) ? value.emoji : [],
    templates: Array.isArray(value.templates) ? value.templates : []
  };
}

export async function load() {
  const x = await browser.storage.local.get("socadmin");
  state.db = normalizeDB(x.socadmin);
}

export async function save() {
  await browser.storage.local.set({ socadmin: state.db });
}

export function normalizeCommunityUrl(url) {
  try {
    const u = new URL(String(url || ""));
    if (!/^https?:$/.test(u.protocol)) return "";
    if (!/^vk\.(ru|com)$/i.test(u.hostname)) return "";
    u.hash = "";
    u.search = "";
    u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString();
  } catch {
    return "";
  }
}
