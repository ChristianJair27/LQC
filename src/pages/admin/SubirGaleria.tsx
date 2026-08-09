import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, Upload, X } from 'lucide-react'
import { obtenerSupabase } from '../../lib/supabase'

/* ------------------------------------------------------------------ */
/*  Contrato con la base y con la galería pública                      */
/* ------------------------------------------------------------------ */

/* Los mismos nombres que usa `Galeria.tsx` para leer. Si el esquema los renombra, se
   cambian acá y allá — son dos archivos, no hay constante compartida porque las páginas
   del proyecto son autocontenidas por diseño. */
const BUCKET = 'galeria'
const TABLA = 'galeria_media'

/* Lo que la fila insertada tiene que cumplir para que `normalizarItems` de Galeria.tsx la
   acepte: `storage_path` y `tipo` no vacíos, `es_vertical` booleano de verdad, y
   `ancho`/`alto` números finitos o null. Una fila que no lo cumpla se descarta EN SILENCIO
   al pintar la galería, así que el error no se vería acá sino como una foto que subió bien
   y nunca aparece. */

/* Lado mayor al que se reduce. 1920 cubre una pantalla grande sin que la foto pese como un
   original de cámara; por debajo de eso NO se agranda, que solo agregaría peso sin
   resolución real. */
const LADO_MAXIMO = 1920

/* 0.85 en WebP es el punto donde la pérdida deja de verse en fotos y el archivo ya bajó un
   orden de magnitud respecto del JPEG de cámara. */
const CALIDAD_WEBP = 0.85

/* Techo del bucket. La comprobación es un guardarraíl: a 1920px y calidad 0.85 una foto no
   llega ni cerca, pero si algún día se sube la calidad o el lado, el aviso aparece acá y no
   como un error críptico del servidor. */
const LIMITE_BUCKET_BYTES = 10 * 1024 * 1024

/* Techo del archivo ORIGEN, antes de tocarlo. No es el límite del bucket —eso se mide
   después de comprimir— sino una defensa del navegador: decodificar una imagen de 100 MB
   puede colgar la pestaña antes de que exista un blob que medir. */
const LIMITE_ORIGEN_BYTES = 40 * 1024 * 1024

/* Extensión según lo que el navegador DEVOLVIÓ, no según lo que se pidió. `toBlob` con un
   tipo no soportado no falla: cae a PNG en silencio. Derivar la extensión y el
   `contentType` del blob real evita subir un PNG llamado `.webp`, y de paso mantiene el
   archivo dentro de la lista de MIME que el bucket acepta. */
const EXTENSIONES: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png'
}

type Comprimida = { blob: Blob; ancho: number; alto: number }

/* ------------------------------------------------------------------ */
/*  Modelo del lote                                                    */
/* ------------------------------------------------------------------ */

/* El ciclo de vida BAJÓ al ítem: antes este enum era el estado del formulario entero, y
   con varias fotos eso no alcanza — la 3 puede estar subiendo mientras la 7 ya falló.
   'pendiente' es recién elegida, 'listo' es comprimida y esperando el botón. */
type EstadoItem =
  | 'pendiente'
  | 'comprimiendo'
  | 'listo'
  | 'subiendo'
  | 'publicado'
  | 'error'

type ItemLote = {
  /* Id propio del ítem, NO el nombre del archivo: dos fotos pueden llamarse igual y este
     id es la clave de React y la que usa el bucle para marcar filas. */
  id: string
  archivo: File
  estado: EstadoItem
  comprimida?: Comprimida
  vistaPrevia?: string
  mensajeError?: string
  /* Path que quedó en el bucket SIN su fila, cuando el rollback tampoco pudo borrarlo. Es el
     registro de ESTA fila y nada más: la lista que se le muestra al admin al pie NO se
     deriva de acá, porque las filas se pueden quitar y el path se perdería con ellas. La
     lista autoritativa es el estado `huerfanos` del componente. */
  huerfano?: string
}

/* Estado de la OPERACIÓN, no de las fotos. 'preparando' es la tanda de compresión,
   'subiendo' la de publicación y 'terminado' habilita el resumen. */
type EstadoLote = 'idle' | 'preparando' | 'subiendo' | 'terminado'

/* ------------------------------------------------------------------ */
/*  Compresión (sin librería: canvas y nada más)                       */
/* ------------------------------------------------------------------ */

