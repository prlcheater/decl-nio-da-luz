import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usernameToEmail, pinToPassword } from '@/lib/authHelpers'
import { useAuth } from '@/lib/AuthContext'
import Reveal from '@/components/Reveal'

export default function Login() {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { session } = useAuth()

  // Navega só depois que o AuthContext realmente propagou a sessão nova —
  // navegar direto após o signInWithPassword resolver criava uma corrida onde
  // a próxima página renderizava antes do contexto saber que alguém tinha logado.
  // Vai pra área do player, que manda o mestre pro painel e o jogador pra ficha.
  // replace evita que o botão Voltar caia no login e seja redirecionado de novo.
  useEffect(() => {
    if (session) navigate('/player', { replace: true })
  }, [session, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password: pinToPassword(pin),
    })
    setLoading(false)
    if (error) {
      // 400 é credencial recusada; o resto é servidor fora do ar, rede ou limite
      // de tentativas, e culpar o PIN nesses casos só confunde.
      setError(
        error.status === 400
          ? 'Nome do Elementalista ou PIN incorretos.'
          : 'Não foi possível conectar ao servidor. Tente novamente em instantes.'
      )
    }
  }

  return (
    <div className="px-6 py-16 max-w-sm mx-auto">
      <Reveal>
        <h1 className="font-title font-bold text-3xl">Entrar</h1>
        <p className="mt-2 font-body text-sm text-neutral-500">
          Use o nome do seu Elementalista e o PIN que o mestre te passou.
        </p>
      </Reveal>

      <Reveal delay={100}>
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <div>
            <label
              htmlFor="username"
              className="mb-1.5 block font-body text-xs uppercase tracking-wide text-neutral-500"
            >
              Nome do Elementalista
            </label>
            <input
              id="username"
              type="text"
              placeholder="ex: Veigas Di Cadmus"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-4 py-2.5 font-body text-neutral-100 placeholder:text-neutral-600 transition-colors duration-300 focus:border-neutral-500 focus:outline-none"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label
              htmlFor="pin"
              className="mb-1.5 block font-body text-xs uppercase tracking-wide text-neutral-500"
            >
              PIN (4 dígitos)
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-4 py-2.5 font-body tracking-[0.5em] text-neutral-100 placeholder:tracking-normal placeholder:text-neutral-600 transition-colors duration-300 focus:border-neutral-500 focus:outline-none"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="font-body text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || pin.length < 4 || !username.trim()}
            className="mt-2 rounded bg-white px-4 py-2.5 font-body font-semibold text-neutral-950 transition-colors duration-300 hover:bg-neutral-200 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </Reveal>
    </div>
  )
}
