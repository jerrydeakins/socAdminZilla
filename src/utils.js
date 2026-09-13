import { icon } from "@fortawesome/fontawesome-svg-core";
import {
  faCheck,
  faPenToSquare,
  faImage,
  faFont,
  faTrash,
  faWandMagicSparkles,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";

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

const FONT_AWESOME_ICONS = {
  check: faCheck,
  edit: faPenToSquare,
  image: faImage,
  text: faFont,
  trash: faTrash,
  wand: faWandMagicSparkles,
  xmark: faXmark,
};

export function faIcon(type) {
  const definition = FONT_AWESOME_ICONS[type];
  if (!definition) return "";
  return icon(definition, {
    classes: ["sa-icon"],
    attributes: { "aria-hidden": "true" },
  }).html.join("");
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