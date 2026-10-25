import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, all) => {
  if (value.startsWith('--')) pairs.push([value.slice(2), all[i + 1]]);
  return pairs;
}, []));
if (!args.playwright || !args.out) {
  console.log('Usage: node scripts/capture-companion-preview.mjs --playwright /path/to/playwright-core --out /path/to/evidence [--url http://127.0.0.1:3210/companion-preview.html]');
  process.exit(args.help ? 0 : 1);
}
const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve(args.playwright));
const output = path.resolve(args.out);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1520, height: 1100 }, deviceScaleFactor: 1 });
const errors = [];
const consoleWarnings = [];
const externalRequests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' || message.type() === 'warning') consoleWarnings.push(message.text());
});
page.on('request', request => {
  if (/^https?:/.test(request.url()) && !/^http:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(request.url())) externalRequests.push(request.url());
});
try {
  await page.goto(args.url || 'http://127.0.0.1:3210/companion-preview.html');
  await page.waitForFunction(() => window.__IMG2THREEJS_READY__ === true, { timeout: 30000 });
  const uiChecks = [];
  if (args.validate === 'true') {
    for (const [angle, label] of [[90,'左侧'],[180,'背面'],[270,'右侧'],[0,'正面']]) {
      await page.locator(`button[data-view="${angle}"]`).click();
      const actual = await page.locator('#view-label').textContent();
      if (actual !== label) throw new Error(`View control failed: ${label}`);
    }
    uiChecks.push('front/side/back controls');
    await page.locator('button[data-background="dark"]').click();
    if (await page.locator('#model-stage').getAttribute('data-background') !== 'dark') throw new Error('Dark background failed');
    await page.locator('button[data-background="light"]').click();
    uiChecks.push('light/dark background controls');
    await page.locator('#main-canvas').focus();
    await page.keyboard.press('ArrowRight');
    await page.locator('#reset-view').click();
    if (await page.locator('#view-label').textContent() !== '正面') throw new Error('Reset failed');
    uiChecks.push('keyboard rotation and reset');
    for (const [name,width,height] of [['tablet',820,1180],['mobile',375,812]]) {
      await page.setViewportSize({width,height});
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const layout = await page.evaluate(() => ({ width:innerWidth, scrollWidth:document.documentElement.scrollWidth,
        canvasWidth:document.querySelector('#main-canvas').width }));
      if (layout.scrollWidth > layout.width + 1 || layout.canvasWidth < 1) throw new Error(`${name} layout overflow`);
      await page.screenshot({path:path.join(output,`page-${name}.png`),fullPage:true});
      uiChecks.push(`${name} viewport ${width}x${height}`);
    }
    await page.setViewportSize({width:1520,height:1100});
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const before = await page.evaluate(() => window.__companionPreview.getMetrics().renderCount);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const after = await page.evaluate(() => window.__companionPreview.getMetrics().renderCount);
    if (after !== before) throw new Error('Static preview is continuously rendering');
    uiChecks.push('static on-demand rendering');
  }
  await page.screenshot({ path: path.join(output, 'page-desktop.png'), fullPage: true });
  const metrics = await page.evaluate(() => window.__companionPreview.getMetrics());
  await page.addStyleTag({ content: '#model-stage{width:1028px!important;height:1199px!important}.stage-corner-label,.stage-guide,.reference-column,.detail-column{visibility:hidden}' });
  await page.waitForFunction(() => document.querySelector('#main-canvas').width > 1000 && document.querySelector('#main-canvas').height > 1100);
  const views = [0, 35, -35, 90, 135, 180, 270];
  for (const angle of views) {
    await page.evaluate(degrees => {
      const preview = window.__companionPreview;
      const metrics = preview.getMetrics();
      const frameHeight = 1199 * (3.4 / 1190);
      const imported = metrics.modelUserData.sourceKind === 'imported-glb';
      const fov = imported ? 30 : 5;
      const distance = (imported ? metrics.bounds.size[1] * 1.12 : frameHeight) / (2 * Math.tan(fov * Math.PI / 360));
      window.__IMG2THREEJS_CAPTURE__.setCamera({ azimuth: degrees, target: imported ? metrics.bounds.center : [(514-460)*(3.4/1190),(1190-599.5)*(3.4/1190),0], distance, fov, near:.001, far:1000 });
      window.__companionPreview.renderer.setClearColor(0xf8f8f8, 1);
      window.__companionPreview.render();
    }, angle);
    await page.locator('#main-canvas').screenshot({ path: path.join(output, `view-${angle}.png`) });
  }
  for (const angle of [0, 35]) {
    await page.evaluate(degrees => {
      const { model } = window.__companionPreview;
      const head = model.getObjectByName('head');
      if (!head) throw new Error('Named head geometry missing.');
      head.geometry.computeBoundingBox();
      const center = head.localToWorld(head.geometry.boundingBox.getCenter(head.position.clone().set(0, 0, 0)));
      window.__IMG2THREEJS_CAPTURE__.setCamera({ azimuth: degrees, target: center.toArray(), distance: 1.5, fov:30, near:.001, far:1000 });
    }, angle);
    await page.locator('#main-canvas').screenshot({ path: path.join(output, `head-${angle}.png`) });
  }
  const meshes = await page.evaluate(() => {
    const result = [];
    const { model } = window.__companionPreview;
    model.updateMatrixWorld(true);
    model.traverse(mesh => {
      if (!mesh.isMesh || !mesh.geometry) return;
      const geometry = mesh.geometry;
      result.push({ name: mesh.name, componentId: mesh.userData.componentId || mesh.name,
        positions: Array.from(geometry.attributes.position.array),
        indices: geometry.index ? Array.from(geometry.index.array) : null,
        matrixWorld: Array.from(mesh.matrixWorld.elements),
        visible: mesh.visible });
    });
    return result;
  });
  await writeFile(path.join(output, 'meshes.json'), JSON.stringify({ meshes }));
  const applicationWarnings = consoleWarnings.filter(message => !message.includes('GPU stall due to ReadPixels'));
  await writeFile(path.join(output, 'browser-report.json'), JSON.stringify({ metrics, uiChecks, errors, consoleWarnings, applicationWarnings, externalRequests, views }, null, 2));
  console.log(JSON.stringify({ output, meshCount: metrics.meshCount, triangles: metrics.triangleCount, uiChecks, errors, applicationWarnings, externalRequests }));
  if (errors.length || applicationWarnings.length || externalRequests.length) process.exitCode = 1;
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure-page.png'), fullPage: true }).catch(() => {});
  const status = await page.locator('#load-status').textContent().catch(() => 'unavailable');
  await writeFile(path.join(output, 'failure-report.json'), JSON.stringify({ message:error.message, status, errors, consoleWarnings, externalRequests },null,2));
  console.error(JSON.stringify({ message:error.message, status, errors, consoleWarnings }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
