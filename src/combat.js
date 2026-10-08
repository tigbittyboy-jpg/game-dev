import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {createRagdoll,activateRagdoll} from './ragdoll.js';

export function createCombat({scene,camera,renderer,world,controls,objects,toast,isPaused}) {
 const ui=document.createElement('div');
 ui.innerHTML=`<div class="combat-bar panel"><button id="fps">Enter first person</button><button id="person">＋ Spawn person</button><button id="clear-people">Clear people</button><label><input id="blood" type="checkbox" checked> Blood effects</label></div><div id="fps-hud"><div class="crosshair">+</div><div class="weapon-hud panel"><b id="weapon-name">PISTOL</b><span id="ammo"></span><p>WASD move · Mouse aim · Click use · R reload<br>1 Pistol · 2 Shotgun · 3 Grab tool · 4 Bat<br>E spawn person · Esc release mouse</p><button id="exit-fps">Exit first person</button></div><div id="lock-hint">Click the scene to capture the mouse</div></div>`;
 document.body.append(ui);
 const hud=ui.querySelector('#fps-hud'),ammoUI=ui.querySelector('#ammo');
 const people=[],effects=[],stains=[],keys=new Set();let fps=false,yaw=0,pitch=0,weapon=0,grab=null,nextFire=0,reloadAt=0,blood=true,savedCamera,savedTarget;
 const mags=[12,6],capacity=[12,6];
 const player=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,1,9));
 const playerCollider=world.createCollider(RAPIER.ColliderDesc.capsule(.55,.35),player);
 playerCollider.setEnabled(false);
 const controller=world.createCharacterController(.02);controller.setSlideEnabled(true);controller.enableAutostep(.4,.25,true);controller.enableSnapToGround(.3);
 const gun=new THREE.Group();camera.add(gun);scene.add(camera);gun.position.set(.32,-.27,-.55);
 const dark=new THREE.MeshStandardMaterial({color:0x31383d,metalness:.7,roughness:.3});const grip=new THREE.MeshStandardMaterial({color:0x171b1e,roughness:.9});
 function gunPart(w,h,d,x,y,z,mat=dark){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);gun.add(m);return m;}
 const toolMaterial=new THREE.MeshStandardMaterial({color:0x80c7ce,emissive:0x164b55});
 const slide=gunPart(.105,.1,.36,0,0,0),handle=gunPart(.09,.19,.11,0,-.1,.1,grip),barrel=gunPart(.06,.06,.27,0,.005,-.26),stock=gunPart(.12,.13,.2,0,-.035,.22,grip);
 const muzzle=new THREE.Mesh(new THREE.ConeGeometry(.09,.24,6),new THREE.MeshBasicMaterial({color:0xffde8a}));muzzle.rotation.x=-Math.PI/2;muzzle.position.set(0,0,-.48);gun.add(muzzle);muzzle.visible=false;
 let flashUntil=0;gun.visible=false;
 let audio;
 function sound(){try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const n=Math.floor(audio.sampleRate*.16),buffer=audio.createBuffer(1,n,audio.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<n;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/n,3);const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=weapon===1?900:weapon===3?250:1800;gain.gain.value=.22;source.connect(filter).connect(gain).connect(audio.destination);source.start();}catch{}}
 function weaponUI(){ui.querySelector('#weapon-name').textContent=['PISTOL','SHOTGUN','PHYSICS GRAB','BAT'][weapon];ammoUI.textContent=reloadAt?'RELOADING…':weapon<2?`${mags[weapon]} / ${capacity[weapon]} · unlimited reserve`:weapon===2?(grab?'HOLDING · Click to release':'Click to grab'):'Click to swing';slide.scale.set(1,weapon===3?2:1,weapon===1?1.7:weapon===3?3:1);barrel.visible=weapon===1;stock.visible=weapon===1;handle.visible=weapon!==3;slide.material=weapon===2?toolMaterial:dark;}
 function spawnPerson(x=(Math.random()-.5)*12,z=-5+Math.random()*7){
  if(people.length>=12){toast('12 people maximum. Clear some to make room.');return;}
  // Keep new characters away from existing bodies, rather than spawning intersecting colliders.
  for(let attempt=0;attempt<30&&people.some(p=>p.parts.some(o=>{const pos=o.body.translation();return Math.hypot(pos.x-x,pos.z-z)<.9;}));attempt++){x=(Math.random()-.5)*20;z=(Math.random()-.5)*18;}
  const p=createRagdoll(world,x,z,people.length);people.push(p);
  const colors={shirt:[0x777f89,0x647483,0x89907a][people.length%3],skin:0xc7a286,pants:0x343b46,boots:0x20252c};
  for(const o of p.parts){const spec=o.spec;const geo=spec.dims?new THREE.BoxGeometry(...spec.dims):new THREE.CapsuleGeometry(spec.radius,spec.length,6,12);const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:colors[spec.color],roughness:.85}));mesh.castShadow=true;mesh.receiveShadow=true;mesh.position.copy(o.body.translation());scene.add(mesh);o.mesh=mesh;
   if(spec.name==='head')for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.018,6,6),new THREE.MeshBasicMaterial({color:0x25282b}));eye.position.set(side*.055,.035,.145);mesh.add(eye);}
  }
  return p;
 }
 function disposeMesh(m){scene.remove(m);m.traverse(child=>{child.geometry?.dispose();if(child.material)child.material.dispose();});}
 function clear(){grab=null;for(const p of people)for(const part of p.parts){world.removeRigidBody(part.body);disposeMesh(part.mesh);}people.length=0;for(const e of effects)disposeMesh(e.mesh);effects.length=0;for(const m of stains)disposeMesh(m);stains.length=0;weaponUI();}
 function splatter(point,dir){if(!blood)return;for(let i=0;i<13;i++){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.025+Math.random()*.025,5,4),new THREE.MeshBasicMaterial({color:0x972c35}));mesh.position.copy(point);scene.add(mesh);effects.push({mesh,vel:new THREE.Vector3((Math.random()-.5)*3,Math.random()*3,(Math.random()-.5)*3).addScaledVector(dir,2),life:.7+Math.random()*.6});}const mark=new THREE.Mesh(new THREE.CircleGeometry(.12+Math.random()*.2,10),new THREE.MeshBasicMaterial({color:0x68292c,transparent:true,opacity:.8,depthWrite:false}));mark.rotation.x=-Math.PI/2;mark.position.set(point.x,.021,point.z);scene.add(mark);stains.push(mark);if(stains.length>100)disposeMesh(stains.shift());}
 const ray=new THREE.Raycaster();
 function cast(spread=0){ray.setFromCamera(new THREE.Vector2((Math.random()-.5)*spread,(Math.random()-.5)*spread),camera);const candidates=[...objects.map(o=>o.mesh),...people.flatMap(p=>p.parts.map(o=>o.mesh)),...scene.children.filter(m=>m.isMesh&&m.userData.solid)];const hit=ray.intersectObjects(candidates,false)[0];if(!hit)return null;const target=objects.find(o=>o.mesh===hit.object)||people.flatMap(p=>p.parts).find(o=>o.mesh===hit.object);return {hit,target,dir:ray.ray.direction.clone()};}
 function use(){if(!fps||document.pointerLockElement!==renderer.domElement||isPaused())return;const now=performance.now();if(reloadAt||now<nextFire)return;
 if(weapon===2){if(grab){grab=null;weaponUI();return;}const result=cast();if(result?.target&&result.hit.distance<12){grab=result.target;if(grab.person)activateRagdoll(grab.person);weaponUI();}return;}
 if(weapon<2&&mags[weapon]===0){reload();return;}nextFire=now+(weapon===1?750:weapon===3?450:230);if(weapon<2){mags[weapon]--;flashUntil=now+55;}gun.rotation.x=-.15;sound();
 for(let i=0;i<(weapon===1?8:1);i++){const result=cast(weapon===1?.07:0);if(!result||!result.target||(weapon===3&&result.hit.distance>3))continue;const {hit,target,dir}=result;const power=target.person?(weapon===1?3:weapon===3?30:12):(weapon===1?2.3:weapon===3?7:4);if(target.person)activateRagdoll(target.person);target.body.applyImpulseAtPoint({x:dir.x*power,y:dir.y*power+.25,z:dir.z*power},hit.point,true);if(target.person){splatter(hit.point,dir);}}
 weaponUI();}
 function reload(){if(weapon>1||reloadAt||mags[weapon]===capacity[weapon])return;reloadAt=performance.now()+(weapon===1?1600:1100);weaponUI();}
 function enter(){if(fps)return;fps=true;savedCamera=camera.position.clone();savedTarget=controls.target.clone();controls.enabled=false;playerCollider.setEnabled(true);player.setTranslation({x:0,y:1,z:9},true);yaw=0;pitch=0;hud.style.display='block';document.body.classList.add('first-person');gun.visible=true;camera.rotation.order='YXZ';renderer.domElement.requestPointerLock();weaponUI();}
 function exit(){if(!fps)return;fps=false;document.exitPointerLock();playerCollider.setEnabled(false);grab=null;keys.clear();gun.visible=false;hud.style.display='none';document.body.classList.remove('first-person');camera.position.copy(savedCamera);controls.target.copy(savedTarget);controls.enabled=true;controls.update();}
 ui.querySelector('#fps').onclick=enter;ui.querySelector('#exit-fps').onclick=exit;ui.querySelector('#person').onclick=()=>spawnPerson();ui.querySelector('#clear-people').onclick=clear;ui.querySelector('#blood').onchange=e=>blood=e.target.checked;
 document.addEventListener('pointerlockchange',()=>{keys.clear();ui.querySelector('#lock-hint').style.display=document.pointerLockElement===renderer.domElement?'none':'block';});
 document.addEventListener('mousemove',e=>{if(fps&&document.pointerLockElement===renderer.domElement){yaw-=e.movementX*.002;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.002,-1.45,1.45);}});
 window.addEventListener('blur',()=>keys.clear());
 window.addEventListener('keydown',e=>{if(!fps)return;if(['KeyW','KeyA','KeyS','KeyD','Space','KeyE','KeyR','Digit1','Digit2','Digit3','Digit4'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();}if(document.pointerLockElement!==renderer.domElement)return;keys.add(e.code);if(!e.repeat&&e.code==='KeyE'){const d=new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);const pos=player.translation();spawnPerson(THREE.MathUtils.clamp(pos.x+d.x*4,-14,14),THREE.MathUtils.clamp(pos.z+d.z*4,-11,11));}if(e.code==='KeyR')reload();if(/^Digit[1-4]$/.test(e.code)){weapon=Number(e.code.slice(-1))-1;reloadAt=0;grab=null;weaponUI();}},true);
 window.addEventListener('keyup',e=>keys.delete(e.code));
 renderer.domElement.addEventListener('pointerdown',e=>{if(!fps)return;e.stopImmediatePropagation();if(document.pointerLockElement!==renderer.domElement)renderer.domElement.requestPointerLock();else if(e.button===0)use();},true);
 renderer.domElement.addEventListener('pointerup',e=>{if(fps)e.stopImmediatePropagation();},true);
 function step(dt){
 if(fps){const pos=player.translation();const moving=document.pointerLockElement===renderer.domElement;const v=new THREE.Vector3(moving?Number(keys.has('KeyD'))-Number(keys.has('KeyA')):0,0,moving?Number(keys.has('KeyS'))-Number(keys.has('KeyW')):0).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),yaw).multiplyScalar(dt*5);controller.computeColliderMovement(playerCollider,{x:v.x,y:-9.8*dt,z:v.z});const m=controller.computedMovement();player.setNextKinematicTranslation({x:pos.x+m.x,y:pos.y+m.y,z:pos.z+m.z});}
 if(grab){const point=camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(3).add(camera.position),pos=grab.body.translation(),vel=grab.body.linvel();const mass=grab.body.mass();grab.body.applyImpulse({x:((point.x-pos.x)*18-vel.x*8)*dt*mass,y:((point.y-pos.y)*18-vel.y*8-world.gravity.y)*dt*mass,z:((point.z-pos.z)*18-vel.z*8)*dt*mass},true);}
 }
 function update(dt,now){if(reloadAt&&now>=reloadAt){mags[weapon]=capacity[weapon];reloadAt=0;weaponUI();}muzzle.visible=now<flashUntil;gun.rotation.x=THREE.MathUtils.lerp(gun.rotation.x,0,Math.min(1,dt*12));for(const p of people)for(const o of p.parts){o.mesh.position.copy(o.body.translation());o.mesh.quaternion.copy(o.body.rotation());}if(fps){const pos=player.translation();camera.position.set(pos.x,pos.y+.65,pos.z);camera.rotation.set(pitch,yaw,0,'YXZ');}for(let i=effects.length-1;i>=0;i--){const e=effects[i];if(!isPaused()){e.life-=dt;e.vel.y-=9.8*dt;e.mesh.position.addScaledVector(e.vel,dt);}if(e.life<=0||e.mesh.position.y<0){disposeMesh(e.mesh);effects.splice(i,1);}}}
 for(let i=0;i<4;i++)spawnPerson(-4+i*2,-3);
 return {step,update,reset:()=>{clear();for(let i=0;i<4;i++)spawnPerson(-4+i*2,-3);},get fps(){return fps;}};
}
