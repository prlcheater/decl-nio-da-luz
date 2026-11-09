// Teste das fases 2 e 3 em Postgres local (PGlite, em memória). Não toca no Supabase.
// Uso: npm i --prefix <pasta-temporária> @electric-sql/pglite@0.2.17
//      node tests/combat-sql.mjs . <pasta-temporária>/node_modules/@electric-sql/pglite
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const [root, pglitePath] = process.argv.slice(2)
const { PGlite } = await import(pathToFileURL(path.join(pglitePath, 'dist/index.js')).href)
const db = new PGlite()
const sql = (f) => fs.readFileSync(path.join(root, 'supabase', f), 'utf8')

await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select 'authenticated' $$;
  create publication supabase_realtime;
`)
for (const f of ['schema.sql', 'patch-2026-11-04-seguranca-e-combate.sql', 'patch-2026-11-07-fichas-mestre-npcs.sql', 'patch-2026-11-08-habilidades-fase-1.sql', 'patch-2026-11-09-combate-fases-2-3.sql']) {
  try { await db.exec(sql(f)) } catch (e) { console.error('FALHOU em', f, e.message); process.exit(1) }
}
// Idempotência do patch novo.
await db.exec(sql('patch-2026-11-09-combate-fases-2-3.sql'))
console.log('OK: schema + 4 patches aplicados; patch 09 roda duas vezes')

const M = '00000000-0000-4000-8000-000000000001', P1 = '00000000-0000-4000-8000-000000000002', P2 = '00000000-0000-4000-8000-000000000003'
const as = async (uid) => db.exec(`set test.uid = '${uid}'`)
const one = async (q, p) => (await db.query(q, p)).rows[0]
const val = async (q, p) => Object.values((await db.query(q, p)).rows[0] ?? {})[0]
async function fails(q, p, re) {
  try { await db.query(q, p) } catch (e) { assert.match(e.message, re); return }
  assert.fail('esperava erro ' + re + ' em ' + q)
}

await db.exec(`
  insert into auth.users values ('${M}','m@x'),('${P1}','a@x'),('${P2}','b@x');
  insert into profiles(id, username, role) values ('${M}','Mestre','mestre'),('${P1}','Aya','player'),('${P2}','Bren','player');
