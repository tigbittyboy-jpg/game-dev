import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const up=new THREE.Vector3(0,1,0);
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
const rotation=(x=0,y=0,z=0)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z,'YXZ'));
const vector=p=>new THREE.Vector3(p.x,p.y,p.z);
const localRotations=person=>new Map(person.joints.map(j=>[j.limb,new THREE.Quaternion().copy(j.parent.body.rotation()).invert().multiply(new THREE.Quaternion().copy(j.child.body.rotation()))]));

export function resumeWalking(person,mode='walk'){
 const root=person.parts[0].body;
 person.blend={age:0,duration:mode==='walk'?.9:1.1,position:vector(root.translation()),rotation:new THREE.Quaternion().copy(root.rotation()),locals:localRotations(person)};
 person.x=root.translation().x;person.z=root.translation().z;
 person.active=true;person.balanceApplied=false;person.locomotionMode=mode;
 if(person.nav)person.nav.speed=0;
 for(const part of person.parts){part.body.resetForces(false);part.body.resetTorques(false);part.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);}
}

// Interpolate joint rotations, then rebuild positions from the actual physics anchors.
// Independent body-position interpolation stretches joints and makes the next hit snap.
function applyPose(person,dt,rootHeight,rootRotation,locals){
 if(person.blend)person.blend.age+=dt;
 const blend=person.blend,s=blend?smooth(blend.age/blend.duration):1;
 const rootPosition=new THREE.Vector3(person.x,rootHeight,person.z);
 if(blend){rootPosition.lerp(blend.position,1-s);rootRotation.slerp(blend.rotation,1-s);}
 const poses=new Map([['pelvis',{position:rootPosition,rotation:rootRotation}]]);
 for(const j of person.joints){
  const parent=poses.get(j.parent.spec.name),local=(locals.get(j.limb)||rotation()).clone();
  if(blend)local.slerp(blend.locals.get(j.limb),1-s);
  const worldRotation=parent.rotation.clone().multiply(local);
  const position=vector(j.anchorParent).applyQuaternion(parent.rotation).add(parent.position).sub(vector(j.anchorChild).applyQuaternion(worldRotation));
  poses.set(j.limb,{position,rotation:worldRotation});
 }
 // Keep animated limbs above the chamber floor, including pitched boot corners.
 let lift=0;
 for(const part of person.parts){
  const pose=poses.get(part.spec.name),spec=part.spec;
  let extent;
  if(spec.dims){extent=0;for(let i=0;i<3;i++){const axis=new THREE.Vector3().setComponent(i,1).applyQuaternion(pose.rotation);extent+=Math.abs(axis.y)*spec.dims[i]/2;}}
  else extent=spec.radius+Math.abs(up.clone().applyQuaternion(pose.rotation).y)*spec.length/2;
  lift=Math.max(lift,extent+.008-pose.position.y);
 }
 for(const part of person.parts){const pose=poses.get(part.spec.name);pose.position.y+=lift;part.body.setNextKinematicTranslation(pose.position);part.body.setNextKinematicRotation(pose.rotation);}
 if(s===1)person.blend=null;
}

