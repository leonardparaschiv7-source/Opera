// node karte/build.mjs  ->  setzt die komplette Speisekarte (data.mjs) in das 3D-Buch von index.src.html
// und schreibt index.src.html + index.html (identisch). Läuft beliebig oft (Marker KARTE:START/END).
import { readFileSync, writeFileSync } from 'node:fs';
import { sections, wine } from './data.mjs';

const root = new URL('../', import.meta.url);
// Höhenmodell in cqw (Seitenbreite = 100); mit karte/messen.js im Browser gegen die echten Höhen geprüft.
const CAP = Number(process.env.CAP || 92);   // nutzbare Listenhöhe einer Seite
const CPL = Number(process.env.CPL || 58);   // Zeichen pro Beschreibungszeile
const K = Number(process.env.K || 1);        // Kalibrierfaktor
const BASE = 5.5, LINE = 4.1, TITLE = 7, HINT = 6.5, DIV = 17, ILLH = 6, MIN_DIV = 36;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ILL = { antipasti: 'olive', pizza: 'pizza', pesce: 'fisch', dolci: 'eis' };
const LOGO = '<img src="logo/opera-nav.webp" alt="Opera">';

const weinSec = {
  id: wine.id, it: wine.it, de: wine.de,
  groups: wine.colors.flatMap((c) => [
    { title: `${c.title} · Flasche`, items: c.bottles.map(([n, p, t]) => [n, p, t, '0,75 l']) },
    { title: `${c.title} · offen 0,2 l`, items: [...c.glass, ['Wein 0,5 l', c.half], ...(c.halfExtra ? [c.halfExtra] : [])] },
  ]),
};
const all = [...sections, weinSec];

const text = (d) => (d ? (Array.isArray(d) ? d.join(' · ') : d) : '');
const cost = (it) => K * (BASE + (it[2] ? 0.5 + LINE * Math.ceil(text(it[2]).length / CPL) : 0));

// ---- Seiten aufbauen: echte Höhen aus heights.json (karte/messen.mjs); ohne Datei grobe Schätzung ----
let H = null;
try { H = JSON.parse(readFileSync(new URL('./heights.json', import.meta.url), 'utf8')); } catch { /* erster Lauf */ }
const GAP = H ? H.gap : 1.6, SAFE = Number(process.env.SAFE || 0.4);
const capFor = () => (H ? H.cap.plain - SAFE : CAP);
const gtext = (r) => `${r.g}${r.sub ? ' ' + r.sub : ''}${r.cont ? ' Fortsetzung' : ''}`;
const hOf = (r) => {
  if (r.k) return H?.items['k|' + r.k.it] ?? DIV;
  if (r.hint) return H?.items['h|' + r.hint] ?? HINT;
  if (r.g) return H?.items['g|' + gtext(r)] ?? H?.gAvg ?? TITLE;
  return H?.items['p|' + r.it[0] + '|' + r.it[1]] ?? cost(r.it);
};
const need = (r, first) => hOf(r) + (first ? 0 : GAP + (r.k ? H?.kMargin ?? 2.5 : r.g ? H?.gMargin ?? 1.5 : 0));

const pages = []; // {sec, first, rows}
const firstPage = new Map();
let page = null, used = 0, cap = 0;
const openPage = (sec, first) => {
  page = { sec, first, rows: [] }; pages.push(page);
  used = 0;
  cap = capFor('plain'); // alle Seiten haben denselben Kopf
};
const push = (r) => { used += need(r, !page.rows.length); page.rows.push(r); };
const fits = (...rs) => { let u = used, n = page.rows.length; for (const r of rs) { u += need(r, !n); n++; } return u <= cap; };
const SPLIT_MIN = 8; // nur Gruppen ab 5 Einträgen dürfen umbrechen, mit mindestens 2 Zeilen auf jeder Seite
// Umbrechen dürfen: lange Listen (ab 8), Gerichte mit Beschreibung ab 5 (z. B. Rind), 4 Weine mit langer Beschreibung (2 + 2).
// Kurze Getränkelisten ohne Beschreibung bleiben zusammen.
const canSplit = (g) => g.items.length >= SPLIT_MIN
  || (g.items.length >= 5 && g.items.some((it) => it[2]))
  || (g.items.length >= 4 && g.items.reduce((a, it) => a + hOf({ it }), 0) / g.items.length >= 12);
const minBlock = (g) => [...(g.title ? [{ g: g.title, sub: g.sub }] : []), ...g.items.slice(0, canSplit(g) ? 2 : g.items.length).map((it) => ({ it }))];

function placeGroup(s, g) {
  let items = g.items.slice(), started = false;
  while (items.length) {
    const title = g.title ? (started ? { g: g.title, cont: true } : { g: g.title, sub: g.sub }) : null;
    const all = [...(title ? [title] : []), ...items.map((it) => ({ it }))];
    if (fits(...all)) { all.forEach(push); return; }
    if (canSplit({ items })) {
      let k = 0;
      while (k < items.length && fits(...(title ? [title] : []), ...items.slice(0, k + 1).map((it) => ({ it })))) k++;
      if (items.length - k < 2) k = items.length - 2;
      if (k >= 2) {
        if (title) push(title);
        items.slice(0, k).forEach((it) => push({ it }));
        items = items.slice(k); started = true;
        openPage(s, false);
        continue;
      }
    }
    if (!page.rows.length) { all.forEach(push); return; } // leere Seite und trotzdem zu groß: nicht endlos laufen
    openPage(s, false);
  }
}