/* Carga el archivo en un <img> para poder MEDIRLO. El object URL se revoca de forma
   diferida y no en la misma tanda síncrona: es el mismo cuidado que documenta
   `descargarArchivo` en ListaInscripciones.tsx, donde revocar de inmediato cancelaba la
   operación en Firefox. Se revoca en los dos caminos, éxito y fallo, para no filtrarlo
   cuando el archivo no sea una imagen legible. */
function cargarImagen(archivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo)
    const imagen = new Image()
    const soltar = () => setTimeout(() => URL.revokeObjectURL(url), 0)
    imagen.onload = () => {
      soltar()
      resolve(imagen)
    }
    imagen.onerror = () => {
      soltar()
      reject(new Error('ilegible'))
    }
    imagen.src = url
  })
}

/* Redimensiona a `LADO_MAXIMO` en el lado mayor conservando la proporción, dibuja en un
   canvas y exporta a WebP. Devuelve el blob CON las dimensiones finales, que son las que
   van a la fila: `es_vertical`, `ancho` y `alto` tienen que describir lo que se subió, no
   el original. */
async function comprimir(archivo: File): Promise<Comprimida> {
  const imagen = await cargarImagen(archivo)

  const anchoOriginal = imagen.naturalWidth
  const altoOriginal = imagen.naturalHeight
  /* Un SVG sin dimensiones intrínsecas llega hasta acá con 0×0 y produciría un canvas
     vacío. Mejor cortar que subir una imagen en blanco. */
  if (!anchoOriginal || !altoOriginal) throw new Error('sin_dimensiones')

  const mayor = Math.max(anchoOriginal, altoOriginal)
  /* `escala` nunca pasa de 1: si la foto ya es más chica que el techo, se sube tal cual. */
  const escala = mayor > LADO_MAXIMO ? LADO_MAXIMO / mayor : 1
  const ancho = Math.round(anchoOriginal * escala)
  const alto = Math.round(altoOriginal * escala)

  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const contexto = lienzo.getContext('2d')
  if (!contexto) throw new Error('sin_canvas')
  contexto.drawImage(imagen, 0, 0, ancho, alto)

  /* `toBlob` es por callback, así que se envuelve. Puede devolver null si el navegador no
     puede exportar: eso se trata como fallo, no como blob vacío. */
  const blob = await new Promise<Blob | null>((resolver) => {
    lienzo.toBlob(resolver, 'image/webp', CALIDAD_WEBP)
  })
  if (!blob || blob.size === 0) throw new Error('sin_blob')

  return { blob, ancho, alto }
}

/* Nombre del archivo en el bucket. NUNCA el nombre original: traería acentos, espacios y
   choques entre dos "IMG_1234.jpg" de cámaras distintas, y `storage_path` es UNIQUE.
   `crypto.randomUUID` pide contexto seguro (https o localhost). Lo hay en producción y en
   `npm run dev`, pero no si alguien sirve el dev por IP de red en http, así que hay un
   plan B. La unicidad real la garantiza igual la restricción de la columna. */
