import { useEffect, useState, type ReactNode } from 'react'
import { Compass, Flame, Users, Layers, IdCard } from 'lucide-react'
import BlurText from '@/components/BlurText'
import Reveal from '@/components/Reveal'
import GlowCard from '@/components/GlowCard'
import { ELEMENTS, CLASSES, TRAITS } from '@/lib/gameData'

const CATEGORIES = [
  { id: 'visao-geral', label: 'Visão Geral', icon: Compass },
  { id: 'elementos', label: 'Elementos', icon: Flame },
  { id: 'classes', label: 'Classes', icon: Users },
  { id: 'sistema', label: 'Sistema', icon: Layers },
  { id: 'ficha', label: 'Ficha', icon: IdCard },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="font-title font-semibold text-xl text-neutral-100">{children}</h3>
}

function VisaoGeral() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 text-center font-body text-neutral-400 leading-relaxed">
      <p>
        No ano de 2220, a humanidade alcançou seu ápice civilizacional na chamada{' '}
        <span className="text-neutral-200">Era Dourada</span>. Estações espaciais majestosas
        orbitavam planetas distantes, colônias prósperas se espalhavam por luas e asteroides, e o
        sistema solar inteiro vibrava com a atividade humana.
      </p>
      <p>
        Dois anos depois, em 2222, o impensável aconteceu: um cataclismo devastador na estação{' '}
        <span className="text-neutral-200">Pandora</span> desencadeou uma reação em cadeia que
        abalou todo o cosmos conhecido. Estações caíram do céu como estrelas mortas. Colônias
        entraram em colapso total. A humanidade, que havia conquistado as estrelas, viu seu
        império desmoronar em questão de anos.
      </p>
      <p>
        Durante os 200 anos seguintes, a Era das Trevas consumiu o que restou da civilização. Mas
        não foi apenas a queda tecnológica que transformou o mundo — o cataclismo revelou uma
        verdade oculta: a humanidade nunca esteve sozinha. Alienígenas, seres humanoides e
        criaturas de origens desconhecidas emergiram das sombras, revelando que sempre habitaram
        nosso cosmos, aguardando o momento certo para se manifestar.
      </p>
      <div className="pt-2">
        <SectionTitle>Seu lugar na história: os Vigias Elementalistas</SectionTitle>
        <p className="mt-3">
          Após o cataclismo, a humanidade finalmente começou a se estabilizar e reconstruir. Neste
          mundo fragmentado, onde tecnologia avançada convive com ruínas ancestrais e espécies
          alienígenas disputam territórios com sobreviventes humanos, surge uma classe especial de
          indivíduos: os <span className="text-neutral-200">Vigias</span>.
        </p>
        <p className="mt-3">
          Os jogadores são esses Vigias Elementalistas — guardiões escolhidos que portam o poder de
          manipular os elementos primordiais do universo. Cada um controla uma força fundamental da
          natureza através da conversão de energia elemental, tornando-se uma peça essencial no
          delicado equilíbrio entre ordem e caos.
        </p>
        <p className="mt-3">
          Importante: todas as habilidades funcionam com base em princípios físicos, químicos e
          biológicos — não existe magia pura, apenas conversão de energia e manipulação científica
          da matéria.
        </p>
      </div>
    </div>
  )
}

function Elementos() {
  return (
    <div className="text-center">
      <p className="mx-auto max-w-3xl font-body text-neutral-400 leading-relaxed">
        Existem nove elementos primordiais que os Vigias podem controlar. Cada elemento representa
        conceitos e filosofias únicas, podendo conter variações em suas cores e funcionamento. Oito
        estão disponíveis para jogadores; o nono é um elemento restrito, concedido a pouquíssimos.
      </p>
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {ELEMENTS.map((el) => (
          <GlowCard key={el.name} contentClassName="p-4 text-center">
            <el.icon size={20} strokeWidth={1.5} className="text-neutral-300" />
            <p className="mt-3 font-title font-semibold text-neutral-100">{el.name}</p>
            <p className="font-body text-xs text-neutral-500 italic">{el.epithet}</p>
            <p className="mt-2 font-body text-xs text-neutral-500 leading-relaxed">{el.desc}</p>
            {el.restricted && (
              <p className="mt-2 font-body text-[10px] uppercase tracking-wider text-neutral-400">
                Elemento restrito
              </p>
            )}
          </GlowCard>
        ))}
      </div>
    </div>
  )
}

