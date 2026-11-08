const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const env = fs.readFileSync('.env', 'utf8');
const api = new URL(env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)/m)[1].trim());
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
async function main() {
  const browser = await chromium.launch({headless:true});
  try {
    for (const [index, username] of ['Auroa', 'Veigas'].entries()) {
      const user = {id:'11111111-1111-4111-8111-11111111111'+index, aud:'authenticated',role:'authenticated',email:'test@example.com'};
      const state = { characters:[], writes:[], role:'mestre', failDelete:false, failList:false };
      const context = await browser.newContext({viewport:{width:320,height:844}});
      await context.addInitScript(({key,user})=>{
        const exp=Math.floor(Date.now()/1000)+3600;
        const token=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+btoa(JSON.stringify({sub:user.id,exp,role:'authenticated'}))+'.test';
        localStorage.setItem(key,JSON.stringify({access_token:token,refresh_token:'test',expires_at:exp,expires_in:3600,token_type:'bearer',user}));
      },{key:'sb-'+api.hostname.split('.')[0]+'-auth-token',user});
      await context.routeWebSocket('**/realtime/**',socket=>socket.close());
      await context.route(api.origin+'/**',async route=>{
        const req=route.request(),url=new URL(req.url()),table=url.pathname.split('/').pop(),method=req.method();
        const body=['GET','DELETE'].includes(method)?null:req.postDataJSON();
        let result=[],status=200;
        if(method!=='GET')state.writes.push({table,method,body});
        if(url.pathname.includes('/auth/'))result=user;
        else if(table==='profiles')result=url.searchParams.has('username') ? (url.searchParams.get('username')==='eq.'+username?[{id:user.id}]:[]) : [{id:user.id,username,role:state.role}];
        else if(table==='classes')result=[{id:'class-1',name:'Sentinela'}];
        else if(table==='elements')result=[{id:'element-1',name:'Élix'}];
        else if(table==='characters'){
          if(method==='POST')state.characters.push({
            id:'char-'+state.characters.length, xp_progress:0,portrait_url:null,credits:0,cifras:0,
            attack:0,resistance:0,agility:0,intellect:0,charisma:0,classes:null,elements:null,...body
          });
          if(method==='PATCH')Object.assign(state.characters.find(c=>'eq.'+c.id===url.searchParams.get('id')),body);
          result=method==='POST'?state.characters.slice(-1):state.characters.filter(c=>{
            for(const field of ['id','user_id','status']){
              const filter=url.searchParams.get(field);
              if(filter==='is.null' && c[field]!==null)return false;
              if(filter==='not.is.null' && c[field]===null)return false;
              if(filter?.startsWith('eq.') && 'eq.'+c[field]!==filter)return false;
            }
            return true;
          });
          if(state.failList && method==='GET'){status=500;result={message:'simulated query failure'};}
        } else if(table==='delete_character_with_login'){
          if(state.failDelete){status=500;result={message:'simulated delete failure'};}
          else {state.characters=state.characters.filter(c=>c.id!==body.p_character_id);result=null;}
        }
        if(status===200 && req.headers().accept?.includes('vnd.pgrst.object') && Array.isArray(result))result=result[0]??null;
        await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
      });
      const page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base+'/player/mestre');
      await page.getByRole('link',{name:/Minha ficha/}).waitFor();
      for(const width of [320,390,768,1280]){
        await page.setViewportSize({width,height:844});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'master panel fits '+width);
      }
      await page.setViewportSize({width:390,height:844});
      await page.getByRole('link',{name:/Minha ficha/}).click();
      await page.getByRole('link',{name:'Criar minha ficha →'}).click();
      assert.equal(await page.locator('#pin').count(),0);
      await page.locator('#name').fill(username+' viajante');
      await page.getByRole('button',{name:'Criar Ficha',exact:true}).click();
      await page.getByRole('heading',{name:username+' viajante',exact:true}).waitFor();
      assert.equal(state.characters.length,1);
      assert.equal(state.characters[0].user_id,user.id);
      // An existing active sheet cannot be duplicated even via the direct create URL.
      await page.goto(base+'/player/minha-ficha/criar');
      await page.locator('#name').fill('Duplicada');
      await page.getByRole('button',{name:'Criar Ficha',exact:true}).click();
      await page.getByRole('heading',{name:username+' viajante',exact:true}).waitFor();
      assert.equal(state.characters.length,1);
      await page.goto(base+'/player/mestre/npcs');
      await page.getByRole('link',{name:'Criar NPC',exact:true}).click();
      await page.locator('#name').fill('Mercadora orbital');
      assert.equal(await page.locator('#pin').count(),0);
      await page.getByRole('button',{name:'Criar NPC',exact:true}).click();
      await page.getByRole('heading',{name:'Mercadora orbital',exact:true}).waitFor();
      assert.equal(state.characters[1].user_id,null);
      assert.equal(state.characters[1].class_id,null);
      await page.getByRole('link',{name:/← Personagens do Mundo/}).click();
      await page.getByRole('link',{name:/Mercadora orbital/}).waitFor();
      assert.equal(await page.getByRole('link',{name:username+' viajante',exact:true}).count(),0);
      await page.goto(base+'/player/mestre/elementalistas');
      await page.getByRole('link',{name:new RegExp(username+' viajante')}).waitFor();
      assert.equal(await page.getByRole('link',{name:/Mercadora orbital/}).count(),0);
      await page.goto(base+'/player/mestre/npcs');
      await page.getByRole('button',{name:'Excluir ficha',exact:true}).click();
      state.failDelete=true;
      await page.getByRole('button',{name:'Sim',exact:true}).click();
      await page.getByRole('alert').waitFor();
      assert.equal(state.characters.length,2);
      state.failDelete=false;
      await page.getByRole('button',{name:'Sim',exact:true}).click();
      await page.getByText('Nenhuma ficha cadastrada ainda.').waitFor();
      assert.equal(state.characters.length,1);
      // Existing accounts must not trigger signup or the former account-removal RPC.
      await page.goto(base+'/player/ficha/criar');
      await page.locator('#name').fill(username);
      await page.locator('#pin').fill('1234');
      await page.getByRole('button',{name:'Criar Ficha',exact:true}).click();
      await page.getByText('Esse acesso já existe.',{exact:false}).waitFor();
      assert.ok(state.writes.every(w=>!['signup','profiles','free_up_username_if_orphaned'].includes(w.table)));
      state.failList=true;
      await page.goto(base+'/player/mestre/npcs');
      await page.getByRole('alert').waitFor();
      state.failList=false;
      state.role='player';
      await page.goto(base+'/player/mestre/npcs/criar');
      await page.waitForURL(url=>!url.pathname.startsWith('/player/mestre'));
      assert.equal(await page.locator('#name').count(),0);
      assert.deepEqual(errors,[]);
      await context.close();
      console.log(username+': self ownership, duplicate prevention, NPC creation/list/deletion, errors, access and mobile passed (mocked Supabase).');
    }
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
