import { SVG_ICONS } from "virtual:svg-icons";

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const uid = () => crypto.randomUUID();
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const norm = s => (s || "").replace(/\u00a0/g, " ").replace(/\n[ \t]+/g, "\n").trim();
export const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : fallback;
};
export const isValidVKUrl = url => /^https:\/\/vk\.(ru|com)\//i.test(String(url || ""));

export const postKey = (post) =>
  String(post?.id || post?.post_id || post?.url || "");

export const publicationPreviewText = (post) => {
  const text = String(post?.text || "").replace(/\s+/g, " ").trim();
  return text || "(без текста)";
};
  
export function setHTML(el, html) {
  const doc = new DOMParser().parseFromString(String(html ?? ""), "text/html");
  el.replaceChildren(...Array.from(doc.body.childNodes));
}

export function faIcon(type) {
  const svg = SVG_ICONS[type];
  if (!svg) return "";

  return svg.replace(
    /<svg\b([^>]*)>/i,
    (_, attributes) => {
      let attrs = attributes;

      if (/\bclass\s*=/i.test(attrs)) {
        attrs = attrs.replace(
          /\bclass\s*=\s*(["'])(.*?)\1/i,
          (_, quote, classes) => `class=${quote}${classes} sa-icon${quote}`
        );
      } else {
        attrs += ' class="sa-icon"';
      }

      if (!/\baria-hidden\s*=/i.test(attrs)) {
        attrs += ' aria-hidden="true"';
      }

      return `<svg${attrs}>`;
    }
  );
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