`)
const abilityTypeCheck = await val(`select pg_get_constraintdef(oid) from pg_constraint where conname like 'abilities_type%' limit 1`)
console.log('abilities.type:', abilityTypeCheck)

await as(M)
const A = await val(`insert into characters(user_id,name,level,hp_current,ep_current,attack,resistance,agility,intellect) values ('${P1}','Aya',10,2000,1000,4,2,3,3) returning id`)
const B = await val(`insert into characters(user_id,name,level,hp_current,ep_current,attack,resistance,agility,intellect) values ('${P2}','Bren',10,800,1000,3,2,2,2) returning id`)
const E = await val(`insert into enemies(name,tier,level,attack,resistance,intellect,charisma) values ('Sentinela','comum',10,3,1,2,4) returning id`)
const I1 = await val(`insert into enemy_instances(enemy_id,label,hp_current,ep_current) values ('${E}','Sentinela',900,600) returning id`)
const I2 = await val(`insert into enemy_instances(enemy_id,label,hp_current,ep_current) values ('${E}','Sentinela',900,600) returning id`)

const def = (effects) => JSON.stringify({ version: 1, effects })
const eff = (o) => ({ kind: 'dano', scaler: 'attack', element: null, appliesElement: false, target: 'enemy', attribute: null, amount: null, duration: null, state: null, ...o })
// Legada (sem definition) e estruturadas criadas pela RPC.
const legacy = await val(`insert into abilities(name,type,tipo_efeito) values ('Golpe','comum','dano') returning id`)
await db.query(`update abilities set combat_enabled = true where id = $1`, [legacy]) // migração já roda antes; aqui é inserção posterior
await db.query(`insert into character_abilities values ($1,$2,1)`, [A, legacy])
const mk = async (owner, ownerId, name, tier, effects) => val(`select create_structured_ability($1,$2,$3,'',$4,1,$5::jsonb)`, [owner, ownerId, name, tier, def(effects)])
const hybrid = await mk('character', A, 'Impacto desmoralizante', 'comum', [eff({}), eff({ kind: 'debuff', attribute: 'charisma', amount: 2, duration: 2 })])
const haste = await mk('character', A, 'Aceleração', 'comum', [eff({ kind: 'buff', target: 'self', scaler: 'agility', attribute: 'agility', amount: 2, duration: 1 })])
const drain = await mk('character', A, 'Dreno', 'comum', [eff({}), eff({ kind: 'cura', scaler: 'intellect', target: 'ally' })])
const shield = await mk('character', B, 'Muralha', 'comum', [eff({ kind: 'escudo', scaler: 'resistance', target: 'ally' })])
const fear = await mk('character', B, 'Pavor', 'comum', [eff({ kind: 'controle', state: 'medo', duration: 1 })])
const elemental = await mk('character', B, 'Névoa', 'comum', [eff({ element: 'Marine', appliesElement: true, duration: 2 })])
const enemyHit = await mk('enemy', E, 'Disparo', 'comum', [eff({})])
assert.equal(await val(`select combat_enabled from abilities where id=$1`, [hybrid]), true, 'suportada nasce habilitada')
assert.equal(await val(`select combat_enabled from abilities where id=$1`, [fear]), false, 'controle é rascunho')
assert.equal(await val(`select combat_enabled from abilities where id=$1`, [elemental]), false, 'elemental é rascunho')
await fails(`update abilities set combat_enabled = true where id=$1`, [elemental], /abilities_combat_enabled_supported/)
console.log('OK: habilitação automática só para efeitos suportados; constraint impede habilitar rascunho não suportado')

// Combate: iniciativas fixas → ordem Aya(30), Sentinela I1(20), Bren(15), Sentinela I2(10).
const S = await val(`insert into battle_sessions(status) values ('active') returning id`)
const part = async (c, i, name, side, init) => val(`insert into battle_participants(battle_session_id,character_id,enemy_instance_id,name,side,initiative_roll,initiative_bonus,initiative_total) values ($1,$2,$3,$4,$5,0,0,$6) returning id`, [S, c, i, name, side, init])
const pA = await part(A, null, 'Aya', 'aliado', 30)
const pI1 = await part(null, I1, 'Sentinela', 'inimigo', 20)
const pB = await part(B, null, 'Bren', 'aliado', 15)
const pI2 = await part(null, I2, 'Sentinela', 'inimigo', 10)
assert.equal(await val(`select combat_current_participant($1)`, [S]), pA)

const use = (id, actor, ability, target, ally = null, vital = false) =>
  db.query(`select combat_use_ability($1,$2,$3,$4,$5,$6) r`, [id, actor, ability, target, ally, vital]).then((r) => r.rows[0].r)
const uuid = () => crypto.randomUUID()
const hp = async (t, id) => val(`select hp_current from ${t} where id=$1`, [id])
const ep = async (t, id) => val(`select ep_current from ${t} where id=$1`, [id])

// Autoria e turno.
await as(P2)
await fails(`select combat_use_ability($1,$2,$3,$4,null,false)`, [uuid(), pA, legacy, pI1], /não controla/)
await fails(`select combat_use_ability($1,$2,$3,$4,null,false)`, [uuid(), pB, shield, pB], /Não é o turno/)
await as(P1)
await fails(`select combat_use_ability($1,$2,$3,$4,null,false)`, [uuid(), pA, shield, pA], /não pertence/)
await fails(`select combat_use_ability($1,$2,$3,$4,null,false)`, [uuid(), pA, legacy, pB], /fogo amigo/)
await fails(`select combat_use_ability($1,$2,$3,$4,$5,false)`, [uuid(), pA, drain, pI1, pI2], /aliado/)
console.log('OK: autoria, turno, posse da habilidade, sem fogo amigo e alvo de apoio validados no servidor')

// Dano + debuff numa cópia; a outra cópia não muda. Idempotência.
const id1 = uuid()
const before = { i1: await hp('enemy_instances', I1), i2: await hp('enemy_instances', I2), ep: await ep('characters', A) }
const r1 = await use(id1, pA, hybrid, pI1)
assert.equal(r1.effects.length, 2)
assert.equal(r1.effects[0].kind, 'dano')
assert.equal(r1.effects[0].hp_loss, r1.effects[0].raw - r1.effects[0].mitigation)
assert.equal(await hp('enemy_instances', I1), Math.max(0, before.i1 - r1.effects[0].hp_loss))
assert.equal(await hp('enemy_instances', I2), before.i2, 'cópia não-alvo intacta')
assert.equal(await ep('characters', A), before.ep - r1.cost)
assert.equal(r1.cost, Math.round(0.1 * (300 + 3 * 100 + 10 * 8)))
assert.equal(await val(`select combat_effective_attr($1,'charisma')`, [pI1]), 2, 'Carisma 4 − 2')
assert.equal(await val(`select combat_effective_attr($1,'charisma')`, [pI2]), 4, 'debuff não vaza para outra cópia')
const again = await use(id1, pA, hybrid, pI1)
assert.deepEqual(again, r1)
assert.equal(await ep('characters', A), before.ep - r1.cost, 'repetição não gasta de novo')
assert.equal(await val(`select count(*)::int from battle_actions where id=$1`, [id1]), 1)
assert.equal(await val(`select last_used_round from battle_ability_cooldowns where participant_id=$1 and ability_id=$2`, [pA, hybrid]), 1)
console.log('OK: dano+debuff atômico, cópias independentes, custo/recarga/log e repetição idempotente')

// Buff próprio de 1 turno: sobrevive ao fim do turno em que foi aplicado.
await use(uuid(), pA, haste, pA)
assert.equal(await val(`select combat_effective_attr($1,'agility')`, [pA]), 5)
const skipped = (await db.query(`select combat_next_turn($1, 3) r`, [S])).rows[0].r
assert.equal(skipped.skipped, true, 'índice desatualizado não passa turno')
await db.query(`select combat_next_turn($1, 0)`, [S]) // fim do turno de Aya
assert.equal(await val(`select combat_effective_attr($1,'agility')`, [pA]), 5, 'buff aplicado no próprio turno não conta este turno')
assert.equal(await val(`select combat_current_participant($1)`, [S]), pI1)

// Turno do inimigo I1 (mestre): debuff conta ao fim do turno dele.
await as(P1)
await fails(`select combat_next_turn($1, 1)`, [S], /Só o mestre/)
await as(M)
const rI = await use(uuid(), pI1, enemyHit, pA)
assert.equal(rI.effects[0].raw >= 0, true)
await db.query(`select combat_next_turn($1, 1)`, [S])
assert.equal(await val(`select remaining_turns from battle_effects where target_participant_id=$1 and kind='debuff'`, [pI1]), 1)

// Turno de Bren: barreira em Aya.
await as(P2)
const rS = await use(uuid(), pB, shield, pA)
assert.equal(rS.effects[0].kind, 'escudo')
const barrier = await val(`select amount from battle_effects where target_participant_id=$1 and kind='barreira'`, [pA])
assert.equal(barrier, rS.effects[0].raw)
await fails(`select combat_use_ability($1,$2,$3,$4,null,false)`, [uuid(), pB, fear, pI1], /rascunho/)
await db.query(`select combat_next_turn($1, 2)`, [S])

// Turno de I2: dano em Aya passa pela barreira antes do PV.
await as(M)
await db.exec(`update enemies set attack = 10 where id = '${E}'`) // garante dano relevante
const hpA = await hp('characters', A)
const rB = await use(uuid(), pI2, enemyHit, pA)
const d = rB.effects[0]
assert.equal(d.absorbed, Math.min(barrier, Math.max(0, d.raw - d.mitigation)))
assert.equal(d.hp_loss, Math.max(0, d.raw - d.mitigation) - d.absorbed)
assert.equal(await hp('characters', A), hpA - d.hp_loss)
const left = await val(`select amount from battle_effects where target_participant_id=$1 and kind='barreira'`, [pA])
assert.equal(left ?? 0, barrier - d.absorbed)
await db.query(`select combat_next_turn($1, 3)`, [S])
assert.equal(await val(`select round_number from battle_sessions where id=$1`, [S]), 2)
console.log('OK: turnos, barreira absorve após mitigação, cópias de inimigo, rodada avança')

// Rodada 2, turno de Aya: buff de 1 turno expira ao fim deste turno. Dreno cura aliado escolhido.
await as(P1)
await db.exec(`update characters set hp_current = 100 where id = '${B}'`)
const rD = await use(uuid(), pA, drain, pI2, pB)
assert.equal(rD.effects[1].kind, 'cura')
assert.equal(rD.effects[1].target, pB)
assert.equal(await hp('characters', B), Math.min(500 + 2 * 150 + 100, 100 + rD.effects[1].raw))
const t = (await db.query(`select combat_next_turn($1, 0) r`, [S])).rows[0].r
assert.deepEqual(t.expired.map((x) => x.attribute), ['agility'])
assert.equal(await val(`select combat_effective_attr($1,'agility')`, [pA]), 3, 'buff removido restaura a base')
assert.equal(await val(`select agility from characters where id=$1`, [A]), 3, 'base nunca foi sobrescrita')
// I1 termina o 2º turno: debuff de 2 turnos expira.
await as(M)
await db.query(`select combat_next_turn($1, 1)`, [S])
assert.equal(await val(`select count(*)::int from battle_effects where target_participant_id=$1`, [pI1]), 0)
console.log('OK: aliado escolhido recebe a cura; buff/debuff expiram na contagem de turnos do alvo')

// Recarga: Especial não repete na mesma rodada.
const special = await mk('character', B, 'Rajada', 'especial', [eff({})])
await as(P2)
await use(uuid(), pB, special, pI1)
await fails(`select combat_use_ability($1,$2,$3,$4,null,false)`, [uuid(), pB, special, pI1], /recarga/)

// Teste de execução: Suprema exige 20; Intelecto 0 falha quase sempre. Falha gasta metade e não aplica.
await as(M)
await db.exec(`update battle_sessions set execution_test = true where id = '${S}'; update characters set intellect = 0, ep_current = 1000 where id = '${B}'`)
const supreme = await mk('character', B, 'Colapso', 'suprema', [eff({})])
await as(P2)
let fail
for (let i = 0; i < 40 && !fail; i++) {
  const epB = await ep('characters', B)
  const hpI = await hp('enemy_instances', I1)
  const r = await use(uuid(), pB, supreme, pI1)
  if (!r.execution.success) {
    fail = r
    assert.equal(r.effects.length, 0)
    assert.equal(await hp('enemy_instances', I1), hpI)
    assert.equal(await ep('characters', B), epB - r.cost)
    assert.equal(r.cost, Math.round(Math.round(0.5 * (300 + 0 + 80)) / 2))
    assert.equal(await val(`select count(*)::int from battle_ability_cooldowns where participant_id=$1 and ability_id=$2`, [pB, supreme]), 0)
  } else {
    await db.exec(`delete from battle_ability_cooldowns where ability_id = '${supreme}'`)
  }
  await db.exec(`update characters set ep_current = 1000 where id = '${B}'`)
}
assert.ok(fail, 'esperava ao menos uma falha de execução')
console.log('OK: recarga validada; falha no teste de execução gasta metade do PE, sem efeito nem recarga')

// Caminho antigo fechado para o app.
assert.equal(await val(`select has_function_privilege('authenticated','combat_apply_hp(uuid,uuid,int,int)','execute')`), false)
assert.equal(await val(`select has_function_privilege('authenticated','combat_use_ability(uuid,uuid,uuid,uuid,uuid,boolean)','execute')`), true)
assert.equal(await val(`select has_function_privilege('authenticated','combat_participant_base(uuid)','execute')`), false)
console.log('OK: combat_apply_hp revogado; só as RPCs públicas ficam expostas')
console.log('PASS: fases 2 e 3 no Postgres local')
