// Componentes React Bits são gerados como .jsx sem tipagem própria;
// tratamos como componentes de props livres em vez de inferir da implementação JS.
declare module '@/components/SplitText' {
  import type { ComponentType } from 'react'
  const SplitText: ComponentType<Record<string, unknown>>
  export default SplitText
}

declare module '@/components/BlurText' {
  import type { ComponentType } from 'react'
  const BlurText: ComponentType<Record<string, unknown>>
  export default BlurText
}

declare module '@/components/TextType' {
  import type { ComponentType } from 'react'
  const TextType: ComponentType<Record<string, unknown>>
  export default TextType
}

declare module '@/components/PixelBlast' {
  import type { ComponentType } from 'react'
  const PixelBlast: ComponentType<Record<string, unknown>>
  export default PixelBlast
}

declare module '@/components/GradientText' {
  import type { ComponentType } from 'react'
  const GradientText: ComponentType<Record<string, unknown>>
  export default GradientText
}

declare module '@/components/BorderGlow' {
  import type { ComponentType } from 'react'
  const BorderGlow: ComponentType<Record<string, unknown>>
  export default BorderGlow
}

declare module '@/components/CountUp' {
  import type { ComponentType } from 'react'
  const CountUp: ComponentType<Record<string, unknown>>
  export default CountUp
}
