import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { createGenjutsuAura } from './genjutsuAura.js';

const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const phase = (t, a, b) => smooth((t - a) / (b - a));
const DURATION = 3900;
const FINAL_ANGLE = -158 * Math.PI / 180;

class BoneHandOpening {
  constructor(intro, book) {
    this.intro = intro;
    this.book = book;
    this.cover = book.querySelector('.front-cover');
    this.ready = false;
    this.disposed = false;
    this.materials = new Set();
    this.resize = () => this.fit();
    this.contextLost = event => { event.preventDefault(); this.fail(); };
  }

  async preload() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
      this.renderer.setClearColor(0, 0);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.12;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.domElement.className = 'bone-hand-canvas';
      this.renderer.domElement.setAttribute('aria-hidden', 'true');
      this.renderer.domElement.addEventListener('webglcontextlost', this.contextLost);
      this.intro.appendChild(this.renderer.domElement);
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(40, 1, 1, 5000);
      this.camera.position.z = 1800;
      this.root = new THREE.Group();
      this.scene.add(this.root);
      this.hinge = new THREE.Group();
      this.hinge.name = 'CoverHinge';
      this.root.add(this.hinge);
      this.coverGrip = new THREE.Object3D();
      this.coverGrip.name = 'CoverGripPoint';
      this.hinge.add(this.coverGrip);

