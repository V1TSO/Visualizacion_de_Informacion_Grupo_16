// Evidencia de una versión para el documento de entrega: capturas fijas y, con --video,
// un recorrido grabado con su sonido. Los pasos siguen la interfaz de V2 en adelante (portada,
// historia y «Explora tú»); si una versión cambia un control, ese paso se omite con un aviso.
// Uso:
//   npm run capture -- --out docs/evidencia/v1                 construye y sirve el checkout actual
//   npm run capture -- --dist ruta/al/dist --out …             un build ya hecho (p. ej. de un tag)
//   npm run capture -- --url https://…/v1/ --out …             una versión publicada
//   … --video                                                  además graba recorrido.mp4 (ffmpeg vía uv)
import { createServer } from 'node:http';
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { launch } from './browser.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const out = resolve(option('out') ?? 'docs/evidencia/actual');
const pause = ms => new Promise(done => setTimeout(done, ms));

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
function serve(dir) {
  const server = createServer((req, res) => {
    let file = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (file !== dir && !file.startsWith(dir + sep)) return res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });
  return new Promise(ready => server.listen(0, '127.0.0.1', () => ready(server)));
}

let url = option('url'), server;
if (!url) {
  if (!option('dist')) execSync('npm run build', { stdio: 'inherit' });
  server = await serve(resolve(option('dist') ?? 'dist'));
  url = `http://127.0.0.1:${server.address().port}/`;
}

const scene = (page, i) => page.locator('.step .card').nth(i).scrollIntoViewIfNeeded().then(() => page.evaluate(i => {
  const card = document.querySelectorAll('.step .card')[i];
  scrollBy(0, card.getBoundingClientRect().top - innerHeight * 0.3);
}, i));
async function open(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('.horizon').waitFor({ timeout: 30000 });
  await pause(2000);
}
const errors = [];
const watch = page => {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
};

const browser = await launch();
mkdirSync(out, { recursive: true });

// Capturas: [archivo, acción previa]. Las escenas se cuentan desde 0 en el orden de src/story.ts.
const shots = [
  ['01-portada', async () => {}],
  ...[[0, '02-escena-madruga'], [1, '03-escena-midtown'], [3, '04-escena-sale-a-pasear'], [4, '05-escena-trasnocha'], [5, '06-escena-pesa-mas'], [6, '07-escena-termina-cerca'], [7, '08-escena-rapida'], [10, '09-escena-resumen']]
    .map(([i, name]) => [name, page => scene(page, i)]),
  ['10-explora', page => page.locator('#explorar').scrollIntoViewIfNeeded()],
];
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
watch(desktop);
await open(desktop);
for (const [name, action] of shots) {
  try {
    await action(desktop);
    await pause(2600);
    await desktop.screenshot({ path: join(out, `${name}.png`) });
    console.log(`✓ ${name}.png`);
  } catch (error) {
    console.warn(`⚠ Omitida ${name}: ${error.message.split('\n')[0]}`);
  }
}
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
watch(phone);
await open(phone);
await phone.screenshot({ path: join(out, '11-movil.png') });
console.log('✓ 11-movil.png');

if (args.includes('--video')) await record();
await browser.close();
server?.close();
if (errors.length) console.warn(`Errores de la página:\n- ${[...new Set(errors)].join('\n- ')}`);

