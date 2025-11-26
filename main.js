import * as THREE from './three.module.js';

// ---------------------------------------------------------
// Minimal OrbitControls（本地版，无额外依赖）
// ---------------------------------------------------------
class OrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.target = new THREE.Vector3();

    this.minDistance = 10;
    this.maxDistance = 400;
    this.minPolarAngle = 0.1;
    this.maxPolarAngle = Math.PI - 0.1;
    this.rotateSpeed = 0.9;
    this.zoomSpeed = 1.0;
    this.panSpeed = 0.5;
    this.enableDamping = true;
    this.dampingFactor = 0.1;

    this._spherical = new THREE.Spherical();
    this._sphericalDelta = new THREE.Spherical();
    this._scale = 1;
    this._panOffset = new THREE.Vector3();
    this._isDragging = false;
    this._state = 'none';
    this._pointer = new THREE.Vector2();
    this._pointerOld = new THREE.Vector2();

    this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this), { passive: true });
    this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  onMouseDown(event) {
    this._isDragging = true;
    const isPan = event.button === 2 || event.ctrlKey;
    this._state = isPan ? 'pan' : 'rotate';
    this._pointerOld.set(event.clientX, event.clientY);
  }

  onMouseMove(event) {
    if (!this._isDragging) return;
    this._pointer.set(event.clientX, event.clientY);
    const deltaX = this._pointer.x - this._pointerOld.x;
    const deltaY = this._pointer.y - this._pointerOld.y;

    if (this._state === 'rotate') {
      const azimuth = -2 * Math.PI * deltaX / this.domElement.clientHeight * this.rotateSpeed;
      const polar = -2 * Math.PI * deltaY / this.domElement.clientHeight * this.rotateSpeed;
      this._sphericalDelta.theta += azimuth;
      this._sphericalDelta.phi += polar;
    } else if (this._state === 'pan') {
      this.pan(deltaX, deltaY);
    }
    this._pointerOld.copy(this._pointer);
  }

  onMouseUp() {
    this._isDragging = false;
    this._state = 'none';
  }

  onMouseWheel(event) {
    const zoomFactor = Math.exp(event.deltaY * 0.001 * this.zoomSpeed);
    this._scale *= zoomFactor;
  }

  pan(deltaX, deltaY) {
    const offset = new THREE.Vector3();
    offset.copy(this.camera.position).sub(this.target);

    let targetDistance = offset.length();
    targetDistance *= Math.tan((this.camera.fov * Math.PI) / 360.0);

    const panX = (-2 * deltaX * targetDistance / this.domElement.clientHeight) * this.panSpeed;
    const panY = (2 * deltaY * targetDistance / this.domElement.clientHeight) * this.panSpeed;

    const pan = new THREE.Vector3();
    pan.copy(this.camera.up).setLength(panY);

    const side = new THREE.Vector3();
    side.crossVectors(this.camera.getWorldDirection(new THREE.Vector3()), this.camera.up).setLength(panX);
    pan.add(side);

    this._panOffset.add(pan);
  }

  update() {
    const offset = new THREE.Vector3();
    offset.copy(this.camera.position).sub(this.target);
    this._spherical.setFromVector3(offset);

    this._spherical.theta += this._sphericalDelta.theta;
    this._spherical.phi += this._sphericalDelta.phi;

    this._spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this._spherical.phi));
    this._spherical.radius *= this._scale;
    this._spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this._spherical.radius));

    this.target.add(this._panOffset);

    offset.setFromSpherical(this._spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);

    if (this.enableDamping) {
      this._sphericalDelta.theta *= (1 - this.dampingFactor);
      this._sphericalDelta.phi *= (1 - this.dampingFactor);
      this._panOffset.multiplyScalar(1 - this.dampingFactor);
      this._scale = 1;
    } else {
      this._sphericalDelta.set(0, 0, 0);
      this._panOffset.set(0, 0, 0);
      this._scale = 1;
    }
  }
}

// ---------------------------------------------------------
// 基本场景
// ---------------------------------------------------------
const container = document.getElementById('three-container');

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x02040a, 0.0006);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(80, 60, 120);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.update();

