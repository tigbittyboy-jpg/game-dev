// Short, joint-limited reactions; all clocks use simulation time so pause freezes them.
export function registerHit(person,part,localPoint,damage=0.18,random=Math.random){
 person.vitality=Math.max(0,person.vitality-damage);if(person.vitality<1e-6)person.vitality=0;
 person.reaction={age:0,duration:1.2+random()*.7,nextTwitch:2+random(),end:6+random()*3};
 if(person.wounds.length>=3)person.wounds.shift();
 person.wounds.push({part,localPoint,age:0,duration:5+random()*5,nextDrip:.12+random()*.18});
}
export function stepReaction(person,dt,held=false,random=Math.random){
 const r=person.reaction;if(!r)return;r.age+=dt;
 const intensity=!held&&r.age<r.duration?Math.sin(Math.PI*r.age/r.duration):0;
 for(const joint of person.joints){if(!joint.configureMotorPosition)continue;
  const limb=joint.limb;
  let angle=limb.startsWith('forearm')?-.9:limb.startsWith('shin')?.45:limb.startsWith('thigh')?-.22:limb.startsWith('upperArm')?(limb.endsWith('-1')?.25:-.25):limb==='head'?-.18:.12;
  joint.configureMotorPosition(angle*intensity,intensity*3,intensity*.9);
 }
 if(!held&&person.vitality>0&&r.age>r.nextTwitch&&r.age<r.end){
  const choices=person.parts.filter(p=>p.spec.name==='head'||p.spec.name.startsWith('forearm'));
  const part=choices[Math.floor(random()*choices.length)];
  // Bounded angular impulse: a small reflex, never a force lifting the whole body.
  part.body.applyTorqueImpulse({x:(random()-.5)*.012*person.vitality,y:0,z:(random()-.5)*.006*person.vitality},true);
  r.nextTwitch=r.age+.7+random()*1.1;
 }
 if(r.age>=r.end)person.reaction=null;
}
export function stepWounds(person,dt,emit,random=Math.random){
 if(dt<=0)return;
 for(let i=person.wounds.length-1;i>=0;i--){const wound=person.wounds[i];wound.age+=dt;if(wound.age>=wound.duration){person.wounds.splice(i,1);continue;}if(wound.age>=wound.nextDrip){emit(wound);wound.nextDrip=wound.age+.18+random()*.6;}}
}
