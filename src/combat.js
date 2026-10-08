import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {createRagdoll,activateRagdoll} from './ragdoll.js';
import {registerHit,stepReaction,stepWounds} from './reactions.js';

const weapons=[
 {name:'Pistol',capacity:12,cooldown:.23,reload:1.15,pellets:1,spread:.003,impulse:12,damage:.16},
 {name:'Shotgun',capacity:6,cooldown:.8,reload:1.8,pellets:8,spread:.07,impulse:2.8,damage:.035},
 {name:'Grab tool',capacity:0}, {name:'Baton',capacity:0,cooldown:.55,impulse:18,damage:.08},
];
export function createCombat({scene,camera,renderer,world,controls,objects,toast,isPaused}) {
 const ui=document.createElement('div');
 ui.innerHTML=`<div class="combat-bar panel"><button id="fps">▶ Play first person</button><button id="person">＋ Subject</button><button id="clear-people">Clear subjects</button><button id="help" aria-pressed="false">Controls</button><label><input id="blood" type="checkbox" checked> Blood</label></div>
 <div id="fps-hud"><div class="crosshair">·</div><div id="hit-marker">×</div><div id="subject-hud" class="panel"></div>
 <div class="weapon-hud panel"><div class="weapon-select">${weapons.map((w,i)=>`<button data-weapon="${i}">${i+1} ${w.name}</button>`).join('')}</div><div class="weapon-readout"><b id="weapon-name">PISTOL</b><span id="ammo"></span></div><p>WASD move · Shift sprint · Space jump · Mouse aim<br>Click use · Right click aim · R reload · E subject<br>P pause · X reset<br>Grab: scroll distance · Right click throw · Esc cursor</p><button id="pause-fps">Pause</button> <button id="reset-fps">Reset chamber</button> <button id="exit-fps">Orbit view</button></div><div id="lock-hint"><strong>Mouse released</strong><br>Click the chamber to continue. Esc releases the mouse.</div></div>`;
 document.body.append(ui);
 const hud=ui.querySelector('#fps-hud'),ammoUI=ui.querySelector('#ammo'),subjectUI=ui.querySelector('#subject-hud');
 const people=[],effects=[],stains=[],transients=[],keys=new Set();
 let ads=false;
 let threat=null;
 let fps=false,yaw=0,pitch=0,weapon=0,grab=null,grabDistance=3,blood=true,simTime=0,nextFire=0,reloadAt=0;
 let savedCamera,savedTarget,verticalVelocity=0,grounded=false,recoil=0,flashUntil=0,hitUntil=0,hudClock=0,walkTime=0;
 const magazines=weapons.map(w=>w.capacity);
 const player=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,1,7));
 const playerCollider=world.createCollider(RAPIER.ColliderDesc.capsule(.55,.35),player);playerCollider.setEnabled(false);
 const controller=world.createCharacterController(.02);controller.setSlideEnabled(true);controller.enableAutostep(.3,.25,true);controller.enableSnapToGround(.25);
 const gun=new THREE.Group();camera.add(gun);scene.add(camera);gun.position.set(.29,-.24,-.5);gun.visible=false;
 const metal=new THREE.MeshStandardMaterial({color:0x30343b,metalness:.38,roughness:.32});
 const polymer=new THREE.MeshStandardMaterial({color:0x14191f,roughness:.85});
 const wood=new THREE.MeshStandardMaterial({color:0x72523a,roughness:.75});
 const toolMaterial=new THREE.MeshStandardMaterial({color:0x69a7b7,emissive:0x153640,roughness:.45,metalness:.4});
 function box(w,h,d,x,y,z,mat=metal){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);gun.add(mesh);return mesh;}
 function tube(radius,length,x,y,z,mat=metal){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,16),mat);mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);gun.add(mesh);return mesh;}
 const models=weapons.map(()=>new THREE.Group());models.forEach(g=>gun.add(g));
 function build(index,fn){const before=new Set(gun.children);fn();gun.children.filter(m=>!before.has(m)).forEach(m=>models[index].add(m));}
 build(0,()=>{box(.1,.08,.29,0,0,-.02);box(.09,.07,.23,0,-.065,.005,polymer);const grip=box(.085,.17,.105,0,-.15,.065,polymer);grip.rotation.x=-.18;box(.015,.027,.02,0,.052,-.14);box(.055,.027,.02,0,.052,.11);tube(.025,.06,0,0,-.18);box(.07,.013,.09,0,-.12,-.035);box(.07,.09,.015,0,-.08,-.08);});
 build(1,()=>{tube(.032,.6,0,0,-.2);tube(.028,.45,0,-.065,-.16);box(.12,.105,.22,0,-.005,.18);box(.115,.1,.17,0,-.065,-.08,wood);box(.1,.18,.09,0,-.15,.24,polymer);box(.13,.13,.24,0,-.05,.37,wood);box(.02,.027,.025,0,.05,-.48);});
 build(2,()=>{box(.14,.1,.25,0,0,-.04,toolMaterial);box(.09,.18,.1,0,-.12,.08,polymer);for(const s of [-1,1]){box(.025,.025,.19,s*.1,0,-.2,toolMaterial);box(.025,.09,.02,s*.1,.03,-.29,toolMaterial);}tube(.03,.15,0,0,-.18,toolMaterial);});
 build(3,()=>{const m=tube(.028,.65,0,.16,-.05,polymer);m.rotation.x=.35;tube(.039,.13,0,-.1,.04);});
 const skin=new THREE.MeshStandardMaterial({color:0xbe997c,roughness:.85});
 const hand=box(.09,.13,.09,.065,-.14,.065,skin);
 const sleeve=box(.11,.15,.28,.07,-.24,.22,new THREE.MeshStandardMaterial({color:0x3c4b58,roughness:.85}));sleeve.rotation.x=.35;
 const muzzle=new THREE.Mesh(new THREE.ConeGeometry(.075,.2,6),new THREE.MeshBasicMaterial({color:0xffd990}));muzzle.rotation.x=-Math.PI/2;gun.add(muzzle);muzzle.visible=false;
 let audio;
 function sound(type='fire') {try{
  audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const time=audio.currentTime;
  const duration=type==='hit'?.09:type==='reload'?.05:weapon===1?.23:.12;
  const buffer=audio.createBuffer(1,Math.floor(audio.sampleRate*duration),audio.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2.5);
  const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=type==='hit'?350:type==='reload'?2500:weapon===1?1200:1800;gain.gain.value=type==='hit'?.09:type==='reload'?.035:.14;source.connect(filter).connect(gain).connect(audio.destination);source.start();
  if(type==='fire'&&weapon<2){const osc=audio.createOscillator(),g=audio.createGain();osc.frequency.setValueAtTime(weapon===1?95:140,time);osc.frequency.exponentialRampToValueAtTime(40,time+.1);g.gain.setValueAtTime(.12,time);g.gain.exponentialRampToValueAtTime(.001,time+.13);osc.connect(g).connect(audio.destination);osc.start();osc.stop(time+.14);}
 }catch{}}
 function weaponUI(){const w=weapons[weapon];ui.querySelector('#weapon-name').textContent=w.name.toUpperCase();ammoUI.textContent=reloadAt?'RELOADING':w.capacity?`${magazines[weapon]} / ${w.capacity}`:weapon===2?(grab?'HOLDING · scroll / throw':'Click to grab'):'Close range';models.forEach((m,i)=>m.visible=i===weapon);ui.querySelectorAll('[data-weapon]').forEach(b=>b.classList.toggle('active',Number(b.dataset.weapon)===weapon));}
 function selectWeapon(index){ads=false;weapon=index;reloadAt=0;grab=null;weaponUI();}
 ui.querySelectorAll('[data-weapon]').forEach(b=>b.onclick=()=>selectWeapon(Number(b.dataset.weapon)));
 function spawnPerson(x=(Math.random()-.5)*10,z=-3+Math.random()*5){
  if(people.length>=12){toast('12 subjects maximum. Clear or reset to make room.');return;}
  let free=false;for(let attempt=0;attempt<40;attempt++){if(!people.some(p=>p.parts.some(o=>{const pos=o.body.translation();return Math.hypot(pos.x-x,pos.z-z)<1;}))){free=true;break;}x=(Math.random()-.5)*20;z=(Math.random()-.5)*18;}
  if(!free){toast('No clear spawn position. Reset the chamber.');return;}
  const p=createRagdoll(world,x,z);p.id=people.length+1;p.marks=[];people.push(p);
  const colors={shirt:[0x788594,0x617b88,0x858875][people.length%3],skin:0xc7a286,pants:0x303946,boots:0x20252c};
  for(const o of p.parts){const s=o.spec,geo=s.dims?new THREE.BoxGeometry(...s.dims):new THREE.CapsuleGeometry(s.radius,s.length,8,16);const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:colors[s.color],roughness:.85}));mesh.castShadow=true;mesh.receiveShadow=true;mesh.position.copy(o.body.translation());scene.add(mesh);o.mesh=mesh;
   if(s.name==='head'){
    const face=new THREE.Group();mesh.add(face);o.face=face;
    for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.022,8,6),new THREE.MeshStandardMaterial({color:0xddd9d2}));eye.position.set(side*.057,.025,.143);face.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(.011,8,6),polymer.clone());pupil.position.z=.016;eye.add(pupil);}
    const nose=new THREE.Mesh(new THREE.ConeGeometry(.025,.07,8),new THREE.MeshStandardMaterial({color:0xbc9478}));nose.rotation.x=Math.PI/2;nose.position.set(0,-.01,.168);mesh.add(nose);
    const hair=new THREE.Mesh(new THREE.SphereGeometry(.165,16,8,0,Math.PI*2,0,.95),new THREE.MeshStandardMaterial({color:0x35302e,roughness:.95}));hair.position.y=.027;mesh.add(hair);
   }
   if(s.name.startsWith('forearm')){const hand=new THREE.Mesh(new THREE.CapsuleGeometry(.065,.065,4,8),new THREE.MeshStandardMaterial({color:colors.skin}));hand.position.y=-.22;mesh.add(hand);}
  }
  return p;
 }
 function disposeMesh(m){m.removeFromParent();m.traverse(child=>{child.geometry?.dispose();if(Array.isArray(child.material))child.material.forEach(mat=>mat.dispose());else child.material?.dispose();});}
 function clear(){grab=null;people.forEach(p=>p.parts.forEach(o=>{world.removeRigidBody(o.body);disposeMesh(o.mesh);}));people.length=0;[...effects,...transients].forEach(e=>disposeMesh(e.mesh));effects.length=0;transients.length=0;stains.forEach(disposeMesh);stains.length=0;subjectUI.style.display='none';weaponUI();}
 function stain(point,radius=.04){const m=new THREE.Mesh(new THREE.CircleGeometry(radius,12),new THREE.MeshBasicMaterial({color:0x652a30,transparent:true,opacity:.75,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(point.x,.021+Math.random()*.002,point.z);m.scale.x=1+Math.random()*.6;scene.add(m);stains.push(m);if(stains.length>220)disposeMesh(stains.shift());}
 function droplet(point,velocity,radius=.018){if(!blood||effects.length>=240)return;const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,5,4),new THREE.MeshBasicMaterial({color:0x972c35}));mesh.position.copy(point);mesh.position.y=Math.max(.035,mesh.position.y);scene.add(mesh);effects.push({mesh,vel:velocity,life:3});}
 function splatter(point,dir){if(!blood)return;for(let i=0;i<8;i++)droplet(point,new THREE.Vector3((Math.random()-.5)*1.2,Math.random()*.9,(Math.random()-.5)*1.2).addScaledVector(dir,.65),.014+Math.random()*.013);}
 function bleed(w){if(!blood)return;const point=new THREE.Vector3().copy(w.localPoint).applyQuaternion(new THREE.Quaternion().copy(w.part.body.rotation())).add(w.part.body.translation());const v=w.part.body.linvel();droplet(point,new THREE.Vector3(v.x*.18+(Math.random()-.5)*.18,v.y*.18-.1,v.z*.18+(Math.random()-.5)*.18));}
 const ray=new THREE.Raycaster();
 function cast(spread=0){ray.setFromCamera(new THREE.Vector2((Math.random()-.5)*spread,(Math.random()-.5)*spread),camera);const meshes=[...objects.map(o=>o.mesh),...people.flatMap(p=>p.parts.map(o=>o.mesh)),...scene.children.filter(m=>m.isMesh&&m.userData.solid)];const hit=ray.intersectObjects(meshes,false)[0];if(!hit)return null;return {hit,target:objects.find(o=>o.mesh===hit.object)||people.flatMap(p=>p.parts).find(o=>o.mesh===hit.object),dir:ray.ray.direction.clone()};}
 function use(){if(!fps||document.pointerLockElement!==renderer.domElement||isPaused()||reloadAt||simTime<nextFire)return;
  if(weapon===2){if(grab){grab=null;}else{const r=cast();if(r?.target&&r.hit.distance<12){grab=r.target;grabDistance=THREE.MathUtils.clamp(r.hit.distance,1.5,6);if(grab.person)activateRagdoll(grab.person);}}weaponUI();return;}
  const w=weapons[weapon];if(w.capacity&&magazines[weapon]===0){reload();return;}nextFire=simTime+w.cooldown;if(weapon<2)threat={...camera.position,until:simTime+.6};if(w.capacity)magazines[weapon]--;flashUntil=simTime+.055;recoil=weapon===1?.12:weapon===3?.45:.045;sound();
  let connected=false;
  for(let i=0;i<(w.pellets||1);i++){const r=cast(w.spread||0);if(!r||!r.target||(weapon===3&&r.hit.distance>2.8))continue;const {hit,target,dir}=r;
   if(target.person)activateRagdoll(target.person);
   const power=Math.min(w.impulse,target.body.mass()*(target.person?3:7));target.body.applyImpulseAtPoint({x:dir.x*power,y:dir.y*power,z:dir.z*power},hit.point,true);
   if(target.person){const inverse=new THREE.Quaternion().copy(target.body.rotation()).invert(),local=hit.point.clone().sub(target.body.translation()).applyQuaternion(inverse);const region=target.spec.name;const damage=w.damage*(region==='head'?3:region.startsWith('forearm')||region.startsWith('shin')?.55:1);registerHit(target.person,target,local,damage);
    if(blood){const mark=new THREE.Mesh(new THREE.CircleGeometry(.025+Math.random()*.014,10),new THREE.MeshBasicMaterial({color:0x652a30,transparent:true,opacity:.85,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2}));mark.position.copy(local);mark.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),hit.face?.normal||new THREE.Vector3(0,0,1));target.mesh.add(mark);target.person.marks.push(mark);if(target.person.marks.length>16)disposeMesh(target.person.marks.shift());}
    splatter(hit.point,dir);connected=true;}
  }
  if(connected){hitUntil=simTime+.17;sound('hit');}weaponUI();
 }
 function reload(){const w=weapons[weapon];if(!w.capacity||reloadAt||magazines[weapon]===w.capacity||isPaused())return;reloadAt=simTime+w.reload;sound('reload');weaponUI();}
 function enter(){if(fps)return;fps=true;savedCamera=camera.position.clone();savedTarget=controls.target.clone();controls.enabled=false;playerCollider.setEnabled(true);player.setTranslation({x:0,y:1,z:7},true);verticalVelocity=0;yaw=0;pitch=0;hud.style.display='block';document.body.classList.add('first-person','help-hidden');ui.querySelector('#help').setAttribute('aria-pressed','false');gun.visible=true;camera.fov=70;camera.updateProjectionMatrix();camera.rotation.order='YXZ';capture();weaponUI();}
 function capture(){try{const p=renderer.domElement.requestPointerLock();p?.catch(()=>toast('Click the scene to capture the mouse.'));}catch{toast('Click the scene to capture the mouse.');}}
 function exit(){if(!fps)return;fps=false;ads=false;document.exitPointerLock();playerCollider.setEnabled(false);grab=null;keys.clear();gun.visible=false;hud.style.display='none';document.body.classList.remove('first-person','help-hidden');camera.position.copy(savedCamera);camera.fov=45;camera.updateProjectionMatrix();controls.target.copy(savedTarget);controls.enabled=true;controls.update();}
 function resetSubjects(){clear();threat=null;for(let i=0;i<4;i++)spawnPerson(-3+i*2,-2);magazines.splice(0,magazines.length,...weapons.map(w=>w.capacity));reloadAt=0;nextFire=0;hitUntil=0;weaponUI();}
 function toggleHelp(){const hidden=document.body.classList.toggle('help-hidden');ui.querySelector('#help').setAttribute('aria-pressed',String(!hidden));}
 ui.querySelector('#help').onclick=toggleHelp;
 ui.querySelector('#fps').onclick=enter;ui.querySelector('#exit-fps').onclick=exit;ui.querySelector('#person').onclick=()=>spawnPerson();ui.querySelector('#clear-people').onclick=clear;
 ui.querySelector('#reset-fps').onclick=()=>document.querySelector('#reset').click();ui.querySelector('#pause-fps').onclick=()=>document.querySelector('#pause').click();
 ui.querySelector('#blood').onchange=e=>{blood=e.target.checked;if(!blood){effects.forEach(e=>disposeMesh(e.mesh));effects.length=0;}};
 document.addEventListener('pointerlockchange',()=>{keys.clear();ads=false;ui.querySelector('#lock-hint').style.display=document.pointerLockElement===renderer.domElement?'none':'block';});
 document.addEventListener('mousemove',e=>{if(fps&&document.pointerLockElement===renderer.domElement){yaw-=e.movementX*.0018;pitch=THREE.MathUtils.clamp(pitch-e.movementY*.0018,-1.45,1.45);camera.rotation.set(pitch+recoil*.12,yaw,0,'YXZ');camera.updateMatrixWorld();}});
 window.addEventListener('blur',()=>keys.clear());
 const handled=['KeyW','KeyA','KeyS','KeyD','Space','KeyE','KeyR','KeyP','KeyX','KeyH','Digit1','Digit2','Digit3','Digit4'];
 window.addEventListener('keydown',e=>{if(!fps)return;if(handled.includes(e.code)){e.preventDefault();e.stopImmediatePropagation();}if(e.code==='KeyH'&&!e.repeat){toggleHelp();return;}if(document.pointerLockElement!==renderer.domElement)return;keys.add(e.code);if(e.repeat)return;
  if(e.code==='KeyP')document.querySelector('#pause').click();if(e.code==='KeyX')document.querySelector('#reset').click();
  if(isPaused())return;
  if(e.code==='Space'&&grounded){verticalVelocity=4.5;grounded=false;}
  if(e.code==='KeyE'){const d=new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),yaw),p=player.translation();spawnPerson(THREE.MathUtils.clamp(p.x+d.x*4,-14,14),THREE.MathUtils.clamp(p.z+d.z*4,-14,14));}
  if(e.code==='KeyR')reload();if(/^Digit[1-4]$/.test(e.code))selectWeapon(Number(e.code.slice(-1))-1);
 },true);
 window.addEventListener('keyup',e=>keys.delete(e.code));
 renderer.domElement.addEventListener('pointerdown',e=>{if(!fps)return;e.stopImmediatePropagation();if(document.pointerLockElement!==renderer.domElement){capture();return;}if(e.button===0)use();else if(e.button===2&&weapon<2){ads=true;}else if(e.button===2&&grab&&!isPaused()){const dir=camera.getWorldDirection(new THREE.Vector3()),power=grab.body.mass()*3;grab.body.applyImpulse({x:dir.x*power,y:dir.y*power+grab.body.mass(),z:dir.z*power},true);grab=null;weaponUI();}},true);
 renderer.domElement.addEventListener('pointerup',e=>{if(fps){e.stopImmediatePropagation();if(e.button===2)ads=false;}},true);
 renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
 renderer.domElement.addEventListener('wheel',e=>{if(fps&&grab){e.preventDefault();e.stopImmediatePropagation();grabDistance=THREE.MathUtils.clamp(grabDistance+e.deltaY*.004,1.5,7);}}, {capture:true,passive:false});
 function step(dt){simTime+=dt;
  for(const p of people){stepReaction(p,dt,grab?.person===p,{people,objects,player:fps?player.translation():null,threat:threat&&simTime<threat.until?threat:null});stepWounds(p,dt,bleed);}
  if(fps){const p=player.translation(),moving=document.pointerLockElement===renderer.domElement;const speed=keys.has('ShiftLeft')||keys.has('ShiftRight')?6:3.7;const v=new THREE.Vector3(moving?Number(keys.has('KeyD'))-Number(keys.has('KeyA')):0,0,moving?Number(keys.has('KeyS'))-Number(keys.has('KeyW')):0).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),yaw).multiplyScalar(dt*speed);verticalVelocity=Math.max(-20,verticalVelocity+world.gravity.y*dt);controller.computeColliderMovement(playerCollider,{x:v.x,y:verticalVelocity*dt,z:v.z});const m=controller.computedMovement();grounded=controller.computedGrounded();if(grounded&&verticalVelocity<0)verticalVelocity=-.1;player.setNextKinematicTranslation({x:p.x+m.x,y:p.y+m.y,z:p.z+m.z});if(v.lengthSq())walkTime+=dt*speed;}
  if(grab){const point=camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(grabDistance).add(camera.position),pos=grab.body.translation(),v=grab.body.linvel(),mass=grab.body.mass();const impulse=new THREE.Vector3((point.x-pos.x)*16-v.x*8,(point.y-pos.y)*16-v.y*8-world.gravity.y,(point.z-pos.z)*16-v.z*8).clampLength(0,35).multiplyScalar(dt*mass);grab.body.applyImpulse(impulse,true);}
 }
 function update(dt){
  if(fps){const fov=THREE.MathUtils.damp(camera.fov,ads?52:70,12,dt);if(Math.abs(camera.fov-fov)>.01){camera.fov=fov;camera.updateProjectionMatrix();}gun.position.x=THREE.MathUtils.damp(gun.position.x,ads?.04:.29,12,dt);}
  if(reloadAt&&simTime>=reloadAt){magazines[weapon]=weapons[weapon].capacity;reloadAt=0;sound('reload');weaponUI();}
  muzzle.visible=weapon<2&&simTime<flashUntil;muzzle.position.set(0,0,weapon===1?-.53:-.23);muzzle.rotation.z=Math.random()*Math.PI;
  if(!isPaused())recoil=THREE.MathUtils.damp(recoil,0,12,dt);
  gun.rotation.set(reloadAt?-.5:recoil,weapon===3?recoil:0,weapon===3?-recoil:0);gun.position.y=-.24+(reloadAt?-.14:0)+(fps&&grounded?Math.sin(walkTime*2)*.006:0);
  ui.querySelector('#hit-marker').style.opacity=simTime<hitUntil?'1':'0';ui.querySelector('#pause-fps').textContent=isPaused()?'Resume':'Pause';
  for(const p of people)for(const o of p.parts){o.mesh.position.copy(o.body.translation());o.mesh.quaternion.copy(o.body.rotation());if(o.spec.name==='torso')o.mesh.scale.z=1+(p.vitality>0?Math.sin(simTime*(p.active?2:3.1)+p.x)*.014:0);if(o.face)for(const eye of o.face.children)eye.scale.y=p.vitality===0?.18:Math.sin(simTime*1.4+p.x)>.992?.12:1;}
  if(fps){const p=player.translation();camera.position.set(p.x,p.y+.65,p.z);camera.rotation.set(pitch+recoil*.12,yaw,0,'YXZ');camera.updateMatrixWorld();hudClock+=dt;if(hudClock>.1){hudClock=0;const r=cast();const p=r?.target?.person;subjectUI.style.display=p?'block':'none';if(p){const health=Math.round(p.vitality*100);subjectUI.innerHTML=`<small>SUBJECT ${String(p.id).padStart(2,'0')} · ${r.target.spec.name.replace(/-?1$/,'')}</small><strong>${p.state==='unresponsive'?'Unresponsive':p.state==='idle'?'Standing':p.state==='held'?'Held':p.state==='walking'?'Walking':p.state==='fleeing'?'Fleeing':p.state==='limping'?'Injured · retreating':p.state==='staggering'?'Staggering':p.state==='guarding'?'Standing · guarding':p.state==='reacting'?'Hit reaction':'Injured · struggling'}</strong><div class="health-track"><i style="width:${health}%"></i></div><span>${health}% vitality · ${p.wounds.length} active wounds</span>`;}}}
  for(let i=effects.length-1;i>=0;i--){const e=effects[i];if(!isPaused()){e.life-=dt;e.vel.y+=world.gravity.y*dt;e.mesh.position.addScaledVector(e.vel,dt);}if(e.life<=0||e.mesh.position.y<=.025){if(blood&&e.mesh.position.y<=.025)stain(e.mesh.position,.035+Math.random()*.045);disposeMesh(e.mesh);effects.splice(i,1);}}
 }
 resetSubjects();
 return {step,update,reset:resetSubjects,get fps(){return fps;}};
}
