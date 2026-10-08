import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {createRagdoll,activateRagdoll} from '../src/ragdoll.js';
import {registerHit,stepReaction,stepWounds} from '../src/reactions.js';
await RAPIER.init();
const random=()=>.5;
function setup(){const w=new RAPIER.World({x:0,y:-9.8,z:0});w.timestep=1/120;w.numSolverIterations=12;w.createCollider(RAPIER.ColliderDesc.cuboid(20,.5,20).setTranslation(0,-.5,0));return w;}
test('reactions remain bounded and stop, with no perpetual twitching',()=>{const w=setup(),p=createRagdoll(w,0,0);activateRagdoll(p);registerHit(p,p.torso,{x:0,y:0,z:.2},.2,random);p.torso.body.applyImpulse({x:0,y:0,z:-18},true);let maxSpeed=0,drips=0;for(let i=0;i<2400;i++){stepReaction(p,1/120,false,random);stepWounds(p,1/120,()=>drips++,random);w.step();for(const o of p.parts){const v=o.body.linvel(),pos=o.body.translation();maxSpeed=Math.max(maxSpeed,Math.hypot(v.x,v.y,v.z));assert.ok(Number.isFinite(pos.x)&&pos.y>-.15);}}assert.ok(maxSpeed<12,`reaction speed ${maxSpeed}`);assert.equal(p.reaction,null);assert.equal(p.wounds.length,0);assert.ok(drips>5&&drips<30);assert.ok(p.parts.every(o=>{const v=o.body.linvel();return Math.hypot(v.x,v.y,v.z)<.2;}),'must settle after reactions finish');w.free();});
test('wounds have bounded count and produce intermittent emissions only while advancing',()=>{const w=setup(),p=createRagdoll(w,0,0);for(let i=0;i<10;i++)registerHit(p,p.torso,{x:0,y:0,z:.2},.1,random);assert.equal(p.wounds.length,3);let emitted=0;for(let i=0;i<30;i++)stepWounds(p,0,()=>emitted++,random);assert.equal(emitted,0);stepWounds(p,.5,()=>emitted++,random);assert.equal(emitted,3);stepWounds(p,.01,()=>emitted++,random);assert.equal(emitted,3);assert.equal(p.vitality,0);w.free();});
