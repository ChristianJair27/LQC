import { useEffect, useId, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Inbox,
  Loader2
} from 'lucide-react'
import { obtenerSupabase } from '../../lib/supabase'

/* ------------------------------------------------------------------ */
/*  Datos                                                              */
/* ------------------------------------------------------------------ */

/* Una fila de la tabla `inscripciones` = un jugador. Los nombres de columna son
   los reales del esquema; un typo acá cae en el estado de error genérico. */
type Inscripcion = {
  id: string | number
  equipo: string
  gamertag: string
  nombre: string
  fecha_nacimiento: string
  celular: string
  escolaridad: string
  municipio: string
  localidad: string
  correo: string
  genero: string
  capitan_nombre: string
  capitan_celular: string
  pagado: boolean | null
  pagado_en: string | null
  notas: string | null
  creado_en: string
}

/* Nombres de columna aislados en constantes: si el esquema los renombra, se cambian
   acá (y en las claves del tipo) sin tocar la lógica. `id` es el único nombre que no
   vino literal en el contrato ("los ids de las filas"): se asume la PK por defecto de
   Supabase; si difiere, es un cambio de una sola línea. Las escrituras (pago y notas)
   filtran SIEMPRE por `id` con `.in()`, nunca por el texto del equipo, que se normaliza
   para agrupar y no es clave. */
const COL_ID = 'id' as const
const COL_PAGADO = 'pagado' as const
const COL_PAGADO_EN = 'pagado_en' as const
const COL_NOTAS = 'notas' as const

/* Techo de las escrituras (marcar pago / guardar notas): pasado ese tiempo la query se
   aborta y cae en el mensaje genérico, en vez de dejar la tarjeta trabada en
   "Guardando…". Mismo criterio que el envío de /registro. */
const TIEMPO_LIMITE_MS = 15_000

/* Orden de columnas del contrato de datos, más las de Fase 3 (id, pagado_en, notas). Las
   columnas fecha_nacimiento, escolaridad, municipio, localidad y genero no se pintan en el
   panel, pero se traen para poder exportarlas al CSV (Fase 4) SIN una segunda consulta: la
   exportación arma el archivo con lo que ya está en memoria. */
const SELECT =
  `${COL_ID}, equipo, gamertag, nombre, fecha_nacimiento, celular, escolaridad, municipio, localidad, correo, genero, capitan_nombre, capitan_celular, ${COL_PAGADO}, ${COL_PAGADO_EN}, ${COL_NOTAS}, creado_en`

/* ------------------------------------------------------------------ */
/*  Agrupación por equipo (función pura, fácil de auditar)             */
/* ------------------------------------------------------------------ */

type EquipoAgrupado = {
  clave: string // clave normalizada, única por grupo (sirve de key de React)
  nombre: string // nombre a mostrar = el original de la fila más antigua
  capitanNombre: string
  capitanCelular: string
  jugadores: Inscripcion[] // ordenados por registro, más reciente primero
  pagado: boolean // true solo si TODAS las filas están pagadas
  ids: (string | number)[] // todos los ids del grupo — clave de las escrituras
  pagadoEn: string | null // fecha de pago (de la fila más antigua); null si pendiente
  notas: string // notas del equipo (de la fila más antigua); '' si la columna es null
  ultimaActividad: number // mayor creado_en del grupo (ms) — para ordenar equipos
}

/* "Los Panditas" y "los panditas " deben caer en el mismo grupo. */
function normalizarEquipo(equipo: string): string {
  return equipo.trim().toLowerCase().replace(/\s+/g, ' ')
}

/* creado_en → milisegundos. Se compara por tiempo real, no lexicográficamente,
   por si el timestamp llega con distinto offset. Un valor inválido cae a 0. */
function tiempo(creadoEn: string): number {
  const t = new Date(creadoEn).getTime()
  return Number.isNaN(t) ? 0 : t
}

/* La query llega DESC (lo más reciente primero), así que la fila más antigua es
   la ÚLTIMA ocurrencia del grupo: la buscamos por el mínimo `creado_en` en vez
   de tomar la primera que aparece. Esa fila fija el nombre a mostrar y el capitán
   (determinístico si variaran entre filas). */
