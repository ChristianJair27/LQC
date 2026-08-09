import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ImageOff, Loader2, Trash2 } from 'lucide-react'
import { obtenerSupabase } from '../../lib/supabase'

/* ------------------------------------------------------------------ */
/*  Contrato con la base y con la galería pública                      */
/* ------------------------------------------------------------------ */

/* Los mismos nombres que usan `Galeria.tsx` para leer y `SubirGaleria.tsx` para escribir.
   La duplicación es deliberada, por el mismo motivo que documenta SubirGaleria.tsx:9-11:
   las páginas del proyecto son autocontenidas y no hay un módulo de constantes compartido.
   Si el esquema los renombra, se cambian en los tres. */
const TABLA = 'galeria_media'
const BUCKET = 'galeria'

/* Techo de la escritura, el mismo que usan las del otro panel (ListaInscripciones.tsx:113).
   Pasado ese tiempo la query se aborta y cae en el mensaje genérico, en vez de dejar la
   foto trabada en "Borrando…" para siempre. */
const TIEMPO_LIMITE_MS = 15_000

/* Fila tal como llega de PostgREST, copiada de Galeria.tsx. De las siete columnas, las dos
   que el borrado NECESITA son `id` (paso 1, la fila) y `storage_path` (paso 2, el archivo);
   el resto es lo que hace reconocible la miniatura. */
type FilaGaleria = {
  id: string
  storage_path: string
  titulo: string | null
  tipo: string
  es_vertical: boolean
  ancho: number | null
  alto: number | null
}

/* La fila más la URL pública ya resuelta: `getPublicUrl` se llama UNA vez por fila al
   cargar y no en cada render. */
type MediaItem = FilaGaleria & { url: string }

type Estado = 'cargando' | 'listo' | 'error'

/* Lectura defensiva, copiada de `normalizarItems` de Galeria.tsx. Acá descartar una fila
   mal formada importa por un motivo extra al de la galería pública: sin `id` o sin
   `storage_path` la foto no se PODRÍA borrar —le falta la clave de uno de los dos pasos—,
   así que pintarla sería ofrecer un botón condenado a fallar. */
function normalizarItems(cuerpo: unknown, urlPublica: (path: string) => string): MediaItem[] {
  if (!Array.isArray(cuerpo)) return []

  const items: MediaItem[] = []
  for (const fila of cuerpo) {
    if (typeof fila !== 'object' || fila === null) continue

    const { id, storage_path, titulo, tipo, es_vertical, ancho, alto } = fila as {
      id?: unknown
      storage_path?: unknown
      titulo?: unknown
      tipo?: unknown
      es_vertical?: unknown
      ancho?: unknown
      alto?: unknown
    }

    if (typeof id !== 'string' || !id) continue
    if (typeof storage_path !== 'string' || !storage_path) continue
    if (typeof tipo !== 'string' || !tipo) continue

    items.push({
      id,
      storage_path,
      titulo: typeof titulo === 'string' && titulo ? titulo : null,
      tipo,
      es_vertical: es_vertical === true,
      ancho: typeof ancho === 'number' && Number.isFinite(ancho) ? ancho : null,
      alto: typeof alto === 'number' && Number.isFinite(alto) ? alto : null,
      url: urlPublica(storage_path)
    })
  }
  return items
}

/* ------------------------------------------------------------------ */
/*  Mensajes                                                           */
/* ------------------------------------------------------------------ */

const MSG_SIN_CLIENTE = 'No hay conexión con la base. Recarga la página e inténtalo de nuevo.'

/* Los dos finales del PASO 1 se distinguen a propósito. Un fallo de transporte se
   reintenta; "cero filas sin error" NO es un problema de red: o la fila ya no está, o la
   política no deja borrarla, y en los dos casos reintentar da igual. Decir "revisa tu
   conexión" ahí mandaría al admin a mirar donde no es. */
const MSG_BORRADO_TRANSPORTE = 'No pudimos borrarla. Revisa tu conexión e inténtalo de nuevo.'
const MSG_BORRADO_CERO =
  'La base no borró nada: puede que la foto ya no exista o que tu sesión no tenga permiso. Recarga la página.'

/* El huérfano NO es un fallo del borrado: la fila se borró y la foto ya desapareció de la
   galería, que es lo que se pidió. Lo que quedó es un archivo suelto ocupando espacio. */
