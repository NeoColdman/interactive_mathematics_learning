const stage = document.querySelector('#model-stage');
const mainCanvas = document.querySelector('#main-canvas');
const miniCanvas = document.querySelector('#mini-canvas');
const fallback = document.querySelector('#stage-fallback');
const miniFallback = document.querySelector('#mini-fallback');
const status = document.querySelector('#preview-status');
const loadStatus = document.querySelector('#load-status');
const viewLabel = document.querySelector('#view-label');
const stateLabel = document.querySelector('#state-label');
const dialogue = document.querySelector('#dialogue');
const dialogueText = document.querySelector('#dialogue-text');
const miniDialogue = document.querySelector('#mini-dialogue');
const playButton = document.querySelector('#toggle-play');
const playText = document.querySelector('#play-text');
const playIcon = document.querySelector('#play-icon');
const playbackLabel = document.querySelector('#playback-label');
const resetButton = document.querySelector('#reset-pose');
const reduceInput = document.querySelector('#reduced-motion');
const motionNote = document.querySelector('#motion-note');
const stateButtons = [...document.querySelectorAll('[data-state]')];
const viewButtons = [...document.querySelectorAll('[data-view]')];
const backgroundButtons = [...document.querySelectorAll('button[data-background]')];
const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const states = {
  idle: { name: '安静待机', text: '我在这里陪你，慢慢想就好。', mini: '我在这里陪你。' },
  wave: { name: '欢迎回来', text: '欢迎回来！准备好就开始吧。', mini: '欢迎回来，一起开始吧！' },
  encourage: { name: '答错后的鼓励', text: '这次还没答对，我们再检查一步。需要时可以看看本题提示。', mini: '再检查一步，也可以看看提示。' },
  correct: { name: '首次独立答对', text: '这题你首次独立完成了，做得不错！', mini: '首次独立答对，做得不错！' },
  retry: { name: '订正成功', text: '你找到问题并改过来了！这次订正值得肯定。', mini: '你找到问题并改过来了！' },
  thinking: { name: '查看提示', text: '我们一起看看本题提示，再想想下一步。', mini: '看看本题提示，再想下一步。' },
  celebrate: { name: '一轮达标', text: '这轮五题中至少四题首次独立答对，达标啦！继续保持。', mini: '这轮至少四题首次独立答对，达标啦！' }
};

let preview;
let selectedState = 'idle';
let paused = false;
let originalPose = false;
let failed = false;
let bubbleTimer = 0;
let controllerEventGuard = 0;
let userReducedPreference = false;
let reducedMotion = reducedQuery.matches;
try {
  if (localStorage.getItem('companion-animation-reduced-motion') === 'true') {
    reducedMotion = true;
    userReducedPreference = true;
  }
} catch { /* Device preferences are optional. */ }
reduceInput.checked = reducedMotion;
window.__COMPANION_ANIMATION_READY__ = false;

function withoutControllerEvents(callback) {
  controllerEventGuard++;
  try { return callback(); } finally { controllerEventGuard--; }
}

function revealDialogue() {
  clearTimeout(bubbleTimer);
  dialogue.hidden = false;
  miniDialogue.hidden = false;
  bubbleTimer = setTimeout(() => {
    dialogue.hidden = true;
    miniDialogue.hidden = true;
    bubbleTimer = 0;
  }, 5000);
}

function showState(value) {
  selectedState = value;
  const content = states[value];
  stateLabel.textContent = content.name;
  dialogueText.textContent = content.text;
  miniDialogue.textContent = content.mini;
  for (const button of stateButtons) button.setAttribute('aria-pressed', String(button.dataset.state === value));
  revealDialogue();
}

function showOriginalPose() {
  stateLabel.textContent = '静态原姿态';
  dialogueText.textContent = '已恢复模型的静态原姿态。点选场景，可以继续看动作。';
  miniDialogue.textContent = '静态原姿态';
  for (const button of stateButtons) button.setAttribute('aria-pressed', 'false');
  revealDialogue();
}

