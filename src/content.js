import { state, ROOT_ID } from './state.js';
import { load } from './storage.js';
import { render, positionPanel, alignVKHeader, mountRoot, renderPanel } from './ui.js';
import { waitForCommunityAvatar, waitForPostContent, collectInThisTab } from './scraper.js';
import { isValidVKUrl, clampInt } from './utils.js';

if (window.top === window.self) {
  browser.runtime.onMessage.addListener(async msg => {
    if (!msg) return;
    if (msg.type === "toggleSocAdmin") {
      state.open = !state.open;
      render();
      if (state.open) renderPanel();
    }
    if (msg.type === "scanOnce") return { ok: true, url: location.href };
    if (msg.type === "getCommunityAvatarUrl") return { ok: true, url: await waitForCommunityAvatar() };
  });

  window.addEventListener("resize", () => { if (state.open) positionPanel(); });

  const mountObserver = new MutationObserver(() => {
    const root = document.getElementById(ROOT_ID);
    const header = document.getElementById("page_header_cont");
    alignVKHeader();
    const parent = header?.parentElement || document.querySelector(".layoutWrapper_root");
    if (!root || (parent && root.parentElement !== parent)) render();
    else if (header && root.nextElementSibling !== header) mountRoot(root);
  });
  
  mountObserver.observe(document.body, { childList: true, subtree: true });

  async function resumePendingCollection() {
    const pending = (await browser.storage.local.get("socadminCollection")).socadminCollection;
    if (!pending) return;
    if (Date.now() - Number(pending.startedAt || 0) > 6e5) {
      await browser.storage.local.remove("socadminCollection");
      return;
    }
    if (!isValidVKUrl(pending.sourceUrl)) return;
    const current = location.href.split("#")[0].replace(/\/$/, "");
    const source = String(pending.sourceUrl).split("#")[0].replace(/\/$/, "");
    let sameSource = current === source;
    if (!sameSource) try {
      const curUrl = new URL(current);
      const srcUrl = new URL(source);
      sameSource = /^vk\.(ru|com)$/i.test(curUrl.hostname) && /^vk\.(ru|com)$/i.test(srcUrl.hostname);
    } catch {
      sameSource = false;
    }
    if (!sameSource) return;
    state.open = false;
    render();
    try {
      await waitForPostContent(15e3);
      const posts = await collectInThisTab({
        count: clampInt(pending.count, 1, 25, 10),
        maxAgeDays: clampInt(pending.maxAgeDays, 0, 2, 2)
      });
      state.db.posts = state.db.posts.filter((existing) => !posts.some((incoming) => (existing.id || existing.post_id || existing.url) === (incoming.id || incoming.post_id || incoming.url))).concat(posts.map((p) => ({
        ...p,
        targetCommunity: p.targetCommunity || String((state.db.settings.homeCommunities || [])[0] || state.db.settings.homeCommunity || "").trim()
      })));
      await save();
      await browser.storage.local.remove("socadminCollection");
      const home = String(pending.homeUrl || state.db.settings.homeCommunity || "").trim();
      if (isValidVKUrl(home)) {
        if (home.split("#")[0].replace(/\/$/, "") !== current) {
          await browser.storage.local.set({ socadminReturn: {
            homeUrl: home,
            tab: "moderation",
            createdAt: Date.now()
          } });
          location.href = home;
          return;
        }
      }
      state.active = "moderation";
      state.open = true;
      render();
      renderPanel();
    } catch (error) {
      await browser.storage.local.remove("socadminCollection");
      state.open = true;
      state.active = "posts";
      render();
      renderPanel();
      const status = document.getElementById("sa-status");
      if (status) status.textContent = " Ошибка сбора: " + (error?.message || String(error));
    }
  }
  async function resumeReturnNavigation() {
    const pending = (await browser.storage.local.get("socadminReturn")).socadminReturn;
    if (!pending) return;
    if (Date.now() - Number(pending.createdAt || 0) > 6e5) {
      await browser.storage.local.remove("socadminReturn");
      return;
    }
    const home = String(pending.homeUrl || "").trim();
    if (!isValidVKUrl(home)) {
      await browser.storage.local.remove("socadminReturn");
      return;
    }
    if (location.href.split("#")[0].replace(/\/$/, "") !== home.split("#")[0].replace(/\/$/, "")) return;
    await browser.storage.local.remove("socadminReturn");
    state.active = pending.tab || "moderation";
    state.open = true;
    render();
    renderPanel();
  }

  (async () => {
    await load();
    render();
    await resumePendingCollection();
    await resumeReturnNavigation();
  })();
}