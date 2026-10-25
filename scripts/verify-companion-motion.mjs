import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
  args[key.slice(2)] = process.argv[i + 1]?.startsWith('--') ? true : process.argv[++i] ?? true;
}
if (args.help || !args.playwright || !args.out) {
  console.log('Usage: node scripts/verify-companion-motion.mjs --playwright /path/to/playwright-core --out /path/to/validation [--url http://127.0.0.1:3211/companion-animation.html] [--screenshots false --reuse-screenshots true]');
  process.exit(args.help ? 0 : 1);
}
const target = new URL(args.url || 'http://127.0.0.1:3211/companion-animation.html');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) throw new Error('Validation only opens a local preview URL.');
const out = path.resolve(args.out);
await mkdir(out, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(path.resolve(args.playwright));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1060 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(45000);
const errors = [], warnings = [], externalRequests = [], failedRequests = [], badResponses = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => {
  if (m.type() === 'error') errors.push(m.text());
  if (m.type() === 'warning') warnings.push(m.text());
});
page.on('requestfailed', r => failedRequests.push({ url: r.url(), failure: r.failure() }));
page.on('response', r => { if (r.status() >= 400) badResponses.push({ url: r.url(), status: r.status() }); });
page.on('request', request => {
  const url = request.url();
  if (/^https?:/.test(url) && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) externalRequests.push(url);
});
let report;
try {
  await page.goto(target.href, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__COMPANION_ANIMATION_READY__ === true);
  await page.evaluate(() => {
    const p = window.__companionAnimationPreview;
    if (!p?.THREE || !p.model || !p.controller || !p.renderer || !p.render) throw new Error('Animation preview contract incomplete.');
    p.stopLoop?.();
    p.controller.pause();
  });

  report = await page.evaluate(() => {
    const p = window.__companionAnimationPreview;
    const { THREE: T, model, controller: c } = p;
    const states = ['idle', 'wave', 'encourage', 'correct', 'retry', 'thinking', 'celebrate'];
    const meshes = [], bones = [];
    model.traverse(o => { if (o.isMesh && o.geometry?.attributes.position) meshes.push(o); if (o.isBone) bones.push(o); });
    if (!meshes.length || !bones.length) throw new Error('Real mesh and bones are required.');
    const clips = model.animations || [];
    const byName = Object.fromEntries(clips.map(clip => [clip.name, clip]));
    const v = new T.Vector3();
    const inheritedVisible = o => { for (let n = o; n; n = n.parent) if (!n.visible) return false; return true; };
    function sync() { model.updateMatrixWorld(true); for (const mesh of meshes) if (mesh.isSkinnedMesh) mesh.skeleton.update(); }
    function positions() {
      sync();
      return meshes.map(mesh => {
        const arr = new Float64Array(mesh.geometry.attributes.position.count * 3);
        for (let i = 0; i < arr.length / 3; i++) {
          // getVertexPosition includes morph targets AND applyBoneTransform on SkinnedMesh.
          mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld);
          arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
        }
        return arr;
      });
    }
    function difference(a, b, subset = null) {
      let max = 0, sq = 0, changed = 0, nonFinite = 0, count = 0;
      for (let m = 0; m < a.length; m++) for (let i = 0; i < a[m].length; i += 3) {
        if (subset && !subset[m].has(i / 3)) continue;
        const d = Math.hypot(a[m][i] - b[m][i], a[m][i + 1] - b[m][i + 1], a[m][i + 2] - b[m][i + 2]);
        if (!Number.isFinite(d)) nonFinite++;
        else { max = Math.max(max, d); sq += d * d; if (d > 1e-7 * H) changed++; }
        count++;
      }
      return { max, maxH: max / H, rmsH: Math.sqrt(sq / Math.max(1, count)) / H, changedVertices: changed, vertices: count, nonFinite };
    }
    function envelope(points) {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]; let nonFinite = 0;
      for (const arr of points) for (let i = 0; i < arr.length; i++) {
        if (!Number.isFinite(arr[i])) nonFinite++; else { min[i % 3] = Math.min(min[i % 3], arr[i]); max[i % 3] = Math.max(max[i % 3], arr[i]); }
      }
      return { min, max, size: min.map((n, i) => max[i] - n), nonFinite };
    }
    const bonePose = () => bones.map(b => [...b.position.toArray(), ...b.quaternion.toArray(), ...b.scale.toArray()]);
    const poseDelta = (a, b) => Math.max(0, ...a.flatMap((row, i) => row.map((n, j) => Math.abs(n - b[i][j]))));
    c.setReducedMotion(true); c.reset(); c.pause(); sync();
    const rest = positions(), restBounds = envelope(rest), H = restBounds.size[1], restBonePose = bonePose();
    if (!Number.isFinite(H) || H <= 0) throw new Error('Rest figure height is not positive and finite.');
    const geometryRest = meshes.map(mesh => {
      const a = mesh.geometry.attributes.position, arr = new Float64Array(a.count * 3);
      for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(mesh.matrixWorld); arr.set(v.toArray(), i * 3); }
      return arr;
    });
    const rawRestParity = difference(rest, geometryRest);
    const frozenGeometry = meshes.map(mesh => ({ name: mesh.userData.sourceNodeName || mesh.name, attributes: Object.fromEntries(['position', 'normal', 'uv', 'skinIndex', 'skinWeight']
      .filter(key => mesh.geometry.attributes[key]).map(key => [key, Array.from(mesh.geometry.attributes[key].array)])),
      index: mesh.geometry.index ? Array.from(mesh.geometry.index.array) : null, visible: inheritedVisible(mesh) }));
    const binding = { positions: [], skinIndices: [], skinWeights: [], partIds: [], jointCount: 0 };
    const weightResults = [], regionNames = ['Hand', 'Clavicle', 'UpperArm', 'Shin', 'Hair'];
    const regions = Object.fromEntries(regionNames.map(n => [n, meshes.map(() => new Set())]));
    for (let mi = 0; mi < meshes.length; mi++) {
      const mesh = meshes[mi], a = mesh.geometry.attributes, count = a.position.count;
      const row = { name: mesh.name, vertices: count, skinned: !!mesh.isSkinnedMesh, maxWeightSumError: 0, badWeights: 0, badIndices: 0, minIndex: Infinity, maxIndex: -Infinity };
      if (mesh.isSkinnedMesh && a.skinIndex && a.skinWeight) {
        binding.jointCount = Math.max(binding.jointCount, mesh.skeleton.bones.length);
        for (let i = 0; i < count; i++) {
          let sum = 0;
          binding.positions.push([a.position.getX(i), a.position.getY(i), a.position.getZ(i)]); binding.partIds.push(mesh.name);
          for (let j = 0; j < 4; j++) {
            const index = a.skinIndex.getComponent(i, j), weight = a.skinWeight.getComponent(i, j);
            binding.skinIndices.push(index); binding.skinWeights.push(weight); sum += weight;
            if (!Number.isFinite(weight) || weight < 0) row.badWeights++;
            if (!Number.isInteger(index) || index < 0 || index >= mesh.skeleton.bones.length) row.badIndices++;
            row.minIndex = Math.min(row.minIndex, index); row.maxIndex = Math.max(row.maxIndex, index);
            const name = mesh.skeleton.bones[index]?.name || '';
            if (weight > .01) for (const region of regionNames) if (name.includes(region)) regions[region][mi].add(i);
          }
          row.maxWeightSumError = Math.max(row.maxWeightSumError, Math.abs(sum - 1));
        }
      }
      weightResults.push(row);
    }
    const hairBones = bones.filter(b => /Hair\d/.test(b.name));
    const landmarks = { hip: 'hips', head: 'head', 'hand.l': 'leftHand', 'hand.r': 'rightHand', 'foot.l': 'leftFoot', 'foot.r': 'rightFoot' };
    const resolved = Object.fromEntries(Object.entries(landmarks).map(([key, name]) => [key, bones.find(b => b.name === name)]));
    const missingLandmarks = Object.entries(resolved).filter(([, bone]) => !bone).map(([key]) => key);
    const stateResults = [], sampledClips = [], resetResults = [], deformationMeshes = {};
    let nonFiniteCount = 0, maxScaleDelta = 0;
    c.setReducedMotion(false); c.pause();
    for (const state of states) {
      const clip = byName[state];
      if (!clip || !(clip.duration > 0)) { stateResults.push({ state, status: 'fail', reason: 'No actual named clip with positive duration.' }); continue; }
      // The author explicitly declares both feet planted for the full duration of every standing gesture.
      const sampled = { sourceName: state, duration: clip.duration, sampleTimes: [], landmarkPositions: Object.fromEntries(Object.keys(landmarks).map(k => [k, []])), jointScaleDelta: [],
        stance: { 'foot.l': [[0, clip.duration]], 'foot.r': [[0, clip.duration]] } };
      let maxVertexDeltaH = 0, maxBBoxExtentH = 0, maxHairRotationRadians = 0;
      const morphMaxWeights = {}, hairMotionByBone = Object.fromEntries(hairBones.map(b => [b.name, 0])), regionDeltasH = Object.fromEntries(regionNames.map(n => [n, 0])), frames = [], firstLast = [];
      for (let ti = 0; ti < 25; ti++) {
        const time = clip.duration * ti / 24;
        c.sample(state, time); sync();
        const points = positions(), delta = difference(points, rest), bounds = envelope(points);
        nonFiniteCount += bounds.nonFinite;
        maxVertexDeltaH = Math.max(maxVertexDeltaH, delta.maxH);
        maxBBoxExtentH = Math.max(maxBBoxExtentH, ...bounds.size.map(n => n / H));
        for (const region of regionNames) regionDeltasH[region] = Math.max(regionDeltasH[region], difference(points, rest, regions[region]).maxH);
        const scaleDelta = Math.max(0, ...bones.flatMap(b => b.scale.toArray().map(s => Math.abs(s - 1))));
        maxScaleDelta = Math.max(maxScaleDelta, scaleDelta);
        sampled.sampleTimes.push(time); sampled.jointScaleDelta.push(scaleDelta);
        for (const [key, bone] of Object.entries(resolved)) if (bone) sampled.landmarkPositions[key].push(bone.getWorldPosition(v).toArray());
        for (const bone of hairBones) {
          const angle = bone.quaternion.angleTo(new T.Quaternion(...restBonePose[bones.indexOf(bone)].slice(3, 7)));
          hairMotionByBone[bone.name] = Math.max(hairMotionByBone[bone.name], angle); maxHairRotationRadians = Math.max(maxHairRotationRadians, angle);
        }
        for (const mesh of meshes) for (const [name, index] of Object.entries(mesh.morphTargetDictionary || {})) morphMaxWeights[name] = Math.max(morphMaxWeights[name] || 0, Math.abs(mesh.morphTargetInfluences[index] || 0));
        for (const mesh of meshes) {
          const entry = deformationMeshes[mesh.name] ||= { frames: 0, verticesPerFrame: mesh.geometry.attributes.position.count };
          entry.frames++;
        }
        frames.push({ time, delta, bounds, bonePositions: Object.fromEntries(bones.map(b => [b.name, b.getWorldPosition(v).toArray()])) });
        if (ti === 0 || ti === 24) firstLast.push(bonePose());
      }
      sampled.poseReturn = Math.max(0, ...bones.map((_, i) => new T.Quaternion(...firstLast[0][i].slice(3, 7)).angleTo(new T.Quaternion(...firstLast[1][i].slice(3, 7))) * 180 / Math.PI));
      if (!missingLandmarks.length) sampledClips.push(sampled);
      stateResults.push({ state, duration: clip.duration, status: maxVertexDeltaH > 1e-7 && maxVertexDeltaH < 2 && maxBBoxExtentH < 3 && !nonFiniteCount ? 'pass' : 'fail', maxVertexDeltaH, maxBBoxExtentH, maxHairRotationRadians, hairMotionByBone, regionDeltasH, morphMaxWeights, frames });
      c.reset(); c.pause(); sync();
      resetResults.push({ state, maxBindRestoreDelta: poseDelta(bonePose(), restBonePose), vertices: difference(positions(), rest) });
    }
    // Compare binding against an independently evaluated interpolant, not the controller's own diagnostics.
    const bindingClips = {}; let maxSampledBindingDelta = 0; const bindingErrors = [];
    for (const clip of clips) {
      c.setReducedMotion(true); c.pause(); sync();
      const mixer = new T.AnimationMixer(model), action = mixer.clipAction(clip);
      action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play();
      let maxDelta = 0;
      for (let i = 0; i < 5; i++) {
        const t = clip.duration * i / 4; mixer.setTime(t); sync();
        for (const track of clip.tracks) {
          try {
            const expected = track.createInterpolant().evaluate(t), actual = new Float64Array(track.getValueSize());
            const property = new T.PropertyBinding(model, track.name); property.bind(); property.getValue(actual, 0); property.unbind();
            for (let j = 0; j < expected.length; j++) {
              const delta = Math.abs(actual[j] - expected[j]);
              if (!Number.isFinite(delta)) throw new Error('Binding produced a nonfinite actual/expected value.');
              maxDelta = Math.max(maxDelta, delta);
            }
          } catch (e) { bindingErrors.push({ clip: clip.name, track: track.name, time: t, message: e.message }); }
        }
      }
      bindingClips[clip.name] = { sampleCount: 5, trackCount: clip.tracks.length, maxSampledBindingDelta: maxDelta };
      maxSampledBindingDelta = Math.max(maxSampledBindingDelta, maxDelta); mixer.stopAllAction(); mixer.uncacheRoot(model);
    }
    c.setReducedMotion(false); c.pause();
    const morphTests = [];
    c.sample('idle', 0); c.pause();
    for (const mesh of meshes) {
      const dictionary = mesh.morphTargetDictionary || {}, saved = mesh.morphTargetInfluences?.slice();
      if (!saved) continue;
      for (const [name, index] of Object.entries(dictionary)) {
        mesh.morphTargetInfluences.fill(0); const zero = positions();
        mesh.morphTargetInfluences[index] = 1; const one = positions();
        const delta = difference(one, zero), target = mesh.geometry.morphAttributes.position?.[index];
        let authoredDelta = 0;
        if (target) for (let i = 0; i < target.count; i++) {
          v.fromBufferAttribute(target, i);
          if (!mesh.geometry.morphTargetsRelative) v.sub(new T.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i));
          authoredDelta = Math.max(authoredDelta, v.length());
        }
        morphTests.push({ mesh: mesh.name, name, index, authoredLocalMaxDelta: authoredDelta,
          status: authoredDelta === 0 ? 'inactive-on-this-mesh' : delta.maxH > 1e-7 ? 'pass' : 'fail', ...delta });
      }
      mesh.morphTargetInfluences.splice(0, saved.length, ...saved);
    }
    const transitions = [];
    for (const from of states) for (const to of states) {
      if (from === to || !byName[from] || !byName[to]) continue;
      c.sample(from, byName[from].duration * .63); c.pause(); const before = positions();
      c.play(to); const atPlay = difference(positions(), before);
      c.update(0); const atZero = difference(positions(), before);
      c.update(1 / 60); const firstFrame = difference(positions(), before);
      transitions.push({ from, to, atPlay, atZero, firstFrame, status: atPlay.maxH <= 1e-7 && atZero.maxH <= 1e-7 ? 'pass' : 'fail' }); c.pause();
    }
    const stress = [];
    for (const [name, changes] of Object.entries({
      shoulders: { leftUpperArm: [0, 0, .8], rightUpperArm: [0, 0, -.8] },
      elbows: { leftForeArm: [.9, 0, 0], rightForeArm: [.9, 0, 0] },
      wrists: { leftHand: [.4, 0, .6], rightHand: [.4, 0, -.6] },
      knees: { leftShin: [1, 0, 0], rightShin: [1, 0, 0] },
    })) {
      c.setReducedMotion(true); c.reset(); c.pause();
      const missingBones = [];
      for (const [boneName, rotation] of Object.entries(changes)) {
        const bone = bones.find(b => b.name === boneName); if (!bone) missingBones.push(boneName); else bone.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(...rotation)));
      }
      const points = positions(), bounds = envelope(points), delta = difference(points, rest);
      stress.push({ name, missingBones, bounds, delta, status: missingBones.length ? 'unevaluated' : bounds.nonFinite || Math.max(...bounds.size) / H >= 3 ? 'fail' : 'measured-only', reason: 'Numerical stress envelope; holes and creases still require visual review.' });
    }
    c.setReducedMotion(false); c.sample('idle', 0); c.pause(); p.render();
    // Keep functions in the page for asynchronous liveness and screenshot checks.
    window.__motionValidation = { positions, difference, rest, H, bones, meshes, restBonePose, byName, sync, envelope };
    const visible = meshes.filter(inheritedVisible);
    return { schemaVersion: 1, measuredAt: new Date().toISOString(), assetUrl: model.userData.runtimeAsset, frame: 'world-space after morph + skin + mesh.matrixWorld', H, restBounds, rawRestParity,
      states, clipRoster: clips.map(clip => ({ name: clip.name, duration: clip.duration, tracks: clip.tracks.length })), meshes: weightResults, boneNames: bones.map(b => b.name),
      sourceBufferParity: { status: 'unevaluated', reason: 'Requires original freeze manifest and derived buffer verification from rig producer; rawRestParity only compares deformation at rest with loaded raw positions.' },
      rawRestParityStatus: rawRestParity.maxH <= 1e-7 ? 'pass' : 'fail', stateResults, resetResults, morphTests, transitions, stress, missingLandmarks,
      bindingSamples: { maxSampledBindingDelta, clips: bindingClips, errors: bindingErrors }, deformation: { allFinite: nonFiniteCount === 0, nonFiniteCount, meshes: deformationMeshes },
      meshVisibility: { visibleMeshCount: visible.length, visibleSkinnedMeshCount: visible.filter(m => m.isSkinnedMesh).length },
      binding, sampledClips, maxScaleDelta, chainAnchors: {
        joints: bones.filter(b => !/Hair\d/.test(b.name)).map(b => ({ id: b.name, parent: b.parent?.isBone ? b.parent.name : null, localPosition: restBonePose[bones.indexOf(b)].slice(0, 3) })),
        sideLabels: Object.fromEntries(bones.filter(b => !/Hair\d/.test(b.name) && /^(left|right)/.test(b.name)).map(b => [b.name, b.name.startsWith('left') ? 'l' : 'r'])),
        provenance: 'External source-facing convention explicitly confirmed by parent: approved original front is +Z; +X is character left. Labels use authored names, never measured X sign.',
      }, hair: { bones: hairBones.map(b => b.name), weightedVertexCount: regions.Hair.reduce((sum, set) => sum + set.size, 0) },
      frozenGeometry, diagnostics: c.getDiagnostics(), metrics: p.getMetrics() };
  });

  const liveness = await page.evaluate(async () => {
    const p = window.__companionAnimationPreview, { controller: c } = p, h = window.__motionValidation;
    const snapshot = () => ({ diagnostics: c.getDiagnostics(), metrics: p.getMetrics(), points: h.positions() });
    const stable = (a, b) => ({ vertices: h.difference(a.points, b.points), before: { diagnostics: a.diagnostics, metrics: a.metrics }, after: { diagnostics: b.diagnostics, metrics: b.metrics } });
    const wait = () => new Promise(resolve => setTimeout(resolve, 220));
    const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    p.setReducedMotion(false); p.selectState('wave'); document.querySelector('#toggle-play').click();
    c.sample('wave', .8); c.pause(); await settle(); let a = snapshot(); c.update(.8); await wait(); let b = snapshot();
    const paused = stable(a, b);
    p.setReducedMotion(true); c.play('celebrate'); await settle(); a = snapshot(); c.update(1.7); await wait(); b = snapshot();
    const reducedMotion = stable(a, b); reducedMotion.restDelta = h.difference(b.points, h.rest);
    p.setReducedMotion(false); p.selectState('idle'); await settle(); a = snapshot(); await wait(); b = snapshot();
    const playing = stable(a, b); c.pause(); p.stopLoop?.();
    return { paused, reducedMotion, playing };
  });
  report.liveness = liveness;
  // Native visibility is exercised via the browser lifecycle. An unsupported browser method is explicit missing coverage.
  try {
    if (args.visibility !== 'true') throw new Error('Native freeze probe was not requested; lifecycle freezing does not establish the visibilitychange path. Standard headless APIs do not expose visibilityState control.');
    const session = await page.context().newCDPSession(page);
    await page.evaluate(() => { const p = window.__companionAnimationPreview; p.setReducedMotion(false); p.selectState('idle'); });
    await session.send('Page.setWebLifecycleState', { state: 'frozen' });
    await session.send('Page.setWebLifecycleState', { state: 'active' });
    const hidden = await page.evaluate(async () => {
      const p = window.__companionAnimationPreview, c = p.controller, h = window.__motionValidation;
      // Document.visibilityState cannot be set by standard browser JS; dispatching a fake event would not test real hiding.
      const before = { state: document.visibilityState, diagnostics: c.getDiagnostics(), metrics: p.getMetrics() };
      await new Promise(resolve => setTimeout(resolve, 120));
      return { before, after: { state: document.visibilityState, diagnostics: c.getDiagnostics(), metrics: p.getMetrics() } };
    });
    report.hidden = { status: hidden.before.state === 'hidden' ? 'measured-only' : 'unevaluated', ...hidden,
      reason: 'Lifecycle freeze/active completed; a visible headless document does not establish the page visibilitychange pause path.' };
    await session.detach();
  } catch (e) { report.hidden = { status: 'unevaluated', reason: `Native visibility could not be driven: ${e.message}` }; }

  const screenshotPaths = [];
  if (args.screenshots !== 'false') {
    await mkdir(path.join(out, 'frames'), { recursive: true });
    await page.evaluate(() => { const p = window.__companionAnimationPreview; p.stopLoop?.(); p.controller.pause(); });
    await page.screenshot({ path: path.join(out, 'page-desktop.png'), fullPage: true });
    await page.addStyleTag({ content: '#model-stage{width:1000px!important;height:1199px!important}.scenario-column,.detail-column,.stage-topline,.dialogue,.stage-guide,.asset-credit{visibility:hidden!important}' });
    await page.evaluate(() => { const p = window.__companionAnimationPreview; p.resize({ resetZoom: true }); p.stopLoop?.(); });
    const canvas = page.locator('canvas').first();
    for (const [state, fraction] of [['thinking', .52], ['celebrate', .5]]) {
      const duration = report.stateResults.find(s => s.state === state)?.duration;
      if (!duration) continue;
      await page.evaluate(({ state, time }) => { const p = window.__companionAnimationPreview; p.controller.sample(state, time); p.controller.pause(); p.setView(0); p.render(); }, { state, time: duration * fraction });
      const filename = `preview-${state}-front.png`; await canvas.screenshot({ path: path.join(out, filename) }); screenshotPaths.push(filename);
    }
    for (const state of report.stateResults.filter(s => s.duration > 0)) {
      for (let key = 0; key < 4; key++) for (const angle of [-35, 35, -90, 90]) {
        const filename = `frames/${state.state}-t${key}-${angle}.png`;
        await page.evaluate(({ state, time, angle }) => {
          const p = window.__companionAnimationPreview;
          p.controller.sample(state, time); p.controller.pause(); p.setView(angle); p.render();
        }, { state: state.state, time: state.duration * key / 3, angle });
        await canvas.screenshot({ path: path.join(out, filename) }); screenshotPaths.push(filename);
      }
      for (const angle of [0, 180]) {
        const filename = `frames/${state.state}-middle-${angle}.png`;
        await page.evaluate(({ state, time, angle }) => { const p = window.__companionAnimationPreview; p.controller.sample(state, time); p.controller.pause(); p.setView(angle); p.render(); }, { state: state.state, time: state.duration / 2, angle });
        await canvas.screenshot({ path: path.join(out, filename) }); screenshotPaths.push(filename);
      }
    }
    for (const name of ['shoulders', 'elbows', 'wrists', 'knees']) {
      for (const angle of [-35, 35, 90, 180]) {
        const filename = `frames/stress-${name}-${angle}.png`;
        await page.evaluate(({ name, angle }) => {
          const p = window.__companionAnimationPreview, T = p.THREE;
          p.controller.setReducedMotion(true); p.controller.reset(); p.controller.pause();
          const changes = { shoulders: { leftUpperArm: [0, 0, .8], rightUpperArm: [0, 0, -.8] }, elbows: { leftForeArm: [.9, 0, 0], rightForeArm: [.9, 0, 0] }, wrists: { leftHand: [.4, 0, .6], rightHand: [.4, 0, -.6] }, knees: { leftShin: [1, 0, 0], rightShin: [1, 0, 0] } }[name];
          for (const [boneName, rotation] of Object.entries(changes)) window.__motionValidation.bones.find(b => b.name === boneName)?.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(...rotation)));
          p.setView(angle); p.render();
        }, { name, angle });
        await canvas.screenshot({ path: path.join(out, filename) }); screenshotPaths.push(filename);
      }
    }
    await page.evaluate(() => { const p = window.__companionAnimationPreview; p.controller.setReducedMotion(false); p.controller.sample('idle', 0); p.controller.pause(); p.setView(0); p.render(); });
  }
  report.screenshots = { count: screenshotPaths.length, paths: screenshotPaths, sweep: { clips: report.stateResults.filter(s => s.duration > 0).length, times: 4, sides: 2, azimuths: 2, frames: screenshotPaths.filter(p => /-t\d-/.test(p)).length },
    integrityGate: { status: 'unevaluated', reason: 'Screenshots do not measure split pixels or dark creases. No measured same-subject control baseline was supplied.' } };
  if (args.screenshots === 'false' && args['reuse-screenshots'] === 'true') {
    const prior = JSON.parse(await readFile(path.join(out, 'runtime-report.json'), 'utf8'));
    if (!prior.screenshots?.count) throw new Error('No existing screenshot record to reuse.');
    report.screenshots = { ...prior.screenshots, reusedFromEarlierRun: true, reason: 'Explicitly reused after the author confirmed the GLB/controller were unchanged; this run refreshes runtime and browser checks.' };
    screenshotPaths.push(...report.screenshots.paths);
  }
  report.browser = { errors: [...new Set(errors)], warnings: [...new Set(warnings)], externalRequests: [...new Set(externalRequests)], failedRequests, badResponses };
  const appWarnings = warnings.filter(s => !/GPU stall due to ReadPixels|Automatic fallback to software WebGL/.test(s));
  const failedChecks = [];
  const check = (ok, label) => { if (!ok) failedChecks.push(label); };
  check(report.rawRestParityStatus === 'pass', 'Deformed rest differs from loaded raw geometry.');
  check(report.stateResults.length === 7 && report.stateResults.every(s => s.status === 'pass'), 'One or more states do not deform vertices or have an explosive/nonfinite envelope.');
  check(report.meshes.every(m => m.skinned && !m.badWeights && !m.badIndices && m.maxWeightSumError <= 2e-7), 'Skin weights or indices invalid, or a mesh is not skinned.');
  check(report.bindingSamples.maxSampledBindingDelta <= 2 ** -23 && !report.bindingSamples.errors.length, 'Actual clip node binding does not match interpolants.');
  check(report.transitions.every(t => t.status === 'pass'), 'A state switch changes pose before time advances.');
  check(report.morphTests.length > 0 && report.morphTests.every(m => m.status !== 'fail'), 'No real morph targets, or an authored nonzero morph target does not deform geometry.');
  check(report.morphTests.some(m => /blink/i.test(m.name) && m.status === 'pass'), 'No real blink morph deformation was measured.');
  check(report.morphTests.some(m => !/blink/i.test(m.name) && m.status === 'pass'), 'No real expression morph deformation was measured.');
  check(report.stateResults.some(s => Object.entries(s.morphMaxWeights || {}).some(([n, w]) => /blink/i.test(n) && w > 1e-6)), 'Blink morph exists but runtime samples never activate it.');
  check(report.stateResults.some(s => Object.entries(s.morphMaxWeights || {}).some(([n, w]) => !/blink/i.test(n) && w > 1e-6)), 'Expression morph exists but runtime samples never activate it.');
  check(report.hair.bones.length > 0 && report.hair.weightedVertexCount > 0 && report.stateResults.some(s => s.maxHairRotationRadians > 1e-7 && s.regionDeltasH.Hair > 1e-7), 'Hair chain and influenced vertices do not both move.');
  check(report.hair.bones.every(name => report.stateResults.some(s => s.hairMotionByBone?.[name] > 1e-7)), 'One or more declared hair-chain bones never rotate.');
  check(report.maxScaleDelta === 0, 'Authored animation scales joints.');
  check(report.liveness.paused.vertices.maxH <= 1e-7, 'Paused controller changes pose.');
  check(report.liveness.reducedMotion.vertices.maxH <= 1e-7 && report.liveness.reducedMotion.restDelta.maxH <= 1e-7, 'Reduced motion keeps animating or does not return to rest.');
  check(report.liveness.playing.vertices.maxH > 1e-7, 'Playing the idle clip does not advance actual vertices over wall-clock time.');
  const counter = (snapshot, group, keys) => keys.map(k => snapshot[group]?.[k]).find(n => Number.isFinite(n));
  for (const name of ['paused', 'reducedMotion']) {
    const entry = report.liveness[name], before = counter(entry.before, 'metrics', ['renderCount']), after = counter(entry.after, 'metrics', ['renderCount']);
    entry.renderCounterStatus = before === undefined || after === undefined ? 'unevaluated' : before === after ? 'pass' : 'fail';
    check(entry.renderCounterStatus !== 'fail', `${name} continues rendering.`);
    const tickBefore = counter(entry.before, 'diagnostics', ['tickCount']), tickAfter = counter(entry.after, 'diagnostics', ['tickCount']);
    entry.tickCounterStatus = tickBefore === undefined || tickAfter === undefined ? 'unevaluated' : tickBefore === tickAfter ? 'pass' : 'fail';
    check(entry.tickCounterStatus !== 'fail', `${name} continues advancing the animation ticker.`);
  }
  check(!errors.length && !appWarnings.length && !externalRequests.length && !badResponses.length && !failedRequests.length, 'Browser, CSP, texture/network or external request findings.');
  report.summary = { ok: failedChecks.length === 0, failedChecks, note: 'Runtime checks only. All twelve plugin gates are not claimed passed; missing evidence remains unevaluated.' };

  // Runtime objects retain node names; the freeze uses GLB mesh names. Join through the actual
  // GLB node.mesh relationship, never by traversal order or by index-pairing vertex arrays.
  try {
    if (!/^\/companion\/[\w.-]+\.glb$/.test(report.assetUrl)) throw new Error('Unexpected local asset namespace.');
    const glbBytes = await readFile(new URL(`../public${report.assetUrl}`, import.meta.url));
    if (glbBytes.readUInt32LE(0) !== 0x46546c67 || glbBytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Asset is not a JSON-first GLB.');
    const glb = JSON.parse(glbBytes.subarray(20, 20 + glbBytes.readUInt32LE(12)).toString('utf8'));
    const nameMap = new Map(glb.nodes.filter(n => n.mesh !== undefined).map(n => [n.name, glb.meshes[n.mesh]]));
    report.geometryNameMapping = [];
    for (const mesh of report.frozenGeometry) {
      const source = nameMap.get(mesh.name);
      if (!source || source.primitives.length !== 1) throw new Error(`No unambiguous node.mesh mapping for ${mesh.name}.`);
      const expectedCount = glb.accessors[source.primitives[0].attributes.POSITION].count;
      if (mesh.attributes.position.length / 3 !== expectedCount) throw new Error(`Runtime vertex count does not match GLB node.mesh for ${mesh.name}.`);
      report.geometryNameMapping.push({ runtimeNode: mesh.name, glbMesh: source.name, vertices: expectedCount });
      mesh.sourceNodeName = mesh.name; mesh.name = source.name;
    }
  } catch (e) { report.geometryNameMappingError = e.message; }
  const gatePayload = { figureHeight: report.H, clipNames: report.clipRoster.map(c => c.name), binding: report.binding,
    deformation: report.deformation, meshVisibility: report.meshVisibility, clips: report.sampledClips, chainAnchors: report.chainAnchors, sourceScalesJoints: false };
  if (!report.bindingSamples.errors.length) gatePayload.bindingSamples = report.bindingSamples;
  if (report.resetResults.length) gatePayload.bindRestore = { maxBindRestoreDelta: Math.max(...report.resetResults.map(r => r.maxBindRestoreDelta)) };
  // Existing producer evidence is copied verbatim; absent reports never become synthetic passes.
  const rigReferencePath = args['rig-reference'] ? path.resolve(args['rig-reference']) : path.join(path.dirname(out), 'glb-rig-reference.json');
  try { gatePayload.rigReference = { source: 'glb', glb: JSON.parse(await readFile(rigReferencePath, 'utf8')) }; } catch {}
  const freezePath = args.freeze ? path.resolve(args.freeze) : path.join(path.dirname(out), 'geometry-freeze.json');
  try {
    gatePayload.meshParity = { manifest: JSON.parse(await readFile(freezePath, 'utf8')), after: { meshes: report.frozenGeometry } };
    report.sourceBufferParity = { status: 'pending-gate', manifestPath: freezePath, reason: 'Original freeze and actual runtime buffers supplied to G11; see plugin verdict for byte comparison.' };
  } catch {}
  await writeFile(path.join(out, 'rig-gate-payload.json'), JSON.stringify(gatePayload));
  await writeFile(path.join(out, 'meshes-after.json'), JSON.stringify({ meshes: report.frozenGeometry }));
  await writeFile(path.join(out, 'sampled-clips.json'), JSON.stringify({ figureHeight: report.H, clips: report.sampledClips }));
  delete report.binding; delete report.frozenGeometry; delete report.sampledClips;
  await writeFile(path.join(out, 'runtime-report.json'), JSON.stringify(report, null, 2));
  const statuses = report.stateResults.map(s => `| ${s.state} | ${s.status} | ${s.maxVertexDeltaH?.toFixed(6) ?? '—'} | ${s.maxHairRotationRadians?.toFixed(6) ?? '—'} |`).join('\n');
  await writeFile(path.join(out, 'runtime-report.md'), `# Actual motion validation\n\nRuntime result: **${report.summary.ok ? 'pass' : 'fail'}**. Figure height H = ${report.H}. All measurements use actual morphed and skinned vertices in world space.\n\n| State | Runtime check | Maximum vertex delta / H | Hair local rotation / rad |\n| --- | --- | --- | --- |\n${statuses}\n\n${failedChecks.length ? failedChecks.map(s => `- ${s}`).join('\n') : 'No runtime smoke-check failures.'}\n\nG7 uses the explicitly supplied source-facing side claims. G8 uses the author's full-duration planted-feet declaration. G11 receives the original freeze manifest and actual runtime buffers when available. G10 still needs a measured split/crease pixel baseline. Object_13 (48 vertices) and Object_16 (34 vertices) are fully sampled but cannot satisfy the plugin's literal 64-vertex minimum. Native hidden visibility: ${report.hidden.status}. The runtime result does not claim all twelve gates pass.\n\nFull measurements: runtime-report.json. Actual plugin input: rig-gate-payload.json. Captured frames: ${screenshotPaths.length}.\n`);
  console.log(JSON.stringify({ out, ...report.summary, screenshots: screenshotPaths.length, bindingDelta: report.bindingSamples.maxSampledBindingDelta, rawRestParityH: report.rawRestParity.maxH }));
  if (!report.summary.ok) process.exitCode = 1;
} catch (e) {
  await page.screenshot({ path: path.join(out, 'failure-page.png'), fullPage: true }).catch(() => {});
  await writeFile(path.join(out, 'failure-report.json'), JSON.stringify({ message: e.message, stack: e.stack, errors, warnings, externalRequests, failedRequests, badResponses }, null, 2));
  console.error(e.stack); process.exitCode = 1;
} finally { await browser.close(); }
