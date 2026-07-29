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

/* Lo que se muestra cuando no hay visor. Dos caminos llegan acá:
   1. dispositivo táctil o sin visor de PDF, donde el <object> ni se monta;
   2. contenido de reserva DENTRO del <object>.

   Sobre el punto 2, con precisión, porque es fácil confiarse de más: el navegador pinta ese
   contenido cuando no pudo OBTENER el recurso (404, error de red) o cuando no tiene manejador
   para el tipo MIME. NO lo pinta cuando sí sabe abrir el PDF pero lo dibuja mal —el caso de
   iOS—, porque para el navegador la carga fue un éxito. O sea que el fallback NO es la red de
   seguridad del móvil: esa son las dos acciones de arriba. Lo que sí cubre, y por eso vale la
   pena, es que alguien borre o renombre el PDF de public/: ahí el usuario ve esta tarjeta en
   vez de un marco roto.
   Aun así es <object> y no <iframe>, por dos razones: el <iframe> muestra su contenido de
   reserva únicamente si el navegador no soporta iframes (nunca, en la práctica), y la capa
   base de index.css le aplica a TODO iframe un `iframe:hover { transform: translateY(-2px) }`
   que haría saltar el visor al pasar el mouse. No "simplificar" a <iframe>. */
function SinVisor({ texto }: { texto: string }) {
  return (
    <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-10 text-center">
      <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-900/40 to-blue-800/30 flex items-center justify-center">
        <FileText className="w-7 h-7 text-blue-400" />
      </div>
      <p className="text-gray-300 leading-relaxed max-w-xl mx-auto">{texto}</p>
      <p className="mt-4 text-sm text-gray-500">
        Usa las opciones de arriba para abrirlo o descargarlo.
      </p>
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
            haya cargado ni quedar debajo de 80vh de PDF.
            En móvil se apilan a ancho completo (`flex-col`), que es donde más importan. */}
        <section className="pb-10">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="flex flex-col sm:flex-row sm:justify-center gap-4">
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
                /* Arranca con la cadena visible EXACTA —"Descargar PDF (339 KB)"— y recién
                   después amplía. Si se intercalan palabras en el medio, quien navega por voz
                   dice lo que lee en pantalla y el control no existe (WCAG 2.5.3). */
                aria-label={`Descargar PDF (${PESO_REGLAMENTO}) del reglamento de la LQC 2026`}
                className={CLASE_ACCION_SECUNDARIA}
              >
                <Download className="w-5 h-5 shrink-0" aria-hidden="true" />
                {/* El peso es texto visible, no solo del aria-label: la decisión de gastar
                    datos móviles la toma quien ve la pantalla. */}
                Descargar PDF <span className="text-gray-400">({PESO_REGLAMENTO})</span>
              </a>
            </div>
          </div>
        </section>

        {/* Visor */}
        <section className="pb-24" aria-labelledby="titulo-documento">
          <div className="container mx-auto px-6 max-w-5xl">
            {/* Encabezado solo para lectores de pantalla: sin él, quien navega saltando de
                encabezado en encabezado pasa del h1 directo al pie, sin nada que le diga que
                acá está el documento. Visualmente no hace falta: el visor se explica solo. */}
            <h2 id="titulo-documento" className="sr-only">Documento</h2>
            {visorDisponible ? (
              <object
                data={RUTA_REGLAMENTO}
                type="application/pdf"
                /* `title` y `aria-label`: sin un nombre accesible, un lector de pantalla
                    anuncia el contenido embebido solo como "marco" o "objeto". */
                title="Reglamento de la LQC 2026 (documento PDF)"
                aria-label="Reglamento de la LQC 2026 (documento PDF)"
                /* Sin `border` ni fondo propio: el visor del navegador trae el suyo, y cuando
                   se pinta el contenido de reserva —que ya es una tarjeta con borde— quedaba
                   una tarjeta chica dentro de una caja vacía y bordeada de 520px. */
                className="w-full h-[80vh] min-h-[520px] rounded-2xl"
              >
                <SinVisor texto="Tu navegador no pudo mostrar el PDF dentro de la página." />
              </object>
            ) : (
              <SinVisor texto="En este dispositivo el reglamento se lee mejor abierto en su propia pestaña o descargado." />
            )}

            <p className="mt-6 flex items-start gap-2 text-sm text-gray-500">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                El PDF es la versión oficial y vigente del reglamento.
              </span>
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