const clock = new THREE.Clock();
const timeScale = 1.0;
const orbitSpeedScale = 1.2;
const rotationSpeedScale = 1.5;

// ---------------------------------------------------------
// 工具函数
// ---------------------------------------------------------
function createNoiseCanvas(size = 512, colors = ['#ffffff'], alpha = 0.35, horizontalBias = false, contrast = 0.12) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  const gradient = ctx.createLinearGradient(
    0,
    0,
    horizontalBias ? size : 0,
    horizontalBias ? 0 : size
  );
  colors.forEach((col, i) => gradient.addColorStop(
    colors.length === 1 ? 0 : i / (colors.length - 1),
    col
  ));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = Math.random() * 255;
    const shade = (noise / 255 - 0.5) * contrast * 255;
    data[i] = Math.min(255, Math.max(0, data[i] + shade));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + shade));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + shade));
    data[i + 3] = Math.min(255, data[i + 3] * alpha + noise * 0.35);
  }
  ctx.putImageData(imageData, 0, 0);
  return new THREE.CanvasTexture(c);
}

function createStarfieldTexture(size = 1024, density = 0.00045) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, size, size);

  const starCount = Math.floor(size * size * density);
  for (let i = 0; i < starCount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.3 + 0.3;
    const alpha = 0.4 + Math.random() * 0.6;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(c);
}

function createStarParticles(count = 1500, radius = 1800) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < count; i++) {
    const dir = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize();
    const dist = radius * (0.6 + Math.random() * 0.4);
    const pos = dir.multiplyScalar(dist);
    positions.push(pos.x, pos.y, pos.z);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: 1.2,
    color: 0xe5e7eb,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  return new THREE.Points(geometry, material);
}

function createPlanetMaterial(
  baseColors,
  {
    metallic = 0.02,
    roughness = 0.45,
    emissive = 0x000000,
    bands = false,
    glow = false,
    bumpScale = 0.12
  } = {}
) {
  const texture = createNoiseCanvas(1024, baseColors, 0.55, bands, 0.16);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  if (bands) texture.repeat.set(2, 1);

  const baseColor = new THREE.Color(
    baseColors[Math.floor(baseColors.length / 2)]
  );

  const material = new THREE.MeshStandardMaterial({
    color: baseColor,
    map: texture,
    roughness,
    metalness: metallic,
    emissive: new THREE.Color(emissive).lerp(baseColor, glow ? 0.4 : 0.18),
    emissiveIntensity: glow ? 1.3 : 0.55,
    bumpMap: texture,
    bumpScale
  });

  return material;
}

function createOrbitLine(radius, tilt = 0) {
  const segments = 256;
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(theta) * radius, 0, Math.sin(theta) * radius);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.5
  });
  const line = new THREE.LineLoop(geometry, material);
  line.rotation.x = THREE.MathUtils.degToRad(tilt);
  line.renderOrder = 1;
  return line;
}

function createHaloTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    80,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, 'rgba(255, 200, 80, 0.95)');
  gradient.addColorStop(0.3, 'rgba(255, 160, 50, 0.35)');
  gradient.addColorStop(1, 'rgba(255, 140, 40, 0.02)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------
// 灯光 & 太阳
// ---------------------------------------------------------
const ambient = new THREE.AmbientLight(0x1e293b, 0.95);
scene.add(ambient);

const sunLight = new THREE.PointLight(0xfff0c4, 4.5, 0, 2.5);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

const sunGeometry = new THREE.SphereGeometry(5.5, 64, 64);
const sunMaterial = new THREE.MeshStandardMaterial({
  emissive: 0xffbb55,
  emissiveIntensity: 1.8,
  color: 0xffaa33,
  roughness: 0.35,
  metalness: 0.0,
  map: createNoiseCanvas(512, ['#ffcc66', '#ff8844', '#ffdd99'], 0.5, true)
});
const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
scene.add(sunMesh);

const haloSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: createHaloTexture(),
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
}));
haloSprite.scale.set(28, 28, 1);
sunMesh.add(haloSprite);

