
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const env = fs.readFileSync('.env', 'utf8');
const api = new URL(env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/m)[1].trim());
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const userId = '11111111-1111-4111-8111-111111111111';
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'test@example.com' };
const char = { id: 'char-1', user_id: userId, name: 'Veigas Di Cadmus', title: 'Guardião das últimas fronteiras do Firmamento', level: 10, xp_progress: 40, portrait_url: null, credits: 1234567, cifras: 42, hp_current: 1000, ep_current: 500, attack: 4, resistance: 3, agility: 2, intellect: 3, charisma: 2, classes: {name:'Sentinela'}, elements:{name:'Élix'}, status:'active' };
const enemy = { id:'enemy-1', name:'Sentinela Corrompida', portrait_url:null, tier:'comum', level:30, attack:4, resistance:3, intellect:3, agility:2, charisma:1 };
const ability = { ability_id:'ability-1', level:1, abilities:{name:'Pulso de teste', description:'Habilidade de teste.', type:'comum', tipo_efeito:'dano'} };
const state = { battle:null, participants:[], instances:[], failInsert:false, role:'mestre' };
let lastActor;
const screenshotDir = path.resolve('beta-check.local');
fs.mkdirSync(screenshotDir, {recursive:true});
async function main(){
 const browser = await chromium.launch({headless:true});
 try {
 const context = await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(({key,user})=>{
   const exp = Math.floor(Date.now()/1000)+3600;
   const token = btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp,role:'authenticated'}))+'.test';
   localStorage.setItem(key,JSON.stringify({access_token:token,refresh_token:'test',expires_at:exp,expires_in:3600,token_type:'bearer',user}));
 },{key:'sb-'+api.hostname.split('.')[0]+'-auth-token',user});
 await context.routeWebSocket('**/realtime/**', socket=>socket.close());
 await context.route(api.origin+'/**', async route=>{
   const req=route.request(), url=new URL(req.url()), table=url.pathname.split('/').pop(), method=req.method();
   let result=[], status=200;
   const body=method==='GET'||method==='DELETE'?null:req.postDataJSON();
   if(url.pathname.includes('/auth/')) result=user;
   else if(table==='profiles') result=[{id:userId,username:char.name,role:state.role}];
   else if(table==='characters') {
     if(method==='PATCH')Object.assign(char,body);
     result=[char];
   } else if(table==='enemies') result=[enemy];
   else if(table==='character_abilities'||table==='enemy_abilities')result=[ability];
   else if(table==='character_skills_passive')result=[{skill_id:'skill-1',skills_passive:{name:'Percepção ampliada',description:'Descrição suficientemente longa para validar a leitura em telas pequenas.'}}];
   else if(table==='character_equipment')result=[{id:'item-1',item_id:'i-1',slot:'bolsa',items:{name:'Dispositivo de navegação interplanetária',category:'raro'}}];
   else if(table==='battle_sessions') {
     if(method==='POST')state.battle={id:'battle-1',round_number:1,current_turn_index:0,...body};
     if(method==='PATCH')Object.assign(state.battle,body);
     if(method==='DELETE'){state.battle=null;state.participants=[]}
     result=state.battle && (!url.searchParams.has('status')||url.searchParams.get('status')==='eq.'+state.battle.status)?[state.battle]:[];
   } else if(table==='enemy_instances'){
     if(method==='POST') {
       if(state.failInsert && state.instances.length===1){status=500;result={message:'simulated failure'};}
       else state.instances.push({...body,status:'active',enemies:enemy});
     }
     if(method==='PATCH') Object.assign(state.instances.find(i=>'eq.'+i.id===url.searchParams.get('id')),body);
     if(method==='DELETE')state.instances=[];
     if(status===200)result=state.instances;
   } else if(table==='battle_participants'){
     if(method==='POST')state.participants=body.map((p,i)=>({...p,id:'p-'+i}));
     result=state.participants;
   } else if(table==='combat_use_ability'){
     // Simula o servidor (fase 3): o cliente só envia intenção; valor e custo vêm daqui.
     const target=state.participants.find(p=>p.id===body.p_target_participant_id);
     lastActor=state.participants.find(p=>p.id===body.p_actor_participant_id);
     state.calls=(state.calls||[]).concat(body);
     const entity=target.character_id?char:state.instances.find(i=>i.id===target.enemy_instance_id);
     const actorEntity=lastActor.character_id?char:state.instances.find(i=>i.id===lastActor.enemy_instance_id);
     entity.hp_current=Math.max(0,entity.hp_current-10);
     actorEntity.ep_current-=5;
     result={action_id:body.p_action_id,actor:lastActor.id,actor_name:lastActor.name,ability_name:ability.abilities.name,cost:5,critico:false,ponto_vital:false,execution:null,
       effects:[{kind:'dano',target:target.id,target_name:target.name,raw:20,mitigation:10,absorbed:0,hp_loss:10,hp_max:2000}]};
     state.actions=[{id:body.p_action_id,kind:'ability',round_number:1,created_at:new Date().toISOString(),result},...(state.actions||[])];
   } else if(table==='battle_actions') result=state.actions||[];
   else if(table==='battle_effects') result=[];
   if(status===200 && req.headers().accept?.includes('vnd.pgrst.object') && Array.isArray(result))result=result[0]??null;
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
 });
 const page=await context.newPage(), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 async function fit(label) {
   const dimensions=await page.evaluate(()=>({width:innerWidth,body:document.documentElement.scrollWidth}));
   if(dimensions.body>dimensions.width+1){ await page.screenshot({path:path.join(screenshotDir,'overflow.png'),fullPage:true}); console.log(await page.locator('body *').evaluateAll(els=>els.filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,classes:e.className,text:e.textContent?.slice(0,60),right:e.getBoundingClientRect().right})).slice(0,20))); }
   assert.ok(dimensions.body<=dimensions.width+1,label+': horizontal overflow '+JSON.stringify(dimensions));
 }
 for (const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:844});
   await page.goto(base+'/player/ficha');
   await page.locator('h1').filter({hasText:char.name}).waitFor();
   await page.waitForTimeout(1400);
   assert.equal(await page.evaluate(()=>scrollY),0);
   assert.ok(await page.locator('.character-sheet .reveal').evaluateAll(els=>els.every(e=>getComputedStyle(e).opacity==='1')),'All sheet sections revealed without scrolling');
   await fit('sheet '+width);
   if(width===390)await page.screenshot({path:path.join(screenshotDir,'ficha-mobile.png'),fullPage:true});
   for(const tab of ['Habilidades','Dados','Perícias','Equipamento','Status']){
     await page.getByRole('button',{name:tab,exact:true}).click();
     await fit(tab+' '+width);
   }
   const small=await page.locator('.character-sheet button').evaluateAll(els=>els.filter(e=>e.getClientRects().length).filter(e=>e.getBoundingClientRect().width<43.9||e.getBoundingClientRect().height<43.9).map(e=>e.textContent||e.ariaLabel));
   assert.deepEqual(small,[],'Touch targets '+width);
 }
 // Long names and reduced motion are separate layout cases.
 char.name='VeigasDiCadmusNomeMuitoLongoSemEspacosParaValidarQuebra';
 await page.setViewportSize({width:320,height:740});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto(base+'/player/ficha');
 await page.locator('h1').waitFor();
 await page.waitForTimeout(250);
 await fit('long name');
 char.name='Veigas Di Cadmus';
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.setViewportSize({width:390,height:844});
 console.log('PASS: sheet responsive layout, all tabs, controls, reveal, long name and reduced motion');
 await page.goto(base+'/player/combate');
 const add=page.getByRole('button',{name:'Adicionar uma cópia de '+enemy.name,exact:true});
 await add.click({clickCount:3});
 await page.getByRole('button',{name:new RegExp(char.name)}).click();
 await page.getByRole('button',{name:'Iniciar Combate',exact:true}).click();
 await page.getByRole('region',{name:'Ordem de iniciativa'}).waitFor();
 assert.equal(state.instances.length,3);
 assert.equal(new Set(state.instances.map(i=>i.id)).size,3);
 assert.ok(state.instances.every(i=>i.label===enemy.name));
 assert.equal(state.participants.filter(p=>p.enemy_instance_id).length,3);
 assert.ok(state.participants.filter(p=>p.enemy_instance_id).every(p=>p.name===enemy.name));
 const originalEnergy=state.instances.map(i=>i.ep_current);
 await page.getByRole('button',{name:'Usar Habilidade',exact:true}).click();
 await page.getByRole('button',{name:char.name,exact:true}).click();
 await page.getByRole('button',{name:/Usar/}).last().click();
 await page.waitForTimeout(600);
 assert.ok(lastActor?.enemy_instance_id,'enemy performed action');
 assert.equal(state.instances.filter((i,n)=>i.ep_current!==originalEnergy[n]).length,1,'only acting copy spends energy');
 // Select the character turn and damage just one copy.
 assert.ok(state.calls.every(c=>c.p_action_id&&c.p_ally_target_participant_id===null&&!('p_delta' in c)),'client sends intent only');
 await page.getByRole('region',{name:'Registro do combate'}).getByText(/10 de PV perdido/).first().waitFor();
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 const sorted=[...state.participants].sort((a,b)=>b.initiative_total-a.initiative_total||cmp(a.name,b.name)||cmp(a.id,b.id));
 state.battle.current_turn_index=sorted.findIndex(p=>p.character_id);
 await page.reload();
 await page.getByRole('button',{name:'Usar Habilidade',exact:true}).click();
 await page.getByRole('button',{name:enemy.name,exact:true}).nth(1).click();
 const oldHp=state.instances.map(i=>i.hp_current);
 await page.getByRole('button',{name:/Usar/}).last().click();
 await page.waitForTimeout(600);
 assert.equal(state.instances.filter((i,n)=>i.hp_current!==oldHp[n]).length,1,'only targeted copy loses HP');
 await fit('combat');
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 await page.waitForTimeout(1200);
 await page.screenshot({path:path.join(screenshotDir,'combate-mobile.png'),fullPage:true});
 await page.reload();
 await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Ordem de iniciativa"] li').length===4);
 assert.equal(await page.getByRole('region',{name:'Ordem de iniciativa'}).getByText(enemy.name,{exact:true}).count(),3,'copies survive reload');
 // Player still sees all participants outside their turn.
 state.role='player';state.battle.current_turn_index=sorted.findIndex(p=>p.enemy_instance_id);
 await page.reload();
 await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Ordem de iniciativa"] li').length===4);
 assert.equal(await page.getByRole('region',{name:'Ordem de iniciativa'}).getByText(enemy.name,{exact:true}).count(),3);
 // Interrupted setup rolls back and displays a usable error.
 state.role='mestre';state.battle=null;state.instances=[];state.participants=[];state.failInsert=true;
 await page.reload();
 await add.click({clickCount:3});
 await page.getByRole('button',{name:'Iniciar Combate',exact:true}).click();
 await page.getByRole('alert').waitFor();
 assert.equal(state.battle,null);
 assert.equal(state.instances.length,0);
 assert.ok(await page.getByRole('button',{name:'Iniciar Combate',exact:true}).isEnabled());
 assert.deepEqual(errors,[]);
 console.log('PASS: 4 viewport sizes, all sheet tabs, reveal without scroll, 44px controls, long name, reduced motion, 3 independent copies, HP/PE isolation, reload, player view and setup rollback.');
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
