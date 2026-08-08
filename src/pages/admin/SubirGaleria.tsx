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

type Estado = 'idle' | 'comprimiendo' | 'subiendo' | 'exito' | 'error'

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
function nombreUnico(extension: string): string {
  const id =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${id}.${extension}`
}

function formatearPeso(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ------------------------------------------------------------------ */
/*  Mensajes                                                           */
/* ------------------------------------------------------------------ */

const MSG_SIN_CLIENTE = 'No hay conexión con la base. Recarga la página e inténtalo de nuevo.'
const MSG_NO_IMAGEN = 'Ese archivo no es una imagen. Elige un JPG, PNG o WebP.'
const MSG_ORIGEN_ENORME = `La imagen pesa demasiado para procesarla en el navegador (máximo ${formatearPeso(LIMITE_ORIGEN_BYTES)}). Redúcela antes de subirla.`
const MSG_ILEGIBLE = 'No pudimos leer esa imagen. Puede estar dañada o en un formato que el navegador no abre.'
const MSG_COMPRESION = 'No pudimos procesar la imagen. Inténtalo con otro archivo.'
const MSG_DEMASIADO_PESADA = `La imagen comprimida sigue pesando más de ${formatearPeso(LIMITE_BUCKET_BYTES)}. No podemos subirla.`
const MSG_SUBIDA = 'No pudimos subir la imagen. Revisa tu conexión e inténtalo de nuevo.'

/* Los dos finales del rollback. Se distinguen a propósito: el admin necesita saber si
   quedó basura en el bucket, porque no hay forma de limpiarla desde el panel. */
const MSG_INSERT_LIMPIO =
  'No pudimos registrar la imagen en la galería. El archivo subido se eliminó, así que no quedó nada a medias. Inténtalo de nuevo.'
const msgInsertHuerfano = (path: string) =>
  `No pudimos registrar la imagen en la galería Y tampoco pudimos eliminar el archivo ya subido (${path}). No aparecerá en la galería, pero quedó ocupando espacio: pásale ese nombre a quien administre Supabase.`

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

const CLASE_INPUT =
  'w-full px-4 py-3 bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed'

/* El botón del `<input type="file">` se estiliza con las variantes `file:`. No es un
   <button> de verdad, así que la regla base de index.css no lo toca y no necesita
   `bg-none`. */
const CLASE_ARCHIVO =
  'block w-full text-sm text-gray-400 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 ' +
  'file:bg-blue-950/60 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-blue-100 ' +
  'hover:file:bg-blue-900/60 disabled:opacity-60'

/* ------------------------------------------------------------------ */
/*  Componente                                                         */
/* ------------------------------------------------------------------ */

export default function SubirGaleria() {
  const [estado, setEstado] = useState<Estado>('idle')
  const [mensaje, setMensaje] = useState('')
  const [comprimida, setComprimida] = useState<Comprimida | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const [titulo, setTitulo] = useState('')
  const [pesoOriginal, setPesoOriginal] = useState(0)

  /* El <input type="file"> es no controlado: su `value` solo se puede vaciar tocando el
     DOM. Hace falta para poder volver a elegir EL MISMO archivo después de subirlo — sin
     esto, el `change` no dispara la segunda vez porque el valor no cambió. */
  const campoArchivoRef = useRef<HTMLInputElement>(null)

  const ocupado = estado === 'comprimiendo' || estado === 'subiendo'

  /* Reemplaza la vista previa revocando la anterior, de forma diferida.
     NO hay revocación al desmontar, y es deliberado: con StrictMode React monta, limpia y
     vuelve a montar en desarrollo, así que un cleanup de desmontaje revocaría la URL de la
     imagen que se está mostrando y la vista previa quedaría rota. Lo que se filtra es como
     mucho un object URL por sesión del panel, que el navegador libera al cerrar la
     pestaña; una vista previa rota se ve siempre. */
  const ponerVistaPrevia = (url: string | null) => {
    setVistaPrevia((anterior) => {
      if (anterior) setTimeout(() => URL.revokeObjectURL(anterior), 0)
      return url
    })
  }

  const limpiarFormulario = () => {
    ponerVistaPrevia(null)
    setComprimida(null)
    setTitulo('')
    setPesoOriginal(0)
    if (campoArchivoRef.current) campoArchivoRef.current.value = ''
  }

  const fallar = (texto: string) => {
    setEstado('error')
    setMensaje(texto)
    /* Vaciar el input es parte de fallar, no un detalle de la limpieza del éxito. Sin esto,
       reintentar con LA MISMA foto no hacía nada: el `change` solo dispara si el `value`
       cambió, así que volver a elegir el archivo que acaba de fallar dejaba el banner de
       error puesto y sin ninguna reacción — se leía como un panel colgado.
       Es el mismo motivo por el que el campo es no controlado y tiene ref (ver arriba); lo
       que faltaba era aplicarlo también a este camino. */
    if (campoArchivoRef.current) campoArchivoRef.current.value = ''
  }

  const elegirArchivo = async (archivo: File | undefined) => {
    if (!archivo) return

    /* Se descarta lo anterior antes de validar: si el archivo nuevo no sirve, no puede
       quedar en pantalla la vista previa del anterior como si fuera este. */
    ponerVistaPrevia(null)
    setComprimida(null)
    setMensaje('')

    if (!archivo.type.startsWith('image/')) {
      fallar(MSG_NO_IMAGEN)
      return
    }
    if (archivo.size > LIMITE_ORIGEN_BYTES) {
      fallar(MSG_ORIGEN_ENORME)
      return
    }

    setEstado('comprimiendo')
    setPesoOriginal(archivo.size)

    try {
      const resultado = await comprimir(archivo)

      if (resultado.blob.size > LIMITE_BUCKET_BYTES) {
        fallar(MSG_DEMASIADO_PESADA)
        return
      }

      setComprimida(resultado)
      ponerVistaPrevia(URL.createObjectURL(resultado.blob))
      setEstado('idle')
    } catch (e) {
      /* El motivo se distingue solo para decir algo útil; el objeto de error nunca sale ni
         a consola ni a pantalla. */
      fallar(e instanceof Error && e.message === 'ilegible' ? MSG_ILEGIBLE : MSG_COMPRESION)
    }
  }

  const subir = async () => {
    if (ocupado || !comprimida) return

    const supabase = obtenerSupabase()
    if (!supabase) {
      fallar(MSG_SIN_CLIENTE)
      return
    }

    const extension = EXTENSIONES[comprimida.blob.type]
    if (!extension) {
      fallar(MSG_COMPRESION)
      return
    }

    setEstado('subiendo')
    setMensaje('')
    const nombre = nombreUnico(extension)

    try {
      /* PASO 1 — el archivo. Si falla, se corta acá y NO se inserta nada: una fila que
         apunta a un archivo inexistente es peor que no tener la foto. */
      const { error: errorSubida } = await supabase.storage
        .from(BUCKET)
        .upload(nombre, comprimida.blob, { contentType: comprimida.blob.type })

      if (errorSubida) {
        fallar(MSG_SUBIDA)
        return
      }

      /* El uid sale de la sesión ya guardada, sin viaje de red — es lo mismo que hace
         Panel.tsx para mostrar el correo. Si no se puede leer, la columna es nullable y la
         subida no se detiene por eso. */
      let subidoPor: string | null = null
      try {
        const { data } = await supabase.auth.getSession()
        subidoPor = data.session?.user.id ?? null
      } catch {
        subidoPor = null
      }

      /* PASO 2 — la fila. `tipo: 'foto'` fijo: v1 no sube videos. `orden` se deja en su
         default. Los tres campos que la galería exige van con la forma exacta que espera
         `normalizarItems`: booleano real y números finitos. */
      const { error: errorInsert } = await supabase.from(TABLA).insert({
        storage_path: nombre,
        tipo: 'foto',
        es_vertical: comprimida.alto > comprimida.ancho,
        ancho: comprimida.ancho,
        alto: comprimida.alto,
        titulo: titulo.trim() || null,
        subido_por: subidoPor
      })

      if (errorInsert) {
        /* ROLLBACK. Sin esto queda un archivo en el bucket que nada referencia: ocupa
           espacio, nadie lo ve y no hay forma de encontrarlo desde el panel.
           El resultado del borrado se COMPRUEBA, no se asume: `remove` puede volver sin
           error y sin haber borrado nada si la política del bucket no permite DELETE, que
           es la misma trampa de "0 filas sin error" que ya documenta `escribirArchivado`.
           Según lo que haya pasado, el admin recibe un mensaje distinto: si quedó un
           huérfano tiene que saberlo, con el nombre, porque limpiarlo es manual. */
        const limpiado = await borrarDelBucket(supabase, nombre)
        fallar(limpiado ? MSG_INSERT_LIMPIO : msgInsertHuerfano(nombre))
        return
      }

      /* Solo acá se considera hecho: archivo subido Y fila registrada. */
      limpiarFormulario()
      setEstado('exito')
      setMensaje('Imagen publicada. Ya aparece en la galería del sitio.')
    } catch {
      /* Red, timeout del navegador o cualquier otra cosa. No se puede saber si el archivo
         llegó a subirse, así que no se intenta un rollback a ciegas: borrar por las dudas
         podría eliminar algo que sí quedó bien registrado. */
      fallar(MSG_SUBIDA)
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/5 bg-black/30 p-6 backdrop-blur-sm md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-lqc-accent/20 bg-blue-950/40">
            <ImagePlus className="h-5 w-5 text-lqc-accent" />
          </span>
          <div className="min-w-0">
            <p className="font-sans font-medium text-white">Subir una foto</p>
            <p className="text-sm text-gray-400">
              Se reduce a {LADO_MAXIMO}px y se convierte a WebP antes de subirla.
            </p>
          </div>
        </div>

        <label
          htmlFor="galeria-archivo"
          className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-gray-400"
        >
          Imagen
        </label>
        {/* `accept` filtra el diálogo del sistema, pero NO es validación: el tipo real se
            comprueba igual en `elegirArchivo`, porque el atributo se puede eludir. */}
        <input
          ref={campoArchivoRef}
          id="galeria-archivo"
          type="file"
          accept="image/*"
          disabled={ocupado}
          onChange={(e) => void elegirArchivo(e.target.files?.[0])}
          className={CLASE_ARCHIVO}
        />

        {estado === 'comprimiendo' && (
          <p role="status" className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] text-blue-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Procesando la imagen…
          </p>
        )}

        {comprimida && vistaPrevia && (
          <div className="mt-6 space-y-5">
            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-gray-400">
                Vista previa
              </p>
              {/* La caja reserva su alto con la proporción REAL de lo comprimido, igual que
                  la grilla pública: así se ve exactamente con qué forma va a entrar. */}
              <div
                style={{ aspectRatio: `${comprimida.ancho} / ${comprimida.alto}` }}
                className="mx-auto max-h-80 overflow-hidden rounded-xl border border-white/10 bg-black/40"
              >
                <img src={vistaPrevia} alt="" className="h-full w-full object-contain" />
              </div>
              <p className="mt-2 text-center font-mono text-[11px] text-gray-400">
                {comprimida.ancho}×{comprimida.alto} ·{' '}
                {comprimida.alto > comprimida.ancho ? 'vertical' : 'horizontal'} ·{' '}
                {formatearPeso(pesoOriginal)} → {formatearPeso(comprimida.blob.size)}
              </p>
            </div>

            <div>
              <label
                htmlFor="galeria-titulo"
                className="mb-2 block font-mono text-[11px] uppercase tracking-wider text-gray-400"
              >
                Título <span className="normal-case tracking-normal text-gray-500">(opcional)</span>
              </label>
              {/* Sin título la foto se publica igual: la columna es nullable y la galería
                  simplemente no pinta el rótulo al pasar el mouse. */}
              <input
                id="galeria-titulo"
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                disabled={ocupado}
                placeholder="Por ejemplo: Final de Otoño 2025"
                className={CLASE_INPUT}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={subir} disabled={ocupado} className={BTN_PRIMARIO}>
                {estado === 'subiendo' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Subiendo…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Publicar en la galería
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={limpiarFormulario}
                disabled={ocupado}
                className={BTN_SECUNDARIO}
              >
                <X className="h-4 w-4" />
                Descartar
              </button>
            </div>
          </div>
        )}

        {estado === 'error' && mensaje && (
          <div
            role="alert"
            className="mt-6 flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-950/30 p-4"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
            <p className="font-sans text-sm leading-relaxed text-rose-200">{mensaje}</p>
          </div>
        )}

        {estado === 'exito' && mensaje && (
          <div
            role="status"
            className="mt-6 flex items-start gap-3 rounded-xl border border-lqc-accent/30 bg-blue-950/20 p-4"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lqc-accent" />
            <p className="font-sans text-sm leading-relaxed text-blue-100">{mensaje}</p>
          </div>
        )}
      </div>

      {/* Lo que esta versión NO hace, dicho en pantalla para que nadie lo busque: sin
          borrado ni reordenamiento, que necesitan políticas que la base todavía no tiene. */}
      <p className="text-sm leading-relaxed text-gray-500">
        Por ahora solo se pueden subir fotos. Borrarlas o cambiar su orden se hace desde
        Supabase; llegará al panel más adelante.
      </p>
    </div>
  )
}

/* Borra un archivo del bucket y dice si de verdad lo borró.
   Va fuera del componente porque no toca estado: es una operación sobre el bucket y nada
   más. El `data.length` importa tanto como el `error` — ver el comentario del rollback. */
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
