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

/* MODELO NUEVO: el equipo es una FILA REAL en `public.equipos` con sus jugadores
   colgando por `equipo_id`. Antes el equipo era un string repetido en cada fila de
   `inscripciones` y este archivo tenía que reconstruirlo agrupando en el cliente.

   Lo que se fue con esa maquinaria, y por qué ya no hace falta:
   - `normalizarEquipo` / `agruparPorEquipo`: el equipo tiene id, no un nombre que
     haya que normalizar para adivinar quién va con quién.
   - El estado `'parcial'` del archivado y toda su detección de éxito parcial: era
     un artefacto de que archivar fueran N updates que podían fallar a medias. Con
     una fila por equipo el UPDATE es atómico — sale bien o no sale.
   - Las escrituras por `.in(id, ids)`: ahora son `.eq('id', equipo.id)`.

   Los jugadores NO se editan desde el panel: la RLS solo da UPDATE sobre `equipos`. */

type Rol = 'titular' | 'suplente'

/* Una fila de `public.jugadores`. `orden` es la posición dentro del roster y es lo
   que determinó el rol al registrarse; se conserva para poder mostrar el roster en ese
   mismo orden. Desde el registro individual (2026-07-30) ese orden ya no es «como lo
   mandó el capitán» sino el ORDEN EN QUE CADA UNO SE REGISTRÓ: lo asigna la RPC
   contando lo que ya había. */
type Jugador = {
  id: string | number
  orden: number
  gamertag: string
  nombre: string
  fecha_nacimiento: string
  celular: string
  correo: string
  municipio: string
  escolaridad: string
  genero: string
  rol: Rol
  creado_en: string
}

/* Una fila de `public.equipos` con sus jugadores embebidos por el join.
   `archivado_en`: null = activo, con fecha = archivado. Archivar NUNCA borra: es un
   UPDATE de esta columna, y un trigger propaga la baja (o el alta, al restaurar) a
   ATAK.GG. No hay política de DELETE. */
type Equipo = {
  id: string
  nombre: string
  capitan_nombre: string
  capitan_celular: string
  pagado: boolean | null
  pagado_en: string | null
  notas: string | null
  archivado_en: string | null
  creado_en: string
  jugadores: Jugador[]
}

/* Nombres de columna aislados en constantes: si el esquema los renombra, se cambian
   acá (y en las claves del tipo) sin tocar la lógica. Las escrituras filtran SIEMPRE
   por `id`, que ahora es la PK del equipo y no un puñado de ids de jugadores. */
const COL_ID = 'id' as const
const COL_PAGADO = 'pagado' as const
const COL_PAGADO_EN = 'pagado_en' as const
const COL_NOTAS = 'notas' as const
const COL_ARCHIVADO_EN = 'archivado_en' as const

/* Roster mínimo para competir.
   OJO, esto cambió el 2026-07-30 y cambia cómo hay que LEER el badge de roster
   incompleto: antes /registro exigía las 5 tarjetas en un solo envío, así que un equipo
   por debajo del mínimo era una anomalía —solo podía venir de una edición posterior en
   la base— y el badge señalaba algo que había que investigar. Ahora cada jugador se
   registra por su cuenta, así que un equipo con 1 o 2 jugadores es el estado NORMAL
   mientras el resto se registra, y el badge va a estar encendido en casi todos los
   equipos nuevos.
   O sea: sigue siendo cierto que al equipo le faltan jugadores para competir, pero ya
   no significa «acá pasó algo raro». Por eso los tres lugares donde se pinta —el badge
   del encabezado, la franja del panel expandido y la celda del resumen— están en azul y
   no en `rose`: es un contador de progreso, no una alerta. */
/* OJO: el mismo número vive en `src/pages/Registro.tsx` (MIN_JUGADORES), pero allá YA NO
   LO HACE CUMPLIR NADIE — con registro individual no hay un envío que traiga el roster
   entero, así que el mínimo sobrevive ahí solo como referencia de la pantalla de éxito
   («tu equipo tiene 3 de 5»). Ninguno de los dos lugares lo valida hoy. Las páginas son
   autocontenidas por diseño, así que no se comparte la constante — pero si cambia el
   mínimo hay que tocar los dos lugares. */
const MIN_JUGADORES = 5

/* Techo de las escrituras (pago, notas, archivado): pasado ese tiempo la query se
   aborta y cae en el mensaje genérico, en vez de dejar la tarjeta trabada en
   "Guardando…". Mismo criterio que el envío de /registro. */
const TIEMPO_LIMITE_MS = 15_000

/* El join: equipos con sus jugadores. Las columnas de jugador que el panel no pinta
   —fecha_nacimiento, escolaridad, municipio, genero— se traen igual para poder
   exportarlas al CSV SIN una segunda consulta. `nombre_norm` no se pide: es la clave
   de unicidad de la base y el panel no la usa para nada. */
