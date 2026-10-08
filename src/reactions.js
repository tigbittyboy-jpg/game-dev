import * as THREE from 'three';
import {activateRagdoll} from './ragdoll.js';
import {stepLocomotion,resumeWalking,beginGroundRecovery} from './locomotion.js';

const quaternion=new THREE.Quaternion(),target=new THREE.Quaternion(),error=new THREE.Quaternion();
const parentQ=new THREE.Quaternion(),axis=new THREE.Vector3(),euler=new THREE.Euler();

export function registerHit(person,part,localPoint,damage=.18,random=Math.random){
 person.vitality=Math.max(0,person.vitality-damage);if(person.vitality<1e-6)person.vitality=0;
 person.lastHit=part.spec.name;person.hitCount++;person.injuries[part.spec.name]=Math.min(1,(person.injuries[part.spec.name]||0)+damage*2);
 person.state=person.vitality===0?'unresponsive':'reacting';person.groundedTime=0;
 person.motionPhase=random()*Math.PI*2;person.reaction={age:0,duration:.65+random()*.4};
 // Several pellets on one limb refresh a wound rather than exhausting the particle budget.
 const old=person.wounds.find(w=>w.part===part&&w.localPoint&&Math.hypot(w.localPoint.x-localPoint.x,w.localPoint.y-localPoint.y,w.localPoint.z-localPoint.z)<.12);
 if(old){old.age=0;old.duration=Math.min(30,old.duration+3);old.severity=Math.min(1,old.severity+.15);}
 else {if(person.wounds.length>=8)person.wounds.shift();person.wounds.push({part,localPoint,age:0,duration:14+random()*12,nextDrip:.06+random()*.15,severity:.5});}
 // Rapier doesn't automatically wake a sleeping joint chain when only motor targets change.
 for(const p of person.parts)p.body.wakeUp();
}

// Soft, torque-limited shoulder muscles.
function ballMuscle(j,angles,strength,dt,attack=1){
 parentQ.copy(j.parent.body.rotation());quaternion.copy(j.child.body.rotation());
 target.setFromEuler(euler.set(...angles));if(j.restRotation)target.slerp(j.restRotation,1-attack);target.premultiply(parentQ);
 error.copy(target).multiply(quaternion.invert());if(error.w<0)error.set(-error.x,-error.y,-error.z,-error.w);
 const magnitude=Math.hypot(error.x,error.y,error.z);if(magnitude<1e-5)return;
 const angle=2*Math.atan2(magnitude,Math.max(.001,error.w));axis.set(error.x,error.y,error.z).multiplyScalar(angle/magnitude);
 const v=j.child.body.angvel(),pv=j.parent.body.angvel();
 const maximum=j.limb==='head'?.4:3;
 axis.set(axis.x*strength-(v.x-pv.x)*.16,axis.y*strength-(v.y-pv.y)*.16,axis.z*strength-(v.z-pv.z)*.16);
 axis.clampLength(0,maximum).multiplyScalar(dt);
 j.child.body.applyTorqueImpulse(axis,true);j.parent.body.applyTorqueImpulse({x:-axis.x,y:-axis.y,z:-axis.z},true);
}

