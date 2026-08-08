import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Images, LogOut } from 'lucide-react'
import { obtenerSupabase } from '../../lib/supabase'
import ListaInscripciones from './ListaInscripciones'
import SubirGaleria from './SubirGaleria'

/* Las dos vistas del panel. El estado vive en memoria y NO en la URL, así que la sección
   se pierde al recargar — asumido para esta primera versión. Cuando haga falta que sea
   enlazable, el camino es una ruta hermana `/admin/galeria` dentro de la misma
   <RutaProtegida>, y este archivo pasa a ser el layout compartido.
   `ancho` por sección: el listado de inscripciones son tarjetas de texto y se lee mejor
   angosto; el formulario de galería, con su vista previa, respira un poco más. */
const SECCIONES = [
  {
    id: 'inscripciones',
    etiqueta: 'Inscripciones',
    icono: ClipboardList,
    titulo: 'Inscripciones',
    bajada: 'Desde aquí vas a administrar los registros de la liga.',
    ancho: 'max-w-4xl'
  },
  {
    id: 'galeria',
    etiqueta: 'Galería',
    icono: Images,
    titulo: 'Galería',
    bajada: 'Sube fotos para la galería pública del sitio.',
    ancho: 'max-w-3xl'
  }
] as const

type SeccionId = (typeof SECCIONES)[number]['id']

/* Pestaña. La base sin colores y cada variante COMPLETA, no apilando clases sobre una
   base que ya trae borde: dos utilidades del mismo grupo se resuelven por su orden en el
   CSS generado y no por el orden en el atributo, así que el borde apagado le ganaría al
   activo. Es la trampa que documenta BTN_PANEL_BASE en ListaInscripciones.tsx.
   `bg-none` desactiva el gradiente que index.css le pone a todo <button>; sin él los dos
   estados se pintarían idénticos, porque `bg-*` solo setea `background-color` y el
   gradiente vive en `background-image`. Los dos `hover:` matan el salto de -2px y el halo
   que `button:hover` dispara. */
const TAB_BASE =
  'bg-none inline-flex items-center gap-2 rounded-xl px-4 sm:px-5 py-2.5 text-sm font-sans font-medium tracking-normal ' +
  'transition-all duration-300 hover:[transform:none] hover:shadow-none'

/* El hover del inactivo se queda DELIBERADAMENTE por debajo del activo en los tres ejes
   —fondo, borde y texto—, que es el criterio que ya sigue el selector de temporadas de
   Torneos.tsx. Antes terminaba en `hover:bg-blue-950/40 hover:border-blue-600/60
   hover:text-white`: los tres convergían con el activo y, con el cursor encima de la
   pestaña que NO estaba seleccionada, las dos se veían casi iguales.
   Ahora el hover se queda un escalón atrás en cada eje (fondo /25 contra /60, borde
   blue-700/60 contra blue-500/70, texto gris claro contra blanco), así que sigue
   respondiendo al mouse sin poder confundirse nunca con la sección activa. */
const TAB_INACTIVA =
  `${TAB_BASE} bg-black/40 border border-blue-800/40 text-gray-300 hover:bg-blue-950/25 hover:border-blue-700/60 hover:text-gray-200`

const TAB_ACTIVA = `${TAB_BASE} bg-blue-950/60 border border-blue-500/70 text-white`

export default function Panel() {
  const navigate = useNavigate()
  const [correo, setCorreo] = useState('')
  const [cerrando, setCerrando] = useState(false)
  const [seccionId, setSeccionId] = useState<SeccionId>('inscripciones')

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

  /* Nunca es undefined: `seccionId` está tipado con los ids del propio array. El `?? ` es
     para que TypeScript no lo dé por opcional al buscar en una tupla `as const`. */
  const seccion = SECCIONES.find((s) => s.id === seccionId) ?? SECCIONES[0]

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

      {/* Selector de sección. Va en su propia banda bajo el encabezado y no dentro del
          <main>, para que quede claro que cambia TODO el contenido de abajo y no es un
          filtro de lo que se está viendo.
          `aria-pressed` porque el estado seleccionado se comunica solo con color; sin él,
          quien no lo percibe no tiene cómo saber qué pestaña está activa. */}
      <nav
        aria-label="Secciones del panel"
        className="border-b border-white/10 bg-black/20 backdrop-blur-sm"
      >
        <div className="container mx-auto flex flex-wrap gap-3 px-6 py-4">
          {SECCIONES.map((s) => {
            const Icono = s.icono
            const activa = s.id === seccionId
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSeccionId(s.id)}
                aria-pressed={activa}
                className={activa ? TAB_ACTIVA : TAB_INACTIVA}
              >
                <Icono className="h-4 w-4 shrink-0" />
                {s.etiqueta}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Contenido */}
      <main className="container mx-auto px-6 py-12 md:py-16">
        <div className={seccion.ancho}>
          <h1 className="text-3xl md:text-4xl font-extralight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-lqc-accent mb-3">
            {seccion.titulo}
          </h1>
          <p className="text-gray-400 mb-10">{seccion.bajada}</p>

          {/* Listado de equipos con su roster. Ya NO agrupa nada en el cliente: lee
              `equipos` con sus `jugadores` embebidos por el join.
              Se DESMONTA al cambiar de pestaña, y eso es lo que se quiere: al volver
              recarga el listado, así se ve lo que haya entrado mientras tanto. */}
          {seccionId === 'inscripciones' ? <ListaInscripciones /> : <SubirGaleria />}
        </div>
      </main>
    </div>
  )
}
