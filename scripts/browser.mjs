// Chromium compartido por capture.mjs y build_doc.mjs.
import { readFileSync } from 'node:fs';
import { createHash, X509Certificate } from 'node:crypto';
import { chromium } from 'playwright-core';

// Detrás de un proxy con inspección TLS, Chromium confía solo en las claves de las CA de ese
// archivo (las mismas que Node usa vía NODE_EXTRA_CA_CERTS); no desactiva la verificación.
function trustedKeys() {
  const file = process.env.CAPTURE_TRUST_CA ?? process.env.NODE_EXTRA_CA_CERTS;
  if (!file) return [];
  const pems = readFileSync(file, 'utf8').match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  return pems.map(pem => createHash('sha256').update(new X509Certificate(pem).publicKey.export({ type: 'spki', format: 'der' })).digest('base64'));
}

export async function launch() {
  // SwiftShader: WebGL por software para que MapLibre dibuje sin GPU.
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
  const keys = trustedKeys();
  if (keys.length) args.push(`--ignore-certificate-errors-spki-list=${keys.join(',')}`);
  try {
    return await chromium.launch({ args, executablePath: process.env.CHROME_PATH });
  } catch (error) {
    try {
      return await chromium.launch({ args, channel: 'chrome' });
    } catch {
      throw new Error(`No encontré Chromium. Instala Google Chrome o define CHROME_PATH=/ruta/al/navegador.\n${error.message}`);
    }
  }
}
