import {test,expect} from '@playwright/test';

// Inspect the real dev runtime without shipping a test API in the game.
async function open(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/combat.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('return {step,update,reset:', 'return {people,effects,stains,player,magazines,step,update,reset:')});});
 await page.route('**/src/main.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.testCombat=combat;window.testCamera=camera;'});});
 page.setDefaultTimeout(15000);await page.goto('/');await page.waitForFunction(()=>!!window.testCombat);await page.click('#fps');await page.waitForFunction(()=>!!document.pointerLockElement);await page.waitForTimeout(500);return errors;
}
async function aim(page,person=2,part='torso',fire=false){
 await page.evaluate(({person,part,fire})=>{const pos=testCombat.people[person].parts.find(p=>p.spec.name===part).mesh.position,c=testCamera,dx=pos.x-c.position.x,dy=pos.y-c.position.y,dz=pos.z-c.position.z;
 document.dispatchEvent(new MouseEvent('mousemove',{movementX:(c.rotation.y-Math.atan2(-dx,-dz))/.0018,movementY:(c.rotation.x-Math.atan2(dy,Math.hypot(dx,dz)))/.0018}));if(fire){const canvas=document.querySelector('canvas');canvas.dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true}));canvas.dispatchEvent(new PointerEvent('pointerup',{button:0,bubbles:true}));}
 },{person,part,fire});
}
async function approach(page,person,distance=7){
 for(let i=0;i<30;i++){
  const d=await page.evaluate(person=>{const p=testCombat.people[person].torso.mesh.position,c=testCamera.position;return Math.hypot(p.x-c.x,p.z-c.z);},person);
  if(d<distance)return;
  await aim(page,person);await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');await page.waitForTimeout(150);await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');
 }
 throw new Error('Could not approach moving subject');
}
async function release(page){await page.evaluate(()=>document.exitPointerLock());await page.waitForFunction(()=>!document.pointerLockElement);}

test('first shot, ongoing visible reaction, second shot, bleeding, and pause',async({page})=>{
 const errors=await open(page);await approach(page,2,5);await aim(page,2,'torso',true);expect(await page.evaluate(()=>testCombat.people.map(p=>p.hitCount))).toEqual([0,0,1,0]);
 await page.waitForTimeout(5000);expect(await page.evaluate(()=>testCombat.people[2].torso.body.translation().y)).toBeGreaterThan(1.1);await page.screenshot({path:test.info().outputPath('guarding.png')});const positions=[];for(let i=0;i<7;i++){positions.push(await page.evaluate(()=>testCombat.people[2].parts.find(p=>p.spec.name==='forearm1').body.translation()));await page.waitForTimeout(250);}
 const movement=Math.max(...positions.map(p=>Math.hypot(p.x-positions[0].x,p.y-positions[0].y,p.z-positions[0].z)));expect(movement).toBeGreaterThan(.04);
 await approach(page,2);await aim(page,2,'torso',true);await page.waitForFunction(()=>testCombat.people[2].hitCount===2);expect(['reacting','staggering','guarding','limping']).toContain(await page.evaluate(()=>testCombat.people[2].state));
 await page.waitForFunction(()=>testCombat.stains.length>0);await page.keyboard.press('KeyP');const clock=await page.evaluate(()=>testCombat.people[2].clock);await page.waitForTimeout(400);expect(await page.evaluate(()=>testCombat.people[2].clock)).toBe(clock);await page.keyboard.press('KeyP');
 await release(page);await page.uncheck('#blood');expect(await page.evaluate(()=>testCombat.effects.length)).toBe(0);await page.click('#help');await page.click('#reset-fps');expect(await page.evaluate(()=>testCombat.people.every(p=>p.hitCount===0&&p.wounds.length===0))).toBe(true);expect(errors).toEqual([]);
});

test('aiming, reload, jump, grab distance, throw, and orbit exit',async({page})=>{
 const errors=await open(page);await page.mouse.down({button:'right'});await page.waitForTimeout(400);expect(await page.evaluate(()=>testCamera.fov)).toBeLessThan(60);await page.mouse.up({button:'right'});await page.waitForTimeout(300);
 await aim(page,2,'torso',true);await page.keyboard.press('KeyR');await expect(page.locator('#ammo')).toHaveText('12 / 12');
 const ground=await page.evaluate(()=>testCombat.player.translation().y);await page.keyboard.press('Space');await page.waitForTimeout(220);expect(await page.evaluate(()=>testCombat.player.translation().y)).toBeGreaterThan(ground+.3);await page.waitForTimeout(1200);
 await page.keyboard.press('Digit3');await approach(page,2);await aim(page,2,'torso',true);await expect(page.locator('#ammo')).toContainText('HOLDING');await page.mouse.wheel(0,-150);await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});await expect(page.locator('#ammo')).toHaveText('Click to grab');
 await release(page);await page.click('#help');await page.click('#exit-fps');expect(await page.evaluate(()=>document.body.classList.contains('first-person'))).toBe(false);expect(errors).toEqual([]);
});

