import { Link } from 'react-router-dom'
import { Twitch, Calendar, ChevronRight, UserPlus, IdCard } from 'lucide-react'
import { useState, useEffect } from 'react'

/* Mismo parche que Footer.tsx: React Router en modo declarativo no resetea el scroll y el
   proyecto no tiene <ScrollRestoration>, así que un <Link> pulsado con la página abajo
   aterriza en mitad del destino. Importa sobre todo para el CTA de más abajo, que se pulsa
   con la portada ya scrolleada. Va duplicado —es una línea— en vez de extraído a un módulo:
   si aparece un tercer lugar que lo necesite, ahí sí conviene el helper compartido. */
const irAlTope = () => window.scrollTo({ top: 0 })

/* Canon del CTA primario (AGENTS.md, "Canon del CTA primario"). Al ser un <a>/<Link> y no un
   <button> necesita dos cosas que la capa base de index.css no le da: `text-white` explícito
   —si no, `a { color: #66a3ff }` le pisa el texto y el contraste sobre azul se cae— y el
   anillo de foco, que index.css solo aplica a <button>. `after:hidden` mata la barra de
   gradiente de `a::after`, pensada para enlaces de texto, que en un botón queda colgando. */
/* `outline-hidden` y no `outline-none`: en Tailwind 4 `outline-none` compila a
   `outline-style: none` a secas, y como el anillo de foco es un `box-shadow` —que el modo de
   alto contraste forzado de Windows no pinta— el foco desaparecería del todo ahí.
   `outline-hidden` deja un outline transparente que ese modo sí convierte en visible. */
const CLASE_CTA_PRIMARIO =
  'after:hidden inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl ' +
  'bg-gradient-to-r from-lqc-700 to-lqc-500 hover:from-lqc-600 hover:to-lqc-400 ' +
  'font-medium text-white transition-all duration-300 shadow-lg shadow-blue-900/30 ' +
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lqc-accent/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-black'

/* Secundario. Ojo con `bg-none`: acá NO hace nada. El gradiente de la capa base que AGENTS.md
   manda desactivar en los secundarios vive en `button { background: var(--gradient-primary) }`
   (index.css:152) y esto es un <a>, al que la base solo le toca `color` y el `::after`
   (index.css:124-149). Queda puesto porque la constante es compartida y salva el día que
   alguien se la pegue a un <button>, que es el caso que el documento describe.
   Lo que sí hace falta en un <a> es `text-gray-200`, que pisa `a { color: #66a3ff }`. */
const CLASE_CTA_SECUNDARIO =
  'after:hidden inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl ' +
  'bg-none bg-black/40 border border-blue-800/40 text-gray-200 ' +
  'hover:bg-blue-950/40 hover:border-blue-600/60 hover:text-white ' +
  'font-medium transition-all duration-300 ' +
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lqc-accent/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-black'

/* Dominio que la IANA reserva para ejemplos y documentación (RFC 2606). Acá es el relleno
   de los patrocinadores cuyo sitio todavía no se consiguió. Hoy lo lleva 1 de los 9
   (Space Riders); llegó a ser 7 de 10, así que el número se mueve — no lo hardcodees. */
const DOMINIO_PLACEHOLDER = 'example.com'

/* Si una celda navega o no se decide por el VALOR de la url, no por una bandera en el
   array ni editando los datos. Es a propósito: el día que alguien reemplace un
   example.com por el sitio real, esa celda se vuelve enlace sola, sin tocar esta lógica
   ni acordarse de que existe.
   Se compara por HOSTNAME y no por cadena exacta para que no se escape una variante
   —`http://`, una barra final, `www.`, un subdominio—: cualquiera de esas seguiría siendo
   el placeholder y la celda igual llevaría al sitio de la IANA. Y se compara con
   `endsWith('.example.com')` y no con `includes`, para no confundir a un
   `notexample.com` o a un `example.com.mx`, que son dominios distintos y reales.
   El filtro de protocolo es un guardarraíl, no una formalidad. Hoy no hace falta: todas
   las urls del array son https. Pero esta función es una REGLA sobre datos que se van a
   editar —ese es todo su propósito—, y `new URL('javascript:alert(1)')` no lanza y
   devuelve hostname vacío, así que sin el filtro pasaría el control y ese valor terminaría
   como `href` renderizado. Aceptar solo http/https cuesta dos líneas y cierra la puerta
   antes de que alguien pegue lo que le mandaron por WhatsApp.
   Una url vacía, con otro esquema o que el parser no entienda tampoco enlaza: un href
   roto es peor que ninguno, y la celda igual muestra el logo y el nombre. */
function tieneSitioReal(url: string): boolean {
  try {
    const destino = new URL(url)
    if (destino.protocol !== 'https:' && destino.protocol !== 'http:') return false
    const host = destino.hostname.toLowerCase().replace(/^www\./, '')
    if (!host) return false
    return host !== DOMINIO_PLACEHOLDER && !host.endsWith(`.${DOMINIO_PLACEHOLDER}`)
  } catch {
    return false
  }
}

/* Celda del muro de patrocinadores, en dos capas.
   BASE es todo lo que define cómo se ve la celda EN REPOSO, y la comparten las dos formas
   —la que navega y la que no— para que sean indistinguibles hasta que alguien interactúe.
   Sin `group`: esa clase es lo que engancha el `group-hover:` del nombre, que vive en el
   contenido compartido y no acá. Dejarla afuera de la base es lo que hace que una celda
   sin sitio no reaccione al pasar el mouse. No alcanza con quitarle las clases `hover:` a
   este contenedor: mientras siga siendo `.group`, el nombre se aclara igual. */
const CLASE_CELDA_PATROCINADOR_BASE =
  'flex flex-col items-center rounded-2xl border border-white/5 ' +
  'bg-white/[0.02] p-5 md:p-6 transition-colors duration-300'

