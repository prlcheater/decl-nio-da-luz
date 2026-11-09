
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
   if(table==='create_structured_ability'){
 state.lastSave=body;
 if(state.failSave){status=500;result={message:'simulated save failure'};}
 else {ability.abilities={name:body.p_name,description:body.p_description,type:body.p_tier,tipo_efeito:body.p_definition.effects[0].kind,definition:body.p_definition,combat_enabled:body.p_definition.effects.every(e=>['dano','cura','escudo','buff','debuff'].includes(e.kind)&&!e.appliesElement)};result='ability-1';}
 } else if(table==='abilities'&&method==='PATCH'){
 Object.assign(ability.abilities,body);state.enabled=body;result=[];
 } else if(url.pathname.includes('/auth/')) result=user;
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
   } else if(table==='combat_apply_hp'){
     const target=state.participants.find(p=>p.id===body.p_target_participant_id);
     lastActor=state.participants.find(p=>p.id===body.p_actor_participant_id);
     const entity=target.character_id?char:state.instances.find(i=>i.id===target.enemy_instance_id);
     entity.hp_current=Math.max(0,Math.min(body.p_hp_max,entity.hp_current+body.p_delta));
     result=entity.hp_current;
   }
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

 const errorsList=[];
 page.on('pageerror',e=>errorsList.push(e.message));
 for(const kind of ['character','npc','enemy']){
   char.user_id=kind==='npc'?null:userId;
   ability.abilities.definition=null;
   ability.abilities.name='Pulso de teste';
   await page.goto(base+(kind==='enemy'?'/player/mestre/inimigos/enemy-1':'/player/ficha/char-1'));
   if(kind!=='enemy')await page.getByRole('button',{name:'Habilidades',exact:true}).click();
   await page.getByRole('button',{name:'Adicionar habilidade',exact:true}).click();
   await page.getByLabel('Nome',{exact:true}).fill('Impulso '+kind);
   await page.getByLabel('Atributo escalador',{exact:true}).selectOption('agility');
   state.failSave=true;
   await page.getByRole('button',{name:'Salvar habilidade',exact:true}).click();
   await page.getByRole('alert').waitFor();
   assert.equal(await page.getByLabel('Nome',{exact:true}).inputValue(),'Impulso '+kind);
   state.failSave=false;
   await page.getByRole('button',{name:'Salvar habilidade',exact:true}).click();
   await page.getByText('Impulso '+kind,{exact:true}).waitFor();
   assert.equal(ability.abilities.definition.effects[0].scaler,'agility');
   assert.equal(state.lastSave.p_owner_type,kind==='enemy'?'enemy':'character');
   await page.reload();
   if(kind!=='enemy')await page.getByRole('button',{name:'Habilidades',exact:true}).click();
   await page.getByText('Impulso '+kind,{exact:true}).waitFor();
   await page.getByRole('button',{name:'Adicionar habilidade',exact:true}).click();
   await page.getByLabel('Nome',{exact:true}).fill('Impacto desmoralizante');
   await page.getByRole('button',{name:'Adicionar efeito',exact:true}).click();
   const extra=page.locator('fieldset').nth(1);
   await extra.getByLabel('Atributo alterado',{exact:true}).selectOption('charisma');
   await extra.getByLabel('Redução em pontos',{exact:true}).fill('2');
   await extra.getByLabel('Duração (turnos do alvo)',{exact:true}).fill('2');
   await page.setViewportSize({width:320,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'builder fits mobile '+kind);
   // Fase 2: dano + debuff é suportado e nasce habilitado.
   await page.getByRole('button',{name:'Salvar habilidade',exact:true}).click();
   await page.getByText('Impacto desmoralizante',{exact:true}).waitFor();
   assert.equal(ability.abilities.definition.effects.length,2);
   assert.equal(ability.abilities.combat_enabled,true);
   // Fora do combate não há como aplicar debuff: sem botão Usar.
   if(kind!=='enemy')assert.equal(await page.getByRole('button',{name:/^Usar \(/}).count(),0);
   // Rascunho antigo já suportado: exige revisão explícita do mestre.
   ability.abilities.combat_enabled=false;
   state.enabled=null;
   await page.reload();
   if(kind!=='enemy')await page.getByRole('button',{name:'Habilidades',exact:true}).click();
   await page.getByRole('button',{name:'Revisei — habilitar no combate',exact:true}).click();
   await page.getByRole('button',{name:'Revisei — habilitar no combate',exact:true}).waitFor({state:'detached'});
   assert.deepEqual(state.enabled,{combat_enabled:true});
   // Efeito ainda não implementado continua rascunho, sem botão de habilitar.
   await page.setViewportSize({width:390,height:844});
   await page.getByRole('button',{name:'Adicionar habilidade',exact:true}).click();
   await page.getByLabel('Nome',{exact:true}).fill('Pavor');
   await page.getByLabel('Categoria',{exact:true}).selectOption('controle');
   await page.getByLabel('Comportamento',{exact:true}).selectOption('medo');
   await page.getByLabel('Duração (turnos do alvo)',{exact:true}).fill('1');
   await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click();
   await page.getByText('Rascunho — efeitos ainda indisponíveis no combate.',{exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Revisei — habilitar no combate'}).count(),0);
   console.log('PASS '+kind+': save, reload, failed save retains fields, agility scaler, hybrid enabled, explicit enabling, unsupported draft and mobile.');
 }
 assert.deepEqual(errorsList,[]);
 await context.close();
 } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