function idUnico(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function nombreUnico(extension: string): string {
  return `${idUnico()}.${extension}`
}

function formatearPeso(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* Revoca un object URL de forma diferida. Se llama en los puntos donde el ítem DEJA de
   mostrarse: al quitarlo de la lista, al reemplazar el lote y al vaciarlo.
   NO hay `useEffect` de limpieza, y es deliberado: con StrictMode React monta, limpia y
   vuelve a montar en desarrollo, así que un cleanup de desmontaje revocaría las URL de las
   miniaturas visibles y la lista quedaría llena de imágenes rotas. */
function soltarVistaPrevia(url: string | undefined): void {
  if (!url) return
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function soltarVistasPrevias(items: ItemLote[]): void {
  for (const item of items) soltarVistaPrevia(item.vistaPrevia)
}

/* ------------------------------------------------------------------ */
/*  Mensajes                                                           */
/* ------------------------------------------------------------------ */

const MSG_SIN_CLIENTE = 'No hay conexión con la base. Recarga la página e inténtalo de nuevo.'
const MSG_SIN_SESION =
  'Tu sesión no está activa, así que no se subió ninguna foto. Vuelve a iniciar sesión e inténtalo de nuevo.'
const MSG_NO_IMAGEN = 'Ese archivo no es una imagen. Elige un JPG, PNG o WebP.'
const MSG_ORIGEN_ENORME = `Pesa demasiado para procesarla en el navegador (máximo ${formatearPeso(LIMITE_ORIGEN_BYTES)}).`
const MSG_ILEGIBLE = 'No pudimos leerla. Puede estar dañada o en un formato que el navegador no abre.'
const MSG_COMPRESION = 'No pudimos procesarla.'
const MSG_DEMASIADO_PESADA = `Comprimida sigue pesando más de ${formatearPeso(LIMITE_BUCKET_BYTES)}.`
const MSG_SUBIDA = 'No pudimos subirla. Revisa tu conexión.'

/* Los dos finales del rollback. Se distinguen a propósito: el admin necesita saber si
   quedó basura en el bucket, porque no hay forma de limpiarla desde el panel. */
const MSG_INSERT_LIMPIO =
  'No pudimos registrarla en la galería. El archivo subido se eliminó, así que no quedó nada a medias.'
const MSG_INSERT_HUERFANO =
  'No pudimos registrarla en la galería y tampoco eliminar el archivo ya subido. Quedó ocupando espacio (ver la lista de abajo).'

/* ------------------------------------------------------------------ */
/*  Estilos                                                            */
/* ------------------------------------------------------------------ */

/* `bg-none` desactiva el gradiente que index.css le pone a todo <button>, y los dos
   `hover:` matan el salto de -2px con halo azul de `button:hover`. Misma receta que
   Galeria.tsx y Torneos.tsx. `font-sans`/`tracking-normal` neutralizan la Orbitron y el
   letter-spacing que la misma regla base aplica. */
const BTN_BASE =
  'bg-none inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-sans font-medium tracking-normal ' +
  'transition-all duration-300 hover:[transform:none] hover:shadow-none ' +
  'disabled:opacity-60 disabled:cursor-not-allowed'

const BTN_PRIMARIO =
  `${BTN_BASE} border-0 bg-gradient-to-r from-lqc-700 to-lqc-500 text-white hover:from-lqc-600 hover:to-lqc-400`

const BTN_SECUNDARIO =
  `${BTN_BASE} bg-black/40 border border-blue-800/40 text-gray-200 hover:bg-blue-950/40 hover:border-blue-600/60 hover:text-white`

/* Botón de quitar una fila. Mismo neutralizado, pero chico y sin relleno: es una acción
   secundaria dentro de una fila, no debe competir con "Publicar". */
const BTN_QUITAR =
  'bg-none inline-flex shrink-0 items-center justify-center rounded-lg border border-white/10 p-2 ' +
  'text-gray-400 transition-colors duration-200 hover:border-rose-700/60 hover:text-rose-300 ' +
  'hover:[transform:none] hover:shadow-none disabled:opacity-40 disabled:cursor-not-allowed'

/* El botón del `<input type="file">` se estiliza con las variantes `file:`. No es un
   <button> de verdad, así que la regla base de index.css no lo toca y no necesita
   `bg-none`. */
const CLASE_ARCHIVO =
  'block w-full text-sm text-gray-400 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 ' +
  'file:bg-blue-950/60 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-blue-100 ' +
  'hover:file:bg-blue-900/60 disabled:opacity-60'

/* ------------------------------------------------------------------ */
/*  Publicación de UN archivo                                          */
/* ------------------------------------------------------------------ */

type ResultadoPublicacion =
  | { ok: true; path: string }
  | { ok: false; mensaje: string; huerfano?: string }

/* Sube un blob y registra su fila. Es la unidad ATÓMICA del lote: o queda entera —archivo
   más fila— o no queda nada, salvo el caso del huérfano, que se informa.
   Recibe el cliente y el `subidoPor` YA resueltos porque son del lote, no del archivo:
   pedirlos acá significaría una llamada por foto.
   Devuelve un resultado en vez de tocar estado: quien decide qué hacer con un fallo es el
   bucle, que tiene que seguir con la foto siguiente. */
async function publicarUna(
  supabase: NonNullable<ReturnType<typeof obtenerSupabase>>,
  comprimida: Comprimida,
  subidoPor: string | null
): Promise<ResultadoPublicacion> {
  const extension = EXTENSIONES[comprimida.blob.type]
  if (!extension) return { ok: false, mensaje: MSG_COMPRESION }

  const nombre = nombreUnico(extension)

  try {
    /* PASO 1 — el archivo. Si falla, se corta acá y NO se inserta nada: una fila que
       apunta a un archivo inexistente es peor que no tener la foto. */
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET)
      .upload(nombre, comprimida.blob, { contentType: comprimida.blob.type })

    if (errorSubida) return { ok: false, mensaje: MSG_SUBIDA }

    /* PASO 2 — la fila. `tipo: 'foto'` fijo: esta versión no sube videos. `orden` se deja
       en su default. `titulo` va SIEMPRE null: el uploader ya no pide título — con un lote
       de veinte, un campo único habría puesto el mismo rótulo en todas. La columna es
       nullable y `Galeria.tsx` no monta el overlay cuando falta, así que la foto se publica
       igual. Titular llegará con la edición de galería.
       Los tres campos que la galería exige van con la forma exacta que espera
       `normalizarItems`: booleano real y números finitos. */
    const { error: errorInsert } = await supabase.from(TABLA).insert({
      storage_path: nombre,
      tipo: 'foto',
      es_vertical: comprimida.alto > comprimida.ancho,
      ancho: comprimida.ancho,
      alto: comprimida.alto,
      titulo: null,
      subido_por: subidoPor
    })

    if (errorInsert) {
      /* ROLLBACK, por archivo. Sin esto queda un archivo en el bucket que nada referencia:
         ocupa espacio, nadie lo ve y no hay forma de encontrarlo desde el panel.
         El resultado del borrado se COMPRUEBA, no se asume: `remove` puede volver sin
         error y sin haber borrado nada si la política del bucket no permite DELETE, que es
         la misma trampa de "0 filas sin error" que ya documenta `escribirArchivado`.
         Que el rollback sea por ARCHIVO y no por lote es lo que permite que un fallo en la
         foto 12 no toque a las 11 que ya se publicaron bien. */
      const limpiado = await borrarDelBucket(supabase, nombre)
      return limpiado
        ? { ok: false, mensaje: MSG_INSERT_LIMPIO }
        : { ok: false, mensaje: MSG_INSERT_HUERFANO, huerfano: nombre }
    }

    return { ok: true, path: nombre }
  } catch {
    /* Red, timeout del navegador o cualquier otra cosa. No se puede saber si el archivo
       llegó a subirse, así que no se intenta un rollback a ciegas: borrar por las dudas
       podría eliminar algo que sí quedó bien registrado. */
    return { ok: false, mensaje: MSG_SUBIDA }
  }
}

/* Borra un archivo del bucket y dice si de verdad lo borró.
   El `data.length` importa tanto como el `error` — ver el comentario del rollback. */
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
/*  Fila de la lista                                                   */
/* ------------------------------------------------------------------ */

/* Las filas van MUDAS para lectores de pantalla: sin `role="status"` ni `aria-live`.
   Con veinte filas cambiando de estado, anunciar cada una sería un chorro de ruido
   imposible de seguir. Lo que se anuncia es el progreso del LOTE, en una sola región viva
   más arriba — mismo criterio que el estado `anuncio` de ListaInscripciones. */
function EstadoFila({ item }: { item: ItemLote }) {
  if (item.estado === 'comprimiendo' || item.estado === 'subiendo') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-blue-300">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {item.estado === 'comprimiendo' ? 'Procesando…' : 'Subiendo…'}
      </span>
    )
  }
  if (item.estado === 'publicado') {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-lqc-accent">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Publicada
      </span>
    )
  }
  if (item.estado === 'error') {
    return (
      <span className="inline-flex items-start gap-1.5 font-mono text-[11px] leading-snug text-rose-300">
        <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
        {item.mensajeError ?? MSG_SUBIDA}
      </span>
    )
  }
  if (item.estado === 'listo') {
    return <span className="font-mono text-[11px] text-gray-400">Lista para subir</span>
  }
  return <span className="font-mono text-[11px] text-gray-500">En espera</span>
}