      // Depth-only surfaces let the HTML cover hide the thumb and far-side bones.
      const depth = new THREE.MeshBasicMaterial({ colorWrite: false });
      this.coverDepth = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), depth);
      this.coverDepth.renderOrder = -10;
      this.hinge.add(this.coverDepth);
      this.pagesDepth = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), depth);
      this.pagesDepth.renderOrder = -10;
      this.root.add(this.pagesDepth);
      this.coverBack = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
        new THREE.MeshStandardMaterial({ color: '#170b10', roughness: .88, side: THREE.BackSide }));
      this.hinge.add(this.coverBack);
      this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: .25 }));
      this.shadow.receiveShadow = true;
      this.hinge.add(this.shadow);
      this.scene.add(new THREE.HemisphereLight('#ece0ce', '#302336', 1.3));
      const warm = new THREE.DirectionalLight('#ffe2b6', 2.2);
      warm.position.set(-250, 420, 620);
      warm.castShadow = true;
      warm.shadow.mapSize.set(1024, 1024);
      Object.assign(warm.shadow.camera, { left: -900, right: 900, top: 900, bottom: -900, near: 10, far: 2200 });
      warm.shadow.bias = -.0005;
      warm.shadow.normalBias = .65;
      this.scene.add(warm);
      this.rim = new THREE.DirectionalLight('#a56bdf', 1.7);
      this.rim.position.set(600, -100, 200);
      this.scene.add(this.rim);
      const glowCanvas = document.createElement('canvas');
      glowCanvas.width = glowCanvas.height = 128;
      const ctx = glowCanvas.getContext('2d');
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(170,112,222,0.35)');
      gradient.addColorStop(.4, 'rgba(111,52,175,0.12)');
      gradient.addColorStop(1, 'rgba(75,25,120,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      this.mist = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCanvas), transparent: true, depthWrite: false }));
      this.root.add(this.mist);
      this.aura = createGenjutsuAura();
      this.root.add(this.aura.group);
      const [gltf, frame] = await Promise.all([
        new GLTFLoader().loadAsync(new URL('../assets/models/bone_hand.glb', import.meta.url).href),
        new GLTFLoader().loadAsync(new URL('../assets/models/book_frame.glb', import.meta.url).href).catch(() => null)
      ]);
      if (this.disposed) { this.disposeModel(gltf.scene); if (frame) this.disposeModel(frame.scene); return; }
      if (frame) {
        this.bookModel = frame.scene;
        this.bookModel.getObjectByName('OpenBook').visible = false;
        this.blenderHinge = this.bookModel.getObjectByName('BlenderCoverHinge');
        this.root.add(this.bookModel);
        this.intro.classList.add('blender-ready');
      }
      this.model = gltf.scene;
      this.handGrip = this.model.getObjectByName('HandGripPoint');
      const clip = gltf.animations.find(c => c.name === 'Grip') || gltf.animations[0];
      if (!this.handGrip || !clip) throw new Error('Missing hand grip or articulation clip');
      this.hand = new THREE.Group();
      this.root.add(this.hand);
      this.hand.add(this.model);
      this.model.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.frustumCulled = false;
        for (const material of [].concat(o.material)) {
          material.transparent = true;
          this.materials.add(material);
        }
      });
      this.mixer = new THREE.AnimationMixer(this.model);
      this.action = this.mixer.clipAction(clip);
      this.action.setLoop(THREE.LoopOnce, 1);
      this.action.clampWhenFinished = true;
      this.action.play();
      this.clipDuration = clip.duration;
      this.fit();
      this.pose(0);
      await this.renderer.compileAsync(this.scene, this.camera);
      if (this.disposed) return;
      this.ready = true;
      this.intro.dataset.handReady = 'true';
      window.addEventListener('resize', this.resize);
      this.renderer.domElement.style.visibility = 'visible';
      const idle = now => {
        if (this.disposed || this.started) return;
        if (!document.hidden && (!this.idleLast || now - this.idleLast > 40)) {
          this.idleLast = now;
          this.syncBookMatrix();
          this.aura.update(now / 1000, .65);
          this.renderer.render(this.scene, this.camera);
        }
        this.idleRaf = requestAnimationFrame(idle);
      };
      this.idleRaf = requestAnimationFrame(idle);
    } catch (error) {
      console.warn('Main 3D indisponible : ouverture simple.', error);
      this.dispose();
    }
  }

  fit() {
    if (this.disposed || !this.renderer) return;
    const w = this.intro.clientWidth, h = this.intro.clientHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, w < 700 ? 1.25 : 1.75));
    this.renderer.setSize(w, h);
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(h / 3600));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.width = this.book.offsetWidth;
    this.height = this.book.offsetHeight;
    this.handScale = this.width * .255;
    this.bookModel?.scale.set(this.width, this.height / 1.43, this.width);
    this.aura?.group.scale.set(this.width, this.height, this.width);
    this.hinge.position.x = -this.width / 2;
    this.coverGrip.position.set(this.width, -this.height * .08, 0);
    this.coverDepth.scale.set(this.width, this.height, 3);
    this.coverDepth.position.set(this.width / 2, 0, 0);
    this.pagesDepth.scale.set(this.width - 18, this.height - 19, 18);
    this.pagesDepth.position.set(2, -.5, -21);
    this.coverBack.scale.set(this.width, this.height, 1);
    this.coverBack.position.set(this.width / 2, 0, -1.6);
    this.shadow.scale.set(this.width, this.height, 1);
    this.shadow.position.set(this.width / 2, 0, 1.7);
    if (this.model) this.model.scale.setScalar(this.handScale);
    this.syncBookMatrix();
  }

  syncBookMatrix() {
    const stage = this.book.offsetParent;
    const rect = stage.getBoundingClientRect();
    const x = rect.left + this.book.offsetLeft + this.width / 2 - this.intro.clientWidth / 2;
    const y = this.intro.clientHeight / 2 - (rect.top + this.book.offsetTop + this.height / 2);
    const css = new DOMMatrix(getComputedStyle(this.book).transform);
    const flipY = new THREE.Matrix4().makeScale(1, -1, 1);
    this.root.matrixAutoUpdate = false;
    this.root.matrix.makeTranslation(x, y, 0).multiply(flipY)
      .multiply(new THREE.Matrix4().fromArray(css.toFloat64Array())).multiply(flipY);
  }

  pose(t) {
    const lift = phase(t, 1.55, 3.0);
    const theta = FINAL_ANGLE * lift;
    const reach = 1 - phase(t, .18, .95);
    const release = phase(t, 3.05, 3.38);
    const retreat = phase(t, 3.35, 3.9);
    const grip = phase(t, .93, 1.25) * (1 - release);

    // The hand drives a point on the hinge's circular constraint. Both renderers
    // use the solved angle; no independent CSS cover animation runs in 3D mode.
    const driver = new THREE.Vector3(this.width * Math.cos(theta), -this.height * .08, -this.width * Math.sin(theta));
    const solvedAngle = Math.atan2(-driver.z, driver.x);
    this.hinge.rotation.y = solvedAngle;
    if (this.blenderHinge) this.blenderHinge.rotation.y = solvedAngle;
    this.aura?.update(t * 1.4, .7 + phase(t, .08, .5) * (1 - phase(t, 3.5, 3.9)) * (1.1 + Math.sin(lift * Math.PI) * .7));
    this.cover.style.transform = `rotateY(${solvedAngle}rad)`;
    this.cover.style.filter = `brightness(${1 - lift * .35})`;
    // Frame the moving cover and wrist on narrow displays, in book-relative units.
    const reachX = -this.width / 2 + (this.width + this.handScale * (2.6 + reach * 1.85 + retreat * 1.25)) * Math.cos(theta);
    const minX = Math.min(-this.width / 2, reachX) - this.width * .12;
    const maxX = Math.max(this.width / 2, reachX) + this.width * .12;
    const available = this.intro.clientWidth - 40;
    const framingScale = Math.min(1, available / (maxX - minX));
    const framingShift = framingScale < 1 ? -(minX + maxX) * framingScale / 2
      : Math.max(-available / 2 - minX, Math.min(available / 2 - maxX, 0));
    const frameIn = phase(t, .08, .75);
    const scale = 1 + (framingScale - 1) * frameIn;
    this.book.style.transform = `translateX(${framingShift * frameIn}px) rotateX(${15 - lift * 10}deg) rotateZ(${-3 + lift * 3}deg) scale(${scale})`;
    this.syncBookMatrix();
    this.action.paused = false;
    this.action.enabled = true;
    this.mixer.setTime(grip * this.clipDuration);
    this.hinge.updateMatrix();
    this.coverGrip.updateMatrix();
    const socket = new THREE.Matrix4().multiplyMatrices(this.hinge.matrix, this.coverGrip.matrix);
    const withdraw = new THREE.Matrix4().makeTranslation(
      this.handScale * (reach * 1.85 + retreat * 1.25),
      this.handScale * (-reach * .45 - retreat * .3),
      this.handScale * (reach * .2 + retreat * .35));
    this.hand.matrixAutoUpdate = false;
    // Preserve the authored grip offset if the Blender source is edited later.
    this.model.updateWorldMatrix(true, true);
    const relativeGrip = this.model.matrixWorld.clone().invert().multiply(this.handGrip.matrixWorld);
    const localGrip = this.model.matrix.clone().multiply(relativeGrip);
    this.hand.matrix.copy(socket).multiply(withdraw)
      .multiply(new THREE.Matrix4().makeScale(this.handScale, this.handScale, this.handScale))
      .multiply(localGrip.invert());
    const opacity = phase(t, .16, .65) * (1 - phase(t, 3.5, 3.9));
    this.materials.forEach(m => { m.opacity = opacity; });
    this.hand.visible = opacity > .002;
    this.mist.position.copy(driver).add(new THREE.Vector3(-this.width / 2 + this.handScale * .55, 0, 20));
    this.mist.scale.setScalar(this.handScale * (2.6 + .15 * Math.sin(t * 4)));
    this.mist.material.opacity = phase(t, 0, .25) * (1 - phase(t, 3.6, 3.9)) * (.75 - grip * .5);
    this.intro.dataset.handPhase = t < .93 ? 'approach' : t < 1.25 ? 'grip' : t < 1.55 ? 'hold' : t < 3 ? 'lift' : t < 3.38 ? 'release' : 'retreat';
  }

  play() {
    if (!this.ready || this.disposed) return null;
    this.intro.classList.add('hand-3d');
    cancelAnimationFrame(this.idleRaf);
    this.renderer.domElement.style.visibility = 'visible';
    return new Promise(resolve => {
      this.resolve = resolve;
      this.started = performance.now();
      this.lastFrame = -Infinity;
      const frame = now => {
        if (this.disposed) return;
        try {
          if (now - this.lastFrame >= 1000 / 60 - .5) {
            this.lastFrame = now;
            this.pose(Math.min(DURATION, now - this.started) / 1000);
            this.renderer.render(this.scene, this.camera);
          }
          if (now - this.started >= DURATION) this.finish();
          else this.raf = requestAnimationFrame(frame);
        } catch (error) { console.warn('Opening fallback', error); this.fail(); }
      };
      this.raf = requestAnimationFrame(frame);
      this.watchdog = setTimeout(() => this.finish(), DURATION + 400);
    });
  }

  finish() {
    if (this.disposed) return;
    this.cover.style.transform = `rotateY(${FINAL_ANGLE}rad)`;
    this.dispose();
    this.resolve?.();
  }
  fail() {
    const playing = !!this.resolve;
    this.dispose();
    if (playing) {
      this.cover.style.transition = 'transform .5s ease';
      this.cover.style.transform = `rotateY(${FINAL_ANGLE}rad)`;
      setTimeout(() => this.resolve?.(), 500);
    }
  }
  disposeModel(root) {
    const textures = new Set(), materials = new Set(), geometries = new Set();
    root.traverse(o => {
      if (o.isLight && o.shadow) o.shadow.dispose();
      if (o.geometry) geometries.add(o.geometry);
      if (o.skeleton) o.skeleton.dispose();
      if (o.material) [].concat(o.material).forEach(m => materials.add(m));
    });
    materials.forEach(m => { Object.values(m).forEach(v => { if (v?.isTexture) textures.add(v); }); m.dispose(); });
    textures.forEach(t => t.dispose());
    geometries.forEach(g => g.dispose());
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.ready = false;
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.idleRaf);
    clearTimeout(this.watchdog);
    window.removeEventListener('resize', this.resize);
    this.mixer?.stopAllAction();
    if (this.model) this.mixer?.uncacheRoot(this.model);
    if (this.scene) this.disposeModel(this.scene);
    if (this.renderer) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.contextLost);
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
    }
  }
}

const intro = document.getElementById('intro');
const book = document.getElementById('closedBook');
if (intro && book && !intro.classList.contains('opening')) {
  const controller = new BoneHandOpening(intro, book);
  window.zaokiHand = controller;
  controller.preload();
}