function agruparPorEquipo(filas: Inscripcion[]): EquipoAgrupado[] {
  const grupos = new Map<string, Inscripcion[]>()
  for (const fila of filas) {
    /* String(... ?? '') blinda contra una fila con `equipo` nulo: sin el guard,
       `normalizarEquipo(null)` lanzaría y tumbaría todo el listado por una fila. */
    const clave = normalizarEquipo(String(fila.equipo ?? ''))
    const grupo = grupos.get(clave)
    if (grupo) grupo.push(fila)
    else grupos.set(clave, [fila])
  }

  const equipos: EquipoAgrupado[] = []
  for (const [clave, grupo] of grupos) {
    const masAntigua = grupo.reduce((a, b) =>
      tiempo(b.creado_en) < tiempo(a.creado_en) ? b : a
    )
    const ultimaActividad = grupo.reduce(
      (max, f) => Math.max(max, tiempo(f.creado_en)),
      0
    )
    /* El pago es un solo depósito por equipo: el equipo está "Confirmado" solo si
       NO le queda ninguna fila sin saldar. `null`/`false` cuentan como no pagado.
       En Fase 3, el botón de marcar pagado debe setear TODAS las filas del grupo. */
    const pagado = grupo.every((f) => f[COL_PAGADO] === true)
    const jugadores = [...grupo].sort(
      (a, b) => tiempo(b.creado_en) - tiempo(a.creado_en)
    )
    /* Todos los ids del grupo: son la clave de las escrituras (`.in(COL_ID, ids)`),
       nunca el texto normalizado del equipo. */
    const ids = grupo.map((f) => f[COL_ID])

    equipos.push({
      clave,
      nombre: masAntigua.equipo,
      capitanNombre: masAntigua.capitan_nombre,
      capitanCelular: masAntigua.capitan_celular,
      jugadores,
      pagado,
      ids,
      /* pagadoEn y notas salen de la fila más antigua, mismo criterio que el nombre y el
         capitán (determinístico si variaran entre filas). `null` → '' en notas. */
      pagadoEn: masAntigua.pagado_en,
      notas: masAntigua.notas ?? '',
      ultimaActividad
    })
  }

  /* Equipo con actividad más nueva arriba, coherente con "lo más reciente arriba". */
  equipos.sort((a, b) => b.ultimaActividad - a.ultimaActividad)
  return equipos
}

/* ------------------------------------------------------------------ */
/*  Formato                                                            */
/* ------------------------------------------------------------------ */

