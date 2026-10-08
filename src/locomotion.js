import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
const up=new THREE.Vector3(0,1,0),q=new THREE.Quaternion(),yawQ=new THREE.Quaternion();
const mix=(a,b,t)=>a+(b-a)*t;
export function resumeWalking(person){
 person.blend={age:0,poses:person.parts.map(p=>({position:{...p.body.translation()},rotation:{...p.body.rotation()}}))};
 const root=person.parts.find(p=>p.spec.name==='pelvis').body.translation();person.x=root.x;person.z=root.z;
 person.active=true;person.balanceApplied=false;
 for(const p of person.parts){p.body.resetForces(false);p.body.resetTorques(false);p.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);}
}
export function stepLocomotion(person,dt,{people=[],objects=[],player=null,threat=null}={}){
 if(!person.nav&&!person.blend)person.blend={age:0,poses:person.parts.map(p=>({position:{...p.body.translation()},rotation:{...p.body.rotation()}}))};
 // Remember the source through a short dynamic stagger so recovery retreats away.
 threat??=person.lastThreat&&person.clock-person.lastThreat.at<1.2?person.lastThreat:null;
 const nav=person.nav??={heading:0,speed:0,phase:person.x*.6,target:{x:person.x+3,z:person.z-3},timer:0,panic:0};
 nav.timer-=dt;nav.panic=Math.max(0,nav.panic-dt);
 if(threat&&Math.hypot(person.x-threat.x,person.z-threat.z)<14){nav.panic=Math.max(nav.panic,4);const dx=person.x-threat.x,dz=person.z-threat.z,l=Math.hypot(dx,dz)||1;nav.target={x:THREE.MathUtils.clamp(person.x+dx/l*6,-13,13),z:THREE.MathUtils.clamp(person.z+dz/l*6,-13,13)};nav.timer=4;}
 if(person.hitCount)nav.panic=Math.max(nav.panic,1.2);
 if(nav.timer<=0||Math.hypot(nav.target.x-person.x,nav.target.z-person.z)<.6){const angle=person.clock*.71+person.x*1.7+person.z*.43;nav.target={x:THREE.MathUtils.clamp(person.x+Math.sin(angle)*5,-13,13),z:THREE.MathUtils.clamp(person.z+Math.cos(angle)*5,-13,13)};nav.timer=4+Math.abs(Math.sin(angle))*3;}
 let dx=nav.target.x-person.x,dz=nav.target.z-person.z;const d=Math.hypot(dx,dz)||1;dx/=d;dz/=d;
 for(const other of people){if(other===person)continue;const p=other.parts[0].body.translation(),ox=person.x-p.x,oz=person.z-p.z,dist=Math.hypot(ox,oz);if(dist<1.3){dx+=ox/(dist||1)*(1.3-dist)*2;dz+=oz/(dist||1)*(1.3-dist)*2;}}
 if(player){const ox=person.x-player.x,oz=person.z-player.z,dist=Math.hypot(ox,oz);if(dist<1.3){dx+=ox/(dist||1)*2;dz+=oz/(dist||1)*2;}}
 for(const object of objects){const p=object.body.translation(),ox=person.x-p.x,oz=person.z-p.z,dist=Math.hypot(ox,oz);if(p.y<2&&dist<1.8){dx+=ox/(dist||1)*(1.8-dist)*2;dz+=oz/(dist||1)*(1.8-dist)*2;}}
 const desired=Math.atan2(dx,dz);const turn=Math.atan2(Math.sin(desired-nav.heading),Math.cos(desired-nav.heading));nav.heading+=THREE.MathUtils.clamp(turn,-dt*3.5,dt*3.5);
 const desiredSpeed=(nav.panic?2.7:1.2)*(person.hitCount?.65:1)*Math.max(.45,Math.cos(turn));nav.speed=THREE.MathUtils.damp(nav.speed,desiredSpeed,5,dt);
 person.x=THREE.MathUtils.clamp(person.x+Math.sin(nav.heading)*nav.speed*dt,-14,14);person.z=THREE.MathUtils.clamp(person.z+Math.cos(nav.heading)*nav.speed*dt,-14,14);
 const stride=nav.panic?.4:.28;nav.phase+=dt*Math.PI*nav.speed/(2*stride);
 person.state=person.hitCount?'limping':nav.panic?'fleeing':'walking';
 const poses=new Map();const bounce=-(nav.panic?.13:.065)+Math.abs(Math.sin(nav.phase))*.018;
 const root=new THREE.Vector3(0,1+bounce,0),torso=new THREE.Vector3(0,1.37+bounce,0),head=new THREE.Vector3(0,1.88+bounce,0);
 poses.set('pelvis',{position:root,angle:0});poses.set('torso',{position:torso,angle:person.hitCount?.1:.025});poses.set('head',{position:head,angle:person.hitCount?-.1:0});
 for(const side of [-1,1]){
  const phase=((nav.phase+(side===1?Math.PI:0))%(Math.PI*2)+Math.PI*2)%(Math.PI*2),swing=Math.sin(phase);const stepZ=phase<Math.PI?-stride*Math.cos(phase):stride-(phase-Math.PI)/Math.PI*2*stride;
  const hip=new THREE.Vector3(side*.14,.88+bounce,0),foot=new THREE.Vector3(side*.14,.065+Math.max(0,swing)*.14,stepZ+.06);
  const ankle=foot.clone().add(new THREE.Vector3(0,.035,-.06));
  const delta=ankle.clone().sub(hip),length=THREE.MathUtils.clamp(delta.length(),.05,.78),direction=delta.normalize();
  const a=.405,b=.375,along=(a*a-b*b+length*length)/(2*length),bend=Math.sqrt(Math.max(0,a*a-along*along));
  const perpendicular=new THREE.Vector3(0,-direction.z,direction.y).normalize().negate();
  const knee=hip.clone().addScaledVector(direction,along).addScaledVector(perpendicular,bend);
  poses.set(`thigh${side}`,{position:hip.clone().lerp(knee,.5),direction:knee.clone().sub(hip).negate()});
  poses.set(`shin${side}`,{position:knee.clone().addScaledVector(ankle.clone().sub(knee).normalize(),.205),direction:ankle.clone().sub(knee).negate()});
  poses.set(`foot${side}`,{position:foot,angle:0});
  const shoulder=new THREE.Vector3(side*.35,1.57+bounce,0),angle=person.hitCount?-.65+Math.sin(person.clock*5+side)*.12:stepZ/stride*.38;
  const elbow=shoulder.clone().add(new THREE.Vector3(0,-Math.cos(angle)*.355,-Math.sin(angle)*.355));
  const lowerAngle=angle-(person.hitCount?.85:.25+Math.max(0,-swing)*.15);
  const wrist=elbow.clone().add(new THREE.Vector3(0,-Math.cos(lowerAngle)*.35,-Math.sin(lowerAngle)*.35));
  poses.set(`upperArm${side}`,{position:shoulder.clone().lerp(elbow,.5),angle});
  poses.set(`forearm${side}`,{position:elbow.clone().lerp(wrist,.5),angle:lowerAngle});
 }
 yawQ.setFromAxisAngle(up,nav.heading);if(person.blend)person.blend.age+=dt;
 const blend=person.blend?Math.min(1,person.blend.age/.6):1;
 person.parts.forEach((part,index)=>{const pose=poses.get(part.spec.name);q.identity();if(pose.direction)q.setFromUnitVectors(up,pose.direction.normalize());else q.setFromAxisAngle(new THREE.Vector3(1,0,0),pose.angle);q.premultiply(yawQ);const position=pose.position.applyQuaternion(yawQ).add(new THREE.Vector3(person.x,0,person.z));if(blend<1){const old=person.blend.poses[index];position.set(mix(old.position.x,position.x,blend),mix(old.position.y,position.y,blend),mix(old.position.z,position.z,blend));q.slerp(new THREE.Quaternion().copy(old.rotation),1-blend);}part.body.setNextKinematicTranslation(position);part.body.setNextKinematicRotation(q);});
 if(blend===1)person.blend=null;
}