const MSG_HUERFANO =
  'La foto se quitó de la galería, pero no pudimos borrar su archivo del almacenamiento.'

/* ------------------------------------------------------------------ */
/*  Estilos                                                            */
/* ------------------------------------------------------------------ */

/* Mismas neutralizaciones que el resto del panel: `bg-none` mata el gradiente que index.css
   le pone a todo <button>, y los dos `hover:` el salto de -2px con halo azul.
   `font-sans`/`tracking-normal` neutralizan la Orbitron de la misma regla base. */
const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-sans font-medium tracking-normal ' +
  'transition-colors duration-200 hover:[transform:none] hover:shadow-none ' +
  'disabled:opacity-60 disabled:cursor-not-allowed'

const BTN_SECUNDARIO =
  `${BTN_BASE} bg-none bg-black/40 border border-blue-800/40 text-gray-200 hover:bg-blue-950/40 hover:border-blue-600/60 hover:text-white`

/* Los dos destructivos son los de ListaInscripciones.tsx:475-478, y por el mismo criterio:
   el disparador es un FANTASMA (sin relleno, borde tenue) para no ser lo más llamativo de
   la tarjeta, y el relleno aparece solo en el "Confirmar", donde ya es la acción principal
   de su bloque. Acá pesa más que allá: archivar un equipo se deshace, esto no. */
const BTN_DESTRUCTIVO =
  `${BTN_BASE} bg-none bg-transparent border border-rose-700/70 text-rose-300 hover:bg-rose-950/40 hover:border-rose-600/80 hover:text-rose-200`

const BTN_DESTRUCTIVO_SOLIDO =
  `${BTN_BASE} bg-none bg-rose-900/60 border border-rose-700/60 text-rose-50 hover:bg-rose-800/70 hover:border-rose-600/70`

/* ------------------------------------------------------------------ */
/*  Borrado de UNA foto                                                */
/* ------------------------------------------------------------------ */

/* El huérfano viaja en la variante de ÉXITO, no en la de fallo, y no es un descuido: si el
   paso 2 falla la foto igual desapareció de la galería. Tratarlo como error dejaría la
   miniatura en la lista apuntando a una fila que ya no existe. */
type ResultadoBorrado =
  | { ok: true; huerfano?: string }
  | { ok: false; mensaje: string }

/* Borra una foto en DOS PASOS, fila primero y archivo después.
   El orden es deliberado: si falla el paso 2 queda un archivo huérfano INVISIBLE (nadie lo
   referencia, solo ocupa espacio), y eso es preferible a un hueco roto VISIBLE en la
   galería pública, que es lo que dejaría el orden inverso si fallara el borrado de la fila.
   Devuelve un resultado tipado en vez de tocar estado, igual que `publicarUna` en
   SubirGaleria.tsx:252: quien decide qué mostrar es el componente. */
async function borrarUna(
  supabase: NonNullable<ReturnType<typeof obtenerSupabase>>,
  item: MediaItem
): Promise<ResultadoBorrado> {
  try {
    /* PASO 1 — la fila. El `.select('id')` NO es decorativo: sin él un DELETE de PostgREST
       no devuelve filas nunca, así que no habría forma de distinguir "borré una" de "no
       borré ninguna". Y el caso de las cero filas es real: cuando la política RLS no
       autoriza el borrado, la respuesta llega con `error: null` y el arreglo vacío. Dar eso
       por bueno sería el éxito falso que ya documenta `escribirArchivado` en
       ListaInscripciones.tsx:1928 para los UPDATE. */
    const { data, error } = await supabase
      .from(TABLA)
      .delete()
      .eq('id', item.id)
      .select('id')
      .abortSignal(AbortSignal.timeout(TIEMPO_LIMITE_MS))

    if (error) return { ok: false, mensaje: MSG_BORRADO_TRANSPORTE }
    if (!data || data.length === 0) return { ok: false, mensaje: MSG_BORRADO_CERO }

    /* PASO 2 — el archivo. Se llega acá SOLO porque la comprobación de arriba confirmó que
       la fila se fue: esa verificación es la que AUTORIZA este paso. Borrar el archivo con
       la fila todavía viva dejaría a la galería pública pintando un hueco roto. */
    const limpiado = await borrarDelBucket(supabase, item.storage_path)
    return limpiado ? { ok: true } : { ok: true, huerfano: item.storage_path }
  } catch {
    /* Red, timeout del abort o cualquier otra cosa, siempre del paso 1: `borrarDelBucket`
       atrapa lo suyo y nunca lanza. No se sabe si la fila llegó a borrarse, así que NO se
       toca el archivo: borrarlo a ciegas podría dejar huérfana a una fila viva, que es
       exactamente el desenlace que este orden evita. */
    return { ok: false, mensaje: MSG_BORRADO_TRANSPORTE }
  }
}

