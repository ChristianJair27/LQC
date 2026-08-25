import { useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Mail, MapPin, MessageSquare, Facebook, Twitch, ChevronRight, ChevronDown,
  Route, Radio, Globe
} from 'lucide-react'

/* Canales de contacto. Cada uno tiene destino REAL: la tarjeta entera es el enlace, así que
   no hay ningún control que parezca accionable y no haga nada. Antes esta página ofrecía
   además un formulario que simulaba enviar —un setTimeout y una pantalla de "¡Mensaje
   Enviado!"— sin transmitir nada a ningún lado; se quitó, porque una consulta que el usuario
   cree enviada y nadie recibe es peor que no tener formulario.
   Las URLs se copian de Footer.tsx, que es donde viven. `externo` marca las que salen del
   sitio y necesitan target/rel; el mailto no abre pestaña.

   `acento` es el color de marca de cada plataforma, en hex y no como clase de Tailwind. Tiene
   que ser así: Tailwind compila leyendo el código como texto plano, así que una clase armada
   en tiempo de ejecución nunca se genera y saldría sin estilo. El hex viaja a la tarjeta como
   la custom property `--acento` en un `style` inline, y las clases la leen con `var()`, que sí
   son estáticas y sí se compilan.
   Dónde se usa el acento: el ícono, el filo superior, el borde y el halo del hover. NO en el
   texto de la tarjeta — ver el comentario de la línea de acción, es una decisión de contraste.
   Los dos morados son deliberados y son una excepción a la regla de color del proyecto: son
   colores de marca ajenos, del propio Discord y del propio Twitch. La regla de AGENTS.md
   prohíbe las CLASES de Tailwind con morado, y acá no se usa ninguna — el comando de control
   que documenta esa regla sigue dando cero. Si algún día se quiere volver a la paleta de la
   casa, se cambian estos cuatro valores y nada más. */
const canales = [
  {
    icon: Mail,
    titulo: "Correo Electrónico",
    descripcion: "Respuesta en 24-48 horas",
    valor: "contactolqc@revolution505.com",
    accion: "Enviar correo",
    href: "mailto:contactolqc@revolution505.com",
    externo: false,
    /* El correo no tiene color de marca propio, así que lleva el cian de la casa. */
    acento: "#00d4ff",
    /* El `aria` empieza SIEMPRE con el título visible: como pisa el nombre que saldría del
       contenido, si no lo incluyera incumpliría WCAG 2.5.3 (Label in Name) y quien navega
       por voz no podría activar la tarjeta diciendo lo que lee en pantalla. */
    aria: "Correo electrónico: escribir a contactolqc@revolution505.com"
  },
  {
    icon: MessageSquare,
    titulo: "Discord",
    descripcion: "Comunidad activa 24/7",
    valor: "discord.gg/eS6zkvfkp",
    accion: "Unirse al servidor",
    href: "https://discord.gg/eS6zkvfkp",
    externo: true,
    acento: "#5865F2",
    aria: "Discord: unirse al servidor de LQC (abre en pestaña nueva)"
  },
  {
    icon: Facebook,
    titulo: "Facebook",
    descripcion: "Página oficial de la liga",
    valor: "facebook.com/lolqrochampionship",
    accion: "Seguir la página",
    href: "https://www.facebook.com/lolqrochampionship/",
    externo: true,
    acento: "#1877F2",
    aria: "Facebook: ver la página de LQC (abre en pestaña nueva)"
  },
  {
    icon: Twitch,
    titulo: "Twitch",
    descripcion: "Transmisiones en vivo",
    valor: "twitch.tv/lqroc",
    accion: "Ver el canal",
    href: "https://twitch.tv/lqroc",
    externo: true,
    acento: "#9146FF",
    aria: "Twitch: ver el canal de LQC (abre en pestaña nueva)"
  }
]

