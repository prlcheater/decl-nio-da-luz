import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  /** When false, content stays hidden and is not observed — used to gate reveals behind a page-level sequence. */
  active?: boolean
  trigger?: 'viewport' | 'mount'
}

export default function Reveal({ children, className = '', delay = 0, y = 20, active = true, trigger = 'viewport' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!active) return
    if (trigger === 'mount' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const frame = requestAnimationFrame(() => setInView(true))
      return () => cancelAnimationFrame(frame)
    }
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [active, trigger])

  const visible = active && inView

  const style: CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : `translateY(${y}px)`,
    transition: `opacity 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    willChange: 'opacity, transform',
  }

  return (
    <div ref={ref} className={'reveal ' + className} style={style}>
      {children}
    </div>
  )
}
