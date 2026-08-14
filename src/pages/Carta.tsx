import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Download, Loader2, Search } from 'lucide-react'
import { obtenerCampeones, obtenerVersion, splashUrl, squareUrl, VERSION_FALLBACK } from '../lib/datadragon'
import type { Campeon } from '../lib/datadragon'

type Modo = 'vertical' | 'horizontal'

/* Medidas de EXPORTACIÓN. El canvas siempre tiene este tamaño real; la vista previa lo
   encoge por CSS. */
const MEDIDAS: Record<Modo, { ancho: number; alto: number }> = {
  vertical: { ancho: 1080, alto: 1920 },
  horizontal: { ancho: 1280, alto: 720 }
}

const FONDO = '#0a1420'
const FONDO_RGB = '10, 20, 32'
const AZUL_BORDE = '#185FA5'
const AZUL_TEXTO = '#378ADD'
const GRIS_TEXTO = '#c8d2dc'
const GROSOR_BORDE = 8

/* TRAMPA: el canvas NO hereda las @font-face del CSS. Orbitron —la tipo de marca que
   index.css le da a los titulares— no aparece acá aunque la página la esté usando: para
   eso habría que cargarla con la FontFace API y esperar `document.fonts.load(...)` ANTES
   de dibujar. Mientras tanto, familias del sistema. */
const FUENTE_TITULO = "'Arial Black', 'Impact', sans-serif"
const FUENTE_TEXTO = "'Segoe UI', Arial, sans-serif"

const URL_LOGO = '/assets/2 LQC.png'

const MAX_NICK = 16
const MAX_FRASE = 24

const AVISO_CATALOGO = 'No se pudo cargar el catálogo de campeones. Recargá la página.'
const AVISO_EXPORT = 'No se pudo generar la imagen. Probá de nuevo.'

/* Descargo de Riot Games. Es un REQUISITO legal por usar su arte y sus marcas, no un
   adorno: no se saca, no se resume y no se traduce de nuevo. El texto es literal.
   Va en una constante y no suelto en el JSX para que se pueda comparar carácter por
   carácter contra el original sin pelear con cómo JSX colapsa los saltos de línea. */
const AVISO_RIOT =
  'LQC no está avalado por Riot Games y no refleja los puntos de vista u opiniones de ' +
  'Riot Games o de cualquier persona involucrada oficialmente en la producción o gestión ' +
  'de las propiedades de Riot Games. Riot Games y todas las propiedades asociadas son ' +
  'marcas comerciales o marcas registradas de Riot Games, Inc.'

/* Clases a nivel de módulo: adentro del componente se recrearían en cada render, los
   inputs se remontarían y el foco se perdería al escribir (ver Registro.tsx). */
const CLASE_INPUT =
  'w-full px-4 py-3.5 bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all'
const CLASE_INPUT_BUSCADOR = `${CLASE_INPUT} pl-12`
const CLASE_ETIQUETA = 'block text-sm font-medium text-gray-300 mb-2'

/* `bg-none` NO va en la base: es una utilidad de `background-image` igual que
   `bg-gradient-to-r`, y entre dos del mismo grupo gana el orden del CSS generado, no el
   del atributo. Cada variante la lleva o no según le corresponda. Mismo criterio que
   BTN_BASE en ListaInscripciones.tsx. */
const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-sans font-medium tracking-normal transition-colors duration-200 hover:[transform:none] hover:shadow-none disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lqc-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black'
const BTN_DESCARGAR =
  `${BTN_BASE} w-full border-0 px-8 py-4 text-base bg-gradient-to-r from-lqc-700 to-lqc-500 text-white hover:from-lqc-600 hover:to-lqc-400 shadow-lg shadow-blue-900/30`

/* Las dos variantes se escriben COMPLETAS en vez de apilar la activa sobre la base: dos
   utilidades del mismo grupo no se pisan por orden de escritura. */
const BTN_MODO_BASE =
  'flex-1 inline-flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-sans font-medium tracking-normal transition-colors duration-200 hover:[transform:none] hover:shadow-none'
const BTN_MODO_ACTIVO = `${BTN_MODO_BASE} bg-none bg-blue-950/60 border-blue-600/70 text-white`
const BTN_MODO_INACTIVO = `${BTN_MODO_BASE} bg-none bg-black/40 border-blue-900/30 text-gray-400 hover:border-blue-700/50 hover:text-gray-200`