const SELECT =
  `${COL_ID}, nombre, capitan_nombre, capitan_celular, ${COL_PAGADO}, ${COL_PAGADO_EN}, ${COL_NOTAS}, creado_en, ${COL_ARCHIVADO_EN}, ` +
  'jugadores (id, orden, gamertag, nombre, fecha_nacimiento, celular, correo, municipio, escolaridad, genero, rol, creado_en)'

/* ------------------------------------------------------------------ */
/*  Derivados (funciones puras, fáciles de auditar)                    */
/* ------------------------------------------------------------------ */

/* `pagado` llega como boolean|null: null cuenta como no pagado. Un helper y no un
   `=== true` suelto en cada uso para que la regla viva en un solo lugar. */
function estaPagado(equipo: Equipo): boolean {
  return equipo[COL_PAGADO] === true
}

function estaArchivado(equipo: Equipo): boolean {
  return equipo[COL_ARCHIVADO_EN] != null
}

/* Un roster por debajo del mínimo no puede competir todavía. Se marca en el panel en vez
   de filtrarlo, pero para ver el AVANCE de cada equipo mientras sus jugadores entran de a
   uno, no para ir a buscar a nadie: es un contador, no una alerta — ver MIN_JUGADORES. */
function rosterIncompleto(equipo: Equipo): boolean {
  return equipo.jugadores.length < MIN_JUGADORES
}

/* Nombre visible del equipo. Un `nombre` vacío se muestra —y se escribe, en la
   confirmación de archivado— como "Sin nombre": si se exigiera teclear la cadena
   vacía, la confirmación quedaría satisfecha sin escribir nada. */
function nombreMostrado(equipo: Equipo): string {
  /* Normalizado igual que la comparación de la confirmación: un `nombre` de puros
     espacios se vería vacío en el HTML y, sin esto, daría un nombre a teclear que se
     satisface sin escribir nada. */
  return normalizarEspacios(equipo.nombre ?? '') || 'Sin nombre'
}

/* Espacios de los extremos fuera y los internos colapsados a uno, sin tocar mayúsculas. */
function normalizarEspacios(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ')
}

/* creado_en / archivado_en → milisegundos. Se compara por tiempo real, no
   lexicográficamente, por si el timestamp llega con distinto offset. Inválido → 0. */