/* Borra un archivo del bucket y dice si de verdad lo borró. Copiada de
   SubirGaleria.tsx:313-323, incluida la razón del `data.length`: `remove` puede volver sin
   error y sin haber borrado nada si la política del bucket no permite DELETE. */
async function borrarDelBucket(
  supabase: NonNullable<ReturnType<typeof obtenerSupabase>>,
  nombre: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).remove([nombre])
    return !error && Array.isArray(data) && data.length > 0
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/*  Estados de carga                                                   */
/* ------------------------------------------------------------------ */

/* Mismo molde que `EsqueletoGaleria` de Galeria.tsx y `Esqueleto` de ListaInscripciones:
   `role="status"`, el texto para lector de pantalla en `sr-only` y las cajas con
   `aria-hidden` porque no significan nada. La grilla es la misma que la del contenido real
   para que al llegar los datos no salte de una disposición a otra. */
function EsqueletoGestion() {
  return (
    <div role="status">
      <span className="sr-only">Cargando las fotos publicadas…</span>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li
            key={i}
            className="animate-pulse rounded-2xl border border-white/5 bg-white/[0.03] p-3"
          >
            <div className="h-40 w-full rounded-lg bg-white/[0.04]" />
            <div className="mt-3 h-3 w-2/3 rounded bg-white/[0.04]" />
            <div className="mt-2 h-3 w-1/3 rounded bg-white/[0.04]" />
          </li>
        ))}
      </ul>
    </div>
  )
}

/* Error genérico, familia `rose` y `role="alert"`. El error real de Supabase nunca se
   expone: el estado es un enum y no guarda el objeto. */
function ErrorCarga() {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-950/30 p-5"
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
      <div>
        <p className="font-sans text-sm text-rose-200">No pudimos cargar las fotos.</p>
        <p className="mt-1 font-sans text-sm text-rose-300/80">
          Recarga la página e inténtalo de nuevo en unos minutos.
        </p>
      </div>
    </div>
  )
}

/* Vacío: no es un error. Es lo que se ve con la tabla sin filas, y también después de
   borrar la última foto. */
function VacioGestion() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-black/30 p-10 text-center md:p-14">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-lqc-accent/20 bg-blue-950/40 shadow-lqc">
        <ImageOff className="h-8 w-8 text-lqc-accent" />
      </div>
      <p className="font-sans text-lg text-white">Todavía no hay fotos publicadas.</p>
      <p className="mx-auto mt-2 max-w-md font-sans leading-relaxed text-gray-400">
        Las que subas desde la pestaña «Galería» aparecerán aquí para poder borrarlas.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Componente                                                         */
/* ------------------------------------------------------------------ */

