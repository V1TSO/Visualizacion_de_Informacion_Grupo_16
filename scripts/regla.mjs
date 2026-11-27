// Regla de velocidad imprimible para la maqueta, a tamaño real, y banderitas para recortar.
// Uso: npm run regla -- 120   →  docs/build/regla-120cm.pdf (A4 horizontal, imprimir al 100 %)
// El largo es la distancia desde la salida hasta la marca de 28 km/h: el mismo valor de «Regla (cm)»
// en «Ajustes de la maqueta». Se imprime en tiras que se pegan una sobre la pestaña de la anterior.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch } from './browser.mjs';

const largo = Number(process.argv[2] ?? 120) * 10;   // mm
if (!Number.isFinite(largo) || largo < 200 || largo > 4000) throw new Error('El largo va en cm, entre 20 y 400.');
const MAX = 28, SEG = 255, TAB = 12, H = 42, BOCINA = 15;
const x = kmh => kmh / MAX * largo;
const tiras = Math.ceil(largo / SEG);
const vel = (() => { const t = readFileSync('public/modelo1/datos.js', 'utf8'); return JSON.parse(t.match(/window\.VELOCIDAD = (\[[\s\S]*?\]);/)[1].replace(/,\s*\]/g, ']')); })();

function tira(k) {
  const a = k * SEG, b = Math.min(largo, a + SEG), w = b - a, ultima = k === tiras - 1;
  let s = `<svg width="${w + (ultima ? 30 : TAB)}mm" height="${H}mm" viewBox="0 0 ${w + (ultima ? 30 : TAB)} ${H}">`;
  s += `<rect x="0" y="0" width="${w}" height="${H}" fill="#e7d3b3" stroke="#5b4224" stroke-width=".3"/>`;
  // Zona de la bocina: bajo 15 km/h.
  const z = Math.min(b, x(BOCINA));
  if (z > a) s += `<rect x="0" y="0" width="${z - a}" height="8" fill="#c96f3b"/>`;
  if (z > a && x(BOCINA) - a > 40) s += `<text x="3" y="5.8" font-size="4" fill="#fff" font-weight="700">BAJO 15 KM/H SUENA LA BOCINA</text>`;
  for (let v = 0; v <= MAX * 2; v++) {
    const kmh = v / 2, px = x(kmh) - a;
    if (px < -0.01 || px > w + 0.01) continue;
    const entero = v % 2 === 0, par = kmh % 2 === 0;
    const len = !entero ? 5 : par ? 14 : 9;
    s += `<line x1="${px}" x2="${px}" y1="${H}" y2="${H - len}" stroke="#2b1e10" stroke-width="${par && entero ? 0.6 : 0.35}"/>`;
    const ancla = px < 8 ? 'start' : px > w - 8 && !(k === tiras - 1) ? 'end' : 'middle', dx = ancla === 'start' ? 1.5 : ancla === 'end' ? -1.5 : 0;
    if (entero && par) s += `<text x="${px + dx}" y="${H - 17}" font-size="${kmh % 4 === 0 ? 9 : 7}" text-anchor="${ancla}" fill="#2b1e10" font-weight="700">${kmh}</text>`;
  }
  if (a === 0) s += `<line x1=".6" x2=".6" y1="0" y2="${H}" stroke="#173c50" stroke-width="1.2"/><text x="3" y="${H - 28}" font-size="5" fill="#173c50" font-weight="700">SALIDA</text>`;
  s += `<text x="${w - 2}" y="13" font-size="4" text-anchor="end" fill="#5b4224">km/h · tira ${k + 1} de ${tiras}</text>`;
  if (!ultima) {
    s += `<rect x="${w}" y="0" width="${TAB}" height="${H}" fill="url(#rayas)" stroke="#999" stroke-width=".3" stroke-dasharray="1 1"/>`;
    s += `<text transform="translate(${w + 7.5} ${H / 2}) rotate(-90)" font-size="3.2" text-anchor="middle" fill="#555">PEGAR TIRA ${k + 2} ENCIMA</text>`;
  } else {
    s += `<text x="${w + 3}" y="${H - 6}" font-size="4" fill="#5b4224">${(largo / 10).toLocaleString('es-CL')} cm</text>`;
  }
  return s + '</svg>';
}
function bandera(hora, dia) {
  const c = dia === 0 ? '#245978' : '#b65d23', t = `${String(hora).padStart(2, '0')}:00`, d = dia === 0 ? 'LUN–VIE' : 'FIN DE SEM.';
  // Doble: se dobla por la línea punteada alrededor del palo de brocheta y se pega cara con cara.
  return `<svg width="54mm" height="16mm" viewBox="0 0 54 16"><path d="M27 0 L0 0 L5 8 L0 16 L27 16 Z" fill="${c}"/><path d="M27 0 L54 0 L49 8 L54 16 L27 16 Z" fill="${c}"/>`
    + `<line x1="27" x2="27" y1="0" y2="16" stroke="#fff" stroke-width=".4" stroke-dasharray="1 1"/>`
    + `<text x="16" y="8.2" font-size="6.2" font-weight="700" fill="#fff" text-anchor="middle">${t}</text><text x="16" y="13.4" font-size="3.2" fill="#fff" text-anchor="middle">${d}</text>`
    // La mitad derecha queda detrás al doblar: vista desde atrás se lee derecha, con el palo a la izquierda.
    + `<text x="38" y="8.2" font-size="6.2" font-weight="700" fill="#fff" text-anchor="middle">${t}</text><text x="38" y="13.4" font-size="3.2" fill="#fff" text-anchor="middle">${d}</text></svg>`;
}
const control = '<div class="control"><svg width="100mm" height="6mm" viewBox="0 0 100 6"><line x1="0" x2="100" y1="3" y2="3" stroke="#000" stroke-width=".5"/><line x1=".25" x2=".25" y1="0" y2="6" stroke="#000" stroke-width=".5"/><line x1="99.75" x2="99.75" y1="0" y2="6" stroke="#000" stroke-width=".5"/></svg><span>Esta línea debe medir 10 cm. Si no, imprime al 100 % («tamaño real», sin ajustar a la página).</span></div>';
const defs = '<svg width="0" height="0" style="position:absolute"><defs><pattern id="rayas" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="3" stroke="#ccc" stroke-width="1"/></pattern></defs></svg>';

