import { useSyncExternalStore } from 'react'
import { FileText, ExternalLink, Download, AlertCircle } from 'lucide-react'
/* La ruta, el nombre de descarga y el peso del PDF ya no viven acá: los comparte esta
   página con la tarjeta del reglamento de /registro. Ver src/lib/reglamento.ts. */
import { RUTA_REGLAMENTO, NOMBRE_DESCARGA, PESO_REGLAMENTO } from '../lib/reglamento'

/* Condición para montar el visor. El ancho SOLO no alcanza, y ese fue el primer intento:
   lo que hay que saber es "¿este navegador sabe dibujar un PDF embebido?", no "¿la pantalla
   es ancha?". Con `(min-width: 768px)` a secas pasaban el filtro justo los dispositivos que
   se querían excluir — un iPhone en horizontal mide 844–932px y un iPad 820–1194px, y los
   dos corren el WebKit de iOS/iPadOS, que no renderiza un PDF embebido: pinta la primera
   página sin scroll ni controles, o una caja gris.
   Peor todavía: como matchMedia es reactivo, alguien que leía la tarjeta en vertical y
   giraba el teléfono "para verlo mejor" veía montarse el visor roto en vivo.
   `hover: hover` + `pointer: fine` es lo que separa de verdad un puntero de escritorio de
   una pantalla táctil, en cualquier orientación.
   El falso negativo (un iPad con trackpad se queda sin visor) cuesta una tarjeta con dos
   botones que funcionan; el falso positivo cuesta el recuadro en blanco que esta página
   existe para evitar. La asimetría decide. */
const CONSULTA_VISOR = '(min-width: 768px) and (hover: hover) and (pointer: fine)'

function suscribirAlVisor(alCambiar: () => void): () => void {
  const consulta = window.matchMedia(CONSULTA_VISOR)
  /* Safari < 14 (iOS 12/13) no tiene addEventListener en MediaQueryList, solo el addListener
     viejo. Sin esta rama, la suscripción lanza TypeError, React lo propaga y el ErrorBoundary
     se lleva puesta la página entera — justo en los equipos viejos para los que existe toda
     esta lógica. */
  if (typeof consulta.addEventListener !== 'function') {
    consulta.addListener(alCambiar)
    return () => consulta.removeListener(alCambiar)
  }
  consulta.addEventListener('change', alCambiar)
  return () => consulta.removeEventListener('change', alCambiar)
}

/* Devuelve un booleano, no un objeto: useSyncExternalStore compara la instantánea por
   Object.is, así que un valor primitivo no puede provocar un bucle de renders aunque acá se
   cree un MediaQueryList nuevo en cada lectura.
   No lleva `getServerSnapshot` porque el sitio es CSR puro (main.tsx monta en el cliente).
   Si alguna vez se prerenderiza, useSyncExternalStore lanza y hay que sumarlo. */
function leerVisorDisponible(): boolean {
  /* Segunda capa, y la única que pregunta lo que de verdad importa: Chrome 94+, Firefox 99+
     y Safari 16.4+ dicen directamente si tienen visor de PDF. Cubre el caso del escritorio
     con "descargar los PDF en vez de abrirlos" activado, común en equipos corporativos, que
     ningún media query puede detectar. En navegadores viejos es `undefined` y no decide. */
  if (navigator.pdfViewerEnabled === false) return false
  return window.matchMedia(CONSULTA_VISOR).matches
}

/* El visor se MONTA o NO se monta, en vez de esconderse con `hidden md:block`.
   La diferencia importa: con CSS el <object> sigue en el DOM y el navegador puede bajar el
   PDF entero igual en un celular — exactamente el gasto que esta página intenta que el
   usuario decida. Montándolo condicionalmente, en pantalla chica el PDF ni se pide.
   (El peso no se escribe acá: es PESO_REGLAMENTO, en src/lib/reglamento.ts.)
   Va con useSyncExternalStore y no con useState+useEffect porque matchMedia es literalmente
   un store externo: así el primer render ya sale con el valor correcto (nada de aparecer de
   un salto en escritorio) y React resincroniza solo al suscribirse, sin el setState dentro
   del efecto que la regla `react-hooks/set-state-in-effect` marca —y marca con razón, porque
   es un render en cascada—. */
function useVisorDisponible(): boolean {
  return useSyncExternalStore(suscribirAlVisor, leerVisorDisponible)
}

