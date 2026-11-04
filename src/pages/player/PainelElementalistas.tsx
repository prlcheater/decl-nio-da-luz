import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Users, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import Reveal from '@/components/Reveal'
import GlowCard from '@/components/GlowCard'

type CharacterSummary = {
  id: string
  name: string
  title: string | null
  level: number
}

function FichaCard({ character, onDeleted }: { character: CharacterSummary; onDeleted: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.rpc('delete_character_with_login', { p_character_id: character.id })
    setDeleting(false)
    if (!error) onDeleted(character.id)
  }

  return (
    <GlowCard contentClassName="p-0">
      <div className="p-5">
        <Link to={`/player/ficha/${character.id}`} className="block">
          <p className="font-title font-semibold text-lg text-neutral-100">{character.name}</p>
          {character.title && <p className="font-body text-xs italic text-neutral-500">{character.title}</p>}
          <p className="mt-2 font-body text-xs text-neutral-500">Nível {character.level}</p>
        </Link>

        {confirming ? (
          <div className="mt-3 flex items-center gap-2 border-t border-neutral-800 pt-3">
            <span className="font-body text-xs text-neutral-400">Excluir de vez?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="ml-auto rounded bg-red-500/90 px-2.5 py-1 font-body text-xs font-semibold text-white transition-colors duration-300 hover:bg-red-500 disabled:opacity-50"
            >
              {deleting ? '...' : 'Sim'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded border border-neutral-700 px-2.5 py-1 font-body text-xs text-neutral-400 transition-colors duration-300 hover:text-white"
            >
              Não
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="mt-3 flex items-center gap-1.5 border-t border-neutral-800 pt-3 font-body text-xs text-neutral-600 transition-colors duration-300 hover:text-red-400"
          >
            <Trash2 size={12} strokeWidth={1.75} />
            Excluir ficha
          </button>
        )}
      </div>
    </GlowCard>
  )
}

export default function PainelElementalistas() {
  const { isMestre } = useAuth()
  const [characters, setCharacters] = useState<CharacterSummary[] | null>(null)

  useEffect(() => {
    if (!isMestre) return
    supabase
      .from('characters')
      .select('id, name, title, level')
      .order('name')
      .then(({ data, error }) => setCharacters(error ? [] : (data ?? [])))
  }, [isMestre])

  if (!isMestre) return <Navigate to="/player" replace />

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <Reveal className="flex items-start justify-between">
        <div>
          <h1 className="font-title font-bold text-3xl">Elementalistas</h1>
          <p className="mt-2 font-body text-neutral-400">Crie, edite ou remova qualquer ficha.</p>
        </div>
        <Link to="/player/mestre" className="font-body text-xs text-neutral-500 transition-colors duration-300 hover:text-white">
          ← Área do Mestre
        </Link>
      </Reveal>

      <Reveal delay={80}>
        <Link
          to="/player/ficha/criar"
          className="mt-6 flex w-fit items-center gap-2 rounded-md bg-white px-4 py-2.5 font-body text-sm font-semibold text-neutral-950 transition-all duration-300 ease-out hover:bg-neutral-200 hover:scale-[1.03]"
        >
          <Plus size={16} strokeWidth={2} />
          Criar Ficha
        </Link>
      </Reveal>

      <Reveal delay={140} className="mt-8">
        {characters === null ? (
          <p className="font-body text-sm text-neutral-500">Carregando...</p>
        ) : characters.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-800 p-10 text-center">
            <Users size={22} strokeWidth={1.5} className="mx-auto text-neutral-600" />
            <p className="mt-3 font-body text-sm text-neutral-500">Nenhuma ficha cadastrada ainda.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((c) => (
              <FichaCard
                key={c.id}
                character={c}
                onDeleted={(id) => setCharacters((prev) => (prev ? prev.filter((ch) => ch.id !== id) : prev))}
              />
            ))}
          </div>
        )}
      </Reveal>
    </div>
  )
}
