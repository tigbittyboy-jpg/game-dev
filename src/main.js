import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d-compat';
import './style.css';
import { createCombat } from './combat.js';

const app = document.querySelector('#app');
app.innerHTML = `<header><div class="brand"><span class="logo">◈</span><div><h1>Gravity Yard</h1><p class="subtitle">PHYSICS LAB / HUMAN RESPONSE TESTING</p></div></div><div class="status panel"><span class="dot">●</span> &nbsp;<span id="state">Live simulation</span> &nbsp; / &nbsp; <span id="count">0</span> objects</div></header><aside class="panel"><h1 style="font-size:18px">Controlled experiments.</h1><p class="intro">Spawn a subject or a prop.<br>Test, observe, reset.</p><h2>01 / Pick an object</h2><div class="shapes"><button class="active" data-shape="box"><span class="icon">▧</span>Cube</button><button data-shape="ball"><span class="icon">●</span>Sphere</button><button data-shape="cylinder"><span class="icon">▰</span>Cylinder</button><button data-shape="plank"><span class="icon">▬</span>Plank</button></div><h2>02 / Make it yours</h2><div class="row"><label for="size">Size</label><input id="size" type="range" min="0.5" max="2" step="0.1" value="1"></div><div class="swatches">${['#c6f47a','#f3a66b','#80c7ce','#b4a2e5'].map((c,i)=>`<button aria-label="Color ${c}" class="swatch ${i===0?'active':''}" style="background:${c}" data-color="${c}"></button>`).join('')}</div><button class="primary" id="spawn">＋ &nbsp; Drop object <small style="opacity:.6">[Space]</small></button><h2>03 / World settings</h2><div class="row"><label for="gravity">Gravity</label><input id="gravity" type="range" min="0" max="20" step="0.1" value="9.8"></div><div class="row"><label for="bounce">Bounciness</label><input id="bounce" type="range" min="0" max="1" step="0.05" value="0.35"></div><p class="intro">Click an object to give it a kick.<br>Shift + click to remove it.</p></aside><div class="scene-title"><small>YOUR EXPERIMENT, YOUR RULES</small><p>Test chamber</p></div><div class="tools panel"><button id="pause">Ⅱ &nbsp; Pause</button><button id="rain">☄ &nbsp; Object rain</button><button id="reset">↺ &nbsp; Reset scene</button></div><div class="hint panel"><kbd>Drag</kbd> Orbit &nbsp; <kbd>Scroll</kbd> Zoom<br><kbd>Right drag</kbd> Pan &nbsp; <kbd>Space</kbd> Spawn</div><div id="toast" class="toast panel"></div>`;
await RAPIER.init();
const scene = new THREE.Scene(); scene.background = new THREE.Color('#8b939c'); scene.fog = new THREE.Fog('#8b939c',45,95);
const renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace; app.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,150); camera.position.set(19,17,23);
const controls = new OrbitControls(camera,renderer.domElement); controls.target.set(-1,1,0); controls.enableDamping=true; controls.maxPolarAngle=Math.PI/2-.04; controls.minDistance=7; controls.maxDistance=55;
scene.add(new THREE.HemisphereLight(0xf5f7ff,0x68717c,2));
const sun = new THREE.DirectionalLight(0xf4f7ff,2.5); sun.position.set(8,22,10); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22}); sun.shadow.normalBias=.03; scene.add(sun);
const world = new RAPIER.World({x:0,y:-9.8,z:0});
world.numSolverIterations=12;
const objects=[]; let shape='box',color='#c6f47a',paused=false;
function material(c){return new THREE.MeshStandardMaterial({color:c,roughness:.62,metalness:.04});}
function fixedBox(x,y,z,w,h,d,c,rotation=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(c));m.position.set(x,y,z);m.rotation.z=rotation;m.receiveShadow=true;m.castShadow=true;m.userData.solid=true;scene.add(m);const b=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x,y,z).setRotation({x:0,y:0,z:Math.sin(rotation/2),w:Math.cos(rotation/2)}));world.createCollider(RAPIER.ColliderDesc.cuboid(w/2,h/2,d/2).setFriction(.8),b);}
// Neutral, enclosed blockout room: no ramps, towers, or preset obstacles.
const tileCanvas=document.createElement('canvas');tileCanvas.width=256;tileCanvas.height=256;
const ctx=tileCanvas.getContext('2d');ctx.fillStyle='#aeb4bd';ctx.fillRect(0,0,256,256);ctx.strokeStyle='#7d8793';ctx.lineWidth=3;ctx.strokeRect(0,0,256,256);ctx.fillStyle='#7d8793';ctx.fillRect(124,124,8,8);
function gridSurface(x,y,z,w,h,d,repeatX,repeatY){fixedBox(x,y,z,w,h,d,'#ffffff');const mesh=scene.children.at(-1);const texture=new THREE.CanvasTexture(tileCanvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(repeatX,repeatY);mesh.material.map=texture;mesh.material.roughness=.95;}
gridSurface(0,-.5,0,32,1,32,32,32);
gridSurface(0,4,-16.2,32,8,.4,32,8);
gridSurface(-16.2,4,0,.4,8,32,32,8);
gridSurface(16.2,4,0,.4,8,32,32,8);
gridSurface(0,4,16.2,32,8,.4,32,8);
// Wall-mounted light strips leave the test floor completely unobstructed.
for(const z of [-15.98,15.98]){const strip=new THREE.Mesh(new THREE.BoxGeometry(30,.08,.04),new THREE.MeshBasicMaterial({color:0xeaf3ff}));strip.position.set(0,7.5,z);scene.add(strip);}
function spawn(type=shape,x=(Math.random()-.5)*6,y=8,z=(Math.random()-.5)*6,size=Number(document.querySelector('#size').value),c=color){
 if(objects.length>=180){toast('180 objects reached — reset or remove a few.');return;}
 let geo,col;
 if(type==='ball'){geo=new THREE.SphereGeometry(size*.6,24,16);col=RAPIER.ColliderDesc.ball(size*.6);}
 else if(type==='cylinder'){geo=new THREE.CylinderGeometry(size*.5,size*.5,size*1.2,24);col=RAPIER.ColliderDesc.cylinder(size*.6,size*.5);}
 else{const dims=type==='plank'?[size*3,size*.3,size*.8]:[size,size,size];geo=new THREE.BoxGeometry(...dims);col=RAPIER.ColliderDesc.cuboid(...dims.map(v=>v/2));}
 const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y,z).setLinearDamping(.12).setAngularDamping(.15).setCcdEnabled(true));
 world.createCollider(col.setRestitution(Number(document.querySelector('#bounce').value)).setFriction(.65).setDensity(1),body);
 const mesh=new THREE.Mesh(geo,material(c));mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);objects.push({mesh,body});updateCount();return body;
}
function remove(o){world.removeRigidBody(o.body);scene.remove(o.mesh);o.mesh.geometry.dispose();o.mesh.material.dispose();objects.splice(objects.indexOf(o),1);updateCount();}
function updateCount(){document.querySelector('#count').textContent=objects.length;}
function reset(){[...objects].forEach(remove);}
let toastTimer;function toast(t){const el=document.querySelector('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200);}
document.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>{shape=b.dataset.shape;document.querySelectorAll('[data-shape]').forEach(e=>e.classList.toggle('active',e===b));});
document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{color=b.dataset.color;document.querySelectorAll('[data-color]').forEach(e=>e.classList.toggle('active',e===b));});
document.querySelector('#spawn').onclick=()=>spawn();
document.querySelector('#gravity').oninput=e=>{world.gravity={x:0,y:-Number(e.target.value),z:0};objects.forEach(o=>o.body.wakeUp());};
document.querySelector('#bounce').oninput=e=>objects.forEach(o=>o.body.collider(0).setRestitution(Number(e.target.value)));
document.querySelector('#pause').onclick=e=>{paused=!paused;e.target.textContent=paused?'▶  Resume':'Ⅱ  Pause';document.querySelector('#state').textContent=paused?'Simulation paused':'Live simulation';};
document.querySelector('#rain').onclick=()=>{for(let i=0;i<24;i++)spawn(['box','ball','cylinder'][i%3],(Math.random()-.5)*16,9+Math.random()*10,(Math.random()-.5)*12,.6+Math.random()*.5,['#c6f47a','#f3a66b','#80c7ce','#b4a2e5'][i%4]);toast('Forecast: a little chaos.');};
document.querySelector('#reset').onclick=()=>{reset();combat.reset();toast('A fresh start.');};
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();spawn();}});
const ray=new THREE.Raycaster();let down;
renderer.domElement.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});
renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5||e.button!==0)return;ray.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1),camera);const hit=ray.intersectObjects(objects.map(o=>o.mesh))[0];if(hit){const o=objects.find(o=>o.mesh===hit.object);if(e.shiftKey)remove(o);else{o.body.applyImpulse({x:ray.ray.direction.x*8,y:8,z:ray.ray.direction.z*8},true);o.body.applyTorqueImpulse({x:Math.random(),y:Math.random(),z:Math.random()},true);}}});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
reset();const combat=createCombat({scene,camera,renderer,world,controls,objects,toast,isPaused:()=>paused});let last=performance.now(),acc=0;
function animate(now){requestAnimationFrame(animate);const delta=Math.min((now-last)/1000,.1);last=now;if(!paused){acc+=delta;while(acc>=1/60){world.timestep=1/120;combat.step(1/120);world.step();combat.step(1/120);world.step();acc-=1/60;}}for(const o of [...objects]){const p=o.body.translation(),q=o.body.rotation();o.mesh.position.copy(p);o.mesh.quaternion.copy(q);if(p.y < -25)remove(o);}combat.update(delta,now);if(!combat.fps)controls.update();renderer.render(scene,camera);}requestAnimationFrame(animate);