/* ENLACE agrega lo que solo tiene sentido si la celda navega: el `group` que enciende el
   hover del nombre, el hover del propio marco y el anillo de foco.
   El <a> ES la celda entera —no un enlace chico dentro de una tarjeta—: es lo que se
   espera de un muro de logos y de paso da un área de toque cómoda en móvil, donde cada
   celda mide media pantalla de ancho.
   Dos cosas que la capa base de index.css obliga a desactivar o reponer en cualquier <a>
   que no sea un enlace de texto: `after:hidden` mata la barra de gradiente que `a::after`
   dibuja al 100% del ancho en hover —acá cruzaría la tarjeta por debajo— y el anillo de
   foco va explícito porque index.css se lo da a <button> y no a <a>.
   Hay una tercera, y no está en ninguna de estas dos constantes: la regla `a` también
   trae `color: #66a3ff` y `font-weight: 500`, que se HEREDAN al texto de adentro. Las dos
   las neutraliza el <span> del nombre, en `contenido`, con `text-gray-400 font-medium`.
   Vive ahí y no acá porque tiene que aplicarse igual a las celdas que NO son <a>: es lo
   que las hace indistinguibles en reposo.
   El hover es deliberadamente chico: se ilumina el marco (borde y fondo) y se aclara el
   nombre. El LOGO no participa —ver el comentario de la <img>—: quedaría atenuado de
   forma permanente en las celdas que no enlazan. Nada de `scale` ni de saltos: son marcas,
   no llamados a la acción, y con 10 o 20 celdas cualquier movimiento grande convierte la
   sección en un tembladeral. */
const CLASE_CELDA_PATROCINADOR_ENLACE =
  `group after:hidden ${CLASE_CELDA_PATROCINADOR_BASE} ` +
  'hover:border-blue-500/30 hover:bg-white/[0.04] ' +
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lqc-accent/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-black'

/* Los logos vienen en proporciones muy distintas —hoy 7 de 9 son cuadrados y los otros dos
   apaisados, hasta 3.5:1—, así que se normalizan por ALTURA: caja de alto fijo +
   `object-contain`. Con eso ninguno se deforma, ninguno pasa de la franja vertical y todas
   las filas alinean. Sin el alto fijo pasaría lo contrario de lo que uno teme: los que se
   comerían la celda serían los CUADRADOS, que al escalar por ancho crecerían hasta el alto
   de la columna, mientras el apaisado quedaría como el más chico.
   Lo que la altura fija NO hace es igualar el área: un logo 3.5:1 llega al ancho completo
   y el cuadrado no, así que sigue habiendo alguno más presente. Igualar eso de verdad
   pediría recortar o normalizar los archivos, que es trabajo de diseño y no de layout.
   La caja mantiene su alto aunque la <img> se oculte, que es lo que pasa cuando el archivo
   no carga: así la fila no se desalinea y el nombre no salta hacia arriba. */
const ALTO_LOGO_PATROCINADOR = 'h-14 md:h-16'

const sponsors = [
  /* Las redes sociales van sin parámetros de sesión: el `?hl=es` que Instagram agrega a
     los perfiles es el idioma de QUIEN copió el enlace, no parte de la dirección. */
  { id: 1, name: 'Yuri Japonesa', logo: '/sponsors/YuriJaponesa.png', url: 'https://www.instagram.com/yurijaponesa/' },
  { id: 2, name: 'TableTop', logo: '/sponsors/5 Tabletop.png', url: 'https://www.facebook.com/tabletop.academy.tcg/' },
  { id: 3, name: 'Los Arcos CQ', logo: '/sponsors/6 Los Arcos CQ.png', url: 'https://cqarcos.com/' },
  { id: 4, name: 'Ser Sejuve', logo: '/sponsors/10 Ser Sejuve.png', url: 'https://queretaro.gob.mx/web/sejuve' },
  { id: 5, name: 'La Forja', logo: '/sponsors/8 La Forja.png', url: 'https://www.facebook.com/p/La-Forja-100087039951910/' },
  { id: 6, name: 'Queretaro Con Futuro', logo: '/sponsors/9 Queretaro Con Futuro.png', url: 'https://www.queretaro.gob.mx/' },
  /* El ÚNICO que sigue en el placeholder: Space Riders todavía no tiene sitio. Su celda se
     renderiza como <div> y no como <a> — ver `tieneSitioReal`. No la borres ni le pongas
     una url de relleno "que se parezca": el placeholder es la señal de que falta el dato. */
  { id: 7, name: 'Space Riders', logo: '/sponsors/7 Space Riders.png', url: 'https://example.com' },
  { id: 8, name: 'Revolution 505', logo: '/sponsors/LOGONUEVOREV.png', url: 'https://revolution505.com' },
  /* La url va con la ñ y NO en punycode (`xn--lapeadesantiago-1qb.com`). Son la misma
     dirección —el navegador codifica el hostname al navegar— pero esta es la que alguien
     puede leer y verificar de un vistazo. Ojo si algún día se toca: `new URL()` normaliza
     el hostname a punycode al parsear, así que `tieneSitioReal` compara contra la forma
     codificada. Da `true` igual: lo que se compara contra el placeholder es el hostname, y
     `xn--lapeadesantiago-1qb.com` tampoco lo es. */
  { id: 10, name: 'La Peña de Santiago', logo: '/sponsors/penaLogoNaran.jpeg', url: 'https://lapeñadesantiago.com/' },
  /* Va último y con `id: 9`, que era el único hueco de la secuencia —el array salta del 8 al
     10— así que no hace falta estrenar un 11. El id solo es la `key` de React; el orden lo da
     la posición en el array, no el número.
     Su logo es el ÚNICO que no vive en `/sponsors/`: es el mismo archivo que ya usa el botón
     del header, y duplicarlo en la otra carpeta serían 268 KB repetidos que el día que alguien
     reemplace la daga se actualizarían en un lado y en el otro no. La ruta absoluta desde
     `public/` funciona igual desde cualquier carpeta; lo que se pierde es la convención, y a
     cambio hay una sola fuente para el mismo logo.
     Sin tratamiento especial de ningún tipo: mismo objeto de cuatro campos que los otros
     nueve, así que hereda la misma tarjeta, la misma altura de logo y la misma decisión de
     `tieneSitioReal` —su url es https y no es el placeholder, así que la celda enlaza—. */
  { id: 9, name: 'ATAK.GG', logo: '/assets/logo-atakkgg.png', url: 'https://atakgg.revolution505.com/' },
]

