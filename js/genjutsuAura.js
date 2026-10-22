import * as THREE from './vendor/three.module.js';

export function createGenjutsuAura() {
  const group = new THREE.Group();
  group.name = 'GenjutsuAura';
  const uniforms = { uTime: { value: 0 }, uIntensity: { value: .2 } };
  // A single procedural smoke sheet curls around the perimeter. Depth masks
  // keep it behind the paper and ink, including on narrow screens.
  const smoke = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform float uTime;uniform float uIntensity;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+7.1;a*=.5;}return n;}
      void main(){
        vec2 p=(vUv-.5)*1.58;
        vec2 drift=vec2(uTime*.08,-uTime*.19);
        vec2 warp=vec2(fbm(p*5.+drift),fbm(p*5.-drift+13.));
        float clouds=fbm(p*11.+warp*3.+drift);
        vec2 q=abs(p)-vec2(.49);
        float edge=length(max(q,0.))+min(max(q.x,q.y),0.);
        float curl=edge+(clouds-.5)*.09;
        float band=smoothstep(-.02,.025,edge)*(1.-smoothstep(.055,.255,curl));
        float density=smoothstep(.19,.72,clouds)*band;
        float veins=fbm(p*22.+warp*4.-drift*.7);
        vec3 violet=mix(vec3(.24,.035,.48),vec3(.65,.30,.93),clouds*.85+veins*.2);
        float alpha=density*min(1.1,uIntensity*.56);
        gl_FragColor=vec4(violet,alpha);
      }`
  });
  const smokeSheet = new THREE.Mesh(new THREE.PlaneGeometry(1.58,1.58),smoke);
  smokeSheet.name='VioletSmoke';smokeSheet.position.z=-.055;
  group.add(smokeSheet);
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; uniform float uTime;
      void main(){vUv=uv; vec3 p=position; p.z+=.012*sin(uv.x*25.-uTime);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uIntensity;
      void main(){float wave=.20+.80*pow(max(0.,sin(vUv.x*24.-uTime*1.8)),5.);
      vec3 color=mix(vec3(.30,.06,.62),vec3(.70,.40,1.),wave);
      gl_FragColor=vec4(color,(.12+wave*.30)*uIntensity);}`
  });
  for (let j = 0; j < 3; j++) {
    const points = Array.from({length:97}, (_,i) => {
      const t = i / 96 * Math.PI * 2;
      return new THREE.Vector3((.58+j*.026)*Math.cos(t),(.565+j*.025)*Math.sin(t),-.065+.02*Math.sin(t*3+j));
    });
    const curve = new THREE.CatmullRomCurve3(points);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve,96,.0019+j*.0006,5,false),material);
    group.add(mesh);
  }
  const count = 110, positions = new Float32Array(count*3), seeds = new Float32Array(count);
  for(let i=0;i<count;i++){
    const a=i*2.39996, r=.59+(Math.sin(i*14.12)*.5+.5)*.11;
    positions[i*3]=Math.cos(a)*r;positions[i*3+1]=Math.sin(a)*r;
    positions[i*3+2]=-.1+Math.sin(i)*.09;seeds[i]=(Math.sin(i*78.2)*.5+.5);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
  const motes=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`uniform float uTime;attribute float aSeed;varying float vAlpha;
      void main(){vec3 p=position;p.x+=.014*sin(uTime*.5+aSeed*10.);p.y+=.018*cos(uTime*.4+aSeed*20.);
      vAlpha=pow(sin(fract(uTime*.075+aSeed)*3.14159),2.);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=1.5+aSeed*3.;}`,
    fragmentShader:`uniform float uIntensity;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);float alpha=smoothstep(.5,.05,d)*vAlpha*uIntensity;gl_FragColor=vec4(.66,.36,1.,alpha);}`});
  group.add(new THREE.Points(geo,motes));
  return {group,update(time,intensity){uniforms.uTime.value=time;uniforms.uIntensity.value=intensity;}};
}
