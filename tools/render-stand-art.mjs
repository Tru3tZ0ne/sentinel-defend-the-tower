import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';

const { server, url } = await startServer(0);
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.goto(url + '/stand-sangfor.html');
  const assets = await page.evaluate(async () => {
    const { renderStandArtwork } = await import('/tools/render-stand-art-page.js');
    return renderStandArtwork();
  });
  const dir = new URL('../assets/stand-sangfor/', import.meta.url);
  await mkdir(dir, { recursive: true });
  for (const [id, data] of Object.entries(assets)) {
    await writeFile(new URL(id + '.webp', dir), Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('Rendered ' + Object.keys(assets).length + ' previews from the game meshes.');
} finally { await browser.close(); server.close(); }
