export const ROOT_ID = "socadmin-root";

export const state = {
  open: false,
  active: "posts",
  db: { sources: [], posts: [], settings: { maxAge: 2 }, hashtags: [], emoji: [], templates: [] },
  selectedSource: null,
  selectedPost: null,
  selectedPosts: [],
  job: null
};

export const DEFAULT_DB = {
  sources: [], posts: [], publication: [],
  settings: { homeCommunities: [], homeCommunity: "", postsCount: 10, maxAge: 2, requestPauseSeconds: 2 },
  hashtags: [], emoji: [], templates: []
};