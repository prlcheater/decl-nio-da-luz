import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Compass, Flame, ScrollText } from 'lucide-react'
import SplitText from '@/components/SplitText'
import Reveal from '@/components/Reveal'
import GlowCard from '@/components/GlowCard'
import GradientText from '@/components/GradientText'
import { ELEMENTS, CLASSES, ROADMAP } from '@/lib/gameData'

const SEASONS = [
  {
    label: 'Primeira Temporada',
    title: 'O Prólogo',
    status: 'Finalizada',
    year: '2025',
    statusGradient: ['#6ee7b7', '#10b981', '#047857'],
  },
  {
    label: 'Segunda Temporada',
    title: 'A Caça',
    status: 'Iniciando',
    year: '2026',
    statusGradient: ['#a78bfa', '#818cf8', '#6366f1'],
  },
] as const

// Timeline sequencial da Home, ancorada nos 3.3s de animação do título:
// título (0s) -> botões (2.9s) -> conteúdo abaixo do hero (3.7s, quando os botões terminam de aparecer)
const BUTTONS_START_MS = 2900
const BUTTONS_FADE_S = 0.8
const CONTENT_UNLOCK_MS = BUTTONS_START_MS + BUTTONS_FADE_S * 1000

function Hero({ onContentUnlock }: { onContentUnlock: () => void }) {
  const [buttonsVisible, setButtonsVisible] = useState(false)

  useEffect(() => {
    const buttonsTimer = setTimeout(() => setButtonsVisible(true), BUTTONS_START_MS)
    const contentTimer = setTimeout(onContentUnlock, CONTENT_UNLOCK_MS)
    return () => {
      clearTimeout(buttonsTimer)
      clearTimeout(contentTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="px-6 pt-24 pb-20 flex flex-col items-center text-center">
      <div className="min-h-[1.2em]">
        <SplitText
          text="DECLÍNIO DA LUZ"
          tag="h1"
          className="font-title font-bold text-5xl md:text-7xl tracking-wide"
          delay={70}
          duration={3.3}
          ease="power4.out"
          splitType="chars"
          clip={false}
          from={{ opacity: 0, y: 60, filter: 'blur(14px)' }}
          to={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          threshold={0.1}
          rootMargin="-100px"
          textAlign="center"
        />
      </div>

      <div
        className="mt-10 flex flex-wrap items-center justify-center gap-4"
        style={{
          opacity: buttonsVisible ? 1 : 0,
          transform: buttonsVisible ? 'translateY(0)' : 'translateY(18px)',
          transition: `opacity ${BUTTONS_FADE_S}s cubic-bezier(0.16,1,0.3,1), transform ${BUTTONS_FADE_S}s cubic-bezier(0.16,1,0.3,1)`,
        }}
      >
        <Link
          to="/codex"
          className="flex items-center gap-2 rounded-md bg-white px-6 py-3 font-body text-sm font-semibold text-neutral-950 transition-all duration-300 ease-out hover:bg-neutral-200 hover:scale-[1.03]"
        >
          Explorar o Codex
          <ArrowRight size={16} strokeWidth={2} />
        </Link>
        <Link
          to="/livro"
          className="flex items-center gap-2 rounded-md border border-neutral-700 px-6 py-3 font-body text-sm text-neutral-200 transition-all duration-300 ease-out hover:border-neutral-500 hover:text-white hover:scale-[1.03]"
        >
          Ler o Livro
        </Link>
      </div>
    </section>
  )
}

function RoadmapGrid({ active }: { active: boolean }) {
  return (
    <div className="mt-10">
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          {ROADMAP.map((stop) => (
            <linearGradient key={stop.order} id={`planet-gradient-${stop.order}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={stop.gradient[0]} />
              <stop offset="100%" stopColor={stop.gradient[1]} />
            </linearGradient>
          ))}
        </defs>
      </svg>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROADMAP.map((stop, i) => (
          <Reveal key={stop.order} active={active} delay={i * 60}>
            <GlowCard contentClassName="p-5">
              <div className="flex items-center gap-3">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/60">
                  <stop.icon size={26} strokeWidth={1.5} style={{ stroke: `url(#planet-gradient-${stop.order})` }} />
                </div>
                <div>
                  <span className="font-body text-xs text-neutral-500">Parada {stop.order}</span>
                  <p className="font-title font-semibold text-lg text-neutral-100">{stop.place}</p>
                </div>
              </div>
              <p className="mt-3 font-body text-sm text-neutral-500 leading-relaxed">{stop.conflict}</p>
            </GlowCard>
          </Reveal>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const [contentUnlocked, setContentUnlocked] = useState(false)

  return (
    <div className="flex flex-col">
      <Hero onContentUnlock={() => setContentUnlocked(true)} />

      {/* O UNIVERSO */}
      <section className="px-6 py-20 border-t border-neutral-900">
        <div className="mx-auto max-w-5xl">
          <Reveal active={contentUnlocked} className="mx-auto max-w-3xl text-center">
            <h2 className="font-title font-bold text-[35px] md:text-[41px]">O Universo</h2>
            <p className="mt-5 font-body text-neutral-400 leading-relaxed">
              No ano de 2220, a humanidade viveu o auge da Era Dourada a bordo da estação Pandora.
              Dois anos depois, o núcleo da estação cedeu — e explodiu. Da explosão nasceu a{' '}
              <span className="text-neutral-200">Matéria Negra</span>, um veneno estelar que se
              espalhou pelo sistema solar, corrompeu mundos e abriu caminho para forças que a
              humanidade nunca soube que existiam.
            </p>
            <p className="mt-4 font-body text-neutral-400 leading-relaxed">
              Mais de dois séculos depois, resta um único reduto: a{' '}
              <span className="text-neutral-200">Última Cidade</span>. É dali que o{' '}
              <span className="text-neutral-200">Firmamento</span> organiza os{' '}
              <span className="text-neutral-200">Vigias</span> — elementalistas capazes de
              manipular as forças fundamentais do universo — na última linha de defesa contra o
              colapso.
            </p>
            <Link
              to="/codex"
              className="mt-6 inline-flex items-center gap-1.5 font-body text-sm text-neutral-300 hover:text-white transition-colors duration-300"
            >
              Ver cosmologia completa no Codex
              <ArrowRight size={14} strokeWidth={2} />
            </Link>
          </Reveal>

          <Reveal
            active={contentUnlocked}
            delay={120}
            className="mx-auto mt-10 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2"
          >
            {SEASONS.map((season) => (
              <GlowCard key={season.label} contentClassName="p-6 text-center">
                <span className="font-body text-xs uppercase tracking-[0.2em] text-neutral-500">
                  {season.label}
                </span>
                <p className="mt-2 font-title font-bold text-2xl text-neutral-100">{season.title}</p>
                <div className="mt-4">
                  <GradientText
                    colors={[...season.statusGradient]}
                    animationSpeed={6}
                    showBorder={false}
                    className="font-body font-bold text-sm uppercase tracking-wide"
                  >
                    {season.status}
                  </GradientText>
                  <p className="mt-1.5 font-body text-xs text-neutral-600">{season.year}</p>
                </div>
              </GlowCard>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ELEMENTOS */}
      <section className="px-6 py-20 border-t border-neutral-900">
        <div className="mx-auto max-w-5xl">
          <Reveal active={contentUnlocked} className="mx-auto max-w-3xl text-center">
            <h2 className="font-title font-bold text-[35px] md:text-[41px]">Os Vigias e seus Elementos</h2>
            <p className="mt-4 font-body text-neutral-400 leading-relaxed">
              Cada Vigia controla um dos nove elementos primordiais do universo — forças que vão
              além da tecnologia e da razão. Oito são conhecidos entre os elementalistas. O nono é
              lenda.
            </p>
          </Reveal>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {ELEMENTS.map((el, i) => (
              <Reveal key={el.name} active={contentUnlocked} delay={i * 40}>
                <GlowCard>
                  <el.icon size={20} strokeWidth={1.5} className="text-neutral-400" />
                  <p className="mt-3 font-title font-semibold text-neutral-100">{el.name}</p>
                  <p className="font-body text-xs text-neutral-500 italic">{el.epithet}</p>
                  <p className="mt-2 font-body text-xs text-neutral-500 leading-relaxed">{el.desc}</p>
                  {el.restricted && (
                    <p className="mt-2 font-body text-[10px] uppercase tracking-wider text-neutral-400">
                      Elemento restrito
                    </p>
                  )}
                </GlowCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CLASSES */}
      <section className="px-6 py-20 border-t border-neutral-900">
        <div className="mx-auto max-w-5xl">
          <Reveal active={contentUnlocked} className="mx-auto max-w-3xl text-center">
            <h2 className="font-title font-bold text-[35px] md:text-[41px]">Classes</h2>
            <p className="mt-4 font-body text-neutral-400 leading-relaxed">
              Cinco caminhos táticos moldam como cada Vigia atua em campo. Nenhuma magia pura —
              apenas conversão de energia e manipulação científica da matéria.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {CLASSES.map((c, i) => (
              <Reveal key={c.name} active={contentUnlocked} delay={i * 60}>
                <GlowCard contentClassName="p-5">
                  <c.icon size={20} strokeWidth={1.5} className="text-neutral-400" />
                  <p className="mt-3 font-title font-semibold text-neutral-100">{c.name}</p>
                  <p className="mt-1.5 font-body text-sm text-neutral-500 leading-relaxed">{c.desc}</p>
                </GlowCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ROADMAP EXPRESSO ASTRAL */}
      <section className="px-6 py-20 border-t border-neutral-900">
        <div className="mx-auto max-w-5xl">
          <Reveal active={contentUnlocked} className="mx-auto max-w-3xl text-center">
            <div className="flex items-center justify-center gap-2 text-neutral-500">
              <Compass size={16} strokeWidth={1.75} />
              <span className="font-body text-xs uppercase tracking-[0.2em]">
                Temporada 1 · Expresso Astral
              </span>
            </div>
            <h2 className="mt-2 font-title font-bold text-[35px] md:text-[41px]">
              A Travessia entre Mundos
            </h2>
            <p className="mt-4 font-body text-neutral-400 leading-relaxed">
              Sete paradas, sete mundos corrompidos pela Matéria Negra. A rota que um grupo de
              Vigias percorreu pelo sistema solar em busca de sua origem — e da própria
              sobrevivência da humanidade.
            </p>
          </Reveal>

          <RoadmapGrid active={contentUnlocked} />

          <Reveal active={contentUnlocked} delay={200} className="text-center">
            <Link
              to="/livro"
              className="mt-[46px] inline-flex items-center gap-2 font-body text-base text-neutral-300 hover:text-white transition-colors duration-300"
            >
              Acompanhar a jornada completa no Livro
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* O LIVRO */}
      <section className="px-6 py-20 border-t border-neutral-900">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal active={contentUnlocked} className="flex flex-col items-center">
            <ScrollText size={22} strokeWidth={1.5} className="text-neutral-500" />
            <h2 className="mt-3 font-title font-bold text-[35px] md:text-[41px]">O Livro</h2>
            <p className="mt-5 font-body text-neutral-400 leading-relaxed">
              2446. Um chamado geral reúne quatro Vigias na Última Cidade para escoltar uma missão
              de recuperação até o Cosmódromo. A emboscada que quase os mata revela algo raro: um
              elementalista de <span className="text-neutral-200">Aura</span>, a luz que quase
              ninguém consegue manejar — e o primeiro fio de uma traição dentro do próprio
              Firmamento.
            </p>
            <Link
              to="/livro"
              className="mt-6 flex items-center gap-2 rounded-md border border-neutral-700 px-6 py-3 font-body text-sm text-neutral-200 transition-all duration-300 ease-out hover:border-neutral-500 hover:text-white hover:scale-[1.03]"
            >
              Ir para o Livro
              <ArrowRight size={16} strokeWidth={2} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-6 py-24 border-t border-neutral-900">
        <Reveal active={contentUnlocked} className="mx-auto max-w-xl flex flex-col items-center text-center">
          <Flame size={22} strokeWidth={1.5} className="text-neutral-500" />
          <h2 className="mt-3 font-title font-bold text-2xl md:text-3xl">
            Pronto para se tornar um Vigia?
          </h2>
          <p className="mt-3 font-body text-neutral-400">
            Crie sua ficha e junte-se à campanha na área do player.
          </p>
          <Link
            to="/player"
            className="mt-6 flex items-center gap-2 rounded-md bg-white px-6 py-3 font-body text-sm font-semibold text-neutral-950 transition-all duration-300 ease-out hover:bg-neutral-200 hover:scale-[1.03]"
          >
            Área do Player
            <ArrowRight size={16} strokeWidth={2} />
          </Link>
        </Reveal>
      </section>
    </div>
  )
}