const BTN_CAMPEON_BASE =
  'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm font-sans font-medium tracking-normal transition-colors duration-150 hover:[transform:none] hover:shadow-none'
const BTN_CAMPEON = `${BTN_CAMPEON_BASE} bg-none bg-transparent border-transparent text-gray-300 hover:bg-blue-950/40 hover:text-white`
const BTN_CAMPEON_ELEGIDO = `${BTN_CAMPEON_BASE} bg-none bg-blue-950/60 border-blue-600/60 text-white`

/* ------------------------------------------------------------------ */
/*  Utilidades puras                                                   */
/* ------------------------------------------------------------------ */

/* NFD separa cada letra de su tilde y el rango U+0300–U+036F borra las tildes ya sueltas,
   para que «Séraphine» se encuentre escribiendo «seraphine». El rango va con escapes y no
   con los caracteres literales: son marcas combinantes, o sea invisibles en el editor. */
const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function nombreArchivo(nick: string): string {
  const limpio = normalizar(nick).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return limpio || 'jugador'
}

/* Recorta con «…» si no entra. El maxLength de los inputs no alcanza: 16 caracteres
   anchos miden mucho más que 16 angostos, así que hay que medir de verdad. */
function textoAjustado(ctx: CanvasRenderingContext2D, texto: string, anchoMax: number): string {
  if (ctx.measureText(texto).width <= anchoMax) return texto
  let recorte = texto
  while (recorte.length > 1 && ctx.measureText(`${recorte}…`).width > anchoMax) {
    recorte = recorte.slice(0, -1)
  }
  return `${recorte}…`
}

/* TRAMPA CORS: `crossOrigin` tiene que fijarse ANTES de `.src`. Después ya es tarde —el
   navegador arrancó la carga sin modo CORS, el canvas queda «tainted» y `toBlob()` lanza
   SecurityError: la carta se ve en pantalla pero no se puede descargar.
   Nunca rechaza: el arte que no carga resuelve a null y la carta se dibuja sin él. */
function cargarImagen(src: string, anonimo: boolean): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    if (anonimo) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/* Caché de una sola entrada, que es lo que hace falta: se dibuja un campeón por vez y
   cada tecla del nick redibuja. Sin esto, escribir el nick redecodifica el splash entero
   en cada pulsación. Guarda la promesa y no la imagen para que dos redibujos seguidos no
   disparen dos cargas. */
let artePendiente: { url: string; promesa: Promise<HTMLImageElement | null> } | null = null
function obtenerArte(url: string): Promise<HTMLImageElement | null> {
  if (artePendiente?.url !== url) artePendiente = { url, promesa: cargarImagen(url, true) }
  return artePendiente.promesa
}

let logoPendiente: Promise<HTMLImageElement | null> | null = null
function obtenerLogo(): Promise<HTMLImageElement | null> {
  /* Mismo origen: no necesita crossOrigin y no contamina el canvas. */
  if (!logoPendiente) logoPendiente = cargarImagen(URL_LOGO, false)
  return logoPendiente
}

/* ------------------------------------------------------------------ */
/*  Dibujo                                                             */
/* ------------------------------------------------------------------ */

type DatosCarta = {
  ancho: number
  alto: number
  arte: HTMLImageElement | null
  logo: HTMLImageElement | null
  nick: string
  campeon: string
  frase: string
}

/* `object-fit: cover` a mano: escala para llenar sin deformar y centra el recorte. Si
   algún campeón queda mal encuadrado en vertical, el ajuste es el 0.5 del eje X. */
function dibujarCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  ancho: number,
  alto: number
) {
  const escala = Math.max(ancho / img.width, alto / img.height)
  const w = img.width * escala
  const h = img.height * escala
  ctx.drawImage(img, x + (ancho - w) * 0.5, y + (alto - h) * 0.5, w, h)
}

function dibujarLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, x: number, y: number, alto: number) {
  ctx.drawImage(logo, x, y, (logo.width / logo.height) * alto, alto)
}

