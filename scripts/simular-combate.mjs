// Simulador de calibração (fase 6). Usa as fórmulas reais de src/lib/diceEngine.ts e as regras do servidor
// (patches 09 e 10/11) para estimar dano, mitigação e quantos golpes derrubam um inimigo.
// Uso: node scripts/simular-combate.mjs [rodadas=4000]
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const mod = { exports: {} }
const src = ts.transpileModule(fs.readFileSync('src/lib/diceEngine.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
vm.runInNewContext(src, { module: mod, exports: mod.exports, Math })
const D = mod.exports
const N = Number(process.argv[2] ?? 4000)

const mean = (f) => { let s = 0; for (let i = 0; i < N; i++) s += f(); return s / N }
// Mesmo pipeline do servidor: bruto (crítico) × multiplicador do inimigo × reação → mitigação.
function hit({ tier, level, attr, targetRes, mult = 1, reaction = 1 }) {
  const raw = Math.round(Math.round(D.calculateDamage({ tier, nivelHabilidade: level, statusEscalador: attr }).danoFinal * mult) * reaction)
  return D.calculateMitigation({ resistance: targetRes, danoBruto: raw }).danoFinal
}
const hpEnemy = (res, lvl, tier) => Math.round(D.calculateHpMax({ resistance: res, level: lvl }) * D.ENEMY_TIER_CONFIG[tier].vidaMult)
const pad = (v, n = 8) => String(v).padStart(n)

console.log(`\nDano médio final por golpe (após mitigação), ${N} simulações por célula. Alvo com Resistência igual ao atributo.\n`)
for (const tier of ['comum', 'especial', 'suprema']) {
  console.log(`${tier.toUpperCase()} — nível da habilidade 1 / 5 / 10`)
  console.log('atributo' + [1, 5, 10].map((l) => pad('nv' + l, 10)).join(''))
  for (const attr of [2, 4, 6, 8, 10]) {
    console.log(pad(attr) + [1, 5, 10].map((l) => pad(Math.round(mean(() => hit({ tier, level: l, attr, targetRes: attr }))), 10)).join(''))
  }
  console.log()
}

console.log('Golpes para derrubar um inimigo (personagem nível 10, habilidade nível 1, Resistência do inimigo = atributo)\n')
console.log('atributo  tier       ' + ['comum', 'elite', 'boss'].map((t) => pad(t, 10)).join(''))
for (const attr of [3, 6, 9]) {
  for (const tier of ['comum', 'especial', 'suprema']) {
    const d = mean(() => hit({ tier, level: 1, attr, targetRes: attr }))
    console.log(pad(attr) + '  ' + tier.padEnd(9) + ['comum', 'elite', 'boss'].map((t) => pad(d > 0 ? (hpEnemy(attr, 10, t) / d).toFixed(1) : '∞', 10)).join(''))
  }
}

console.log('\nInimigo atacando personagem (nível 10, atributo 5, habilidade Comum nv1): dano médio por tier do inimigo')
for (const t of ['comum', 'elite', 'boss']) {
  const d = mean(() => hit({ tier: 'comum', level: 1, attr: 5, targetRes: 5, mult: D.ENEMY_TIER_CONFIG[t].danoMult }))
  console.log(`  ${t.padEnd(6)} ${pad(Math.round(d))}   (${((d / D.calculateHpMax({ resistance: 5, level: 10 })) * 100).toFixed(1)}% do PV do personagem)`)
}

console.log('\nImpacto das reações (Especial nv1, atributo 6, alvo Res 6)')
const base = mean(() => hit({ tier: 'especial', level: 1, attr: 6, targetRes: 6 }))
const amp = mean(() => hit({ tier: 'especial', level: 1, attr: 6, targetRes: 6, reaction: 1.5 }))
console.log(`  sem reação ${Math.round(base)} · Vaporização/Derretimento ${Math.round(amp)} (+${Math.round((amp / base - 1) * 100)}% após mitigação)`)
const condRaw = mean(() => Math.round(D.calculateDamage({ tier: 'especial', nivelHabilidade: 1, statusEscalador: 6 }).danoFinal * 0.5))
const cond = mean(() => D.calculateMitigation({ resistance: 6, danoBruto: Math.round(condRaw) }).danoFinal)
const alas = mean(() => D.calculateMitigation({ resistance: 6, danoBruto: Math.round(condRaw / 2) }).danoFinal)
console.log(`  Condução: +${Math.round(cond)} em até 2 alvos · Alastramento: +${Math.round(alas)} em até 2 alvos`)
console.log(`  Total da ação com 2 secundários: Condução ${Math.round(base + 2 * cond)} · Alastramento ${Math.round(base + 2 * alas)} vs golpe simples ${Math.round(base)}\n`)