function steer(person,dt,{people=[],objects=[],player=null,threat=null}={},crawl=false){
 threat??=person.lastThreat&&person.clock-person.lastThreat.at<5?person.lastThreat:null;
 const nav=person.nav??={heading:0,turnSpeed:0,speed:0,phase:person.x*.6,target:{x:person.x+3,z:person.z-3},timer:0,panic:0};
 nav.timer-=dt;nav.panic=Math.max(0,nav.panic-dt);
 if(threat&&Math.hypot(person.x-threat.x,person.z-threat.z)<14){
  nav.panic=Math.max(nav.panic,4);const dx=person.x-threat.x,dz=person.z-threat.z,l=Math.hypot(dx,dz)||1;
  nav.target={x:THREE.MathUtils.clamp(person.x+dx/l*6,-13,13),z:THREE.MathUtils.clamp(person.z+dz/l*6,-13,13)};nav.timer=4;
 }
 if(person.hitCount)nav.panic=Math.max(nav.panic,1.2);
 if(nav.timer<=0||Math.hypot(nav.target.x-person.x,nav.target.z-person.z)<.6){
  const angle=person.clock*.71+person.x*1.7+person.z*.43;
  nav.target={x:THREE.MathUtils.clamp(person.x+Math.sin(angle)*5,-13,13),z:THREE.MathUtils.clamp(person.z+Math.cos(angle)*5,-13,13)};nav.timer=4+Math.abs(Math.sin(angle))*3;
 }
 let dx=nav.target.x-person.x,dz=nav.target.z-person.z;const distance=Math.hypot(dx,dz)||1;dx/=distance;dz/=distance;
 for(const other of people){if(other===person)continue;const p=other.parts[0].body.translation(),ox=person.x-p.x,oz=person.z-p.z,d=Math.hypot(ox,oz);if(d<1.3){dx+=ox/(d||1)*(1.3-d)*2;dz+=oz/(d||1)*(1.3-d)*2;}}
 if(player){const ox=person.x-player.x,oz=person.z-player.z,d=Math.hypot(ox,oz);if(d<1.3){dx+=ox/(d||1)*2;dz+=oz/(d||1)*2;}}
 for(const object of objects){const p=object.body.translation(),ox=person.x-p.x,oz=person.z-p.z,d=Math.hypot(ox,oz);if(p.y<2&&d<1.8){dx+=ox/(d||1)*(1.8-d)*2;dz+=oz/(d||1)*(1.8-d)*2;}}
 const turn=Math.atan2(Math.sin(Math.atan2(dx,dz)-nav.heading),Math.cos(Math.atan2(dx,dz)-nav.heading));
 const turnLimit=crawl?1.3:2.8;
 nav.turnSpeed=THREE.MathUtils.damp(nav.turnSpeed,THREE.MathUtils.clamp(turn*4,-turnLimit,turnLimit),8,dt);
 nav.heading+=nav.turnSpeed*dt;
 const desiredSpeed=(crawl?.42:nav.panic?2.6:1.25)*(person.hitCount&&!crawl?.7:1)*Math.max(.3,Math.cos(turn));
 nav.speed=THREE.MathUtils.damp(nav.speed,person.blend?desiredSpeed*smooth(person.blend.age/person.blend.duration):desiredSpeed,4,dt);
 person.x=THREE.MathUtils.clamp(person.x+Math.sin(nav.heading)*nav.speed*dt,-13.5,13.5);
 person.z=THREE.MathUtils.clamp(person.z+Math.cos(nav.heading)*nav.speed*dt,-13.5,13.5);
 return nav;
}