/* La misma barrita azul que encabeza las secciones del sitio. */
function barraAcento(ctx: CanvasRenderingContext2D, x: number, y: number, ancho: number, alto: number) {
  const grad = ctx.createLinearGradient(x, y + alto, x, y)
  grad.addColorStop(0, '#155dfc')
  grad.addColorStop(1, '#51a2ff')
  ctx.fillStyle = grad
  ctx.fillRect(x, y, ancho, alto)
}

function dibujarHorizontal(ctx: CanvasRenderingContext2D, d: DatosCarta) {
  if (d.arte) dibujarCover(ctx, d.arte, 0, 0, d.ancho, d.alto)

  /* Fundido hacia la izquierda: el arte queda a la derecha y el texto sobre fondo plano. */
  const velo = ctx.createLinearGradient(0, 0, d.ancho, 0)
  velo.addColorStop(0, `rgba(${FONDO_RGB}, 1)`)
  velo.addColorStop(0.42, `rgba(${FONDO_RGB}, 0.94)`)
  velo.addColorStop(1, `rgba(${FONDO_RGB}, 0)`)
  ctx.fillStyle = velo
  ctx.fillRect(0, 0, d.ancho, d.alto)

  if (d.logo) dibujarLogo(ctx, d.logo, 76, 62, 56)
  barraAcento(ctx, 76, 302, 8, 250)

  const x = 108
  const anchoMax = 600

  ctx.font = `92px ${FUENTE_TITULO}`
  ctx.fillStyle = '#ffffff'
  ctx.fillText(textoAjustado(ctx, d.nick, anchoMax), x, 400)

  if (d.campeon) {
    ctx.font = `bold 42px ${FUENTE_TEXTO}`
    ctx.fillStyle = AZUL_TEXTO
    ctx.fillText(textoAjustado(ctx, d.campeon, anchoMax), x, 462)
  }

  if (d.frase) {
    ctx.font = `30px ${FUENTE_TEXTO}`
    ctx.fillStyle = GRIS_TEXTO
    ctx.fillText(textoAjustado(ctx, d.frase, anchoMax), x, 516)
  }
}

function dibujarVertical(ctx: CanvasRenderingContext2D, d: DatosCarta) {
  const altoArte = 1300

  if (d.arte) dibujarCover(ctx, d.arte, 0, 0, d.ancho, altoArte)

  /* Fundido hacia abajo + banda sólida: el texto nunca cae sobre el arte. */
  const inicioVelo = altoArte * 0.55
  const velo = ctx.createLinearGradient(0, inicioVelo, 0, altoArte)
  velo.addColorStop(0, `rgba(${FONDO_RGB}, 0)`)
  velo.addColorStop(1, `rgba(${FONDO_RGB}, 1)`)
  ctx.fillStyle = velo
  ctx.fillRect(0, inicioVelo, d.ancho, altoArte - inicioVelo)

  ctx.fillStyle = FONDO
  ctx.fillRect(0, altoArte, d.ancho, d.alto - altoArte)

  if (d.logo) dibujarLogo(ctx, d.logo, 88, 1376, 76)
  barraAcento(ctx, 88, 1512, 10, 268)

  const x = 128
  const anchoMax = 864

  ctx.font = `112px ${FUENTE_TITULO}`
  ctx.fillStyle = '#ffffff'
  ctx.fillText(textoAjustado(ctx, d.nick, anchoMax), x, 1606)

  if (d.campeon) {
    ctx.font = `bold 50px ${FUENTE_TEXTO}`
    ctx.fillStyle = AZUL_TEXTO
    ctx.fillText(textoAjustado(ctx, d.campeon, anchoMax), x, 1682)
  }

  if (d.frase) {
    ctx.font = `36px ${FUENTE_TEXTO}`
    ctx.fillStyle = GRIS_TEXTO
    ctx.fillText(textoAjustado(ctx, d.frase, anchoMax), x, 1744)
  }
}

function dibujarCarta(ctx: CanvasRenderingContext2D, modo: Modo, d: DatosCarta) {
  ctx.fillStyle = FONDO
  ctx.fillRect(0, 0, d.ancho, d.alto)
  ctx.textBaseline = 'alphabetic'

  if (modo === 'horizontal') dibujarHorizontal(ctx, d)
  else dibujarVertical(ctx, d)

  ctx.strokeStyle = AZUL_BORDE
  ctx.lineWidth = GROSOR_BORDE
  ctx.strokeRect(GROSOR_BORDE / 2, GROSOR_BORDE / 2, d.ancho - GROSOR_BORDE, d.alto - GROSOR_BORDE)
}