function Classes() {
  return (
    <div className="text-center">
      <p className="mx-auto max-w-3xl font-body text-neutral-400 leading-relaxed">
        O sistema oferece cinco classes especializadas, cada uma com funções táticas distintas em
        campo.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {CLASSES.map((c) => (
          <GlowCard key={c.name} contentClassName="p-5 text-center">
            <c.icon size={20} strokeWidth={1.5} className="text-neutral-300" />
            <p className="mt-3 font-title font-semibold text-neutral-100">{c.name}</p>
            <p className="mt-1.5 font-body text-sm text-neutral-500 leading-relaxed">{c.desc}</p>
          </GlowCard>
        ))}
      </div>
    </div>
  )
}

function Sistema() {
  return (
    <div className="space-y-10 text-center">
      <div>
        <SectionTitle>Traços</SectionTitle>
        <p className="mx-auto mt-2 max-w-3xl font-body text-sm text-neutral-500 leading-relaxed">
          Os atributos fundamentais que definem as capacidades do personagem. Máximo base de 10
          pontos (pode ultrapassar através de bônus de perícias passivas).
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {TRAITS.map((t) => (
            <GlowCard key={t.name} contentClassName="p-5 text-center">
              <p className="font-title font-semibold text-neutral-100">{t.name}</p>
              <p className="mt-1.5 font-body text-sm text-neutral-500 leading-relaxed">{t.desc}</p>
            </GlowCard>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Sistema de Dados</SectionTitle>
        <p className="mx-auto mt-2 max-w-3xl font-body text-sm text-neutral-500 leading-relaxed">
          O sistema utiliza dados de 20 faces (d20), com mecânicas escalonadas de acordo com os
          valores dos Traços.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {[
            { range: '1–2 pontos', roll: '1d20 normal' },
            { range: '3–5 pontos', roll: 'Vantagem (2d20, melhor resultado)' },
            { range: '6–9 pontos', roll: '3d20' },
            { range: '12+ pontos', roll: '4d20 (apenas com bônus de perícias)' },
          ].map((row) => (
            <GlowCard key={row.range} contentClassName="p-5 text-center">
              <p className="font-title font-semibold text-neutral-100">{row.range}</p>
              <p className="mt-1.5 font-body text-sm text-neutral-500">{row.roll}</p>
            </GlowCard>
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Progressão, Energia e Regras Situacionais</SectionTitle>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <GlowCard contentClassName="p-5 text-center">
            <p className="font-title font-semibold text-neutral-100">Progressão e Experiência</p>
            <ul className="mt-2 space-y-1 font-body text-sm text-neutral-500 leading-relaxed">
              <li>Nível máximo: 125</li>
              <li>Experiência concedida pelo mestre após marcos importantes da campanha</li>
              <li>Crescimento progressivo, baseado na narrativa principal</li>
            </ul>
          </GlowCard>
          <GlowCard contentClassName="p-5 text-center">
            <p className="font-title font-semibold text-neutral-100">Energia</p>
            <p className="mt-2 font-body text-sm text-neutral-500 leading-relaxed">
              Recurso vital que permite aos Vigias manipularem seus elementos, convertida em
              energia elemental para o uso de habilidades.
            </p>
          </GlowCard>
          <GlowCard contentClassName="p-5 text-center">
            <p className="font-title font-semibold text-neutral-100">Penalidades</p>
            <p className="mt-2 font-body text-sm text-neutral-500 leading-relaxed">
              Debuffs situacionais do mestre que afetam rolagens — Lentidão, Pavor, Sufocamento e
              outros status negativos contextuais.
            </p>
          </GlowCard>
          <GlowCard contentClassName="p-5 text-center">
            <p className="font-title font-semibold text-neutral-100">Perícias Passivas</p>
            <p className="mt-2 font-body text-sm text-neutral-500 leading-relaxed">
              Habilidades passivas desbloqueadas ao longo da campanha, distribuídas uniformemente
              entre os jogadores conforme o caminho de cada um.
            </p>
          </GlowCard>
        </div>
      </div>
    </div>
  )
}

function Ficha() {
  const sections = [
    {
      title: 'Informações Básicas',
      items: ['Nome, Classe, Nível', 'Título — como o mundo reconhece o personagem', 'Vulto — aparência física do personagem'],
    },
    {
      title: 'Atributos',
      items: ['Base — pontos de vida e energia máximos', 'Atuais — valores modificáveis durante as sessões'],
    },
    {
      title: 'Economia',
      items: ['Créditos — moeda padrão para aprimoramentos, informações e itens', 'Cifras — moedas raras codificadas para evoluir super habilidades'],
    },
    {
      title: 'Sistema de Habilidades',
      items: ['Habilidades Base — três habilidades iniciais de classe', 'Habilidades Sintéticas — criadas pelos jogadores, sem limite'],
    },
    {
      title: 'Equipamentos',
      items: ['Armadura, Item de Classe, Arma', 'Inventário — slots expansíveis'],
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sections.map((section) => (
        <GlowCard key={section.title} contentClassName="p-5 text-center">
          <p className="font-title font-semibold text-neutral-100">{section.title}</p>
          <ul className="mt-2 space-y-1 font-body text-sm text-neutral-500 leading-relaxed">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </GlowCard>
      ))}
    </div>
  )
}

// Sequência da página: título -> (descrição + abas) -> conteúdo da aba.
const TABS_FADE_S = 0.8

export default function Codex() {
  const [active, setActive] = useState<CategoryId>('visao-geral')
  const [tabsVisible, setTabsVisible] = useState(false)
  const [contentUnlocked, setContentUnlocked] = useState(false)

  useEffect(() => {
    if (!tabsVisible) return
    const t = setTimeout(() => setContentUnlocked(true), TABS_FADE_S * 1000)
    return () => clearTimeout(t)
  }, [tabsVisible])

  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <BlurText
            text="Codex"
            delay={60}
            animateBy="chars"
            direction="top"
            className="justify-center font-title font-bold text-[35px] md:text-[41px]"
            onAnimationComplete={() => setTabsVisible(true)}
          />
        </div>

        <div
          style={{
            opacity: tabsVisible ? 1 : 0,
            transform: tabsVisible ? 'translateY(0)' : 'translateY(16px)',
            transition: `opacity ${TABS_FADE_S}s cubic-bezier(0.16,1,0.3,1), transform ${TABS_FADE_S}s cubic-bezier(0.16,1,0.3,1)`,
          }}
        >
          <p className="mx-auto mt-4 max-w-2xl text-center font-body text-neutral-400">
            Enciclopédia navegável do universo — construída a partir do manual do jogador de
            Declínio da Luz.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-2 border-b border-neutral-900 pb-6">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActive(cat.id)}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 font-body text-sm transition-all duration-300 ${
                  active === cat.id
                    ? 'bg-white text-neutral-950'
                    : 'border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-white'
                }`}
              >
                <cat.icon size={15} strokeWidth={1.75} />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <Reveal key={active} active={contentUnlocked} className="mt-10 text-center">
          {active === 'visao-geral' && <VisaoGeral />}
          {active === 'elementos' && <Elementos />}
          {active === 'classes' && <Classes />}
          {active === 'sistema' && <Sistema />}
          {active === 'ficha' && <Ficha />}
        </Reveal>
      </div>
    </div>
  )
}
