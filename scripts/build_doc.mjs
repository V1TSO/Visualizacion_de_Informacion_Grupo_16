// Genera el PDF de la Entrega 2 desde DESIGN_E2.md (estructura de la plantilla, sección 11).
// Uso: npm run doc  →  docs/build/Entrega2_Grupo16.pdf (y docs/build/entrega2.html para imprimir a mano)
// Cada campo con límite lleva un comentario <!-- máx N --> tras su título: el script mide las
// líneas tal como quedan en el PDF (hasta el siguiente título de igual o mayor nivel) y avisa.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { marked } from 'marked';
import { launch } from './browser.mjs';

const dir = 'docs/build', source = 'DESIGN_E2.md', html = `${dir}/entrega2.html`, pdf = `${dir}/Entrega2_Grupo16.pdf`;
const css = `
body{margin:0;font:10pt/1.45 'DM Sans',Arial,sans-serif;color:#233d49}
h1,h2{font-family:'Barlow Condensed','Arial Narrow',sans-serif;color:#173c50;letter-spacing:-.2px}
h1{font-size:30pt;line-height:1;margin:0 0 8px}
h2{font-size:17pt;margin:22px 0 8px;padding-bottom:3px;border-bottom:2px solid #f6bd16;break-after:avoid}
h3{font-size:11.5pt;margin:14px 0 4px;break-after:avoid}
h4{font-size:10.5pt;margin:10px 0 3px;break-after:avoid}
p,li{margin:0 0 4px}ul,ol{padding-left:18px;margin:0 0 6px}
a{color:#24668c}code{font-size:8.5pt;background:#eef3f4;padding:0 3px;border-radius:3px}
img{max-width:100%;border:1px solid #d2dde1;border-radius:4px}
.fila{display:flex;gap:8px;margin:6px 0;break-inside:avoid}.fila img{flex:1;min-width:0;max-height:240px;object-fit:contain}
table{width:100%;border-collapse:collapse;font-size:8.5pt;margin:6px 0}
th,td{border:1px solid #d2dde1;padding:3px 6px;text-align:left;vertical-align:top}th{background:#eef3f4}
blockquote{margin:6px 0;padding:6px 10px;border:1px dashed #c39515;border-radius:4px;background:#fff8e1;color:#6b5a1e}
blockquote p{margin:0}
mark{background:#ffe680;color:#4a3a00;padding:0 2px;border-radius:2px}
.portada{height:240mm;display:flex;flex-direction:column;justify-content:center;break-after:page}
.portada .curso{color:#746020;margin:0 0 14px}.portada h1{font-size:40pt}
.portada dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:28px 0 0}.portada dt{font-weight:700}.portada dd{margin:0}
`;
const fonts = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=DM+Sans:wght@400;600;700&display=swap';

mkdirSync(dir, { recursive: true });
const markdown = readFileSync(source, 'utf8');
const pending = markdown.match(/\[completar[^\]]*\]/g) ?? [];
if (pending.length) console.warn(`⚠ Quedan ${pending.length} campos «[completar…]»:\n${pending.map(p => '  · ' + p.slice(0, 110)).join('\n')}`);
// Lo que falta se ve resaltado en el PDF, para que no se escape nada.
const body = marked.parse(markdown).replace(/\[completar[^\]]*\]/g, m => `<mark>${m}</mark>`);
// <base>: las imágenes se escriben relativas a la raíz del repositorio, igual que al ver DESIGN_E2.md en GitHub.
writeFileSync(html, `<!doctype html><html lang="es"><head><meta charset="utf-8"><base href="../../"><title>Entrega 2 · Grupo 16</title><link rel="stylesheet" href="${fonts}"><style>${css}</style></head><body>${body}</body></html>`);

let browser;
try {
  browser = await launch();
} catch (error) {
  console.warn(`${error.message}\nHTML listo en ${html}: ábrelo en el navegador e imprime como PDF (A4).`);
  process.exit(0);
}
const page = await browser.newPage({ viewport: { width: 673, height: 1000 } }); // ancho útil de A4 con márgenes de 16 mm
await page.emulateMedia({ media: 'print' });
await page.goto(pathToFileURL(resolve(html)).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

const report = await page.evaluate(() => {
  const level = node => node?.nodeType === 1 && /^H[1-6]$/.test(node.tagName) ? Number(node.tagName[1]) : 0;
  const lines = el => {
    if (el.matches('ul,ol,blockquote')) return [...el.children].reduce((sum, child) => sum + lines(child), 0);
    if (el.matches('table')) return el.querySelectorAll('tr').length;
    if (!el.textContent.trim()) return 0; // filas de imágenes
    return Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
  };
  const results = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  for (let note = walker.nextNode(); note; note = walker.nextNode()) {
    const max = note.data.match(/máx\.?\s*(\d+)/i);
    if (!max) continue;
    let title = note.previousSibling;
    while (title && !level(title)) title = title.previousSibling;
    const scope = level(title) || 6;
    let total = 0;
    for (let node = note.nextSibling; node; node = node.nextSibling) {
      if (node.nodeType !== 1) continue;
      if (level(node) && level(node) <= scope) break;
      if (!level(node)) total += lines(node);
    }
    results.push({ title: title?.textContent.trim() ?? '(sin título)', max: Number(max[1]), total });
  }
  return results;
});
for (const { title, max, total } of report) console.log(`${total > max ? '⚠ se pasa' : '✓'} ${title}: ${total}/${max} líneas`);

await page.pdf({
  path: pdf, format: 'A4', printBackground: true,
  margin: { top: '16mm', bottom: '18mm', left: '16mm', right: '16mm' },
  displayHeaderFooter: true, headerTemplate: '<span></span>',
  footerTemplate: '<div style="width:100%;font:8px Arial,sans-serif;color:#607580;text-align:center">Grupo 16 · Entrega 2 · <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
});
await browser.close();
console.log(`PDF listo: ${pdf}`);