/* ------------------------------------------------------------------ */

export default function Carta() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [version, setVersion] = useState(VERSION_FALLBACK)
  const [campeones, setCampeones] = useState<Campeon[]>([])
  const [cargando, setCargando] = useState(true)

  const [nick, setNick] = useState('')
  const [frase, setFrase] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [elegido, setElegido] = useState<Campeon | null>(null)
  const [modo, setModo] = useState<Modo>('vertical')
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true

    const cargar = async () => {
      const v = await obtenerVersion()
      if (!vigente) return
      setVersion(v)

      const lista = await obtenerCampeones(v)
      if (!vigente) return
      setCampeones(lista)
      setCargando(false)
    }

    void cargar()
    return () => { vigente = false }
  }, [])

  /* Redibuja ante cualquier cambio. Las imágenes se cargan ANTES de tocar el canvas: si se
     redimensionara primero, el lienzo quedaría en blanco mientras llega el arte. */
  useEffect(() => {
    let vigente = true

    const pintar = async () => {
      const [logo, arte] = await Promise.all([
        obtenerLogo(),
        elegido ? obtenerArte(splashUrl(elegido.id)) : Promise.resolve(null)
      ])
      if (!vigente) return

      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const { ancho, alto } = MEDIDAS[modo]
      canvas.width = ancho
      canvas.height = alto

      dibujarCarta(ctx, modo, {
        ancho,
        alto,
        arte,
        logo,
        nick: nick.trim() || 'TU NICK',
        campeon: elegido?.name ?? '',
        frase: frase.trim()
      })
    }

    void pintar()
    return () => { vigente = false }
  }, [modo, elegido, nick, frase])

  const filtrados = useMemo(() => {
    const termino = normalizar(busqueda.trim())
    if (!termino) return campeones
    return campeones.filter(c => normalizar(c.name).includes(termino))
  }, [campeones, busqueda])

  const descargar = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setAviso(null)

    try {
      canvas.toBlob(blob => {
        if (!blob) {
          setAviso(AVISO_EXPORT)
          return
        }
        const url = URL.createObjectURL(blob)
        const enlace = document.createElement('a')
        enlace.href = url
        enlace.download = `carta-lqc-${nombreArchivo(nick)}.png`
        enlace.click()
        /* Revocar en el mismo tick corta la descarga en algunos navegadores. */
        setTimeout(() => URL.revokeObjectURL(url), 0)
      }, 'image/png')
    } catch {
      /* `toBlob` lanza SecurityError si el canvas quedó contaminado. Sin console: el
         invariante de cero salida por consola vale para todo src/. */
      setAviso(AVISO_EXPORT)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white">
      {/* Fondo decorativo, igual que el resto de las páginas públicas */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="h-full w-full bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:30px_30px]" />
        </div>
        <img
          src="/assets/LOGO COPA.png"
          alt=""
          aria-hidden="true"
          className="
            absolute
            -left-[60%] sm:-left-[40%] md:-left-[30%] lg:-left-[20%] xl:-left-[10%]
            top-[10%] sm:top-[5%]
            w-[110%] sm:w-[90%] md:w-[80%] lg:w-[70%] xl:w-[60%]
            max-w-none opacity-10
            animate-float-slow pointer-events-none blur-[1px]
          "
        />
      </div>

      <div className="relative z-10">
        <section className="py-32 md:py-40">
          <div className="container mx-auto px-6 max-w-5xl text-center">
            <h1 className="text-5xl md:text-7xl font-extralight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-lqc-accent">
              Carta de Jugador
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto mt-6 leading-relaxed">
              Armá tu carta con tu nick y tu campeón, y descargala para compartirla.
            </p>
          </div>
        </section>

        <section className="pb-24">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid gap-12 lg:grid-cols-2">
              {/* Controles */}
              <div>
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
                  <h2 className="text-3xl font-light">Tu carta</h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label htmlFor="nick" className={CLASE_ETIQUETA}>Nick</label>
                    <input
                      id="nick"
                      type="text"
                      value={nick}
                      onChange={e => setNick(e.target.value)}
                      maxLength={MAX_NICK}
                      placeholder="Tu nick"
                      className={CLASE_INPUT}
                    />
                  </div>

                  <div>
                    <label htmlFor="frase" className={CLASE_ETIQUETA}>
                      Equipo o frase <span className="text-gray-500">(opcional)</span>
                    </label>
                    <input
                      id="frase"
                      type="text"
                      value={frase}
                      onChange={e => setFrase(e.target.value)}
                      maxLength={MAX_FRASE}
                      placeholder="Tu equipo o frase"
                      className={CLASE_INPUT}
                    />
                  </div>

                  <div>
                    <label htmlFor="campeon" className={CLASE_ETIQUETA}>
                      Campeón{elegido ? <span className="text-blue-300"> — {elegido.name}</span> : null}
                    </label>

                    {cargando ? (
                      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3.5 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                        Cargando campeones…
                      </div>
                    ) : campeones.length === 0 ? (
                      <div className="flex items-start gap-3 rounded-xl border border-rose-800/40 bg-rose-950/20 px-4 py-3.5 text-sm text-rose-200">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                        <span>{AVISO_CATALOGO}</span>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search
                            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"
                            aria-hidden="true"
                          />
                          <input
                            id="campeon"
                            type="text"
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            placeholder="Buscar campeón"
                            autoComplete="off"
                            className={CLASE_INPUT_BUSCADOR}
                          />
                        </div>

                        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto rounded-xl border border-white/5 bg-black/20 p-2">
                          {filtrados.length === 0 ? (
                            <p className="px-3 py-4 text-sm text-gray-500">Ningún campeón con ese nombre.</p>
                          ) : (
                            filtrados.map(campeon => (
                              <button
                                key={campeon.id}
                                type="button"
                                onClick={() => setElegido(campeon)}
                                className={elegido?.id === campeon.id ? BTN_CAMPEON_ELEGIDO : BTN_CAMPEON}
                              >
                                <img
                                  src={squareUrl(campeon.id, version)}
                                  alt=""
                                  aria-hidden="true"
                                  loading="lazy"
                                  className="h-9 w-9 shrink-0 rounded border border-white/10"
                                />
                                <span className="truncate">{campeon.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div>
                    <span className={CLASE_ETIQUETA}>Formato</span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setModo('vertical')}
                        aria-pressed={modo === 'vertical'}
                        className={modo === 'vertical' ? BTN_MODO_ACTIVO : BTN_MODO_INACTIVO}
                      >
                        Vertical
                      </button>
                      <button
                        type="button"
                        onClick={() => setModo('horizontal')}
                        aria-pressed={modo === 'horizontal'}
                        className={modo === 'horizontal' ? BTN_MODO_ACTIVO : BTN_MODO_INACTIVO}
                      >
                        Horizontal
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button type="button" onClick={descargar} className={BTN_DESCARGAR}>
                      <Download className="h-5 w-5 shrink-0" aria-hidden="true" />
                      Descargar PNG
                    </button>

                    {aviso ? (
                      <div
                        role="status"
                        className="mt-4 flex items-start gap-3 rounded-xl border border-rose-800/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-200"
                      >
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                        <span>{aviso}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Vista previa */}
              <div>
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
                  <h2 className="text-3xl font-light">Vista previa</h2>
                </div>

                <div className={modo === 'vertical' ? 'mx-auto w-full max-w-[300px]' : 'mx-auto w-full max-w-[560px]'}>
                  <canvas
                    ref={canvasRef}
                    aria-label="Vista previa de tu carta de jugador"
                    className="h-auto w-full rounded-xl border border-white/10 shadow-2xl shadow-black/60"
                  />
                </div>

                <p className="mt-4 text-center text-sm text-gray-500">
                  {MEDIDAS[modo].ancho} × {MEDIDAS[modo].alto} px
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Descargo de Riot. Atenuado pero legible, y separado por un filo: tiene que
            leerse como pie legal de la página y no como una línea más del generador.
            No compite con la feature, pero tampoco se esconde — es un requisito. */}
        <section className="border-t border-white/5 py-12">
          <div className="container mx-auto px-6 max-w-3xl">
            <p className="text-center text-xs leading-relaxed text-gray-500">
              {AVISO_RIOT}
            </p>
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
