// Ollo Labs lock service worker: serves <path>.enc decrypted (AES-256-GCM, AAD = path). Key lives only in memory
// here and in each tab's sessionStorage. No key -> navigations get the unlock page, other requests get 401.
const BASE = '/ollo-labs/', te = new TextEncoder(); let K = null;
const ub = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const setKey = async s => { K = s ? await crypto.subtle.importKey('raw', ub(s), 'AES-GCM', false, ['decrypt']) : null; };
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('message', e => { const d = e.data || {}; const p = d.t === 'key' ? setKey(d.k) : d.t === 'lock' ? setKey(null) : null;
  if (p) e.waitUntil(p.then(() => e.ports[0] && e.ports[0].postMessage('ok'))); });
async function getKey() { if (K) return K;
  for (const c of await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })) {
    const k = await new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = m => r(m.data && m.data.k); c.postMessage({ t: 'need' }, [ch.port2]); setTimeout(() => r(null), 700); });
    if (k) { try { await setKey(k); return K; } catch (e) { } } }
  return null; }
const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', wasm: 'application/wasm', woff2: 'font/woff2', ttf: 'font/ttf' };
const gate = () => fetch(BASE + '_lock/gate.html', { cache: 'no-store' }).then(r => new Response(r.body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }));
async function handle(req, rel) {
  const nav = req.mode === 'navigate', key = await getKey();
  if (!key) return nav ? gate() : new Response('locked', { status: 401 });
  let r = await fetch(BASE + rel + '.enc', { cache: 'no-cache' });
  if (r.status === 404 && !/\.[^/]+$/.test(rel)) { const d = await fetch(BASE + rel + '/index.html.enc', { method: 'HEAD' }); if (d.ok) return Response.redirect(BASE + rel + '/' + new URL(req.url).search, 302); }
  if (!r.ok) return fetch(req);          // plain asset (audio) or a real 404
  const E = await r.json(); let pt;
  try { pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ub(E.iv), additionalData: te.encode(rel) }, key, ub(E.ct)); }
  catch (e) { K = null; return nav ? gate() : new Response('locked', { status: 401 }); }
  const ext = (rel.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase(), h = { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'no-store' };
  if (ext === 'html') { let s = new TextDecoder().decode(pt); const tag = `<script src="${BASE}_lock/client.js"></script>`;
    s = /<head[^>]*>/i.test(s) ? s.replace(/<head[^>]*>/i, m => m + tag) : tag + s; return new Response(s, { headers: h }); }
  return new Response(pt, { headers: h });
}
self.addEventListener('fetch', e => { const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== 'GET' || !u.pathname.startsWith(BASE)) return;
  let rel = decodeURIComponent(u.pathname.slice(BASE.length)); if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  if (rel.startsWith('_lock/') || rel === 'ollo-sw.js' || /\.mp3$/i.test(rel) || rel === 'robots.txt') return;
  e.respondWith(handle(e.request, rel)); });