function walkingPose(person,nav,dt){
 // Blend stride changes instead of switching immediately from walk to run.
 nav.stride=THREE.MathUtils.damp(nav.stride??.28,nav.panic?.36:.28,4,dt);
 nav.phase+=dt*Math.PI*nav.speed/(2*nav.stride);
 const phase=nav.phase,stride=nav.stride,amount=Math.min(1,nav.speed/1.2);
 const height=.92+Math.cos(phase*2)*.009*amount;
 const locals=new Map();
 locals.set('torso',rotation(.04+Math.sin(phase*2)*.025*amount));
 locals.set('head',rotation(-.035+Math.sin(phase+.4)*.025*amount));
 for(const side of [-1,1]){
  const t=((phase+(side===1?Math.PI:0))%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
  // Smooth swing with a straight stance path; lift and toe-off have zero endpoint slope.
  const swing=t<Math.PI,u=swing?t/Math.PI:(t-Math.PI)/Math.PI;
  const z=(swing?-stride-2*stride*u+4*stride*smooth(u):stride-2*stride*u)*amount;
  const y=.105+(swing?Math.sin(Math.PI*u)**2*.13*amount:0);
  const hip=new THREE.Vector3(0,height-.12,0),ankle=new THREE.Vector3(0,y,z);
  const delta=ankle.clone().sub(hip),length=THREE.MathUtils.clamp(delta.length(),.08,.779),direction=delta.normalize();
  const along=(.405**2-.375**2+length**2)/(2*length),bend=Math.sqrt(Math.max(0,.405**2-along**2));
  const knee=hip.clone().addScaledVector(direction,along).addScaledVector(new THREE.Vector3(0,direction.z,-direction.y),bend);
  const thigh=Math.atan2(-(knee.z-hip.z),-(knee.y-hip.y));
  const shin=Math.atan2(-(ankle.z-knee.z),-(ankle.y-knee.y));
  locals.set(`thigh${side}`,rotation(thigh));locals.set(`shin${side}`,rotation(shin-thigh));locals.set(`foot${side}`,rotation(-shin));
  const injured=person.hitCount>0,guardSide=person.lastHit?.endsWith('-1')?-1:1;
  const arm=injured?-.55-(side===guardSide?.2:0)+Math.sin(phase+side)*.17:z/stride*.4*amount;
  locals.set(`upperArm${side}`,rotation(arm,0,side*.035));
  locals.set(`forearm${side}`,rotation(injured?-.8+Math.sin(phase+.3+side)*.15:-.25-Math.max(0,-z/stride)*.18));
 }
 return {height,root:rotation(0,nav.heading+Math.sin(phase)*.018*amount,Math.cos(phase)*.008*amount),locals};
}

function groundPose(heading,phase=0){
 const locals=new Map([['torso',rotation(-.08)],['head',rotation(-.22)]]);
 for(const side of [-1,1]){
  const reach=Math.sin(phase+(side===1?Math.PI:0));
  locals.set(`upperArm${side}`,rotation(-2.3+reach*.23,0,side*.07));
  locals.set(`forearm${side}`,rotation(-.65-reach*.23));
  locals.set(`thigh${side}`,rotation(-.2-reach*.09));locals.set(`shin${side}`,rotation(.45+reach*.12));locals.set(`foot${side}`,rotation(-.25));
 }
 return {height:.3,root:rotation(1.45,heading),locals};
}
function mixPose(a,b,t){
 const locals=new Map();for(const [name,q] of a.locals)locals.set(name,q.clone().slerp(b.locals.get(name),t));
 return {height:THREE.MathUtils.lerp(a.height,b.height,t),root:a.root.clone().slerp(b.root,t),locals};
}
export function beginGroundRecovery(person,crawl=false){
 resumeWalking(person,crawl?'crawl':'get-up');
 person.recovery=crawl?null:{age:0};person.state=crawl?'crawling':'getting-up';
}

export function stepLocomotion(person,dt,context={}){
 if(!person.nav&&!person.blend)resumeWalking(person);
 const nav=person.nav??={heading:0,turnSpeed:0,speed:0,phase:person.x*.6,target:{x:person.x+3,z:person.z-3},timer:0,panic:0};
 let pose;
 if(person.recovery){
  const recovery=person.recovery;recovery.age+=dt;person.state='getting-up';
  const prone=groundPose(nav.heading),kneel=groundPose(nav.heading);
  kneel.height=.58;kneel.root=rotation(.2,nav.heading);kneel.locals.set('torso',rotation(.25));
  for(const side of [-1,1]){kneel.locals.set(`thigh${side}`,rotation(-.15));kneel.locals.set(`shin${side}`,rotation(1.8));kneel.locals.set(`foot${side}`,rotation(-.7));kneel.locals.set(`upperArm${side}`,rotation(-.8));kneel.locals.set(`forearm${side}`,rotation(-.8));}
  const stand=walkingPose(person,{...nav,speed:0,phase:0,stride:.28},0);
  if(recovery.age<1.15)pose=prone;
  else if(recovery.age<2.1)pose=mixPose(prone,kneel,smooth((recovery.age-1.15)/.95));
  else pose=mixPose(kneel,stand,smooth((recovery.age-2.1)/1.2));
  if(recovery.age>=3.3){person.recovery=null;person.locomotionMode='walk';nav.speed=0;}
 }else{
  const crawl=person.locomotionMode==='crawl';steer(person,dt,context,crawl);
  if(crawl){nav.phase+=dt*2.8;pose=groundPose(nav.heading,nav.phase);person.state='crawling';}
  else{pose=walkingPose(person,nav,dt);person.state=person.hitCount?'limping':nav.panic?'fleeing':'walking';}
 }
 applyPose(person,dt,pose.height,pose.root,pose.locals);
}