export default function Contacto() {
  /* OJO: estas respuestas describen el modelo de registro, así que envejecen con él.
     Ya envejecieron una vez: hasta el 2026-07-30 esta FAQ decía que el capitán
     registraba al equipo entero en un solo envío, y siguió diciéndolo un rato después
     de que dejara de ser cierto. Hoy el modelo es individual —cada quien manda lo suyo
     y ELIGE su equipo de las sugerencias de `buscar_equipos`—.
     Los números del roster (5 a 7, 5 titulares) y la lista de campos que se piden son
     los de `src/pages/Registro.tsx` —MIN_JUGADORES, MAX_JUGADORES, TITULARES y los
     campos del payload— y los hace cumplir la RPC `registrar_jugador`. Si cambian ahí,
     hay que tocarlos acá y en la tarjeta CTA de Home.tsx: son tres copias en prosa que
     nada sincroniza.

     La regla de residencia sale del REGLAMENTO, no del código: residentes del estado de
     Querétaro con hasta 2 foráneos que residan en México. Se enuncia tal cual y se
     remite al documento sin resumirla más, y eso es deliberado. El reglamento SÍ define
     «jugador local» —haber vivido en Querétaro al menos 6 meses en los últimos «3-5
     años», y 10 años si ya jugó la liga—, pero ese rango está sin cerrar y choca con su
     propia definición de foráneo («quien no resida en el Estado»), que no es la misma
     prueba. Los organizadores lo van a aclarar. Hasta entonces, parafrasearlo acá es
     elegir por ellos. NO lo resumas.

     Antes de afirmar CUALQUIER cosa sobre el reglamento, leelo — se extrae con:
       pdftotext -layout -enc UTF-8 public/reglamento-lqc-2026.pdf salida.txt
     (Verificado el 2026-07-29. `pdftotext` viene con Git for Windows. Descomprimir los
     streams a mano NO sirve: las fuentes van en subconjunto y el texto sale como
     índices de glifo.)

     Qué dice hoy sobre cifras, para no inventar ni quedarse corto: inicio 25/08/2026,
     gran final 28/11/2026, «máximo de 32 equipos» y «Premiación — Por definir». O sea
     que fechas y cupo SÍ tienen fuente y los premios NO: nunca publicar un monto. */
  const faqs = [
    {
      /* Reescrita el 2026-08-25, al cerrarse la convocatoria. Se queda PRIMERA —es la que
         el acordeón abre por defecto (ver el estado de más abajo)— justamente porque la
         respuesta cambió: quien llega buscando cómo inscribirse tiene que toparse con el
         cierre antes que con cualquier otra cosa.
         Es una cadena dentro de un arreglo de datos, no un bloque de JSX, así que
         INSCRIPCIONES_ABIERTAS no la alcanza: al reabrir hay que reescribirla a mano. La
         redacción anterior —el modelo individual con elección de equipo de las
         sugerencias— queda registrada acá para poder reponerla tal cual:
         "Cada jugador se registra por su cuenta, desde la sección Registro del menú. Al
         escribir el nombre del equipo aparecen los que ya están inscritos: si el tuyo está
         en la lista, elígelo de ahí para no crear uno repetido; si eres el primero de tu
         equipo, escribe el nombre y se crea con tu registro. Se piden Riot ID, nombre,
         fecha de nacimiento, celular, correo, municipio, escolaridad y género, más una
         casilla opcional para marcar quién es el capitán. Un equipo compite con 5 a 7
         jugadores: los 5 primeros en registrarse quedan como titulares y del 6º en
         adelante como suplentes." */
      question: "¿Cómo nos inscribimos?",
      answer: "Las inscripciones para el Split Otoño 2026 están cerradas. Si tu equipo ya se registró, su lugar sigue en pie y no hay nada más que hacer desde aquí. Si tienes dudas sobre un registro que ya enviaste, escríbenos a contactolqc@revolution505.com."
    },
    {
      question: "¿Cuáles son los requisitos para participar?",
      answer: "Tener al menos 16 años cumplidos y formar un equipo de 5 a 7 jugadores: 5 titulares y 2 suplentes opcionales. El equipo debe estar conformado por residentes del estado de Querétaro, y puede incluir hasta 2 integrantes foráneos siempre que residan en México. Qué cuenta como jugador local lo define el reglamento oficial, que está enlazado en el pie del sitio: revísalo antes de armar el equipo."
    },
    {
      question: "¿Hay algún costo de inscripción?",
      answer: "Sí: $500 MXN por equipo, no por jugador. Es un solo pago que realiza el capitán por transferencia, con el nombre del equipo como concepto."
    },
    {
      question: "¿Dónde se transmiten los partidos?",
      answer: "Todos los encuentros oficiales se transmiten en vivo por Twitch.tv/lqroc con comentaristas y producción profesional."
    },
    /* Esta respuesta SÍ tiene fuente, a diferencia de lo que advierte el comentario de arriba
       sobre las cifras: sale de la sección «Restricciones y Modalidad de Juego» del reglamento,
       verificada contra el PDF el 2026-08-07 con el comando de extracción de más arriba. El
       documento dice, textual, que el torneo es online con final PRESENCIAL OBLIGATORIA, que
       los equipos del TOP 4 deben confirmar su participación en la final, y que no presentarse
       se toma como abandono del torneo. «Play Offs» también es palabra suya.
       Si el reglamento se reemplaza, esta respuesta hay que volver a verificarla: es de las que
       envejecen en silencio. */
    {
      question: "¿El torneo es online o presencial?",
      answer: "La fase regular y los Play Offs se juegan online. La gran final es PRESENCIAL y obligatoria: los equipos que lleguen al Top 4 deben confirmar su asistencia y presentarse en persona. No presentarse a la final presencial se toma como abandono del torneo."
    }
  ]

  /* Qué pregunta está abierta, por índice. Arranca en 0 —«¿Cómo nos inscribimos?»— porque es
     la que trae a la mayoría a esta página y la más larga de las cuatro.
     Un solo índice y no un conjunto: el acordeón es de apertura única, así que abrir una cierra
     la anterior. `null` es «todas cerradas», el estado al que se llega pulsando la abierta.
     Este es el ÚNICO estado del archivo; antes no había ninguno. */
  const [faqAbierta, setFaqAbierta] = useState<number | null>(0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white">
      {/* Fondo decorativo */}
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
            w-[110%] sm:w-[90%] md:w-[80%] lg:w-[70%] xl:w-[60%]
            max-w-none opacity-10
            animate-float-slow pointer-events-none blur-[1px]
          "
        />
      </div>

      <div className="relative z-10">
        {/* Hero */}
        <section className="pt-28 pb-16 md:py-40">
          <div className="container mx-auto px-6 max-w-5xl text-center">
            <h1 className="font-heading font-bold uppercase text-4xl sm:text-5xl md:text-7xl tracking-tight leading-[0.95] [text-shadow:0_0_40px_rgba(0,212,255,0.35)] bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-lqc-accent">
              Contacto LQC
            </h1>
            {/* Línea divisoria estilo póster */}
            <div className="h-px w-40 mx-auto mb-6 bg-gradient-to-r from-transparent via-lqc-accent/60 to-transparent" />
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Estamos aquí para resolver tus dudas, recibir propuestas y ayudarte a formar parte de la comunidad competitiva de Querétaro.
            </p>
          </div>
        </section>

        {/* Canales de contacto: el camino principal de la página desde que no hay
            formulario. La tarjeta ENTERA es el <a>, así que el área clickeable es toda la
            caja y la línea de acción es un <span>, no un botón que no hace nada. */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-6xl">
            {/* Encabezado de sección, mismo bloque en las tres que quedan. Antes los márgenes
                iban sueltos y distintos (una en mb-6, otra en mb-16, Ubicación sin barra ni
                encabezado). Ahora el `mb-12` vive en el CONTENEDOR y la bajada, cuando existe,
                se separa con `mt-6`: así las tres arrancan su contenido a la misma altura
                tenga o no tenga bajada. */}
            <div className="mb-12">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
                <h2 className="text-3xl font-light">Canales oficiales</h2>
              </div>
              <p className="mt-6 text-gray-300 leading-relaxed max-w-3xl">
                Por correo y Discord respondemos normalmente en 24-48 horas. En Facebook y
                Twitch puedes seguir a la liga.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {canales.map((canal) => (
                <a
                  key={canal.titulo}
                  href={canal.href}
                  {...(canal.externo
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  aria-label={canal.aria}
                  /* `after:hidden` mata la barra de gradiente que la regla base `a::after`
                     de index.css dibuja al 100% del ancho en hover: acá el enlace es una
                     tarjeta con borde y quedaría un subrayado colgando. `text-white` es
                     obligatorio porque la regla base `a { color: #66a3ff }` pisaría el
                     color de todo el contenido. El anillo de foco va explícito porque, sin
                     la barra de hover, tabulando solo quedaría el outline del navegador
                     sobre fondo negro. Mismo patrón que CLASE_ENLACE_COMUNIDAD en
                     Registro.tsx.
                     `min-w-0` es lo que evita el desborde: un ítem de grid tiene
                     `min-width: auto`, o sea que la pista no encoge por debajo del
                     min-content, y `break-words` (overflow-wrap) NO reduce ese min-content.
                     Sin esto el correo de 29 caracteres estira las 4 columnas más allá del
                     contenedor y aparece scroll horizontal. */
                  /* El hex del canal entra como custom property y de ahí lo leen las clases con
                     `var()`. Es la única vía: una clase de Tailwind armada en runtime no existe
                     en el CSS compilado. El `as CSSProperties` hace falta porque el tipo de
                     React no contempla propiedades personalizadas. */
                  style={{ '--acento': canal.acento } as CSSProperties}
                  className="after:hidden group relative flex min-w-0 flex-col overflow-hidden bg-black/30 backdrop-blur-sm p-8 rounded-2xl border border-white/5 text-white transition-all duration-300 hover:-translate-y-1 hover:border-[color:color-mix(in_oklab,var(--acento)_55%,transparent)] hover:shadow-[0_14px_34px_-18px_var(--acento)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lqc-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  {/* Filo superior del color de la plataforma, que se despliega de izquierda a
                      derecha en hover. Es lo que le da vida a la tarjeta sin teñirle el fondo.
                      Decorativo puro, de ahí el `aria-hidden`. */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-[color:var(--acento)] transition-transform duration-300 group-hover:scale-x-100"
                  />
                  <div className="flex items-center gap-5 mb-6">
                    {/* `shrink-0`: sin él el cuadro cede ancho y se deforma cuando el texto de
                        al lado no entra, sobre todo en 4 columnas.
                        Pasó de círculo a cuadrado redondeado —encaja mejor con el `rounded-2xl`
                        de la tarjeta— y de un gradiente azul fijo a un tinte del acento, que se
                        intensifica junto con su borde al pasar el mouse. Ya no crece con
                        `scale`: el movimiento ahora lo lleva la tarjeta entera, y dos cosas
                        moviéndose a destiempo se leían como salto. */}
                    <div className="w-14 h-14 shrink-0 rounded-2xl border border-white/10 bg-[color:color-mix(in_oklab,var(--acento)_12%,transparent)] flex items-center justify-center transition-all duration-300 group-hover:border-[color:color-mix(in_oklab,var(--acento)_45%,transparent)] group-hover:bg-[color:color-mix(in_oklab,var(--acento)_22%,transparent)]">
                      <canal.icon className="w-7 h-7 text-[color:var(--acento)]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-medium text-white">{canal.titulo}</h3>
                      <p className="text-sm text-gray-400">{canal.descripcion}</p>
                    </div>
                  </div>
                  {/* `break-words`: el correo mide más que la columna y no tiene punto de
                      corte natural, así que sin esto se desborda de la tarjeta. */}
                  <div className="text-lg font-light mb-4 break-words text-gray-200">
                    {canal.valor}
                  </div>
                  {/* El acento NO llega a este texto, y es a propósito. Sobre el fondo de la
                      tarjeta, el morado de Twitch da ~4.5:1 y el de Discord ~4.6:1: rozan el
                      mínimo AA para texto normal, mientras que el azul que había daba ~8:1.
                      El color de marca se queda donde no es texto —ícono, filo, borde y halo—,
                      que como elementos gráficos solo necesitan 3:1 y lo pasan de sobra.
                      La flecha se corre a la derecha en hover: da la señal de «esto lleva a otro
                      lado» sin depender del color. */}
                  <span className="mt-auto text-gray-300 group-hover:text-white transition-colors flex items-center gap-2 text-sm font-medium">
                    {canal.accion}
                    <ChevronRight className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ACÁ NO HAY «HORARIOS DE ATENCIÓN». Se fue la sección entera y con ella el array
            `supportHours` que la alimentaba, que no lo usaba nadie más — dejarlo habría hecho
            fallar a `tsc` por variable sin leer.
            También se fue su párrafo de cierre, que prometía respuesta «al siguiente día
            hábil». Ese dato ya no lo promete nadie; lo que sí queda dicho, y con fuente en la
            propia tarjeta, es el «Respuesta en 24-48 horas» del correo.
            Con ella se llevó su `bg-black/20`, que era el que partía la página al medio. Por
            eso el tinte pasó a la FAQ de acá abajo: si no, Canales y FAQ quedaban las dos sin
            fondo, una detrás de la otra, y se leían como una sola mancha de 160px. */}

        {/* FAQs. Toma el fondo tintado que tenía Horarios para conservar la alternancia:
            Hero y Canales sin fondo, esta tintada, Ubicación sin fondo. */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="mb-12">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
                <h2 className="text-3xl font-light">Preguntas Frecuentes</h2>
              </div>
            </div>

            {/* Acordeón de apertura única. Antes eran cuatro tarjetas siempre abiertas: la
                primera respuesta sola mide unos 640 caracteres, así que la sección obligaba a
                scrollear un muro de texto para llegar a la pregunta que uno traía.
                Cómo está armado, y por qué así:
                · La cabecera es un <button> DENTRO del <h3>, no un <h3> con onClick. El botón
                  es lo que le da a la cabecera su rol, su foco por teclado y su activación con
                  Enter y Espacio sin escribir un solo manejador; el <h3> mantiene el esquema de
                  encabezados para quien navega saltando de título en título.
                · `aria-expanded` dice si está abierta y `aria-controls` apunta al panel. El
                  panel NUNCA se desmonta —colapsa a alto cero— porque un `aria-controls` que
                  apunta a un id ausente no es válido; es la misma advertencia que documenta el
                  desplegable de ListaInscripciones.tsx.
                · La animación va con `grid-template-rows` de 0fr a 1fr sobre un hijo con
                  `overflow-hidden`. Es el único modo de animar hacia «alto automático» en CSS:
                  una transición de `height` necesita un valor concreto, y un `max-height`
                  estimado o corta el texto o deja un retardo visible al cerrar.
                · Colapsado también lleva `invisible`, que lo saca del árbol de accesibilidad.
                  Sin eso, un lector de pantalla leería las cuatro respuestas de corrido aunque
                  en pantalla se vean cerradas, que es justo lo que el acordeón viene a evitar.
                  `visibility` transiciona de forma discreta: al abrir cambia de inmediato y al
                  cerrar espera a que termine el colapso, que es el orden que uno quiere.
                La regla global de `prefers-reduced-motion` de index.css desactiva las dos
                transiciones sola. */}
            <div className="space-y-4">
              {faqs.map((faq, index) => {
                const abierta = faqAbierta === index
                const idPanel = `faq-panel-${index}`
                const idCabecera = `faq-cabecera-${index}`

                return (
                  <div
                    key={index}
                    className={`overflow-hidden rounded-2xl border backdrop-blur-sm transition-colors duration-300 ${
                      abierta
                        ? 'border-blue-500/30 bg-black/40'
                        : 'border-white/5 bg-black/30 hover:border-blue-500/20'
                    }`}
                  >
                    <h3>
                      {/* Neutraliza lo que index.css le pone a todo <button>: el gradiente azul
                          de fondo (`bg-none`), el borde de 2px (`border-0`), el radio propio
                          (`rounded-none`, que acá lo pone la tarjeta) y el salto con halo del
                          hover. `tracking-tight` repone el espaciado que traía el <h3> y que la
                          regla de <button> pisaba. Es la receta de BTN_BASE en
                          ListaInscripciones.tsx.

                          EL FOCO NO PUEDE QUEDAR EN MANOS DE LA CAPA BASE, y acá está el
                          porqué. index.css trae `button:focus, button:focus-visible { outline:
                          3px solid rgba(0,212,255,.5) }`, o sea el cian de la casa al 50% y
                          3px de grosor. El selector incluye `:focus` a secas, así que también
                          se dispara al hacer CLIC con el mouse y se queda puesto hasta que el
                          foco se va a otro lado.
                          Eso, en esta tarjeta, no se veía como un marco sino como una línea:
                          el outline se dibuja 2px por fuera del botón, el botón es `w-full` y
                          está pegado al tope, y la tarjeta lleva `overflow-hidden` — así que
                          los tramos de arriba, izquierda y derecha quedaban recortados y solo
                          sobrevivía el de abajo, que además solo tiene lugar cuando el panel
                          está abierto. Abrir pintaba la línea, cerrar la recortaba.
                          El arreglo tiene dos mitades:
                          · `focus:outline-hidden` apaga el outline de la base en los dos casos
                            —`:focus-visible` está contenido en `:focus`—. Va `outline-hidden` y
                            no `outline-none` porque en Tailwind 4 este último compila a
                            `outline-style: none` a secas y dejaría sin nada al modo de alto
                            contraste de Windows, que no pinta sombras.
                          · `focus-visible:inset-ring-2` repone el indicador SOLO para teclado.
                            Es un anillo INTERIOR a propósito: cualquier cosa dibujada por fuera
                            del botón la recorta el mismo `overflow-hidden` que causaba el bug.
                          Resultado: con el mouse no aparece nada, con Tab se ve el anillo cian
                          por dentro del borde, y nunca hay línea colgando. */}
                      <button
                        type="button"
                        id={idCabecera}
                        aria-expanded={abierta}
                        aria-controls={idPanel}
                        onClick={() => setFaqAbierta(abierta ? null : index)}
                        className="flex w-full items-center justify-between gap-4 bg-none border-0 rounded-none px-6 py-5 text-left text-lg md:text-xl font-medium tracking-tight text-white transition-colors duration-300 hover:[transform:none] hover:shadow-none hover:text-blue-200 focus:outline-hidden focus-visible:inset-ring-2 focus-visible:inset-ring-lqc-accent/70"
                      >
                        <span className="min-w-0">{faq.question}</span>
                        <ChevronDown
                          aria-hidden="true"
                          className={`w-5 h-5 shrink-0 text-blue-400 transition-transform duration-300 ${
                            abierta ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </h3>

                    <div
                      id={idPanel}
                      role="region"
                      aria-labelledby={idCabecera}
                      className={`grid transition-all duration-300 ease-out ${
                        abierta ? 'grid-rows-[1fr] visible' : 'grid-rows-[0fr] invisible'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="px-6 pb-6 text-gray-300 leading-relaxed">{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Ubicación. Acá había una grilla de dos columnas con un PLACEHOLDER DE MAPA a la
            derecha: una caja 4:3 vacía con un pin gigante al 30% de opacidad y dos líneas de
            texto. Se fue entera, y con ella «Querétaro, México» y «Centro de operaciones LQC»,
            que no se reubicaron. Dos razones: sugería un mapa que no existía, y hablaba de un
            «centro de operaciones» en una liga que justamente NO tiene sede fija.
            Al irse la columna derecha, la sección deja de ser una grilla 2×1: el texto pasa a
            ancho de lectura y los tres puntos, que eran una lista de viñetas apilada, pasan a
            tres tarjetas en fila. Es lo que hace que la sección se sostenga sola sin la caja de
            al lado, en vez de quedar media página vacía.
            El párrafo y los tres puntos son el copy nuevo, entregado ya resuelto. El anterior
            decía «capital y zona metropolitana» en el párrafo y «todo el estado y más allá» en
            el punto, que eran dos alcances distintos; el nuevo dice lo mismo en los dos lados.
            `MapPin` se conserva en el encabezado, así que su import sigue en uso. */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="mb-12">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
                <h2 className="text-3xl font-light">Ubicación</h2>
                <MapPin className="w-6 h-6 text-blue-400 shrink-0" aria-hidden="true" />
              </div>
              <p className="mt-6 text-gray-300 leading-relaxed text-lg max-w-3xl">
                El LQC tiene su base en Querétaro. No tenemos una sede fija: los torneos
                son online y los eventos presenciales van rotando por distintas sedes del
                estado.
              </p>
            </div>

            {/* Tres tarjetas en vez de tres viñetas. Comparten la caja estándar de la página
                —la misma de las tarjetas de canales— para que la sección se lea como parte del
                mismo sistema y no como un apéndice.
                Los iconos son los que nombran el concepto de cada una: un recorrido para las
                sedes rotativas, una señal para el estudio y un globo para el alcance. Van con
                `aria-hidden` porque el texto de al lado ya dice lo mismo. */}
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                { icon: Route, texto: 'Eventos presenciales en sedes rotativas' },
                { icon: Radio, texto: 'Estudio de transmisión propio' },
                { icon: Globe, texto: 'Cobertura en todo el estado de Querétaro' }
              ].map(({ icon: Icono, texto }) => (
                <div
                  key={texto}
                  className="flex flex-col gap-4 bg-black/30 backdrop-blur-sm p-6 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-colors duration-300"
                >
                  <span className="w-12 h-12 shrink-0 rounded-2xl border border-blue-800/40 bg-blue-950/40 flex items-center justify-center">
                    <Icono className="w-6 h-6 text-blue-400" aria-hidden="true" />
                  </span>
                  <span className="text-gray-200 leading-snug">{texto}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        
      </div>

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