const porPagina = 3, paginas = [];
for (let p = 0; p < tiras; p += porPagina) {
  const t = Array.from({ length: Math.min(porPagina, tiras - p) }, (_, i) => tira(p + i)).join('');
  paginas.push(`<section class="pagina"><header>Regla de velocidad · 0 a 28 km/h en ${(largo / 10).toLocaleString('es-CL')} cm · El pulso de Nueva York, grupo 16</header>${control}<div class="tiras">${t}</div></section>`);
}
const flags = [];
for (let h = 0; h < 24; h++) flags.push(bandera(h, 0), bandera(h, 1));
paginas.push(`<section class="pagina"><header>Banderitas · azul: lunes a viernes · naranja: fin de semana. Recorta, dobla por la línea punteada alrededor de un palo de brocheta y pega. Clávala donde se detuvo el taxi.</header>`
  + `<p class="ref">Para revisar: ${[[0, 8], [0, 11], [1, 1], [1, 5]].map(([d, h]) => `${d ? 'fin de semana' : 'lun–vie'} ${String(h).padStart(2, '0')}:00 = ${String(vel[d][h]).replace('.', ',')} km/h`).join(' · ')}.</p>`
  + `<div class="banderas">${flags.join('')}</div></section>`);

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
@page{size:A4 landscape;margin:8mm}body{margin:0;font-family:Arial,sans-serif;color:#173c50}
.pagina{break-after:page;display:grid;gap:4mm}.pagina:last-child{break-after:auto}
header{font-size:9pt;font-weight:700}.control{display:flex;align-items:center;gap:4mm;font-size:8pt}
.tiras{display:grid;gap:5mm}.tiras svg{display:block}
.ref{margin:0;font-size:8pt;color:#4c6573}.banderas{display:grid;grid-template-columns:repeat(5,56mm);gap:1.2mm 0}
text{font-family:Arial,sans-serif}
</style></head><body>${defs}${paginas.join('')}</body></html>`;

mkdirSync('docs/build', { recursive: true });
const file = `docs/build/regla-${largo / 10}cm`;
writeFileSync(`${file}.html`, html);
const browser = await launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve(`${file}.html`)).href);
await page.pdf({ path: `${file}.pdf`, preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log(`${file}.pdf: ${tiras} tiras en ${Math.ceil(tiras / porPagina)} hoja(s) y 1 hoja de banderitas. Imprimir al 100 %.`);
