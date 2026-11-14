import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

// Evita a "tela preta": se uma tela quebrar, mostra a mensagem e permite tentar de novo.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Erro na interface:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-2xl px-6 py-24 text-center">
          <h1 className="font-title font-bold text-2xl">Algo deu errado nesta tela</h1>
          <p className="mt-3 break-words font-body text-sm text-red-300">{this.state.error.message}</p>
          <button onClick={() => this.setState({ error: null })} className="mt-6 rounded bg-white px-5 py-2 font-body text-sm font-semibold text-neutral-950">Tentar de novo</button>
          <p className="mt-4 font-body text-xs text-neutral-500">Se persistir, copie esta mensagem para o desenvolvedor.</p>
        </div>
      )
    }
    return this.props.children
  }
}