// ---------------------------------------------------------
// 背景星空
// ---------------------------------------------------------
const starsGeo = new THREE.SphereGeometry(2000, 32, 32);
const starsMat = new THREE.MeshBasicMaterial({
  side: THREE.BackSide,
  map: createStarfieldTexture(2048, 0.0016),
  transparent: true,
  opacity: 0.96
});
const starfield = new THREE.Mesh(starsGeo, starsMat);
scene.add(starfield);

const starParticles = createStarParticles(2200, 1700);
scene.add(starParticles);

// ---------------------------------------------------------
// 行星 & 卫星
// ---------------------------------------------------------
const planetDefinitions = [
  { name: 'Mercury', radius: 1.2, distance: 14, speed: 1.6, rotation: 1.0, tilt: 3, colors: ['#d8d8d8', '#9a9a9a', '#c5c5c5'], bumpScale: 0.08 },
  { name: 'Venus', radius: 2.2, distance: 19, speed: 1.2, rotation: 1.1, tilt: 1, colors: ['#f2c57c', '#e0a96d', '#d79555'], bumpScale: 0.12 },
  { name: 'Earth', radius: 2.4, distance: 24, speed: 1.0, rotation: 3.0, tilt: 2, colors: ['#3b82f6', '#0ea5e9', '#22c55e', '#f1f5f9'], bumpScale: 0.16 },
  { name: 'Mars', radius: 1.9, distance: 30, speed: 0.82, rotation: 2.2, tilt: 2, colors: ['#f97316', '#c2410c', '#f59e0b'], bumpScale: 0.14 },
  { name: 'Jupiter', radius: 6.5, distance: 42, speed: 0.55, rotation: 4.0, tilt: 1.3, colors: ['#f5e0b8', '#d9b48f', '#b57a63', '#e9c7a1'], bands: true, bumpScale: 0.12 },
  { name: 'Saturn', radius: 5.6, distance: 55, speed: 0.45, rotation: 3.2, tilt: 2.8, colors: ['#f5d7a1', '#d6b37e', '#b08c6c'], bands: true, bumpScale: 0.12 },
  { name: 'Uranus', radius: 4.1, distance: 69, speed: 0.32, rotation: 2.4, tilt: 0.8, colors: ['#7cd3f7', '#5fb4e5', '#9decf9'], bands: true, bumpScale: 0.1 },
  { name: 'Neptune', radius: 4.0, distance: 82, speed: 0.26, rotation: 2.0, tilt: 1.6, colors: ['#4f9efc', '#2563eb', '#1e3a8a'], bands: false, bumpScale: 0.1 }
];

const planetSystems = [];

