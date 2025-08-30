// Edge Function: serves UI and also acts as API:
// - GET /?link=<M3U_URL> => returns raw M3U (text/plain)
// - GET /               => returns HTML UI

export const config = { runtime: "edge" };

export default async function handler(req) {
  const url = new URL(req.url);
  const link = url.searchParams.get("link");

  // If ?link= supplied: fetch and return raw M3U
  if (link) {
    if (!isValidHttpUrl(link)) {
      return textResponse("Error: Invalid URL.", 400);
    }
    try {
      const resp = await fetch(link, {
        // Some M3U hosts require a UA
        headers: { "User-Agent": "Mozilla/5.0" },
        redirect: "follow",
      });
      if (!resp.ok) {
        return textResponse(`Error: Failed to load M3U (${resp.status})`, 502);
      }
      const body = await resp.text();
      // CORS open so you can call this API from anywhere if you want
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      return textResponse("Error: " + (e?.message || "Unknown"), 500);
    }
  }

  // Otherwise: return the HTML UI
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>M3U Loader (Vercel)</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 24px; background: #f6f7f9; }
  .wrap { max-width: 980px; margin: 0 auto; }
  h1 { margin: 0 0 12px; font-size: 22px; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
  .row { display: flex; gap: 8px; align-items: center; }
  input[type="text"] { flex: 1; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 10px; outline: none; }
  button { padding: 10px 14px; border: 0; border-radius: 10px; background: #111827; color: #fff; cursor: pointer; }
  button:disabled { opacity: .6; cursor: not-allowed; }
  .tabs { display: flex; gap: 8px; margin-top: 12px; }
  .tab { padding: 8px 10px; border-radius: 8px; cursor: pointer; background: #f3f4f6; }
  .tab.active { background: #111827; color: #fff; }
  pre, .list { margin-top: 12px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; max-height: 70vh; overflow: auto; white-space: pre-wrap; }
  .ch { padding: 8px; border-bottom: 1px dashed #e5e7eb; }
  .ch:last-child { border-bottom: 0; }
  .name { font-weight: 600; }
  .meta { font-size: 12px; color: #6b7280; }
  a.btn { display: inline-block; margin-left: 8px; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 8px; text-decoration: none; }
  .muted { color: #6b7280; font-size: 12px; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>M3U Loader (Vercel)</h1>
    <div class="card">
      <div class="row">
        <input id="m3uLink" type="text" placeholder="Enter M3U URL (e.g. https://example.com/playlist.m3u)">
        <button id="btnLoad" onclick="loadM3U()">Load</button>
      </div>
      <div class="tabs">
        <div id="tabRaw" class="tab active" onclick="setMode('raw')">Raw</div>
        <div id="tabList" class="tab" onclick="setMode('list')">Parsed List</div>
      </div>
      <pre id="rawBox">M3U content will appear here...</pre>
      <div id="listBox" class="list" style="display:none"></div>
      <div class="muted">Tip: The same endpoint acts as an API: <code>?link=&lt;M3U_URL&gt;</code> returns <em>text/plain</em>.</div>
    </div>
  </div>

<script>
  let mode = 'raw';
  function setMode(m) {
    mode = m;
    document.getElementById('tabRaw').classList.toggle('active', m==='raw');
    document.getElementById('tabList').classList.toggle('active', m==='list');
    document.getElementById('rawBox').style.display = (m==='raw') ? '' : 'none';
    document.getElementById('listBox').style.display = (m==='list') ? '' : 'none';
  }

  async function loadM3U() {
    const link = document.getElementById('m3uLink').value.trim();
    if (!link) return alert('Enter M3U URL');
    const btn = document.getElementById('btnLoad');
    const rawBox = document.getElementById('rawBox');
    const listBox = document.getElementById('listBox');
    btn.disabled = true;
    rawBox.textContent = 'Loading...';
    listBox.innerHTML = '';
    try {
      const resp = await fetch('?link=' + encodeURIComponent(link));
      const text = await resp.text();
      rawBox.textContent = text;

      // Simple M3U parser to display channels in "Parsed List" tab
      const channels = parseM3U(text);
      if (channels.length) {
        listBox.innerHTML = channels.map(ch => {
          const logo = ch.attrs['tvg-logo'] || '';
          const name = ch.attrs['tvg-name'] || ch.title || '(no name)';
          const group = ch.attrs['group-title'] || '';
          const groupHtml = group ? ' • ' + escapeHtml(group) : '';
          const logoHtml = logo ? '<img src="'+escapeHtml(logo)+'" alt="" style="height:18px;vertical-align:middle;margin-right:6px;border-radius:4px;">' : '';
          return '<div class="ch">' +
                   '<div class="name">' + logoHtml + escapeHtml(name) + '<a class="btn" href="'+escapeHtml(ch.url)+'" target="_blank" rel="noopener">Open</a></div>' +
                   '<div class="meta">' + escapeHtml(ch.title) + groupHtml + '</div>' +
                   '<div class="meta"><code>'+escapeHtml(ch.url)+'</code></div>' +
                 '</div>';
        }).join('');
      } else {
        listBox.innerHTML = '<div class="ch">No channels parsed.</div>';
      }

    } catch (e) {
      rawBox.textContent = 'Error: ' + e.message;
      listBox.innerHTML = '<div class="ch">Error loading/parsing.</div>';
    } finally {
      btn.disabled = false;
    }
  }

  function parseM3U(text) {
    const lines = text.split(/\\r?\\n/);
    const result = [];
    let pending = null;
    for (let i=0; i<lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (line.startsWith('#EXTINF')) {
        // Parse attributes from #EXTINF:-1 key="value" key="value",Title
        const m = line.match(/^#EXTINF[^,]*,(.*)$/);
        const title = m ? m[1].trim() : '';
        const attrs = {};
        const attrPattern = /([a-zA-Z0-9-]+)="([^"]*)"/g;
        let am;
        while ((am = attrPattern.exec(line)) !== null) {
          attrs[am[1]] = am[2];
        }
        pending = { title, attrs };
      } else if (!line.startsWith('#') && pending) {
        result.push({ title: pending.title, attrs: pending.attrs, url: line });
        pending = null;
      }
    }
    return result;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
</script>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function isValidHttpUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}
function textResponse(msg, status = 200) {
  return new Response(msg, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
