/* Thousand Admin — service worker : appli disponible hors ligne, mises à jour automatiques */
const CACHE = 'thousand-admin-v2.9';
const PREFIX = 'thousand-admin-v'; /* les applis Thousand Labs partagent le même domaine : on ne touche qu'à NOS caches */
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png?v=3', './icon-512.png?v=3', './apple-touch-icon.png?v=3'];
const OFFLINE = () => new Response(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;padding:24px;text-align:center"><h2>Hors ligne</h2><p>Ouvrez l\'appli une fois avec une connexion pour l\'activer hors ligne, puis réessayez.</p></body>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  if (r.mode === 'navigate') {
    /* Réseau d'abord (pour recevoir les mises à jour), mais :
       • au bout de 3 s sans réponse (connexion lente), on ouvre la copie enregistrée ;
       • on n'enregistre que la vraie page de l'appli (pas une erreur 404 ni la page
         de connexion d'un wifi public, qui remplaceraient l'appli hors ligne). */
    const good = res => res && res.ok && !res.redirected && res.type === 'basic';
    const net = fetch(r).then(res => { if (good(res)) { const cp = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); } return res; });
    e.waitUntil(net.then(() => {}, () => {}));
    const cached = () => caches.match('./index.html').then(m => m || caches.match('./'));
    e.respondWith(new Promise(done => {
      let sent = false; const send = x => { if (!sent && x) { sent = true; done(x); } };
      const timer = setTimeout(() => cached().then(send), 3000);
      net.then(res => { if (good(res)) { clearTimeout(timer); send(res); } else cached().then(m => { clearTimeout(timer); send(m || res); }); })
        .catch(() => { clearTimeout(timer); cached().then(m => send(m || OFFLINE())); });
    }));
    return;
  }

  e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => {
    if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }
    return res;
  })));
});