function updatePlaybackUI() {
  const ready = Boolean(preview) && !failed;
  playButton.disabled = !ready || reducedMotion;
  resetButton.disabled = !ready;
  playText.textContent = reducedMotion ? '静态显示中' : originalPose ? '播放待机' : paused ? '继续动作' : '暂停动作';
  playIcon.textContent = reducedMotion ? '○' : originalPose || paused ? '▷' : 'Ⅱ';
  playButton.setAttribute('aria-pressed', String(paused));
  playbackLabel.textContent = !ready ? (failed ? '参考立绘' : '人物准备中') : reducedMotion ? '减少动作' : originalPose ? '静态原姿态' : paused ? '已暂停' : document.hidden ? '页面隐藏时暂停' : '正在播放';
  motionNote.textContent = reducedMotion ? '人物保持静止，场景文字仍会准确回应。' : originalPose ? '已恢复模型原姿态。点选场景可再次播放。' : '短动作结束后，会回到安静待机。';
}

function selectState(value) {
  if (!states[value]) return;
  originalPose = false;
  paused = false;
  showState(value);
  if (preview && !failed) {
    withoutControllerEvents(() => {
      if (reducedMotion) {
        preview.controller.reset();
        preview.controller.setReducedMotion(true);
        preview.controller.pause();
      } else {
        preview.controller.resume();
        preview.controller.play(value);
      }
    });
    preview.syncPlayback();
    preview.requestRender();
  }
  updatePlaybackUI();
}

function setReducedMotion(value, { remember = false } = {}) {
  reducedMotion = Boolean(value);
  if (reducedMotion) paused = false;
  reduceInput.checked = reducedMotion;
  if (remember) {
    userReducedPreference = true;
    try { localStorage.setItem('companion-animation-reduced-motion', String(reducedMotion)); } catch { /* The page also works without storage. */ }
  }
  if (preview && !failed) {
    withoutControllerEvents(() => {
      preview.controller.setReducedMotion(reducedMotion);
      if (reducedMotion) {
        preview.controller.reset();
        preview.controller.setReducedMotion(true);
        preview.controller.pause();
      } else if (!originalPose) {
        if (paused) preview.controller.pause();
        else {
          preview.controller.resume();
          preview.controller.play(selectedState);
        }
      }
    });
    preview.syncPlayback();
    preview.requestRender();
  }
  updatePlaybackUI();
}

function showFailure(error) {
  failed = true;
  preview?.stopLoop();
  document.documentElement.dataset.animationReady = 'false';
  window.__COMPANION_ANIMATION_READY__ = false;
  fallback.hidden = false;
  fallback.classList.add('is-error');
  miniFallback.hidden = false;
  loadStatus.textContent = '动作预览暂时无法显示，已保留参考立绘。你仍可点选场景查看文字回应。';
  status.textContent = '已显示参考立绘 · 场景文字可继续体验';
  updatePlaybackUI();
  console.error('动作样板未能加载：', error);
}