/* Estado real del stream: lo responde la Edge Function `twitch-status`, que consulta la API
   de Twitch del lado del servidor y devuelve `{ online: boolean }`. Tiene que ser server-side
   porque la API de Twitch pide un token de app, y un token en el bundle es un token público.

   La URL se ARMA desde `VITE_SUPABASE_URL` en vez de escribir el host acá: es la misma
   variable que ya lee `src/lib/supabase.ts`, así que no hay dos lugares donde apunta el
   backend y un cambio de entorno no deja este fetch apuntando al viejo. La anon key sale de
   la misma variable que el cliente; es pública por diseño (ver el comentario de seguridad de
   `lib/supabase.ts`), lo que la contiene es RLS y la propia función.

   Sin credenciales en el build las dos quedan `undefined`: entonces `URL_ESTADO_STREAM` es
   null y no se consulta nada, igual que `obtenerSupabase()` devuelve null. El badge se queda
   apagado, que es el lado seguro. */
const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL
const CLAVE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
const URL_ESTADO_STREAM = URL_SUPABASE
  ? `${URL_SUPABASE.replace(/\/+$/, '')}/functions/v1/twitch-status`
  : null
/* Corte propio: `fetch` no trae timeout, y sin esto una función que no responde deja la
   petición colgada hasta que el navegador se aburra, encimándose con la del minuto siguiente. */
const CORTE_MS = 8000

/* Lo que ocupa el hueco del player cuando el canal NO está al aire.
   Reemplaza al iframe de Twitch, que en offline pinta su propio cartel gris —ajeno a la marca,
   en inglés y con la carátula del último VOD— justo debajo de un encabezado que dice
   «Transmisión en Vivo».
   Deliberadamente NO repite los horarios ni el botón «Ir al canal»: los dos ya están en la
   columna de la derecha, a la altura de este bloque en escritorio y a un scroll corto en
   móvil. Duplicarlos daría dos botones idénticos en la misma pantalla, y el día que se toque
   uno el otro queda distinto. Si algún día el sidebar se va, esto hay que revisarlo.
   Va como componente y no en línea porque la rama entera son ~35 líneas de decorado: dentro
   del ternario del player tapaba las otras dos ramas, que son las que hay que poder leer de un
   vistazo. Sin props: no depende de `twitchChannel` justamente porque no lleva el botón.
   Las cuatro capas de textura van con `aria-hidden`: son fondo, no contenido. El único texto
   real es el título y su línea de apoyo. */
function BloqueSinTransmision() {
  return (
    <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-lqc-900/60 via-black to-black">
      {/* Trama de puntos: el mismo motivo del fondo de la portada (más arriba en este archivo),
          para que el bloque se lea como parte del sitio y no como un cuadro pegado. */}
      <div
        className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:22px_22px]"
        aria-hidden="true"
      />
      {/* Franjas diagonales, el recurso de cualquier gráfica de esports. Al 8 % de un azul de
          la paleta: tiene que leerse como textura al pasar, no competir con el título. */}
      <div
        className="absolute inset-0 bg-[repeating-linear-gradient(115deg,transparent_0px,transparent_28px,rgba(0,102,255,0.08)_28px,rgba(0,102,255,0.08)_30px)]"
        aria-hidden="true"
      />
      {/* Halo azul detrás del texto: es lo que despega el título del fondo y da el volumen que
          un rectángulo plano no tiene. Sobredimensionado y centrado para que el degradado
          muera antes de llegar a los bordes y no se vea el corte. */}
      <div
        className="absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(0,102,255,0.25),transparent_65%)]"
        aria-hidden="true"
      />
      {/* Filo superior en degradado, el mismo gesto que la barra vertical del encabezado. */}
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lqc-accent/40 to-transparent"
        aria-hidden="true"
      />

      <div className="relative flex h-full flex-col items-center justify-center gap-3 px-6 text-center sm:gap-4">
        <span className="relative flex h-11 w-11 items-center justify-center rounded-full border border-lqc-accent/30 bg-lqc-900/60 shadow-lg shadow-lqc-500/20 sm:h-14 sm:w-14">
          {/* Anillo que respira. `animate-pulse-slow` es la utilidad del propio proyecto
              (index.css) y no el `animate-pulse` de Tailwind: 3 s en vez de 2 y sin bajar de
              0.7 de opacidad — acá es una señal de vida discreta, no un elemento cargando.
              La regla global de `prefers-reduced-motion` de index.css ya la desactiva sola. */}
          <span
            className="absolute inset-0 rounded-full border border-lqc-accent/20 animate-pulse-slow"
            aria-hidden="true"
          />
          <Twitch className="h-5 w-5 text-lqc-accent sm:h-7 sm:w-7" aria-hidden="true" />
        </span>

        {/* El <h3> toma Orbitron y el peso 700 de la regla base de index.css (h1–h6), que es la
            tipografía de títulos de la marca. NO subir a `font-extrabold` ni `font-black`: el
            index.html carga Orbitron hasta el 700 y `:root` tiene `font-synthesis: none`, así
            que un peso mayor no engrosaría nada — se pintaría igual y quedaría la clase
            mintiendo. El volumen sale del tamaño, las mayúsculas y el `tracking`.
            El texto va en minúsculas en el JSX y lo pone en caja alta el `uppercase`: así un
            lector de pantalla lee «Fuera de línea» y no deletrea las mayúsculas.
            `tracking` explícito porque la regla base de h1–h6 trae `-0.025em`, que en un título
            corto en caja alta apelmaza las letras — acá tiene que abrirse, no cerrarse.
            Escala verificada contra el caso más angosto: en 375 px la caja 16:9 mide 184 px de
            alto y ~279 px útiles de ancho, y con `text-2xl` el título entra en UNA línea. */}
        <h3 className="text-2xl uppercase tracking-[0.08em] bg-gradient-to-b from-white via-blue-100 to-lqc-accent bg-clip-text text-transparent sm:text-4xl sm:tracking-[0.14em] md:text-5xl">
          Fuera de línea
        </h3>

        <span
          className="h-px w-24 bg-gradient-to-r from-transparent via-lqc-accent/70 to-transparent sm:w-32"
          aria-hidden="true"
        />

        {/* Los días SÍ salen de `streamSchedule` (Martes y Jueves) — están escritos acá y no
            leídos del array porque esto es una frase, no una tabla: el sidebar ya muestra el
            dato completo con horarios. Si algún día cambian los días de transmisión, esta línea
            hay que tocarla a mano; es la razón de este comentario.
            No promete fecha, rival ni hora: nada de eso está confirmado en el repo. */}
        <p className="max-w-md text-xs text-gray-400 sm:text-sm">
          Transmitimos martes y jueves. Nos vemos en la próxima fecha.
        </p>
      </div>
    </div>
  )
}

