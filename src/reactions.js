import * as THREE from 'three';

const quaternion=new THREE.Quaternion(),target=new THREE.Quaternion(),error=new THREE.Quaternion();
const parentQ=new THREE.Quaternion(),axis=new THREE.Vector3(),euler=new THREE.Euler();

export function registerHit(person,part,localPoint,damage=.18,random=Math.random){
 person.vitality=Math.max(0,person.vitality-damage);if(person.vitality<1e-6)person.vitality=0;
 person.lastHit=part.spec.name;person.hitCount++;person.injuries[part.spec.name]=Math.min(1,(person.injuries[part.spec.name]||0)+damage*2);
 person.state=person.vitality===0?'unresponsive':'reacting';
 person.motionPhase=random()*Math.PI*2;person.reaction={age:0,duration:.65+random()*.4};
 // Several pellets on one limb refresh a wound rather than exhausting the particle budget.
 const old=person.wounds.find(w=>w.part===part&&w.localPoint&&Math.hypot(w.localPoint.x-localPoint.x,w.localPoint.y-localPoint.y,w.localPoint.z-localPoint.z)<.12);
 if(old){old.age=0;old.duration=Math.min(30,old.duration+3);old.severity=Math.min(1,old.severity+.15);}
 else {if(person.wounds.length>=8)person.wounds.shift();person.wounds.push({part,localPoint,age:0,duration:14+random()*12,nextDrip:.06+random()*.15,severity:.5});}
 // Rapier doesn't automatically wake a sleeping joint chain when only motor targets change.
 for(const p of person.parts)p.body.wakeUp();
}

// Soft, torque-limited shoulder/neck muscles: 3D movement rather than side-only hinges.
function ballMuscle(j,angles,strength,dt){
 parentQ.copy(j.parent.body.rotation());quaternion.copy(j.child.body.rotation());
 target.setFromEuler(euler.set(...angles)).premultiply(parentQ);
 error.copy(target).multiply(quaternion.invert());if(error.w<0)error.set(-error.x,-error.y,-error.z,-error.w);
 const magnitude=Math.hypot(error.x,error.y,error.z);if(magnitude<1e-5)return;
 const angle=2*Math.atan2(magnitude,Math.max(.001,error.w));axis.set(error.x,error.y,error.z).multiplyScalar(angle/magnitude);
 const v=j.child.body.angvel(),pv=j.parent.body.angvel();
 const maximum=j.limb==='head'?1.2:6;
 axis.set(axis.x*strength-(v.x-pv.x)*.6,axis.y*strength-(v.y-pv.y)*.6,axis.z*strength-(v.z-pv.z)*.6);
 axis.clampLength(0,maximum).multiplyScalar(dt);
 j.child.body.applyTorqueImpulse(axis,true);j.parent.body.applyTorqueImpulse({x:-axis.x,y:-axis.y,z:-axis.z},true);
}

export function stepReaction(person,dt,held=false){
 if(dt<=0)return;person.clock+=dt;
 if(person.active){
  person.state='idle';const sway=Math.sin(person.clock*.85+person.x)*.012;
  const q={x:0,y:Math.sin(sway/2),z:0,w:Math.cos(sway/2)};
  for(const p of person.parts){const [x,y,z]=p.spec.pos;p.body.setNextKinematicTranslation({x:person.x+x*Math.cos(sway)+z*Math.sin(sway),y,z:person.z-x*Math.sin(sway)+z*Math.cos(sway)});p.body.setNextKinematicRotation(q);}
  return;
 }
 const r=person.reaction;if(r)r.age+=dt;
 const alive=person.vitality>0;
 person.state=held?'held':!alive?'unresponsive':r&&r.age<r.duration?'reacting':'injured';
 const phase=person.clock*2.1+(person.motionPhase??person.x);
 const flinch=alive&&r?Math.exp(-r.age*2.8):0;
 const effort=held||!alive?0:.45+.55*person.vitality;
 if(!effort){
  if(!person.musclesDisabled)for(const j of person.joints)if(j.configureMotorPosition)j.configureMotorPosition(0,0,0);
  person.musclesDisabled=true;if(r&&r.age>r.duration+1)person.reaction=null;return;
 }
 person.musclesDisabled=false;
 const hitSide=person.lastHit?.endsWith('-1')?-1:1;
 for(const j of person.joints){const limb=j.limb,side=limb.endsWith('-1')?-1:1;const impairment=1-.7*(person.injuries[limb]||0);const limbEffort=effort*impairment;
  if(j.ball){
   if(effort){const shoulder=limb.startsWith('upperArm');const guard=side===hitSide?.8:.5;
    const angles=shoulder?[-(.45+guard*.45+Math.sin(phase+side)*.22+flinch*.4),side*.12,side*(.18+Math.sin(phase*.65+side)*.16)]:[-.16+Math.sin(phase*.55)*.13,Math.sin(phase*.4)*.2,Math.cos(phase*.7)*.08];
    ballMuscle(j,angles,limbEffort*(shoulder?10:2.2),dt);
   }
  }else if(j.configureMotorPosition){
   let angle=0;
   if(limb.startsWith('forearm'))angle=-(.65+(side===hitSide?.4:.15)+Math.sin(phase+side*1.8)*.35+flinch*.25);
   else if(limb.startsWith('shin'))angle=.25+(Math.sin(phase*.75+side)+1)*.3+flinch*.25;
   else if(limb.startsWith('thigh'))angle=-.15+(Math.sin(phase*.75+side)+1)*-.13;
   else if(limb==='torso')angle=.14+Math.sin(phase*.55)*.09+flinch*.12;
   j.configureMotorPosition(angle*effort,limbEffort*(limb==='torso'?22:limb.startsWith('forearm')?14:24),limbEffort*2);
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