/* Clases de las dos acciones. `after:hidden` mata la barra de gradiente que la regla base
   `a::after` de index.css dibuja al 100% del ancho en hover: pensada para enlaces de texto,
   en un botón con borde queda colgando por debajo de la caja. El color de texto va explícito
   porque `a { color: #66a3ff }` de la misma capa base pisaría el contenido. Y el anillo de
   foco también, porque index.css se lo da a los <button>, no a los <a>: sin él, tabulando
   sobre fondo negro no se ve nada. Mismo patrón que CLASE_ENLACE_COMUNIDAD en Registro.tsx. */
const CLASE_ACCION_BASE =
  'after:hidden inline-flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl ' +
  'font-medium transition-all duration-300 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lqc-accent/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-black'

/* Gradiente del canon del CTA primario (AGENTS.md, "Canon del CTA primario"): el mismo que
   usan Home, Torneos, Acerca, Registro, Login, el panel y el ErrorBoundary. */
const CLASE_ACCION_PRIMARIA =
  `${CLASE_ACCION_BASE} bg-gradient-to-r from-lqc-700 to-lqc-500 ` +
  'hover:from-lqc-600 hover:to-lqc-400 text-white shadow-lg shadow-blue-900/30'

/* `bg-none` desactiva el gradiente de la capa base para que el secundario no compita con el
   primario: es el mismo parche que ya lleva el botón "Registrar otro equipo" de Registro.tsx. */
const CLASE_ACCION_SECUNDARIA =
  `${CLASE_ACCION_BASE} bg-none bg-black/40 border border-blue-800/40 text-gray-200 ` +
  'hover:bg-blue-950/40 hover:border-blue-600/60 hover:text-white'

/* Secciones del reglamento, para poder escanear el documento sin abrirlo.
   SON LOS TÍTULOS TEXTUALES DEL PDF, en el orden en que aparecen, y nada más que los
   títulos: ni un resumen ni una paráfrasis de lo que dice cada una. Esa restricción no es
   estética — el PDF es la versión oficial, y una descripción escrita acá se vuelve una
   segunda versión del reglamento que envejece sola y que alguien va a citar en una
   disputa. Si hace falta explicar algo, se explica en el PDF.
   Extraídos y verificados el 2026-07-29 con:
     pdftotext -layout -enc UTF-8 public/reglamento-lqc-2026.pdf -
   Al reemplazar el PDF hay que volver a correr eso y actualizar esta lista: no se genera
   sola. Ojo con los cuatro títulos que dan ganas de recortar —«Fechas y horarios»,
   «Capitán del equipo», «Restricciones y Modalidad de Juego» y «Comportamientos
   antideportivos y trampas»—: están completos a propósito. Y NO existe una sección
   llamada «Sanciones», aunque el documento sí las define: están repartidas, sobre todo en
   «Comportamientos antideportivos y trampas» y también en «Tiempos». Otra razón para no
   inventar títulos: el índice que uno esperaría no es el que el documento tiene. */
const SECCIONES_REGLAMENTO = [
  'Inscripción',
  'Fechas y horarios',
  'Formato de Juego',
  'Capitán del equipo',
  'Puntuación y Criterios',
  'Restricciones y Modalidad de Juego',
  'Asignación de lado azul/rojo',
  'Pausas dentro de la partida',
  'Tiempos',
  'Comportamientos antideportivos y trampas',
  'Premiación',
] as const

/* Las dos acciones. Están acá y no escritas dos veces en el markup porque aparecen en dos
   lugares —la tarjeta de encabezado y la variante `reserva`, que en un teléfono es lo único
   que ocupa el lugar del visor— y los detalles finos que las hacen correctas no sobreviven
   a una copia a mano: los dos aria-label tienen que arrancar con la cadena visible EXACTA,
   el peso tiene que estar a la vista y no solo en el aria-label, y `download` solo funciona
   sobre el archivo del mismo origen. Con dos copias, el próximo cambio se hace en una. */
