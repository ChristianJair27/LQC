import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { obtenerSupabase } from '../../lib/supabase'
import ListaInscripciones from './ListaInscripciones'

export default function Panel() {
  const navigate = useNavigate()
  const [correo, setCorreo] = useState('')
  const [cerrando, setCerrando] = useState(false)

  useEffect(() => {
    let montado = true
    const supabase = obtenerSupabase()
    if (!supabase) return
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (montado) setCorreo(data.session?.user.email ?? '')
      })
      .catch(() => {
        /* El correo es solo informativo (RutaProtegida ya garantiza la sesión):
           un fallo al leerlo no debe romper el panel. Sin logs. */
      })
    return () => {
      montado = false
    }
  }, [])

  const cerrarSesion = async () => {
    if (cerrando) return
    setCerrando(true)
    const supabase = obtenerSupabase()
    try {
      /* scope: 'local' borra solo la sesión de este navegador, sin la llamada de
         red de revocación que hace el 'global' por defecto. Esa llamada puede
         *colgarse* (no fallar: colgar) y dejar el await pendiente para siempre,
         con el botón trabado en "Cerrando…"; el catch cubre un rechazo, no un
         cuelgue. Con 'local' la salida es local e instantánea. */
      if (supabase) await supabase.auth.signOut({ scope: 'local' })
    } catch {
      /* Sin logs. Redirigimos igual: dejar al admin trabado en el panel sin
         poder salir sería peor que un cierre de sesión imperfecto. */
    } finally {
      navigate('/admin/login', { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white">
      {/* Encabezado del panel */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="container mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <div className="relative w-11 h-11 md:w-12 md:h-12 rounded-xl overflow-hidden bg-gradient-to-br from-blue-950 to-blue-900 border-2 border-blue-700/70 shadow-lqc flex items-center justify-center shrink-0">
              <img
                src="/assets/LOGO COPA.png"
                alt="LQC"
                className="w-9 h-9 md:w-10 md:h-10 object-contain p-0.5"
              />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-lg md:text-xl leading-tight">Panel LQC</p>
              {correo && <p className="text-sm text-gray-400 truncate">{correo}</p>}
            </div>
          </div>

          {/* Botón secundario: `bg-none` para desactivar el gradiente que la regla
              base de index.css aplica a todo <button>. */}
          <button
            type="button"
            onClick={cerrarSesion}
            disabled={cerrando}
            aria-busy={cerrando}
            className={`bg-none inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-black/50 border border-blue-800/40 text-gray-200 rounded-xl transition-all duration-300 shrink-0 ${
              cerrando
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:bg-blue-950/40 hover:border-blue-600/60 hover:text-white'
            }`}
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden sm:inline">{cerrando ? 'Cerrando…' : 'Cerrar sesión'}</span>
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="container mx-auto px-6 py-12 md:py-16">
        <div className="max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-extralight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-lqc-accent mb-3">
            Inscripciones
          </h1>
          <p className="text-gray-400 mb-10">
            Desde aquí vas a administrar los registros de la liga.
          </p>

          {/* Listado real de inscripciones, agrupado por equipo (Fase 2). */}
          <ListaInscripciones />
        </div>
      </main>
    </div>
  )
}