function createPlanetSystem(def) {
  const orbitGroup = new THREE.Group();
  orbitGroup.rotation.x = THREE.MathUtils.degToRad(def.tilt || 0);

  const geometry = new THREE.SphereGeometry(def.radius, 48, 48);
  const material = createPlanetMaterial(def.colors, {
    bands: def.bands || false,
    bumpScale: def.bumpScale || 0.1
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.x = def.distance;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  orbitGroup.add(mesh);

  scene.add(orbitGroup);
  scene.add(createOrbitLine(def.distance, def.tilt));

  return { def, orbitGroup, mesh, angle: Math.random() * Math.PI * 2 };
}

planetDefinitions.forEach((def) => {
  const system = createPlanetSystem(def);
  planetSystems.push(system);
});

const moons = [];

function addMoon(hostName, { name, radius, distance, speed, color }) {
  const host = planetSystems.find((p) => p.def.name === hostName);
  if (!host) return;

  const geom = new THREE.SphereGeometry(radius, 24, 24);
  const mat = createPlanetMaterial([color, '#d9d9d9', '#b0b0b0'], {
    roughness: 0.7
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.x = distance;

  const group = new THREE.Group();
  group.rotation.x = THREE.MathUtils.degToRad(5 + Math.random() * 5);
  group.add(mesh);
  host.mesh.add(group);

  moons.push({ mesh, group, speed, angle: Math.random() * Math.PI * 2 });
}

addMoon('Earth',   { name: 'Moon',    radius: 0.8, distance: 4.5, speed: 4.0, color: '#e5e7eb' });
addMoon('Jupiter', { name: 'Ganymede', radius: 1.1, distance: 10,  speed: 3.0, color: '#cfd4d8' });
addMoon('Saturn',  { name: 'Titan',   radius: 1.1, distance: 8,   speed: 2.7, color: '#d8b98f' });

// 土星光环
const saturnSystem = planetSystems.find((p) => p.def.name === 'Saturn');
if (saturnSystem) {
  const ringTexture = createNoiseCanvas(
    1024,
    ['rgba(255,255,255,0.85)', 'rgba(189,170,140,0.65)', 'rgba(140,120,100,0.4)'],
    0.4,
    true
  );
  const ringGeometry = new THREE.RingGeometry(
    saturnSystem.def.radius * 1.2,
    saturnSystem.def.radius * 1.85,
    128,
    1,
    0,
    Math.PI * 2
  );
  const ringMaterial = new THREE.MeshBasicMaterial({
    map: ringTexture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  saturnSystem.mesh.add(ring);
}

// ---------------------------------------------------------
// 小行星带
// ---------------------------------------------------------
function createAsteroidBelt(inner = 32, outer = 45, count = 1200) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const radius = THREE.MathUtils.lerp(inner, outer, Math.random());
    const angle = Math.random() * Math.PI * 2;
    const height = (Math.random() - 0.5) * 2;

    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = height * 0.6;
    positions[i * 3 + 2] = Math.sin(angle) * radius;

    sizes[i] = Math.random() * 0.6 + 0.2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    color: 0x9ca3af,
    size: 0.7,
    transparent: true,
    opacity: 0.9,
    blending: THREE.NormalBlending,
    depthWrite: false
  });

  const points = new THREE.Points(geometry, material);
  points.userData = { rotationSpeed: 0.03 };
  scene.add(points);
  return points;
}

const asteroidBelt = createAsteroidBelt();

// ---------------------------------------------------------
// 彗星（保留逻辑，不默认创建，避免白色大框）
// ---------------------------------------------------------
const comets = [];

function createComet({ name, color, perihelion = 18, aphelion = 90, speed = 0.3, tilt = 20 }) {
  const bodyGeo = new THREE.SphereGeometry(0.8, 16, 16);
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color).multiplyScalar(0.6),
    roughness: 0.5,
    metalness: 0.1
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);

  const tailTexture = createNoiseCanvas(
    256,
    ['rgba(255,255,255,0.9)', color],
    0.6,
    true,
    0.05
  );
  const tailMat = new THREE.SpriteMaterial({
    map: tailTexture,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    opacity: 0.9
  });
  const tail = new THREE.Sprite(tailMat);
  tail.scale.set(10, 4, 1);
  body.add(tail);

  const group = new THREE.Group();
  group.rotation.x = THREE.MathUtils.degToRad(tilt);
  group.add(body);
  scene.add(group);

  comets.push({
    name,
    body,
    group,
    speed,
    angle: Math.random() * Math.PI * 2,
    perihelion,
    aphelion
  });
}

// 如需打开彗星，取消注释下三行：
// createComet({ name: 'Halley',       color: '#8ef6ff', perihelion: 16, aphelion: 95,  speed: 0.22, tilt: 25 });
// createComet({ name: 'Swift-Tuttle', color: '#c4ddff', perihelion: 20, aphelion: 110, speed: 0.18, tilt: 35 });
// createComet({ name: 'Encke',        color: '#f8c7ff', perihelion: 12, aphelion: 60,  speed: 0.35, tilt: 12 });

// ---------------------------------------------------------
// UI 绑定
// ---------------------------------------------------------
const planetListEl = document.getElementById('planet-list');
const infoNameEl = document.getElementById('info-name');
const infoTextEl = document.getElementById('info-text');

const focusTargets = [{ name: 'Sun', color: '#f59e0b' }, ...planetDefinitions];

let currentFocus = 'Sun';
let flyTween = null;

function createButtons() {
  focusTargets.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'planet-btn';
    btn.textContent = item.name;
    btn.addEventListener('click', () => focusOnBody(item.name));
    planetListEl.appendChild(btn);
  });
}

