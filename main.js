import * as THREE from './three.module.js';

/**
 * 极简 OrbitControls，只依赖本地 three.module.js
 */
class OrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.target = new THREE.Vector3(0, 0, 0);

    this.minDistance = 20;
    this.maxDistance = 400;
    this.minPolarAngle = 0.1;
    this.maxPolarAngle = Math.PI - 0.1;

    this.rotateSpeed = 0.9;
    this.zoomSpeed = 1.0;
    this.panSpeed = 0.5;

    this.enableDamping = true;
    this.dampingFactor = 0.12;

    // internal
    this._spherical = new THREE.Spherical();
    this._sphericalDelta = new THREE.Spherical(0, 0, 0);
    this._scale = 1;
    this._panOffset = new THREE.Vector3();

    this._isDragging = false;
    this._state = 'none'; // rotate | pan | none
    this._pointer = new THREE.Vector2();
    this._pointerOld = new THREE.Vector2();

    this.domElement.addEventListener('contextmenu', e => e.preventDefault());
    this.domElement.addEventListener('mousedown', this._onMouseDown);
    this.domElement.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    this.domElement.addEventListener('wheel', this._onMouseWheel, { passive: true });
  }

  _onMouseDown = (event) => {
    this._isDragging = true;
    const isPan = event.button === 2 || event.ctrlKey;
    this._state = isPan ? 'pan' : 'rotate';
    this._pointerOld.set(event.clientX, event.clientY);
  };

  _onMouseMove = (event) => {
    if (!this._isDragging) return;
    this._pointer.set(event.clientX, event.clientY);
    const dx = this._pointer.x - this._pointerOld.x;
    const dy = this._pointer.y - this._pointerOld.y;

    if (this._state === 'rotate') {
      const az = -2 * Math.PI * dx / this.domElement.clientHeight * this.rotateSpeed;
      const po = -2 * Math.PI * dy / this.domElement.clientHeight * this.rotateSpeed;
      this._sphericalDelta.theta += az;
      this._sphericalDelta.phi += po;
    } else if (this._state === 'pan') {
      this._pan(dx, dy);
    }
    this._pointerOld.copy(this._pointer);
  };

  _onMouseUp = () => {
    this._isDragging = false;
    this._state = 'none';
  };

  _onMouseWheel = (event) => {
    const zoomFactor = Math.exp(event.deltaY * 0.001 * this.zoomSpeed);
    this._scale *= zoomFactor;
  };

  _pan(dx, dy) {
    const offset = new THREE.Vector3().copy(this.camera.position).sub(this.target);
    let targetDistance = offset.length();
    targetDistance *= Math.tan((this.camera.fov * Math.PI) / 360.0);

    const panX = (-2 * dx * targetDistance / this.domElement.clientHeight) * this.panSpeed;
    const panY = (2 * dy * targetDistance / this.domElement.clientHeight) * this.panSpeed;

    const pan = new THREE.Vector3();
    const up = new THREE.Vector3().copy(this.camera.up).setLength(panY);
    const side = new THREE.Vector3()
      .crossVectors(this.camera.getWorldDirection(new THREE.Vector3()), this.camera.up)
      .setLength(panX);
    pan.add(up).add(side);

    this._panOffset.add(pan);
  }

  update() {
    const offset = new THREE.Vector3().copy(this.camera.position).sub(this.target);
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
      const damp = 1 - this.dampingFactor;
      this._sphericalDelta.theta *= damp;
      this._sphericalDelta.phi *= damp;
      this._panOffset.multiplyScalar(damp);
      this._scale = 1;
    } else {
      this._sphericalDelta.set(0, 0, 0);
      this._panOffset.set(0, 0, 0);
      this._scale = 1;
    }
  }
}

// =============== three.js 场景基础 ===============
const container = document.getElementById('three-container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x020617, 1);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, 130, 260);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.minDistance = 80;
controls.maxDistance = 400;
controls.update();

// 轻微环境光，让线条更柔和
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

// =============== 背景星空（白点） ===============
function createStarField(count = 800, radius = 900) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const dir = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize();
    const dist = radius * (0.7 + Math.random() * 0.3);
    dir.multiplyScalar(dist);
    positions[i * 3] = dir.x;
    positions[i * 3 + 1] = dir.y;
    positions[i * 3 + 2] = dir.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.4,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
}
createStarField();

// =============== 太阳（恒定亮色，无阴影） ===============
const sunGeo = new THREE.SphereGeometry(10, 64, 64);
const sunMat = new THREE.MeshBasicMaterial({
  color: 0xfacc15
});
const sun = new THREE.Mesh(sunGeo, sunMat);
scene.add(sun);

// =============== 行星和轨道 ===============
const planetDefs = [
  { name: 'Mercury', cn: '水星', color: 0xe5e7eb, radius: 2.2, distance: 30, speed: 4.0 },
  { name: 'Venus',   cn: '金星', color: 0xfbbf24, radius: 3.0, distance: 40, speed: 3.2 },
  { name: 'Earth',   cn: '地球', color: 0x3b82f6, radius: 3.2, distance: 52, speed: 2.6 },
  { name: 'Mars',    cn: '火星', color: 0xf97316, radius: 2.8, distance: 64, speed: 2.0 },
  { name: 'Jupiter', cn: '木星', color: 0xf59e0b, radius: 6.5, distance: 86, speed: 1.3 },
  { name: 'Saturn',  cn: '土星', color: 0xfde68a, radius: 5.5, distance: 110, speed: 1.0 },
  { name: 'Uranus',  cn: '天王星', color: 0x38bdf8, radius: 4.8, distance: 134, speed: 0.8 },
  { name: 'Neptune', cn: '海王星', color: 0x1d4ed8, radius: 4.6, distance: 158, speed: 0.6 }
];

