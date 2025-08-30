// Minimal M3U8 Player (Edge) — no URL field, no footer tip, fixed overlay behavior
export const config = { runtime: "edge" };

export default async function handler(req) {
  const u = new URL(req.url);
  const src = u.searchParams.get("link") || "";
  const title = u.searchParams.get("title") || "HLS Player";
  const autoplay = u.searchParams.get("autoplay") === "1";
  const muted = u.searchParams.get("muted") !== "0"; // default muted=true
  const poster = u.searchParams.get("poster") || "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>${esc(title)}</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<style>
  :root { color-scheme: dark light; --bg:#0b0b0b; --card:#111316; --fg:#e5e7eb; --muted:#9ca3af; --line:#1f2937; --btn:#1f2937; --btnh:#2a3443; }
  *{box-sizing:border-box} html,body{height:100%;margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
  .safe{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}
  header{position:sticky;top:0;z-index:10;background:var(--card);border-bottom:1px solid var(--line)}
  .bar{display:flex;gap:10px;align-items:center;padding:10px 12px}
  .brand{font-weight:700}
  .title{opacity:.75;font-size:13px}
  .page{display:flex;flex-direction:column}
  .player-wrap{position:relative;width:100%;aspect-ratio:16/9;background:#000}
  @media (min-height:700px){ .player-wrap{height:calc(100vh - 56px);aspect-ratio:auto} }
  video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;outline:0}
  .overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
  .pill{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.2);padding:10px 14px;border-radius:999px;font-weight:600;backdrop-filter:blur(2px)}
  .hidden{display:none!important}
  .controls{display:flex;gap:8px;align-items:center;padding:10px 12px;background:var(--card);border-top:1px solid var(--line)}
  button,select{padding:10px 12px;border-radius:10px;border:1px solid #2b3340;background:var(--btn);color:var(--fg)}
  button:hover{background:var(--btnh)}
  .right{margin-left:auto;display:flex;gap:8px;align-items:center}
  .spinner{position:absolute;top:10px;right:10px;width:22px;height:22px;border-radius:50%;border:3px solid rgba(255,255,255,.25);border-top-color:#fff;animation:spin 1s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom));background:#111827;color:#fff;padding:10px 14px;border-radius:10px;border:1px solid #2b3340;box-shadow:0 10px 30px rgba(0,0,0,.3);font-size:13px}
</style>
</head>
<body>
<header class="safe">
  <div class="bar">
    <div class="brand">HLS Player</div>
    <div id="liveTitle" class="title">${esc(title)}</div>
  </div>
</header>

<main class="page">
  <section class="player-wrap safe">
    <video id="video" playsinline ${autoplay ? "autoplay" : ""} ${muted ? "muted" : ""} controls ${poster ? `poster="${esc(poster)}"` : ""}></video>
    <div id="tap" class="overlay ${autoplay ? "hidden": ""}"><div class="pill">Tap to play ▶</div></div>
    <div id="loading" class="spinner hidden" aria-hidden="true"></div>
  </section>

  <section class="controls safe">
    <div class="left">
      <button id="btnToggle">Play</button>
      <button id="btnMute">${muted ? "Unmute" : "Mute"}</button>
      <button id="btnFullscreen">Fullscreen</button>
      <button id="btnPip">PiP</button>
      <button id="btnRotate">Rotate</button>
    </div>
    <div class="right">
      <label class="sr" for="quality">Quality</label>
      <select id="quality"><option value="-1">Auto</option></select>
    </div>
  </section>
</main>

<div id="toast" class="toast hidden" role="status" aria-live="polite"></div>

<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script>
  const video = document.getElementById('video');
  const tap = document.getElementById('tap');
  const toast = document.getElementById('toast');
  const loading = document.getElementById('loading');
  const btnToggle = document.getElementById('btnToggle');
  const btnMute = document.getElementById('btnMute');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const btnPip = document.getElementById('btnPip');
  const btnRotate = document.getElementById('btnRotate');
  const selQuality = document.getElementById('quality');
  let lockedOrientation = false;

  function showToast(msg, ms=1600){ toast.textContent=msg; toast.classList.remove('hidden'); clearTimeout(showToast._t); showToast._t=setTimeout(()=>toast.classList.add('hidden'),ms); }

  function populateQualities(hls){
    selQuality.innerHTML = '<option value="-1">Auto</option>';
    hls.levels.forEach((lvl,i)=>{
      const label = lvl.name || (lvl.height? (lvl.height+'p') : (Math.round((lvl.bitrate||0)/1000)+'kbps'));
      const o = document.createElement('option'); o.value=i; o.textContent=label; selQuality.appendChild(o);
    });
    selQuality.onchange = ()=>{ hls.currentLevel = parseInt(selQuality.value,10); showToast(selQuality.value=='-1'?'Quality: Auto':'Quality: '+selQuality.options[selQuality.selectedIndex].text); };
  }

  async function attachAndPlay(src){
    if(!src){ showToast('No stream URL'); return; }
    // Native HLS first
    if(video.canPlayType('application/vnd.apple.mpegurl')){
      video.src = src; video.load();
      try{ await video.play(); }catch{}
      return;
    }
    if(Hls.isSupported()){
      if(window._hls){ try{ window._hls.destroy(); }catch{} }
      const hls = new Hls({ maxBufferLength:30, liveSyncDuration:3, enableWorker:true });
      window._hls = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, ()=> populateQualities(hls));
      hls.on(Hls.Events.LEVEL_SWITCHED, (_,d)=>{ if(hls.autoLevelEnabled) selQuality.value='-1'; });
      hls.on(Hls.Events.ERROR, (ev,data)=>{
        if(data?.fatal){
          switch(data.type){
            case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
            case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
            default: hls.destroy(); showToast('Fatal HLS error'); break;
          }
        }
      });
      hls.attachMedia(video);
      hls.loadSource(src);
      hls.on(Hls.Events.MANIFEST_PARSED, async ()=>{ try{ await video.play(); }catch{} });
    } else {
      showToast('HLS not supported in this browser');
    }
  }

  // --- Controls
  btnToggle.onclick = async ()=>{ if(video.paused){ try{ await video.play(); }catch{} } else { video.pause(); } };
  btnMute.onclick = ()=>{ video.muted = !video.muted; btnMute.textContent = video.muted ? 'Unmute':'Mute'; };
  btnFullscreen.onclick = async ()=>{ try{ document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen({navigationUI:'hide'}); }catch{} };
  btnPip.onclick = async ()=>{ if(!document.pictureInPictureEnabled) return showToast('PiP not supported'); try{ document.pictureInPictureElement ? await document.exitPictureInPicture() : await video.requestPictureInPicture(); }catch{ showToast('PiP error'); } };
  btnRotate.onclick = async ()=>{ try{ if(!lockedOrientation){ await screen.orientation.lock('landscape'); lockedOrientation=true; showToast('Locked landscape'); } else { await screen.orientation.unlock(); lockedOrientation=false; showToast('Unlocked'); } }catch{ showToast('Rotate not supported'); } };

  // Overlay behavior: hide on any play/playing/timeupdate; show on pause
  ['play','playing'].forEach(e=> video.addEventListener(e, ()=> tap.classList.add('hidden')));
  video.addEventListener('timeupdate', ()=>{ if(video.currentTime>0) tap.classList.add('hidden'); });
  video.addEventListener('pause', ()=> tap.classList.remove('hidden'));
  video.addEventListener('waiting', ()=> loading.classList.remove('hidden'));
  video.addEventListener('playing', ()=> loading.classList.add('hidden'));
  video.addEventListener('error', ()=> showToast('Playback error'));

  // Clicking overlay triggers a user gesture play
  tap.addEventListener('click', async ()=>{ tap.classList.add('hidden'); try{ await video.play(); }catch{} });

  // Auto-init from ?link=
  (function init(){
    const src = ${JSON.stringify(src)};
    if(src){ attachAndPlay(src); }
  })();
</script>
</body>
</html>`;

  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function esc(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c])); }
