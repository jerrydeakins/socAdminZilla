(() => {
  if(window.top!==window.self) return;
  const ROOT_ID="socadmin-root";
  const state={open:false,active:"posts",db:{sources:[],posts:[],settings:{maxAge:2},hashtags:[],emoji:[],templates:[]},selectedSource:null,selectedPost:null,job:null};

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const uid=()=>crypto.randomUUID();
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function setHTML(el,html){
    const doc=new DOMParser().parseFromString(String(html??""),"text/html");
    el.replaceChildren(...Array.from(doc.body.childNodes));
  }
  const norm=s=>(s||"").replace(/\u00a0/g," ").replace(/\n[ \t]+/g,"\n").trim();

  const DEFAULT_DB={
    sources:[],
    posts:[],
    publication:[],
    settings:{homeCommunities:[],homeCommunity:"",postsCount:10,maxAge:2,requestPauseSeconds:2},
    hashtags:[],
    emoji:[],
    templates:[]
  };

  function normalizeDB(db){
    const value=db||{};
    value.sources??=[];
    value.posts??=[];
    value.publication??=[];
    if(!Array.isArray(value.publication)) value.publication=[];
    value.settings??={};
    value.settings.homeCommunities??=[];
    if(!Array.isArray(value.settings.homeCommunities)) value.settings.homeCommunities=[];
    if(!value.settings.homeCommunities.length && value.settings.homeCommunity) value.settings.homeCommunities=[value.settings.homeCommunity];
    value.settings.homeCommunity=value.settings.homeCommunities[0]||"";
    value.settings.communityLogos??={};
    value.settings.communityLogoUrls??={};
    if(!value.settings.communityLogos || typeof value.settings.communityLogos!=="object" || Array.isArray(value.settings.communityLogos)) value.settings.communityLogos={};
    if(!value.settings.communityLogoUrls || typeof value.settings.communityLogoUrls!=="object" || Array.isArray(value.settings.communityLogoUrls)) value.settings.communityLogoUrls={};
    value.sources.forEach(src=>{
      if(src && src.logo){
        const key=normalizeCommunityUrl(src.url);
        if(key && !value.settings.communityLogos[key]) value.settings.communityLogos[key]=src.logo;
        delete src.logo;
      }
    });
    value.posts=Array.isArray(value.posts)?value.posts:[];
    value.publication=value.publication.filter(p=>p);
    value.posts.forEach(p=>{if(p && !p.targetCommunity)p.targetCommunity=value.settings.homeCommunities[0]||"";});
    value.settings.postsCount??=10;
    value.settings.maxAge??=2;
    value.settings.requestPauseSeconds??=2;
    value.hashtags??=[];
    value.emoji??=[];
    value.templates??=[];
    return value;
  }

  async function load(){
    const x=await browser.storage.local.get("socadmin");
    state.db=normalizeDB(x.socadmin||structuredClone(DEFAULT_DB));
  }
  async function save(){await browser.storage.local.set({socadmin:state.db});}

  function normalizeCommunityUrl(url){
    try{
      const u=new URL(String(url||""));
      if(!/^vk\.(ru|com)$/i.test(u.hostname))return "";
      u.hash=""; u.search=""; u.hostname=u.hostname.toLowerCase();
      u.pathname=u.pathname.replace(/\/+$/,"/");
      return u.href.replace(/\/$/,"");
    }catch(_){return "";}
  }

  function communityLogo(url){
    const key=normalizeCommunityUrl(url);
    return key ? String(state.db.settings.communityLogos?.[key]||"") : "";
  }

  async function fetchCommunityLogo(url){
    const key=normalizeCommunityUrl(url);
    if(!key)return "";
    const cached=communityLogo(key);
    if(cached)return cached;
    try{
      const result=await browser.runtime.sendMessage({type:"fetchCommunityLogo",url:key});
      if(!result?.ok || !result.dataUrl)return "";
      state.db.settings.communityLogos[key]=result.dataUrl;
      if(result.imageUrl) state.db.settings.communityLogoUrls[key]=result.imageUrl;
      return result.dataUrl;
    }catch(_){return "";}
  }

  function settingsExportData(){
    return {
      format:"SocAdmin settings",
      version:1,
      exportedAt:new Date().toISOString(),
      sources:structuredClone(state.db.sources||[]),
      settings:(()=>{const settings=structuredClone(state.db.settings||{});delete settings.communityLogos;settings.communityLogoUrls=structuredClone(state.db.settings?.communityLogoUrls||{});return settings;})(),
      hashtags:structuredClone(state.db.hashtags||[]),
      emoji:structuredClone(state.db.emoji||[]),
      templates:structuredClone(state.db.templates||[])
    };
  }

  function downloadTextFile(filename,text){
    const blob=new Blob([text],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=filename;a.style.display="none";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function exportSettings(){
    downloadTextFile("socadmin-settings.json",JSON.stringify(settingsExportData(),null,2));
  }

  async function fetchMissingCommunityLogos(){
    const urls=[];
    const seen=new Set();
    for(const item of (state.db.sources||[])){
      const key=normalizeCommunityUrl(item.url);
      if(key && !communityLogo(key) && !seen.has(key)){seen.add(key);urls.push(key);}
    }
    for(const url of (state.db.settings.homeCommunities||[])){
      const key=normalizeCommunityUrl(url);
      if(key && !communityLogo(key) && !seen.has(key)){seen.add(key);urls.push(key);}
    }
    for(const key of urls) await fetchCommunityLogo(key);
  }

  async function importSettings(file){
    const text=await file.text();
    let data;
    try{data=JSON.parse(text);}catch(_){throw new Error("Файл не является корректным JSON.");}
    if(!data || typeof data!=="object" || data.format!=="SocAdmin settings" || data.version!==1){
      throw new Error("Это не файл настроек SocAdmin или его версия не поддерживается.");
    }
    if(!Array.isArray(data.sources) || !data.settings || typeof data.settings!=="object" ||
       !Array.isArray(data.hashtags) || !Array.isArray(data.emoji) || !Array.isArray(data.templates||[])){
      throw new Error("Структура файла настроек повреждена.");
    }
    const imported=normalizeDB({
      sources:data.sources,
      settings:{...data.settings,communityLogoUrls:structuredClone(data.settings.communityLogoUrls||{})},
      hashtags:data.hashtags,
      emoji:data.emoji,
      templates:data.templates||[],
      publication:[]
    });
    state.db.sources=imported.sources;
    state.db.settings=imported.settings;
    state.db.hashtags=imported.hashtags;
    state.db.emoji=imported.emoji;
    state.db.templates=imported.templates;
    // Publication queue is operational data and is intentionally not imported.
    // Imported settings may not contain the local logo cache, so fetch missing
    // community avatars once during import. Already cached logos are skipped.
    await fetchMissingCommunityLogos();
    await save();
  }

  function style(){
    if(document.getElementById("socadmin-style"))return;
    const s=document.createElement("style");s.id="socadmin-style";
    s.textContent=`
#socadmin-root{position:fixed;left:0;top:0;width:100%;z-index:120;font:13px system-ui,sans-serif;color:#222;box-sizing:border-box}
#socadmin-bar{height:40px;display:flex;align-items:center;gap:2px;padding:0 8px;background:rgba(255,255,255,.50);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid rgba(0,0,0,.14);box-shadow:0 2px 8px #0002}
#socadmin-brand{font-weight:800;padding:0 10px}
.sa-tab{border:0;background:transparent;padding:7px 10px;border-radius:6px;cursor:pointer}.sa-tab:hover,.sa-tab.active{background:rgba(0,0,0,.08);font-weight:700}
#socadmin-collapse{margin-left:auto;border:0;background:transparent;padding:7px 10px;cursor:pointer;font-size:15px}
#socadmin-collapse:hover{background:rgba(0,0,0,.08);border-radius:6px}
#socadmin-panel{display:none;position:fixed;z-index:10000;width:min(1000px,calc(100vw - 16px));max-height:calc(100vh - 58px);overflow:auto;background:rgba(255,255,255,.50);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid rgba(0,0,0,.10);border-radius:0 0 10px 10px;box-shadow:0 8px 30px #0003;padding:10px}
#socadmin-panel.open{display:block}
#socadmin-panel.sa-posts-panel{width:890px;box-sizing:border-box}#socadmin-panel.sa-publication-panel{width:322px;box-sizing:border-box;overflow-x:hidden}#socadmin-panel.sa-publication-panel .sa-panel{width:100%;box-sizing:border-box;overflow-x:hidden}
.sa-grid{display:grid;grid-template-columns:360px 500px;gap:8px;align-items:start}.sa-mod-grid{display:grid;grid-template-columns:460px 500px;gap:8px;align-items:start}.sa-mod-list{max-height:calc(100vh - 150px);overflow:auto}.sa-editor{min-height:0}.sa-editor-images{display:flex;flex-wrap:wrap;gap:8px;margin:7px 0}.sa-editor-image{position:relative}.sa-editor-image img{display:block;max-width:150px;max-height:150px;object-fit:cover;border-radius:6px}.sa-editor-image button{position:absolute;right:3px;top:3px}.sa-empty{padding:12px;text-align:center}.sa-card-preview{display:flex;gap:8px;align-items:flex-start}.sa-card-thumb{width:92px;height:72px;flex:0 0 92px;object-fit:cover;border-radius:6px}.sa-card-preview-text{min-width:0}.sa-card-preview-text .sa-text{display:block;overflow:hidden}.sa-panel{min-height:0;background:rgba(250,250,250,.40);border:1px solid rgba(0,0,0,.10);border-radius:8px;padding:8px;min-width:0}.sa-title{font-weight:700;margin-bottom:7px}.sa-list{display:flex;flex-direction:column;gap:5px;max-height:calc(100vh - 150px);overflow:auto}.sa-publication-list{flex-direction:column;flex-wrap:nowrap;gap:10px;align-items:flex-start;max-height:none;overflow:visible}.sa-chip-list{display:flex;flex-wrap:wrap;gap:5px;align-items:center}.sa-pub-card{position:relative;padding:0;overflow:hidden;width:280px;box-sizing:border-box}.sa-pub-card.sa-auto-active::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,.58);z-index:20}.sa-auto-confirm{position:absolute;inset:0;z-index:21;display:flex;align-items:center;justify-content:center;gap:8px;pointer-events:none}.sa-auto-confirm[hidden]{display:none!important}.sa-auto-confirm button{pointer-events:auto;border:0;border-radius:6px;width:42px;height:34px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#fff;box-shadow:0 2px 7px #0006}.sa-auto-confirm .sa-auto-ok{background:rgba(78,145,91,.92)}.sa-auto-confirm .sa-auto-ok:hover{background:rgba(66,130,79,.96)}.sa-auto-confirm .sa-auto-cancel{background:rgba(174,78,78,.92)}.sa-auto-confirm .sa-auto-cancel:hover{background:rgba(155,63,63,.96)}.sa-auto-confirm .sa-icon{width:17px;height:17px}.sa-pub-head{display:flex;align-items:center;gap:8px;padding:8px 9px;font-size:11px;font-weight:600}.sa-pub-sep{opacity:.5}.sa-pub-image{display:block;width:100%;max-height:360px;object-fit:contain;background:rgba(0,0,0,.04)}.sa-pub-body{padding:10px}.sa-pub-text{white-space:pre-wrap;line-height:1.45}.sa-pub-actions{display:flex;flex-direction:column;gap:7px;padding:8px 9px;border-top:1px solid rgba(0,0,0,.10)}.sa-pub-auto-row{display:flex;width:100%;justify-content:center}.sa-auto-btn{border:0;border-radius:7px;min-height:34px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;color:#fff;background:#69b97a;box-shadow:0 1px 2px #0002;font-weight:600;transition:transform .08s ease,background .15s ease,box-shadow .15s ease}.sa-auto-btn:hover{background:#5eab6e;box-shadow:0 2px 6px #0002}.sa-auto-btn:active{transform:translateY(1px)}.sa-auto-btn .sa-icon{width:15px;height:15px}.sa-pub-actions-left{display:flex;align-items:center;gap:6px}.sa-pub-button-row{display:flex;align-items:center;width:100%;gap:6px}.sa-pub-button-row>.sa-action-red{margin-left:auto}.sa-action-blue,.sa-action-orange,.sa-action-red{border:0;border-radius:6px;width:36px;height:34px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#fff}.sa-action-blue{background:#5b9bd5}.sa-action-orange{background:#e7a34b}.sa-action-red{background:#d96b6b}.sa-action-blue:hover{background:#4c8fc9}.sa-action-orange:hover{background:#db9436}.sa-action-red:hover{background:#c95b5b}.sa-icon{width:16px;height:16px;fill:currentColor}.sa-pub-actions>[data-pub-status]{min-height:16px;font-size:11px}
.sa-queued{border-color:#e7a34b!important;box-shadow:0 0 0 1px rgba(231,163,75,.25)}.sa-queued-note{margin-top:5px;font-size:11px;font-weight:700;color:#b36b12}.sa-card{border:1px solid #ddd;border-radius:7px;padding:7px;background:rgba(255,255,255,.40);cursor:pointer}.sa-source-card{display:flex;align-items:center;padding:8px 10px;min-height:72px}.sa-source-logo-wrap{flex:0 0 auto;display:flex;align-items:center;justify-content:center;padding-right:16px}.sa-source-logo,.sa-source-logo-placeholder{width:48px;height:48px;border-radius:50%;object-fit:cover}.sa-source-logo-placeholder{display:flex;align-items:center;justify-content:center;background:rgba(128,128,128,.18);font-size:13px;font-weight:800;color:#777}.sa-source-info{min-width:0;display:flex;flex-direction:column;gap:3px;justify-content:center}.sa-images{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.sa-images img{display:block;max-width:180px;max-height:180px;width:auto;height:auto;object-fit:cover;border-radius:6px}.sa-card.selected{border-color:#1677ff}.sa-meta{font-size:10px;font-weight:700;color:#666;margin-bottom:3px}.sa-text{font-size:14px;white-space:pre-wrap}.sa-row{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0}.sa-input,.sa-textarea,.sa-select{width:100%;box-sizing:border-box;border:1px solid #c8ccd1;border-radius:6px;padding:7px;background:#fff}.sa-textarea{min-height:264px;width:100%;max-width:100%;box-sizing:border-box;resize:vertical;font-size:14px}.sa-editor{overflow:hidden}.sa-editor-tools{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0}.sa-tool-arrow{display:inline-block;margin-left:5px;font-size:11px;opacity:.75}.sa-image-add-row{display:flex;gap:6px;align-items:center;width:100%}.sa-image-add-row .sa-input{flex:1;min-width:0}.sa-add-image-btn{width:36px;height:36px;min-width:36px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:#72b886;color:#fff;cursor:pointer;box-shadow:0 1px 2px #0002}.sa-add-image-btn:hover{background:#63aa78}.sa-add-image-btn svg{width:15px;height:15px;fill:currentColor}.sa-tool-pop{display:none;position:absolute;z-index:10002;max-width:420px;max-height:220px;overflow:auto;padding:7px;border:1px solid #aaa;border-radius:7px;background:rgba(255,255,255,.96);box-shadow:0 8px 24px #0003}.sa-tool-pop.open{display:flex;gap:4px;flex-wrap:wrap}.sa-tool-item{cursor:pointer}.sa-editor-tools-wrap{position:relative}.sa-btn{border:1px solid #c8ccd1;border-radius:6px;padding:7px 9px;background:#f3f5f7;cursor:pointer}.sa-danger{color:#a51c1c}.sa-muted{color:#70757d}
@media(max-width:1000px){.sa-grid,.sa-mod-grid{grid-template-columns:1fr}#socadmin-panel{width:calc(100vw - 16px)}}@media(prefers-color-scheme:dark){
#socadmin-root{color:#f1f3f5}
#socadmin-bar{background:rgba(25,26,28,.50);border-color:#555;box-shadow:0 2px 10px #0008}
#socadmin-brand{color:#fff}
.sa-tab{color:#f1f3f5}
.sa-tab:hover,.sa-tab.active{background:#3a3c40;color:#fff}
#socadmin-collapse{color:#f1f3f5}
#socadmin-collapse:hover{background:rgba(255,255,255,.12)}
#socadmin-panel{background:rgba(28,29,31,.50);border-color:rgba(255,255,255,.18);box-shadow:0 10px 35px #0009}
.sa-panel{min-height:0;background:rgba(36,38,41,.40);border-color:rgba(255,255,255,.14)}
.sa-card{background:rgba(46,48,51,.40);border-color:rgba(255,255,255,.14);color:#f1f3f5}
.sa-card.selected{border-color:#4c9cff}
.sa-meta{color:#b9bec6}
.sa-muted{color:#b0b5bd}
.sa-input,.sa-textarea,.sa-select{background:#1d1f21;color:#f1f3f5;border-color:#555}
.sa-input::placeholder,.sa-textarea::placeholder{color:#8d949d}
.sa-btn{background:#3a3d41;color:#f1f3f5;border-color:#5a5e63}
.sa-btn:hover{background:#484c51}
.sa-danger{color:#ff8a8a}
}
`;
    document.documentElement.appendChild(s);
  }

  function alignVKHeader(){
    const header=document.getElementById("page_header_cont");
    if(!header)return;
    // VK's header is fixed at top:0 and otherwise covers our in-flow toolbar.
    // Keep it below the 40px SocAdmin toolbar.
    header.style.setProperty("top","40px","important");
  }

  function mountRoot(root){
    const header=document.getElementById("page_header_cont");
    alignVKHeader();
    const preferred=header?.parentElement || document.querySelector(".layoutWrapper_root");
    const fallback=document.getElementById("page_layout") || document.body;
    const parent=preferred || fallback;
    if(!parent)return;

    if(header && header.parentElement===parent){
      if(root.parentElement!==parent || root.nextElementSibling!==header){
        parent.insertBefore(root,header);
      }
    }else if(root.parentElement!==parent){
      parent.insertBefore(root,parent.firstChild);
    }
  }

  function removePanel(){
    const p=document.getElementById("socadmin-panel");
    if(p)p.remove();
  }

  function positionPanel(){
    const bar=document.getElementById("socadmin-bar");
    const panel=document.getElementById("socadmin-panel");
    if(!bar||!panel)return;
    const r=bar.getBoundingClientRect();
    panel.style.left=`${Math.max(8,r.left)}px`;
    panel.style.top=`${r.bottom}px`;
  }

  function createPanel(){
    if(!state.open)return;
    removePanel();
    const panel=document.createElement("div");
    panel.id="socadmin-panel";
    panel.className="open";
    document.body.appendChild(panel);
    positionPanel();
  }

  function render(){
    style();
    let root=document.getElementById(ROOT_ID);
    if(!root){root=document.createElement("div");root.id=ROOT_ID;}
    mountRoot(root);
    removePanel();
    setHTML(root,`
      <div id="socadmin-bar">
        <span id="socadmin-brand">SocAdmin</span>
        ${["posts","moderation","publication","archive","settings"].map((x,i)=>`<button class="sa-tab ${state.open&&state.active===x?"active":""}" data-tab="${x}">${["Посты","Модерация","Публикация","Архив","Настройки"][i]}</button>`).join("")}
        <button id="socadmin-collapse" title="Свернуть">⌃</button>
      </div>`);
    root.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{
      const tab=b.dataset.tab;
      if(state.open && state.active===tab){
        state.open=false;
        render();
        return;
      }
      state.active=tab;
      state.open=true;
      render();
      renderPanel();
    });
    root.querySelector("#socadmin-collapse").onclick=()=>{state.open=!state.open;render();if(state.open)renderPanel();};
    if(state.open){createPanel();renderPanel();}
  }

  function panelShell(content){
    const p=document.getElementById("socadmin-panel");
    if(p){
      p.classList.toggle("sa-publication-panel",state.active==="publication");
      p.classList.toggle("sa-posts-panel",state.active==="posts");
      setHTML(p,content);
      positionPanel();
    }
  }

  function renderPanel(){
    if(state.active==="posts") renderPostsPanel();
    if(state.active==="moderation") renderModerationPanel();
    if(state.active==="publication") renderPublicationPanel();
    if(state.active==="archive") renderArchivePanel();
    if(state.active==="settings") renderSettingsPanel();
  }

  function renderPostsPanel(){
    panelShell(`<div class="sa-grid">
      <div class="sa-panel"><div class="sa-title">Источники</div><div id="sa-sources" class="sa-list"></div>
        <div class="sa-row"><input id="sa-source-url" class="sa-input" placeholder="https://vk.ru/community"></div>
        <button id="sa-add-source" class="sa-btn">Добавить источник</button>
      </div>
      <div class="sa-panel"><div class="sa-title">Посты</div>
        <div class="sa-row"><input id="sa-limit" class="sa-input" type="number" min="1" max="25" value="${Number(state.db.settings.postsCount??10)}"></div>
        <button id="sa-fetch" class="sa-btn">Получить посты</button>
        <span id="sa-status" class="sa-muted"></span>
        <div id="sa-feed" class="sa-list" style="margin-top:7px"></div>
      </div>
    </div>`);
    const sources=document.getElementById("sa-sources");
    setHTML(sources,state.db.sources.map(s=>{const logo=communityLogo(s.url);return `<div class="sa-card sa-source-card ${state.selectedSource===s.id?"selected":""}" data-source="${s.id}"><div class="sa-source-logo-wrap">${logo?`<img class="sa-source-logo" src="${esc(logo)}" alt="">`:`<div class="sa-source-logo-placeholder">VK</div>`}</div><div class="sa-source-info"><div class="sa-meta">${esc(s.name||s.alias)}</div><div class="sa-muted">${esc(s.url)}</div></div></div>`}).join(""));
    sources.querySelectorAll("[data-source]").forEach(x=>x.onclick=()=>{state.selectedSource=x.dataset.source;renderPostsPanel();});
    document.getElementById("sa-add-source").onclick=async()=>{
      let u=document.getElementById("sa-source-url").value.trim();
      if(!/^https:\/\/vk\.(ru|com)\//i.test(u)){alert("Разрешены только https://vk.ru/... и https://vk.com/...");return;}
      const s={id:uid(),url:u,name:u.replace(/^https:\/\/vk\.(ru|com)\//i,"").replace(/\/.*$/,""),alias:u};
      state.db.sources.push(s);state.selectedSource=s.id;await fetchCommunityLogo(u);await save();renderPostsPanel();
    };
    document.getElementById("sa-fetch").onclick=startFetch;
    renderFeed([]);
  }

  function renderImages(images){
    if(!Array.isArray(images)||!images.length)return "";
    return `<div class="sa-images">${images.map(img=>{
      const src=typeof img==="string"?img:img?.src;
      if(!src)return "";
      return `<img src="${esc(src)}" alt="${esc(typeof img==="string"?"":img?.alt||"")}" loading="lazy">`;
    }).join("")}</div>`;
  }

  function renderFeed(posts){
    const box=document.getElementById("sa-feed");if(!box)return;
    setHTML(box,(posts||[]).map(p=>`<div class="sa-card"><div class="sa-meta">${esc(p.author)} · ${esc(p.date)}</div><div class="sa-text">${esc(p.text||"(без текста)")}</div>${renderImages(p.images)}</div>`).join(""));
  }

  function clampInt(value,min,max,fallback){
    const n=Number(value);
    return Number.isFinite(n)?Math.max(min,Math.min(max,Math.trunc(n))):fallback;
  }

  function isValidVKUrl(url){
    return /^https:\/\/vk\.(ru|com)\//i.test(String(url||""));
  }

  async function startFetch(){
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

    // Collection is now performed by the content script in the current VK
    // tab. No background job and no extra collector tab are created.
    location.href=source.url;
  }


  function postKey(p){ return String(p?.id||p?.post_id||p?.url||""); }

  function renderModerationPreview(p){
    const images=Array.isArray(p.images)?p.images:[];
    const first=images[0]&&(typeof images[0]==="string"?images[0]:images[0]?.src);
    const preview=String(p.text||"(без текста)").replace(/\s+/g," ").trim();
    const short=preview.length>250?preview.slice(0,250)+"…":preview;
    return `<div class="sa-card-preview">${first?`<img class="sa-card-thumb" src="${esc(first)}" loading="lazy">`:``}<div class="sa-card-preview-text"><div class="sa-meta">${esc(p.author)} · ${esc(p.date)}</div><div class="sa-text">${esc(short)}</div></div></div>`;
  }

  function renderModerationEditor(p){
    const panel=document.getElementById("sa-editor");
    if(!panel)return;
    if(!p){setHTML(panel,`<div class="sa-panel sa-empty"><div class="sa-title">Редактор</div><div class="sa-muted">Выбери пост слева.</div></div>`);return;}
    const images=Array.isArray(p.images)?p.images:[];
    setHTML(panel,`<div class="sa-panel sa-editor">
      <div class="sa-title">Редактор поста</div>
      <div class="sa-meta">${esc(p.author)} · ${esc(p.date)}</div>
      <label>Целевое сообщество<select id="sa-target-community" class="sa-select">${(state.db.settings.homeCommunities||[]).map(x=>`<option value="${esc(x)}" ${x===String(p.targetCommunity||"")?"selected":""}>${esc(x)}</option>`).join("")}</select></label>
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
      <textarea id="sa-edit-text" class="sa-textarea">${esc(p.text||"")}</textarea>
      <div class="sa-title" style="margin-top:9px">Изображения</div>
      <div id="sa-edit-images" class="sa-editor-images">${images.map((img,i)=>{const src=typeof img==="string"?img:img?.src; if(!src)return ""; return `<div class="sa-editor-image"><img src="${esc(src)}" loading="lazy"><button class="sa-btn sa-danger" data-del-img="${i}" title="Удалить изображение">×</button></div>`;}).join("")}</div>
      <div class="sa-image-add-row"><input id="sa-add-image-url" class="sa-input" placeholder="URL изображения"><button id="sa-add-image" class="sa-add-image-btn" type="button" title="Добавить изображение" aria-label="Добавить изображение"><svg viewBox="0 0 448 512" aria-hidden="true"><path d="M416 208H272V64c0-17.7-14.3-32-32-32h-32c-17.7 0-32 14.3-32 32v144H32c-17.7 0-32 14.3-32 32v32c0 17.7 14.3 32 32 32h144v144c0 17.7 14.3 32 32 32h32c17.7 0 32-14.3 32-32V304h144c17.7 0 32-14.3 32-32v-32c0-17.7-14.3-32-32-32z"/></svg></button></div>
      <div class="sa-row"><button id="sa-save-post" class="sa-btn">Сохранить</button><button id="sa-publish-post" class="sa-btn">Опубликовать</button><button id="sa-delete-post" class="sa-btn sa-danger">Удалить</button><span id="sa-editor-status" class="sa-muted"></span></div>
    </div>`);
    const textArea=document.getElementById("sa-edit-text");
    const popEmoji=document.getElementById("sa-pop-emoji");
    const popHash=document.getElementById("sa-pop-hashtag");
    const popTpl=document.getElementById("sa-pop-template");
    const toolButtons={emoji:document.getElementById("sa-tool-emoji"),hashtag:document.getElementById("sa-tool-hashtag"),template:document.getElementById("sa-tool-template")};
    const setArrow=(key,open)=>{const arrow=toolButtons[key]?.querySelector(".sa-tool-arrow");if(arrow)arrow.textContent=open?"▲":"▼";};
    const closePops=()=>{[popEmoji,popHash,popTpl].forEach(x=>x.classList.remove("open"));setArrow("emoji",false);setArrow("hashtag",false);setArrow("template",false);};
    const togglePop=(key,pop,items,fn,empty)=>{
      const wasOpen=pop.classList.contains("open");
      closePops();
      if(wasOpen)return;
      fillPop(pop,items,fn,empty);
      pop.classList.add("open");
      setArrow(key,true);
    };
    const insertAtCursor=(value)=>{const start=textArea.selectionStart,end=textArea.selectionEnd;const before=textArea.value.slice(0,start),after=textArea.value.slice(end);textArea.value=before+value+after;textArea.focus();const pos=start+value.length;textArea.setSelectionRange(pos,pos);};
    const fillPop=(pop,items,fn,empty)=>{setHTML(pop,items.length?items.map((x,i)=>`<button type="button" class="sa-btn sa-tool-item" data-tool-item="${i}">${esc(typeof x==="string"?x:(x?.name||x?.text||""))}</button>`).join(""):`<span class="sa-muted">${empty}</span>`);pop.querySelectorAll("[data-tool-item]").forEach(b=>b.onclick=()=>{fn(items[+b.dataset.toolItem]);closePops();});};
    document.getElementById("sa-tool-emoji").onclick=()=>togglePop("emoji",popEmoji,state.db.emoji||[],x=>insertAtCursor(String(x)),"Нет сохранённых emoji");
    document.getElementById("sa-tool-hashtag").onclick=()=>togglePop("hashtag",popHash,state.db.hashtags||[],x=>insertAtCursor((textArea.value && !/[\s]$/.test(textArea.value)?" ":"")+String(x)),"Нет сохранённых хэштегов");
    document.getElementById("sa-tool-template").onclick=()=>togglePop("template",popTpl,state.db.templates||[],x=>insertAtCursor(String(x?.text??x??"")),"Нет сохранённых шаблонов");

    panel.querySelectorAll("[data-del-img]").forEach(b=>b.onclick=async()=>{
      const idx=Number(b.dataset.delImg);
      p.images=(Array.isArray(p.images)?p.images:[]).filter((_,i)=>i!==idx);
      await save(); renderModerationPanel();
    });
    document.getElementById("sa-add-image").onclick=async()=>{
      const input=document.getElementById("sa-add-image-url"); const url=input.value.trim();
      const status=document.getElementById("sa-editor-status");
      if(!url){if(status)status.textContent="Укажи URL изображения.";return;}
      try{new URL(url);}catch(_){if(status)status.textContent="Некорректный URL изображения.";return;}
      p.images=Array.isArray(p.images)?p.images:[];
      if(!p.images.some(img=>(typeof img==="string"?img:img?.src)===url)) p.images.push(url);
      input.value=""; await save(); renderModerationPanel(true);
    };
    document.getElementById("sa-save-post").onclick=async()=>{
      const status=document.getElementById("sa-editor-status");
      p.text=document.getElementById("sa-edit-text").value;
      p.targetCommunity=document.getElementById("sa-target-community")?.value||"";
      await save();
      if(status){status.textContent="Сохранено";setTimeout(()=>{if(status)status.textContent="";},1800);}
    };
    document.getElementById("sa-publish-post").onclick=async()=>{
      const key=postKey(p);
      const exists=(state.db.publication||[]).some(x=>postKey(x)===key);
      if(!exists) state.db.publication.push(structuredClone(p));
      state.selectedPost=key;
      await save();
      renderModerationPanel(true);
      const status=document.getElementById("sa-editor-status");
      if(status){status.textContent="Пост отправлен в публикацию";setTimeout(()=>{if(status)status.textContent="";},2200);}
      const card=document.querySelector(`[data-post="${CSS.escape(key)}"]`);
      if(card){card.classList.add("sa-queued");card.scrollIntoView({block:"nearest"});}
    };
    document.getElementById("sa-delete-post").onclick=async()=>{
      if(!confirm("Удалить этот пост из зоны модерации?"))return;
      const key=postKey(p); state.db.posts=state.db.posts.filter(x=>postKey(x)!==key); state.selectedPost=null; await save(); renderModerationPanel();
    };
  }

  function renderModerationPanel(keepListScroll=true){
    const oldBox=document.getElementById("sa-mod");
    const savedScrollTop=keepListScroll&&oldBox?oldBox.scrollTop:0;
    const items=state.db.posts;
    let selected=items.find(p=>postKey(p)===String(state.selectedPost))||items[0]||null;
    state.selectedPost=selected?postKey(selected):null;
    panelShell(`<div class="sa-mod-grid"><div class="sa-panel"><div class="sa-title">Зона модерации</div><div id="sa-mod" class="sa-list sa-mod-list"></div></div><div id="sa-editor"></div></div>`);
    const box=document.getElementById("sa-mod");
    setHTML(box,items.length?items.map(p=>{
      const key=postKey(p);
      const queued=(state.db.publication||[]).some(x=>postKey(x)===key);
      return `<div class="sa-card ${key===state.selectedPost?"selected":""} ${queued?"sa-queued":""}" data-post="${esc(key)}">${renderModerationPreview(p)}${queued?`<div class="sa-queued-note">✓ Отправлен в публикацию</div>`:""}</div>`;
    }).join(""):`<div class="sa-empty sa-muted">В зоне модерации нет постов.</div>`);
    if(savedScrollTop) box.scrollTop=savedScrollTop;
    box.querySelectorAll("[data-post]").forEach(x=>x.onclick=()=>{state.selectedPost=x.dataset.post;renderModerationPanel(true);});
    renderModerationEditor(selected);
  }
  function faIcon(type){
    const paths={
      text:'<path d="M64 96h320v64H64V96zm0 128h320v64H64v-64zm0 128h224v64H64v-64z"/>',
      image:'<path d="M64 64h320c35.3 0 64 28.7 64 64v256c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128C0 92.7 28.7 64 64 64zm0 64v256h320V128H64zm48 48a48 48 0 1 1 0 96 48 48 0 0 1 0-96zm224 240H112l72-88 48 56 64-80 40 112z"/>',
      edit:'<path d="M402.6 83.2l28.2 28.2c12.5 12.5 12.5 32.8 0 45.3L165.4 422.1 64 448l25.9-101.4L356.7 80c12.5-12.5 32.8-12.5 45.3 0zM128.8 365.5l-9.9 38.6 38.6-9.9L402 149.7 364.3 112 128.8 365.5z"/>',
      trash:'<path d="M160 64h128l16 32h96v64H48V96h96l16-32zm-80 128h320l-16 288c-1.1 19.9-17.6 35.5-37.5 35.5h-213C113.6 515.5 97.1 499.9 96 480L80 192zm112 64h-64l8 192h64l-8-192zm96 0h-64v192h64V256z"/>',
      wand:'<path d="M400 24l24 48 48 24-48 24-24 48-24-48-48-24 48-24zM112 104l16 32 32 16-32 16-16 32-16-32-32-16 32-16zm216 104l12 24 24 12-24 12-12 24-12-24-24-12 24-12zM76 420l260-260 56 56L132 476H76z"/>',
      check:'<path d="M173 439L7 273l90-90 76 76L351 81l90 90z"/>',
      xmark:'<path d="M128 96l128 128 128-128 64 64-128 128 128 128-64 64-128-128-128 128-64-64 128-128L64 160z"/>'
    };
    return `<svg class="sa-icon" viewBox="0 0 448 512" aria-hidden="true">${paths[type]||''}</svg>`;
  }

  function publicationPreviewText(p){
    const text=String(p.text||'').trim();
    return text.length>300?text.slice(0,300)+'…':text;
  }

  function renderPublicationPanel(){
    const items=state.db.publication||[];
    panelShell(`<div class="sa-panel"><div class="sa-title">Публикация</div><div class="sa-muted">Посты, подготовленные к публикации. Кнопки копирования используются как временный способ публикации.</div><div id="sa-publication-list" class="sa-list sa-publication-list" style="margin-top:7px"></div></div>`);
    const box=document.getElementById("sa-publication-list");
    setHTML(box,items.length?items.map(p=>{
      const images=Array.isArray(p.images)?p.images:[];
      const first=images[0]&&(typeof images[0]==='string'?images[0]:images[0]?.src);
      const key=postKey(p);
      return `<div class="sa-card sa-pub-card" data-pub-key="${esc(key)}">
        <div class="sa-auto-confirm" hidden>
          <button class="sa-auto-ok" data-auto-confirm="${esc(key)}" title="Подтвердить" aria-label="Подтвердить">${faIcon('check')}</button>
          <button class="sa-auto-cancel" data-auto-cancel="${esc(key)}" title="Отменить" aria-label="Отменить">${faIcon('xmark')}</button>
        </div>
        <div class="sa-pub-head"><span>${esc(p.date||'')}</span><span class="sa-pub-sep">•</span><span>${esc(p.targetCommunity||'Целевое сообщество не указано')}</span></div>
        ${first?`<img class="sa-pub-image" src="${esc(first)}" loading="lazy">`:''}
        <div class="sa-pub-body"><div class="sa-pub-text">${esc(publicationPreviewText(p)||'(без текста)')}</div></div>
        <div class="sa-pub-actions">
          <div class="sa-pub-auto-row">
            <button class="sa-auto-btn" data-auto-pub="${esc(key)}" title="Автоматически вставить текст и изображения в уже открытый Новый пост" aria-label="Авто">${faIcon('wand')}<span>Авто</span></button>
          </div>
          <div class="sa-pub-button-row">
            <div class="sa-pub-actions-left">
              <button class="sa-action-blue" data-copy-text="${esc(key)}" title="Копировать текст" aria-label="Копировать текст">${faIcon('text')}</button>
              <button class="sa-action-blue" data-copy-image="${esc(key)}" title="Копировать изображение" aria-label="Копировать изображение">${faIcon('image')}</button>
              <button class="sa-action-orange sa-pub-edit" data-pub-edit="${esc(key)}" title="Редактировать" aria-label="Редактировать">${faIcon('edit')}</button>
            </div>
            <button class="sa-action-red" data-pub-del="${esc(key)}" title="Удалить" aria-label="Удалить">${faIcon('trash')}</button>
          </div>
          <span class="sa-muted" data-pub-status="${esc(key)}"></span>
        </div>
      </div>`;
    }).join(''):`<div class="sa-empty sa-muted">Очередь публикации пуста.</div>`);

    box.querySelectorAll('[data-auto-pub]').forEach(b=>b.onclick=async()=>{
      const key=b.dataset.autoPub;
      const p=items.find(x=>postKey(x)===key);
      if(!p)return;
      const status=box.querySelector(`[data-pub-status="${CSS.escape(key)}"]`);
      const setStatus=(text)=>{if(status)status.textContent=text;};
      try{
        const modal=document.querySelector('[data-testid="posting_modal_box"][aria-modal="true"]');
        if(!modal)throw new Error('Открой в VK окно «Новый пост» и повтори.');

        const textField=modal.querySelector('[data-testid="posting_base_screen_input_message"][contenteditable="true"]');
        if(!textField)throw new Error('Не найдено поле текста в окне «Новый пост».');

        textField.focus();
        const text=String(p.text||'');
        textField.replaceChildren();
        const lines=text.split('\n');
        lines.forEach((line,i)=>{
          if(i)textField.appendChild(document.createElement('br'));
          textField.appendChild(document.createTextNode(line));
        });
        textField.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:text}));
        textField.dispatchEvent(new Event('change',{bubbles:true}));

        const images=Array.isArray(p.images)?p.images:[];
        if(images.length){
          const fileInput=modal.querySelector('[data-testid="posting_base_screen_download_from_device"]');
          if(!fileInput)throw new Error('Не найдено поле загрузки изображения в окне «Новый пост».');
          const dt=new DataTransfer();
          let loaded=0;
          for(let i=0;i<images.length;i++){
            const raw=images[i];
            const src=typeof raw==='string'?raw:raw?.src;
            if(!src)continue;
            const result=await browser.runtime.sendMessage({type:"fetchImage",url:src});
            if(!result?.ok)throw new Error(result?.error||"Не удалось получить изображение.");
            const bytes=new Uint8Array(result.bytes);
            const blob=new Blob([bytes],{type:result.type||"image/jpeg"});
            const ext=(blob.type||'image/jpeg').split('/')[1]||'jpg';
            const file=new File([blob],`socadmin-${Date.now()}-${i}.${ext}`,{type:blob.type||'image/jpeg'});
            dt.items.add(file); loaded++;
          }
          if(loaded){
            fileInput.files=dt.files;
            fileInput.dispatchEvent(new Event('input',{bubbles:true}));
            fileInput.dispatchEvent(new Event('change',{bubbles:true}));
          }
        }
        const card=b.closest('.sa-pub-card');
        if(card){card.classList.add('sa-auto-active');const confirm=card.querySelector('.sa-auto-confirm');if(confirm)confirm.hidden=false;}
        setStatus('Готово — данные вставлены в VK');
        setTimeout(()=>setStatus(''),1800);
      }catch(error){
        setStatus(error?.message||'Не удалось выполнить авто-вставку');
      }
    });

    box.querySelectorAll('[data-auto-confirm]').forEach(b=>b.onclick=async()=>{
      const key=b.dataset.autoConfirm;
      state.db.publication=state.db.publication.filter(p=>postKey(p)!==key);
      await save();
      renderPublicationPanel();
    });
    box.querySelectorAll('[data-auto-cancel]').forEach(b=>b.onclick=()=>{
      const card=b.closest('.sa-pub-card');
      if(!card)return;
      card.classList.remove('sa-auto-active');
      const confirm=card.querySelector('.sa-auto-confirm');
      if(confirm)confirm.hidden=true;
    });

    box.querySelectorAll('[data-copy-text]').forEach(b=>b.onclick=async()=>{
      const p=items.find(x=>postKey(x)===b.dataset.copyText); if(!p)return;
      const status=box.querySelector(`[data-pub-status="${CSS.escape(b.dataset.copyText)}"]`);
      try{await navigator.clipboard.writeText(String(p.text||''));if(status){status.textContent='Текст скопирован';setTimeout(()=>status.textContent='',1500);}}
      catch(e){if(status)status.textContent='Не удалось скопировать';}
    });
    box.querySelectorAll('[data-copy-image]').forEach(b=>b.onclick=async()=>{
      const p=items.find(x=>postKey(x)===b.dataset.copyImage); if(!p)return;
      const status=box.querySelector(`[data-pub-status="${CSS.escape(b.dataset.copyImage)}"]`);
      const first=(Array.isArray(p.images)?p.images:[])[0]; const src=typeof first==='string'?first:first?.src;
      if(!src){if(status)status.textContent='Нет изображения';return;}
      try{
        const result=await browser.runtime.sendMessage({type:"fetchImage",url:src});
        if(!result?.ok)throw new Error(result?.error||"Не удалось получить изображение.");
        const bytes=new Uint8Array(result.bytes);
        const blob=new Blob([bytes],{type:result.type||"image/png"});
        if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw new Error('clipboard-image');
        const type=blob.type||'image/png'; await navigator.clipboard.write([new ClipboardItem({[type]:blob})]);
        if(status){status.textContent='Изображение скопировано';setTimeout(()=>status.textContent='',1500);}
      }catch(_){if(status)status.textContent='Не удалось скопировать изображение';}
    });
    box.querySelectorAll('[data-pub-edit]').forEach(b=>b.onclick=async()=>{
      const key=b.dataset.pubEdit; const idx=state.db.publication.findIndex(x=>postKey(x)===key); if(idx<0)return;
      const p=state.db.publication.splice(idx,1)[0]; state.db.posts.push(p); state.selectedPost=key; await save(); state.active='moderation'; state.open=true; render(); renderPanel();
    });
    box.querySelectorAll('[data-pub-del]').forEach(b=>b.onclick=async()=>{
      const key=b.dataset.pubDel; state.db.publication=state.db.publication.filter(p=>postKey(p)!==key); await save(); renderPublicationPanel();
    });
  }

  function renderArchivePanel(){
    panelShell(`<div class="sa-panel"><div class="sa-title">Архив</div><div class="sa-muted">Удалённые посты будут храниться здесь.</div></div>`);
  }

  function renderSettingsPanel(){
    panelShell(`<div class="sa-panel">
      <div class="sa-title">Настройки</div>
      <div class="sa-title">Домашние сообщества</div>
      <div id="sa-home-communities" class="sa-list"></div>
      <div class="sa-row"><input id="sa-new-home-community" class="sa-input" type="url" placeholder="https://vk.ru/community"><button id="sa-add-home-community" class="sa-btn">Добавить</button></div>
      <div class="sa-muted">Первое сообщество в списке используется по умолчанию для новых постов.</div>
      <label>Количество постов<input id="sa-posts-count" class="sa-input" type="number" min="1" max="25" value="${Number(state.db.settings.postsCount??10)}"></label>
      <label>Максимальный возраст поста, дней<input id="sa-max-age" class="sa-input" type="number" min="0" max="2" value="${state.db.settings.maxAge??2}"></label>
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
    const homes=state.db.settings.homeCommunities||[];
    setHTML(document.getElementById("sa-home-communities"),homes.map((x,i)=>`<div class="sa-card"><b>${i===0?"По умолчанию: ":""}</b>${esc(x)} <button data-rhome="${i}" class="sa-btn sa-danger">×</button></div>`).join("")||`<div class="sa-muted">Домашние сообщества не добавлены.</div>`);
    document.getElementById("sa-add-home-community").onclick=async()=>{
      const v=document.getElementById("sa-new-home-community").value.trim();
      if(!isValidVKUrl(v)){alert("Укажи ссылку https://vk.ru/... или https://vk.com/...");return;}
      if(homes.includes(v)){alert("Это сообщество уже добавлено.");return;}
      homes.push(v); state.db.settings.homeCommunities=homes; state.db.settings.homeCommunity=homes[0]||"";
      await fetchCommunityLogo(v);
      await save(); renderSettingsPanel();
    };
    document.querySelectorAll("[data-rhome]").forEach(b=>b.onclick=async()=>{
      homes.splice(+b.dataset.rhome,1); state.db.settings.homeCommunities=homes; state.db.settings.homeCommunity=homes[0]||"";
      await save(); renderSettingsPanel();
    });
    setHTML(document.getElementById("sa-hashtags"),state.db.hashtags.map((x,i)=>`<div class="sa-card">${esc(x)} <button data-rh="${i}" class="sa-btn sa-danger">×</button></div>`).join(""));
    setHTML(document.getElementById("sa-emojis"),state.db.emoji.map((x,i)=>`<div class="sa-card">${esc(x)} <button data-re="${i}" class="sa-btn sa-danger">×</button></div>`).join(""));
    setHTML(document.getElementById("sa-templates"),(state.db.templates||[]).map((x,i)=>`<div class="sa-card"><b>${esc(x.name||"Без названия")}</b><div class="sa-muted">${esc(String(x.text||"").slice(0,250))}</div><button data-rt="${i}" class="sa-btn sa-danger">×</button></div>`).join("")||`<div class="sa-muted">Шаблоны не добавлены.</div>`);
    document.getElementById("sa-export-settings").onclick=exportSettings;
    document.getElementById("sa-import-settings").onclick=()=>document.getElementById("sa-import-file").click();
    document.getElementById("sa-import-file").onchange=async e=>{
      const file=e.target.files?.[0]; if(!file)return;
      if(!confirm("Импорт заменит текущие источники, настройки, хэштеги, Emoji и шаблоны. Собранные посты и очередь публикации не будут удалены. Продолжить?")){e.target.value="";return;}
      try{await importSettings(file);state.selectedSource=null;renderSettingsPanel();alert("Настройки импортированы.");}catch(error){alert(error?.message||String(error));}finally{e.target.value="";}
    };
    document.getElementById("sa-save-settings").onclick=async()=>{
      state.db.settings.postsCount=clampInt(document.getElementById("sa-posts-count").value,1,25,10);
      state.db.settings.maxAge=clampInt(document.getElementById("sa-max-age").value,0,2,2);
      state.db.settings.homeCommunities=homes; state.db.settings.homeCommunity=homes[0]||"";
      await save(); renderSettingsPanel();
    };
    document.getElementById("sa-add-h").onclick=async()=>{let v=document.getElementById("sa-new-h").value.trim();if(v){v="#"+v.replace(/^#+/,"");state.db.hashtags.push(v);await save();renderSettingsPanel();}};
    document.getElementById("sa-add-e").onclick=async()=>{const v=document.getElementById("sa-new-e").value.trim();if(v){state.db.emoji.push(v);await save();renderSettingsPanel();}};
    document.getElementById("sa-add-template").onclick=async()=>{const name=document.getElementById("sa-new-template-name").value.trim();const text=document.getElementById("sa-new-template-text").value;if(!name||!text.trim()){alert("Укажи название и текст шаблона.");return;}state.db.templates.push({id:uid(),name,text});await save();renderSettingsPanel();};
    document.querySelectorAll("[data-rh]").forEach(b=>b.onclick=async()=>{state.db.hashtags.splice(+b.dataset.rh,1);await save();renderSettingsPanel();});
    document.querySelectorAll("[data-re]").forEach(b=>b.onclick=async()=>{state.db.emoji.splice(+b.dataset.re,1);await save();renderSettingsPanel();});
    document.querySelectorAll("[data-rt]").forEach(b=>b.onclick=async()=>{state.db.templates.splice(+b.dataset.rt,1);await save();renderSettingsPanel();});
  }

  // Collection code runs only on VK tabs. It does not touch non-VK pages.
  function parseVKDate(value){
    let text=norm(value).toLowerCase().replace(/ё/g,"е");
    if(!text)return null;

    // VK may expose the actual timestamp through datetime/title/data-tooltip.
    if(/^\d{10,13}$/.test(text)){
      const n=Number(text);
      return new Date(n<1e12?n*1000:n);
    }
    const iso=Date.parse(text);
    if(!Number.isNaN(iso) && /(?:\d{4}-\d{2}-\d{2}|t\d{2}:)/i.test(text)){
      return new Date(iso);
    }

    const now=new Date();
    if(text.startsWith("сегодня")) return new Date(now.getFullYear(),now.getMonth(),now.getDate());
    if(text.startsWith("вчера")) return new Date(now.getFullYear(),now.getMonth(),now.getDate()-1);

    const rel=text.match(/(\d+)\s*(секунд(?:а|ы)?|сек\.?|минут(?:а|ы)?|мин\.?|час(?:а|ов)?|ч\.?)/);
    if(rel){
      const n=Number(rel[1]), u=rel[2];
      const d=new Date();
      d.setTime(d.getTime()-(u.startsWith("сек")?n*1000:u.startsWith("мин")?n*60000:n*3600000));
      return d;
    }

    const months={
      "янв":0,"января":0,"фев":1,"февраля":1,"мар":2,"марта":2,
      "апр":3,"апреля":3,"май":4,"мая":4,"июн":5,"июня":5,
      "июл":6,"июля":6,"авг":7,"августа":7,"сен":8,"сент":8,"сентября":8,
      "окт":9,"октября":9,"ноя":10,"ноября":10,"дек":11,"декабря":11
    };
    const parts=text.replace(","," ").split(/\s+/);
    if(parts.length<2)return null;
    const day=parseInt(parts[0].replace(".",""),10);
    const month=months[parts[1].replace(".","")];
    if(!Number.isFinite(day)||month===undefined)return null;
    let year=now.getFullYear();
    if(parts[2] && /^\d{4}$/.test(parts[2])) year=Number(parts[2]);
    else if(month>now.getMonth()) year--;
    return new Date(year,month,day);
  }

  function postNodes(){
    const primary=Array.from(document.querySelectorAll('[data-testid="post"]'));
    if(primary.length)return primary;

    // Fallback: use only outermost data-post-id nodes. VK can put the same
    // identifier on nested elements; collecting every descendant causes the
    // scroll loop to see "new" posts forever.
    const candidates=Array.from(document.querySelectorAll('[data-post-id]'));
    return candidates.filter(n=>!n.parentElement?.closest('[data-post-id]'));
  }

  function extractPost(post){
    const normalizeTextNode=(node)=>{
      const clone=node.cloneNode(true);
      clone.querySelectorAll(
        '.PostHeaderTitle__authorLink,'+
        '[data-testid="post_date_block_preview"],'+
        '[data-testid="primary-attachment"],video,'+
        '[role="button"]'
      ).forEach(el=>el.remove());

      // VK may render emoji in post text as <img> rather than a Unicode
      // character. Preserve those images as their textual emoji, while
      // removing ordinary images from the text.
      clone.querySelectorAll('img').forEach(img=>{
        const candidates=[
          img.getAttribute('alt'),
          img.getAttribute('aria-label'),
          img.getAttribute('data-emoji'),
          img.getAttribute('data-emoji-code'),
          img.getAttribute('data-code'),
          img.getAttribute('title')
        ].map(v=>(v||'').trim()).filter(Boolean);
        const emoji=candidates.find(v=>{
          try{
            return /[\p{Extended_Pictographic}]/u.test(v);
          }catch(_){
            return false;
          }
        });
        if(emoji){
          img.replaceWith(document.createTextNode(emoji));
        }else{
          img.remove();
        }
      });
      clone.querySelectorAll('br').forEach(br=>br.replaceWith("\n"));
      return norm(clone.innerText||clone.textContent||"");
    };

    const textSelectors=[
      '[data-testid="showmoretext-in-expanded"]',
      '[data-testid="showmoretext"]',
      '[data-testid="post_text"]',
      '.wall_post_text',
      '.wall_text'
    ];
    let text="";
    for(const sel of textSelectors){
      post.querySelectorAll(sel).forEach(n=>{
        const value=normalizeTextNode(n);
        if(value.length>text.length)text=value;
      });
    }

    const author=post.querySelector('.PostHeaderTitle__authorLink,[data-testid="post_author"]');
    const dateNode=post.querySelector(
      '[data-testid="post_date_block_preview"],time[datetime],time,'+
      '[data-tooltip*="202"],[title*="202"],[aria-label*="202"],'+
      '[data-testid*="date"]'
    );
    const dateRaw = dateNode?.getAttribute("datetime") ||
      dateNode?.getAttribute("data-tooltip") ||
      dateNode?.getAttribute("title") ||
      dateNode?.getAttribute("aria-label") ||
      dateNode?.innerText || "";
    const wallLink=post.querySelector('a[href*="/wall"]');
    const postId=post.getAttribute("data-post-id")||"";
    const id=postId||post.id||wallLink?.getAttribute("href")||"";
    if(!id)return null;

    // VK puts avatars, emoji and UI icons inside the post container too.
    // Prefer actual attachment containers and keep only one URL per image.
    const images=[];
    const seen=new Set();
    const addImage=(src,alt="")=>{
      if(!src||/^data:/i.test(src))return;
      try{src=new URL(src,location.href).href;}catch(_){}
      if(seen.has(src))return;
      seen.add(src);
      images.push({src,alt});
    };

    let attachmentRoots=Array.from(post.querySelectorAll(
      '[data-testid="primary-attachment"],[data-testid="post_attachments"],[data-testid*="attachment"]'
    ));
    attachmentRoots=attachmentRoots.filter(n=>
      !n.parentElement?.closest('[data-testid="primary-attachment"],[data-testid="post_attachments"],[data-testid*="attachment"]')
    );

    const roots=attachmentRoots.length?attachmentRoots:[post];
    roots.forEach(root=>{
      root.querySelectorAll('img').forEach(img=>{
        const src=img.currentSrc||img.src||img.getAttribute("data-src")||img.getAttribute("data-original")||"";
        const w=Number(img.naturalWidth||img.width||0);
        const h=Number(img.naturalHeight||img.height||0);
        const alt=(img.alt||"").trim();
        // Fallback mode: reject small UI/avatar/emoji images.
        if(!attachmentRoots.length && w>0 && h>0 && w<100 && h<100)return;
        if(!attachmentRoots.length && /emoji|смайл/i.test(alt))return;
        addImage(src,alt);
      });
      root.querySelectorAll('[style*="background-image"],[data-background-image]').forEach(el=>{
        const raw=el.getAttribute("data-background-image")||el.style.backgroundImage||"";
        const m=raw.match(/url\(["']?(.*?)["']?\)/i);
        if(m)addImage(m[1]);
      });
    });

    return {
      id,
      post_id:postId,
      url:wallLink ? new URL(wallLink.getAttribute("href"),location.origin).href : "",
      author:norm(author?.innerText||""),
      author_url:author?.getAttribute("href") ? new URL(author.getAttribute("href"),location.origin).href : "",
      date:norm(dateRaw),
      text,
      images
    };
  }

  function fallbackPostKey(node){
    const link=node.querySelector('a[href*="/wall"]')?.getAttribute("href")||"";
    const date=node.querySelector('time[datetime],time,[data-testid*="date"]')?.getAttribute("datetime")||"";
    const text=norm(node.innerText||node.textContent||"").slice(0,500);
    return [link,date,text].join("|");
  }

  async function collectInThisTab(msg){
    const count=Math.max(1,Math.min(25,Number(msg.count||10)));
    const maxAgeDays=Math.max(0,Math.min(2,Number(msg.maxAgeDays??2)));
    const cutoff=new Date(Date.now()-maxAgeDays*86400000);
    const all=new Map();
    let scrolls=0, stagnant=0, lastSignature="";
    const MAX_SCROLLS=8, deadline=Date.now()+45000;

    const collectVisible=()=>{
      const nodes=postNodes();
      for(const node of nodes){
        const item=extractPost(node);
        if(!item)continue;
        const key=item.post_id||item.id||item.url||fallbackPostKey(node);
        if(key)all.set(String(key),item);
      }
      return nodes;
    };
    const filtered=()=>{
      const result=[];
      for(const item of all.values()){
        const d=parseVKDate(item.date);
        if(d && d<cutoff)continue;
        result.push({...item,_date:d});
      }
      result.sort((a,b)=>(b._date?.getTime()||0)-(a._date?.getTime()||0));
      return result.map(({_date,...item})=>item);
    };

    while(Date.now()<deadline && scrolls<=MAX_SCROLLS){
      const nodes=collectVisible();
      const result=filtered();

      // Hard limit: N is a collection ceiling, not a target that permits
      // unlimited scrolling. Only successfully extracted posts count toward
      // the limit. The number of DOM containers is not a valid proxy: VK can
      // render post-like containers that contain no extractable post data.
      if(result.length>=count)return result.slice(0,count);

      const signature=nodes.map(n=>n.getAttribute("data-post-id")||n.id||fallbackPostKey(n)).join("|");
      stagnant=signature===lastSignature?stagnant+1:0;
      lastSignature=signature;

      const height=Math.max(document.documentElement.scrollHeight,document.body?.scrollHeight||0);
      const viewport=window.innerHeight||800;
      const y=window.scrollY||window.pageYOffset||0;
      const atBottom=y+viewport>=height-8;
      if(atBottom||stagnant>=2||scrolls>=MAX_SCROLLS)return result.slice(0,count);

      const oldY=y;
      window.scrollBy(0,Math.max(700,viewport*.85));
      scrolls++;
      await sleep(2500);
      const newY=window.scrollY||window.pageYOffset||0;
      if(Math.abs(newY-oldY)<4)stagnant++;
    }
    return filtered().slice(0,count);
  }

  function communityAvatarUrl(){
    const avatar=document.querySelector('[id^="community_avatar_"]');
    if(!avatar)return "";
    const img=avatar.querySelector('img');
    if(!img)return "";
    const candidates=[
      img.getAttribute("src"),img.getAttribute("data-src"),
      img.getAttribute("data-original"),img.getAttribute("data-lazy-src")
    ];
    for(const value of candidates){if(value?.trim())return value.trim();}
    const srcset=img.getAttribute("srcset");
    if(srcset){
      const entries=srcset.split(",").map(v=>v.trim()).filter(Boolean);
      if(entries.length)return entries[entries.length-1].split(/\s+/)[0];
    }
    return "";
  }

  async function waitForCommunityAvatar(timeoutMs=12000){
    const immediate=communityAvatarUrl();
    if(immediate)return immediate;
    return await new Promise(resolve=>{
      let settled=false;
      const observer=new MutationObserver(()=>{
        const value=communityAvatarUrl();
        if(value)finish(value);
      });
      const timer=setTimeout(()=>finish(""),timeoutMs);
      const finish=value=>{
        if(settled)return;
        settled=true;clearTimeout(timer);observer.disconnect();resolve(value||"");
      };
      observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["src","srcset","class"]});
    });
  }

  browser.runtime.onMessage.addListener(async msg=>{
    if(!msg)return;
    if(msg.type==="toggleSocAdmin"){state.open=!state.open;render();if(state.open)renderPanel();}
    if(msg.type==="scanOnce") return {ok:true,url:location.href};
    if(msg.type==="getCommunityAvatarUrl") return {ok:true,url:await waitForCommunityAvatar()};
  });


  window.addEventListener("resize",()=>{if(state.open)positionPanel();});

  const mountObserver=new MutationObserver(()=>{
    const root=document.getElementById(ROOT_ID);
    const header=document.getElementById("page_header_cont");
    alignVKHeader();
    const parent=header?.parentElement || document.querySelector(".layoutWrapper_root");
    if(!root || (parent && root.parentElement!==parent)) render();
    else if(header && root.nextElementSibling!==header) mountRoot(root);
  });
  mountObserver.observe(document.body,{childList:true,subtree:true});

  async function waitForPostContent(timeoutMs=15000){
    const hasExtractablePost=()=>{
      const nodes=postNodes();
      for(const node of nodes){
        if(extractPost(node))return true;
      }
      return false;
    };

    if(hasExtractablePost())return true;

    return await new Promise(resolve=>{
      let settled=false;
      let timer=null;
      const finish=(value)=>{
        if(settled)return;
        settled=true;
        if(timer)clearTimeout(timer);
        observer.disconnect();
        resolve(value);
      };
      const observer=new MutationObserver(()=>{
        if(hasExtractablePost())finish(true);
      });
      observer.observe(document.body,{childList:true,subtree:true,attributes:true});
      timer=setTimeout(()=>finish(false),timeoutMs);
      // VK may finish the first render between the initial check and
      // observer registration. Check once more after registration.
      if(hasExtractablePost())finish(true);
    });
  }

  async function resumePendingCollection(){
    const x=await browser.storage.local.get("socadminCollection");
    const pending=x.socadminCollection;
    if(!pending)return;

    // Ignore abandoned jobs instead of ever re-running them unexpectedly.
    if(Date.now()-Number(pending.startedAt||0)>10*60*1000){
      await browser.storage.local.remove("socadminCollection");
      return;
    }

    if(!isValidVKUrl(pending.sourceUrl))return;
    const current=location.href.split("#")[0].replace(/\/$/,"");
    const source=String(pending.sourceUrl).split("#")[0].replace(/\/$/,"");

    // VK can canonicalize a community URL during navigation (for example
    // changing the hostname or replacing an alias with its canonical path).
    // The pending job itself is the authoritative signal that this navigation
    // was initiated by SocAdmin. Do not require byte-for-byte URL equality.
    // We still require that we are on VK, and that this is a fresh pending job.
    let sameSource=current===source;
    if(!sameSource){
      try{
        const curUrl=new URL(current);
        const srcUrl=new URL(source);
        sameSource=/^vk\.(ru|com)$/i.test(curUrl.hostname) &&
          /^vk\.(ru|com)$/i.test(srcUrl.hostname);
      }catch{
        sameSource=false;
      }
    }
    if(!sameSource)return;

    state.open=false;
    render();

    try{
      // VK is an SPA: document.readyState is not a reliable indication that
      // the community feed has rendered. Wait for an actual post that our
      // collector can parse. MutationObserver reacts immediately when VK
      // inserts the feed; the timeout prevents an endless wait.
      await waitForPostContent(15000);

      const posts=await collectInThisTab({
        count:clampInt(pending.count,1,25,10),
        maxAgeDays:clampInt(pending.maxAgeDays,0,2,2)
      });
      state.db.posts=state.db.posts.filter(existing=>
        !posts.some(incoming=>(existing.id||existing.post_id||existing.url)===(incoming.id||incoming.post_id||incoming.url))
      ).concat(posts.map(p=>({...p,targetCommunity:p.targetCommunity||String((state.db.settings.homeCommunities||[])[0]||state.db.settings.homeCommunity||"").trim()})));
      await save();
      await browser.storage.local.remove("socadminCollection");

      const home=String(pending.homeUrl||state.db.settings.homeCommunity||"").trim();
      if(isValidVKUrl(home)){
        const homeNorm=home.split("#")[0].replace(/\/$/,"");
        if(homeNorm!==current){
          await browser.storage.local.set({socadminReturn:{homeUrl:home,tab:"moderation",createdAt:Date.now()}});
          location.href=home;
          return;
        }
      }
      state.active="moderation";
      state.open=true;
      render();
      renderPanel();
    }catch(error){
      await browser.storage.local.remove("socadminCollection");
      state.open=true;
      state.active="posts";
      render();
      renderPanel();
      const status=document.getElementById("sa-status");
      if(status)status.textContent=" Ошибка сбора: "+(error?.message||String(error));
    }
  }

  async function resumeReturnNavigation(){
    const x=await browser.storage.local.get("socadminReturn");
    const pending=x.socadminReturn;
    if(!pending)return;
    if(Date.now()-Number(pending.createdAt||0)>10*60*1000){
      await browser.storage.local.remove("socadminReturn");
      return;
    }
    const home=String(pending.homeUrl||"").trim();
    if(!isValidVKUrl(home)){
      await browser.storage.local.remove("socadminReturn");
      return;
    }
    const current=location.href.split("#")[0].replace(/\/$/,"");
    const homeNorm=home.split("#")[0].replace(/\/$/,"");
    if(current!==homeNorm)return;
    await browser.storage.local.remove("socadminReturn");
    state.active=pending.tab||"moderation";
    state.open=true;
    render();
    renderPanel();
  }

  (async()=>{
    await load();
    render();
    await resumePendingCollection();
    await resumeReturnNavigation();
  })();
})();