function AccionesReglamento({ clase = '' }: { clase?: string }) {
  return (
    <div className={`flex flex-col sm:flex-row gap-4 ${clase}`}>
      <a
        href={RUTA_REGLAMENTO}
        target="_blank"
        rel="noopener noreferrer"
        /* Arranca con el texto visible para no romper el control por voz
           (WCAG 2.5.3, "Label in Name") y agrega lo que el texto no dice. */
        aria-label="Abrir en pestaña nueva el reglamento en PDF"
        className={CLASE_ACCION_PRIMARIA}
      >
        <ExternalLink className="w-5 h-5 shrink-0" aria-hidden="true" />
        Abrir en pestaña nueva
      </a>

      <a
        href={RUTA_REGLAMENTO}
        download={NOMBRE_DESCARGA}
        /* Arranca con la cadena visible EXACTA —"Descargar PDF (339 KB)"— y recién después
           amplía. Si se intercalan palabras en el medio, quien navega por voz dice lo que
           lee en pantalla y el control no existe (WCAG 2.5.3). */
        aria-label={`Descargar PDF (${PESO_REGLAMENTO}) del reglamento de la LQC 2026`}
        className={CLASE_ACCION_SECUNDARIA}
      >
        <Download className="w-5 h-5 shrink-0" aria-hidden="true" />
        {/* El peso es texto visible, no solo del aria-label: la decisión de gastar datos
            móviles la toma quien ve la pantalla. */}
        Descargar PDF <span className="text-gray-400">({PESO_REGLAMENTO})</span>
      </a>
    </div>
  )
}

/* Lo que se muestra cuando no hay visor. Dos caminos llegan acá, y NO son la misma
   situación, por eso hay dos variantes:

   - `variante="reserva"` — dispositivo táctil o navegador sin visor de PDF, donde el
     <object> ni se monta. Acá no falló nada: es la página eligiendo no montar un visor que
     en ese dispositivo se vería roto. Por eso se pinta como una tarjeta completa, con su
     borde de acento y su título, y el texto explica la decisión en vez de disculparse. Es
     lo único que ocupa el lugar del visor en un teléfono, así que tiene que leerse como
     una pieza puesta a propósito y no como un aviso de error.
   - `variante="fallback"` — contenido de reserva DENTRO del <object>, o sea que el PDF de
     verdad no se pudo mostrar. Va SIN tarjeta propia (sin borde, sin fondo, sin radio):
     el <object> ya vive dentro de un marco, y una tarjeta bordeada dentro de otra deja
     una caja chica flotando en un recuadro vacío de 520px. Esto era antes el argumento
     para no ponerle borde al marco; con las dos variantes el marco puede tenerlo.

   Sobre el fallback, con precisión, porque es fácil confiarse de más: el navegador lo pinta
   cuando no pudo OBTENER el recurso (404, error de red) o cuando no tiene manejador para el
   tipo MIME. NO lo pinta cuando sí sabe abrir el PDF pero lo dibuja mal —el caso de iOS—,
   porque para el navegador la carga fue un éxito. O sea que el fallback NO es la red de
   seguridad del móvil: esa es la variante `reserva` más las dos acciones de arriba. Lo que
   sí cubre, y por eso vale la pena, es que alguien borre o renombre el PDF de public/: ahí
   el usuario ve este texto en vez de un marco roto.
   Aun así es <object> y no <iframe>, por dos razones: el <iframe> muestra su contenido de
   reserva únicamente si el navegador no soporta iframes (nunca, en la práctica), y la capa
   base de index.css le aplica a TODO iframe un `iframe:hover { transform: translateY(-2px) }`
   que haría saltar el visor al pasar el mouse. No "simplificar" a <iframe>. */
function SinVisor({ variante }: { variante: 'reserva' | 'fallback' }) {
  if (variante === 'fallback') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <FileText className="w-8 h-8 text-lqc-accent" aria-hidden="true" />
        <p className="text-gray-300 leading-relaxed max-w-md">
          Tu navegador no pudo mostrar el PDF dentro de la página. Ábrelo en una pestaña
          nueva o descárgalo con las acciones del inicio de la página.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-black/40 backdrop-blur-sm border border-lqc-accent/20 rounded-2xl p-8 md:p-12 text-center shadow-lqc">
      <div className="w-14 h-14 mx-auto mb-6 rounded-xl bg-black/40 border border-lqc-accent/30 flex items-center justify-center">
        <FileText className="w-7 h-7 text-lqc-accent" aria-hidden="true" />
      </div>
      <p className="text-xl md:text-2xl font-light text-white mb-4">
        Aquí el PDF se lee mejor aparte
      </p>
      {/* Neutro entre los TRES motivos por los que se llega acá, no solo el táctil:
          `leerVisorDisponible` también devuelve false en un escritorio con mouse cuyo
          navegador está configurado para descargar los PDF en vez de abrirlos, y en una
          ventana de escritorio angosta. Hablarle de "tu pantalla táctil" a quien está en
          una laptop corporativa es decirle algo que no es cierto. */}
      <p className="text-gray-300 leading-relaxed max-w-xl mx-auto">
        En este dispositivo el visor incrustado no se comporta bien: en pantallas táctiles
        queda sin controles de zoom ni desplazamiento, y hay navegadores configurados para
        descargar los PDF en vez de mostrarlos. El reglamento completo se lee igual, en su
        propia pestaña o descargado.
      </p>
      {/* Las acciones se repiten acá, y es la única duplicación que vale la pena en esta
          página: en un teléfono esta tarjeta ES lo que ocupa el lugar del visor, y con el
          bloque «Qué cubre» arriba las acciones de la tarjeta de encabezado quedan a casi
          una pantalla de scroll. Una tarjeta que dice "usá los botones de arriba" con los
          botones fuera de la vista es justo lo que se siente como un mensaje de error. */}
      <AccionesReglamento clase="mt-8 sm:justify-center" />
    </div>
  )
}