const orbitColors = {
  inner: 0x64748b,
  outer: 0x334155
};

const planets = [];

function createOrbit(radius, isOuter) {
  const segments = 256;
  const positions = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(t) * radius, 0, Math.sin(t) * radius);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color: isOuter ? orbitColors.outer : orbitColors.inner,
    linewidth: 1,
    transparent: true,
    opacity: isOuter ? 0.55 : 0.75
  });
  const line = new THREE.LineLoop(geo, mat);
  scene.add(line);
}

function createPlanetSystem(def, index) {
  const mat = new THREE.MeshBasicMaterial({ color: def.color });
  const geo = new THREE.SphereGeometry(def.radius, 48, 48);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(def.distance, 0, 0);

  // 轨道线
  const isOuter = index >= 4;
  createOrbit(def.distance, isOuter);

  scene.add(mesh);
  return { def, mesh, angle: Math.random() * Math.PI * 2 };
}

planetDefs.forEach((def, i) => {
  planets.push(createPlanetSystem(def, i));
});

// 土星环：用细扁的透明圆环，避免巨大灰圈
const saturn = planets.find(p => p.def.name === 'Saturn');
if (saturn) {
  const ringGeo = new THREE.RingGeometry(
    saturn.def.radius * 1.45,
    saturn.def.radius * 2.1,
    128
  );
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xfcd34d,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0, 0);
  saturn.mesh.add(ring);
}

// =============== 小行星带（灰白小颗粒，非紫色方块） ===============
function createAsteroidBelt(inner = 70, outer = 82, count = 900) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = THREE.MathUtils.lerp(inner, outer, Math.random());
    const angle = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 1.2; // 很薄的厚度
    positions[i * 3 + 2] = Math.sin(angle) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xe5e7eb,
    size: 1.1,
    transparent: true,
    opacity: 0.7,
    depthWrite: false
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
}
createAsteroidBelt();

// =============== UI 绑定 ===============
const planetListEl = document.getElementById('planet-list');
const infoNameEl = document.getElementById('info-name');
const infoTextEl = document.getElementById('info-text');

const focusTargets = [{ name: 'Sun', cn: '太阳' }, ...planetDefs];
let currentFocus = 'Sun';
let flight = null;

function buildButtons() {
  focusTargets.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'planet-btn';
    btn.textContent = item.name;
    btn.addEventListener('click', () => focusOn(item.name));
    planetListEl.appendChild(btn);
  });
}

function updateActiveButton() {
  const btns = planetListEl.querySelectorAll('.planet-btn');
  btns.forEach(btn => {
    btn.classList.toggle('active', btn.textContent === currentFocus);
  });
}

function updateInfo(name) {
  if (name === 'Sun') {
    infoNameEl.textContent = 'Sun（太阳）';
    infoTextEl.innerHTML = '距离太阳：0 AU<br>公转周期：中心恒星';
    return;
  }
  const p = planetDefs.find(p => p.name === name);
  if (!p) return;
  infoNameEl.textContent = `${p.name}（${p.cn}）`;
  infoTextEl.innerHTML =
    `距离太阳：${p.distance} AU（示意）<br>` +
    `相对公转周期：${p.speed.toFixed(2)}x（仅用于动画）`;
}

function focusOn(name) {
  currentFocus = name;
  updateActiveButton();
  updateInfo(name);

  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();

  let targetPos, targetLook;

  if (name === 'Sun') {
    targetLook = new THREE.Vector3(0, 0, 0);
    targetPos = new THREE.Vector3(0, 80, 220);
  } else {
    const pSys = planets.find(p => p.def.name === name);
    if (!pSys) return;
    const worldPos = pSys.mesh.getWorldPosition(new THREE.Vector3());
    targetLook = worldPos.clone();

    // 稍微在行星上方一些的观察点，整体感觉像图二
    const dir = worldPos.clone().normalize();
    const offset = dir.multiplyScalar(20 + pSys.def.radius * 3);
    targetPos = worldPos.clone().add(new THREE.Vector3(0, 25 + pSys.def.radius * 1.5, 0)).add(offset);
  }

  flight = {
    startTime: performance.now(),
    duration: 2000,
    startPos,
    startTarget,
    targetPos,
    targetLook
  };
}

buildButtons();
updateActiveButton();
updateInfo('Sun');

// =============== 动画循环 ===============
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  // 行星公转（绕原点旋转）
  planets.forEach(p => {
    p.angle += dt * p.def.speed * 0.25; // 整体速度缩放
    const x = Math.cos(p.angle) * p.def.distance;
    const z = Math.sin(p.angle) * p.def.distance;
    p.mesh.position.set(x, 0, z);
  });

  // 摄像机平滑飞行
  if (flight) {
    const { startTime, duration, startPos, startTarget, targetPos, targetLook } = flight;
    const t = Math.min(1, (performance.now() - startTime) / duration);
    const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic

    camera.position.lerpVectors(startPos, targetPos, ease);
    controls.target.lerpVectors(startTarget, targetLook, ease);

    if (t >= 1) flight = null;
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

// 初始视角对准太阳系整体
focusOn('Sun');

// =============== 自适应窗口大小 ===============
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});