/* ------------------------------------------------------------------ */
/*  Componente                                                         */
/* ------------------------------------------------------------------ */

export default function SubirGaleria() {
  const [items, setItems] = useState<ItemLote[]>([])
  const [estadoLote, setEstadoLote] = useState<EstadoLote>('idle')
  /* Aviso que corta el lote entero (sin cliente, sin sesión). Es distinto de un fallo por
     archivo: acá no tiene sentido seguir intentando. */
  const [avisoLote, setAvisoLote] = useState('')
  /* Cuántas entraron a la tanda de publicación. Es el único número que NO se puede derivar
     de las filas: una que falla AL SUBIR queda en 'error' igual que una que falló al
     comprimir y nunca llegó a entrar, así que contar errores no distingue una de la otra. */
  const [enPublicacion, setEnPublicacion] = useState(0)

  /* Los huérfanos viven en SU PROPIO estado y no derivados de `items`, que es de donde
     salían antes. El motivo: la fila que produjo el huérfano se puede quitar con su ✕, y
     con ella desaparecía de pantalla el único registro del archivo que quedó suelto en el
     bucket. Limpiarlo es manual desde Supabase y sin el path no hay dónde buscarlo, así que
     el dato tiene que sobrevivir a que se quite la fila y a "Vaciar lista".
     Solo se resetea al empezar un lote nuevo, en `elegirArchivos`. */
  const [huerfanos, setHuerfanos] = useState<string[]>([])

  /* El <input type="file"> es no controlado: su `value` solo se puede vaciar tocando el
     DOM. Hace falta para poder volver a elegir EL MISMO lote — sin esto, el `change` no
     dispara la segunda vez porque el valor no cambió. */
  const campoArchivoRef = useRef<HTMLInputElement>(null)

  /* Espejo de `items` para que el bucle asíncrono lea SIEMPRE lo último sin quedar preso
     de un closure viejo, y para poder revocar URLs fuera del actualizador de estado.
     Nada de efectos secundarios dentro de un `setState`: en StrictMode el actualizador se
     ejecuta dos veces y revocar ahí sería impuro. */
  const itemsRef = useRef<ItemLote[]>([])

  /* Cerrojo de la publicación. Es un ref y no estado A PROPÓSITO: `ocupado` se deriva de
     `estadoLote` y por lo tanto solo se vuelve true después de un re-render, mientras que un
     ref cambia en el acto. Ver el comentario de `publicar`, que es donde importa. */
  const publicandoRef = useRef(false)

  const escribirItems = (siguiente: ItemLote[]) => {
    itemsRef.current = siguiente
    setItems(siguiente)
  }

  const marcar = (id: string, cambios: Partial<ItemLote>) => {
    escribirItems(itemsRef.current.map((i) => (i.id === id ? { ...i, ...cambios } : i)))
  }

  const ocupado = estadoLote === 'preparando' || estadoLote === 'subiendo'

  /* Derivados: no hay contadores en estado, se cuentan las filas. Un contador aparte sería
     una segunda fuente de verdad que hay que mantener en sincronía con la lista. */
  const total = items.length
  const publicados = items.filter((i) => i.estado === 'publicado').length
  const fallidos = items.filter((i) => i.estado === 'error').length
  const listos = items.filter((i) => i.estado === 'listo').length
  const resueltos = publicados + fallidos + listos

  /* Texto ÚNICO de la región viva. Se arma acá y no en el JSX para que exista una sola
     frase por estado y no varias compitiendo. */
  const anuncio = (() => {
    /* El corte del lote ya lo canta su banner `role="alert"`. Repetirlo acá lo anunciaría
       dos veces, y encima con un "0 fotos publicadas" que contradice al aviso. */
    if (avisoLote) return ''
    if (estadoLote === 'preparando') return `Procesando ${resueltos} de ${total} imágenes…`
    /* `enPublicacion - listos` es la que está subiendo en este momento: las que faltan son
       exactamente las que siguen en 'listo'. Contar errores acá metería en la cuenta a las
       que fallaron comprimiendo y nunca entraron a la tanda. */
    if (estadoLote === 'subiendo') return `Subiendo ${enPublicacion - listos} de ${enPublicacion}…`
    if (estadoLote === 'terminado') {
      if (fallidos === 0) return `Listo: ${publicados} ${publicados === 1 ? 'foto publicada' : 'fotos publicadas'}.`
      return `Terminado: ${publicados} de ${publicados + fallidos} publicadas, ${fallidos} con problemas.`
    }
    return ''
  })()

  /* Los dos chequean también el cerrojo: durante el `await` de `getSession` el lote todavía
     no está en 'subiendo', así que `ocupado` es false y sin el ref se podía vaciar la lista
     —revocando las miniaturas— con el bucle de publicación ya en marcha. */
  const vaciarLista = () => {
    if (ocupado || publicandoRef.current) return
    soltarVistasPrevias(itemsRef.current)
    escribirItems([])
    setEstadoLote('idle')
    setAvisoLote('')
    if (campoArchivoRef.current) campoArchivoRef.current.value = ''
  }

  const quitarItem = (id: string) => {
    if (ocupado || publicandoRef.current) return
    const item = itemsRef.current.find((i) => i.id === id)
    soltarVistaPrevia(item?.vistaPrevia)
    const restantes = itemsRef.current.filter((i) => i.id !== id)
    escribirItems(restantes)
    /* Vaciar la lista a mano devuelve el formulario a su estado inicial: si no, quedaría
       "terminado" con cero filas y el resumen de un lote que ya no existe. */
    if (restantes.length === 0) {
      setEstadoLote('idle')
      setAvisoLote('')
    }
  }

  const elegirArchivos = async (archivos: File[]) => {
    if (archivos.length === 0) return

    /* El input se vacía apenas se leyeron los `File`: la lista ya vive en estado y esos
       objetos siguen siendo válidos con el campo vacío. Sin esto, volver a elegir EL MISMO
       lote —lo natural para reintentar las que fallaron— no dispararía `change`, porque el
       `value` no cambió, y el panel se vería colgado. Es el mismo cuidado que la versión de
       una sola foto aplicaba al limpiar y al fallar. */
    if (campoArchivoRef.current) campoArchivoRef.current.value = ''

    /* Un lote nuevo reemplaza al anterior por completo. Las miniaturas del anterior se
       sueltan ACÁ, que es el punto donde dejan de mostrarse. */
    soltarVistasPrevias(itemsRef.current)
    setAvisoLote('')
    /* ÚNICO punto donde se olvidan los huérfanos: son del lote anterior y ese lote se está
       reemplazando entero. No se resetean ni al quitar una fila ni al vaciar la lista. */
    setHuerfanos([])

    /* Validación previa, antes de tocar el canvas: lo que no es imagen o pesa demasiado
       nace en 'error' y nunca entra a la tanda de compresión. Igual aparece en la lista,
       porque el admin tiene que ver POR QUÉ esa foto no va. */
    const nuevos: ItemLote[] = archivos.map((archivo) => {
      if (!archivo.type.startsWith('image/')) {
        return { id: idUnico(), archivo, estado: 'error', mensajeError: MSG_NO_IMAGEN }
      }
      if (archivo.size > LIMITE_ORIGEN_BYTES) {
        return { id: idUnico(), archivo, estado: 'error', mensajeError: MSG_ORIGEN_ENORME }
      }
      return { id: idUnico(), archivo, estado: 'pendiente' }
    })

    escribirItems(nuevos)
    setEstadoLote('preparando')

    /* EN SERIE, no con Promise.all: cada compresión decodifica el original completo en
       memoria, y veinte a la vez pueden tumbar la pestaña. De paso, secuencial es lo que
       permite decir "procesando 7 de 20" con un número que significa algo. */
    for (const item of nuevos) {
      if (item.estado !== 'pendiente') continue

      marcar(item.id, { estado: 'comprimiendo' })
      try {
        const comprimida = await comprimir(item.archivo)
        if (comprimida.blob.size > LIMITE_BUCKET_BYTES) {
          marcar(item.id, { estado: 'error', mensajeError: MSG_DEMASIADO_PESADA })
          continue
        }
        marcar(item.id, {
          estado: 'listo',
          comprimida,
          vistaPrevia: URL.createObjectURL(comprimida.blob)
        })
      } catch (e) {
        /* El motivo se distingue solo para decir algo útil; el objeto de error nunca sale
           ni a consola ni a pantalla. */
        marcar(item.id, {
          estado: 'error',
          mensajeError: e instanceof Error && e.message === 'ilegible' ? MSG_ILEGIBLE : MSG_COMPRESION
        })
      }
    }

    setEstadoLote('idle')
  }

  const publicar = async () => {
    /* CERROJO SÍNCRONO, y va primero: antes de cualquier `await` y antes de tocar estado.
       `ocupado` se deriva de `estadoLote`, así que recién se vuelve true DESPUÉS de un
       re-render — y el primer `await` de acá abajo (`getSession`) llega antes que eso. En esa
       ventana el botón seguía habilitado: un segundo clic entraba de nuevo, recalculaba el
       mismo `aPublicar` —los ítems todavía están en 'listo'— y arrancaba un SEGUNDO bucle
       sobre el mismo lote. Cada foto se subía dos veces con dos nombres únicos distintos, o
       sea archivos y filas duplicados, que hay que limpiar a mano.
       Un ref no espera al render: cambia en el acto y cierra la ventana. */
    if (publicandoRef.current || ocupado) return
    publicandoRef.current = true

    try {
      /* Solo las que llegaron a comprimirse. Las que fallaron antes se quedan en la lista
         mostrando su motivo, pero no se intentan. */
      const aPublicar = itemsRef.current.filter((i) => i.estado === 'listo' && i.comprimida)
      if (aPublicar.length === 0) return

      /* El aviso del intento anterior se borra ACÁ. Un corte por sesión caída deja el botón
         habilitado a propósito —volver a entrar y reintentar es el camino esperado—, y sin
         esta línea el aviso viejo sobreviviría a un segundo intento exitoso, tapando su
         resumen con el error de la vez pasada. */
      setAvisoLote('')

      /* Cliente y sesión se resuelven UNA vez, antes del bucle: son del lote, no de cada
         foto. Con veinte archivos, pedirlos adentro serían veinte llamadas idénticas. */
      const supabase = obtenerSupabase()
      if (!supabase) {
        setAvisoLote(MSG_SIN_CLIENTE)
        setEstadoLote('terminado')
        return
      }

      let subidoPor: string | null = null
      try {
        const { data } = await supabase.auth.getSession()
        subidoPor = data.session?.user.id ?? null
      } catch {
        subidoPor = null
      }

      /* CORTE DEL LOTE ENTERO. Sin sesión, el INSERT lo rechaza la política de la tabla, así
         que las veinte fallarían una por una y el admin vería veinte errores idénticos en vez
         del único que importa. Es la excepción a "un fallo no detiene el lote": acá no falla
         un archivo, falla la condición para intentar cualquiera.
         Se corta ANTES de subir nada, así que tampoco quedan huérfanos. */
      if (!subidoPor) {
        setAvisoLote(MSG_SIN_SESION)
        setEstadoLote('terminado')
        return
      }

      setEnPublicacion(aPublicar.length)
      setEstadoLote('subiendo')

      /* EN SERIE. Un fallo marca su fila y el bucle SIGUE con la siguiente: lo ya publicado
         nunca se revierte, porque deshacer trabajo bueno por un fallo ajeno sería peor que el
         fallo. Cada archivo es atómico por su cuenta (ver `publicarUna`). */
      for (const item of aPublicar) {
        const comprimida = item.comprimida
        if (!comprimida) continue

        marcar(item.id, { estado: 'subiendo' })
        const resultado = await publicarUna(supabase, comprimida, subidoPor)

        if (resultado.ok) {
          marcar(item.id, { estado: 'publicado' })
        } else {
          marcar(item.id, {
            estado: 'error',
            mensajeError: resultado.mensaje,
            huerfano: resultado.huerfano
          })
          /* Además de quedar en la fila, el path se acumula en el estado propio: la fila es
             descartable —el ✕ la quita— y este dato no puede irse con ella. */
          const { huerfano } = resultado
          if (huerfano) setHuerfanos((previos) => [...previos, huerfano])
        }
      }

      setEstadoLote('terminado')
    } finally {
      /* Se libera pase lo que pase. Los cortes tempranos —lote vacío, sin cliente, sin
         sesión— también salen por acá, y sin esto el botón quedaría muerto hasta recargar. */
      publicandoRef.current = false
    }
  }

  const hayPublicables = listos > 0

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/5 bg-black/30 p-6 backdrop-blur-sm md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-lqc-accent/20 bg-blue-950/40">
            <ImagePlus className="h-5 w-5 text-lqc-accent" />
          </span>
          <div className="min-w-0">
            <p className="font-sans font-medium text-white">Subir fotos</p>
            <p className="text-sm text-gray-400">
              Puedes elegir varias a la vez. Cada una se reduce a {LADO_MAXIMO}px y se
              convierte a WebP antes de subirla.
            </p>
          </div>
        </div>

        <label
          htmlFor="galeria-archivo"
          className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-gray-400"
        >
          Imágenes
        </label>
        {/* `accept` filtra el diálogo del sistema, pero NO es validación: el tipo real se
            comprueba igual por archivo en `elegirArchivos`, porque el atributo se puede
            eludir. */}
        <input
          ref={campoArchivoRef}
          id="galeria-archivo"
          type="file"
          accept="image/*"
          multiple
          disabled={ocupado}
          onChange={(e) => void elegirArchivos(Array.from(e.target.files ?? []))}
          className={CLASE_ARCHIVO}
        />

        {/* LA ÚNICA región viva del componente. Las filas de abajo son mudas a propósito.
            `aria-live="polite"` por `role="status"`: espera a que el lector termine lo que
            está diciendo en vez de interrumpir en cada archivo. */}
        <p role="status" className="mt-4 min-h-5 font-mono text-[11px] text-blue-300">
          {ocupado && <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />}
          {anuncio}
        </p>

        {items.length > 0 && (
          <ul className="mt-4 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 bg-black/20 p-3">
                {/* Miniatura de tamaño FIJO con `object-cover`, no con la proporción real:
                    en una lista lo que importa es poder reconocer la foto de un vistazo, y
                    filas de altos distintos serían imposibles de escanear. La proporción
                    real se lee en el texto de al lado. */}
                <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-black/40">
                  {item.vistaPrevia ? (
                    <img src={item.vistaPrevia} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-5 w-5 text-gray-600" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans text-sm text-gray-200">{item.archivo.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-gray-500">
                    {item.comprimida
                      ? `${item.comprimida.ancho}×${item.comprimida.alto} · ${
                          item.comprimida.alto > item.comprimida.ancho ? 'vertical' : 'horizontal'
                        } · ${formatearPeso(item.archivo.size)} → ${formatearPeso(item.comprimida.blob.size)}`
                      : formatearPeso(item.archivo.size)}
                  </p>
                  <div className="mt-1">
                    <EstadoFila item={item} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => quitarItem(item.id)}
                  disabled={ocupado}
                  aria-label={`Quitar ${item.archivo.name} de la lista`}
                  className={BTN_QUITAR}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={publicar}
              disabled={ocupado || !hayPublicables}
              className={BTN_PRIMARIO}
            >
              {estadoLote === 'subiendo' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Subiendo…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {listos === 1 ? 'Publicar 1 foto' : `Publicar ${listos} fotos`}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={vaciarLista}
              disabled={ocupado}
              className={BTN_SECUNDARIO}
            >
              <X className="h-4 w-4" />
              Vaciar lista
            </button>
          </div>
        )}

        {/* Corte del lote entero: no es el fallo de un archivo, así que va en su propio
            banner y no en una fila. */}
        {avisoLote && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-950/30 p-4"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
            <p className="font-sans text-sm leading-relaxed text-rose-200">{avisoLote}</p>
          </div>
        )}

        {/* Resumen final. Reusa los dos banners de la versión de una sola foto: cian cuando
            salió todo, rose cuando alguna quedó afuera. */}
        {estadoLote === 'terminado' && !avisoLote && (
          <div
            className={`mt-6 flex items-start gap-3 rounded-xl border p-4 ${
              fallidos === 0
                ? 'border-lqc-accent/30 bg-blue-950/20'
                : 'border-rose-500/40 bg-rose-950/30'
            }`}
          >
            {fallidos === 0 ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lqc-accent" />
            ) : (
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
            )}
            <div className="min-w-0">
              <p
                className={`font-sans text-sm leading-relaxed ${
                  fallidos === 0 ? 'text-blue-100' : 'text-rose-200'
                }`}
              >
                {fallidos === 0
                  ? `${publicados} ${publicados === 1 ? 'foto publicada' : 'fotos publicadas'}. Ya ${publicados === 1 ? 'aparece' : 'aparecen'} en la galería del sitio.`
                  : `${publicados} de ${publicados + fallidos} publicadas. ${fallidos === 1 ? 'Una quedó' : `${fallidos} quedaron`} sin subir: el motivo está en su fila. Puedes volver a elegir solo ${fallidos === 1 ? 'esa' : 'esas'}.`}
              </p>

              {/* Los huérfanos van JUNTOS y con su path: limpiarlos es manual desde
                  Supabase, y sin el nombre no hay forma de encontrarlos en el bucket. */}
              {huerfanos.length > 0 && (
                <div className="mt-3 rounded-lg border border-rose-500/30 bg-black/30 p-3">
                  <p className="font-sans text-xs text-rose-200">
                    {huerfanos.length === 1
                      ? 'Quedó 1 archivo subido sin su registro. Pásale este nombre a quien administre Supabase para borrarlo:'
                      : `Quedaron ${huerfanos.length} archivos subidos sin su registro. Pásale estos nombres a quien administre Supabase para borrarlos:`}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {huerfanos.map((path) => (
                      <li key={path} className="font-mono text-[11px] break-all text-rose-300">
                        {path}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lo que esta versión NO hace, dicho en pantalla para que nadie lo busque: sin
          títulos, sin borrado y sin reordenamiento, que necesitan políticas y pantallas que
          todavía no existen. */}
      <p className="text-sm leading-relaxed text-gray-500">
        Las fotos se publican sin título y en el orden por defecto. Titularlas, borrarlas o
        cambiar su orden se hace desde Supabase; llegará al panel más adelante.
      </p>
    </div>
  )
}
