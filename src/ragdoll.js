import RAPIER from '@dimforge/rapier3d-compat';

// Metres and kilograms. Adjacent capsules meet at their anatomical joint anchors.
export const anatomy = [
 {name:'pelvis',pos:[0,1,0],radius:.17,length:.14,mass:12,color:'pants'},
 {name:'torso',pos:[0,1.37,0],radius:.22,length:.22,mass:25,color:'shirt'},
 {name:'head',pos:[0,1.88,0],radius:.16,length:.05,mass:5,color:'skin'},
 ...[-1,1].flatMap(side=>[
  {name:`upperArm${side}`,pos:[side*.35,1.39,0],radius:.085,length:.2,mass:2.5,color:'shirt'},
  {name:`forearm${side}`,pos:[side*.35,1.04,.02],radius:.075,length:.2,mass:1.5,color:'skin'},
  {name:`thigh${side}`,pos:[side*.14,.68,0],radius:.105,length:.25,mass:7,color:'pants'},
  {name:`shin${side}`,pos:[side*.14,.27,0],radius:.085,length:.29,mass:3.5,color:'pants'},
  {name:`foot${side}`,pos:[side*.14,.065,.06],dims:[.18,.12,.32],mass:1.5,color:'boots'},
 ])
];
export function createRagdoll(world,x,z,slot=0){
 const membership=1<<(slot+1),groups=((membership<<16)|(0xffff^membership))>>>0;
 const person={parts:[],joints:[],active:true,x,z};
 for(const spec of anatomy){const [px,py,pz]=spec.pos;
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x+px,py,z+pz).setLinearDamping(.12).setAngularDamping(.65).setAdditionalSolverIterations(4).setCcdEnabled(true));
  const collider=spec.dims?RAPIER.ColliderDesc.cuboid(...spec.dims.map(v=>v/2)):RAPIER.ColliderDesc.capsule(spec.length/2,spec.radius);
  world.createCollider(collider.setMass(spec.mass).setFriction(.75).setRestitution(0).setCollisionGroups(groups),body);
  person.parts.push({body,spec,person});
 }
 const find=name=>person.parts.find(p=>p.spec.name===name);
 function joint(aName,bName,anchor,axis,limits){const a=find(aName).body,b=find(bName).body,ap=a.translation(),bp=b.translation();const point={x:x+anchor[0],y:anchor[1],z:z+anchor[2]};const a1={x:point.x-ap.x,y:point.y-ap.y,z:point.z-ap.z},a2={x:point.x-bp.x,y:point.y-bp.y,z:point.z-bp.z};
  const desc=axis?RAPIER.JointData.revolute(a1,a2,axis):RAPIER.JointData.fixed(a1,{x:0,y:0,z:0,w:1},a2,{x:0,y:0,z:0,w:1});
  const j=world.createImpulseJoint(desc,a,b,true);j.setContactsEnabled(false);if(limits)j.setLimits(...limits);person.joints.push(j);
 }
 const ax={x:1,y:0,z:0},az={x:0,y:0,z:1};
 joint('pelvis','torso',[0,1.15,0],ax,[-.4,.5]);joint('torso','head',[0,1.7,0],ax,[-.45,.45]);
 for(const side of [-1,1]){joint('torso',`upperArm${side}`,[side*.35,1.57,0],az,[-1.6,1.6]);joint(`upperArm${side}`,`forearm${side}`,[side*.35,1.215,.01],ax,[-2.2,.08]);joint('pelvis',`thigh${side}`,[side*.14,.88,0],ax,[-1.3,.5]);joint(`thigh${side}`,`shin${side}`,[side*.14,.475,0],ax,[-.05,2.2]);joint(`shin${side}`,`foot${side}`,[side*.14,.1,0]);}
 person.torso=find('torso');
 return person;
}
export function activateRagdoll(person){if(!person.active)return;person.active=false;for(const p of person.parts){p.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);p.body.recomputeMassPropertiesFromColliders();p.body.setLinvel({x:0,y:0,z:0},true);p.body.setAngvel({x:0,y:0,z:0},true);}}
