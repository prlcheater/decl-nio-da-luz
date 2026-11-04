import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { supabase, supabaseAuthless } from '@/lib/supabase'
import { usernameToEmail, pinToPassword } from '@/lib/authHelpers'
import { CLASSES, ELEMENTS } from '@/lib/gameData'
import { MAX_LEVEL, calculateEpMax, calculateHpMax } from '@/lib/diceEngine'
import Reveal from '@/components/Reveal'

type RefRow = { id: string; name: string }

const inputClass =
  'w-full rounded border border-neutral-700 bg-neutral-900 px-4 py-2.5 font-body text-neutral-100 placeholder:text-neutral-600 transition-colors duration-300 focus:border-neutral-500 focus:outline-none'
const labelClass = 'mb-1.5 block font-body text-xs uppercase tracking-wide text-neutral-500'

export default function CriarFicha() {
  const { isMestre, loading: authLoading } = useAuth()
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
      .then(({ data }) => {
        setClasses(data ?? [])
        if (data?.[0]) setClassId(data[0].id)
      })
    supabase
      .from('elements')
      .select('id, name')
      .order('name')
      .then(({ data }) => {
        setElements(data ?? [])
        if (data?.[0]) setElementId(data[0].id)
      })
  }, [])

  if (authLoading) return null
  if (!isMestre) return <Navigate to="/player" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim() || pin.length < 4) {
      setError('Preencha o nome do elementalista e um PIN de 4 dígitos.')
      return
    }

    setSubmitting(true)

    const { data: freed, error: freeError } = await supabase.rpc('free_up_username_if_orphaned', {
      p_username: name.trim(),
    })
    if (!freeError && freed === false) {
      setSubmitting(false)
      setError('Já existe uma ficha ativa com esse nome de elementalista.')
      return
    }

    const { data: signUpData, error: signUpError } = await supabaseAuthless.auth.signUp({
      email: usernameToEmail(name),
      password: pinToPassword(pin),
    })

    if (signUpError || !signUpData.user) {
      setSubmitting(false)
      setError(
        signUpError?.message.includes('already registered')
          ? 'Esse nome de elementalista já está em uso.'
          : 'Não deu pra criar o login. Tenta de novo.'
      )
      return
    }
    if (signUpData.user.identities && signUpData.user.identities.length === 0) {
      setSubmitting(false)
      setError('Esse nome de elementalista já está em uso.')
      return
    }

    const userId = signUpData.user.id

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({ id: userId, username: name.trim(), role: 'player' })

    if (profileError) {
      setSubmitting(false)
      setError('Login criado, mas o perfil falhou: ' + profileError.message)
      return
    }

    const hpMax = calculateHpMax({ resistance: 0, level })
    const epMax = calculateEpMax({ intellect: 0, level })

    const { data: character, error: characterError } = await supabase
      .from('characters')
      .insert({
        user_id: userId,
        name: name.trim(),
        title: title.trim() || null,
        class_id: classId || null,
        element_id: elementId || null,
        level,
        hp_current: hpMax,
        ep_current: epMax,
        status: 'active',
      })
      .select('id')
      .single()

    setSubmitting(false)

    if (characterError || !character) {
      setError('Perfil criado, mas a ficha falhou: ' + characterError?.message)
      return
    }

    navigate(`/player/ficha/${character.id}`)
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <Reveal>
        <h1 className="font-title font-bold text-3xl">Criar Ficha</h1>
        <p className="mt-2 font-body text-sm text-neutral-500">
          Isso cria o login do jogador (nome do elementalista + PIN) e a ficha juntos.
        </p>
      </Reveal>

      <Reveal delay={100}>
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label className={labelClass} htmlFor="name">Nome do Elementalista</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Veigas Di Cadmus"
              className={inputClass}
              required
            />
          </div>

          <div>
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
                {classes.length === 0 && <option value="">carregando...</option>}
                {(classes.length ? classes : CLASSES.map((c) => ({ id: '', name: c.name }))).map((c) => (
                  <option key={c.name} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="element">Elemento</label>
              <select id="element" value={elementId} onChange={(e) => setElementId(e.target.value)} className={inputClass}>
                {elements.length === 0 && <option value="">carregando...</option>}
                {(elements.length ? elements : ELEMENTS.map((el) => ({ id: '', name: el.name }))).map((el) => (
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
            disabled={submitting}
            className="mt-2 rounded bg-white px-4 py-2.5 font-body font-semibold text-neutral-950 transition-colors duration-300 hover:bg-neutral-200 disabled:opacity-50"
          >
            {submitting ? 'Criando...' : 'Criar Ficha'}
          </button>
        </form>
      </Reveal>
    </div>
  )
}
