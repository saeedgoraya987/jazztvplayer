// M3U8 Player (Edge) — polished mobile UI, quality picker, fullscreen, PiP
export const config = { runtime: "edge" };

export default async function handler(req) {
  const url = new URL(req.url);
  const src = url.searchParams.get("link") || "";
  const title = url.searchParams.get("title") || "M3U8 Player";
  const autoplay = url.searchParams.get("autoplay") === "1";
  const muted = url.searchParams.get("muted") !== "0"; // default muted for mobile autoplay
  const poster = url.searchParams.get("poster") || "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>${esc(title)}</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<style>
  :root { color-scheme: dark light; --bg:#0b0b0b; --card:#111316; --muted:#9ca3af; --fg:#e5e7eb; --line:#1f2937; --btn:#1f2937; --btnh:#2a3443; }
  *{box-sizing:border-box}
  html,body{height:100%; margin:0;}
  body{background:var(--bg); color:var(--fg); font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;}
  .safe{padding-left:constant(safe-area-inset-left); padding-right:constant(safe-area-inset-right);
        padding-left:env(safe-area-inset-left); padding-right:env(safe-area-inset-right);}
  header{position:sticky; top:0; z-index:10; background:var(--card); border-bottom:1px solid var(--line);}
  .bar{display:flex; gap:8px; align-items:center; padding:10px 12px;}
  .brand{font-weight:700; letter-spacing:.2px; margin-right:8px; white-space:nowrap;}
  .title{opacity:.7; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:0 0 auto; max-width:26vw}
  .grow{flex:1 1 auto; display:flex; gap:8px;}
  input[type="text"]{flex:1; min-width:0; padding:10px 12px; border-radius:10px; border:1px solid #2b3340; background:#0f1115; color:var(--fg);}
  button, select{padding:10px 12px; border-radius:10px; border:1px solid #2b3340; background:var(--btn); color:var(--fg);}
  button:hover{background:var(--btnh)}
  select{appearance:none}
  .page{display:flex; flex-direction:column; gap:10px;}
  .player-wrap{position:relative; width:100%; aspect-ratio:16/9; background:#000;}
  /* If device height allows, let it stretch to viewport */
  @media (min-height: 700px){ .player-wrap{height: calc(100vh - 64px); aspect-ratio:auto;}}
  video{position:absolute; inset:0; width:100%; height:100%; object-fit:contain; background:#000; outline:0;}
  .overlay{position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none;}
  .tap{pointer-events:auto; background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.2); padding:10px 14px; border-radius:999px; font-weight:600}
  .hidden{display:none !important}
  .controls{display:flex; gap:8px; align-items:center; padding:10px 12px; background:var(--card); border-top:1px solid var(--line);}
  .controls .left{display:flex; gap:8px; flex-wrap:wrap;}
  .controls .right{margin-left:auto; display:flex; gap:8px; align-items:center;}
  .muted-tip{color:var(--muted); font-size:12px;}
  .note{color:var(--muted); font-size:12px; padding:6px 12px;}
  .spinner{position:absolute; top:10px; right:10px; width:22px; height:22px; border-radius:50%;
           border:3px solid rgba(255,255,255,.25); border-top-color:#fff; animation:spin 1s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg)}}
  .toast{position:fixed; left:50%; transform:translateX(-50%); bottom:calc(16px + env(safe-area-inset-bottom));
         background:#111827; color:#fff; padding:10px 14px; border-radius:10px; border:1px solid #2b3340; box-shadow:0 10px 30px rgba(0,0,0,.3); font-size:13px;}
  .sr{position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;}
</style>
</head>
<body>
  <header class="safe">
    <div class="bar">
      <div class="brand">HLS Player</div>
      <div id="liveTitle" class="title"></div>
      <div class="grow">
        <input id="m3u8" type="text" placeholder="https://.../playlist.m3u8" value="${esc(src)}"/>
        <button id="btnPlayUrl" title="Play entered URL">Play</button>
      </div>
    </div>
  </header>

  <main class="page">
    <section class="player-wrap safe">
      <video id="video" playsinline ${autoplay ? "autoplay" : ""} ${muted ? "muted" : ""} controls ${poster ? `poster="${esc(poster)}"` : ""}></video>
      <div id="tapOverlay" class="overlay ${autoplay ? "hidden": ""}">
        <button class="tap" id="tapPlay">Tap to play ▶</button>
      </div>
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

    <div class="note safe">
      Tip: Add <code>?link=</code> to play automatically. Example:
      <code>?link=${esc("https://cdn12isb.tamashaweb.com:8087/jazzauth/AAN-TV-abr/playlist.m3u8")}</code> • Autoplay: <code>&autoplay=1</code> • Unmute: <code>&muted=0</code> • Title: <code>&title=My+Channel</code>
    </div>
  </main>

  <div id="toast" class="toast hidden" role="status" aria-live="polite"></div>

<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script>
  const video = document.getElementById('video');
  const input = document.getElementById('m3u8');
  const liveTitle = document.getElementById('liveTitle');
  const btnPlayUrl = document.getElementById('btnPlayUrl');
  const btnToggle = document.getElementById('btnToggle');
  const btnMute = document.getElementById('btnMute');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const btnPip = document.getElementById('btnPip');
  const btnRotate = document.getElementById('btnRotate');
  const selQuality = document.getElementById('quality');
  const tapOverlay = document.getElementById('tapOverlay');
  const tapPlay = document.getElementById('tapPlay');
  const loading = document.getElementById('loading');
  const toast = document.getElementById('toast');
  let lockedOrientation = false;

  function showToast(msg, ms=1800){
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=>toast.classList.add('hidden'), ms);
  }

  function setTitle(t) {
    liveTitle.textContent = t ? '— ' + t : '';
    document.title = t ? (t + ' · HLS Player') : 'HLS Player';
  }

  // Quality picker helpers
  function populateQualities(hls){
    selQuality.innerHTML = '<option value="-1">Auto</option>';
    // Levels highest->lowest or vice versa; Hls exposes array with .height, .bitrate, .name
    hls.levels.forEach((lvl, i) => {
      const label = lvl.name || (lvl.height ? (lvl.height + 'p') : (Math.round((lvl.bitrate||0)/1000)+'kbps'));
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = label;
      selQuality.appendChild(opt);
    });
    selQuality.onchange = () => {
      const v = parseInt(selQuality.value, 10);
      hls.currentLevel = v;     // -1 = auto
      showToast(v === -1 ? 'Quality: Auto' : ('Quality: ' + selQuality.options[selQuality.selectedIndex].text));
    };
  }

  async function playSrc(src) {
    if (!src) return;
    // Update URL for shareability
    const u = new URL(location.href);
    u.searchParams.set('link', src);
    history.replaceState(null, '', u.toString());
    setTitle((new URL(src, location.href)).pathname.split('/').pop());

    loading.classList.remove('hidden');

    // Native HLS (Safari/iOS)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      try { await video.play(); } catch(e){}
      loading.classList.add('hidden');
      return;
    }

    // hls.js path
    if (Hls.isSupported()) {
      if (window._hls) { try { window._hls.destroy(); } catch(e){} }
      const hls = new Hls({
        maxBufferLength: 30,
        liveSyncDuration: 3,
        enableWorker: true,
      });
      window._hls = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        populateQualities(hls);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        const idx = data.level;
        // Reflect selection in UI if auto changed
        if (selQuality.value !== String(idx) && hls.autoLevelEnabled) {
          selQuality.value = "-1";
        }
      });

      hls.on(Hls.Events.ERROR, (ev, data) => {
        if (data && data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
            case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
            default: hls.destroy(); showToast('Fatal HLS error'); break;
          }
        }
      });

      hls.attachMedia(video);
      hls.loadSource(src);
      hls.on(Hls.Events.MANIFEST_PARSED, async () => {
        try { await video.play(); } catch(e){}
        loading.classList.add('hidden');
      });
    } else {
      loading.classList.add('hidden');
      alert('HLS not supported in this browser.');
    }
  }

  // Controls
  btnPlayUrl.onclick = () => {
    const val = input.value.trim();
    if (!val) return showToast('Enter a .m3u8 link');
    playSrc(val);
  };

  tapPlay.onclick = async () => {
    tapOverlay.classList.add('hidden');
    try { await video.play(); } catch(e){}
  };

  btnToggle.onclick = async () => {
    if (video.paused) { try { await video.play(); } catch(e){}; }
    else { video.pause(); }
  };

  btnMute.onclick = () => {
    video.muted = !video.muted;
    btnMute.textContent = video.muted ? 'Unmute' : 'Mute';
  };

  btnFullscreen.onclick = async () => {
    const el = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen({navigationUI:"hide"});
    try { await el; } catch(e){}
  };

  btnPip.onclick = async () => {
    if (!document.pictureInPictureEnabled) return showToast('PiP not supported');
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch(e){ showToast('PiP error'); }
  };

  btnRotate.onclick = async () => {
    try {
      if (!lockedOrientation) {
        await screen.orientation.lock('landscape');
        lockedOrientation = true; showToast('Locked landscape');
      } else {
        await screen.orientation.unlock();
        lockedOrientation = false; showToast('Unlocked');
      }
    } catch(e){ showToast('Rotate not supported'); }
  };

  // Update Play button label when state changes
  video.addEventListener('play', ()=> btnToggle.textContent='Pause');
  video.addEventListener('pause', ()=> btnToggle.textContent='Play');
  video.addEventListener('waiting', ()=> loading.classList.remove('hidden'));
  video.addEventListener('playing', ()=> loading.classList.add('hidden'));
  video.addEventListener('error', ()=> showToast('Playback error'));

  // Auto init from query params
  (function init(){
    const u = new URL(location.href);
    const link = u.searchParams.get('link') || '';
    const t = u.searchParams.get('title') || '';
    if (t) setTitle(t); else if (link) setTitle((new URL(link, location.href)).pathname.split('/').pop());
    if (link) { input.value = link; playSrc(link); }
  })();
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// escape helper
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));}