const chapterRows = (s) => [
  ...((s.note || s.footnote) ? [{ hint: s.note || s.footnote }] : []),
  ...s.groups.flatMap((g) => [...(g.title ? [{ g: g.title, sub: g.sub }] : []), ...g.items.map((it) => ({ it }))]),
];
const sumNeed = (rs) => rs.reduce((a, r, i) => a + need(r, !i), 0);
const MIN_START = 3; // ein Kapitel, das unten auf einer Seite beginnt und weiterläuft, braucht dort mindestens 3 Einträge

for (const s of all) {
  const hint = (s.note || s.footnote) ? { hint: s.note || s.footnote } : null;
  const rows = chapterRows(s);
  const single = sumNeed(rows) <= capFor(); // passt das ganze Kapitel auf eine Seite?
  const g0 = s.groups[0];
  const start = [{ k: s }, ...(hint ? [hint] : []), ...(single ? rows.filter((r) => !r.hint) : [...(g0.title ? [{ g: g0.title, sub: g0.sub }] : []), ...g0.items.slice(0, canSplit(g0) ? MIN_START : g0.items.length).map((it) => ({ it }))])];
  // einseitiges Kapitel: nur mitten auf der Seite beginnen, wenn es dort ganz Platz hat; sonst neue Seite
  if (page && fits(...start)) push({ k: s });
  else openPage(s, true);
  firstPage.set(s.id, pages.length - 1);
  if (hint) push(hint);
  for (const g of s.groups) placeGroup(s, g);
}
if (process.env.DEBUG) {
  const nm = (r) => (r.k ? '[' + r.k.it + ']' : r.hint ? 'hint' : r.g ? '<' + r.g + (r.cont ? '+' : '') + '>' : r.it[0]);
  pages.forEach((p, i) => console.log(String(i + 2).padStart(2), p.sec.id.padEnd(9), p.rows.length, nm(p.rows[0]), '…', nm(p.rows[p.rows.length - 1])));
}

// Inhaltsseite = erste Seite der Folge (Seitennummer im Buch = 2 + Index)
const inhalt = {
  inhalt: true,
  rows: all.map((s) => `<div class="ziel"><a href="#speisekarte" data-seite="${3 + firstPage.get(s.id)}" aria-label="${esc(s.it)}, ${esc(s.de)}">${esc(s.it)}</a><i>${esc(s.de)}</i></div>`),
};

const rowHtml = (r) => {
  if (r.k) return `<div class="kapitel"><h3>${esc(r.k.it)}</h3></div>`;
  if (r.hint) return `<p class="hinweis kopf">${esc(r.hint)}</p>`;
  if (r.g) return `<p class="gruppe">${esc(r.g)}${r.sub ? ` <small>${esc(r.sub)}</small>` : ''}${r.cont ? ' <small>Fortsetzung</small>' : ''}</p>`;
  const [n, p, d, tag] = r.it;
  return `<div class="pos"><div class="zeile"><span class="n">${esc(n)}</span>${tag ? `<span class="tag">${esc(tag)}</span>` : ''}<span class="fuell" aria-hidden="true"></span><span class="p">${esc(p)}</span></div>${d ? `<p class="b">${esc(text(d))}</p>` : ''}</div>`;
};

const side = (p, back) => {
  const cls = `seite dicht${back ? ' hinterseite' : ''}`;
  if (p.inhalt) {
    return `<div class="${cls}">
              <p class="folio">${LOGO}</p>
              <h2>Die Karte</h2>
              <img class="trenner" src="art/trenner.webp" alt="" aria-hidden="true">
              <nav class="inhalt" aria-label="Kapitel">${p.rows.join('')}</nav>
              <p class="hinweis">Alle Preise in Euro.</p>
            </div>`;
  }
  if (p.filler) {
    return `<div class="${cls}">
              <div class="emb"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-olive"/></svg></div>
              <p class="folio">${LOGO}</p>
              <p class="gross" style="margin-top:auto;margin-bottom:auto">Buon appetito.</p>
            </div>`;
  }
  return `<div class="${cls}">
              <p class="folio">${LOGO}</p>
              <h2>${esc(p.sec.it)}</h2>
              <img class="trenner" src="art/trenner.webp" alt="" aria-hidden="true">
              <div class="liste">${p.rows.map(rowHtml).join('')}</div>
            </div>`;
};

const sides = [inhalt, ...pages];
if (sides.length % 2) sides.push({ filler: true });
let leaves = '';
for (let i = 0; i < sides.length; i += 2) {
  leaves += `
          <div class="blatt">
            ${side(sides[i], false)}
            ${side(sides[i + 1], true)}
          </div>
`;
}
const block = `<!-- KARTE:START (erzeugt von karte/build.mjs, nicht von Hand ändern) -->${leaves}          <!-- KARTE:END -->`;

let src = readFileSync(new URL('index.src.html', root), 'utf8');
src = src.split('<p class="hinweis">Preise und die vollständige Karte erhalten Sie im Restaurant.</p>').join('');
src = src.split('<p class="folio">Opera Pforzheim</p>').join(`<p class="folio">${LOGO}</p>`);
if (src.includes('<!-- KARTE:START')) {
  src = src.replace(/<!-- KARTE:START[\s\S]*?<!-- KARTE:END -->/, () => block);
} else {
  const a = src.indexOf('<!-- Blatt 1: Antipasti | Pizza -->');
  const b = src.indexOf('<!-- Blatt 3: Reservierung | Grazie -->');
  if (a < 0 || b < 0) throw new Error('Alte Blätter nicht gefunden');
  src = src.slice(0, a) + block + '\n\n          ' + src.slice(b);
}
writeFileSync(new URL('index.src.html', root), src);
writeFileSync(new URL('index.html', root), src);
console.log(`Seiten: ${pages.length} + Inhalt, Blätter: ${sides.length / 2} (CAP ${CAP})`);