export function stepReaction(person,dt,held=false,context={}){
 if(dt<=0)return;person.clock+=dt;
 if(context.threat)person.lastThreat={x:context.threat.x,z:context.threat.z,at:person.clock};
 if(person.active&&person.vitality<=0)activateRagdoll(person);
 if(person.active){stepLocomotion(person,dt,context);return;}
 const r=person.reaction;if(r)r.age+=dt;
 const alive=person.vitality>0;
 person.state=held?'held':!alive?'unresponsive':r&&r.age<r.duration?'reacting':'injured';
 const phase=person.clock*5.2+(person.motionPhase??person.x);
 const flinch=alive&&r?Math.exp(-r.age*5):0;
 const pelvis=person.parts.find(p=>p.spec.name==='pelvis'),pos=pelvis.body.translation();
 const feet=person.parts.filter(p=>p.spec.name.startsWith('foot'));
 const legDamage=Math.max(...person.parts.filter(p=>p.spec.name.startsWith('shin')||p.spec.name.startsWith('thigh')).map(p=>person.injuries[p.spec.name]||0));
 const footGrounded=feet.some(p=>{const q=new THREE.Quaternion().copy(p.body.rotation());let extent=0;for(let i=0;i<3;i++)extent+=Math.abs(new THREE.Vector3().setComponent(i,1).applyQuaternion(q).y)*p.spec.dims[i]/2;return p.body.translation().y-extent<.025;});
 const standing=!held&&alive&&person.vitality>.55&&legDamage<.35&&pos.y>.65&&footGrounded;
 if(standing){
  person.balanceApplied=true;
  const upper=person.torso.body.translation(),velocity=pelvis.body.linvel(),q=pelvis.body.rotation(),angular=pelvis.body.angvel();
  const centre=feet.reduce((s,p)=>{const f=p.body.translation();return {x:s.x+f.x/2,z:s.z+f.z/2};},{x:0,z:0});
  // Preserve the stance height and soften support during the flinch, rather than
  // snapping every leg straight and lifting the pelvis to an arbitrary height.
  const support=r?1-Math.exp(-r.age*4):1;
  const gravity=Math.max(0,-(context.gravity??-9.8));
  // Feet and legs already bear their own weight through floor contact.
  const mass=person.parts.filter(p=>!p.spec.name.startsWith('thigh')&&!p.spec.name.startsWith('shin')&&!p.spec.name.startsWith('foot')).reduce((sum,p)=>sum+p.spec.mass,0),height=THREE.MathUtils.clamp(person.stanceHeight??.92,.82,1);
  pelvis.body.resetForces(false);pelvis.body.resetTorques(false);
  pelvis.body.addForce({x:THREE.MathUtils.clamp((centre.x-(pos.x*.3+upper.x*.7))*65-velocity.x*15,-45,45)*support,y:THREE.MathUtils.clamp(mass*gravity+(height-pos.y)*85-velocity.y*18,0,mass*gravity*1.15)*support,z:THREE.MathUtils.clamp((centre.z-(pos.z*.3+upper.z*.7))*65-velocity.z*15,-45,45)*support},true);
  pelvis.body.addTorque({x:THREE.MathUtils.clamp(-q.x*55-angular.x*6,-14,14)*support,y:-angular.y*.5,z:THREE.MathUtils.clamp(-q.z*55-angular.z*6,-14,14)*support},true);
 }else if(person.balanceApplied){pelvis.body.resetForces(false);pelvis.body.resetTorques(false);person.balanceApplied=false;}
 if(standing&&r&&r.age>1.5){resumeWalking(person);stepLocomotion(person,dt,context);return;}
 // Only recover after settling on the floor: never while held, airborne, or dead.
 const torsoPos=person.torso.body.translation(),torsoSpeed=person.torso.body.linvel();
 const grounded=!held&&alive&&pos.y<.6&&torsoPos.y<.7&&person.parts.some(p=>p.body.translation().y<.25)&&Math.hypot(torsoSpeed.x,torsoSpeed.y,torsoSpeed.z)<1.6;
 person.groundedTime=grounded?(person.groundedTime??0)+dt:0;
 if(person.groundedTime>.7&&(!r||r.age>1.15)){
  beginGroundRecovery(person,legDamage>=.15||person.vitality<=.35);stepLocomotion(person,dt,context);return;
 }
 person.standing=standing;
 if(standing)person.state=r&&r.age<r.duration?'staggering':'guarding';
 const attack=r?1-Math.exp(-r.age*3):1;
 const effort=held||!alive?0:(.45+.55*person.vitality)*(.12+.88*attack);
 if(!effort){
  if(!alive&&!person.passiveDamping){for(const p of person.parts){p.body.setAngularDamping(2.5);p.body.setLinearDamping(.25);}person.passiveDamping=true;}
  if(!person.musclesDisabled)for(const j of person.joints)if(j.configureMotorPosition)j.configureMotorPosition(0,0,0);
  person.musclesDisabled=true;if(r&&r.age>r.duration+1)person.reaction=null;return;
 }
 person.musclesDisabled=false;
 const hitSide=person.lastHit?.endsWith('-1')?-1:1;
 for(const j of person.joints){const limb=j.limb,side=limb.endsWith('-1')?-1:1;const impairment=1-.7*(person.injuries[limb]||0);const limbEffort=effort*impairment;
  if(j.ball){
   if(effort){const shoulder=limb.startsWith('upperArm');const guard=side===hitSide?.8:.5;
    const angles=shoulder?[-(.45+guard*.45+Math.sin(phase+side)*.38+flinch*.4),side*.12,side*(.18+Math.sin(phase*.65+side)*.16)]:[-.16+Math.sin(phase*.55)*.13,Math.sin(phase*.4)*.2,Math.cos(phase*.7)*.08];
    ballMuscle(j,angles,limbEffort*(shoulder?3.5:.7),dt,attack);
   }
  }else if(j.configureMotorPosition){
   let angle=0;
   if(limb.startsWith('forearm'))angle=-(.65+(side===hitSide?.4:.15)+Math.sin(phase+side*1.8)*.55+flinch*.25);
   else if(limb.startsWith('shin'))angle=.25+(Math.sin(phase*.75+side)+1)*.3+flinch*.25;
   else if(limb.startsWith('thigh'))angle=-.15+(Math.sin(phase*.75+side)+1)*-.13;
   else if(limb==='torso')angle=standing?.04+flinch*.12:.2+Math.sin(phase*.55)*.12+flinch*.15;
   else if(limb==='head')angle=-.08+Math.sin(phase*.65)*.12;
   if(standing&&limb.startsWith('thigh'))angle=j.restAngle??-.15;
   if(standing&&limb.startsWith('shin'))angle=(j.restAngle??.25)+flinch*.015;
   if(limb.startsWith('foot'))angle=standing?(j.restAngle??0):-.15;
   const leg=limb.startsWith('thigh')||limb.startsWith('shin');
   if(!leg&&r&&j.restAngle!==undefined)angle=THREE.MathUtils.lerp(j.restAngle,angle,attack);
   j.configureMotorPosition(angle*(standing&&leg?1:effort),limbEffort*(standing&&leg?30:limb==='head'?8:limb==='torso'?(standing?22:10):limb.startsWith('forearm')?5:9),limbEffort*(standing&&leg?3:limb==='head'?.7:standing&&limb==='torso'?2:.65));
  }
 }
 if(effort)for(const p of person.parts)p.body.wakeUp();
 // Survivors stay responsive; an unresponsive body keeps physics, but loses voluntary motion.
 if(r&&r.age>r.duration+1)person.reaction=null;
}
export function stepWounds(person,dt,emit,random=Math.random){
 if(dt<=0)return;
 for(let i=person.wounds.length-1;i>=0;i--){const wound=person.wounds[i];wound.age+=dt;person.vitality=Math.max(0,person.vitality-dt*.0008*wound.severity);if(wound.age>=wound.duration){person.wounds.splice(i,1);continue;}
  if(wound.age>=wound.nextDrip){emit(wound);const fade=1-wound.age/wound.duration;wound.nextDrip=wound.age+.18+random()*.65+(1-fade)*.7;}
 }
}