function updateActiveButton() {
  const buttons = planetListEl.querySelectorAll('.planet-btn');
  buttons.forEach((btn) => {
    btn.classList.toggle('active', btn.textContent === currentFocus);
  });
}

function focusOnBody(name) {
  currentFocus = name;
  updateActiveButton();

  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const duration = 2.6;

  let targetPos;
  let targetLook;

  if (name === 'Sun') {
    targetLook = new THREE.Vector3(0, 0, 0);
    targetPos = new THREE.Vector3(14, 10, 20);
    infoNameEl.textContent = 'Sun';
    infoTextEl.innerHTML = '距离太阳：0 AU<br>公转周期：中心恒星';
  } else {
    const planet = planetSystems.find((p) => p.def.name === name);
    if (!planet) return;

    const planetPos = planet.mesh.getWorldPosition(new THREE.Vector3());
    const dir = planetPos.clone().normalize().multiplyScalar(6 + planet.def.radius * 2.2);

    targetPos = planetPos.clone().add(dir).add(new THREE.Vector3(2, 2, 0));
    targetLook = planetPos.clone();

    infoNameEl.textContent = name;
    infoTextEl.innerHTML =
      `距离太阳：${planet.def.distance} AU（示意）<br>` +
      `相对公转周期：${planet.def.speed.toFixed(2)}x`;
  }

  flyTween = {
    startTime: performance.now(),
    duration,
    startPos,
    startTarget,
    targetPos,
    targetLook
  };
}

createButtons();
updateActiveButton();

// ---------------------------------------------------------
// 动画主循环
// ---------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta() * timeScale;

  // 行星公转 & 自转
  planetSystems.forEach((planet) => {
    planet.angle += dt * planet.def.speed * orbitSpeedScale * 0.2;
    const x = Math.cos(planet.angle) * planet.def.distance;
    const z = Math.sin(planet.angle) * planet.def.distance;
    planet.mesh.position.set(x, 0, z);
    planet.mesh.rotation.y += dt * planet.def.rotation * rotationSpeedScale * 0.4;
  });

  // 卫星
  moons.forEach((moon) => {
    moon.angle += dt * moon.speed;
    const r = moon.mesh.position.length();
    const x = Math.cos(moon.angle) * r;
    const z = Math.sin(moon.angle) * r;
    moon.mesh.position.set(x, 0, z);
  });

  // 彗星（如果创建了）
  comets.forEach((comet) => {
    comet.angle += dt * comet.speed * orbitSpeedScale * 0.35;
    const radius = THREE.MathUtils.mapLinear(
      Math.cos(comet.angle),
      -1,
      1,
      comet.perihelion,
      comet.aphelion
    );
    const x = Math.cos(comet.angle) * radius;
    const z = Math.sin(comet.angle) * radius * 0.6;
    comet.body.position.set(x, 0, z);
    comet.body.lookAt(new THREE.Vector3(0, 0, 0));

    comet.body.children.forEach((child) => {
      if (child instanceof THREE.Sprite) {
        child.material.opacity = 0.5 + 0.5 * Math.sin(comet.angle + 1);
      }
    });
  });

  // 小行星带旋转
  asteroidBelt.rotation.y += dt * asteroidBelt.userData.rotationSpeed;

  // 太阳缓慢自转
  sunMesh.rotation.y += dt * 0.1;

  // 相机飞行补间
  if (flyTween) {
    const { startTime, duration, startPos, startTarget, targetPos, targetLook } = flyTween;
    const t = Math.min(1, (performance.now() - startTime) / (duration * 1000));
    const ease = 1 - Math.pow(1 - t, 3);

    camera.position.lerpVectors(startPos, targetPos, ease);
    controls.target.lerpVectors(startTarget, targetLook, ease);

    if (t >= 1) flyTween = null;
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

// ---------------------------------------------------------
// 自适应窗口
// ---------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 初始聚焦太阳
focusOnBody('Sun');
