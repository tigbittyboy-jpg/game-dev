import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {createRagdoll,activateRagdoll} from '../src/ragdoll.js';
import {registerHit,stepReaction} from '../src/reactions.js';
import {weapons} from '../src/combat.js';
await RAPIER.init();
const dt=1/120;
function setup(){const w=new RAPIER.World({x:0,y:-9.8,z:0});w.timestep=dt;w.numSolverIterations=12;w.createCollider(RAPIER.ColliderDesc.cuboid(20,.5,20).setTranslation(0,-.5,0));return w;}
function run(w,p,seconds,observe=()=>{},held=false){for(let i=0;i<seconds/dt;i++){stepReaction(p,dt,held);w.step();observe(p,i);}}
function fallen(w,injured=false){
 const p=createRagdoll(w,0,0),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
 for(const part of p.parts){const position=new THREE.Vector3().copy(part.body.translation()).sub(new THREE.Vector3(0,1,0)).applyQuaternion(q).add(new THREE.Vector3(0,.4,0));part.body.setTranslation(position,true);part.body.setRotation(q,true);}
 activateRagdoll(p);registerHit(p,injured?p.parts.find(part=>part.spec.name==='shin1'):p.torso,{x:0,y:0,z:0},.2,()=>.5);return p;
}
function anchorError(p){let error=0;for(const j of p.joints){const a=new THREE.Vector3().copy(j.anchorParent).applyQuaternion(new THREE.Quaternion().copy(j.parent.body.rotation())).add(j.parent.body.translation()),b=new THREE.Vector3().copy(j.anchorChild).applyQuaternion(new THREE.Quaternion().copy(j.child.body.rotation())).add(j.child.body.translation());error=Math.max(error,a.distanceTo(b));}return error;}

test('fallen survivors brace, get up gradually, and resume moving',()=>{
 const w=setup(),p=fallen(w),states=new Set();let maxRise=0,last=p.parts[0].body.translation().y;
 run(w,p,9,()=>{states.add(p.state);const y=p.parts[0].body.translation().y;maxRise=Math.max(maxRise,y-last);last=y;});
 assert.ok(states.has('getting-up'),'never attempted to get up');assert.equal(p.state,'limping');assert.ok(p.torso.body.translation().y>1.1);assert.ok(maxRise<.035,`recovery teleported upward by ${maxRise}m in one step`);assert.ok(Math.hypot(p.x,p.z)>1);w.free();
});
test('fallen subjects with injured legs crawl along the floor with alternating arm reach',()=>{
 const w=setup(),p=fallen(w,true),samples=[];run(w,p,10,()=>{if(p.state==='crawling')samples.push({root:{...p.parts[0].body.translation()},arm:{...p.parts.find(part=>part.spec.name==='forearm1').body.translation()}});});
 assert.equal(p.state,'crawling');assert.ok(samples.length>120);assert.ok(p.torso.body.translation().y<.7);const first=samples[120],last=samples.at(-1);assert.ok(Math.hypot(last.root.x-first.root.x,last.root.z-first.root.z)>.8);const arms=samples.map(s=>s.arm.z-s.root.z);assert.ok(Math.max(...arms)-Math.min(...arms)>.08);assert.ok(anchorError(p)<.002);w.free();
});
test('getting up and crawling are interrupted by hits and grabbing',()=>{
 for(const damaged of [false,true]){const w=setup(),p=fallen(w,damaged);run(w,p,2.4);assert.ok(p.active);activateRagdoll(p);registerHit(p,p.torso,{x:0,y:0,z:0},.05,()=>.5);assert.equal(p.active,false);assert.equal(p.recovery,null);run(w,p,3,()=>{},true);assert.equal(p.state,'held');assert.equal(p.active,false);run(w,p,7);assert.ok(p.active);assert.equal(p.state,damaged?'crawling':'limping');w.free();}
});
test('unresponsive and airborne subjects never begin ground recovery',()=>{
 const w=setup(),p=fallen(w);p.vitality=0;run(w,p,8);assert.equal(p.active,false);assert.equal(p.state,'unresponsive');assert.equal(p.recovery,null);
 const flying=createRagdoll(w,4,0);activateRagdoll(flying);for(const part of flying.parts)part.body.setTranslation({...part.body.translation(),y:part.body.translation().y+10},true);run(w,flying,.5);assert.equal(flying.active,false);assert.equal(flying.recovery,null);w.free();
});
test('animated gait keeps physics anchors connected and a shot does not kick the pelvis upward',()=>{
 for(const time of [1.3,2.1,3,3.8,4.7]){
 const w=setup(),p=createRagdoll(w,0,0);let error=0;run(w,p,time,()=>error=Math.max(error,anchorError(p)));assert.ok(error<.002,`animated joint gap ${error}`);
 const start=p.parts[0].body.translation().y;activateRagdoll(p);registerHit(p,p.torso,{x:0,y:0,z:0},.16,()=>.5);p.torso.body.applyImpulse({x:0,y:0,z:-weapons[0].impulse},true);let peak=start,upSpeed=0;
 run(w,p,.8,()=>{peak=Math.max(peak,p.parts[0].body.translation().y);upSpeed=Math.max(upSpeed,p.parts[0].body.linvel().y);});assert.ok(peak-start<.06,`shot at gait time ${time} lifted pelvis ${peak-start}m`);assert.ok(upSpeed<.8,`shot produced upward speed ${upSpeed}m/s`);w.free();
 }
});