test('shotgun and close-range baton register impacts; incapacitated bodies stay physical',async({page})=>{
 const errors=await open(page);await page.keyboard.press('Digit2');await aim(page,2,'torso',true);await page.waitForFunction(()=>testCombat.people[2].hitCount>0);await expect(page.locator('#ammo')).toHaveText('5 / 6');
 await page.keyboard.press('KeyX');await page.keyboard.press('KeyE');await page.waitForFunction(()=>testCombat.people.length===5);await page.keyboard.press('Digit4');await approach(page,4,2.1);await aim(page,4,'torso',true);await page.waitForFunction(()=>testCombat.people[4].hitCount>0);
 await page.keyboard.press('Digit1');for(let i=0;i<12;i++){if(await page.evaluate(()=>testCombat.people[4].vitality===0))break;await approach(page,4);await aim(page,4,'torso',true);await page.waitForTimeout(400);}
 await page.waitForFunction(()=>testCombat.people[4].state==='unresponsive');await page.keyboard.press('Digit3');await approach(page,4);await aim(page,4,'torso',true);await expect(page.locator('#ammo')).toContainText('HOLDING');expect(errors).toEqual([]);
});

test('starting subjects walk and lift their feet before any interaction',async({page})=>{
 const errors=await open(page);const samples=[];for(let i=0;i<10;i++){samples.push(await page.evaluate(()=>({position:{...testCombat.people[2].torso.body.translation()},clock:testCombat.people[2].clock})));await page.waitForTimeout(250);}
 const travelled=samples.slice(1).reduce((distance,s,i)=>distance+Math.hypot(s.position.x-samples[i].position.x,s.position.z-samples[i].position.z),0);
 expect(travelled).toBeGreaterThan(.5*(samples.at(-1).clock-samples[0].clock));
 const heights=[];for(let i=0;i<10;i++){heights.push(await page.evaluate(()=>testCombat.people[2].parts.find(p=>p.spec.name==='foot1').body.translation().y));await page.waitForTimeout(100);}
 expect(Math.max(...heights)-Math.min(...heights)).toBeGreaterThan(.06);await page.screenshot({path:test.info().outputPath('walking.png')});expect(errors).toEqual([]);
});

async function knockDown(page,person){
 await page.keyboard.press('Digit3');await approach(page,person,6);await aim(page,person,'torso',true);await expect(page.locator('#ammo')).toContainText('HOLDING');
 await page.evaluate(()=>document.dispatchEvent(new MouseEvent('mousemove',{movementY:(1.25-testCamera.rotation.x)/.0018})));
 await page.mouse.wheel(0,-900);await page.waitForTimeout(2200);
 await page.evaluate(()=>document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown',{button:0,bubbles:true})));
 await expect(page.locator('#ammo')).toHaveText('Click to grab');
}
test('released fallen survivors get up; leg-injured survivors crawl and can be grabbed again',async({page})=>{
 const errors=await open(page);await page.keyboard.press('KeyE');await page.waitForFunction(()=>testCombat.people.length===5);await knockDown(page,4);
 await page.waitForFunction(()=>testCombat.people[4].state==='getting-up');await aim(page,4);await page.screenshot({path:test.info().outputPath('getting-up.png')});
 await page.waitForFunction(()=>['walking','limping','fleeing'].includes(testCombat.people[4].state));expect(await page.evaluate(()=>testCombat.people[4].torso.body.translation().y)).toBeGreaterThan(1.1);
 await page.keyboard.press('KeyX');await page.keyboard.press('KeyE');await page.keyboard.press('Digit1');await approach(page,4,5);await aim(page,4,'thigh1',true);await page.waitForFunction(()=>Math.max(testCombat.people[4].injuries.thigh1??0,testCombat.people[4].injuries['thigh-1']??0)>.15);
 await knockDown(page,4);await page.waitForFunction(()=>testCombat.people[4].state==='crawling');await page.waitForTimeout(1300);
 const start=await page.evaluate(()=>({...testCombat.people[4].torso.body.translation()}));await page.waitForTimeout(2500);const end=await page.evaluate(()=>({...testCombat.people[4].torso.body.translation()}));expect(Math.hypot(end.x-start.x,end.z-start.z)).toBeGreaterThan(.3);expect(end.y).toBeLessThan(.7);
 await aim(page,4);await page.screenshot({path:test.info().outputPath('crawling.png')});await aim(page,4,'torso',true);await expect(page.locator('#ammo')).toContainText('HOLDING');expect(await page.evaluate(()=>testCombat.people[4].active)).toBe(false);expect(errors).toEqual([]);
});