export default function Home() {
  /* Tres estados, no dos. 'cargando' es el INICIAL y significa «todavía no sé».
     Existe desde que la sección renderiza cosas DISTINTAS según el estado: antes el player se
     pintaba igual estuviera al aire o no, así que arrancar en 'offline' no se notaba; ahora
     arrancar ahí mostraría el bloque de «fuera de línea» en cada carga de la portada, durante
     todo el viaje de ida y vuelta del fetch, para después saltar al player.
     Lo que NO cambia es la regla de fondo, que sigue siendo la de antes: ante la duda se cae a
     'offline' y nunca a 'online'. 'cargando' no la relaja porque no afirma nada —no dice «EN
     VIVO» ni «FUERA DE LÍNEA», solo pinta un esqueleto neutro— y el único camino a 'online'
     sigue siendo una respuesta explícita con `online === true`.
     Es un estado de arranque, no un ciclo: ninguna rama vuelve a 'cargando'. Las consultas
     siguientes del intervalo reemplazan un estado ya resuelto por otro, sin pasar por el
     esqueleto, así que el player no parpadea una vez por minuto. */
  const [streamStatus, setStreamStatus] = useState<'online' | 'offline' | 'cargando'>('cargando')
  const [] = useState('1.2K')
  const twitchChannel = "lqroc"
  
  const streamSchedule = [
    { day: 'Martes', time: '20:30 - 22:00', type: 'Grupos' },
    { day: 'Jueves', time: '21:00 - 22:00', type: 'Grupos' },
    
  ]

  useEffect(() => {
    /* `montado` antes de cada setState —el mismo patrón de Login.tsx y RutaProtegida.tsx—:
       la respuesta puede llegar después de que alguien se fue de la portada. */
    let montado = true
    let enVuelo: AbortController | null = null

    const consultarEstado = async () => {
      /* Build sin credenciales: no hay a quién preguntarle. No se dispara un fetch a
         `undefined/functions/...` que solo ensuciaría la consola de red.
         El setState SÍ hace falta desde que existe 'cargando', y es la única línea que este
         camino gana: sin él nadie resolvería el estado inicial y la portada se quedaría con el
         esqueleto girando para siempre —el preview local sin `.env` es exactamente ese caso—.
         Cae en 'offline', que es el mismo lado seguro que ya elegía antes por omisión. */
      if (!URL_ESTADO_STREAM || !CLAVE_ANON) {
        if (montado) setStreamStatus('offline')
        return
      }

      /* Aborta la anterior antes de lanzar la nueva: si una respuesta se demora más que el
         intervalo, no se apilan ni pueden resolverse fuera de orden y pisarse entre sí. */
      enVuelo?.abort()
      const propio = new AbortController()
      enVuelo = propio
      const corte = setTimeout(() => propio.abort(), CORTE_MS)

      try {
        const respuesta = await fetch(URL_ESTADO_STREAM, {
          headers: { Authorization: `Bearer ${CLAVE_ANON}` },
          signal: propio.signal
        })
        /* `fetch` NO rechaza por 4xx/5xx: sin este guard, un 500 con cuerpo HTML seguiría a
           .json(), y peor, un 200 vacío se leería como "sin online" en vez de como fallo. */
        if (!respuesta.ok) throw new Error(String(respuesta.status))
        const datos = (await respuesta.json()) as { online?: unknown }
        /* `=== true` y no un truthy: cualquier cosa que no sea exactamente el booleano true
           —undefined, null, la cadena "true", un JSON con otra forma— cae en 'offline'. */
        if (montado) setStreamStatus(datos?.online === true ? 'online' : 'offline')
      } catch {
        /* Todo lo que salga mal termina acá y siempre en el mismo lado: red caída, timeout,
           4xx/5xx, JSON inválido y el propio abort. Nunca deja el badge en 'online'.
           Sin logs: el invariante de cero salida por consola vale para todo `src/`. */
        if (montado) setStreamStatus('offline')
      } finally {
        clearTimeout(corte)
      }
    }

    consultarEstado()
    const interval = setInterval(consultarEstado, 60000)
    return () => {
      montado = false
      enVuelo?.abort()
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white">
      {/* Fondo decorativo sutil */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="h-full w-full bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:30px_30px]" />
        </div>
        <img
          src="/assets/LOGO COPA.png"
          alt="LQC Trophy Logo"
          className="
            absolute 
            -left-[60%] sm:-left-[40%] md:-left-[30%] lg:-left-[20%] xl:-left-[10%]
            top-[15%] sm:top-[10%]
            w-[120%] sm:w-[90%] md:w-[80%] lg:w-[70%] xl:w-[60%]
            max-w-none opacity-10
            animate-float-slow pointer-events-none blur-[2px]
          "
        />
      </div>

      {/* Contenido principal */}
      <div className="relative z-10">
        {/* Hero - más limpio y centrado */}
        <section className="py-32 md:py-40">
          <div className="container mx-auto px-6 max-w-5xl text-center">
            <div className="flex flex-col items-center gap-6">
              <div className="flex items-center justify-center gap-6 flex-wrap">
                <img
                  src="/assets/2 LQC.png"
                  alt="LQC Querétaro Logo"
                  className="h-24 md:h-32 w-auto object-contain drop-shadow-xl"
                />
                <img
                  src="/assets/LOGO COPA.png"
                  alt="Copa LQC"
                  className="h-20 md:h-28 w-auto object-contain drop-shadow-xl"
                />
              </div>
              
              <h1 className="text-5xl md:text-7xl font-extralight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-lqc-accent">
                League Querétaro
              </h1>
              
              <div className="inline-flex items-center gap-4 mt-4">
                <span className="px-5 py-2 text-base bg-blue-950/40 text-blue-300 backdrop-blur-sm border border-blue-800/30 rounded-full shadow-lg">
                  Otoño 2026
                </span>
              </div>

              {/* CTA principal de la portada. Antes el único enlace de acción de toda la
                  página mandaba a Twitch, o sea afuera del sitio: quien llegaba por la
                  campaña de inscripciones no tenía ni un camino a /registro.
                  <Link> y no <a href>: en una SPA el <a> fuerza una recarga completa del
                  documento aunque el destino sea correcto. */}
              {/* Agrupados con su propio gap: como hermanos sueltos heredaban el `gap-6` del
                  contenedor y la línea de apoyo quedaba flotando lejos del botón. */}
              {/* «Inscripciones abiertas» NO sale del repo —no hay nada acá que registre el
                  estado de la convocatoria—: es el mensaje de la campaña, confirmado por quien
                  administra el proyecto al pedir este cambio (2026-07-28). Se anota porque es
                  la única frase de la portada que un grep no puede corroborar, y porque el
                  formulario no tiene forma de cerrarse solo: el día que las inscripciones
                  cierren, esta línea hay que borrarla a mano. No agregar fechas, cupos ni
                  premios al lado, que eso sí sigue sin confirmarse. */}
              <div className="flex flex-col items-center gap-3">
                <Link
                  to="/registro"
                  onClick={irAlTope}
                  className={CLASE_CTA_PRIMARIO}
                >
                  <UserPlus className="w-5 h-5 shrink-0" aria-hidden="true" />
                  Registrarme
                  <ChevronRight className="w-5 h-5 shrink-0" aria-hidden="true" />
                </Link>
                <p className="text-sm text-gray-400">Inscripciones abiertas</p>
              </div>
            </div>
          </div>
        </section>

        {/* Transmisión en vivo - sin bordes duros */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
              <h2 className="text-3xl font-light">Transmisión en Vivo</h2>
              <div className={`px-4 py-1.5 text-sm rounded-full flex items-center gap-2 backdrop-blur-sm ${
                streamStatus === 'online' 
                  ? 'bg-green-950/50 text-green-300 border border-green-800/40' 
                  : 'bg-gray-900/50 text-gray-400 border border-gray-800/40'
              }`}>
                {/* El fondo del badge no distingue 'cargando' de 'offline' —los dos caen en la
                    rama gris de arriba— y está bien: lo que cambia entre esos dos estados es el
                    puntito, que en 'cargando' late, y la etiqueta, que en 'cargando' no está.
                    El latido va con `animate-pulse-slow` (la utilidad del proyecto, 3 s) y no
                    con el `animate-pulse` de Tailwind que usa 'online': el verde tiene que
                    llamar la atención, este gris solo indica que algo está pasando. */}
                <div className={`w-3 h-3 rounded-full ${
                  streamStatus === 'online'
                    ? 'bg-green-400 animate-pulse'
                    : streamStatus === 'cargando'
                      ? 'bg-gray-500 animate-pulse-slow'
                      : 'bg-gray-500'
                }`} />
                {/* 'cargando' va SIN etiqueta, a propósito. Cualquier palabra acá dura los
                    milisegundos del fetch y se lee como un parpadeo, que es justo lo que el
                    tercer estado vino a sacar. Y una palabra tiene que ser falsa o vaga: el
                    badge todavía no sabe nada que decir.
                    Tampoco lleva `sr-only`: el esqueleto del player ya anuncia «Consultando el
                    estado de la transmisión», y repetirlo acá lo haría sonar dos veces.
                    Sin segundo hijo el `gap-2` del contenedor no aplica —solo separa elementos
                    existentes—, así que el puntito no queda con un hueco colgando al lado. */}
                {streamStatus === 'cargando' ? null : streamStatus === 'online' ? 'EN VIVO' : 'OFFLINE'}
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-10">
                <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-black/60 backdrop-blur-md border border-white/5">
                  {/* Tres ramas para el MISMO hueco 16:9, y por eso las tres llevan
                      `aspect-video`: así la columna mide igual en los tres estados y resolver
                      el estado no empuja el resto de la página.
                      El pie de la tarjeta (LQROC / Canal oficial / Idioma) queda AFUERA del
                      condicional a propósito: identifica al canal, y el canal existe transmita
                      o no. */}
                  {streamStatus === 'online' ? (
                    <div className="relative aspect-video">
                      <iframe
                        src={`https://player.twitch.tv/?channel=${twitchChannel}&parent=${window.location.hostname}&autoplay=true`}
                        height="100%"
                        width="100%"
                        allowFullScreen
                        className="border-0"
                        title="Twitch Stream"
                      />
                      {/* Este badge perdió su ternario, no su apariencia: la rama entera solo se
                          pinta con el canal al aire, así que la variante gris «⚪ OFFLINE» era
                          código muerto —nunca podría verse—. Lo que se ve en pantalla es
                          idéntico a lo que se veía antes en estado 'online'. */}
                      <div className="absolute top-4 left-4">
                        <div className="px-4 py-1.5 rounded-full text-sm font-medium shadow-lg bg-red-600 text-white">
                          🔴 EN VIVO
                        </div>
                      </div>
                    </div>
                  ) : streamStatus === 'cargando' ? (
                    /* Esqueleto NEUTRO. No dice «EN VIVO» ni «FUERA DE LÍNEA» porque en este
                       punto todavía no se sabe: cualquiera de las dos sería una afirmación que
                       la respuesta puede desmentir medio segundo después.
                       Sin texto visible —un cartel de "cargando" que dura 300 ms es ruido—;
                       lo que hay para un lector de pantalla va en el `sr-only`, y el resto es
                       decoración con `aria-hidden`. */
                    <div className="relative aspect-video bg-black/70">
                      <div
                        className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/5 via-white/2 to-transparent"
                        aria-hidden="true"
                      />
                      <div className="relative flex h-full items-center justify-center">
                        <span
                          className="h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-lqc-accent/70 sm:h-11 sm:w-11"
                          aria-hidden="true"
                        />
                        <span className="sr-only">Consultando el estado de la transmisión</span>
                      </div>
                    </div>
                  ) : (
                    <BloqueSinTransmision />
                  )}
                  <div className="p-5 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-lqc-900/40 to-blue-900/40 border border-lqc-accent/20 flex items-center justify-center">
                          <Twitch className="w-6 h-6 text-lqc-accent" />
                        </div>
                        <div>
                          <div className="font-medium">LQROC</div>
                          <div className="text-sm text-gray-400">Canal oficial LQC</div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 hidden sm:block">
                        Idioma: Español
                      </div>
                    </div>
                  </div>
                </div>

                {/* El chat desaparece ENTERO en offline —marco y encabezado incluidos—, no solo
                    el iframe: un cuadro rotulado «Chat de Twitch» con un panel vacío adentro es
                    peor que no tener la caja, el mismo criterio con el que se fueron los embeds
                    de Battlefy (ver el comentario más abajo).
                    En 'cargando' sí se conserva el marco, con un esqueleto en lugar del iframe.
                    Es a propósito: la mayoría de las visitas terminan en un estado u otro, y
                    dejando la caja puesta la transición a 'online' cambia el contenido sin mover
                    nada de lugar. Si termina en offline, la caja se va una sola vez. */}
                {streamStatus !== 'offline' && (
                  <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-black/40 backdrop-blur-md border border-white/5">
                    <div className="bg-gradient-to-r from-gray-900/60 to-gray-800/40 px-5 py-4">
                      <div className="font-medium">Chat de Twitch</div>
                    </div>
                    <div className="h-64 sm:h-80">
                      {streamStatus === 'online' ? (
                        <iframe
                          src={`https://www.twitch.tv/embed/${twitchChannel}/chat?parent=${window.location.hostname}&darkpopout`}
                          height="100%"
                          width="100%"
                          className="border-0"
                          title="Twitch Chat"
                        />
                      ) : (
                        <div
                          className="h-full animate-pulse bg-gradient-to-b from-white/4 to-transparent"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar sigue similar pero más limpio */}
              <div className="space-y-10">
                {/* Horario */}
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Calendar className="w-6 h-6 text-blue-400" />
                    <h3 className="text-xl font-medium">Horario de Transmisiones</h3>
                  </div>
                  <div className="space-y-4 bg-black/30 backdrop-blur-sm p-6 rounded-2xl border border-white/5">
                    {streamSchedule.map((schedule, i) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                        <div>
                          <div className="font-medium">{schedule.day}</div>
                          <div className="text-sm text-gray-400">{schedule.type}</div>
                        </div>
                        <div className="text-gray-300">{schedule.time}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ir al canal. Pasó de primario a SECUNDARIO: llevaba el gradiente del canon
                    —el que marca la acción principal de una pantalla— siendo el único CTA de
                    la portada, así que la acción más destacada del sitio mandaba a Twitch en
                    vez de al registro. Sigue acá y sigue siendo útil; lo que cambia es la
                    jerarquía. */}
                <div>
                  <a
                    href={`https://www.twitch.tv/${twitchChannel}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Ir al canal de Twitch de LQC (abre en pestaña nueva)"
                    className={`${CLASE_CTA_SECUNDARIO} w-full`}
                  >
                    <Twitch className="w-5 h-5 shrink-0" aria-hidden="true" />
                    Ir al canal de Twitch
                    <ChevronRight className="w-5 h-5 shrink-0" aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ACÁ NO HAY BRACKETS, STANDINGS NI "EQUIPOS INSCRITOS". Eran tres secciones con
            iframes de Battlefy y se fueron enteras —encabezado, caja y iframe—, no solo el
            iframe: un <h2> sobre un contenedor vacío es peor que no tener la sección.
            (Ubicación original, por si alguna se repone: Brackets y Standings iban justo acá;
            «Equipos Inscritos» NO, iba después de Patrocinadores.)
            Dos razones para que no vuelvan como estaban:
            1. La liga se muda a ATAK.GG. Battlefy deja de ser la fuente.
            2. Apuntaban a torneos YA TERMINADOS y los presentaban como si fueran lo actual;
               mientras no haya torneo en curso no hay nada que mostrar ahí.
            «Equipos Inscritos» además arrastraba un párrafo que prometía "Conoce a los
            equipos… Actualizado en tiempo real": borrar solo el iframe dejaba ese texto
            mintiendo en pantalla.
            Vuelven cuando haya torneo en curso Y ATAK exponga brackets, clasificaciones y
            equipos: hoy su única API pública documentada es la validación de Riot ID (ver
            docs/INTEGRACION-ATAK.md), así que todavía no hay de dónde sacar los datos.
            Con datos primero, no con el encabezado puesto de antemano. */}

        {/* Segundo camino al registro. Existe por el móvil: arriba está el hero, pero entre
            medio quedó la sección de Transmisión, que es la más alta de la página (video 16:9
            + chat de 256–320px + la barra lateral del horario). Para cuando alguien llega acá
            scrolleando ya pasaron dos o tres pantallas y el CTA del hero hace rato que no se
            ve. Sin esto, el único camino al registro obliga a volver arriba.
            Va ANTES de Patrocinadores a propósito: es la acción que la portada quiere.
            Sobre el ritmo de fondos: esta sección se lleva el `bg-black/20` que tenía
            Patrocinadores, que pasa a ir sin fondo. Si las dos lo llevaran quedarían pegadas
            en una sola banda tintada —el mismo defecto que se corrigió al sacar los embeds—, y
            si esta fuera sin fondo serían tres seguidas sin tintar. Así queda alternado:
            Hero (sin fondo) → Transmisión (sin fondo) → este CTA (tintado) → Patrocinadores
            (sin fondo). Y de paso el tinte ayuda a que el bloque se despegue.
            El texto no promete fechas, cupos ni premios: nada de eso está confirmado. Lo que
            dice del roster sí lo está: son los mismos MIN_JUGADORES y MAX_JUGADORES que
            /registro hace cumplir y que la RPC valida (ver Registro.tsx y la FAQ de
            Contacto).
            Y describe el modelo de registro VIGENTE —cada quien se registra solo y elige su
            equipo de las sugerencias—, que ya cambió dos veces. Si vuelve a cambiar, esta
            copia miente en silencio: es una de las tres en prosa que nada sincroniza. */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-6 max-w-4xl text-center">
            {/* Tarjeta oscura de CTA, con el gradiente que AGENTS.md marca como canon. */}
            <div className="bg-gradient-to-br from-blue-950/30 to-lqc-900/20 backdrop-blur-md border border-blue-800/20 rounded-3xl p-10 md:p-12 shadow-2xl shadow-black/50">
              <h2 className="text-3xl font-light mb-4">¿Vas a competir?</h2>
              <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
                Cada jugador se registra por su cuenta y elige su equipo de la lista. Un
                equipo compite con 5 a 7 jugadores.
              </p>
              <Link to="/registro" onClick={irAlTope} className={CLASE_CTA_PRIMARIO}>
                <UserPlus className="w-5 h-5 shrink-0" aria-hidden="true" />
                Registrarme
                <ChevronRight className="w-5 h-5 shrink-0" aria-hidden="true" />
              </Link>

              {/* El QR va DEBAJO del botón y centrado, no a su lado. Al lado —un `flex-row` con
                  `justify-center`— lo que queda centrado es el CONJUNTO, así que el botón se
                  corre a la izquierda del eje de la tarjeta y deja de alinear con el <h2> y el
                  párrafo de arriba, que son `text-center`. Abajo, el botón no se mueve ni un
                  píxel y el orden de lectura queda en el orden de importancia: primero la
                  acción, después el atajo.
                  El texto va ANTES del QR y no después: es lo que explica para qué sirve el
                  cuadro que viene, y sin él un código pegado bajo un botón no dice nada. */}
              <div className="mt-10 flex flex-col items-center gap-3">
                <p className="text-sm text-gray-400">o escanea para registrarte</p>
                {/* Cuadro blanco. El SVG ya trae su propio `<rect fill="white">` de fondo, así
                    que este `bg-white` no está tapando ninguna transparencia: lo que hace es
                    extender ese blanco por detrás del `p-2` para que el borde redondeado se vea
                    limpio y el código no termine en un canto duro contra la tarjeta oscura.
                    El `ring` retoma el `border-blue-800/20` de la tarjeta que lo contiene —es lo
                    que evita que el blanco se lea como un parche— y la sombra lo apoya sobre el
                    fondo en vez de dejarlo flotando. */}
                <div className="rounded-xl bg-white p-2 shadow-lg shadow-black/40 ring-1 ring-blue-800/30">
                  {/* `width`/`height` además de las clases: el SVG declara `width="45mm"`, o sea
                      ~170px intrínsecos, y sin medidas explícitas se pintaría a ese tamaño.
                      Los atributos le dan al navegador la proporción antes de que aplique el
                      CSS; las clases son las que mandan. `block` mata el hueco que el navegador
                      deja bajo una imagen `inline` por la línea base, que acá se vería como un
                      borde blanco más grueso abajo que arriba. */}
                  <img
                    src="/assets/qr_lqc_azul.svg"
                    alt="Código QR para registrarse en LQC"
                    width={104}
                    height={104}
                    loading="lazy"
                    className="block h-26 w-26"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Generador de carta de jugador.
            VA DESPUÉS DEL CTA DE REGISTRO Y CON MENOS PESO, a propósito. La acción que la
            portada quiere sigue siendo registrarse (ver el comentario de esa sección), así
            que esta no repite su tarjeta con gradiente ni su botón primario: usa el
            encabezado de sección con barrita —el mismo de Transmisión y Patrocinadores— y
            el CTA SECUNDARIO. Si algún día se le sube la jerarquía, hay dos primarios
            compitiendo en la misma página y el de registro pierde.
            Sin fondo tintado por el ritmo que fija el comentario de Patrocinadores: el CTA
            de registro ya es la banda tintada y dos seguidas se leerían como una sola. */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
              <h2 className="text-3xl font-light">Armá tu carta de jugador</h2>
            </div>

            <div className="flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
              <p className="text-lg text-gray-300 leading-relaxed md:max-w-2xl">
                Elegí tu campeón, poné tu nick y descargá una carta con los colores del LQC
                para compartir en tus redes.
              </p>

              <Link
                to="/carta"
                onClick={irAlTope}
                className={`${CLASE_CTA_SECUNDARIO} w-full shrink-0 sm:w-auto`}
              >
                <IdCard className="w-5 h-5 shrink-0" aria-hidden="true" />
                Crear mi carta
                <ChevronRight className="w-5 h-5 shrink-0" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* Patrocinadores. Sin fondo tintado: el ritmo de la portada lo fija el comentario
            de la sección CTA de más arriba (Hero → Transmisión → CTA tintado → Carta → esta). */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
              <h2 className="text-3xl font-light">Nuestros Patrocinadores</h2>
            </div>

            {/* Muro de logos, no una lista de fichas. Antes era un CARRUSEL que mostraba
                un patrocinador por vez en una tarjeta enorme y rotaba solo cada 3 s: con
                10 marcas, nueve de cada diez logos estaban siempre ocultos y ver uno en
                particular exigía esperar el turno o navegar a mano. Una grilla los muestra
                todos a la vez y escala sin tocar nada — con 6, con 10 o con 20 lo único
                que cambia es la cantidad de filas.
                (De paso se va un problema de accesibilidad: la rotación automática no
                tenía forma de pausarse —`isPlaying` no tenía setter—, que es justo lo que
                pide WCAG 2.2.2 para cualquier movimiento que arranque solo y dure más de
                cinco segundos.)
                Las columnas suben de 2 a 5 y la última fila queda alineada a la izquierda
                cuando no completa: es lo normal en un muro de marcas y evita que agregar
                un patrocinador reacomode toda la sección. */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
              {sponsors.map((sponsor) => {
                /* Quién apunta al placeholder se mueve cada vez que un patrocinador
                   consigue o pierde su sitio —ver el comentario de DOMINIO_PLACEHOLDER, que
                   es el único lugar donde ese conteo está escrito—, así que acá no va
                   ningún número: la rama se decide por el valor de la url, no por una lista.
                   Con la celda entera convertida en enlace, cada placeholder sería un área
                   de toque grande que lleva al sitio de la IANA en una pestaña nueva.
                   El que no tiene sitio se pinta igual pero como <div>: sin href, así que
                   no navega; sin ser tabulable, así que quien usa teclado no tropieza con
                   una parada muerta; y sin aria-label, así que a nadie se le anuncia una
                   pestaña nueva que no va a abrirse. Lo que sí conserva es el nombre en
                   texto visible, que es toda la información que la celda tenía para dar. */
                const navega = tieneSitioReal(sponsor.url)

                /* El contenido se escribe UNA vez y lo envuelve una u otra caja: si se
                   duplicara en las dos ramas, el próximo retoque del logo o del nombre se
                   haría en una sola y las celdas dejarían de verse idénticas — que es
                   justo lo que este cambio tiene que garantizar. */
                const contenido = (
                  <>
                    <span
                      className={`flex w-full items-center justify-center px-2 ${ALTO_LOGO_PATROCINADOR}`}
                    >
                      {/* Si el logo no carga se oculta la <img> y el nombre de abajo queda
                          como única identificación. El manejador NO apunta a un archivo de
                          reserva a propósito: un fallback que a su vez no cargue vuelve a
                          disparar onError y entra en bucle. Esto ya fue un bug; no lo
                          "mejores" apuntándolo a una imagen.
                          `alt=""` porque el nombre ya está en texto visible justo abajo:
                          repetirlo haría que un lector de pantalla lo dijera dos veces. En
                          las celdas que enlazan, además, el nombre accesible ya lo fija el
                          aria-label del <a>. */}
                      {/* El logo va SIEMPRE al 100%, sin atenuar, en todos los dispositivos.
                          Tuvo una atenuación al 70 % que se aplicaba solo donde hay puntero
                          —vía media query, para no apagar los logos en táctil— y volvía a
                          100 en hover. El problema no era el efecto sino a quién le tocaba:
                          el hover lo enciende la celda vía `group`, y solo las celdas con
                          sitio real son `.group`, así que en escritorio los logos sin sitio
                          se quedaban atenuados para siempre. Atenuar de forma permanente el
                          logo de quien paga por estar ahí, y encima solo a algunos, no se
                          arregla con más CSS condicional.
                          La celda que navega ya se distingue por el marco (borde y fondo) y
                          por el nombre, que sí cambian en hover. */}
                      <img
                        src={sponsor.logo}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </span>
                    {/* `text-sm` y no `text-xs`: index.css baja la raíz a 14px por debajo
                        de 768px, así que ahí `text-xs` rinde 10.5px reales. Es el único
                        texto de la celda y el que identifica a la marca cuando el logo no
                        carga — y, en las celdas sin sitio, todo lo que la celda comunica.
                        `font-medium` NO es decorativo: sin él, este texto HEREDA el peso
                        de su contenedor, y la regla base `a { font-weight: 500 }` de
                        index.css hace que las celdas enlazadas lo pinten en 500 y las que
                        no, en el 400 de `:root`. Con `font-synthesis: none` no hay nada que
                        lo disimule, y en una fila mezclada se ven dos pesos distintos lado
                        a lado sin que nadie haya interactuado — justo lo que este cambio
                        tiene que evitar. Va en 500 y no en 400 porque es el peso que las
                        celdas ya tenían cuando todas eran enlaces. */}
                    <span className="mt-4 text-center text-sm font-medium leading-snug text-gray-400 transition-colors duration-300 group-hover:text-gray-200">
                      {sponsor.name}
                    </span>
                  </>
                )

                if (!navega) {
                  return (
                    <div key={sponsor.id} className={CLASE_CELDA_PATROCINADOR_BASE}>
                      {contenido}
                    </div>
                  )
                }

                return (
                  <a
                    key={sponsor.id}
                    href={sponsor.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    /* Arranca con el texto visible EXACTO —el nombre, que está en el <span>
                       de abajo— para no romper el control por voz (WCAG 2.5.3, "Label in
                       Name") y recién después avisa lo que el texto no dice. Misma fórmula
                       que los enlaces de comunidad de /registro. */
                    aria-label={`${sponsor.name} (abre en pestaña nueva)`}
                    className={CLASE_CELDA_PATROCINADOR_ENLACE}
                  >
                    {contenido}
                  </a>
                )
              })}
            </div>
          </div>
        </section>

      </div>

      {/* Animación flotante */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-40px) rotate(2deg); }
        }
        .animate-float-slow {
          animation: float-slow 14s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}