import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { obtenerSupabase } from '../../lib/supabase'

type EstadoSesion = 'verificando' | 'autenticado' | 'sin-sesion'

/* Protección solo de UI: oculta el panel a quien no tiene sesión. La seguridad
   real de los datos vendrá de la RLS de Supabase cuando exista el listado; acá
   no se guarda ningún "isAdmin" propio que dé una falsa sensación de seguridad,
   la sesión la maneja Supabase. */
export default function RutaProtegida({ children }: { children: ReactNode }) {
  /* Estado inicial calculado en el render, no con un setState dentro del efecto:
     sin credenciales arrancamos ya en "sin-sesion" (→ login, sin romper), y con
     cliente en "verificando" hasta que onAuthStateChange resuelva. Así el único
     setState vive en el callback asíncrono de la suscripción, no en el cuerpo
     del efecto (evita renders en cascada / la regla set-state-in-effect). */
  const [estado, setEstado] = useState<EstadoSesion>(() =>
    obtenerSupabase() ? 'verificando' : 'sin-sesion'
  )

  useEffect(() => {
    const supabase = obtenerSupabase()
    if (!supabase) return

    let montado = true
    /* Una sola fuente de verdad: onAuthStateChange emite INITIAL_SESSION al
       suscribirse (resuelve el estado inicial) y luego SIGNED_OUT / SIGNED_IN /
       TOKEN_REFRESHED si la sesión cambia o expira estando dentro. Usar además
       getSession() duplicaría la resolución inicial y abriría una carrera entre
       dos setState; con una sola fuente esa pisada no existe. El flag `montado`
       evita el set de estado tras desmontar. */
    const { data } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (!montado) return
      setEstado(session ? 'autenticado' : 'sin-sesion')
    })

    return () => {
      montado = false
      /* Desuscripción obligatoria: sin esto queda una fuga de listeners. */
      data.subscription.unsubscribe()
    }
  }, [])

  /* Nada de panel ni de redirect hasta resolver la sesión: sin flash del
     contenido protegido ni de un <Navigate> prematuro. */
  if (estado === 'verificando') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-lqc-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (estado === 'sin-sesion') {
    return <Navigate to="/admin/login" replace />
  }

  return <>{children}</>
}
