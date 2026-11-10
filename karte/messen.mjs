// node karte/messen.mjs [url]  ->  schreibt karte/heights.json (echte Zeilenhöhen aus headless Chrome)
// Voraussetzung: opera-premium wird unter http://localhost:5200/ ausgeliefert (preview "opera-premium").
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!chrome) throw new Error('Chrome/Edge nicht gefunden');
const url = process.argv[2] || 'http://localhost:5200/karte/messen.html';
const dom = execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=20000', '--window-size=1440,900', '--dump-dom', url], { encoding: 'utf8', maxBuffer: 1 << 26 });
const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
if (!m || m[1] === 'wait') throw new Error('Messung fehlgeschlagen (Server auf :5200 läuft?)');
const json = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
writeFileSync(new URL('./heights.json', import.meta.url), JSON.stringify(json));
console.log('Zeilen:', Object.keys(json.items).length, 'cap:', json.cap, 'gap:', json.gap, 'gMargin:', json.gMargin, 'kMargin:', json.kMargin);