function fmtFecha(creadoEn: string): string {
  const d = new Date(creadoEn)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

/* Variante con hora para la fecha de pago: `pagado_en` es un timestamp preciso y en el
   panel importa cuándo se marcó. Usa toLocaleString (no toLocaleDateString) para que las
   opciones de hora/minuto tengan efecto. */
function fmtFechaHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/* ------------------------------------------------------------------ */
/*  Exportación a CSV (en el cliente, sin backend)                     */
/* ------------------------------------------------------------------ */

/* Encabezados en español, en el orden exacto del contrato de exportación. Una fila del
   CSV = un jugador; los campos de equipo se repiten en cada jugador del grupo. */
const COLUMNAS_CSV = [
  'Equipo',
  'Gamertag',
  'Nombre',
  'Fecha de Nacimiento',
  'Celular',
  'Escolaridad',
  'Municipio',
  'Localidad',
  'Correo',
  'Género',
  'Capitán',
  'Celular del Capitán',
  'Pagado',
  'Fecha de Pago',
  'Notas',
  'Fecha de Registro'
] as const

/* BOM UTF-8 (U+FEFF). Va al inicio del archivo para que Excel detecte la codificación y
   muestre bien los acentos (á, é, ñ) en vez de caracteres corruptos. Se construye con
   `String.fromCharCode` en vez de pegar el carácter literal (invisible e ilegible en el
   fuente) o un escape `U+FEFF` que se pierde de vista con facilidad. */
const BOM_UTF8 = String.fromCharCode(0xfeff)

/* Fecha solo-día ('YYYY-MM-DD', como se guarda fecha_nacimiento) → 'DD/MM/AAAA'. Se
   parte la cadena a mano en vez de pasar por `new Date()`: `new Date('2000-05-15')` se
   interpreta como medianoche UTC y en Querétaro (UTC−6) mostraría el día anterior (mismo
   cuidado que `fechaLocalISO` en Registro.tsx). Vacío o inválido → celda vacía. */
function fmtFechaSoloDiaCSV(valor: string | null | undefined): string {
  if (!valor) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/* Timestamp ISO (creado_en, pagado_en) → 'DD/MM/AAAA' en fecha LOCAL. Acá sí pasa por
   `Date` porque es un instante con zona; se extraen los componentes locales, no los UTC.
   `null` o inválido → celda vacía (nunca "null"). */
function fmtFechaLocalDiaCSV(valor: string | null | undefined): string {
  if (!valor) return ''
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

/* Escape RFC 4180 + saneo anti-inyección de fórmulas.
   - Anti-inyección: los datos vienen del formulario PÚBLICO /registro (INSERT anónimo), o
     sea entrada NO confiable. Una celda que arranque con `=`, `+`, `-`, `@` (o TAB/CR) la
     interpreta Excel/Sheets como fórmula al abrir el archivo (p. ej. `=HYPERLINK(...)`),
     justo cuando el que abre es un admin. Se le antepone un apóstrofo: Excel lo esconde y
     trata el resto como texto. Va ANTES del quoting para no romperlo.
   - RFC 4180: si el valor trae coma, comilla o salto de línea, se encierra entre comillas
     dobles y cada comilla interna se duplica. Notas es texto libre: el campo con más
     chance de traer comas o saltos, y este escape lo mantiene en una sola celda.
   `null`/`undefined` → '' (nunca la palabra "null"); números → texto. */
function celdaCSV(valor: string | number | null | undefined): string {
  let texto = valor == null ? '' : String(valor)
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/* Arma el CSV completo (con BOM) a partir de los equipos agrupados: una fila por jugador.
   Los campos de equipo (nombre, capitán, pago, notas) se repiten en cada jugador del
   grupo, coherente con lo que ve el panel —el pago y las notas son por equipo—. El BOM
   UTF-8 (U+FEFF) al inicio hace que Excel muestre bien los acentos (á, é, ñ) en vez de
   caracteres corruptos; las filas se separan con CRLF (RFC 4180). */
function construirCSV(equipos: EquipoAgrupado[]): string {
  const filas: string[] = [COLUMNAS_CSV.map(celdaCSV).join(',')]
  for (const equipo of equipos) {
    for (const j of equipo.jugadores) {
      filas.push(
        [
          equipo.nombre,
          j.gamertag,
          j.nombre,
          fmtFechaSoloDiaCSV(j.fecha_nacimiento),
          j.celular,
          j.escolaridad,
          j.municipio,
          j.localidad,
          j.correo,
          j.genero,
          equipo.capitanNombre,
          equipo.capitanCelular,
          equipo.pagado ? 'Sí' : 'No',
          fmtFechaLocalDiaCSV(equipo.pagadoEn),
          equipo.notas,
          fmtFechaLocalDiaCSV(j.creado_en)
        ]
          .map(celdaCSV)
          .join(',')
      )
    }
  }
  return BOM_UTF8 + filas.join('\r\n')
}

/* Fecha de hoy como AAAAMMDD para el nombre del archivo, en la zona de la liga
   (America/Mexico_City) y NO en la del navegador: el nombre debe reflejar el día en
   Querétaro aunque el admin exporte desde otra zona horaria (o con el reloj en UTC). Se
   arma con `formatToParts` para no depender del orden con que el locale imprime la fecha. */
function fechaHoyArchivo(): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const val = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${val('year')}${val('month')}${val('day')}`
}

/* Dispara la descarga de un texto como archivo, vía un <a download> temporal y un
   object URL que se revoca al terminar para no filtrar memoria. */
function descargarArchivo(contenido: string, nombreArchivo: string): void {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  /* Diferido: revocar en la misma tanda síncrona que el click puede cancelar la descarga
     en algunos navegadores (Firefox) antes de que terminen de leer el blob. */
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/* ------------------------------------------------------------------ */
/*  Piezas de UI (a nivel de módulo para no remontar en cada render)   */
/* ------------------------------------------------------------------ */

/* Botones de acción de las tarjetas. Neutralizan lo que la regla base de index.css le
   pone a todo <button>: Orbitron (`font-sans`/`tracking-normal`), el salto de -2px y el
   glow en hover (`hover:[transform:none]`/`hover:shadow-none`) que dentro de una tarjeta
   de datos se verían como jank y como "póster". El anillo de foco cian base se conserva.
   PRIMARIO = CTA canónico (from-lqc-700 → lqc-500) para la acción primaria: "Marcar
   pagado" y "Confirmar". SECUNDARIO = `bg-none` (sin el gradiente base) para acciones
   sutiles: "Quitar pago", "Cancelar" y "Guardar notas".
   PANEL = acción a nivel del panel (barra del listado: "Exportar CSV"), NO de una
   tarjeta. Mismo tratamiento sobrio gris-con-borde-azul que "Cerrar sesión" en Panel.tsx
   —el azul vive en el borde y el hover, no en el texto, para no competir con el CTA
   primario de cada equipo— pero con la caja del nivel panel (rounded-xl, px mayor,
   bg-black/50). No extiende BTN_BASE: repetiría rounded-lg/px-3.5/py-2, que en Tailwind no
   se pisan por orden de clase; lleva sus propias neutralizaciones de la regla base de
   <button> (font-sans, tracking-normal, sin el salto de -2px ni el glow en hover). */
const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-sans font-medium tracking-normal transition-colors duration-200 hover:[transform:none] hover:shadow-none disabled:opacity-60 disabled:cursor-not-allowed'
const BTN_PRIMARIO =
  `${BTN_BASE} border-0 bg-gradient-to-r from-lqc-700 to-lqc-500 text-white hover:from-lqc-600 hover:to-lqc-400`
const BTN_SECUNDARIO =
  `${BTN_BASE} bg-none bg-black/40 border border-blue-800/40 text-gray-200 hover:bg-blue-950/40 hover:border-blue-600/60 hover:text-white`
const BTN_PANEL =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-sans font-medium tracking-normal transition-colors duration-200 bg-none bg-black/50 border border-blue-800/40 text-gray-200 hover:bg-blue-950/40 hover:border-blue-600/60 hover:text-white hover:[transform:none] hover:shadow-none disabled:opacity-60 disabled:cursor-not-allowed sm:px-5'

/* Textarea de notas: mismo estilo de input del proyecto (ver Login/Registro), fondo
   oscuro y foco azul; sin icono a la izquierda, así que sin el `pl-12`. */
const CLASE_TEXTAREA =
  'w-full px-4 py-3 bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm resize-y min-h-[4.5rem] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed'

/* Indicador de estado de las notas: sobrio, font-mono, gris/azul (rose solo en error).
   Deriva "Sin cambios"/"Sin guardar" del prop `cambiadas` (textarea vs valor guardado). */
function EstadoNotas({
  estado,
  cambiadas
}: {
  estado: 'idle' | 'guardando' | 'guardado' | 'error'
  cambiadas: boolean
}) {
  if (estado === 'guardando') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-blue-300">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Guardando…
      </span>
    )
  }
  if (estado === 'error') {
    return (
      <span role="alert" className="font-mono text-[11px] text-rose-300">
        No pudimos guardar el cambio. Inténtalo de nuevo.
      </span>
    )
  }
  if (cambiadas) {
    return <span className="font-mono text-[11px] text-blue-300">Sin guardar</span>
  }
  if (estado === 'guardado') {
    return <span className="font-mono text-[11px] text-lqc-accent">Guardado</span>
  }
  return <span className="font-mono text-[11px] text-gray-500">Sin cambios</span>
}

/* Badge on-paleta: "Confirmado" en cian de marca (positivo), "Pendiente" en gris
   neutro apagado. Sin verde/ámbar; `rose` queda reservado a errores. */
function BadgePago({ pagado }: { pagado: boolean }) {
  if (pagado) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-lqc-accent/30 bg-lqc-accent/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-lqc-accent">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Confirmado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-gray-400">
      <Clock className="h-3.5 w-3.5" />
      Pendiente
    </span>
  )
}

function CampoJugador({
  label,
  valor,
  mono,
  full,
  clase = ''
}: {
  label: string
  valor: string
  mono?: boolean
  full?: boolean
  clase?: string
}) {
  return (
    <div className={`min-w-0 ${full ? 'sm:col-span-2' : ''}`}>
      <dt className="font-mono text-[11px] uppercase tracking-wider text-gray-400">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-sm text-gray-200 ${mono ? 'font-mono' : 'font-sans'} ${clase}`}
      >
        {valor || '—'}
      </dd>
    </div>
  )
}

/* Tarjeta de equipo colapsable + acciones de Fase 3 (marcar pago, notas).

   Estructura del encabezado — GOTCHA: no se puede anidar <button> dentro de <button>
   (HTML inválido). El disparador del colapso y el botón de pago son HERMANOS dentro de
   un contenedor flex: el área de info (nombre/contador/capitán/badge/fecha) es el
   <button> que expande, y la acción de pago va al lado, como otra celda. El contenido del
   disparador es solo de frase (`<span>` + iconos), nunca bloques. Las notas y su botón
   viven en el panel expandido, que es un <div> hermano fuera del disparador.

   Pago (por equipo): confirmación inline on-brand (no window.confirm, no modal), que
   dice a cuántos jugadores afecta. Actualización PESIMISTA: se aplica solo tras el éxito;
   el UPDATE toca TODAS las filas del grupo por id (`onMarcarPago` → `.in(COL_ID, ids)`).
   Al éxito, el padre muta `equipos` de forma inmutable y el badge, la fecha y el número
   "Confirmados" del resumen se recalculan solos, sin refetch (que perdería la expansión).
   En error/timeout no se cambia nada y se muestra un texto genérico.

   Notas (por equipo): textarea en el panel expandido, guardado explícito con botón
   (nunca al teclear), con estados sin-cambios/sin-guardar/guardando/guardado/error.

   Los controles de escritura de la tarjeta se deshabilitan mientras una operación vuela
   (`ocupado`). Un flag `montado` evita setState si la tarjeta se desmonta a mitad. */
function TarjetaEquipo({
  equipo,
  onMarcarPago,
  onGuardarNotas
}: {
  equipo: EquipoAgrupado
  onMarcarPago: (equipo: EquipoAgrupado, pagar: boolean) => Promise<boolean>
  onGuardarNotas: (equipo: EquipoAgrupado, notas: string) => Promise<boolean>
}) {
  const [expandido, setExpandido] = useState(false)
  const [estadoPago, setEstadoPago] = useState<'idle' | 'confirmando' | 'guardando'>('idle')
  const [errorPago, setErrorPago] = useState(false)
  const [notasTexto, setNotasTexto] = useState(equipo.notas)
  const [estadoNotas, setEstadoNotas] = useState<'idle' | 'guardando' | 'guardado' | 'error'>(
    'idle'
  )

  const panelId = useId()
  const notasId = useId()
  const confirmarRef = useRef<HTMLButtonElement>(null)
  const botonPagoRef = useRef<HTMLButtonElement>(null)

  /* Flag para no llamar setState si la tarjeta se desmonta con una escritura en vuelo.
     Se reafirma en true en cada montaje (StrictMode monta dos veces en dev). */
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  /* Foco de la confirmación de pago, comparando el valor previo (no una bandera de
     primer render) para no robar el foco al montar ni con el doble montaje de
     StrictMode: al abrir la confirmación va a "Confirmar"; al cerrarla —cancelando
     (confirmando→idle) o tras guardar (guardando→idle)— vuelve al botón "Marcar
     pagado", en vez de caer a <body>. Mismo patrón de foco que /registro. */
  const estadoPagoPrevio = useRef(estadoPago)
  useEffect(() => {
    const previo = estadoPagoPrevio.current
    estadoPagoPrevio.current = estadoPago
    if (estadoPago === 'confirmando') {
      confirmarRef.current?.focus()
    } else if (estadoPago === 'idle' && (previo === 'confirmando' || previo === 'guardando')) {
      botonPagoRef.current?.focus()
    }
  }, [estadoPago])

  const cantidad = equipo.jugadores.length
  /* Una escritura de esta tarjeta (pago o notas) bloquea sus propios controles. */
  const ocupado = estadoPago === 'guardando' || estadoNotas === 'guardando'
  /* Toggle: si está pagado, la acción es desmarcar; si no, marcar. */
  const pagar = !equipo.pagado
  const notasCambiadas = notasTexto !== equipo.notas

  const confirmarPago = async () => {
    if (ocupado) return
    setErrorPago(false)
    setEstadoPago('guardando')
    const ok = await onMarcarPago(equipo, pagar)
    if (!montado.current) return
    setEstadoPago('idle')
    /* En error no se toca `equipo`: no hay que revertir nada (fue pesimista). */
    if (!ok) setErrorPago(true)
  }

  const guardarNotas = async () => {
    if (ocupado || !notasCambiadas) return
    setEstadoNotas('guardando')
    const ok = await onGuardarNotas(equipo, notasTexto)
    if (!montado.current) return
    /* Al éxito, el padre actualiza `equipo.notas`: `notasCambiadas` vuelve a false y el
       indicador pasa a "Guardado". Al error, el texto queda para reintentar. */
    setEstadoNotas(ok ? 'guardado' : 'error')
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-colors hover:border-blue-800/40">
      {/* Encabezado: disparador del colapso + acción de pago, HERMANOS (no anidados).
          En móvil se apilan (divisor arriba de la acción); en sm+ comparten una misma
          banda horizontal, centrados y sin divisor, para que el botón de pago se lea como
          parte de la tarjeta y no como un panel aparte pegado al borde. */}
      <div className="flex flex-col sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          aria-expanded={expandido}
          aria-controls={panelId}
          className="group flex min-w-0 flex-1 items-center gap-3 border-0 bg-none px-4 py-4 text-left font-sans font-normal tracking-normal transition-colors hover:bg-white/[0.03] hover:[transform:none] hover:shadow-none md:gap-4 md:px-6 md:py-5"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-baseline gap-2 md:gap-3">
              <span className="truncate text-base font-semibold text-white md:text-lg">
                {equipo.nombre || 'Sin nombre'}
              </span>
              <span className="shrink-0 font-mono text-xs text-gray-400">
                {cantidad} {cantidad === 1 ? 'jugador' : 'jugadores'}
              </span>
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
              <span className="font-mono text-[11px] uppercase tracking-wider text-gray-400">
                Capitán
              </span>
              <span className="text-gray-300">{equipo.capitanNombre || '—'}</span>
              <span className="font-mono text-gray-400">
                {equipo.capitanCelular || '—'}
              </span>
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-2.5 md:gap-3">
            {/* Badge + fecha de pago apilados: la fecha (`pagado_en`) solo cuando está
                pagado. `<span>` con flex sigue siendo contenido de frase válido. */}
            <span className="flex flex-col items-end gap-1">
              <BadgePago pagado={equipo.pagado} />
              {equipo.pagado && equipo.pagadoEn && (
                <span className="whitespace-nowrap font-mono text-[10px] leading-none text-gray-500">
                  {fmtFechaHora(equipo.pagadoEn)}
                </span>
              )}
            </span>
            <ChevronDown
              className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
                expandido
                  ? 'text-blue-400 [transform:rotate(180deg)]'
                  : 'text-gray-400 [transform:rotate(0deg)]'
              }`}
            />
          </span>
        </button>

        {/* Acción de pago — hermana del disparador, nunca dentro de él. `shrink-0` la
            mantiene a su ancho de contenido (el disparador es flex-1 y se encoge); en sm+
            pierde el divisor y el relleno vertical y queda en la misma banda que el badge y
            el chevron, con `md:pr-6` de margen para no tocar la esquina redondeada. */}
        <div className="flex shrink-0 flex-col justify-center gap-1.5 border-t border-white/10 px-4 py-3 sm:border-t-0 sm:py-0 sm:pl-0 sm:pr-5 md:pr-6">
          {estadoPago === 'guardando' ? (
            <span className="inline-flex items-center gap-2 font-mono text-xs text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Guardando…
            </span>
          ) : estadoPago === 'confirmando' ? (
            <div className="flex flex-col gap-2">
              <p className="max-w-[15rem] text-xs leading-snug text-gray-300">
                {pagar ? 'Marcar como pagado' : 'Marcar como pendiente'} al equipo «
                {equipo.nombre || 'Sin nombre'}». Afecta a {cantidad}{' '}
                {cantidad === 1 ? 'jugador' : 'jugadores'}.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  ref={confirmarRef}
                  type="button"
                  onClick={confirmarPago}
                  className={BTN_PRIMARIO}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setEstadoPago('idle')}
                  className={BTN_SECUNDARIO}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              ref={botonPagoRef}
              type="button"
              onClick={() => {
                setErrorPago(false)
                setEstadoPago('confirmando')
              }}
              disabled={ocupado}
              className={equipo.pagado ? BTN_SECUNDARIO : BTN_PRIMARIO}
            >
              {equipo.pagado ? 'Quitar pago' : 'Marcar pagado'}
            </button>
          )}
          {errorPago && (
            <p role="alert" className="max-w-[15rem] text-xs leading-snug text-rose-300">
              No pudimos guardar el cambio. Inténtalo de nuevo.
            </p>
          )}
        </div>
      </div>

      {/* El panel se monta siempre y se oculta con `hidden`: así el id que referencia
          `aria-controls` existe también colapsado (un aria-controls a un id ausente es
          ARIA inválido). */}
      <div id={panelId} hidden={!expandido} className="border-t border-white/10">
        <ul className="divide-y divide-white/5">
          {equipo.jugadores.map((j, i) => (
            <li key={`${equipo.clave}-${i}`} className="px-4 py-4 md:px-6 md:py-5">
              <p className="break-words font-sans font-semibold text-white">
                {j.gamertag || '—'}
              </p>
              <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                <CampoJugador label="Nombre" valor={j.nombre} />
                <CampoJugador label="Celular" valor={j.celular} mono />
                <CampoJugador label="Correo" valor={j.correo} mono full clase="break-all" />
                <CampoJugador label="Registro" valor={fmtFecha(j.creado_en)} mono />
              </dl>
            </li>
          ))}
        </ul>

        {/* Notas del equipo: guardado explícito con botón, nunca al teclear. */}
        <div className="border-t border-white/10 px-4 py-4 md:px-6 md:py-5">
          <label
            htmlFor={notasId}
            className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-gray-400"
          >
            Notas del equipo
          </label>
          <textarea
            id={notasId}
            value={notasTexto}
            onChange={(e) => {
              setNotasTexto(e.target.value)
              /* Al editar se limpia el estado transitorio (guardado/error): el indicador
                 vuelve a derivarse de si hay cambios sin guardar. */
              if (estadoNotas !== 'idle') setEstadoNotas('idle')
            }}
            disabled={ocupado}
            rows={3}
            placeholder="Agrega una nota para este equipo (opcional)."
            className={CLASE_TEXTAREA}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <EstadoNotas estado={estadoNotas} cambiadas={notasCambiadas} />
            <button
              type="button"
              onClick={guardarNotas}
              disabled={ocupado || !notasCambiadas}
              className={BTN_SECUNDARIO}
            >
              {estadoNotas === 'guardando' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                'Guardar notas'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Resumen: tres números grandes en azul + etiqueta mono. La marca entra en el
   número; los datos se leen como herramienta, no como póster. */
function Resumen({
  equipos,
  totalJugadores
}: {
  equipos: EquipoAgrupado[]
  totalJugadores: number
}) {
  const celdas = [
    { etiqueta: 'Equipos', valor: equipos.length },
    { etiqueta: 'Jugadores', valor: totalJugadores },
    { etiqueta: 'Confirmados', valor: equipos.filter((e) => e.pagado).length }
  ]
  return (
    <div className="grid grid-cols-3 gap-3 md:gap-4">
      {celdas.map((c) => (
        <div
          key={c.etiqueta}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 md:p-5"
        >
          <p className="font-sans text-3xl font-semibold leading-none text-blue-400 md:text-4xl">
            {c.valor}
          </p>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-gray-400 md:text-xs">
            {c.etiqueta}
          </p>
        </div>
      ))}
    </div>
  )
}

/* Skeleton on-brand: el estado inicial ya es "cargando", así que no hay parpadeo.
   role="status" + texto sr-only anuncian la carga a lectores de pantalla. */
function Esqueleto() {
  return (
    <div role="status" className="space-y-6 md:space-y-8">
      <span className="sr-only">Cargando inscripciones…</span>
      <div className="grid grid-cols-3 gap-3 md:gap-4" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 md:p-5"
          >
            <div className="h-8 w-12 animate-pulse rounded bg-white/10" />
            <div className="mt-3 h-3 w-16 animate-pulse rounded bg-white/5" />
          </div>
        ))}
      </div>
      <div className="space-y-3 md:space-y-4" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 md:px-6"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-5 w-40 max-w-full animate-pulse rounded bg-white/10" />
                <div className="h-3 w-56 max-w-full animate-pulse rounded bg-white/5" />
              </div>
              <div className="h-6 w-24 shrink-0 animate-pulse rounded-full bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* Error genérico: familia `rose`, role="alert". Nunca se expone el error real de
   Supabase (el estado es un enum, no guarda el objeto). */
function ErrorCarga() {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-950/30 p-5"
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
      <div>
        <p className="font-sans text-sm text-rose-200 md:text-base">
          No pudimos cargar las inscripciones.
        </p>
        <p className="mt-1 font-sans text-sm text-rose-300/80">
          Recarga la página e inténtalo de nuevo en unos minutos.
        </p>
      </div>
    </div>
  )
}

/* Vacío: no es un error, es un mensaje amable. Reusa la caja punteada del
   placeholder anterior. */
function VacioInscripciones() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-black/30 p-10 text-center md:p-14">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-lqc-accent/20 bg-blue-950/40 shadow-lqc">
        <Inbox className="h-8 w-8 text-lqc-accent" />
      </div>
      <p className="font-sans text-lg text-white md:text-xl">
        Todavía no hay inscripciones.
      </p>
      <p className="mx-auto mt-2 max-w-md font-sans leading-relaxed text-gray-400">
        Cuando alguien complete el registro, su equipo aparecerá aquí.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Componente                                                         */
/* ------------------------------------------------------------------ */

type Estado = 'cargando' | 'listo' | 'error'

export default function ListaInscripciones() {
  /* Sin cliente (build sin credenciales o URL inválida) el estado arranca en
     'error' desde el inicializador, en vez de con un setState síncrono dentro del
     efecto. obtenerSupabase() es idempotente y nunca lanza (memoiza el cliente). */
  const [estado, setEstado] = useState<Estado>(() =>
    obtenerSupabase() ? 'cargando' : 'error'
  )
  const [equipos, setEquipos] = useState<EquipoAgrupado[]>([])
  /* Anuncio para lectores de pantalla del resultado de exportar: la única señal de que la
     exportación funcionó es la descarga del archivo, un gesto visual que no le dice nada a
     quien no ve la pantalla. Se lee por una región aria-live (ver el <span> del return). */
  const [anuncioExport, setAnuncioExport] = useState('')

  useEffect(() => {
    let montado = true

    const supabase = obtenerSupabase()
    if (!supabase) return

    void (async () => {
      try {
        const { data, error } = await supabase
          .from('inscripciones')
          .select(SELECT)
          .order('creado_en', { ascending: false })

        if (!montado) return
        /* No se guarda `error` en estado ni se loguea: solo se marca el enum. */
        if (error || !data) {
          setEstado('error')
          return
        }
        /* `data` viene como `any`/tipo de error de PostgREST porque el cliente no
           tiene el esquema generado (ver DEUDA en Registro.tsx): se castea vía
           `unknown` al contrato de columnas de arriba. */
        setEquipos(agruparPorEquipo(data as unknown as Inscripcion[]))
        setEstado('listo')
      } catch {
        if (montado) setEstado('error')
      }
    })()

    return () => {
      montado = false
    }
  }, [])

  /* Escritura de pago (por equipo). Toca TODAS las filas del grupo por id — nunca por el
     texto del equipo, que se normaliza para agrupar y no es clave. Actualización
     pesimista: al éxito muta `equipos` de forma inmutable (map por clave), así el badge,
     la fecha y el número "Confirmados" del resumen se recalculan sin refetch (que
     perdería el estado de expansión). El error nunca se filtra: la función devuelve un
     booleano, no el objeto de Supabase, y no se loguea. */
  const marcarPago = async (
    equipo: EquipoAgrupado,
    pagar: boolean
  ): Promise<boolean> => {
    const supabase = obtenerSupabase()
    if (!supabase) return false
    /* Timestamp del cliente: en un UPDATE no aplica el default de la DB. Skew menor,
       aceptable. Al desmarcar, pagado_en vuelve a null. */
    const pagadoEn = pagar ? new Date().toISOString() : null
    try {
      const { error } = await supabase
        .from('inscripciones')
        .update({ [COL_PAGADO]: pagar, [COL_PAGADO_EN]: pagadoEn })
        .in(COL_ID, equipo.ids)
        .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_MS))
      if (error) return false
      setEquipos((prev) =>
        prev.map((e) =>
          e.clave === equipo.clave ? { ...e, pagado: pagar, pagadoEn } : e
        )
      )
      return true
    } catch {
      /* Timeout (abort) o red: mismo camino, sin logs ni exponer el error. */
      return false
    }
  }

  /* Escritura de notas (por equipo). Mismo criterio: todas las filas del grupo por id.
     Al éxito actualiza el `notas` guardado del grupo para que la tarjeta vuelva a
     "sin cambios". */
  const guardarNotas = async (
    equipo: EquipoAgrupado,
    notas: string
  ): Promise<boolean> => {
    const supabase = obtenerSupabase()
    if (!supabase) return false
    try {
      const { error } = await supabase
        .from('inscripciones')
        .update({ [COL_NOTAS]: notas })
        .in(COL_ID, equipo.ids)
        .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_MS))
      if (error) return false
      setEquipos((prev) =>
        prev.map((e) => (e.clave === equipo.clave ? { ...e, notas } : e))
      )
      return true
    } catch {
      return false
    }
  }

  /* Exporta las inscripciones a un CSV generado y descargado en el cliente, con lo que YA
     está en memoria (sin una segunda consulta a Supabase). El guard es defensivo: este
     botón solo existe cuando hay equipos, porque el caso vacío lo cubre antes
     <VacioInscripciones/> (no queda un botón colgado que deshabilitar). En ambos casos se
     fija el anuncio aria-live, la única señal audible de que la acción ocurrió. */
  const exportarCSV = () => {
    if (equipos.length === 0) {
      setAnuncioExport('No hay inscripciones para exportar.')
      return
    }
    descargarArchivo(construirCSV(equipos), `inscripciones-lqc-${fechaHoyArchivo()}.csv`)
    setAnuncioExport('CSV descargado.')
  }

  if (estado === 'cargando') return <Esqueleto />
  if (estado === 'error') return <ErrorCarga />
  if (equipos.length === 0) return <VacioInscripciones />

  const totalJugadores = equipos.reduce((n, e) => n + e.jugadores.length, 0)

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Encabezado: resumen a la izquierda + acción de exportar a la derecha; en móvil se
          apilan (botón debajo de los contadores, alineado a la izquierda). Exportar es una
          acción a NIVEL DE PANEL (todo el listado), no de una tarjeta, así que usa el estilo
          BTN_PANEL —el mismo tratamiento sobrio de "Cerrar sesión"— en vez del BTN_SECUNDARIO
          del nivel tarjeta; el azul solo en borde y hover para no competir con el CTA
          primario de cada equipo. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <Resumen equipos={equipos} totalJugadores={totalJugadores} />
        </div>
        <button
          type="button"
          onClick={exportarCSV}
          className={`${BTN_PANEL} shrink-0 self-start sm:self-auto`}
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>
      <ul className="space-y-3 md:space-y-4">
        {equipos.map((e) => (
          <li key={e.clave}>
            <TarjetaEquipo
              equipo={e}
              onMarcarPago={marcarPago}
              onGuardarNotas={guardarNotas}
            />
          </li>
        ))}
      </ul>
      {/* Región viva sr-only: anuncia el resultado de exportar a lectores de pantalla, ya
          que el gesto visual (la descarga) no comunica nada. Va siempre montada (con texto
          vacío al inicio) para que aria-live capte el cambio; como último hijo y con
          `sr-only` (position:absolute) no altera el layout del encabezado. role="status"
          ya implica aria-live="polite" —no interrumpe—; se deja explícito por claridad. */}
      <span role="status" aria-live="polite" className="sr-only">
        {anuncioExport}
      </span>
    </div>
  )
}
