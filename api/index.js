// M3U8 Player (Edge) — plays a direct .m3u8 via ?link=<URL>
export const config = { runtime: "edge" };

export default async function handler(req) {
  const url = new URL(req.url);
  const src = url.searchParams.get("link") || "";
  const title = url.searchParams.get("title") || "M3U8 Player";
  const autoplay = url.searchParams.get("autoplay") === "1"; // optional ?autoplay=1
  const muted = url.searchParams.get("muted") !== "0";       // default muted=on (mobile autoplay)
  const poster = url.searchParams.get("poster") || "";       // optional poster image

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<style>
  :root { color-scheme: dark light; }
  html,body { height:100%; margin:0; }
  body { display:flex; flex-direction:column; background:#0b0b0b; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; }
  header { color:#e5e7eb; padding:12px 16px; font-size:14px; background:#111316; border-bottom:1px solid #1f2937; display:flex; align-items:center; gap:10px; }
  header b { font-weight:600; }
  #wrap { flex:1; display:flex; align-items:center; justify-content:center; padding:0; }
  video { width:100%; height:100%; max-height:100vh; background:#000; outline:none; }
  .bar { display:flex; gap:8px; align-items:center; margin-left:auto; }
  input[type=text] { min-width:280px; max-width:55vw; width:55vw; padding:8px 10px; border-radius:8px; border:1px solid #374151; background:#0f1115; color:#e5e7eb; }
  button { padding:8px 12px; border:1px solid #374151; border-radius:8px; background:#1f2937; color:#e5e7eb; cursor:pointer; }
  button:hover { background:#2a3443; }
  .note { color:#9ca3af; font-size:12px; padding:8px 16px; }
</style>
</head>
<body>
<header>
  <b>HLS Player</b>
  <span id="liveTitle" style="opacity:.8;"></span>
  <div class="bar">
    <input id="m3u8" type="text" placeholder="https://.../playlist.m3u8" value="${escapeHtml(src)}" />
    <button onclick="loadFromInput()">Play</button>
  </div>
</header>

<div id="wrap">
  <video id="video" playsinline ${autoplay ? "autoplay" : ""} ${muted ? "muted" : ""} controls ${poster ? `poster="${escapeHtml(poster)}"` : ""}></video>
</div>

<div class="note">
  Tip: Provide a direct .m3u8 link via <code>?link=</code>. Example:
  <code>?link=${escapeHtml("https://cdn12isb.tamashaweb.com:8087/jazzauth/AAN-TV-abr/playlist.m3u8")}</code>
  • Autoplay: <code>&autoplay=1</code> • Unmute: <code>&muted=0</code> • Title: <code>&title=My+Channel</code>
</div>

<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<script>
  const video = document.getElementById('video');
  const titleEl = document.getElementById('liveTitle');
  const input = document.getElementById('m3u8');

  function setTitle(t) {
    titleEl.textContent = t ? "— " + t : "";
    document.title = t ? (t + " · HLS Player") : "HLS Player";
  }

  async function playSrc(src) {
    if (!src) return;
    // If Safari/iOS supports HLS natively:
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      try { await video.play().catch(()=>{}); } catch(e){}
      return;
    }
    // Otherwise use hls.js
    if (Hls.isSupported()) {
      // Clean previous instance if any
      if (window._hls) { try { window._hls.destroy(); } catch(e){} }
      const hls = new Hls({ maxBufferLength: 30, liveSyncDuration: 3, enableWorker: true });
      window._hls = hls;
      hls.on(Hls.Events.ERROR, (ev, data) => {
        if (data && data.fatal) {
          console.warn('HLS fatal error:', data.type, data.details);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
            case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
            default: hls.destroy(); break;
          }
        }
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, async () => {
        try { await video.play().catch(()=>{}); } catch(e){}
      });
    } else {
      alert('HLS not supported in this browser.');
    }
  }

  function loadFromInput() {
    const val = input.value.trim();
    if (!val) { alert('Enter a .m3u8 link'); return; }
    // Update query param for shareable URL
    const u = new URL(location.href);
    u.searchParams.set('link', val);
    history.replaceState(null, '', u.toString());
    setTitle(val.split('/').pop());
    playSrc(val);
  }

  // Auto-load from ?link= if present
  (function init(){
    const u = new URL(location.href);
    const link = u.searchParams.get('link') || '';
    const title = u.searchParams.get('title') || '';
    if (title) setTitle(title); else if (link) setTitle(link.split('/').pop());
    if (link) playSrc(link);
  })();
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// Small HTML escaper for safety
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}