export default function GestionGaleria() {
  /* Sin cliente (build sin credenciales o URL inválida) el estado arranca en 'error' desde
     el inicializador, y no con un setState síncrono dentro del efecto. `obtenerSupabase()`
     es idempotente y nunca lanza: memoiza el cliente. Copiado de Galeria.tsx:193. */
  const [estado, setEstado] = useState<Estado>(() => (obtenerSupabase() ? 'cargando' : 'error'))
  const [items, setItems] = useState<MediaItem[]>([])

  /* Qué foto tiene la confirmación abierta y cuál se está borrando. Van por id y no por
     booleano porque identifican A CUÁL: son los que deciden qué pinta cada tarjeta. */
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const [borrandoId, setBorrandoId] = useState<string | null>(null)

  /* El fallo se guarda con el id de su foto para pintarlo EN esa tarjeta. Uno solo: nunca
     hay dos borrados en vuelo, así que un segundo fallo reemplaza al primero en vez de
     acumular avisos viejos por toda la grilla. */
  const [errorBorrado, setErrorBorrado] = useState<{ id: string; mensaje: string } | null>(null)

  /* Los huérfanos viven en su propio estado y NO derivados de `items`: la foto que los
     produce se va de la lista en el mismo momento en que aparecen, así que derivarlos sería
     perderlos al instante. Limpiarlos es manual desde Supabase y sin el path no hay dónde
     buscarlos. Mismo criterio que el uploader (SubirGaleria.tsx:386). */
  const [huerfanos, setHuerfanos] = useState<string[]>([])

  /* Texto ÚNICO de la región viva. Las tarjetas van MUDAS —sin `role` propio— porque veinte
     miniaturas anunciándose sola cada una serían ruido; lo que habla es esta región, que
     dice tanto los éxitos como los fallos para que ninguno quede en silencio. Es el mismo
     reparto que documenta ListaInscripciones.tsx:1737-1741, resuelto acá con una sola
     región en vez de dos. */
  const [anuncio, setAnuncio] = useState('')

  const confirmarRef = useRef<HTMLButtonElement>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)
  /* Los disparadores "Borrar", por id, para poder devolverles el foco al cancelar. Un mapa
     y no un ref suelto porque hay uno por tarjeta. */
  const disparadoresRef = useRef(new Map<string, HTMLButtonElement>())

  /* Flag para no llamar setState si el componente se desmonta con el borrado en vuelo (se
     cambia de pestaña en el panel). Se reafirma en true en cada montaje porque StrictMode
     monta dos veces en desarrollo. Molde de ListaInscripciones.tsx:1006-1014. */
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  /* Carga inicial. Molde de Galeria.tsx:199-238: flag `montado` local, guarda temprana si no
     hay cliente y el error solo marca el enum, sin guardar el objeto ni loguearlo.
     El ORDEN es lo único que cambia a propósito: la galería pública ordena por `orden` y
     después por fecha, pero acá lo que se busca es lo último subido —que es lo que se va a
     querer borrar—, así que va `creado_en` descendente y nada más. */
  useEffect(() => {
    let vivo = true

    const supabase = obtenerSupabase()
    if (!supabase) return

    void (async () => {
      try {
        const { data, error } = await supabase
          .from(TABLA)
          .select('*')
          .order('creado_en', { ascending: false })

        if (!vivo) return
        if (error || !data) {
          setEstado('error')
          return
        }

        /* `getPublicUrl` es SÍNCRONO —no pega a la red, arma la URL con la del proyecto— así
           que se resuelve acá al normalizar y no en el render. El bucket es público: la URL
           sirve directo en un `src`, sin firmar nada. */
        setItems(
          normalizarItems(
            data,
            (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
          )
        )
        setEstado('listo')
      } catch {
        if (vivo) setEstado('error')
      }
    })()

    return () => {
      vivo = false
    }
  }, [])

  /* Foco de la confirmación, comparando el valor PREVIO en un ref y no con una bandera de
     "ya lo moví": es lo que lo hace sobrevivir al doble montaje de StrictMode. Molde de
     ListaInscripciones.tsx:1016-1031.
     Al abrir va al "Confirmar"; al cerrar vuelve al "Borrar" de esa misma foto. Si el
     disparador ya no existe —el caso normal del éxito: la tarjeta se desmontó— el foco iría
     a <body> y se perdería, así que cae al contenedor. */
  const confirmandoPrevio = useRef<string | null>(null)
  useEffect(() => {
    const previo = confirmandoPrevio.current
    confirmandoPrevio.current = confirmandoId

    if (confirmandoId && confirmandoId !== previo) {
      confirmarRef.current?.focus()
      return
    }
    if (!confirmandoId && previo) {
      const disparador = disparadoresRef.current.get(previo)
      if (disparador) disparador.focus()
      else contenedorRef.current?.focus()
    }
  }, [confirmandoId])

  const ocupado = borrandoId !== null

  const pedirConfirmacion = (id: string) => {
    if (ocupado) return
    /* El fallo anterior se limpia al abrir otra confirmación: es de otra foto y otro
       intento, dejarlo puesto lo haría parecer el resultado de este. */
    setErrorBorrado(null)
    setConfirmandoId(id)
  }

  const cancelar = () => {
    if (ocupado) return
    setErrorBorrado(null)
    setConfirmandoId(null)
  }

  const confirmarBorrado = async (item: MediaItem) => {
    if (ocupado) return

    const supabase = obtenerSupabase()
    if (!supabase) {
      setErrorBorrado({ id: item.id, mensaje: MSG_SIN_CLIENTE })
      setAnuncio(MSG_SIN_CLIENTE)
      return
    }

    setErrorBorrado(null)
    setBorrandoId(item.id)
    setAnuncio('Borrando la foto…')

    const resultado = await borrarUna(supabase, item)

    if (!montado.current) return
    setBorrandoId(null)

    if (!resultado.ok) {
      /* La confirmación queda ABIERTA con el error debajo, para poder reintentar sin volver
         a abrirla. Mismo criterio que el archivado en ListaInscripciones.tsx:1106-1108. */
      setErrorBorrado({ id: item.id, mensaje: resultado.mensaje })
      setAnuncio(resultado.mensaje)
      return
    }

    /* ÉXITO. Se saca de la lista local sin refetch: la fila ya no existe en la base, así que
       volver a pedirla sería un viaje para confirmar lo que la verificación del paso 1 ya
       confirmó. */
    setConfirmandoId(null)
    setItems((previos) => previos.filter((i) => i.id !== item.id))

    const { huerfano } = resultado
    if (huerfano) {
      setHuerfanos((previos) => [...previos, huerfano])
      setAnuncio(`${MSG_HUERFANO} El archivo pendiente de limpieza se lista abajo.`)
    } else {
      setAnuncio('Foto borrada de la galería.')
    }
  }

  return (
    /* `tabIndex={-1}` para poder recibir el foco por código cuando la tarjeta que lo tenía
       se desmonta al borrarse. No entra en el orden de tabulación ni pinta anillo: es un
       destino de rescate, no un control. */
    <div ref={contenedorRef} tabIndex={-1} className="space-y-8 focus:outline-none">
      <div className="rounded-2xl border border-white/5 bg-black/30 p-6 backdrop-blur-sm md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-lqc-accent/20 bg-blue-950/40">
            <Trash2 className="h-5 w-5 text-lqc-accent" />
          </span>
          <div className="min-w-0">
            <p className="font-sans font-medium text-white">Fotos publicadas</p>
            <p className="text-sm text-gray-400">
              Lo último subido va primero. Borrar quita la foto de la galería del sitio y su
              archivo del almacenamiento: no se puede deshacer.
            </p>
          </div>
        </div>

        {/* LA ÚNICA región viva del componente. Las tarjetas de abajo son mudas a propósito.
            `aria-live="polite"` por `role="status"`: espera a que el lector termine lo que
            está diciendo en vez de interrumpirlo. */}
        <p role="status" className="mb-4 min-h-5 font-mono text-[11px] text-blue-300">
          {ocupado && <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />}
          {anuncio}
        </p>

        {estado === 'cargando' && <EsqueletoGestion />}
        {estado === 'error' && <ErrorCarga />}
        {estado === 'listo' && items.length === 0 && <VacioGestion />}

        {estado === 'listo' && items.length > 0 && (
          <>
            <p className="mb-4 font-mono text-[11px] uppercase tracking-wider text-gray-400">
              {items.length === 1 ? '1 foto' : `${items.length} fotos`}
            </p>

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const confirmando = confirmandoId === item.id
                const borrando = borrandoId === item.id
                const error = errorBorrado?.id === item.id ? errorBorrado.mensaje : null

                return (
                  <li
                    key={item.id}
                    className={`flex flex-col overflow-hidden rounded-2xl border bg-black/20 p-3 transition-colors duration-200 ${
                      confirmando ? 'border-rose-700/50' : 'border-white/10'
                    }`}
                  >
                    {/* Miniatura de ALTO FIJO con `object-cover`: en una grilla de gestión lo
                        que importa es reconocer la foto de un vistazo, y tarjetas de altos
                        distintos serían imposibles de escanear. La proporción real se lee en
                        el texto de abajo. Mismo criterio que SubirGaleria.tsx:668-671.
                        El icono va DEBAJO de la imagen, no en su lugar: si la imagen no carga
                        se oculta y el icono queda a la vista, sin estado ni reintento. */}
                    <span className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/40">
                      <ImageOff className="h-6 w-6 text-gray-700" aria-hidden="true" />
                      <img
                        src={item.url}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                        /* Sin fallback y sin reintento: se oculta y ya. Poner otro `src` acá
                           puede volver a fallar y entrar en bucle. Patrón de Home.tsx:771. */
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </span>

                    <div className="mt-3 min-w-0 flex-1">
                      <p className="truncate font-sans text-sm text-gray-200">
                        {item.titulo ?? 'Sin título'}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-gray-500">
                        {item.ancho && item.alto
                          ? `${item.ancho}×${item.alto} · ${item.es_vertical ? 'vertical' : 'horizontal'}`
                          : item.es_vertical
                            ? 'vertical'
                            : 'horizontal'}
                        {item.tipo !== 'foto' && ` · ${item.tipo}`}
                      </p>
                      {/* El path completo, para poder cotejarlo contra el bucket. `break-all`
                          porque es un uuid y no tiene dónde cortar. */}
                      <p className="mt-0.5 font-mono text-[10px] break-all text-gray-600">
                        {item.storage_path}
                      </p>
                    </div>

                    {/* Zona de acción. Tres estados excluyentes, reemplazando el botón EN SU
                        LUGAR: sin modal y sin window.confirm, que es la regla del panel
                        (ListaInscripciones.tsx:938). Un clic distraído no puede borrar. */}
                    <div className="mt-3">
                      {borrando ? (
                        <span className="inline-flex items-center gap-2 font-mono text-xs text-gray-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Borrando…
                        </span>
                      ) : confirmando ? (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs leading-snug text-gray-300">
                            ¿Borrar esta foto? Se va de la galería y del almacenamiento, y no
                            se puede deshacer.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {/* El `aria-label` nombra la foto porque a este botón se llega
                                POR CÓDIGO (el foco salta acá al abrir la confirmación), sin
                                pasar por la pregunta de arriba: sin él, un lector de pantalla
                                anuncia "Confirmar" a secas antes de una acción que no se
                                deshace. Mismo dato que usa el disparador de abajo. */}
                            <button
                              ref={confirmarRef}
                              type="button"
                              onClick={() => void confirmarBorrado(item)}
                              disabled={ocupado}
                              aria-label={`Confirmar borrado de ${item.titulo ?? item.storage_path}`}
                              className={BTN_DESTRUCTIVO_SOLIDO}
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={cancelar}
                              disabled={ocupado}
                              className={BTN_SECUNDARIO}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          ref={(el) => {
                            const mapa = disparadoresRef.current
                            if (el) mapa.set(item.id, el)
                            else mapa.delete(item.id)
                          }}
                          type="button"
                          onClick={() => pedirConfirmacion(item.id)}
                          disabled={ocupado}
                          aria-label={`Borrar la foto ${item.titulo ?? item.storage_path}`}
                          className={BTN_DESTRUCTIVO}
                        >
                          <Trash2 className="h-4 w-4" />
                          Borrar
                        </button>
                      )}

                      {/* El fallo se pinta en SU tarjeta pero sin `role`: quien lo anuncia es
                          la región viva de arriba, que ya recibió el mismo texto. Ponerle un
                          `role="alert"` acá lo diría dos veces. */}
                      {error && (
                        <p className="mt-2 flex items-start gap-1.5 text-xs leading-snug text-rose-300">
                          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                          {error}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {/* Los huérfanos van JUNTOS y con su path: limpiarlos es manual desde Supabase, y sin
            el nombre no hay forma de encontrarlos en el bucket. Mismo bloque que el del
            uploader (SubirGaleria.tsx:782-793), acá alimentado por los paso 2 que fallaron.
            Vive FUERA del bloque de la grilla para que siga visible aunque se borre la
            última foto y la lista quede vacía. */}
        {huerfanos.length > 0 && (
          <div className="mt-6 rounded-xl border border-rose-500/40 bg-rose-950/30 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
              <div className="min-w-0">
                <p className="font-sans text-sm leading-relaxed text-rose-200">
                  {huerfanos.length === 1
                    ? 'Una foto se quitó de la galería, pero su archivo quedó en el almacenamiento. Pásale este nombre a quien administre Supabase para borrarlo:'
                    : `${huerfanos.length} fotos se quitaron de la galería, pero sus archivos quedaron en el almacenamiento. Pásale estos nombres a quien administre Supabase para borrarlos:`}
                </p>
                <ul className="mt-2 space-y-1">
                  {huerfanos.map((path) => (
                    <li key={path} className="font-mono text-[11px] break-all text-rose-300">
                      {path}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lo que esta versión NO hace, dicho en pantalla para que nadie lo busque. El borrado
          es de a una a propósito: es irreversible, y una selección múltiple convierte un
          descuido de un clic en la pérdida de veinte fotos. */}
      <p className="text-sm leading-relaxed text-gray-500">
        Las fotos se borran de a una. Cambiar su orden o ponerles título se hace desde
        Supabase; llegará al panel más adelante.
      </p>
    </div>
  )
}
