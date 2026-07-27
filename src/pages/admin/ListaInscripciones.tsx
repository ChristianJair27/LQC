import { useEffect, useId, useRef, useState } from 'react'
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
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
  /* null = inscripción activa; con fecha = archivada. Archivar NUNCA borra la fila:
     es un UPDATE de esta columna. No hay política de DELETE en la tabla. */
  archivado_en: string | null
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
const COL_ARCHIVADO_EN = 'archivado_en' as const

/* Techo de las escrituras (marcar pago / guardar notas): pasado ese tiempo la query se
   aborta y cae en el mensaje genérico, en vez de dejar la tarjeta trabada en
   "Guardando…". Mismo criterio que el envío de /registro. */
const TIEMPO_LIMITE_MS = 15_000

/* Orden de columnas del contrato de datos, más las de Fase 3 (id, pagado_en, notas). Las
   columnas fecha_nacimiento, escolaridad, municipio, localidad y genero no se pintan en el
   panel, pero se traen para poder exportarlas al CSV (Fase 4) SIN una segunda consulta: la
   exportación arma el archivo con lo que ya está en memoria. */
const SELECT =
  `${COL_ID}, equipo, gamertag, nombre, fecha_nacimiento, celular, escolaridad, municipio, localidad, correo, genero, capitan_nombre, capitan_celular, ${COL_PAGADO}, ${COL_PAGADO_EN}, ${COL_NOTAS}, creado_en, ${COL_ARCHIVADO_EN}`

/* ------------------------------------------------------------------ */
/*  Agrupación por equipo (función pura, fácil de auditar)             */
/* ------------------------------------------------------------------ */

/* Estado de archivado del equipo. 'parcial' NO es un estado que se pida: es el que queda
   si un UPDATE de archivado toca solo algunas filas del grupo (éxito parcial). Se modela
   explícitamente para que ese equipo siga VISIBLE en el listado activo y se pueda
   reintentar, en vez de desaparecer de las dos vistas. */
type EstadoArchivo = 'activo' | 'parcial' | 'archivado'

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
  estadoArchivo: EstadoArchivo
  archivadoEn: string | null // fecha de archivado; solo si el equipo está archivado ENTERO
  jugadoresActivos: number // filas del grupo con archivado_en null — base de los contadores
}

/* Nombre visible del equipo. Un `equipo` vacío se muestra —y se escribe, en la confirmación
   de archivado— como "Sin nombre": si se exigiera teclear la cadena vacía, la confirmación
   quedaría satisfecha sin escribir nada. */
function nombreMostrado(equipo: EquipoAgrupado): string {
  /* Normalizado igual que la comparación de la confirmación: un `equipo` de puros espacios se
     vería vacío en el HTML y, sin esto, daría un nombre a teclear que se satisface sin
     escribir nada. Hoy /registro no deja pasar ese valor, pero el listado ya se blinda contra
     filas raras y esto no cuesta nada. */
  return normalizarEspacios(equipo.nombre ?? '') || 'Sin nombre'
}

/* Espacios de los extremos fuera y los internos colapsados a uno, sin tocar mayúsculas. */
function normalizarEspacios(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ')
}

/* "Los Panditas" y "los panditas " deben caer en el mismo grupo. */
function normalizarEquipo(equipo: string): string {
  return normalizarEspacios(equipo).toLowerCase()
}

/* creado_en → milisegundos. Se compara por tiempo real, no lexicográficamente,
   por si el timestamp llega con distinto offset. Un valor inválido cae a 0. */
function tiempo(creadoEn: string): number {
  const t = new Date(creadoEn).getTime()
  return Number.isNaN(t) ? 0 : t
}

/* Estado de archivado del grupo, derivado SIEMPRE de las filas (nunca de una bandera
   aparte que pueda desincronizarse): 'activo' si ninguna tiene archivado_en, 'archivado'
   si TODAS lo tienen, 'parcial' si quedó a medias. La fecha que se muestra es la más
   reciente del grupo y solo se expone cuando el equipo está archivado entero: en 'parcial'
   sería engañosa. */
function estadoDeArchivo(jugadores: Inscripcion[]): {
  estadoArchivo: EstadoArchivo
  archivadoEn: string | null
  jugadoresActivos: number
} {
  const archivados = jugadores.filter((j) => j[COL_ARCHIVADO_EN] != null)
  const jugadoresActivos = jugadores.length - archivados.length
  if (archivados.length === 0) {
    return { estadoArchivo: 'activo', archivadoEn: null, jugadoresActivos }
  }
  if (jugadoresActivos > 0) {
    return { estadoArchivo: 'parcial', archivadoEn: null, jugadoresActivos }
  }
  const archivadoEn = archivados.reduce<string>((max, j) => {
    const valor = String(j[COL_ARCHIVADO_EN])
    return tiempo(valor) > tiempo(max) ? valor : max
  }, String(archivados[0][COL_ARCHIVADO_EN]))
  return { estadoArchivo: 'archivado', archivadoEn, jugadoresActivos }
}

/* Rehace un grupo después de un UPDATE de archivado: aplica `valor` SOLO a las filas cuyos
   ids confirmó la base (`data` del `.select()` posterior al update) y recalcula el estado
   desde las filas. Así el éxito parcial queda reflejado tal cual es, sin inventar que el
   equipo entero cambió. Los ids se comparan como texto: la PK puede llegar como número o
   como cadena y `Set.has` no coacciona tipos. */
