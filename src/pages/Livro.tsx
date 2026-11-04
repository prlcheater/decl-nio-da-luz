import { useState } from 'react'
import { BookText, Sparkles } from 'lucide-react'
import BlurText from '@/components/BlurText'
import Reveal from '@/components/Reveal'

export default function Livro() {
  const [titleDone, setTitleDone] = useState(false)

  return (
    <div className="px-6 py-16 flex flex-col items-center text-center min-h-[60vh] justify-center">
      <BlurText
        text="Livro"
        delay={60}
        animateBy="chars"
        direction="top"
        className="font-title font-bold text-[35px] md:text-[41px] justify-center"
        onAnimationComplete={() => setTitleDone(true)}
      />

      <Reveal active={titleDone} delay={150} className="mt-10 flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900/40">
          <BookText size={26} strokeWidth={1.5} className="text-neutral-500" />
        </div>
        <div className="mt-5 flex items-center gap-2 text-neutral-400">
          <Sparkles size={14} strokeWidth={1.75} />
          <span className="font-body text-xs uppercase tracking-[0.2em]">Em breve</span>
        </div>
        <p className="mt-3 max-w-md font-body text-neutral-500 leading-relaxed">
          Os capítulos de Declínio da Luz estão sendo preparados para publicação aqui. Volte em
          breve para acompanhar a jornada, temporada a temporada.
        </p>
      </Reveal>
    </div>
  )
}
