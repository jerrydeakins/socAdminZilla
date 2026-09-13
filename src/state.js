export const ROOT_ID = "socadmin-root";

export const state = {
  open: false,
  active: "posts",
  db: {
    sources: [],
    posts: [],
    settings: { maxAge: 2 },
    hashtags: [],
    emoji: [],
    templates: []
  },
  selectedSource: null,
  selectedPost: null,
  job: null
};

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export const uid = () => crypto.randomUUID();

export const esc = s =>
  String(s ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c])
  );

export function setHTML(el, html) {
  const doc = new DOMParser().parseFromString(
    String(html ?? ""),
    "text/html"
  );
  el.replaceChildren(...Array.from(doc.body.childNodes));
}

export const norm = s =>
  (s || "")
    .replace(/\u00a0/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();

export const DEFAULT_DB = {
  sources: [],
  posts: [],
  publication: [],
  archive: [],
  settings: {
    maxAge: 2,
    homeCommunities: []
  },
  hashtags: [],
  emoji: [],
  templates: []
};
