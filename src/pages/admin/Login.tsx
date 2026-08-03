import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, LogIn, Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import { obtenerSupabase } from '../../lib/supabase'

/* Mismo criterio de formato de correo que /registro: descarta correos claramente
   mal escritos antes de molestar al servidor. No comprueba que la cuenta exista
   —eso lo resuelve Supabase—, solo la forma. */
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const CLASE_INPUT =
  'w-full pl-12 pr-4 py-3.5 bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all'

export default function Login() {
  const navigate = useNavigate()
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  /* Solo texto propio y fijo, nunca el error crudo de Supabase: mostrar el
     detalle del backend filtraría si el correo existe (enumeración de cuentas). */
  const [error, setError] = useState('')
  /* Mientras verificamos si ya hay sesión no se pinta el formulario: evita el
     parpadeo del form antes de redirigir a /admin cuando ya hay sesión activa.
     Se calcula en el render (no con un setState en el efecto): sin credenciales
     no puede haber sesión, así que arrancamos mostrando el formulario. */
  const [verificando, setVerificando] = useState(() => obtenerSupabase() !== null)

  useEffect(() => {
    const supabase = obtenerSupabase()
    if (!supabase) return
    let montado = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!montado) return
        if (data.session) {
          navigate('/admin', { replace: true })
        } else {
          setVerificando(false)
        }
      })
      .catch(() => {
        if (montado) setVerificando(false)
      })
    return () => {
      montado = false
    }
  }, [navigate])

  const handleSubmit = async (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    /* Segunda barrera contra el doble envío (la primera es `disabled`): cubre un
       submit disparado con Enter mientras la petición vuela. */
    if (enviando) return

    const correoLimpio = correo.trim()
    if (!REGEX_CORREO.test(correoLimpio)) {
      setError('Escribe un correo electrónico válido.')
      return
    }
    if (!password) {
      setError('Escribe tu contraseña.')
      return
    }

    setEnviando(true)
    setError('')
    try {
      const supabase = obtenerSupabase()
      /* `obtenerSupabase()` devuelve null si el build salió sin credenciales: se
         trata como un fallo de acceso más, con el mismo mensaje genérico. */
      if (!supabase) {
        setError('Correo o contraseña incorrectos.')
        return
      }
      const { error: errorAuth } = await supabase.auth.signInWithPassword({
        email: correoLimpio,
        password
      })
      if (errorAuth) {
        /* Mensaje genérico a propósito: no distinguir "el correo no existe" de
           "la contraseña es incorrecta" evita filtrar qué cuentas hay dadas de
           alta. El objeto de error nunca llega al estado ni a la pantalla. */
        setError('Correo o contraseña incorrectos.')
        return
      }
      navigate('/admin', { replace: true })
    } catch {
      /* Sin logs: invariante de cero salida por consola en src/. */
      setError('Correo o contraseña incorrectos.')
    } finally {
      setEnviando(false)
    }
  }

  if (verificando) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-lqc-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    /* `relative` para colgar el logo de la esquina; no toca el centrado del formulario
       porque un hijo absoluto sale del flujo del flex. Se prefiere a `fixed` para que el
       logo scrollee con la página en pantallas bajas en vez de quedar flotando sobre el
       formulario. */
    <div className="relative min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white flex items-center justify-center px-6 py-16">
      {/* Logo de esquina, estilo navbar: es el ÚNICO de los dos que cuenta como navegación
          para un lector de pantalla. El nombre accesible vive en el <Link> (`aria-label`) y
          la imagen va con `alt=""` para no decir lo mismo dos veces.
          `-ml-2`/`-mt-2` compensan ópticamente el lienzo del PNG: «2 LQC.png» es cuadrado
          (2000×2000) pero su arte mide 1498×506 —ratio 2.96, apenas el 25% del alto—, así que
          la caja del <img> llega bastante antes que las letras y sin esto el logo se ve
          hundido y despegado del borde. Por lo mismo la altura es mayor que la del Header:
          `h-14 md:h-16` deja letras de ~14/16px, que es el tamaño al que el Header las
          muestra en su lockup junto a la copa. Ver AGENTS.md si algún día llega un PNG
          recortado: con arte a sangre esto vuelve a `h-9 md:h-11` y sin márgenes negativos. */}
      <Link
        to="/"
        aria-label="LQC, ir al inicio"
        className="absolute left-6 top-6 -ml-2 -mt-2 inline-block rounded-lg transition-transform duration-300 hover:scale-105 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lqc-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        <img
          src="/assets/2 LQC.png"
          alt=""
          className="h-14 md:h-16 w-auto object-contain drop-shadow-lg"
        />
      </Link>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* La copa también lleva a la home con el mouse, pero es DECORATIVA para lectores
              de pantalla: el logo de la esquina ya cubre esa navegación y repetirla dejaría
              tres enlaces al mismo destino en la lista.
              `tabIndex={-1}` no es opcional: un elemento enfocable dentro de un subárbol
              `aria-hidden` es una violación de ARIA. Los dos atributos van juntos o no va
              ninguno. */}
          <Link
            to="/"
            tabIndex={-1}
            aria-hidden="true"
            className="inline-block transition-transform duration-300 hover:scale-105"
          >
            <img
              src="/assets/LOGO COPA.png"
              alt=""
              className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-5 object-contain drop-shadow-lg"
            />
          </Link>
          <h1 className="text-3xl md:text-4xl font-extralight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-lqc-accent">
            Panel de administración
          </h1>
          <p className="text-gray-400 mt-3">Acceso exclusivo para administradores de LQC.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 shadow-lqc-lg space-y-6"
        >
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 bg-rose-950/30 border border-rose-500/40 rounded-xl p-4"
            >
              <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-200">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="correo" className="block text-sm text-gray-400 mb-2">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
              <input
                id="correo"
                name="correo"
                type="email"
                value={correo}
                onChange={(e) => {
                  setCorreo(e.target.value)
                  if (error) setError('')
                }}
                autoComplete="email"
                placeholder="tu@correo.com"
                className={CLASE_INPUT}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-gray-400 mb-2">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 pointer-events-none" />
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError('')
                }}
                autoComplete="current-password"
                placeholder="Tu contraseña"
                className={CLASE_INPUT}
              />
            </div>
          </div>

          {/* `disabled` + opacidad en vez de un bg-*: la regla base de index.css le
              pone un gradiente a todo <button> y las utilidades de Tailwind solo
              pisan background-color, no background-image. Con opacidad y
              cursor-not-allowed el estado se lee sin pelearse con el gradiente. */}
          <button
            type="submit"
            disabled={enviando}
            aria-busy={enviando}
            className={`w-full py-4 bg-gradient-to-r from-lqc-700 to-lqc-500 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-blue-900/30 flex items-center justify-center gap-3 ${
              enviando ? 'opacity-60 cursor-not-allowed' : 'hover:from-lqc-600 hover:to-lqc-400'
            }`}
          >
            {enviando ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Entrando…
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Entrar
              </>
            )}
          </button>
        </form>

        {/* Salida hacia el sitio público. `/admin/login` vive FUERA de LayoutPublico (ver
            App.tsx), así que esta pantalla no tiene Header ni Footer: sin este enlace, quien
            llegó desde el pie del sitio y no es admin no tiene más vuelta que el botón atrás
            del navegador.
            Enlace de TEXTO y no botón: el CTA de la tarjeta es el gradiente de «Entrar» a todo
            el ancho, y una segunda caja con fondo debajo le pelearía la jerarquía. Es el mismo
            par «acción primaria + escape» que ya resuelve ErrorBoundary.tsx, con su mismo
            tratamiento (gray-400 → lqc-accent en hover). Discreto no quiere decir tenue: sobre
            este fondo casi negro, gray-400 da ~8:1 de contraste, bastante por encima del
            mínimo AA, que es lo que hace falta para quien se equivocó de puerta.
            <Link> y no <a href>: acá la SPA está sana y una recarga completa volvería a bajar
            el bundle solo para ir a la home. Es el primer enlace declarativo del área de admin;
            lo demás usa navigate(), pero eso son REDIRECCIONES, no navegación del usuario.
            El color se pisa a propósito: index.css pinta todo <a> en #66a3ff. El anillo de foco
            es el patrón del resto del sitio porque index.css solo se lo da a los <button>.
            La flecha va como ícono y no como «←» literal: un lector de pantalla leería ese
            carácter como «flecha hacia la izquierda» antes del texto que ya lo dice.
            Fuera del <form> para no entrar en su `space-y-6` ni parecer un control más, y solo
            en esta rama: la de `verificando` es un spinner transitorio que redirige solo. */}
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-sm text-sm text-gray-400 hover:text-lqc-accent transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lqc-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
