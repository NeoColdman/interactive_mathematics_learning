const stage = document.querySelector('#model-stage');
const mainCanvas = document.querySelector('#main-canvas');
const miniCanvas = document.querySelector('#mini-canvas');
const fallback = document.querySelector('#stage-fallback');
const miniFallback = document.querySelector('#mini-fallback');
const status = document.querySelector('#preview-status');
const loadStatus = document.querySelector('#load-status');
const viewLabel = document.querySelector('#view-label');
const viewButtons = [...document.querySelectorAll('[data-view]')];
const backgroundButtons = [...document.querySelectorAll('button[data-background]')];
let preview;
window.__IMG2THREEJS_READY__ = false;

function showFailure(error) {
  document.documentElement.dataset.previewReady = 'false';
  window.__IMG2THREEJS_READY__ = false;
  fallback.hidden = false;
  fallback.classList.add('is-error');
  miniFallback.hidden = false;
  loadStatus.textContent = '三维预览暂时无法显示，仍可查看参考立绘。请检查本地服务后刷新。';
  status.textContent = '已显示参考立绘';
  console.error('人物预览未能加载：', error);
}

async function startPreview() {
  const query = new URL(location.href).searchParams;
  const requestedPass = 'imported-glb-static';
  const [THREE, { OrbitControls }, { loadMikuGLB }] = await Promise.all([
    import('/vendor/three/three.module.js'),
    import('/vendor/three/OrbitControls.js'),
    import('./load-miku-glb.js')
  ]);
  const rendererOptions = { antialias: true, alpha: true, preserveDrawingBuffer: true };
  const renderer = new THREE.WebGLRenderer({ canvas: mainCanvas, ...rendererOptions });
  const miniContext = miniCanvas.getContext('2d', { alpha: true });
  if (!miniContext) throw new Error('无法创建小尺寸预览。');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const hemisphere = new THREE.HemisphereLight(0xffffff, 0xb8c4bb, 1.1);
  scene.add(hemisphere);
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(-3, 5, 5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xe9f7f3, .5);
  fillLight.position.set(4, 3, -3);
  scene.add(fillLight);
  const model = await loadMikuGLB(THREE, { onProgress(value) {
    loadStatus.textContent = `正在加载三维人物… ${Math.round(value * 100)}%`;
  } });
  if (!model?.isObject3D) throw new Error('人物模型尚未准备好。');
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
  let requestedFrame = 0;
  let angle = 0;
  let fittedDistance = height * 2.1;
  let background = 'light';

  function render() {
    requestedFrame = 0;
    // Reuse one WebGL context and one copy of the model textures for both views.
    renderer.render(scene, miniCamera);
    miniContext.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
    miniContext.drawImage(mainCanvas, 0, 0, miniCanvas.width, miniCanvas.height);
    renderer.render(scene, camera);
    renderCount++;
  }

  function requestRender() {
    if (!requestedFrame) requestedFrame = requestAnimationFrame(render);
  }

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
    const width = Math.max(stage.clientWidth, 1);
    const viewportHeight = Math.max(stage.clientHeight, 1);
    renderer.setSize(width, viewportHeight, false);
    camera.aspect = width / viewportHeight;
    camera.updateProjectionMatrix();
    const verticalFit = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const horizontalFit = Math.max(size.x, size.z) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const previousFit = fittedDistance;
    fittedDistance = Math.max(verticalFit, horizontalFit) * 1.24;
    const miniWidth = Math.max(miniCanvas.clientWidth, 1);
    const miniHeight = Math.max(miniCanvas.clientHeight, 1);
    const miniRatio = Math.min(window.devicePixelRatio || 1, 2);
    miniCanvas.width = Math.round(miniWidth * miniRatio);
    miniCanvas.height = Math.round(miniHeight * miniRatio);
    const miniAspect = miniWidth / miniHeight;
    const miniHalfHeight = Math.max(height * .54, size.x / miniAspect * .54);
    miniCamera.left = -miniHalfHeight * miniAspect;
    miniCamera.right = miniHalfHeight * miniAspect;
    miniCamera.top = miniHalfHeight;
    miniCamera.bottom = -miniHalfHeight;
    miniCamera.position.set(center.x, center.y, center.z + height * 4);
    miniCamera.lookAt(center);
    miniCamera.updateProjectionMatrix();
    if (resetZoom || renderCount === 0) {
      setView(angle);
    } else {
      const offset = camera.position.clone().sub(controls.target);
      offset.multiplyScalar(fittedDistance / previousFit);
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

  function getMetrics() {
    let meshCount = 0;
    let triangleCount = 0;
    let vertexCount = 0;
    model.traverse(object => {
      if (!object.isMesh || !object.geometry) return;
      meshCount++;
      const geometry = object.geometry;
      vertexCount += geometry.attributes.position?.count || 0;
      triangleCount += (geometry.index?.count || geometry.attributes.position?.count || 0) / 3;
    });
    return {
      ready: document.documentElement.dataset.previewReady === 'true',
      meshCount,
      triangleCount: Math.round(triangleCount),
      vertexCount,
      bounds: { min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray(), center: center.toArray() },
      viewport: { width: stage.clientWidth, height: stage.clientHeight },
      camera: { position: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov },
      renderCount,
      background,
      requestedPass,
      renderer: renderer.info.render,
      modelUserData: model.userData
    };
  }

  function setCamera(cameraSpec = {}) {
    function vectorFrom(value, fallbackValue) {
      if (Array.isArray(value) && value.length >= 3) return new THREE.Vector3(...value.slice(0, 3));
      if (value && ['x', 'y', 'z'].every(key => Number.isFinite(value[key]))) return new THREE.Vector3(value.x, value.y, value.z);
      return fallbackValue.clone();
    }
    const target = vectorFrom(cameraSpec.target, center);
    const distance = Number.isFinite(cameraSpec.distance) && cameraSpec.distance > 0 ? cameraSpec.distance : fittedDistance;
    const azimuth = THREE.MathUtils.degToRad(Number(cameraSpec.azimuth ?? cameraSpec.azimuthDeg ?? 0));
    const elevation = THREE.MathUtils.degToRad(Number(cameraSpec.elevation ?? cameraSpec.elevationDeg ?? 0));
    const sphericalPosition = new THREE.Vector3(
      target.x + Math.sin(azimuth) * Math.cos(elevation) * distance,
      target.y + Math.sin(elevation) * distance,
      target.z + Math.cos(azimuth) * Math.cos(elevation) * distance
    );
    camera.position.copy(vectorFrom(cameraSpec.position, sphericalPosition));
    controls.target.copy(target);
    if (Number.isFinite(cameraSpec.fov) && cameraSpec.fov > 0 && cameraSpec.fov < 180) camera.fov = cameraSpec.fov;
    if (Number.isFinite(cameraSpec.near) && cameraSpec.near > 0) camera.near = cameraSpec.near;
    if (Number.isFinite(cameraSpec.far) && cameraSpec.far > camera.near) camera.far = cameraSpec.far;
    camera.updateProjectionMatrix();
    camera.lookAt(target);
    labelView(-1);
    render();
    return { ok: true, position: camera.position.toArray(), target: target.toArray() };
  }

  controls.addEventListener('change', () => { labelView(-1); requestRender(); });
  controls.addEventListener('end', requestRender);
  for (const button of viewButtons) button.addEventListener('click', () => setView(Number(button.dataset.view)));
  for (const button of backgroundButtons) button.addEventListener('click', () => setBackground(button.dataset.background));
  document.querySelector('#reset-view').addEventListener('click', () => setView(0));
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
  const observer = new ResizeObserver(() => resize());
  observer.observe(stage);
  observer.observe(miniCanvas.parentElement);
  const requestedView = query.get('view') || '0';
  const initialAngle = Number(requestedView);
  angle = Number.isFinite(initialAngle) ? initialAngle : 0;
  resize({ resetZoom: true });
  if (requestedView === 'head') {
    setCamera({
      azimuth: 0,
      elevation: 0,
      target: [center.x, bounds.max.y - height * .105, center.z],
      distance: height * .85,
      fov: 30
    });
  }
  render();
  fallback.hidden = true;
  miniFallback.hidden = true;
  status.textContent = 'GLB 静态形象已确认 · 可前往动作样板';
  document.documentElement.dataset.previewReady = 'true';
  window.__IMG2THREEJS_READY__ = true;
  preview = { THREE, scene, model, camera, miniCamera, renderer, controls, bounds, setView, setBackground, setCamera, getMetrics, render, requestRender, resize };
  window.__companionPreview = preview;
  window.__IMG2THREEJS_CAPTURE__ = {
    setCamera,
    capturePass() {
      render();
      return { ok: true, selector: '#main-canvas' };
    }
  };
}

startPreview().catch(showFailure);
