import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { createGenjutsuAura } from './genjutsuAura.js';

const shell = document.getElementById('bookShell');
const reader = document.getElementById('reader');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
async function mount() {
  let renderer, observer, raf, scene;
  const cleanup = () => {
    cancelAnimationFrame(raf); observer?.disconnect();
    shell.classList.remove('blender-ready');
    const geometries = new Set(), materials = new Set();
    scene?.traverse(o => { if(o.geometry) geometries.add(o.geometry); if(o.material) [].concat(o.material).forEach(m => materials.add(m)); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    renderer?.dispose(); renderer?.domElement.remove();
  };
  try {
    renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, powerPreference:'low-power'});
    renderer.setClearColor(0,0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.className = 'book-model-canvas';
    renderer.domElement.setAttribute('aria-hidden','true');
    renderer.domElement.addEventListener('webglcontextlost', e => {e.preventDefault(); cleanup();}, {once:true});
    scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1,1,1,-1,1,3000);
    camera.position.z = 1200;
    scene.add(new THREE.HemisphereLight('#fff0d5','#39253f',2));
    const warm = new THREE.DirectionalLight('#ffe0a0',3);
    warm.position.set(-300,500,600); scene.add(warm);
    const violet = new THREE.PointLight('#b76dff',30,2000,0);
    violet.position.set(500,-120,150); scene.add(violet);
    const gltf = await new GLTFLoader().loadAsync(new URL('../assets/models/book_frame.glb',import.meta.url).href);
    scene.add(gltf.scene);
    const open = gltf.scene.getObjectByName('OpenBook');
    const closed = gltf.scene.getObjectByName('ClosedBook');
    const aura = createGenjutsuAura(); scene.add(aura.group);
    // The HTML carries the original ink. These depth masks keep the Blender
    // paper blocks behind it while leaving the metal mounts and binding visible.
    const depth = new THREE.MeshBasicMaterial({colorWrite:false});
    const masks = [-1,1].map(() => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1,1),depth);
      m.renderOrder=-10;scene.add(m);return m;
    });
    const fit = () => {
      const w=shell.clientWidth,h=shell.clientHeight,single=innerWidth<480;
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<700?1.25:1.5));
      renderer.setSize(w*1.6,h*1.6,false);
      camera.left=-w*.8;camera.right=w*.8;camera.top=h*.8;camera.bottom=-h*.8;camera.updateProjectionMatrix();
      open.visible=!single;closed.visible=single;
      open.scale.set(w/2,h/1.24,w/2);closed.scale.set(w,h/1.43,w);
      masks.forEach((m,i)=>{
        m.visible=!single||i===0;
        m.scale.set(single?w-16:w/2-14,h-18,1);
        m.position.set(single?0:(i?1:-1)*w/4,0,1);
      });
      aura.group.scale.set(w,h,w);
    };
    fit();shell.append(renderer.domElement);shell.classList.add('blender-ready');
    shell.dataset.modelReady='true';
    observer=new ResizeObserver(fit);observer.observe(shell);
    let last=0,boost=reader.inert?-Infinity:performance.now();
    const burst=()=>{boost=performance.now();};
    window.addEventListener('zaoki:turn',burst);
    window.addEventListener('zaoki:opened',burst);
    const frame=now=>{
      if(!document.hidden&&!reader.inert&&now-last>40){
        last=now;
        const pulse=reduced.matches?0:Math.pow(Math.max(0,1-(now-boost)/2400),.75);
        aura.update(reduced.matches?0:now/1000,reduced.matches?.4:.7+pulse*1.65);
        violet.intensity=2+pulse*3;
        renderer.render(scene,camera);
      }
      raf=requestAnimationFrame(frame);
    };
    raf=requestAnimationFrame(frame);
    window.addEventListener('pagehide',cleanup,{once:true});
  } catch(error) { cleanup(); console.warn('Reliure 3D indisponible : décor de secours.',error); }
}
mount();
