function isVK(url) {
  return typeof url === "string" && /^https:\/\/vk\.(com|ru)\//i.test(url);
}

browser.action.onClicked.addListener(async () => {
  const tabs = await browser.tabs.query({active:true,currentWindow:true});
  const tab = tabs[0];
  if (tab?.url && isVK(tab.url)) {
    try { await browser.tabs.sendMessage(tab.id,{type:"toggleSocAdmin"}); } catch (_) {}
  }
});


browser.runtime.onMessage.addListener((message) => {
  if (message?.type !== "fetchImage" || typeof message.url !== "string") return;
  return fetch(message.url, {credentials: "include"})
    .then(async response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      return {ok: true, bytes: buffer, type: response.headers.get("content-type") || "image/jpeg"};
    })
    .catch(error => ({ok: false, error: error?.message || "NetworkError"}));
});


async function getAvatarUrlFromCommunityTab(url) {
  let tab=null;
  try {
    tab=await browser.tabs.create({url, active:false});
    const tabId=tab.id;
    await new Promise((resolve,reject)=>{
      let done=false;
      const timer=setTimeout(()=>finish(new Error("Community page load timeout")),20000);
      const finish=(error)=>{
        if(done)return;
        done=true; clearTimeout(timer); browser.tabs.onUpdated.removeListener(onUpdated);
        error?reject(error):resolve();
      };
      const onUpdated=(id,change)=>{
        if(id===tabId && change.status==="complete") finish();
      };
      browser.tabs.onUpdated.addListener(onUpdated);
      browser.tabs.get(tabId).then(t=>{if(t.status==="complete")finish();}).catch(finish);
    });

    // The avatar is rendered by VK after the initial document is loaded.
    // Ask the VK content script to wait for #community_avatar_<id> and return
    // the actual image URL from the live DOM.
    for(let i=0;i<15;i++){
      try{
        const result=await browser.tabs.sendMessage(tabId,{type:"getCommunityAvatarUrl",url});
        if(result?.ok && result.url)return result.url;
      }catch(_){ }
      await new Promise(r=>setTimeout(r,1000));
    }
    throw new Error("Community avatar URL not found in VK DOM");
  } finally {
    if(tab?.id!=null){try{await browser.tabs.remove(tab.id);}catch(_){} }
  }
}

async function fetchCommunityLogo(url) {
  // Use the authenticated VK page DOM as the primary source. This avoids
  // relying on SSR/OpenGraph markup, which may not contain the avatar.
  let imageUrl="";
  try { imageUrl=await getAvatarUrlFromCommunityTab(url); } catch (_) {}

  // Fallback for unusual layouts where the temporary page did not expose the
  // avatar through the content script.
  if(!imageUrl){
    const pageResponse=await fetch(url,{credentials:"include"});
    if(!pageResponse.ok) throw new Error(`HTTP ${pageResponse.status}`);
    const html=await pageResponse.text();
    try{
      const doc=new DOMParser().parseFromString(html,"text/html");
      const avatar=doc.querySelector('[id^="community_avatar_"]');
      const img=avatar?.querySelector('img');
      const candidates=[
        img?.getAttribute('src'),img?.getAttribute('data-src'),
        img?.getAttribute('data-original'),img?.getAttribute('data-lazy-src')
      ];
      for(const value of candidates){if(value?.trim()){imageUrl=value.trim();break;}}
      if(!imageUrl && img?.getAttribute('srcset')){
        const entries=img.getAttribute('srcset').split(',').map(v=>v.trim()).filter(Boolean);
        if(entries.length)imageUrl=entries[entries.length-1].split(/\s+/)[0];
      }
    }catch(_){ }
  }

  if(!imageUrl) throw new Error("Community avatar URL not found");
  imageUrl=new URL(imageUrl,url).href;
  const imageResponse=await fetch(imageUrl,{credentials:"include"});
  if(!imageResponse.ok) throw new Error(`Logo HTTP ${imageResponse.status}`);
  const type=imageResponse.headers.get("content-type")||"image/jpeg";
  const buffer=await imageResponse.arrayBuffer();
  let binary="";
  const bytes=new Uint8Array(buffer),chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));
  return {ok:true,dataUrl:`data:${type};base64,${btoa(binary)}`,imageUrl};
}

browser.runtime.onMessage.addListener((message) => {
  if (message?.type !== "fetchCommunityLogo" || typeof message.url !== "string") return;
  return fetchCommunityLogo(message.url).catch(error => ({ok:false,error:error?.message||"Logo fetch failed"}));
});
