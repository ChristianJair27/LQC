import { Component } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Captura errores de render de cualquier página (incluidos los chunks lazy que
 * fallan al cargar) para no dejar el sitio en blanco. Debe ser un class
 * component: no existe un hook equivalente.
 *
 * A propósito NO implementamos componentDidCatch: el invariante del repo prohíbe
 * escribir en el log del navegador (ver AGENTS.md), y el patrón habitual de
 * logueo de errores rompería esa regla. Tampoco guardamos el objeto de error más
 * allá de la bandera `hasError`: el fallback es genérico y no expone detalles
 * técnicos al usuario, mismo criterio que el banner de error de /registro.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 py-16 bg-gradient-to-b from-black via-gray-950 to-black text-gray-100 antialiased">
          <div className="mb-8 flex items-center justify-center w-20 h-20 rounded-full bg-blue-950/40 border border-lqc-accent/20 shadow-lqc">
            <AlertTriangle className="w-10 h-10 text-lqc-accent" />
          </div>

          <h1 className="text-4xl md:text-5xl font-extralight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-lqc-accent mb-4">
            Algo salió mal
          </h1>

          <p className="text-lg text-gray-300 max-w-md mx-auto mb-10 leading-relaxed">
            Ocurrió un problema al mostrar esta página. Recarga para volver a
            intentarlo.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-lqc-700 to-lqc-500 hover:from-lqc-600 hover:to-lqc-400 rounded-xl font-medium text-white shadow-lg shadow-blue-900/30 transition-all duration-300"
            >
              <RotateCw className="w-5 h-5" />
              Recargar página
            </button>

            <a
              href="/"
              className="text-sm text-gray-400 hover:text-lqc-accent transition-colors"
            >
              Volver al inicio
            </a>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
