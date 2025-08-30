// Minimal M3U8 Player (Edge) — title only, simple controls
export const config = { runtime: "edge" };

export default async function handler(req) {
  const u = new URL(req.url);
  const src = u.searchParams.get("link") || "";
  const title = u.searchParams.get("title") || "";
  const autoplay = u.searchParams.get("autoplay") === "1";
  const muted = u.searchParams.get("muted") !== "0"; // default true
  const poster = u.searchParams.get("poster") || "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>${esc(title || "Player")}</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<style>
  :root { color-scheme: dark light; --bg:#0b0b0b; --card:#111316; --fg:#e5e7eb; --line:#1f2937; --btn:#1f2937; --btnh:#2a3443; }
  *{box-sizing:border-box} html,body{height:100%;margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
  .safe{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}
  header{position:sticky;top:0;z-index:10;background:var(--card);border-bottom:1px solid var(--line);padding:10px 12px}
  .title{font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .player{position:relative;width:100%;aspect-ratio:16/9;background:#000}
  @media (min-height:700px){ .player{height:calc(100vh - 56px);aspect-ratio:auto} }
  video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;outline:0}
  .overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
  .pill{background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.2);padding:10px 14px;border-radius:999px;font-weight:600}
  .hidden{display:none!important}
  .controls{display:flex;gap:8px;align-items:center;padding:10px 12px;background:var(--card);border-top:1px solid var(--line)}
  button{padding:10px 12px;border-radius:10px;border:1px solid #2b3340;background:var(--btn);color:var(--fg);min-width:90px}
  button:hover{background:var(--btnh)}
  .right{margin-left:auto}
  .spinner{position:absolute;top:10px;right:10px;width:22px;height:22px;border-radius:50%;border:3px solid rgba(255,255,255,.25);border-top-color:#fff;animation:spin 1s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom));background:#111827;color:#fff;padding:10px 14px;border-radius:10px;border:1px solid #2b3340;box-shadow:0 10px 30px rgba(0,0,0,.3);font-size:13px}
</style>
</head>
<body>
  ${title ? `<header class="safe"><div class="title">${esc(title)}</div></header>` : ``}

  <main>
    <section class="player safe">
      <video id="video" playsinline ${autoplay ? "autoplay" : ""} ${muted ? "muted" : ""} controls ${poster ? `poster="${esc(poster)}"` : ""}></video>
      <div id="tap" class="overlay ${autoplay ? "hidden": ""}"><div class="pill">Tap to play ▶</div></div>
      <div id="loading" class="spinner hidden" aria-hidden="true"></div>
    </section>

    <section class="controls safe">
      <button id="btnToggle">Play</button>
      <button id="btnMute">${muted ? "Unmute" : "Mute"}</button>
      <span class="right">
        <button id="btnFullscreen">Fullscreen</button>
        <button id="btnRotate">Rotate</button>
      </span>
    </section>
  </main>

  <div id="toast" class="toast hidden" role="status" aria-live="polite"></div>

<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script>
  const video = document.getElementById('video');
  const tap = document.getElementById('tap');
  const loading = document.getElementById('loading');
  const toast = document.getElementById('toast');
  const btnToggle = document.getElementById('btnToggle');
  const btnMute = document.getElementById('btnMute');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const btnRotate = document.getElementById('btnRotate');
  let lockedOrientation = false;

  function showToast(msg, ms=1500){ toast.textContent=msg; toast.classList.remove('hidden'); clearTimeout(showToast._t); showToast._t=setTimeout(()=>toast.classList.add('hidden'),ms); }

  async function attachAndPlay(src){
    if(!src){ showToast('No stream URL'); return; }
    loading.classList.remove('hidden');

    // Native HLS (Safari/iOS)
    if(video.canPlayType('application/vnd.apple.mpegurl')){
      video.src = src; video.load();
      try{ await video.play(); }catch{}
      loading.classList.add('hidden');
      return;
    }

    if(Hls.isSupported()){
      if(window._hls){ try{ window._hls.destroy(); }catch{} }
      const hls = new Hls({ maxBufferLength:30, liveSyncDuration:3, enableWorker:true });
      window._hls = hls;
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
      hls.on(Hls.Events.MANIFEST_PARSED, async ()=>{ try{ await video.play(); }catch{} loading.classList.add('hidden'); });
    } else {
      loading.classList.add('hidden');
      showToast('HLS not supported');
    }
  }

  // Buttons
  btnToggle.onclick = async ()=>{ if(video.paused){ try{ await video.play(); }catch{} } else { video.pause(); } };
  btnMute.onclick = ()=>{ video.muted = !video.muted; btnMute.textContent = video.muted ? 'Unmute':'Mute'; };
  btnFullscreen.onclick = async ()=>{ try{ document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen({navigationUI:'hide'}); }catch{} };
  btnRotate.onclick = async ()=>{ try{ if(!lockedOrientation){ await screen.orientation.lock('landscape'); lockedOrientation=true; showToast('Locked landscape'); } else { await screen.orientation.unlock(); lockedOrientation=false; showToast('Unlocked'); } }catch{ showToast('Rotate not supported'); } };

  // Overlay & spinner behavior
  ['play','playing'].forEach(e=> video.addEventListener(e, ()=> tap.classList.add('hidden')));
  video.addEventListener('timeupdate', ()=>{ if(video.currentTime>0) tap.classList.add('hidden'); });
  video.addEventListener('pause', ()=> tap.classList.remove('hidden'));
  video.addEventListener('waiting', ()=> loading.classList.remove('hidden'));
  video.addEventListener('playing', ()=> loading.classList.add('hidden'));
  video.addEventListener('error', ()=> showToast('Playback error'));

  tap.addEventListener('click', async ()=>{ tap.classList.add('hidden'); try{ await video.play(); }catch{} });

  // Auto-init
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
