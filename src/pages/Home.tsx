import { Link } from 'react-router-dom'
import { Twitch, Calendar, ChevronRight, UserPlus } from 'lucide-react'
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

/* Celda del muro de patrocinadores. El <a> ES la celda entera —no un enlace chico dentro
   de una tarjeta—: es lo que se espera de un muro de logos y de paso da un área de toque
   cómoda en móvil, donde cada celda mide media pantalla de ancho.
   Tres cosas que la capa base de index.css obliga a desactivar o reponer en cualquier <a>
   que no sea un enlace de texto: `after:hidden` mata la barra de gradiente que `a::after`
   dibuja al 100% del ancho en hover —acá cruzaría la tarjeta por debajo—; el anillo de
   foco va explícito porque index.css se lo da a <button> y no a <a>; y el color del texto
   lo pone el <span> del nombre, que al ser una clase propia gana sobre el
   `a { color: #66a3ff }` heredado.
   El hover es deliberadamente chico: el marco se ilumina y el logo pasa de opacidad
   reducida a plena. Nada de `scale` ni de saltos — son marcas, no llamados a la acción, y
   con 10 o 20 celdas cualquier movimiento grande convierte la sección en un tembladeral. */
const CLASE_CELDA_PATROCINADOR =
  'group after:hidden flex flex-col items-center rounded-2xl border border-white/5 ' +
  'bg-white/[0.02] p-5 md:p-6 transition-colors duration-300 ' +
  'hover:border-blue-500/30 hover:bg-white/[0.04] ' +
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lqc-accent/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-black'