function tiempo(iso: string): number {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

/* Normaliza lo que devuelve PostgREST. Solo dos cosas, ninguna es agrupar:
   - `jugadores` puede venir null si el equipo no tiene ninguno (left join), y el
     resto del archivo asume un array.
   - el orden del roster se reafirma en el cliente. La query ya lo pide por `orden`,
     pero de ese orden dependen el rol que se muestra y el CSV, así que no se deja
     a merced de que nadie toque el `referencedTable` de la consulta. */
function normalizarEquipos(filas: Equipo[]): Equipo[] {
  return filas.map((equipo) => ({
    ...equipo,
    jugadores: [...(equipo.jugadores ?? [])].sort((a, b) => a.orden - b.orden)
  }))
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
   CSV = un jugador; los campos de equipo se repiten en cada jugador.
   Respecto del modelo viejo: entra `Rol` (que antes no existía) y sale `Localidad`
   (que el formulario nuevo ya no pide y la tabla no tiene). Siguen siendo 16. */
const COLUMNAS_CSV = [
  'Equipo',
  'Gamertag',
  'Nombre',
  'Rol',
  'Fecha de Nacimiento',
  'Celular',
  'Escolaridad',
  'Municipio',
  'Correo',
  'Género',
  /* `capitan_nombre` lleva el Riot ID del capitán, no su nombre. El encabezado lo dice
     para que quien abra el CSV no lo tome por un nombre mal escrito. */
  'Riot ID del Capitán',
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
   - Anti-inyección: los datos vienen del formulario PÚBLICO /registro, o sea entrada NO
     confiable. Una celda que arranque con `=`, `+`, `-`, `@` (o TAB/CR) la interpreta
     Excel/Sheets como fórmula al abrir el archivo (p. ej. `=HYPERLINK(...)`), justo
     cuando el que abre es un admin. Se le antepone un apóstrofo: Excel lo esconde y
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

/* Arma el CSV completo (con BOM) a partir de los equipos: una fila por jugador. Los
   campos de equipo (nombre, capitán, pago, notas) se repiten en cada jugador, coherente
   con lo que ve el panel —el pago y las notas son por equipo—. El BOM UTF-8 (U+FEFF) al
   inicio hace que Excel muestre bien los acentos; las filas se separan con CRLF (RFC 4180).

   ARCHIVADOS FUERA: el CSV es la foto de la liga viva, y el llamador ya pasa nada más los
   equipos activos. Ya no hace falta filtrar TAMBIÉN por fila como en el modelo viejo: ahí
   un equipo podía quedar archivado a medias y había que excluir sus filas archivadas una
   por una. Ahora el archivado es del equipo entero, así que si el equipo está en la lista,
   están todos sus jugadores. */
function construirCSV(equipos: Equipo[]): string {
  const filas: string[] = [COLUMNAS_CSV.map(celdaCSV).join(',')]
  for (const equipo of equipos) {
    const nombre = nombreMostrado(equipo)
    const pagado = estaPagado(equipo) ? 'Sí' : 'No'
    const fechaPago = fmtFechaLocalDiaCSV(equipo[COL_PAGADO_EN])
    const notas = equipo[COL_NOTAS] ?? ''
    for (const j of equipo.jugadores) {
      filas.push(
        [
          nombre,
          j.gamertag,
          j.nombre,
          j.rol === 'titular' ? 'Titular' : 'Suplente',
          fmtFechaSoloDiaCSV(j.fecha_nacimiento),
          j.celular,
          j.escolaridad,
          j.municipio,
          j.correo,
          j.genero,
          equipo.capitan_nombre,
          equipo.capitan_celular,
          pagado,
          fechaPago,
          notas,
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

/* Rol del jugador. Titular en azul apagado (es lo esperable, no una alarma) y suplente
   en gris: la diferencia tiene que leerse de un vistazo sin gritar. `rose` queda
   reservado a errores y a lo destructivo, y a nada más — el roster corto salió de esa
   familia el 2026-07-30, justamente para que el rojo del panel signifique algo. */
function BadgeRol({ rol }: { rol: Rol }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
        rol === 'titular'
          ? 'border-blue-700/50 bg-blue-950/40 text-blue-300'
          : 'border-white/10 bg-white/5 text-gray-400'
      }`}
    >
      {rol === 'titular' ? 'Titular' : 'Suplente'}
    </span>
  )
}

/* Contador de roster: se marca donde se ve el equipo y no se filtra de la lista.
   FAMILIA AZUL, NO `rose`, y sin icono de alerta. Estuvo en rojo con un AlertCircle
   mientras el registro venía por equipo, y ahí tenía sentido: un equipo por debajo del
   mínimo solo podía venir de una edición en la base, o sea una anomalía que había que ir
   a mirar. Con registro individual es el estado NORMAL de casi todos los equipos nuevos
   mientras sus jugadores entran de a uno, así que el rojo pintaba media lista y entrenaba
   a ignorar la señal — justo lo que arruina que sirva el día que marque algo real. (Y
   siguió en rojo unos días después del cambio de modelo, anotado como pendiente de
   decidir; esto cierra esa deuda.)
   El «3 de 5» ya dice todo lo que hay que saber; el icono solo agregaba alarma.
   Sigue apareciendo únicamente por debajo del mínimo, o sea que sigue siendo información
   y no decoración: un equipo completo no lo lleva.
   Sin `gap`: con el icono fuera queda un solo ítem de flexbox —el `sr-only` está fuera de
   flujo— y no había nada que separar. */
function BadgeRosterIncompleto({ cantidad }: { cantidad: number }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-blue-800/50 bg-blue-950/30 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-blue-300">
      {/* Sin esto se oye "3 jugadores, 3 de 5": el número se repite y el badge llega sin
          sustantivo. Dice «jugadores registrados» y no «roster incompleto» por lo mismo
          que el color dejó de ser rojo: lo que se anuncia es un avance, no una falta. */}
      <span className="sr-only">Jugadores registrados: </span>
      {cantidad} de {MIN_JUGADORES}
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

/* Tarjeta de equipo colapsable + acciones (marcar pago, notas, archivar).

   Estructura del encabezado — GOTCHA: no se puede anidar <button> dentro de <button>
   (HTML inválido). El disparador del colapso y el botón de pago son HERMANOS dentro de
   un contenedor flex: el área de info (nombre/contador/capitán/badge/fecha) es el
   <button> que expande, y la acción de pago va al lado, como otra celda. El contenido del
   disparador es solo de frase (`<span>` + iconos), nunca bloques. Las notas y su botón
   viven en el panel expandido, que es un <div> hermano fuera del disparador.

   Pago (por equipo): confirmación inline on-brand (no window.confirm, no modal).
   Actualización PESIMISTA: se aplica solo tras el éxito. Al éxito, el padre muta
   `equipos` de forma inmutable y el badge, la fecha y el número "Confirmados" del
   resumen se recalculan solos, sin refetch (que perdería la expansión). En error/timeout
   no se cambia nada y se muestra un texto genérico.

   Notas (por equipo): textarea en el panel expandido, guardado explícito con botón
   (nunca al teclear), con estados sin-cambios/sin-guardar/guardando/guardado/error.

   Archivado (por equipo): vive en una zona aparte al FINAL del panel expandido, fuera del
   flujo de las acciones normales, y exige escribir el nombre exacto del equipo. No usa
   window.confirm ni un diálogo de sí/no: un clic distraído no puede archivar. El UPDATE
   pone archivado_en = ahora en LA fila del equipo; jamás se borra nada.

   Lo que ya NO está, porque el modelo lo volvió imposible: el estado 'parcial' y su
   botón "Restaurar las archivadas". Un equipo archivado a medias solo existía cuando
   archivar eran N updates independientes.

   Los controles de escritura de la tarjeta se deshabilitan mientras una operación vuela
   (`ocupado`). Un flag `montado` evita setState si la tarjeta se desmonta a mitad. */
function TarjetaEquipo({
  equipo,
  onMarcarPago,
  onGuardarNotas,
  onArchivar
}: {
  equipo: Equipo
  onMarcarPago: (equipo: Equipo, pagar: boolean) => Promise<boolean>
  onGuardarNotas: (equipo: Equipo, notas: string) => Promise<boolean>
  onArchivar: (equipo: Equipo) => Promise<boolean>
}) {
  const notasGuardadas = equipo[COL_NOTAS] ?? ''

  const [expandido, setExpandido] = useState(false)
  const [estadoPago, setEstadoPago] = useState<'idle' | 'confirmando' | 'guardando'>('idle')
  const [errorPago, setErrorPago] = useState(false)
  const [notasTexto, setNotasTexto] = useState(notasGuardadas)
  const [estadoNotas, setEstadoNotas] = useState<'idle' | 'guardando' | 'guardado' | 'error'>(
    'idle'
  )
  /* `modoArchivar` es el estado LOCAL del control (qué está mostrando la zona de archivado),
     distinto de si el equipo está archivado en la base. */
  const [modoArchivar, setModoArchivar] = useState<'idle' | 'confirmando' | 'archivando'>(
    'idle'
  )
  /* Texto tecleado en la confirmación y si el último intento de archivar falló. Ya no hace
     falta guardar CUÁNTAS filas se tocaron: el archivado es de una sola fila. */
  const [errorArchivar, setErrorArchivar] = useState(false)
  const [textoConfirma, setTextoConfirma] = useState('')

  const panelId = useId()
  const notasId = useId()
  const confirmaId = useId()
  const confirmarRef = useRef<HTMLButtonElement>(null)
  const botonPagoRef = useRef<HTMLButtonElement>(null)
  const botonArchivarRef = useRef<HTMLButtonElement>(null)
  const botonConfirmarArchivoRef = useRef<HTMLButtonElement>(null)
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

  const cantidad = equipo.jugadores.length
  const incompleto = rosterIncompleto(equipo)
  const pagado = estaPagado(equipo)
  /* Una escritura de esta tarjeta (pago, notas o archivado) bloquea sus propios controles. */
  const ocupado =
    estadoPago === 'guardando' ||
    estadoNotas === 'guardando' ||
    modoArchivar === 'archivando'
  /* Toggle: si está pagado, la acción es desmarcar; si no, marcar. */
  const pagar = !pagado
  const notasCambiadas = notasTexto !== notasGuardadas
  /* Coincidencia con el nombre del equipo distinguiendo MAYÚSCULAS (eso es a propósito: es
     lo que obliga a mirar el nombre y escribirlo), pero normalizando los espacios de los dos
     lados. El HTML colapsa los espacios al pintar, así que un equipo guardado como
     "Los  Panditas" se ve "Los Panditas": exigir la cadena literal dejaría ese equipo
     imposible de archivar, con el botón muerto y sin explicación. */
  const nombre = nombreMostrado(equipo)
  const confirmaCoincide = normalizarEspacios(textoConfirma) === normalizarEspacios(nombre)

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
    setErrorArchivar(false)
    setModoArchivar('idle')
  }

  /* Al éxito no se toca el estado local: el padre saca al equipo del listado activo y esta
     tarjeta se desmonta. Al fallar, la confirmación queda ABIERTA con el nombre ya escrito,
     para poder reintentar sin volver a teclearlo. */
  const confirmarArchivado = async () => {
    if (ocupado || !confirmaCoincide) return
    setErrorArchivar(false)
    setModoArchivar('archivando')
    const ok = await onArchivar(equipo)
    if (!montado.current) return
    if (ok) return
    setModoArchivar('confirmando')
    setErrorArchivar(true)
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
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 md:gap-x-3">
              <span className="truncate text-base font-semibold text-white md:text-lg">
                {nombre}
              </span>
              <span className="shrink-0 font-mono text-xs text-gray-400">
                {cantidad} {cantidad === 1 ? 'jugador' : 'jugadores'}
              </span>
              {/* Avance del roster: se ve sin desplegar la tarjeta, que es donde el
                  organizador está escaneando la lista. */}
              {incompleto && <BadgeRosterIncompleto cantidad={cantidad} />}
            </span>
            {/* `capitan_nombre` guarda el RIOT ID del capitán, no su nombre —es lo que
                espera ATAK en ese campo—, así que la etiqueta lo dice y el valor va en
                `font-mono`, como el resto de los identificadores del panel. Sin eso, un
                «Capitán: Jugador#MX1» se lee como un nombre mal escrito. La columna no
                se renombró a propósito: cambia lo que guarda, no cómo se llama. */}
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
              <span className="font-mono text-[11px] uppercase tracking-wider text-gray-400">
                Capitán (Riot ID)
              </span>
              <span className="font-mono text-gray-300">
                {equipo.capitan_nombre || '—'}
              </span>
              {/* El teléfono lleva su propio rótulo desde que el de la izquierda dejó de
                  ser genérico: colgando de «Capitán (Riot ID)» se leería como si también
                  fuera parte del identificador. */}
              <span className="font-mono text-[11px] uppercase tracking-wider text-gray-400">
                Cel.
              </span>
              <span className="font-mono text-gray-400">
                {equipo.capitan_celular || '—'}
              </span>
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-2.5 md:gap-3">
            {/* Badge + fecha de pago apilados: la fecha (`pagado_en`) solo cuando está
                pagado. `<span>` con flex sigue siendo contenido de frase válido. */}
            <span className="flex flex-col items-end gap-1">
              <BadgePago pagado={pagado} />
              {pagado && equipo[COL_PAGADO_EN] && (
                <span className="whitespace-nowrap font-mono text-[10px] leading-none text-gray-500">
                  {fmtFechaHora(equipo[COL_PAGADO_EN] as string)}
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
                ». El pago es uno por equipo.
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
              className={pagado ? BTN_SECUNDARIO : BTN_PRIMARIO}
            >
              {pagado ? 'Quitar pago' : 'Marcar pagado'}
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
        {/* Misma franja, otro registro: informativa y no de error, en la familia azul
            como el badge del encabezado. El texto también cambió de tono — decía «hay
            que avisarle al equipo que le faltan integrantes», que con el registro
            individual suena a reproche por algo que está pasando solo y a su ritmo.
            Dice lo que falta y cuál es el mecanismo, sin pedir nada. */}
        {incompleto && (
          <p className="border-b border-blue-900/30 bg-blue-950/10 px-4 py-3 text-xs leading-snug text-blue-200 md:px-6">
            Este equipo tiene {cantidad}{' '}
            {cantidad === 1 ? 'jugador' : 'jugadores'} y el mínimo para competir es{' '}
            {MIN_JUGADORES}. Cada quien se registra por su cuenta, así que el roster se
            completa a medida que entran los demás. Los jugadores no se editan desde el
            panel.
          </p>
        )}

        {/* Un equipo sin jugadores es posible en el modelo relacional (la fila del equipo
            existe por su cuenta). Sin esta línea el panel expandido mostraría una lista
            vacía y parecería que no cargó. */}
        {cantidad === 0 && (
          <p className="px-4 py-5 text-sm text-gray-400 md:px-6">
            Este equipo no tiene jugadores registrados.
          </p>
        )}

        <ul className="divide-y divide-white/5">
          {equipo.jugadores.map((j) => (
            <li key={j.id} className="px-4 py-4 md:px-6 md:py-5">
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 break-words font-sans font-semibold text-white">
                {/* La posición se muestra porque es lo que decidió el rol al registrarse:
                    sin ella, "suplente" parece una etiqueta arbitraria. */}
                {/* `gray-400` y no `gray-500`: sobre esta superficie el 500 se queda en
                    ~3.9:1 (lo documenta la tarjeta de archivados más abajo) y a 11px el
                    mínimo es 4.5:1. Este número no es decorativo — es lo que explica el
                    rol—, así que tiene que leerse. */}
                <span className="font-mono text-[11px] font-normal text-gray-400">
                  {j.orden}
                </span>
                {j.gamertag || '—'}
                <BadgeRol rol={j.rol} />
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
            de distraído ni leerse como una acción más. El fondo rose apenas teñido y el
            botón fantasma la marcan como destructiva sin robarle protagonismo al CTA azul
            del encabezado. */}
        <div className="border-t border-rose-900/30 bg-rose-950/10 px-4 py-4 md:px-6 md:py-5">
          {modoArchivar === 'idle' ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-xs leading-snug text-gray-400">
                Archivar saca al equipo del listado, del CSV y del torneo en ATAK.GG. No
                borra nada: puedes restaurarlo desde «Ver archivados».
              </p>
              <button
                ref={botonArchivarRef}
                type="button"
                onClick={() => {
                  setTextoConfirma('')
                  setErrorArchivar(false)
                  setModoArchivar('confirmando')
                }}
                disabled={ocupado}
                className={BTN_DESTRUCTIVO}
              >
                <Archive className="h-4 w-4" />
                Archivar equipo
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="font-sans text-sm font-semibold text-rose-100">
                Archivar «{nombre}»
              </p>
              <p className="text-sm leading-relaxed text-gray-300">
                Se archivará el equipo completo con sus {cantidad}{' '}
                {cantidad === 1 ? 'jugador' : 'jugadores'}. No se borra nada: el equipo
                sale del listado, del CSV y del torneo, y puedes restaurarlo cuando
                quieras desde «Ver archivados» — al restaurarlo vuelve a quedar inscrito.
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
              {/* La confirmación queda abierta con el nombre ya escrito, así que
                  reintentar es un solo clic. */}
              {errorArchivar && (
                <p role="alert" className="text-xs leading-snug text-rose-300">
                  No pudimos archivar el equipo. Inténtalo de nuevo.
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
  equipo: Equipo
  onRestaurar: (equipo: Equipo) => Promise<boolean>
}) {
  const [estado, setEstado] = useState<'idle' | 'restaurando'>('idle')
  /* Basta un booleano: el único desenlace que deja esta tarjeta montada es el error. Al
     restaurar, el equipo sale de la lista de archivados y la tarjeta ya no existe para
     mostrar nada; ese caso lo anuncia la región aria-live del padre. */
  const [error, setError] = useState(false)
  const botonRestaurarRef = useRef<HTMLButtonElement>(null)
  /* Enlaza el aviso de abajo con el botón: el texto va DESPUÉS de él en el DOM, así que sin
     esto Tab lo saltea y el aviso llega tarde —o nunca— justo a quien no lo ve venir. */
  const avisoId = useId()

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
    const ok = await onRestaurar(equipo)
    if (!montado.current) return
    /* Al éxito el equipo sale de la lista de archivados y esta tarjeta se desmonta en el
       mismo render, así que estos setState son inocuos: solo importan en el camino de
       error, que es el único que la deja viva. */
    setEstado('idle')
    setError(!ok)
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4 md:px-6 md:py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-sans font-semibold text-gray-300">{nombre}</p>
          {/* `text-gray-400` y no el `gray-500` de los metadatos secundarios del panel: sobre
              el fondo de esta tarjeta gray-500 se queda en ~3.9:1, por debajo del mínimo. */}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-gray-400">
            <span>
              {cantidad} {cantidad === 1 ? 'jugador' : 'jugadores'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Archivado el{' '}
              {equipo[COL_ARCHIVADO_EN] ? fmtFechaHora(equipo[COL_ARCHIVADO_EN] as string) : '—'}
            </span>
          </p>
        </div>
        <button
          ref={botonRestaurarRef}
          type="button"
          onClick={restaurar}
          disabled={estado === 'restaurando'}
          aria-busy={estado === 'restaurando'}
          aria-describedby={avisoId}
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
      {/* Mismo criterio que la zona de archivado: el efecto que sale del panel se dice ANTES
          de pulsar. Restaurar sigue siendo un clic sin confirmación (ver arriba), pero vuelve
          a inscribir al equipo en ATAK.GG y eso no se adivina desde la palabra «Restaurar».
          La frase es el espejo exacto de la de archivar ("saca al equipo del listado, del CSV
          y del torneo"): misma tripleta, verbo invertido. Dice "listado ACTIVO" y no "listado"
          a secas porque desde acá el usuario está parado en otro listado, el de archivados. */}
      <p id={avisoId} className="mt-3 text-xs leading-snug text-gray-400">
        Restaurar devuelve el equipo al listado activo, al CSV y al torneo en ATAK.GG.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-xs leading-snug text-rose-300">
          No pudimos restaurar el equipo. Inténtalo de nuevo.
        </p>
      )}
    </div>
  )
}

/* Resumen: números grandes en azul + etiqueta mono. La marca entra en el número; los
   datos se leen como herramienta, no como póster.
   "Incompletos" solo aparece cuando hay alguno: una celda fija en 0 ocupa el mismo
   espacio que las que sí informan y entrena a ignorarla. */
function Resumen({
  equipos,
  totalJugadores
}: {
  equipos: Equipo[]
  totalJugadores: number
}) {
  const incompletos = equipos.filter(rosterIncompleto).length
  /* Sin campo `alerta`: lo llevaba solo «Incompletos», para pintar su número en `rose`.
     Con registro individual esa cifra es la normal —va a ser alta casi siempre mientras
     la gente se inscribe— y en rojo convertía el resumen en un tablero de alarmas que
     no señalaba nada. Ahora es una cifra más, en el mismo azul que las otras tres, y
     como la bandera quedaba en `false` en todas se quita entera junto con su ternario.
     Lo que NO cambia: la celda sigue apareciendo solo cuando hay alguno, así que sigue
     informando y no ocupa lugar fijo. */
  const celdas = [
    { etiqueta: 'Equipos', valor: equipos.length },
    { etiqueta: 'Jugadores', valor: totalJugadores },
    { etiqueta: 'Confirmados', valor: equipos.filter(estaPagado).length },
    ...(incompletos > 0 ? [{ etiqueta: 'Incompletos', valor: incompletos }] : [])
  ]
  return (
    <div className={`grid gap-3 md:gap-4 ${celdas.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
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
      <span className="sr-only">Cargando equipos…</span>
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
          No pudimos cargar los equipos.
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
function VacioEquipos() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-black/30 p-10 text-center md:p-14">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-lqc-accent/20 bg-blue-950/40 shadow-lqc">
        <Inbox className="h-8 w-8 text-lqc-accent" />
      </div>
      <p className="font-sans text-lg text-white md:text-xl">
        Todavía no hay equipos registrados.
      </p>
      {/* Antes decía «cuando un capitán complete el registro»: describía el modelo por
          equipo, en el que un solo envío traía el roster entero. Desde el 2026-07-30
          cada jugador se registra por su cuenta, así que un equipo aparece acá con su
          PRIMER jugador y va creciendo de a uno. */}
      <p className="mx-auto mt-2 max-w-md font-sans leading-relaxed text-gray-400">
        En cuanto alguien se registre, su equipo aparecerá aquí.
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
  const [equipos, setEquipos] = useState<Equipo[]>([])
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
        /* Un solo viaje: equipos con sus jugadores embebidos. Antes eran N filas planas
           que había que agrupar acá. El `referencedTable` ordena el roster dentro de
           cada equipo; `normalizarEquipos` lo reafirma en el cliente. */
        const { data, error } = await supabase
          .from('equipos')
          .select(SELECT)
          .order('creado_en', { ascending: false })
          .order('orden', { referencedTable: 'jugadores', ascending: true })

        if (!montado) return
        /* No se guarda `error` en estado ni se loguea: solo se marca el enum. */
        if (error || !data) {
          setEstado('error')
          return
        }
        /* `data` viene como `any`/tipo de error de PostgREST porque el cliente no
           tiene el esquema generado (ver DEUDA en Registro.tsx): se castea vía
           `unknown` al contrato de columnas de arriba. */
        setEquipos(normalizarEquipos(data as unknown as Equipo[]))
        setEstado('listo')
      } catch {
        if (montado) setEstado('error')
      }
    })()

    return () => {
      montado = false
    }
  }, [])

  /* Aplica un cambio a un equipo del listado, de forma inmutable y por id. Las tres
     escrituras hacen lo mismo, así que la operación vive en un solo lugar. */
  const actualizarEquipo = (id: string, cambios: Partial<Equipo>) => {
    setEquipos((prev) => prev.map((e) => (e.id === id ? { ...e, ...cambios } : e)))
  }

  /* Escritura de pago. Ahora toca UNA fila por id — antes había que tocar todas las del
     grupo con `.in()`. Actualización pesimista: al éxito muta `equipos` de forma
     inmutable, así el badge, la fecha y el número "Confirmados" del resumen se recalculan
     sin refetch (que perdería el estado de expansión). El error nunca se filtra: la
     función devuelve un booleano, no el objeto de Supabase, y no se loguea. */
  const marcarPago = async (equipo: Equipo, pagar: boolean): Promise<boolean> => {
    const supabase = obtenerSupabase()
    if (!supabase) return false
    /* Timestamp del cliente: en un UPDATE no aplica el default de la DB. Skew menor,
       aceptable. Al desmarcar, pagado_en vuelve a null. */
    const pagadoEn = pagar ? new Date().toISOString() : null
    try {
      const { error } = await supabase
        .from('equipos')
        .update({ [COL_PAGADO]: pagar, [COL_PAGADO_EN]: pagadoEn })
        .eq(COL_ID, equipo.id)
        .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_MS))
      if (error) return false
      actualizarEquipo(equipo.id, { [COL_PAGADO]: pagar, [COL_PAGADO_EN]: pagadoEn })
      return true
    } catch {
      /* Timeout (abort) o red: mismo camino, sin logs ni exponer el error. */
      return false
    }
  }

  /* Escritura de notas. Mismo criterio: una fila, por id. */
  const guardarNotas = async (equipo: Equipo, notas: string): Promise<boolean> => {
    const supabase = obtenerSupabase()
    if (!supabase) return false
    try {
      const { error } = await supabase
        .from('equipos')
        .update({ [COL_NOTAS]: notas })
        .eq(COL_ID, equipo.id)
        .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_MS))
      if (error) return false
      actualizarEquipo(equipo.id, { [COL_NOTAS]: notas })
      return true
    } catch {
      return false
    }
  }

  /* Escritura de archivado/restauración. `valor` es la fecha (archivar) o null
     (restaurar); NUNCA un .delete(): la tabla no tiene política de DELETE y un borrado
     fallaría en silencio, devolviendo 0 filas sin error.

     Sigue habiendo un `.select()` después del UPDATE, y NO es la detección de éxito
     parcial que se borró —eso ya no puede pasar con una sola fila—. Es otra cosa:
     comprobar que el UPDATE alcanzó una fila visible, o sea 0 filas = error. (No prueba
     que el valor CAMBIARA: PostgREST devuelve la fila aunque se escriba lo mismo.) Sin
     él, un UPDATE que no encuentra ninguna fila —id que ya no está, o una RLS que lo
     bloquee— vuelve sin error y el panel reportaría éxito sobre algo que no ocurrió, con
     el agravante de que el trigger de ATAK tampoco habría disparado.
     Pago y notas no lo llevan a propósito: si fallan en silencio se
     corrige volviendo a pulsar, mientras que un archivado fantasma deja las dos bases
     divergiendo sin que nadie lo note.

     OJO SI SE TOCA LA RLS: esto depende de que la política de SELECT siga devolviendo las
     filas archivadas. Si algún día se le agregara un `archivado_en IS NULL`, este
     `.select()` volvería vacío y el código reportaría 'error' con el archivado ya hecho. */
  const escribirArchivado = async (equipo: Equipo, valor: string | null): Promise<boolean> => {
    const supabase = obtenerSupabase()
    if (!supabase) return false
    try {
      const { data, error } = await supabase
        .from('equipos')
        .update({ [COL_ARCHIVADO_EN]: valor })
        .eq(COL_ID, equipo.id)
        .select(COL_ID)
        .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_MS))
      if (error || !data || data.length === 0) return false
      actualizarEquipo(equipo.id, { [COL_ARCHIVADO_EN]: valor })
      return true
    } catch {
      return false
    }
  }

  /* Reparto de quién dice qué, según qué tarjeta sobrevive a la operación:
     - éxito → la tarjeta se desmonta (el equipo cambia de lista): lo dice la región aria-live.
     - error → nadie se desmontó: lo dice la tarjeta con role="alert".
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
  const archivarEquipo = async (equipo: Equipo): Promise<boolean> => {
    const ok = await escribirArchivado(equipo, new Date().toISOString())
    if (ok) {
      const n = equipo.jugadores.length
      setAnuncio(
        `Equipo ${nombreMostrado(equipo)} archivado, con sus ${n} ${
          n === 1 ? 'jugador' : 'jugadores'
        }.`
      )
      enfocarInterruptor()
    }
    return ok
  }

  const restaurarEquipo = async (equipo: Equipo): Promise<boolean> => {
    const ok = await escribirArchivado(equipo, null)
    if (ok) {
      setAnuncio(`Equipo ${nombreMostrado(equipo)} restaurado.`)
      enfocarInterruptor()
    }
    return ok
  }

  if (estado === 'cargando') return <Esqueleto />
  if (estado === 'error') return <ErrorCarga />
  /* Vacío de verdad = ni un equipo en la tabla. Que no queden equipos ACTIVOS es otra
     cosa (están todos archivados) y se resuelve más abajo con su propio mensaje. */
  if (equipos.length === 0) return <VacioEquipos />

  const activos = equipos.filter((e) => !estaArchivado(e))
  const archivados = equipos
    .filter(estaArchivado)
    .sort((a, b) => tiempo(String(b[COL_ARCHIVADO_EN])) - tiempo(String(a[COL_ARCHIVADO_EN])))
  /* Contadores: solo lo activo. Con el archivado por equipo, el total de jugadores es la
     suma directa de los rosters — ya no hay que contar fila por fila para descontar las
     archivadas de un equipo a medias. */
  const totalJugadores = activos.reduce((n, e) => n + e.jugadores.length, 0)

  /* Exporta a un CSV generado y descargado en el cliente, con lo que YA está en memoria
     (sin una segunda consulta a Supabase). Exporta SOLO lo activo. En ambos casos se fija
     el anuncio aria-live, la única señal audible de que la acción ocurrió. */
  const exportarCSV = () => {
    /* Dos guardas y no una: con el modelo relacional un equipo puede existir con CERO
       jugadores —es justo lo que marca el badge de roster incompleto—, así que
       `totalJugadores === 0` ya no implica que no haya equipos. Con una sola guarda, un
       panel lleno de equipos sin roster anunciaría "no hay equipos activos", que es falso.
       En el modelo viejo las dos condiciones eran equivalentes: sin filas no había equipo. */
    if (activos.length === 0) {
      setAnuncio('No hay equipos activos para exportar.')
      return
    }
    if (totalJugadores === 0) {
      setAnuncio('Los equipos activos no tienen jugadores: no hay nada que exportar.')
      return
    }
    /* El nombre del archivo NO cambia respecto del modelo viejo a propósito: es un
       contrato con quien archiva los exports, y renombrarlo rompería en silencio
       cualquier carpeta o convención ya armada. El contenido sí cambió (entra Rol,
       sale Localidad). */
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
            <li key={e.id}>
              <TarjetaEquipo
                equipo={e}
                onMarcarPago={marcarPago}
                onGuardarNotas={guardarNotas}
                onArchivar={archivarEquipo}
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
                <li key={e.id}>
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