export default function Reglamento() {
  const visorDisponible = useVisorDisponible()

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white">
      {/* Fondo decorativo, igual que el resto de las páginas públicas. */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="h-full w-full bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:30px_30px]" />
        </div>
      </div>

      <div className="relative z-10">
        {/* Hero. El h1 toma Orbitron de la regla base de index.css (h1–h6). */}
        <section className="pt-24 pb-12 md:pt-32 md:pb-16">
          <div className="container mx-auto px-6 max-w-5xl text-center">
            <h1 className="text-5xl md:text-7xl font-extralight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-lqc-accent mb-6">
              Reglamento
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Las reglas oficiales de la League Querétaro Championship: formato de
              competencia, requisitos de los equipos y conducta dentro y fuera del juego.
            </p>
          </div>
        </section>

        {/* Acciones. Van ARRIBA del visor y fuera de él a propósito: son el único camino que
            funciona en todos los dispositivos, así que no pueden depender de que el visor
            haya cargado ni quedar debajo de una pantalla entera de PDF.
            Antes eran dos botones sueltos centrados a 40px del visor, y con el marco del
            visor abajo se leían como parte de él: nada decía dónde terminaba una cosa y
            empezaba la otra. Ahora viven en su propia tarjeta, con el archivo nombrado a la
            izquierda y las acciones a la derecha, y la tarjeta se cierra con espacio real
            antes de lo que sigue (`pb-14 md:pb-20`, contra el `pb-10` de antes).
            En móvil se apilan a ancho completo (`flex-col`), que es donde más importan. */}
        <section className="pb-14 md:pb-20">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="bg-gradient-to-br from-blue-950/30 to-lqc-900/20 backdrop-blur-sm border border-blue-800/30 rounded-2xl p-6 md:p-8 shadow-lqc flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 lg:gap-10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-black/40 border border-blue-700/40 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-lqc-accent" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-lg md:text-xl font-medium text-white mb-1.5">
                    Reglamento LQC 2026
                  </p>
                  <p className="text-sm text-gray-400">Documento completo, en PDF.</p>
                </div>
              </div>

              {/* `lg:shrink-0` para que los dos botones nunca se compriman a costa del
                  texto de la izquierda cuando entran en la misma fila. */}
              <AccionesReglamento clase="lg:shrink-0" />
            </div>
          </div>
        </section>

        {/* Qué cubre. Va ANTES del visor, no después: el visor mide una pantalla completa,
            así que cualquier cosa puesta debajo solo la ve quien ya decidió leer el PDF —y
            esta lista existe justamente para quien todavía no lo decidió. En móvil, donde el
            visor no se monta, es además el primer contenido real de la página.
            Solo títulos: ver el comentario de SECCIONES_REGLAMENTO. */}
        <section className="pb-14 md:pb-20" aria-labelledby="titulo-secciones">
          <div className="container mx-auto px-6 max-w-5xl">
            {/* Mismo encabezado de sección que usa TituloSeccion en Registro.tsx: la barra
                de gradiente más el h2 en font-light. */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
              <h2 id="titulo-secciones" className="text-2xl md:text-3xl font-light">
                Qué cubre
              </h2>
            </div>

            <p className="text-gray-400 leading-relaxed mb-8 max-w-3xl">
              Las secciones del documento, en el orden en que aparecen. Lo que dice cada una
              está en el PDF: es la versión que rige.
            </p>

            {/* <ol> y no <ul>: el orden es el del documento y es información, no adorno.
                Los `role` van explícitos porque el preflight de Tailwind aplica
                `list-style: none` a toda lista y encima esto es un grid con ítems flex:
                cualquiera de las dos cosas alcanza para que Safari/VoiceOver le quite el rol
                de lista y deje de anunciar "elemento X de Y". Con el número en aria-hidden,
                sin los roles no quedaría NADA que transmita la numeración.
                Y el número va aria-hidden justamente porque la lista ya la transmite:
                leerlo dos veces sobra. Las dos decisiones se sostienen juntas — si se saca
                una hay que sacar la otra. */}
            <ol role="list" className="grid gap-3 sm:grid-cols-2">
              {SECCIONES_REGLAMENTO.map((seccion, indice) => (
                <li
                  key={seccion}
                  role="listitem"
                  className="flex items-start gap-3.5 rounded-xl bg-black/30 border border-white/5 px-4 py-3.5"
                >
                  <span
                    className="font-heading text-sm text-lqc-accent/70 tabular-nums shrink-0 mt-0.5"
                    aria-hidden="true"
                  >
                    {String(indice + 1).padStart(2, '0')}
                  </span>
                  <span className="text-sm md:text-base text-gray-200">{seccion}</span>
                </li>
              ))}
            </ol>

            <p className="mt-8 flex items-start gap-2 text-sm text-gray-500">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Esta lista es solo el índice de títulos, no el reglamento. El PDF es la
                versión oficial y vigente.
              </span>
            </p>
          </div>
        </section>

        {/* Visor */}
        <section className="pb-20 md:pb-28" aria-labelledby="titulo-documento">
          <div className="container mx-auto px-6 max-w-5xl">
            {/* Encabezado solo para lectores de pantalla: sin él, quien navega saltando de
                encabezado en encabezado pasa de «Qué cubre» directo al pie, sin nada que le
                diga que acá está el documento. Visualmente no hace falta: el visor se
                explica solo. */}
            <h2 id="titulo-documento" className="sr-only">Documento</h2>
            {visorDisponible ? (
              /* Marco del visor. El <object> ya no va desnudo contra el fondo de la página:
                 el padding le da un margen visible que lo separa de la tarjeta de acciones y
                 el borde suave le cierra la caja, así que se lee como una pieza y no como un
                 recorte pegado al scroll. Antes esto no se podía porque el contenido de
                 reserva del <object> traía SU PROPIO borde y quedaba una tarjeta dentro de
                 otra; ahora ese contenido es la variante `fallback`, que no tiene marco. */
              <div className="rounded-2xl border border-white/10 bg-black/40 p-2 md:p-3 shadow-lqc">
                <object
                  data={RUTA_REGLAMENTO}
                  type="application/pdf"
                  /* `title` y `aria-label`: sin un nombre accesible, un lector de pantalla
                      anuncia el contenido embebido solo como "marco" o "objeto". */
                  title="Reglamento de la LQC 2026 (documento PDF)"
                  aria-label="Reglamento de la LQC 2026 (documento PDF)"
                  /* La altura se mide contra el header sticky, que es lo que antes no hacía.
                     Antes era una altura fija de 80vh con el mismo piso de 520px: entraba
                     entre la barra y el borde inferior, pero al ras —en una ventana de 800px
                     de alto quedaban unos 39px de holgura de cada lado—, así que en cualquier
                     posición del scroll el visor se veía tocando el header o el borde de
                     abajo. `100vh - 11rem` descuenta el header (`md:h-20` = 5rem, 81px con su
                     borde inferior) más unos 6rem de aire, y con eso el visor cae con holgura
                     visible en vez de rozar.
                     El header a descontar es siempre el de escritorio: el visor se monta solo
                     desde 768px, nunca con el `h-18` del móvil. Y las dos medidas van en rem,
                     así que la cuenta se sostiene sola si cambia el tamaño de fuente base
                     —cosa que pasa: index.css baja a 14px justo en 768px—.
                     `min-h` para que en una laptop de pantalla baja el visor siga siendo
                     legible, y `max-h` para que en un monitor vertical no crezca a 1400px de
                     PDF. Ojo con el piso: por debajo de unos 627px de alto de ventana vuelve
                     a no entrar completo. Es a propósito — un visor de menos de 520px no se
                     puede leer, y para eso están las dos acciones de arriba. */
                  className="w-full h-[calc(100vh-11rem)] min-h-[520px] max-h-[860px] rounded-xl"
                >
                  <SinVisor variante="fallback" />
                </object>
              </div>
            ) : (
              <SinVisor variante="reserva" />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
