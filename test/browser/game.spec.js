import {test,expect} from '@playwright/test';

// Inspect the real dev runtime without shipping a test API in the game.
async function open(page){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/combat.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('return {step,update,reset:', 'return {people,effects,stains,player,magazines,step,update,reset:')});});
 await page.route('**/src/main.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nwindow.testCombat=combat;window.testCamera=camera;'});});
 await page.goto('/');await page.waitForFunction(()=>!!window.testCombat);await page.click('#fps');await page.waitForFunction(()=>!!document.pointerLockElement);await page.waitForTimeout(500);return errors;
}
async function aim(page,person=2,part='torso'){
 await page.evaluate(({person,part})=>{const pos=testCombat.people[person].parts.find(p=>p.spec.name===part).body.translation(),c=testCamera,dx=pos.x-c.position.x,dy=pos.y-c.position.y,dz=pos.z-c.position.z;
 document.dispatchEvent(new MouseEvent('mousemove',{movementX:(c.rotation.y-Math.atan2(-dx,-dz))/.0018,movementY:(c.rotation.x-Math.atan2(dy,Math.hypot(dx,dz)))/.0018}));},{person,part});await page.waitForTimeout(100);
}
async function release(page){await page.evaluate(()=>document.exitPointerLock());await page.waitForFunction(()=>!document.pointerLockElement);}

test('first shot, ongoing visible reaction, second shot, bleeding, and pause',async({page})=>{
 const errors=await open(page);await aim(page);await page.mouse.click(720,450);await page.waitForFunction(()=>testCombat.people[2].hitCount===1);
 await page.waitForTimeout(5000);const positions=[];for(let i=0;i<7;i++){positions.push(await page.evaluate(()=>testCombat.people[2].parts.find(p=>p.spec.name==='forearm1').body.translation()));await page.waitForTimeout(250);}
 const movement=Math.max(...positions.map(p=>Math.hypot(p.x-positions[0].x,p.y-positions[0].y,p.z-positions[0].z)));expect(movement).toBeGreaterThan(.04);
 await aim(page);await page.mouse.click(720,450);await page.waitForFunction(()=>testCombat.people[2].hitCount===2);expect(await page.evaluate(()=>testCombat.people[2].state)).toBe('reacting');
 await page.waitForFunction(()=>testCombat.stains.length>0);await page.keyboard.press('KeyP');const clock=await page.evaluate(()=>testCombat.people[2].clock);await page.waitForTimeout(400);expect(await page.evaluate(()=>testCombat.people[2].clock)).toBe(clock);await page.keyboard.press('KeyP');
 await release(page);await page.uncheck('#blood');expect(await page.evaluate(()=>testCombat.effects.length)).toBe(0);await page.click('#help');await page.click('#reset-fps');expect(await page.evaluate(()=>testCombat.people.every(p=>p.hitCount===0&&p.wounds.length===0))).toBe(true);expect(errors).toEqual([]);
});

test('aiming, reload, jump, grab distance, throw, and orbit exit',async({page})=>{
 const errors=await open(page);await page.mouse.down({button:'right'});await page.waitForTimeout(400);expect(await page.evaluate(()=>testCamera.fov)).toBeLessThan(60);await page.mouse.up({button:'right'});await page.waitForTimeout(300);
 await aim(page);await page.mouse.click(720,450);await page.keyboard.press('KeyR');await expect(page.locator('#ammo')).toHaveText('12 / 12');
 const ground=await page.evaluate(()=>testCombat.player.translation().y);await page.keyboard.press('Space');await page.waitForTimeout(220);expect(await page.evaluate(()=>testCombat.player.translation().y)).toBeGreaterThan(ground+.3);await page.waitForTimeout(1200);
 await page.keyboard.press('Digit3');await aim(page);await page.mouse.click(720,450);await expect(page.locator('#ammo')).toContainText('HOLDING');await page.mouse.wheel(0,-150);await page.mouse.click(720,450,{button:'right'});await expect(page.locator('#ammo')).toHaveText('Click to grab');
 await release(page);await page.click('#help');await page.click('#exit-fps');expect(await page.evaluate(()=>document.body.classList.contains('first-person'))).toBe(false);expect(errors).toEqual([]);
});

test('shotgun and close-range baton register impacts; incapacitated bodies stay physical',async({page})=>{
 const errors=await open(page);await page.keyboard.press('Digit2');await aim(page);await page.mouse.click(720,450);await page.waitForFunction(()=>testCombat.people[2].hitCount>0);await expect(page.locator('#ammo')).toHaveText('5 / 6');
 await page.keyboard.press('KeyX');await page.keyboard.press('KeyE');await page.waitForFunction(()=>testCombat.people.length===5);await page.keyboard.press('Digit4');await page.keyboard.down('KeyW');await page.waitForTimeout(650);await page.keyboard.up('KeyW');await aim(page,4);await page.mouse.click(720,450);await page.waitForFunction(()=>testCombat.people[4].hitCount>0);
 await page.keyboard.press('Digit1');for(let i=0;i<9;i++){if(await page.evaluate(()=>testCombat.people[4].vitality===0))break;await aim(page,4);await page.mouse.click(720,450);await page.waitForTimeout(400);}
 await page.waitForFunction(()=>testCombat.people[4].state==='unresponsive');await page.keyboard.press('Digit3');await aim(page,4);await page.mouse.click(720,450);await expect(page.locator('#ammo')).toContainText('HOLDING');expect(errors).toEqual([]);
});
