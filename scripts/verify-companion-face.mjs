import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

// A bounded regression check for appended facial POSITION/NORMAL morph targets.
// The full standing-rig sweep is retained separately; no duplicate gate claim.
const require = createRequire(import.meta.url);
const playwrightPath = process.argv[process.argv.indexOf('--playwright') + 1];
if (!process.argv.includes('--playwright') || !playwrightPath) throw new Error('Pass --playwright /path/to/playwright-core');
const { chromium } = require(path.resolve(playwrightPath));
const out = path.resolve('.img2threejs/imported-glb/animation/validation/face-final');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1060 }, deviceScaleFactor: 1 });
const events = { errors: [], warnings: [], failedRequests: [], badResponses: [], externalRequests: [] };
page.on('pageerror', e => events.errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') events.errors.push(m.text()); if (m.type() === 'warning') events.warnings.push(m.text()); });
page.on('requestfailed', r => events.failedRequests.push({ url: r.url(), failure: r.failure() }));
page.on('response', r => { if (r.status() >= 400) events.badResponses.push({ url: r.url(), status: r.status() }); });
page.on('request', r => { if (/^https?:/.test(r.url()) && !['localhost', '127.0.0.1'].includes(new URL(r.url()).hostname)) events.externalRequests.push(r.url()); });
try {
  await page.goto('http://127.0.0.1:3211/companion-animation.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__COMPANION_ANIMATION_READY__ === true, null, { timeout: 60000 });
  const face = await page.evaluate(() => {
    const p = window.__companionAnimationPreview, T = p.THREE;
    p.stopLoop(); p.controller.setReducedMotion(false); p.controller.sample('idle', 0); p.controller.pause();
    const rows = [], v = new T.Vector3();
    p.model.traverse(mesh => {
      if (!mesh.isMesh || !mesh.morphTargetInfluences) return;
      const g = mesh.geometry, checks = [];
      const original = [...mesh.morphTargetInfluences];
      for (const weights of [[0, 0], [.5, 0], [1, 0], [0, .5], [0, 1], [1, 1]]) {
        mesh.morphTargetInfluences.splice(0, 2, ...weights);
        p.model.updateMatrixWorld(true); mesh.skeleton?.update();
        let nonFinite = 0, badNormal = 0, minNormalLength = Infinity;
        for (let i = 0; i < g.attributes.position.count; i++) {
          mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
          if (!v.toArray().every(Number.isFinite)) nonFinite++;
          v.fromBufferAttribute(g.attributes.normal, i);
          for (let target = 0; target < 2; target++) {
            const a = g.morphAttributes.normal[target];
            v.x += a.getX(i) * weights[target]; v.y += a.getY(i) * weights[target]; v.z += a.getZ(i) * weights[target];
          }
          const length = v.length();
          if (!Number.isFinite(length) || length < 1e-5) badNormal++;
          minNormalLength = Math.min(minNormalLength, length);
        }
        checks.push({ weights, vertices: g.attributes.position.count, nonFinite, badNormal, minNormalLength });
      }
      mesh.morphTargetInfluences.splice(0, 2, ...original);
      rows.push({ mesh: mesh.name, material: mesh.material.name, normalTargets: g.morphAttributes.normal.length, checks });
    });
    p.controller.sample('idle', 0); p.controller.pause(); p.render();
    return rows;
  });
  const headSetup = await page.evaluate(() => {
    const p = window.__companionAnimationPreview;
    // Prevent the other preview column overlapping an expanded close-up canvas.
    document.querySelector('.detail-column').style.visibility = 'hidden';
    const stage = document.getElementById('model-stage'); stage.style.width = '1000px'; stage.style.height = '1132px';
    p.resize();
    let head; p.model.traverse(o => { if (o.isBone && o.name === 'head') head = o; });
    p.model.updateMatrixWorld(true);
    const target = head.getWorldPosition(new p.THREE.Vector3()); target.y += .07;
    return target.toArray();
  });
  for (const angle of [0, 35]) for (const [name, time] of [['open', 0], ['closed', 1.62]]) {
    await page.evaluate(({ angle, time, target }) => {
      const p = window.__companionAnimationPreview;
      p.controller.sample('idle', time); p.controller.pause();
      p.setCamera({ azimuth: angle, target, distance: 1.2, fov: 30 }); p.render();
    }, { angle, time, target: headSetup });
    await page.locator('#main-canvas').screenshot({ path: path.join(out, `head-${angle}-${name}.png`) });
  }
  await page.evaluate(() => {
    const p = window.__companionAnimationPreview, stage = document.getElementById('model-stage');
    document.querySelector('.detail-column').style.removeProperty('visibility');
    stage.style.removeProperty('width'); stage.style.removeProperty('height'); p.camera.fov = 32; p.camera.updateProjectionMatrix(); p.resize();
    p.setView(0); p.selectState('wave'); p.controller.sample('wave', 1.2); p.controller.pause(); p.render();
  });
  await page.screenshot({ path: path.join(out, 'page-desktop.png'), fullPage: true });
  const layouts = [];
  for (const viewport of [{ width: 820, height: 1180 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    const layout = await page.evaluate(() => {
      const p = window.__companionAnimationPreview; p.resize(); p.render();
      const rect = document.getElementById('main-canvas').getBoundingClientRect();
      const buttons = [...document.querySelectorAll('[data-state]')].map(b => ({ state: b.dataset.state, width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height }));
      return { viewport: [innerWidth, innerHeight], scrollWidth: document.documentElement.scrollWidth, canvas: { width: rect.width, height: rect.height }, buttons };
    });
    layouts.push(layout);
    await page.screenshot({ path: path.join(out, `page-${viewport.width}.png`), fullPage: true });
  }
  const freeze = JSON.parse(await readFile('.img2threejs/imported-glb/animation/geometry-freeze.json', 'utf8'));
  const authoring = JSON.parse(await readFile('.img2threejs/imported-glb/animation/motion-authoring.json', 'utf8'));
  const report = { date: new Date().toISOString(), scope: 'Face morph normal revision and responsive layout; retained full rig tests apply to unchanged joints/weights/clips.', animatedSha256: authoring.outputSha256, originalGeometryAccessorsUnchanged: authoring.originalGeometryAccessorsUnchanged, face, layouts, events, freezePath: '.img2threejs/imported-glb/animation/geometry-freeze.json', frozenSource: freeze.source || freeze.sourceAsset || null };
  await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const faults = face.flatMap(r => r.checks).filter(c => c.nonFinite || c.badNormal);
  console.log(JSON.stringify({ faceMeshes: face.length, checks: face.length * 6, faults: faults.length, layouts, events, report: path.join(out, 'report.json') }));
  if (faults.length || events.errors.length || events.badResponses.length || events.externalRequests.length) process.exitCode = 1;
} finally { await browser.close(); }
