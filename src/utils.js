export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const uid = () => crypto.randomUUID();
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const norm = s => (s || "").replace(/\u00a0/g, " ").replace(/\n[ \t]+/g, "\n").trim();
export const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : fallback;
};
export const isValidVKUrl = url => /^https:\/\/vk\.(ru|com)\//i.test(String(url || ""));

export function setHTML(el, html) {
  const doc = new DOMParser().parseFromString(String(html ?? ""), "text/html");
  el.replaceChildren(...Array.from(doc.body.childNodes));
}

export function faIcon(type) {
  // SVG paths string mapping
}

export function normalizeCommunityUrl(url){
  try{
    const u=new URL(String(url||""));
    if(!/^vk\.(ru|com)$/i.test(u.hostname))return "";
    u.hash=""; u.search=""; u.hostname=u.hostname.toLowerCase();
    u.pathname=u.pathname.replace(/\/+$/,"/");
    return u.href.replace(/\/$/,"");
  }catch(_){return "";}
}