// Recorrido de ~60 s con sonido: la historia escena por escena y después «Explora tú».
// El audio se toma de la salida de Web Audio (MediaRecorder) y se une al video con ffmpeg.
async function record() {
  const tmp = mkdtempSync(join(tmpdir(), 'recorrido-'));
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: tmp, size: { width: 1280, height: 800 } } });
  await context.addInitScript(tapAudio);
  const videoStart = Date.now();
  const page = await context.newPage();
  watch(page);
  const scenes = await page.goto(url, { waitUntil: 'networkidle' }).then(() => page.locator('.step .card').count());
  const steps = [
    async () => { await page.locator('.horizon').waitFor({ timeout: 30000 }); await pause(2500); },
    async () => { await page.getByRole('button', { name: 'Empezar con sonido' }).click(); await pause(2000); },
    ...Array.from({ length: scenes }, (_, i) => async () => { await scene(page, i); await pause(4200); }),
    async () => { await page.locator('#explorar').scrollIntoViewIfNeeded(); await pause(1500); },
    async () => { await page.getByRole('button', { name: 'Reproducir el día' }).click(); await pause(12000); await page.getByRole('button', { name: 'Pausar' }).click(); },
    async () => { await page.fill('#zone', 'East Village'); await pause(3500); },
    async () => { const more = page.locator('details.more summary'); if (await more.count()) await more.click(); await page.getByRole('button', { name: 'Flujos' }).click(); await pause(4000); },
  ];
  for (const step of steps) await step().catch(error => console.warn(`⚠ Paso omitido: ${error.message.split('\n')[0]}`));
  const audio = await page.evaluate(() => window.__stopAudio());
  const audioStart = await page.evaluate(() => window.__audioStartEpoch);
  await context.close();
  const video = await page.video().path();
  const target = join(out, 'recorrido.mp4');
  const input = ['-i', video];
  if (audio) {
    const offset = Math.max(0, (audioStart - videoStart) / 1000);
    console.log(`  audio desde ${offset.toFixed(2)} s del video`);
    writeFileSync(join(tmp, 'audio.webm'), Buffer.from(audio, 'base64'));
    input.push('-itsoffset', String(offset), '-i', join(tmp, 'audio.webm'), '-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '128k');
  }
  try {
    execFileSync(ffmpeg(), ['-y', '-loglevel', 'error', ...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '27', '-movflags', '+faststart', target]);
    console.log(`✓ recorrido.mp4${audio ? ' (con sonido)' : ' (sin sonido: no se activó el audio)'}`);
    rmSync(tmp, { recursive: true, force: true });
  } catch (error) {
    console.warn(`⚠ No se pudo unir video y audio (${error.message.split('\n')[0]}). Archivos crudos en ${tmp}`);
  }
}

function ffmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    return execFileSync('uv', ['run', '--quiet', '--with', 'imageio-ffmpeg', 'python', '-c', 'import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim();
  } catch {
    return 'ffmpeg';
  }
}

// Se inyecta en la página antes que la app: copia a un MediaRecorder todo lo que llega a los
// parlantes. Graba desde que el contexto de audio corre.
function tapAudio() {
  const connect = AudioNode.prototype.connect;
  let recorder;
  const chunks = [];
  AudioNode.prototype.connect = function (target, ...rest) {
    const result = connect.call(this, target, ...rest);
    if (target instanceof AudioDestinationNode) {
      const context = this.context;
      if (!context.__tap) {
        context.__tap = context.createMediaStreamDestination();
        // Chrome no entrega cuadros mientras el grafo está en silencio y el audio quedaría
        // adelantado: un tono inaudible (−80 dB), solo hacia la grabación, mantiene la línea de tiempo.
        const hum = context.createOscillator(), level = context.createGain();
        hum.frequency.value = 30;
        level.gain.value = 1e-4;
        connect.call(hum, level);
        connect.call(level, context.__tap);
        hum.start();
        const start = () => {
          if (recorder || context.state !== 'running') return;
          recorder = new MediaRecorder(context.__tap.stream, { mimeType: 'audio/webm;codecs=opus' });
          recorder.ondataavailable = event => chunks.push(event.data);
          recorder.start();
          window.__audioStartEpoch = Date.now();
        };
        context.addEventListener('statechange', start);
        start();
      }
      connect.call(this, context.__tap);
    }
    return result;
  };
  window.__stopAudio = () => new Promise(done => {
    if (!recorder) return done(null);
    recorder.onstop = async () => {
      const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
      let text = '';
      for (let i = 0; i < bytes.length; i += 32768) text += String.fromCharCode(...bytes.subarray(i, i + 32768));
      done(btoa(text));
    };
    recorder.stop();
  });
}