/* Los logos vienen en proporciones muy distintas —hoy 8 de 10 son cuadrados y los otros dos
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
  { id: 1, name: 'Yuri Japonesa', logo: '/sponsors/YuriJaponesa.png', url: 'https://example.com' },
  { id: 2, name: 'TableTop', logo: '/sponsors/5 Tabletop.png', url: 'https://example.com' },
  { id: 3, name: 'Los Arcos CQ', logo: '/sponsors/6 Los Arcos CQ.png', url: 'https://example.com' },
  { id: 4, name: 'Ser Sejuve', logo: '/sponsors/10 Ser Sejuve.png', url: 'https://example.com' },
  { id: 5, name: 'La Forja', logo: '/sponsors/8 La Forja.png', url: 'https://example.com' },
  { id: 6, name: 'Queretaro Con Futuro', logo: '/sponsors/9 Queretaro Con Futuro.png', url: 'https://example.com' },
  { id: 7, name: 'Space Riders', logo: '/sponsors/7 Space Riders.png', url: 'https://example.com' },
  { id: 8, name: 'Revolution 505', logo: '/sponsors/LOGONUEVOREV.png', url: 'https://revolution505.com' },
  { id: 9, name: 'LQC', logo: '/sponsors/2 LQC.png', url: 'https://lqc.revolution505.com' },
  { id: 10, name: 'La Peña de Santiago', logo: '/sponsors/penaLogoNaran.jpeg', url: 'https://lqc.revolution505.com' },
]

export default function Home() {
  const [streamStatus, setStreamStatus] = useState<'online' | 'offline'>('online')
  const [] = useState('1.2K')
  const twitchChannel = "lqroc"
  
  const streamSchedule = [
    { day: 'Martes', time: '20:30 - 22:00', type: 'Grupos' },
    { day: 'Jueves', time: '21:00 - 22:00', type: 'Grupos' },
    
  ]

  useEffect(() => {
    const checkStreamStatus = () => setStreamStatus('online')
    checkStreamStatus()
    const interval = setInterval(checkStreamStatus, 60000)
    return () => clearInterval(interval)
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
                <div className={`w-3 h-3 rounded-full ${streamStatus === 'online' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                {streamStatus === 'online' ? 'EN VIVO' : 'OFFLINE'}
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-10">
                <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-black/60 backdrop-blur-md border border-white/5">
                  <div className="relative aspect-video">
                    <iframe
                      src={`https://player.twitch.tv/?channel=${twitchChannel}&parent=${window.location.hostname}&autoplay=true`}
                      height="100%"
                      width="100%"
                      allowFullScreen
                      className="border-0"
                      title="Twitch Stream"
                    />
                    <div className="absolute top-4 left-4">
                      <div className={`px-4 py-1.5 rounded-full text-sm font-medium shadow-lg ${
                        streamStatus === 'online' ? 'bg-red-600 text-white' : 'bg-gray-800/80 text-gray-200'
                      }`}>
                        {streamStatus === 'online' ? '🔴 EN VIVO' : '⚪ OFFLINE'}
                      </div>
                    </div>
                  </div>
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

                <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-black/40 backdrop-blur-md border border-white/5">
                  <div className="bg-gradient-to-r from-gray-900/60 to-gray-800/40 px-5 py-4">
                    <div className="font-medium">Chat de Twitch</div>
                  </div>
                  <div className="h-64 sm:h-80">
                    <iframe
                      src={`https://www.twitch.tv/embed/${twitchChannel}/chat?parent=${window.location.hostname}&darkpopout`}
                      height="100%"
                      width="100%"
                      className="border-0"
                      title="Twitch Chat"
                    />
                  </div>
                </div>
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
            </div>
          </div>
        </section>

        {/* Patrocinadores. Sin fondo tintado: el ritmo de la portada lo fija el comentario
            de la sección CTA de más arriba (Hero → Transmisión → CTA tintado → esta). */}
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
              {sponsors.map((sponsor) => (
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
                  className={CLASE_CELDA_PATROCINADOR}
                >
                  <span
                    className={`flex w-full items-center justify-center px-2 ${ALTO_LOGO_PATROCINADOR}`}
                  >
                    {/* Si el logo no carga se oculta la <img> y el nombre de abajo queda
                        como única identificación. El manejador NO apunta a un archivo de
                        reserva a propósito: un fallback que a su vez no cargue vuelve a
                        disparar onError y entra en bucle. Esto ya fue un bug; no lo
                        "mejores" apuntándolo a una imagen.
                        `alt=""` porque el nombre ya está en texto visible al lado y el
                        nombre accesible del enlace lo da el aria-label: repetirlo haría
                        que un lector de pantalla lo dijera dos veces. */}
                    {/* La opacidad reducida es SOLO donde hay puntero, y por eso arranca
                        en 100 y baja con `[@media(hover:hover)]` en vez de arrancar en 70.
                        Tailwind 4 encierra todas las variantes `hover:`/`group-hover:` en
                        `@media(hover:hover)`, así que con el reposo en 70 el
                        `group-hover:opacity-100` NUNCA entra en un táctil y los logos
                        quedan apagados de forma permanente — en la sección de quienes
                        pagan por estar ahí, y en el dispositivo donde se ve la mayor parte
                        del tráfico. El matiz es un adorno de escritorio; el estado bueno
                        tiene que ser el que se ve sin puntero.
                        `group-focus-visible` para que quien llega con teclado vea el logo
                        pleno igual que quien pasa el mouse. */}
                    <img
                      src={sponsor.logo}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-contain opacity-100 transition-opacity duration-300 [@media(hover:hover)]:opacity-70 group-hover:opacity-100 group-focus-visible:opacity-100"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </span>
                  {/* `text-sm` y no `text-xs`: index.css baja la raíz a 14px por debajo de
                      768px, así que ahí `text-xs` rinde 10.5px reales. Es el único texto de
                      la celda y el que identifica a la marca cuando el logo no carga. */}
                  <span className="mt-4 text-center text-sm leading-snug text-gray-400 transition-colors duration-300 group-hover:text-gray-200">
                    {sponsor.name}
                  </span>
                </a>
              ))}
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