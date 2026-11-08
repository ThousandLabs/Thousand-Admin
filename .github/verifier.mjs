/* Thousand Labs — contrôle automatique à chaque envoi sur GitHub.
   Vérifie : code JavaScript sans erreur de syntaxe, fichiers essentiels présents et non vides,
   service worker (hors ligne) présent si l'appli l'utilise, fichiers qu'il met en cache existants,
   manifeste lisible, clé publique d'activation bien formée.
   En cas de problème : croix rouge sur le commit et e-mail de GitHub. */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
let bad = 0;
const err = m => { console.log('::error::' + m); bad++; };
const ok = m => console.log('OK  ' + m);
const syntax = (code, label) => {
  const tmp = '/tmp/tl-check.js'; fs.writeFileSync(tmp, code);
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); ok('syntaxe ' + label); }
  catch (e) { err('Erreur de syntaxe dans ' + label + ' : ' + String(e.stderr || e).split('\n').slice(0, 5).join(' ')); }
};
if (!fs.existsSync('index.html') || fs.statSync('index.html').size < 200) err('index.html manquant ou vide');
else {
  const html = fs.readFileSync('index.html', 'utf8');
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(s => s.trim());
  scripts.forEach((s, i) => syntax(s, 'index.html (script ' + (i + 1) + ')'));
  if (/serviceWorker\.register\(\s*['"]\.?\/?sw\.js/.test(html)) {
    if (!fs.existsSync('sw.js') || fs.statSync('sw.js').size < 200) err('sw.js manquant ou vide : l\'appli ne marcherait plus hors ligne');
    else {
      const sw = fs.readFileSync('sw.js', 'utf8'); syntax(sw, 'sw.js');
      if (!/addEventListener\(\s*['"]fetch/.test(sw)) err('sw.js ne gère plus les requêtes (hors ligne cassé)');
      const lists = [...sw.matchAll(/const (?:ASSETS|EXTRA) = \[([^\]]*)\]/g)].map(m => m[1]).join(',');
      [...lists.matchAll(/['"]\.\/([^'"?]+)/g)].map(m => m[1]).filter(f => f && !f.endsWith('/')).forEach(f => fs.existsSync(f) ? ok('fichier en cache présent : ' + f) : err('sw.js met en cache un fichier absent : ' + f));
    }
  }
  for (const m of html.matchAll(/crv"?\s*:\s*"P-256"\s*,\s*"?x"?\s*:\s*"([^"]*)"\s*,\s*"?y"?\s*:\s*"([^"]*)"/g))
    (m[1].length === 43 && m[2].length === 43) ? ok('clé publique bien formée') : err('clé publique d\'activation mal formée');
}
const man = ['manifest.webmanifest', 'manifest.json'].find(f => fs.existsSync(f));
if (man) { try { const j = JSON.parse(fs.readFileSync(man, 'utf8')); (j.icons || []).forEach(ic => { const f = String(ic.src).split('?')[0]; fs.existsSync(f) ? ok('icône ' + f) : err('icône du manifeste absente : ' + f); }); ok('manifeste lisible'); } catch (e) { err(man + ' illisible : ' + e.message); } }
console.log(bad ? `\n${bad} problème(s) trouvé(s).` : '\nTout est en ordre.');
process.exit(bad ? 1 : 0);