async function startPreview() {
  const query = new URL(location.href).searchParams;
  const [THREE, { OrbitControls }, { loadAnimatedMiku }] = await Promise.all([
    import('/vendor/three/three.module.js'),
    import('/vendor/three/OrbitControls.js'),
    import('./load-animated-miku.js')
  ]);
  const renderer = new THREE.WebGLRenderer({ canvas: mainCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  const miniContext = miniCanvas.getContext('2d', { alpha: true });
  if (!miniContext) throw new Error('无法创建小尺寸预览。');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c4bb, 1.1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(-3, 5, 5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xe9f7f3, .5);
  fillLight.position.set(4, 3, -3);
  scene.add(fillLight);
  const { model, controller } = await loadAnimatedMiku(THREE, { onProgress(value) {
    loadStatus.textContent = `正在加载人物与动作… ${Math.round(value * 100)}%`;
  } });
  if (!model?.isObject3D || !controller?.play || !controller?.update) throw new Error('人物动作尚未准备好。');
  scene.add(model);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  if (bounds.isEmpty()) throw new Error('人物模型没有可显示的几何。');
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const height = Math.max(size.y, .1);
  const camera = new THREE.PerspectiveCamera(30, 1, height * .01, height * 30);
  const miniCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, height * .01, height * 30);
  const controls = new OrbitControls(camera, mainCanvas);
  controls.target.copy(center);
  controls.enableDamping = false;
  controls.autoRotate = false;
  controls.enablePan = false;
  controls.minPolarAngle = Math.PI * .2;
  controls.maxPolarAngle = Math.PI * .8;
  controls.minDistance = height * .4;
  controls.maxDistance = height * 8;
  let renderCount = 0;
  let updateCount = 0;
  let requestedRenderFrame = 0;
  let animationFrame = 0;
  let lastUpdateTime = 0;
  let angle = 0;
  let fittedDistance = height * 2.1;
  let background = 'light';
  const requestedFPS = Number(query.get('fps'));
  let targetFPS = requestedFPS >= 30 && requestedFPS <= 60 ? requestedFPS : 30;

  function render() {
    // One WebGL context and one texture set serve the main view and the 2D thumbnail.
    // Render to the existing canvas, copy the front view, then restore the main view.
    renderer.render(scene, miniCamera);
    miniContext.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
    miniContext.drawImage(mainCanvas, 0, 0, miniCanvas.width, miniCanvas.height);
    renderer.render(scene, camera);
    renderCount++;
  }

  function requestRender() {
    if (requestedRenderFrame || document.hidden || failed) return;
    requestedRenderFrame = requestAnimationFrame(() => {
      requestedRenderFrame = 0;
      if (!document.hidden && !failed && !animationFrame) render();
    });
  }

  function canAnimate() {
    return Boolean(preview) && !paused && !reducedMotion && !originalPose && !document.hidden && !failed;
  }

  function tick(timestamp) {
    animationFrame = 0;
    if (!canAnimate() || !controller.getDiagnostics().playing) return;
    const elapsed = lastUpdateTime ? timestamp - lastUpdateTime : 1000 / targetFPS;
    if (elapsed >= 1000 / targetFPS - .5) {
      const delta = Math.min(elapsed / 1000, .1);
      lastUpdateTime = timestamp;
      try {
        controller.update(delta);
        updateCount++;
        render();
      } catch (error) {
        showFailure(error);
        return;
      }
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (requestedRenderFrame) cancelAnimationFrame(requestedRenderFrame);
    animationFrame = 0;
    requestedRenderFrame = 0;
    lastUpdateTime = 0;
  }

  function syncPlayback() {
    stopLoop();
    withoutControllerEvents(() => {
      if (canAnimate()) {
        controller.resume();
        if (controller.getDiagnostics().playing) animationFrame = requestAnimationFrame(tick);
      } else controller.pause();
    });
    updatePlaybackUI();
  }

  controller.subscribe?.(event => {
    if (controllerEventGuard || event.reason === 'auto-return') return;
    reducedMotion = event.reducedMotion;
    reduceInput.checked = reducedMotion;
    if (event.reason === 'play' || event.reason === 'sample') {
      originalPose = false;
      paused = !event.playing;
      if (states[event.state]) showState(event.state);
    } else if (event.reason === 'reset') {
      originalPose = true;
      paused = false;
      showOriginalPose();
    } else if (event.reason === 'pause') {
      paused = !originalPose && !reducedMotion;
    } else if (event.reason === 'resume') {
      paused = false;
      originalPose = false;
    } else if (event.reason === 'reduced-motion') {
      paused = false;
      if (!reducedMotion && event.state === 'rest') {
        originalPose = true;
        showOriginalPose();
      }
    }
    // Events from direct controller calls also drive the preview. Never call back
    // into the controller here: pause/resume would otherwise recurse through emit.
    stopLoop();
    if (event.playing && canAnimate()) animationFrame = requestAnimationFrame(tick);
    else requestRender();
    updatePlaybackUI();
  });

  function labelView(degrees) {
    const names = { 0: '正面', 90: '左侧', 180: '背面', 270: '右侧' };
    viewLabel.textContent = names[degrees] || '自由视角';
    for (const button of viewButtons) button.setAttribute('aria-pressed', String(Number(button.dataset.view) === degrees));
  }

  function setView(degrees = 0, { resetZoom = true } = {}) {
    angle = ((Number(degrees) % 360) + 360) % 360;
    const rad = angle * Math.PI / 180;
    const distance = resetZoom ? fittedDistance : camera.position.distanceTo(controls.target);
    controls.target.copy(center);
    camera.position.set(center.x + Math.sin(rad) * distance, center.y + height * .018, center.z + Math.cos(rad) * distance);
    camera.lookAt(center);
    controls.update();
    labelView(angle);
    requestRender();
  }

  function resize({ resetZoom = false } = {}) {
    const width = Math.max(mainCanvas.clientWidth, 1);
    const viewportHeight = Math.max(mainCanvas.clientHeight, 1);
    renderer.setSize(width, viewportHeight, false);
    camera.aspect = width / viewportHeight;
    camera.updateProjectionMatrix();
    const verticalFit = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const horizontalFit = Math.max(size.x, size.z) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const previousFit = fittedDistance;
    // Leave a little space around hands and moving hair in every action.
    fittedDistance = Math.max(verticalFit, horizontalFit) * 1.25;
    const miniWidth = Math.max(miniCanvas.clientWidth, 1);
    const miniHeight = Math.max(miniCanvas.clientHeight, 1);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    miniCanvas.width = Math.round(miniWidth * ratio);
    miniCanvas.height = Math.round(miniHeight * ratio);
    const miniAspect = miniWidth / miniHeight;
    const miniHalfHeight = Math.max(height * .57, size.x / miniAspect * .57);
    miniCamera.left = -miniHalfHeight * miniAspect;
    miniCamera.right = miniHalfHeight * miniAspect;
    miniCamera.top = miniHalfHeight;
    miniCamera.bottom = -miniHalfHeight;
    miniCamera.position.set(center.x, center.y, center.z + height * 4);
    miniCamera.lookAt(center);
    miniCamera.updateProjectionMatrix();
    if (resetZoom || renderCount === 0) setView(angle);
    else {
      const offset = camera.position.clone().sub(controls.target).multiplyScalar(fittedDistance / previousFit);
      camera.position.copy(controls.target).add(offset);
      camera.lookAt(controls.target);
      controls.update();
    }
    requestRender();
  }

  function setBackground(value) {
    background = value === 'dark' ? 'dark' : 'light';
    stage.dataset.background = background;
    for (const button of backgroundButtons) button.setAttribute('aria-pressed', String(button.dataset.background === background));
    requestRender();
  }

  function setCamera(spec = {}) {
    function vectorFrom(value, fallbackValue) {
      if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(Number.isFinite)) return new THREE.Vector3(...value.slice(0, 3));
      if (value && ['x', 'y', 'z'].every(key => Number.isFinite(value[key]))) return new THREE.Vector3(value.x, value.y, value.z);
      return fallbackValue.clone();
    }
    const target = vectorFrom(spec.target, center);
    const distance = Number.isFinite(spec.distance) && spec.distance > 0 ? spec.distance : fittedDistance;
    const azimuth = THREE.MathUtils.degToRad(Number(spec.azimuth ?? spec.azimuthDeg ?? 0));
    const elevation = THREE.MathUtils.degToRad(Number(spec.elevation ?? spec.elevationDeg ?? 0));
    const position = new THREE.Vector3(target.x + Math.sin(azimuth) * Math.cos(elevation) * distance, target.y + Math.sin(elevation) * distance, target.z + Math.cos(azimuth) * Math.cos(elevation) * distance);
    camera.position.copy(vectorFrom(spec.position, position));
    controls.target.copy(target);
    if (Number.isFinite(spec.fov) && spec.fov > 0 && spec.fov < 180) camera.fov = spec.fov;
    if (Number.isFinite(spec.near) && spec.near > 0) camera.near = spec.near;
    if (Number.isFinite(spec.far) && spec.far > camera.near) camera.far = spec.far;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    controls.update();
    labelView(-1);
    render();
    return { ok: true, position: camera.position.toArray(), target: target.toArray() };
  }

  function getMetrics() {
    let meshCount = 0;
    let triangleCount = 0;
    let vertexCount = 0;
    let skinnedMeshCount = 0;
    model.traverse(object => {
      if (!object.isMesh || !object.geometry) return;
      meshCount++;
      if (object.isSkinnedMesh) skinnedMeshCount++;
      vertexCount += object.geometry.attributes.position?.count || 0;
      triangleCount += (object.geometry.index?.count || object.geometry.attributes.position?.count || 0) / 3;
    });
    const seen = new WeakSet();
    const diagnostics = JSON.parse(JSON.stringify(controller.getDiagnostics?.() ?? {}, (key, value) => {
      if (value?.isObject3D) return { name: value.name, type: value.type };
      if (value && typeof value === 'object') {
        if (seen.has(value)) return '[circular]';
        seen.add(value);
      }
      return value;
    }));
    return {
      ready: window.__COMPANION_ANIMATION_READY__, selectedState, dialogue: dialogueText.textContent, dialogueVisible: !dialogue.hidden,
      reducedMotion, paused, originalPose, hidden: document.hidden, loopActive: Boolean(animationFrame),
      targetFPS, renderCount, updateCount, meshCount, skinnedMeshCount,
      triangleCount: Math.round(triangleCount), vertexCount, background,
      bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray(), center: center.toArray() },
      viewport: { width: mainCanvas.clientWidth, height: mainCanvas.clientHeight },
      miniViewport: { width: miniCanvas.clientWidth, height: miniCanvas.clientHeight },
      camera: { position: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov },
      renderer: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries },
      controller: diagnostics
    };
  }

  controls.addEventListener('change', () => { labelView(-1); requestRender(); });
  for (const button of viewButtons) button.addEventListener('click', () => setView(Number(button.dataset.view)));
  for (const button of backgroundButtons) button.addEventListener('click', () => setBackground(button.dataset.background));
  mainCanvas.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const offset = camera.position.clone().sub(controls.target);
      const current = Math.atan2(offset.x, offset.z) * 180 / Math.PI;
      setView(current + (event.key === 'ArrowLeft' ? -15 : 15), { resetZoom: false });
    } else if (event.key === 'Home') {
      event.preventDefault();
      setView(0);
    }
  });
  mainCanvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    showFailure(new Error('三维绘图连接已中断。'));
  });
  document.addEventListener('visibilitychange', () => {
    syncPlayback();
    if (!document.hidden) requestRender();
  });
  const observer = new ResizeObserver(() => resize());
  observer.observe(stage);
  observer.observe(miniCanvas.parentElement);
  const initialView = Number(query.get('view') || 0);
  angle = Number.isFinite(initialView) ? initialView : 0;
  preview = { THREE, model, controller, scene, camera, miniCamera, renderer, controls, render, requestRender, setView, setCamera, setBackground, getMetrics, resize, syncPlayback, stopLoop,
    setFrameRate(value) { targetFPS = Math.max(30, Math.min(60, Number(value) || 30)); lastUpdateTime = 0; return targetFPS; },
    setReducedMotion: value => setReducedMotion(value), selectState };
  window.__companionAnimationPreview = preview;
  withoutControllerEvents(() => {
    controller.play('idle');
    if (selectedState !== 'idle' && !reducedMotion) controller.play(selectedState);
    if (reducedMotion) {
      controller.reset();
      controller.setReducedMotion(true);
      controller.pause();
    }
  });
  resize({ resetZoom: true });
  if (query.get('view') === 'head') setCamera({ target: [center.x, bounds.max.y - height * .105, center.z], distance: height * .85 });
  render();
  fallback.hidden = true;
  miniFallback.hidden = true;
  document.documentElement.dataset.animationReady = 'true';
  window.__COMPANION_ANIMATION_READY__ = true;
  status.textContent = '动作样板已就绪 · 等待你与孩子试用确认';
  revealDialogue();
  syncPlayback();
}

for (const button of stateButtons) button.addEventListener('click', () => selectState(button.dataset.state));
reduceInput.addEventListener('change', () => setReducedMotion(reduceInput.checked, { remember: true }));
reducedQuery.addEventListener('change', event => { if (!userReducedPreference) setReducedMotion(event.matches); });
playButton.addEventListener('click', () => {
  if (!preview || reducedMotion || failed) return;
  if (originalPose) {
    selectState('idle');
    return;
  }
  paused = !paused;
  preview.syncPlayback();
  preview.requestRender();
});
resetButton.addEventListener('click', () => {
  if (!preview || failed) return;
  originalPose = true;
  paused = false;
  withoutControllerEvents(() => {
    preview.controller.reset();
    preview.controller.setReducedMotion(reducedMotion);
    preview.controller.pause();
  });
  showOriginalPose();
  preview.syncPlayback();
  preview.requestRender();
});
updatePlaybackUI();
startPreview().catch(showFailure);
