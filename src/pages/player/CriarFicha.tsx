import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase, supabaseAuthless } from '@/lib/supabase'
import { usernameToEmail, pinToPassword } from '@/lib/authHelpers'
import { MAX_LEVEL, calculateEpMax, calculateHpMax } from '@/lib/diceEngine'
import Reveal from '@/components/Reveal'

type RefRow = { id: string; name: string }

const inputClass =
  'w-full rounded border border-neutral-700 bg-neutral-900 px-4 py-2.5 font-body text-neutral-100 placeholder:text-neutral-600 transition-colors duration-300 focus:border-neutral-500 focus:outline-none'
const labelClass = 'mb-1.5 block font-body text-xs uppercase tracking-wide text-neutral-500'

export default function CriarFicha({ mode = 'player' }: { mode?: 'player' | 'self' | 'npc' }) {
  const { isMestre, session, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [classes, setClasses] = useState<RefRow[]>([])
  const [elements, setElements] = useState<RefRow[]>([])

  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [classId, setClassId] = useState('')
  const [elementId, setElementId] = useState('')
  const [level, setLevel] = useState(1)
  const [title, setTitle] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase
      .from('classes')
      .select('id, name')
      .order('name')
      .then(({ data, error }) => {
        if (error) setError('Não foi possível carregar classes e elementos. Recarregue a página.')
        setClasses(data ?? [])
        if (mode !== 'npc' && data?.[0]) setClassId(data[0].id)
      })
    supabase
      .from('elements')
      .select('id, name')
      .order('name')
      .then(({ data, error }) => {
        if (error) setError('Não foi possível carregar classes e elementos. Recarregue a página.')
        setElements(data ?? [])
        if (mode !== 'npc' && data?.[0]) setElementId(data[0].id)
      })
  }, [mode])

  if (authLoading) return null
  if (!isMestre) return <Navigate to="/player" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)

    if (!name.trim() || (mode === 'player' && pin.length !== 4)) {
      setError(mode === 'player' ? 'Preencha o nome e um PIN de 4 dígitos.' : 'Preencha o nome do personagem.')
      return
    }
    if (mode !== 'npc' && (!classId || !elementId)) {
      setError('Aguarde o carregamento da classe e do elemento.')
      return
    }
    setSubmitting(true)
    try {
      let userId: string | null = mode === 'self' ? session?.user.id ?? null : null
      if (mode === 'self') {
        if (!userId) throw new Error('Sua sessão expirou. Entre novamente.')
        const { data: existing, error: lookupError } = await supabase.from('characters')
          .select('id').eq('user_id', userId).eq('status', 'active').maybeSingle()
        if (lookupError) throw lookupError
        if (existing) {
          navigate('/player/ficha')
          return
        }
      }
      if (mode === 'player') {
        const { data: existing, error: lookupError } = await supabase.from('profiles')
          .select('id').eq('username', name.trim()).maybeSingle()
        if (lookupError) throw lookupError
        if (existing) throw new Error('Esse acesso já existe. Para a ficha do mestre, use Minha ficha.')

        const { data, error: signUpError } = await supabaseAuthless.auth.signUp({
          email: usernameToEmail(name),
          password: pinToPassword(pin),
        })
        if (signUpError || !data.user) throw new Error(
          signUpError?.message.includes('already registered')
            ? 'Esse nome de elementalista já está em uso.'
            : 'Não foi possível criar o login. Tente novamente.'
        )
        if (data.user.identities?.length === 0) throw new Error('Esse nome de elementalista já está em uso.')
        userId = data.user.id
        const { error: profileError } = await supabase.from('profiles')
          .insert({ id: userId, username: name.trim(), role: 'player' })
        if (profileError) throw new Error('Login criado, mas o perfil falhou: ' + profileError.message)
      }

      const { data: character, error: characterError } = await supabase.from('characters')
        .insert({
          user_id: userId,
          name: name.trim(),
          title: title.trim() || null,
          class_id: classId || null,
          element_id: elementId || null,
          level,
          hp_current: calculateHpMax({ resistance: 0, level }),
          ep_current: calculateEpMax({ intellect: 0, level }),
          status: 'active',
        })
        .select('id').single()
      if (characterError || !character) {
        throw new Error('Não foi possível criar a ficha: ' + (characterError?.message ?? 'resposta vazia'))
      }
      navigate(mode === 'self' ? '/player/ficha' : `/player/ficha/${character.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (cause as { message?: string })?.message ?? 'Não foi possível criar a ficha.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="character-sheet mx-auto max-w-lg px-6 py-16">
      <Reveal trigger="mount">
        <h1 className="font-title font-bold text-3xl">{mode === 'self' ? 'Minha ficha' : mode === 'npc' ? 'Criar NPC' : 'Criar Ficha'}</h1>
        <p className="mt-2 font-body text-sm text-neutral-500">
          {mode === 'self' ? 'Sua ficha fica vinculada ao seu acesso atual de mestre.' : mode === 'npc' ? 'Um personagem do mundo, com ficha completa e sem login próprio.' : 'Isso cria o login do jogador (nome do elementalista + PIN) e a ficha juntos.'}
        </p>
      </Reveal>

      <Reveal trigger="mount" delay={100}>
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label className={labelClass} htmlFor="name">{mode === 'npc' ? 'Nome do personagem' : 'Nome do Elementalista'}</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Veigas Di Cadmus"
              className={inputClass}
              required
            />
          </div>

          {mode === 'player' && <div>
            <label className={labelClass} htmlFor="pin">PIN (4 dígitos)</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className={`${inputClass} tracking-[0.5em] placeholder:tracking-normal`}
              required
            />
          </div>

          }

          <div>
            <label className={labelClass} htmlFor="title">Título (opcional)</label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="como o mundo reconhece o personagem"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="class">Classe</label>
              <select id="class" value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
                {mode === 'npc' && <option value="">Sem classe</option>}
                {classes.length === 0 && <option value="">carregando...</option>}
                {classes.map((c) => (
                  <option key={c.name} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="element">Elemento</label>
              <select id="element" value={elementId} onChange={(e) => setElementId(e.target.value)} className={inputClass}>
                {mode === 'npc' && <option value="">Sem elemento</option>}
                {elements.length === 0 && <option value="">carregando...</option>}
                {elements.map((el) => (
                  <option key={el.name} value={el.id}>{el.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="level">Nível</label>
            <input
              id="level"
              type="number"
              min={1}
              max={MAX_LEVEL}
              value={level}
              onChange={(e) => setLevel(Math.min(MAX_LEVEL, Math.max(1, Number(e.target.value) || 1)))}
              className={inputClass}
            />
            <p className="mt-1.5 font-body text-xs text-neutral-600">
              PV e PE iniciais são calculados automaticamente pelo nível ({calculateHpMax({ resistance: 0, level })} PV / {calculateEpMax({ intellect: 0, level })} PE).
            </p>
          </div>

          {error && <p className="font-body text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting || (mode !== 'npc' && (!classId || !elementId))}
            className="mt-2 rounded bg-white px-4 py-2.5 font-body font-semibold text-neutral-950 transition-colors duration-300 hover:bg-neutral-200 disabled:opacity-50"
          >
            {submitting ? 'Criando...' : mode === 'npc' ? 'Criar NPC' : 'Criar Ficha'}
          </button>
        </form>
      </Reveal>
    </div>
  )
}
