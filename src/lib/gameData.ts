import {
  Zap,
  Leaf,
  Wind,
  Snowflake,
  Mountain,
  Flame,
  Droplets,
  MoonStar,
  Sun,
  SportShoe,
  Shield,
  Waypoints,
  HeartPulse,
  Cpu,
  Earth,
  Eclipse,
  Moon,
  Circle,
  type LucideIcon,
} from 'lucide-react'

export type ElementEntry = {
  name: string
  epithet: string
  desc: string
  icon: LucideIcon
  restricted?: boolean
  /** Par de cores do gradiente do ícone (definido por elemento, sob demanda). */
  gradient?: [string, string]
}

export type ClassEntry = {
  name: string
  desc: string
  icon: LucideIcon
}

export type TraitEntry = {
  name: string
  desc: string
}

export type RoadmapStop = {
  order: number
  place: string
  conflict: string
  icon: LucideIcon
  /** Par de cores do gradiente do ícone, do início ao fim. */
  gradient: [string, string]
}

// Fonte: MANUAL DO JOGADOR — seção 3 (Os Elementos Primordiais)
export const ELEMENTS: ElementEntry[] = [
  { name: 'Élix', epithet: 'o raio', desc: 'Poder e velocidade elétrica.', icon: Zap, gradient: ['#8B5CF6', '#6D28D9'] },
  { name: 'Gaia', epithet: 'a natureza', desc: 'Preservação e crescimento.', icon: Leaf, gradient: ['#22C55E', '#BEF264'] },
  { name: 'Galeo', epithet: 'o vento', desc: 'Liberdade e movimento.', icon: Wind, gradient: ['#06B6D4', '#67E8F9'] },
  { name: 'Glácis', epithet: 'o gelo', desc: 'Estabilidade e controle.', icon: Snowflake, gradient: ['#7DD3FC', '#F0F9FF'] },
  { name: 'Granite', epithet: 'a terra', desc: 'Solidez e resistência.', icon: Mountain, gradient: ['#E3C88A', '#B08D57'] },
  { name: 'Ignis', epithet: 'o fogo', desc: 'Poder bruto e transformação.', icon: Flame, gradient: ['#E34234', '#FF3B30'] },
  { name: 'Marine', epithet: 'a água', desc: 'Fluidez e adaptação.', icon: Droplets, gradient: ['#3B82F6', '#1E3A8A'] },
  { name: 'Umbra', epithet: 'a escuridão', desc: 'Mistério e ocultação.', icon: MoonStar, gradient: ['#C0C0C0', '#71717A'] },
  {
    name: 'Aura',
    epithet: 'a luz',
    desc: 'Elemento de potencial supremo, disponível apenas para pouquíssimos usuários devido ao seu imenso poder.',
    icon: Sun,
    restricted: true,
    gradient: ['#D4AF37', '#F5E1A4'],
  },
]

// Fonte: MANUAL DO JOGADOR — seção 4 (Classes dos Vigias)
export const CLASSES: ClassEntry[] = [
  { name: 'Velocista', desc: 'Assassino especializado em ataques rápidos e eliminação de alvos específicos.', icon: SportShoe },
  { name: 'Sentinela', desc: 'Tanque defensivo, focado em proteção e resistência.', icon: Shield },
  { name: 'Marionetista', desc: 'Manipulador que controla o campo de batalha e adversários.', icon: Waypoints },
  { name: 'Suporte', desc: 'Especialista em apoio tático e fortalecimento de aliados.', icon: HeartPulse },
  { name: 'Arcano', desc: 'Mago tecnológico que combina ciência avançada com manipulação elemental.', icon: Cpu },
]

// Fonte: MANUAL DO JOGADOR — seção 2.1 (Estrutura dos Traços)
export const TRAITS: TraitEntry[] = [
  { name: 'Ataque', desc: 'Força base que impacta diretamente no dano causado.' },
  { name: 'Resistência', desc: 'Capacidade de mitigar dano de ataques recebidos.' },
  { name: 'Agilidade', desc: 'Governa movimentação e velocidade de ações.' },
  { name: 'Intelecto', desc: 'Essencial para criar habilidades, resolver códigos, decifrar enigmas e executar hacks rápidos.' },
  { name: 'Carisma', desc: 'Determina como NPCs e outras figuras do mundo interpretam e reagem ao personagem.' },
]

// Fonte: manual do mestre — Roadmap do Expresso Astral (Temporada 1)
export const ROADMAP: RoadmapStop[] = [
  {
    order: 1,
    place: 'Terra',
    conflict: 'Primeira parada da jornada: o grupo enfrenta a Rainha Bruxa Necrófaga Nirlith em meio às ruínas da Última Cidade.',
    icon: Earth,
    gradient: ['#22c55e', '#0d9488'],
  },
  {
    order: 2,
    place: 'Vênus',
    conflict: 'Kayatl e Zephyra, filhas do imperador profano, disputam o controle do planeta vulcânico e testam a aliança do grupo.',
    icon: Eclipse,
    gradient: ['#facc15', '#a16207'],
  },
  {
    order: 3,
    place: 'Lua',
    conflict: 'Caronte, um experimento fractal nascido de carne humana corrompida, guarda segredos sobre a origem da Matéria Negra.',
    icon: Moon,
    gradient: ['#ffffff', '#a3a3a3'],
  },
  {
    order: 4,
    place: 'Marte',
    conflict: 'No Mundo Trono, Dravarthum — um profano ancestral e bruxo — governa como um deus caído entre ruínas vermelhas.',
    icon: Earth,
    gradient: ['#e34234', '#f97316'],
  },
  {
    order: 5,
    place: 'Saturno',
    conflict: 'O Imperador Profano lança seu exército e a temida Mente Bélica contra a humanidade nos anéis gelados de Saturno.',
    icon: Eclipse,
    gradient: ['#e0d5b8', '#fde68a'],
  },
  {
    order: 6,
    place: 'Urano',
    conflict: 'A ganância humana de Maxmilian Gold criou o Mundo dos Sonhos — uma prisão de ilusões para mentes cativas.',
    icon: Circle,
    gradient: ['#7dd3fc', '#e0f2fe'],
  },
  {
    order: 7,
    place: 'Europa',
    conflict: 'Nos destroços de um antigo centro tecnológico, o grupo enfrenta O Observador na batalha final da temporada.',
    icon: Moon,
    gradient: ['#bae6fd', '#cbd5e1'],
  },
]

export const GRADIENT_COLORS = ['#5227FF', '#FF9FFC', '#B497CF']
