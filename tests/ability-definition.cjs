const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(name) {
 const module={exports:{}};
 const source=ts.transpileModule(fs.readFileSync('src/lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{module,exports:module.exports,require:n=>load(n.replace('./','')),Math,Number,Object,Array});
 return module.exports;
}
const {defaultEffect,validateDefinition,isAbilityReady,isCombatSupported,abilityTargeting,abilityScaler,abilitySummary,ATTRIBUTES}=load('abilityDefinition');
const {calculateDamage}=load('diceEngine');
const plain=o=>JSON.parse(JSON.stringify(o));
const definition=e=>({version:1,effects:e});
for(const [kind,scaler] of [['dano','attack'],['cura','intellect'],['escudo','resistance']]){
 assert.equal(abilityScaler({tipo_efeito:kind}),scaler);
 assert.equal(isAbilityReady({tipo_efeito:kind}),true);
 for(const key of Object.keys(ATTRIBUTES)){
  const d=definition([{...defaultEffect(kind),scaler:key}]);
  assert.equal(validateDefinition(d),null);
  assert.equal(isAbilityReady({tipo_efeito:kind,definition:d,combat_enabled:true}),true);
  assert.equal(isAbilityReady({tipo_efeito:kind,definition:d}),false); // sem habilitação explícita
  assert.equal(abilityScaler({tipo_efeito:kind,definition:d}),key);
 }
}
const damage={...defaultEffect(),scaler:'agility'};
assert.equal(calculateDamage({tier:'especial',nivelHabilidade:1,statusEscalador:4}).nDados,40);
assert.equal(calculateDamage({tier:'especial',nivelHabilidade:1,statusEscalador:6}).nDados,60);
const debuff={...defaultEffect('debuff'),attribute:'charisma',amount:2,duration:2};
const hybrid=definition([damage,debuff]);
assert.equal(validateDefinition(hybrid),null);
// Fase 2: dano + debuff é suportado, mas rascunho antigo só vale depois de habilitado.
assert.equal(isCombatSupported(hybrid),true);
assert.equal(isAbilityReady({tipo_efeito:'dano',definition:hybrid}),false);
assert.equal(isAbilityReady({tipo_efeito:'dano',definition:hybrid,combat_enabled:true}),true);
assert.deepEqual(plain(abilityTargeting({tipo_efeito:'dano',definition:hybrid})),{hostile:true,allySupport:false});
const drain=definition([damage,defaultEffect('cura')]);
assert.deepEqual(plain(abilityTargeting({tipo_efeito:'dano',definition:drain})),{hostile:true,allySupport:true});
assert.deepEqual(plain(abilityTargeting({tipo_efeito:'cura'})),{hostile:false,allySupport:false});
assert.deepEqual(plain(abilityTargeting({tipo_efeito:'dano'})),{hostile:true,allySupport:false});
const selfShield=definition([{...defaultEffect('escudo'),target:'self'}]);
assert.equal(isCombatSupported(selfShield),true);
assert.match(abilitySummary({tipo_efeito:'escudo',definition:selfShield}),/barreira/);
for(const k of ['controle','purificacao','preparacao','movimento']){
 const e={...defaultEffect(k),state:k==='controle'?'medo':k==='preparacao'?'marca':k==='purificacao'?'remover_penalidade':null,duration:['controle','preparacao'].includes(k)?1:null};
 assert.equal(validateDefinition(definition([e])),null,k);
 assert.equal(isCombatSupported(definition([e])),false,k);
 assert.equal(isAbilityReady({tipo_efeito:'dano',definition:definition([e]),combat_enabled:true}),false,k);
}
assert.equal(isAbilityReady({tipo_efeito:'dano',combat_enabled:false}),false);
assert.match(abilitySummary({tipo_efeito:'dano',definition:hybrid}),/Carisma/);
for(const bad of [
 definition([{...damage,target:'ally'}]),
 definition([{...defaultEffect('cura'),target:'enemy'}]),
 definition([{...debuff,amount:-1}]),
 definition([{...debuff,amount:1.5}]),
 definition([{...debuff,duration:0}]),
 definition([{...debuff,attribute:null}]),
 definition([{...damage,appliesElement:true}]),
 definition([{...damage,element:'inventado'}]),
 definition([{...damage,attribute:'attack'}]),
 definition([defaultEffect('movimento'),debuff]),
 {version:2,effects:[damage]},
 definition([]),
 definition(Array(9).fill(damage)),
])assert.notEqual(validateDefinition(bad),null);
const elemental=definition([{...damage,element:'Marine',appliesElement:true,duration:2}]);
assert.equal(validateDefinition(elemental),null);
assert.equal(isAbilityReady({tipo_efeito:'dano',definition:elemental,combat_enabled:true}),false); // fase 4
assert.equal(isAbilityReady({tipo_efeito:'dano',definition:definition([{...damage,element:'Marine'}]),combat_enabled:true}),true);
assert.equal(isAbilityReady({tipo_efeito:'dano',definition:{version:99,effects:[]}}),false);
console.log('PASS: legacy mappings, all 5 scalers, explicit enabling, phase 2 support, targeting, elements, target safety, invalid/missing fields and dice scaling.');