function conArchivado(
  equipo: EquipoAgrupado,
  idsTocados: Set<string>,
  valor: string | null
): EquipoAgrupado {
  const jugadores = equipo.jugadores.map((j) =>
    idsTocados.has(String(j[COL_ID])) ? { ...j, [COL_ARCHIVADO_EN]: valor } : j
  )
  return { ...equipo, jugadores, ...estadoDeArchivo(jugadores) }
}

/* Resultado de una escritura de archivado/restauración. Enum + cuántas filas confirmó la
   base, que es lo que permite distinguir el éxito parcial del total. Nunca viaja el error
   de Supabase: las tarjetas solo pintan mensajes genéricos. */
type ResultadoArchivo = {
  resultado: 'ok' | 'parcial' | 'error'
  tocados: number
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
      ultimaActividad,
      ...estadoDeArchivo(jugadores)
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
   caracteres corruptos; las filas se separan con CRLF (RFC 4180).

   ARCHIVADOS FUERA: el CSV es la foto de la liga viva. Se filtra por fila (no solo por
   equipo) para que un equipo en estado 'parcial' exporte únicamente sus inscripciones
   activas; el llamador ya pasa nada más los equipos no archivados. */
function construirCSV(equipos: EquipoAgrupado[]): string {
  const filas: string[] = [COLUMNAS_CSV.map(celdaCSV).join(',')]
  for (const equipo of equipos) {
    for (const j of equipo.jugadores.filter((fila) => fila[COL_ARCHIVADO_EN] == null)) {
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
/* PANEL_BASE guarda solo la caja (sin colores) para que el estado activo del interruptor se
   componga como variante COMPLETA y no apilando clases encima de BTN_PANEL: dos utilidades
   del mismo grupo (`border-blue-800/40` y `border-blue-600/60`) no se resuelven por orden de
   escritura sino por su orden en el CSS generado, y ahí el borde apagado le gana al activo.
   Misma trampa que documenta el comentario de arriba. */
const BTN_PANEL_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-sans font-medium tracking-normal transition-colors duration-200 bg-none hover:[transform:none] hover:shadow-none disabled:opacity-60 disabled:cursor-not-allowed sm:px-5'
const BTN_PANEL =
  `${BTN_PANEL_BASE} bg-black/50 border border-blue-800/40 text-gray-200 hover:bg-blue-950/40 hover:border-blue-600/60 hover:text-white`
const BTN_PANEL_ACTIVO =
  `${BTN_PANEL_BASE} bg-blue-950/40 border border-blue-600/60 text-white`
/* DESTRUCTIVO = archivar. Familia `rose`, la misma que el proyecto usa para lo que sale
   mal, porque archivar es la única acción del panel que retira datos de la vista; en gris
   se leería como una acción más y en azul competiría con el CTA. Es un fantasma —sin
   relleno, borde tenue— para que NO sea el elemento más llamativo de la tarjeta: el
   gradiente azul de "Marcar pagado" le sigue ganando en peso visual. El relleno solo
   aparece en DESTRUCTIVO_SOLIDO, el "Archivar equipo" definitivo de la confirmación, donde
   ya es la acción principal de ese bloque. Ambos con `bg-none`: sin él, la regla base de
   <button> en index.css los pintaría con el gradiente azul completo. */
const BTN_DESTRUCTIVO =
  `${BTN_BASE} bg-none bg-transparent border border-rose-700/70 text-rose-300 hover:bg-rose-950/40 hover:border-rose-600/80 hover:text-rose-200`
const BTN_DESTRUCTIVO_SOLIDO =
  `${BTN_BASE} bg-none bg-rose-900/60 border border-rose-700/60 text-rose-50 hover:bg-rose-800/70 hover:border-rose-600/70`

/* Input de una línea, mismo estilo que el textarea de notas y que los campos de
   Login/Registro. El foco sigue siendo azul (es el color de foco del sistema de diseño)
   aunque el campo viva en el bloque destructivo. */
const CLASE_INPUT =
  'w-full px-4 py-3 bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed'

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

   Archivado (por equipo): vive en una zona aparte al FINAL del panel expandido, fuera del
   flujo de las acciones normales, y exige escribir el nombre exacto del equipo. No usa
   window.confirm ni un diálogo de sí/no: un clic distraído no puede archivar. El UPDATE
   pone archivado_en = ahora en TODAS las filas del grupo; jamás se borra una fila.

   Los controles de escritura de la tarjeta se deshabilitan mientras una operación vuela
   (`ocupado`). Un flag `montado` evita setState si la tarjeta se desmonta a mitad. */
function TarjetaEquipo({
  equipo,
  onMarcarPago,
  onGuardarNotas,
  onArchivar,
  onRestaurar
}: {
  equipo: EquipoAgrupado
  onMarcarPago: (equipo: EquipoAgrupado, pagar: boolean) => Promise<boolean>
  onGuardarNotas: (equipo: EquipoAgrupado, notas: string) => Promise<boolean>
  onArchivar: (equipo: EquipoAgrupado) => Promise<ResultadoArchivo>
  /* Solo se usa para sacar al equipo del estado 'parcial'; un equipo activo no tiene nada
     que restaurar. */
  onRestaurar: (equipo: EquipoAgrupado) => Promise<ResultadoArchivo>
}) {
  const [expandido, setExpandido] = useState(false)
  const [estadoPago, setEstadoPago] = useState<'idle' | 'confirmando' | 'guardando'>('idle')
  const [errorPago, setErrorPago] = useState(false)
  const [notasTexto, setNotasTexto] = useState(equipo.notas)
  const [estadoNotas, setEstadoNotas] = useState<'idle' | 'guardando' | 'guardado' | 'error'>(
    'idle'
  )
  /* `modoArchivar` es el estado LOCAL del control (qué está mostrando la zona de archivado),
     distinto de `equipo.estadoArchivo`, que es el estado del equipo en la base. Nombres
     separados a propósito: conviven en este mismo componente. */
  const [modoArchivar, setModoArchivar] = useState<'idle' | 'confirmando' | 'archivando'>(
    'idle'
  )
  /* Texto tecleado en la confirmación y último fallo del archivado. `fallo` guarda el
     resultado (error o parcial) para poder decir CUÁNTAS filas se archivaron. */
  const [textoConfirma, setTextoConfirma] = useState('')
  const [fallo, setFallo] = useState<ResultadoArchivo | null>(null)
  /* Restaurar lo ya archivado de un equipo 'parcial'. Estado propio y no `modoArchivar`,
     porque este botón vive en la vista 'idle' de la zona: reusar aquel estado abriría la
     confirmación de archivado en medio de una restauración. */
  const [restaurando, setRestaurando] = useState(false)
  const [errorRestaurar, setErrorRestaurar] = useState(false)

  const panelId = useId()
  const notasId = useId()
  const confirmaId = useId()
  const confirmarRef = useRef<HTMLButtonElement>(null)
  const botonPagoRef = useRef<HTMLButtonElement>(null)
  const botonArchivarRef = useRef<HTMLButtonElement>(null)
  const botonConfirmarArchivoRef = useRef<HTMLButtonElement>(null)
  const botonRestaurarParcialRef = useRef<HTMLButtonElement>(null)
  const campoConfirmaRef = useRef<HTMLInputElement>(null)

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

  /* Mismo patrón de foco para el archivado: al abrir la confirmación el foco va al campo
     de texto (que es lo que hay que completar); al cancelarla vuelve a "Archivar equipo".
     Si el archivado sale bien la tarjeta se desmonta —el equipo pasa a la lista de
     archivados—, así que ahí no hay a dónde devolver el foco: el aviso de la región
     aria-live es lo que informa el resultado. */
  const modoArchivarPrevio = useRef(modoArchivar)
  useEffect(() => {
    const previo = modoArchivarPrevio.current
    modoArchivarPrevio.current = modoArchivar
    if (modoArchivar === 'confirmando' && previo === 'idle') {
      campoConfirmaRef.current?.focus()
    } else if (modoArchivar === 'confirmando' && previo === 'archivando') {
      /* Volviendo de un fallo: el botón estuvo deshabilitado mientras se guardaba y el
         navegador le quitó el foco al deshabilitarlo. Se lo devolvemos para que reintentar
         sea otro Enter y no un viaje con Tab desde <body>. */
      botonConfirmarArchivoRef.current?.focus()
    } else if (modoArchivar === 'idle' && previo === 'confirmando') {
      botonArchivarRef.current?.focus()
    }
  }, [modoArchivar])

  /* Mismo problema, otro control: "Restaurar las archivadas" se deshabilita mientras escribe
     y el navegador le suelta el foco. Al terminar hay dos desenlaces: si el equipo dejó de
     ser 'parcial' el botón ya no existe y el foco va a "Archivar equipo", que ocupa su lugar
     en la misma banda; si sigue existiendo (parcial o error) vuelve a él. El `??` distingue
     los dos casos solo, sin mirar el estado. */
  const restaurandoPrevio = useRef(restaurando)
  useEffect(() => {
    const previo = restaurandoPrevio.current
    restaurandoPrevio.current = restaurando
    if (previo && !restaurando) {
      ;(botonRestaurarParcialRef.current ?? botonArchivarRef.current)?.focus()
    }
  }, [restaurando])

  const cantidad = equipo.jugadores.length
  /* Una escritura de esta tarjeta (pago, notas o archivado) bloquea sus propios controles. */
  const ocupado =
    estadoPago === 'guardando' ||
    estadoNotas === 'guardando' ||
    modoArchivar === 'archivando' ||
    restaurando
  /* Toggle: si está pagado, la acción es desmarcar; si no, marcar. */
  const pagar = !equipo.pagado
  const notasCambiadas = notasTexto !== equipo.notas
  /* Coincidencia con el nombre del equipo distinguiendo MAYÚSCULAS (eso es a propósito: es
     lo que obliga a mirar el nombre y escribirlo), pero normalizando los espacios de los dos
     lados. El HTML colapsa los espacios al pintar, así que un equipo guardado como
     "Los  Panditas" se ve "Los Panditas": exigir la cadena literal dejaría ese equipo
     imposible de archivar, con el botón muerto y sin explicación. */
  const nombre = nombreMostrado(equipo)
  const confirmaCoincide = normalizarEspacios(textoConfirma) === normalizarEspacios(nombre)
  /* Cuántas filas del grupo ya están archivadas y cuántas cambiarían de estado al confirmar.
     En un equipo 'parcial' NO son lo mismo que `cantidad`, y la confirmación tiene que decir
     el número que se está confirmando, no el tamaño del grupo. */
  const yaArchivadas = cantidad - equipo.jugadoresActivos
  const porArchivar = equipo.jugadoresActivos

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

  /* Cerrar SIEMPRE limpia lo tecleado y el último fallo: reabrir la confirmación tiene que
     exigir escribir el nombre de nuevo, nunca encontrarlo ya puesto.
     Nunca con una escritura en vuelo: "Cancelar" ya está deshabilitado por `ocupado`, pero el
     disparador del colapso no, y cerrar desde ahí pondría `modoArchivar` en 'idle' a mitad
     del UPDATE. Eso baja `ocupado` a false y rehabilita pago, notas y archivar: se podría
     lanzar una segunda escritura sobre el mismo equipo, que es justo lo que `ocupado` impide. */
  const cerrarConfirmacionArchivado = () => {
    if (ocupado) return
    setTextoConfirma('')
    setFallo(null)
    setErrorRestaurar(false)
    setModoArchivar('idle')
  }

  /* Al éxito no se toca el estado local: el padre saca al equipo del listado activo y esta
     tarjeta se desmonta. Al fallar —error o éxito parcial— la confirmación queda ABIERTA con
     el nombre ya escrito, para poder reintentar sin volver a teclearlo; el mensaje concreto
     lo pinta el bloque de confirmación a partir de `fallo`. */
  const confirmarArchivado = async () => {
    if (ocupado || !confirmaCoincide) return
    setFallo(null)
    setModoArchivar('archivando')
    const resultado = await onArchivar(equipo)
    if (!montado.current) return
    if (resultado.resultado === 'ok') return
    setModoArchivar('confirmando')
    setFallo(resultado)
  }

  /* Devuelve a activo lo que quedó archivado de un equipo 'parcial'. Esta tarjeta NO se
     desmonta (el equipo ya estaba en el listado activo y ahí se queda), así que el resultado
     bueno se ve solo: desaparecen la etiqueta "archivado parcial" y las marcas por fila. El
     'parcial' —restauró algunas y quedan otras— lo anuncia la región del padre; acá solo se
     pinta el error, que es lo que no deja rastro visible. */
  const restaurarParcial = async () => {
    if (ocupado) return
    setErrorRestaurar(false)
    setRestaurando(true)
    const resultado = await onRestaurar(equipo)
    if (!montado.current) return
    setRestaurando(false)
    setErrorRestaurar(resultado.resultado === 'error')
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
          onClick={() => {
            /* Al colapsar se cierra la confirmación de archivado. Si no, el panel se esconde
               con `hidden` pero la confirmación sigue viva ahí abajo, y al reexpandir aparece
               con el nombre ya tecleado: archivar quedaría a un solo clic, que es
               exactamente lo que la confirmación escrita evita. */
            if (expandido) cerrarConfirmacionArchivado()
            setExpandido((v) => !v)
          }}
          aria-expanded={expandido}
          aria-controls={panelId}
          className="group flex min-w-0 flex-1 items-center gap-3 border-0 bg-none px-4 py-4 text-left font-sans font-normal tracking-normal transition-colors hover:bg-white/[0.03] hover:[transform:none] hover:shadow-none md:gap-4 md:px-6 md:py-5"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-baseline gap-2 md:gap-3">
              <span className="truncate text-base font-semibold text-white md:text-lg">
                {nombre}
              </span>
              {/* Un archivado a medias no puede quedar invisible ni ambiguo: si el
                  encabezado dijera "5 jugadores" mientras el contador Jugadores suma 3, el
                  panel se contradice y el CSV exporta de menos sin explicación. En 'parcial'
                  se muestran los dos números y la etiqueta que lo nombra. */}
              {equipo.estadoArchivo === 'parcial' ? (
                <>
                  <span className="shrink-0 font-mono text-xs text-gray-400">
                    {equipo.jugadoresActivos} de {cantidad} activos
                  </span>
                  <span className="shrink-0 font-mono text-xs text-rose-300">
                    archivado parcial
                  </span>
                </>
              ) : (
                <span className="shrink-0 font-mono text-xs text-gray-400">
                  {cantidad} {cantidad === 1 ? 'jugador' : 'jugadores'}
                </span>
              )}
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
                {pagar ? 'Marcar como pagado' : 'Marcar como pendiente'} al equipo «{nombre}
                ». Afecta a {cantidad}{' '}
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
              <p className="flex flex-wrap items-baseline gap-x-2 break-words font-sans font-semibold text-white">
                {j.gamertag || '—'}
                {/* En un equipo 'parcial' hay que poder ver QUÉ filas quedaron archivadas:
                    son justo las que el CSV no exporta. */}
                {j[COL_ARCHIVADO_EN] != null && (
                  <span className="font-mono text-[11px] font-normal uppercase tracking-wider text-rose-300">
                    archivada
                  </span>
                )}
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

        {/* Zona de archivado. Va al FINAL del panel expandido y a propósito no comparte
            banda con "Marcar pagado" ni con "Guardar notas": archivar saca al equipo del
            listado, del CSV y del torneo en ATAK.GG, así que no debe quedar a un clic
            de distraído ni leerse como una acción más. El fondo rose apenas teñido y el botón fantasma la marcan como
            destructiva sin robarle protagonismo al CTA azul del encabezado. */}
        <div className="border-t border-rose-900/30 bg-rose-950/10 px-4 py-4 md:px-6 md:py-5">
          {modoArchivar === 'idle' ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-xs leading-snug text-gray-400">
                {equipo.estadoArchivo === 'parcial'
                  ? yaArchivadas === 1
                    ? `Este equipo quedó archivado a medias: 1 de ${cantidad} inscripciones está archivada y no se exporta. Termina de archivarlo o restaura la que quedó.`
                    : `Este equipo quedó archivado a medias: ${yaArchivadas} de ${cantidad} inscripciones están archivadas y no se exportan. Termina de archivarlo o restaura las que quedaron.`
                  : 'Archivar saca al equipo del listado, del CSV y del torneo en ATAK.GG. No borra nada: puedes restaurarlo desde «Ver archivados».'}
              </p>
              <div className="flex flex-wrap gap-2">
                {/* Salida del estado 'parcial': sin esto, un archivado a medias solo se puede
                    deshacer archivando todo y restaurando después. Restaurar no retira nada,
                    así que va como acción secundaria y sin confirmación escrita. */}
                {equipo.estadoArchivo === 'parcial' && (
                  <button
                    ref={botonRestaurarParcialRef}
                    type="button"
                    onClick={restaurarParcial}
                    disabled={ocupado}
                    aria-busy={restaurando}
                    className={BTN_SECUNDARIO}
                  >
                    {restaurando ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Restaurando…
                      </>
                    ) : (
                      <>
                        <ArchiveRestore className="h-4 w-4" />
                        Restaurar las archivadas
                      </>
                    )}
                  </button>
                )}
                <button
                  ref={botonArchivarRef}
                  type="button"
                  onClick={() => {
                    setTextoConfirma('')
                    setFallo(null)
                    /* También el de restaurar: si no, un error viejo de "Restaurar las
                       archivadas" reaparece intacto al cancelar la confirmación. */
                    setErrorRestaurar(false)
                    setModoArchivar('confirmando')
                  }}
                  disabled={ocupado}
                  className={BTN_DESTRUCTIVO}
                >
                  <Archive className="h-4 w-4" />
                  {equipo.estadoArchivo === 'parcial'
                    ? 'Terminar de archivar'
                    : 'Archivar equipo'}
                </button>
              </div>
              {errorRestaurar && (
                <p role="alert" className="w-full text-xs leading-snug text-rose-300">
                  No pudimos restaurar las inscripciones. Inténtalo de nuevo.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="font-sans text-sm font-semibold text-rose-100">
                Archivar «{nombre}»
              </p>
              <p className="text-sm leading-relaxed text-gray-300">
                Se {porArchivar === 1 ? 'archivará' : 'archivarán'} {porArchivar}{' '}
                {porArchivar === 1 ? 'jugador' : 'jugadores'}
                {yaArchivadas > 0 && ` (${yaArchivadas} ya lo ${
                  yaArchivadas === 1 ? 'está' : 'están'
                }, así que el equipo queda archivado entero: ${cantidad})`}
                . Las inscripciones no se borran: el equipo sale del listado, del CSV y del
                torneo, y puedes restaurarlo cuando quieras desde «Ver archivados» — al
                restaurarlo vuelve a quedar inscrito.
              </p>
              {/* El recuadro de alerta CIERRA con la consecuencia, no con la tranquilización:
                  si terminara en "se puede deshacer", el peso de la advertencia se diluye y
                  archivar se lee como inocuo. Lo reversible se cuenta arriba, en el párrafo
                  gris, que es donde vive el resto del contexto. */}
              <p className="rounded-xl border border-rose-800/40 bg-rose-950/30 px-4 py-3 text-sm leading-relaxed text-rose-100">
                Ojo: esto no se queda en el panel. Al archivarlo, el equipo{' '}
                <strong className="font-semibold">también se da de baja del torneo en
                ATAK.GG</strong>.
              </p>
              <div>
                <label
                  htmlFor={confirmaId}
                  className="mb-2 block text-xs leading-relaxed text-gray-300"
                >
                  Para confirmar, escribe el nombre exacto del equipo:{' '}
                  <span className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[11px] text-white">
                    {nombre}
                  </span>
                </label>
                <input
                  ref={campoConfirmaRef}
                  id={confirmaId}
                  type="text"
                  value={textoConfirma}
                  onChange={(e) => setTextoConfirma(e.target.value)}
                  disabled={ocupado}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Nombre del equipo"
                  className={CLASE_INPUT}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  ref={botonConfirmarArchivoRef}
                  type="button"
                  onClick={confirmarArchivado}
                  disabled={ocupado || !confirmaCoincide}
                  aria-busy={modoArchivar === 'archivando'}
                  className={BTN_DESTRUCTIVO_SOLIDO}
                >
                  {modoArchivar === 'archivando' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Archivando…
                    </>
                  ) : (
                    'Archivar equipo'
                  )}
                </button>
                <button
                  type="button"
                  onClick={cerrarConfirmacionArchivado}
                  disabled={ocupado}
                  className={BTN_SECUNDARIO}
                >
                  Cancelar
                </button>
              </div>
              {/* El éxito parcial se dice con números y deja la confirmación abierta: el
                  nombre ya escrito sigue ahí, así que reintentar es un solo clic. */}
              {fallo && (
                <p role="alert" className="text-xs leading-snug text-rose-300">
                  {fallo.resultado === 'parcial'
                    ? `Solo se ${fallo.tocados === 1 ? 'archivó' : 'archivaron'} ${
                        fallo.tocados
                      } de ${cantidad} jugadores. Vuelve a intentarlo para archivar el resto.`
                    : 'No pudimos archivar el equipo. Inténtalo de nuevo.'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* Tarjeta compacta de un equipo YA archivado. Deliberadamente no reusa TarjetaEquipo: un
   equipo archivado no se despliega ni se le tocan pago y notas — solo se lee quién es,
   cuándo se archivó y se restaura. Restaurar no pide confirmación escrita: es la acción que
   deshace, no la que retira. */
function TarjetaArchivado({
  equipo,
  onRestaurar
}: {
  equipo: EquipoAgrupado
  onRestaurar: (equipo: EquipoAgrupado) => Promise<ResultadoArchivo>
}) {
  const [estado, setEstado] = useState<'idle' | 'restaurando'>('idle')
  /* Basta un booleano: el único desenlace que deja esta tarjeta montada es el error. Tanto
     'ok' como 'parcial' sacan al equipo de la lista de archivados —a activos en los dos
     casos—, así que la tarjeta ya no existe para mostrar nada; esos dos los anuncia la
     región aria-live del padre. */
  const [error, setError] = useState(false)
  const botonRestaurarRef = useRef<HTMLButtonElement>(null)

  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  /* Al fallar la restauración el botón se rehabilita, pero el navegador ya le había quitado
     el foco al deshabilitarlo: se lo devolvemos para poder reintentar sin salir de <body>. */
  const estadoPrevio = useRef(estado)
  useEffect(() => {
    const previo = estadoPrevio.current
    estadoPrevio.current = estado
    if (estado === 'idle' && previo === 'restaurando') {
      botonRestaurarRef.current?.focus()
    }
  }, [estado])

  const cantidad = equipo.jugadores.length
  const nombre = nombreMostrado(equipo)

  const restaurar = async () => {
    if (estado === 'restaurando') return
    setError(false)
    setEstado('restaurando')
    const resultado = await onRestaurar(equipo)
    if (!montado.current) return
    /* Con 'ok' o 'parcial' el equipo sale de la lista de archivados y esta tarjeta se
       desmonta en el mismo render, así que estos setState son inocuos: solo importan en el
       camino de error, que es el único que la deja viva. */
    setEstado('idle')
    setError(resultado.resultado === 'error')
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4 md:px-6 md:py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans font-semibold text-gray-300">{nombre}</p>
          {/* `text-gray-400` y no el `gray-500` de los metadatos secundarios del panel: acá
              la fecha de archivado es la única información de la tarjeta y con gray-500 se
              queda en ~3.9:1, por debajo del mínimo. */}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-gray-400">
            <span>
              {cantidad} {cantidad === 1 ? 'jugador' : 'jugadores'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Archivado el {equipo.archivadoEn ? fmtFechaHora(equipo.archivadoEn) : '—'}
            </span>
          </p>
        </div>
        <button
          ref={botonRestaurarRef}
          type="button"
          onClick={restaurar}
          disabled={estado === 'restaurando'}
          aria-busy={estado === 'restaurando'}
          className={`${BTN_SECUNDARIO} shrink-0`}
        >
          {estado === 'restaurando' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Restaurando…
            </>
          ) : (
            <>
              <ArchiveRestore className="h-4 w-4" />
              Restaurar
            </>
          )}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-xs leading-snug text-rose-300">
          No pudimos restaurar el equipo. Inténtalo de nuevo.
        </p>
      )}
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
  /* Anuncio para lectores de pantalla del resultado de exportar, archivar y restaurar: la
     única señal de que funcionaron es visual —la descarga del archivo, la tarjeta que
     cambia de lista— y eso no le dice nada a quien no ve la pantalla. Se lee por una región
     aria-live (ver el <span> del return). Los FALLOS no pasan por acá: los pinta cada
     tarjeta con role="alert", que ya se anuncia solo, y así no se dice dos veces. */
  const [anuncio, setAnuncio] = useState('')
  /* Los archivados no se muestran salvo que se pidan: el panel es la foto de la liga viva. */
  const [verArchivados, setVerArchivados] = useState(false)
  /* Destino del foco cuando la tarjeta que se estaba usando desaparece (ver más abajo). */
  const botonVerArchivadosRef = useRef<HTMLButtonElement>(null)

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

  /* Escritura de archivado/restauración (por equipo). `valor` es la fecha (archivar) o null
     (restaurar); NUNCA un .delete(): la tabla no tiene política de DELETE y un borrado
     fallaría en silencio, devolviendo 0 filas sin error. El `.select()` después del UPDATE
     hace que PostgREST devuelva las filas que realmente cambiaron: comparar esa cuenta
     contra los ids del grupo es la única forma de detectar el ÉXITO PARCIAL. Con 0 filas se
     trata como error (es lo que se vería si la RLS bloqueara el UPDATE). El error real de
     Supabase no se guarda ni se loguea: solo viaja el enum.

     OJO SI SE TOCA LA RLS: todo esto depende de que la política de SELECT siga devolviendo
     las filas archivadas. Si algún día se le agregara un `archivado_en IS NULL`, este
     `.select()` volvería vacío y el código reportaría 'error' con el archivado ya hecho. */
  const escribirArchivado = async (
    equipo: EquipoAgrupado,
    valor: string | null
  ): Promise<ResultadoArchivo> => {
    const supabase = obtenerSupabase()
    if (!supabase) return { resultado: 'error', tocados: 0 }
    try {
      const { data, error } = await supabase
        .from('inscripciones')
        .update({ [COL_ARCHIVADO_EN]: valor })
        .in(COL_ID, equipo.ids)
        .select(COL_ID)
        .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_MS))
      if (error || !data) return { resultado: 'error', tocados: 0 }
      const filas = data as unknown as Record<string, string | number>[]
      const idsTocados = new Set(filas.map((f) => String(f[COL_ID])))
      if (idsTocados.size === 0) return { resultado: 'error', tocados: 0 }
      /* 'ok' se decide por CÓMO QUEDÓ EL GRUPO, no por cuántas filas contestó la petición.
         Si se comparara `idsTocados.size` contra `equipo.ids.length`, un reintento que
         termina de archivar un equipo ya a medias saldría 'parcial' pese a haber quedado
         archivado entero, y el resultado real se perdería sin avisar. */
      const nuevo = conArchivado(equipo, idsTocados, valor)
      /* El grupo se recalcula desde `prev`, no se pisa con `nuevo`: `nuevo` deriva del prop
         capturado antes del await, así que sustituirlo tal cual descartaría cualquier otra
         escritura del mismo equipo que hubiera aterrizado en el medio. `nuevo` se usa solo
         para decidir el resultado, que es una foto de este UPDATE. Mismo criterio inmutable
         que `marcarPago` y `guardarNotas`. */
      setEquipos((prev) =>
        prev.map((e) => (e.clave === equipo.clave ? conArchivado(e, idsTocados, valor) : e))
      )
      const completo =
        valor === null ? nuevo.estadoArchivo === 'activo' : nuevo.estadoArchivo === 'archivado'
      /* `tocados` cuenta las filas que CAMBIARON de estado, no las que respondió el UPDATE:
         el `.in()` incluye siempre todos los ids del grupo, así que en un reintento sobre un
         equipo a medias las ya archivadas volverían a contarse e inflarían el mensaje. */
      const cambiadas = equipo.jugadores.filter(
        (j) =>
          idsTocados.has(String(j[COL_ID])) &&
          (j[COL_ARCHIVADO_EN] == null) !== (valor == null)
      ).length
      return { resultado: completo ? 'ok' : 'parcial', tocados: cambiadas }
    } catch {
      /* Timeout (abort) o red: mismo camino, sin logs ni exponer el error. */
      return { resultado: 'error', tocados: 0 }
    }
  }

  /* Reparto de quién dice qué, según qué tarjeta sobrevive a la operación:
     - archivar 'ok' → la tarjeta se desmonta: lo dice la región aria-live.
     - archivar 'parcial' → el equipo queda 'parcial' y sigue en el listado activo, así que
       la tarjeta se queda montada y lo dice ella con role="alert".
     - restaurar 'ok' y 'parcial' → en los dos casos el equipo sale de la lista de archivados
       y la tarjeta se desmonta: los dos los dice la región.
     - 'error' → nadie se desmontó nunca: siempre lo dice la tarjeta.
     Los conjuntos son disjuntos, así que ningún resultado se anuncia dos veces ni se pierde.

     Además, al desmontarse la tarjeta el foco caería a <body> (el botón que se acaba de usar
     ya no existe): se lo pasamos al interruptor "Ver archivados", que está siempre montado,
     está al lado del listado y acaba de cambiarle el contador. */
  const enfocarInterruptor = () => {
    /* Solo se rescata el foco si de verdad se perdió. Con el techo de 15 s el admin puede
       haberse ido a otro control mientras la escritura volaba; ahí moverle el foco sería
       arrancárselo de las manos, que es peor que el problema que esto arregla. */
    if (document.activeElement === document.body) botonVerArchivadosRef.current?.focus()
  }

  /* Timestamp del cliente, igual que en `pagado_en`: en un UPDATE no aplica el default de
     la DB. El skew es menor y aceptable para una marca de archivado. */
  const archivarEquipo = async (equipo: EquipoAgrupado): Promise<ResultadoArchivo> => {
    const r = await escribirArchivado(equipo, new Date().toISOString())
    if (r.resultado === 'ok') {
      setAnuncio(
        `Equipo ${nombreMostrado(equipo)} archivado. ${r.tocados} ${
          r.tocados === 1 ? 'jugador archivado' : 'jugadores archivados'
        }.`
      )
      enfocarInterruptor()
    }
    return r
  }

  const restaurarEquipo = async (equipo: EquipoAgrupado): Promise<ResultadoArchivo> => {
    /* Restaurar se llama desde dos lugares y solo uno pierde su tarjeta: desde la lista de
       archivados el equipo se va (a activos, con 'ok' o con 'parcial') y hay que reubicar el
       foco; desde un equipo 'parcial' del listado activo la tarjeta se queda donde está y
       moverle el foco al usuario sería quitárselo de las manos. */
    const veniaDeArchivados = equipo.estadoArchivo === 'archivado'
    const r = await escribirArchivado(equipo, null)
    if (r.resultado === 'ok') {
      setAnuncio(`Equipo ${nombreMostrado(equipo)} restaurado.`)
    } else if (r.resultado === 'parcial') {
      setAnuncio(
        `Se ${r.tocados === 1 ? 'restauró' : 'restauraron'} ${r.tocados} de ${
          equipo.ids.length
        } jugadores de ${nombreMostrado(equipo)}. El equipo quedó archivado a medias.`
      )
    }
    if (veniaDeArchivados && r.resultado !== 'error') enfocarInterruptor()
    return r
  }

  if (estado === 'cargando') return <Esqueleto />
  if (estado === 'error') return <ErrorCarga />
  /* Vacío de verdad = ni una inscripción en la tabla. Que no queden equipos ACTIVOS es otra
     cosa (están todos archivados) y se resuelve más abajo con su propio mensaje. */
  if (equipos.length === 0) return <VacioInscripciones />

  /* Un equipo 'parcial' cuenta como activo: sigue teniendo inscripciones sin archivar y
     debe quedar a la vista para poder terminar (o deshacer) el archivado. */
  const activos = equipos.filter((e) => e.estadoArchivo !== 'archivado')
  const archivados = equipos
    .filter((e) => e.estadoArchivo === 'archivado')
    .sort((a, b) => tiempo(String(b.archivadoEn)) - tiempo(String(a.archivadoEn)))
  /* Contadores: solo lo activo. Los jugadores se cuentan por FILA sin archivar, no por
     tamaño del grupo, para que un equipo 'parcial' no infle el número. */
  const totalJugadores = activos.reduce((n, e) => n + e.jugadoresActivos, 0)

  /* Exporta las inscripciones a un CSV generado y descargado en el cliente, con lo que YA
     está en memoria (sin una segunda consulta a Supabase). Exporta SOLO lo activo: los
     equipos archivados quedan fuera, y de los 'parcial' salen únicamente sus filas sin
     archivar (el filtro por fila vive en construirCSV). En ambos casos se fija el anuncio
     aria-live, la única señal audible de que la acción ocurrió. */
  const exportarCSV = () => {
    if (totalJugadores === 0) {
      setAnuncio('No hay inscripciones activas para exportar.')
      return
    }
    descargarArchivo(construirCSV(activos), `inscripciones-lqc-${fechaHoyArchivo()}.csv`)
    setAnuncio('CSV descargado.')
  }

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
          <Resumen equipos={activos} totalJugadores={totalJugadores} />
        </div>
        {/* Acciones de nivel panel. El interruptor es un botón de alternancia con
            `aria-pressed`, que es lo que hace que un lector de pantalla lo lea como
            activado/desactivado; el conteo en la etiqueta evita encenderlo para descubrir
            que no hay nada. */}
        <div className="flex shrink-0 flex-wrap gap-2 self-start sm:self-auto">
          <button
            ref={botonVerArchivadosRef}
            type="button"
            onClick={() => setVerArchivados((v) => !v)}
            aria-pressed={verArchivados}
            className={verArchivados ? BTN_PANEL_ACTIVO : BTN_PANEL}
          >
            <Eye className="h-4 w-4" />
            Ver archivados ({archivados.length})
          </button>
          <button type="button" onClick={exportarCSV} className={BTN_PANEL}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {activos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center text-gray-400">
          No hay equipos activos. Los archivados aparecen con «Ver archivados».
        </p>
      ) : (
        <ul className="space-y-3 md:space-y-4">
          {activos.map((e) => (
            <li key={e.clave}>
              <TarjetaEquipo
                equipo={e}
                onMarcarPago={marcarPago}
                onGuardarNotas={guardarNotas}
                onArchivar={archivarEquipo}
                onRestaurar={restaurarEquipo}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Los archivados van en su propia sección, DEBAJO del listado activo y no en lugar de
          él: así los contadores de arriba siguen describiendo lo que se ve, y un equipo
          restaurado reaparece al instante en la lista de arriba. */}
      {verArchivados && (
        <section className="space-y-3 border-t border-white/10 pt-6 md:space-y-4 md:pt-8">
          <h2 className="font-mono text-[11px] uppercase tracking-wider text-gray-400">
            Equipos archivados
          </h2>
          {archivados.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-gray-500">
              No hay equipos archivados.
            </p>
          ) : (
            <ul className="space-y-3 md:space-y-4">
              {archivados.map((e) => (
                <li key={e.clave}>
                  <TarjetaArchivado equipo={e} onRestaurar={restaurarEquipo} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Región viva sr-only: anuncia a lectores de pantalla el resultado de exportar,
          archivar y restaurar, porque el gesto visual (la descarga, la tarjeta que cambia de
          lista) no comunica nada. Va siempre montada (con texto vacío al inicio) para que
          aria-live capte el cambio; como último hijo y con `sr-only` (position:absolute) no
          altera el layout. role="status" ya implica aria-live="polite" —no interrumpe—; se
          deja explícito por claridad. */}
      <span role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </span>
    </div>
  )
}
