import { useEffect, useState } from 'react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ImageOff,
  Video as VideoIcon,
  X
} from 'lucide-react'
import { obtenerSupabase } from '../lib/supabase'

/* ------------------------------------------------------------------ */
/*  Datos                                                              */
/* ------------------------------------------------------------------ */

/* La galería dejó de ser un array escrito a mano y ahora sale de `public.galeria_media`.
   Lo que había antes: dos videos literales y VEINTE fotos generadas con dos `Array.from`
   que asumían cuántos archivos hay en `public/galeria/` —`length: 14` y `length: 6`—.
   Publicar una foto era subir el archivo al repo Y editar ese número; si alguien hacía
   solo una de las dos cosas, la foto no aparecía o quedaba un hueco roto.

   Los archivos viejos SIGUEN en `public/galeria/` a propósito: migrarlos al bucket es un
   paso posterior. Mientras tanto esta página ya no los lee, así que hasta que la tabla
   tenga filas la galería se ve vacía. Eso es lo esperado, no un fallo.

   Tres datos se fueron y no vuelven sin una columna que los respalde:
   - `views`: era `Math.floor(Math.random() * 15 + 5)`. Se pintaba como «12.4K vistas» en
     la grilla y en el modal, o sea que el sitio publicaba una métrica inventada que
     además cambiaba en cada render.
   - `duration`: solo lo llevaban los dos videos literales, escrito a mano.
   - `tags`: se declaraba en el tipo y se poblaba en los tres bloques, pero NO se
     renderizaba en ningún lado. Era peso muerto.
   `poster` tampoco vuelve: ya estaba desactivado porque `/galeria/posters/` no existe. */
const TABLA = 'galeria_media'
const BUCKET = 'galeria'

/* Fila tal como llega de PostgREST. `titulo`, `ancho` y `alto` son nullables en el
   esquema, así que el tipo lo dice y el render lo contempla. */
type FilaGaleria = {
  id: string
  storage_path: string
  titulo: string | null
  tipo: string
  es_vertical: boolean
  ancho: number | null
  alto: number | null
}

/* Lo que consume el render. Es la fila más la URL pública ya resuelta: `getPublicUrl` se
   llama UNA vez por fila al cargar y no en cada render, que con la grilla completa serían
   decenas de llamadas por repintado. */
type MediaItem = FilaGaleria & { url: string }

type Estado = 'cargando' | 'listo' | 'error'

/* Proporción del hueco de cada ítem, en formato de `aspect-ratio`.

   Va como estilo en línea y no como clase de Tailwind porque el valor sale de los datos:
   Tailwind compila leyendo el código como texto, así que una clase armada en tiempo de
   ejecución nunca se genera.

   Para qué sirve: reservar el alto ANTES de que la imagen cargue. Sin esto la grilla
   masonry se rearma a medida que van llegando las imágenes y el contenido salta bajo el
   cursor. Con `ancho`/`alto` reales el hueco es exacto.

   Si la fila no los trae —son nullables— se cae a la proporción típica de cada
   orientación. Es una aproximación: la imagen puede no calzar exacta, pero `object-cover`
   la recorta y el hueco no cambia de tamaño, que es lo que se busca. */
function proporcion(item: FilaGaleria): string {
  if (item.ancho && item.alto && item.ancho > 0 && item.alto > 0) {
    return `${item.ancho} / ${item.alto}`
  }
  return item.es_vertical ? '9 / 16' : '16 / 9'
}

/* Lectura defensiva, mismo criterio que `leerSugerencias` en Registro.tsx: la fila se
   acepta solo si tiene la forma exacta y se descarta si no.
   Lo que de verdad importa acá es `storage_path`: una fila sin él produciría una URL
   pública inválida y un hueco roto en la grilla. Vale más no pintarla. */
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
      /* Cualquier cosa que no sea exactamente `true` cuenta como horizontal: es la
         orientación de la mayoría y la que menos molesta si el dato viniera raro. */
      es_vertical: es_vertical === true,
      ancho: typeof ancho === 'number' && Number.isFinite(ancho) ? ancho : null,
      alto: typeof alto === 'number' && Number.isFinite(alto) ? alto : null,
      url: urlPublica(storage_path)
    })
  }
  return items
}

/* ------------------------------------------------------------------ */
/*  Estados de carga                                                   */
/* ------------------------------------------------------------------ */

/* Esqueleto con la misma grilla masonry que el contenido real, para que al llegar los
   datos no salte de una disposición a otra. Molde tomado de `Esqueleto()` en
   ListaInscripciones.tsx: `role="status"`, el texto para lector de pantalla en `sr-only`
   y el resto con `aria-hidden` porque son cajas sin significado. */
function EsqueletoGaleria() {
  return (
    <div role="status">
      <span className="sr-only">Cargando la galería…</span>
      <div
        className="columns-1 gap-6 space-y-6 sm:columns-2 lg:columns-3 xl:columns-4"
        aria-hidden="true"
      >
        {['16 / 9', '9 / 16', '16 / 9', '9 / 16', '16 / 9', '16 / 9', '9 / 16', '16 / 9'].map(
          (ratio, i) => (
            <div
              key={i}
              style={{ aspectRatio: ratio }}
              className="animate-pulse break-inside-avoid rounded-2xl border border-white/5 bg-white/[0.03]"
            />
          )
        )}
      </div>
    </div>
  )
}

/* Error genérico, familia `rose` y `role="alert"`. Nunca se expone el error real de
   Supabase: el estado es un enum y no guarda el objeto. Mismo molde que `ErrorCarga()`. */
function ErrorGaleria() {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-2xl items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-950/30 p-5"
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
      <div>
        <p className="font-sans text-sm text-rose-200 md:text-base">
          No pudimos cargar la galería.
        </p>
        <p className="mt-1 font-sans text-sm text-rose-300/80">
          Recarga la página e inténtalo de nuevo en unos minutos.
        </p>
      </div>
    </div>
  )
}

/* Vacío: no es un error, es un mensaje amable. Es el estado que se ve HOY, con la tabla
   recién creada y todavía sin filas. Mismo molde que `VacioEquipos()`. */
function VacioGaleria() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-white/15 bg-black/30 p-10 text-center md:p-14">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-lqc-accent/20 bg-blue-950/40 shadow-lqc">
        <ImageOff className="h-8 w-8 text-lqc-accent" />
      </div>
      <p className="font-sans text-lg text-white md:text-xl">
        Todavía no hay nada publicado en la galería.
      </p>
      <p className="mx-auto mt-2 max-w-md font-sans leading-relaxed text-gray-400">
        En cuanto subamos las fotos y los videos de la temporada, aparecerán aquí.
      </p>
    </div>
  )
}

/* Flechas de navegación del modal. Misma receta que los filtros y que el botón de cerrar:
   `bg-none` para que `bg-black/60` no quede debajo del gradiente que index.css:159 le pone
   a TODO <button>, y `hover:[transform:none]` para matar el salto de -2px de index.css:167
   —en una flecha pegada al borde ese brinco se lee como un glitch—.
   El «se ilumina» del hover es el mismo azul del resto del sitio: borde y chevron en
   `lqc-accent` con el halo `shadow-blue-900/40` que ya usa el filtro activo. Los estados de
   hover van bajo `enabled:` para que la flecha del extremo, ya atenuada, no reaccione;
   `disabled:hover:shadow-none` le quita además el halo de la capa base. */
const BTN_FLECHA = `
  pointer-events-auto p-3 md:p-4 rounded-full border backdrop-blur-md transition-all duration-300
  bg-none bg-black/60 border-white/10 text-white
  hover:[transform:none]
  enabled:hover:bg-black/80 enabled:hover:border-lqc-accent/60 enabled:hover:text-lqc-accent
  enabled:hover:shadow-lg enabled:hover:shadow-blue-900/40
  disabled:opacity-25 disabled:cursor-default disabled:hover:shadow-none
`

/* ------------------------------------------------------------------ */
/*  Componente                                                         */
/* ------------------------------------------------------------------ */

export default function Galeria() {
  /* Sin cliente (build sin credenciales o URL inválida) el estado arranca en 'error' desde
     el inicializador, en vez de con un setState síncrono dentro del efecto.
     `obtenerSupabase()` es idempotente y nunca lanza: memoiza el cliente. */
  const [estado, setEstado] = useState<Estado>(() => (obtenerSupabase() ? 'cargando' : 'error'))
  const [items, setItems] = useState<MediaItem[]>([])
  const [filtro, setFiltro] = useState('todos')
  /* El id ahora es un uuid, así que el seleccionado es `string | null` y no `number | null`. */
  const [seleccionado, setSeleccionado] = useState<string | null>(null)

  useEffect(() => {
    let montado = true

    const supabase = obtenerSupabase()
    if (!supabase) return

    void (async () => {
      try {
        const { data, error } = await supabase
          .from(TABLA)
          .select('*')
          .order('orden', { ascending: true })
          .order('creado_en', { ascending: false })

        if (!montado) return
        /* No se guarda `error` en estado ni se loguea: solo se marca el enum. */
        if (error || !data) {
          setEstado('error')
          return
        }

        /* `getPublicUrl` es SÍNCRONO —no pega a la red, arma la URL con la del proyecto—
           así que se puede resolver acá mismo, al normalizar, y no en el render.
           El bucket es público: la URL sirve directo en un `src`, sin firmar nada. */
        setItems(
          normalizarItems(
            data,
            (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
          )
        )
        setEstado('listo')
      } catch {
        if (montado) setEstado('error')
      }
    })()

    return () => {
      montado = false
    }
  }, [])

  /* Los filtros salen de los DATOS, no de una lista fija. Antes estaban cableados a 'foto'
     y 'video' porque el array tenía los dos a mano; con la tabla, mientras solo haya fotos
     el filtro sería una barra de tres botones donde dos no hacen nada y el tercero no
     filtra nada. Así aparece sola el día que se suba el primer video, y no antes. */
  const tipos = Array.from(new Set(items.map((i) => i.tipo))).sort()
  const hayVariosTipos = tipos.length > 1

  /* El filtro se ignora si no hay barra: así un valor viejo no puede dejar la grilla vacía
     sin ningún control a la vista que explique por qué. */
  const visibles =
    hayVariosTipos && filtro !== 'todos' ? items.filter((i) => i.tipo === filtro) : items

  /* Se busca UNA vez, no cinco como hacía el modal antes (un `find` por cada campo que
     pintaba). Si el id ya no está en la lista, `?? null` cierra el modal solo. */
  const itemAbierto = seleccionado === null ? null : (items.find((i) => i.id === seleccionado) ?? null)

  /* La navegación del modal se mueve por `visibles`, NO por `items`: si el usuario está
     viendo un subconjunto filtrado, siguiente/anterior tienen que quedarse dentro de ese
     subconjunto. Por eso el índice se busca en la lista filtrada.
     Con el modal cerrado —o si el abierto quedara fuera del filtro— da -1 y las dos
     flechas quedan inertes. */
  const indiceActual = seleccionado === null ? -1 : visibles.findIndex((i) => i.id === seleccionado)
  const hayAnterior = indiceActual > 0
  const haySiguiente = indiceActual >= 0 && indiceActual < visibles.length - 1

  /* Un índice fuera de rango devuelve `undefined` y no hace nada. De ahí sale gratis el
     requisito de no envolver: en la última foto, `visibles[length]` no existe y no se
     salta a la primera. */
  const irAlIndice = (indice: number) => {
    const destino = visibles[indice]
    if (destino) setSeleccionado(destino.id)
  }

  /* Teclado: ← anterior, → siguiente, Escape cierra.
     Con el modal cerrado el efecto sale antes de registrar nada, así que la galería en
     reposo no tiene ningún listener puesto; el cleanup lo quita tanto al cerrar como al
     desmontar.
     La navegación va en línea y no llamando a `irAlIndice` para que las dependencias del
     efecto sean exactamente lo que el handler lee. `visibles` es un array nuevo en cada
     render, así que el listener se vuelve a registrar en cada repintado: es barato
     (add/removeEventListener) y garantiza que el handler nunca navegue sobre una lista
     vieja. */
  useEffect(() => {
    if (seleccionado === null) return

    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setSeleccionado(null)
        return
      }

      const paso = evento.key === 'ArrowLeft' ? -1 : evento.key === 'ArrowRight' ? 1 : 0
      if (paso === 0) return

      const destino = visibles[indiceActual + paso]
      if (destino) setSeleccionado(destino.id)
    }

    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [seleccionado, visibles, indiceActual])

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
              Galería LQC
            </h1>
            {/* Línea divisoria estilo póster */}
            <div className="h-px w-40 mx-auto mb-6 bg-gradient-to-r from-transparent via-lqc-accent/60 to-transparent" />
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Momentos legendarios, jugadas inolvidables y celebraciones que definieron nuestras temporadas.
            </p>
          </div>
        </section>

        {/* Filtros. Solo se montan si hay más de un tipo que filtrar — ver el comentario de
            `hayVariosTipos`. Con la tabla vacía o con solo fotos, esta banda no existe. */}
        {estado === 'listo' && hayVariosTipos && (
          <section className="py-12 bg-black/20">
            <div className="container mx-auto px-6 max-w-6xl">
              <div className="flex flex-wrap justify-center gap-4">
                {['todos', ...tipos].map((id) => {
                  const cantidad = id === 'todos' ? items.length : items.filter((i) => i.tipo === id).length
                  return (
                    <button
                      key={id}
                      onClick={() => setFiltro(id)}
                      aria-pressed={filtro === id}
                      /* `bg-none` y los dos `hover:` neutralizan lo que index.css le pone a
                         TODO <button>: el gradiente azul de fondo (index.css:152-164) y, en
                         hover, el salto de -2px con halo azul (index.css:166-169).
                         Sin `bg-none` esto se veía mal de una forma concreta: `background` es
                         la abreviada, así que setea `background-image`, mientras que
                         `bg-blue-900/40` y `bg-black/30` solo setean `background-color` y
                         quedaban DETRÁS de un gradiente opaco. O sea que los dos estados se
                         pintaban idénticos y el activo no se distinguía del inactivo.
                         Misma receta que BTN_TEMPORADA en Torneos.tsx. */
                      className={`
                        px-6 py-3 rounded-full text-base font-medium transition-all duration-300 backdrop-blur-sm border
                        bg-none hover:[transform:none] hover:shadow-none
                        ${filtro === id
                          ? 'bg-blue-900/40 border-blue-600 text-white shadow-lg shadow-blue-900/30'
                          : 'bg-black/30 border-white/10 text-gray-300 hover:border-blue-500/50 hover:text-white'
                        }
                      `}
                    >
                      {id === 'todos' ? 'Todos' : id}
                      <span className="ml-2 opacity-70">({cantidad})</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* Grilla masonry */}
        <section className="py-16 pb-24">
          <div className="container mx-auto px-6 max-w-7xl">
            {estado === 'cargando' && <EsqueletoGaleria />}
            {estado === 'error' && <ErrorGaleria />}
            {estado === 'listo' && visibles.length === 0 && <VacioGaleria />}

            {estado === 'listo' && visibles.length > 0 && (
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
                {visibles.map(item => (
                  <div
                    key={item.id}
                    className="group break-inside-avoid cursor-pointer"
                    onClick={() => setSeleccionado(item.id)}
                  >
                    <div className="relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md border border-white/5 shadow-xl shadow-black/40 transition-all duration-500 group-hover:scale-[1.03] group-hover:shadow-blue-900/40 group-hover:border-blue-500/30">
                      {/* El hueco reserva su alto con la proporción real de la fila, así la
                          grilla no se rearma a medida que cargan las imágenes. Antes el alto
                          salía de clases fijas y `es_vertical` era `Math.random() > 0.6`, o
                          sea que la disposición cambiaba en CADA render. Ahora es estable. */}
                      <div style={{ aspectRatio: proporcion(item) }}>
                        {item.tipo === 'video' ? (
                          <video
                            src={item.url}
                            className="w-full h-full object-cover"
                            autoPlay
                            muted
                            loop
                            playsInline
                            preload="metadata"
                            controls={false}
                          />
                        ) : (
                          /* Si el archivo no existe en el bucket se OCULTA la imagen y queda
                             el hueco con su fondo, en vez del icono de imagen rota.
                             El manejador NO apunta a un archivo de reserva a propósito: un
                             fallback que a su vez no cargue vuelve a disparar onError y entra
                             en bucle. Eso ya fue un bug en el muro de patrocinadores de
                             Home.tsx; no lo "mejores" apuntándolo a una imagen.
                             Con los datos en una tabla esto pesa más que antes: una fila cuyo
                             `storage_path` ya no esté en el bucket llega igual al render. */
                          <img
                            src={item.url}
                            alt={item.titulo ?? ''}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        )}
                      </div>

                      {/* Overlay. Solo con título: las «vistas» que se mostraban acá salían
                          de Math.random(). Sin título no se monta — una franja negra vacía
                          al pasar el mouse no aporta nada. */}
                      {item.titulo && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400 flex flex-col justify-end p-6">
                          <h3 className="text-lg font-medium truncate">{item.titulo}</h3>
                        </div>
                      )}

                      {/* El badge de tipo solo tiene sentido si hay más de uno: con pura foto,
                          repetir "foto" en cada tarjeta es ruido. */}
                      {hayVariosTipos && (
                        <div className="absolute top-4 right-4 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium flex items-center gap-2">
                          {item.tipo === 'video' ? <VideoIcon className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                          {item.tipo}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Modal */}
        {itemAbierto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4"
            onClick={() => setSeleccionado(null)}
          >
            <div
              className="relative max-w-6xl w-full max-h-[95vh] overflow-hidden rounded-2xl shadow-2xl shadow-black/80"
              onClick={e => e.stopPropagation()}
            >
              {/* Mismo parche que los filtros: sin `bg-none` este botón se pintaba con el
                  gradiente azul de la capa base en vez de con su `bg-black/60`, o sea un
                  círculo azul eléctrico sobre la foto. Los dos `hover:` matan el salto y el
                  halo que index.css le da a todo <button> al pasar el mouse. */}
              <button
                className="absolute top-4 right-4 z-20 p-4 bg-none bg-black/60 rounded-full hover:bg-black/80 hover:[transform:none] hover:shadow-none transition-all backdrop-blur-md"
                onClick={() => setSeleccionado(null)}
                aria-label="Cerrar"
              >
                <X className="w-7 h-7" />
              </button>

              {/* Flechas. Van DENTRO de la caja del modal porque tiene `overflow-hidden`:
                  colgadas por fuera quedarían recortadas. El contenedor es
                  `pointer-events-none` para no tapar la foto ni los controles del video, y
                  cada botón se los devuelve con `pointer-events-auto`.
                  El centrado vertical sale de `items-center`, NO de `-translate-y-1/2`: el
                  `hover:[transform:none]` que hace falta contra index.css borraría ese
                  translate y la flecha se desplomaría al pasar el mouse.
                  Con una sola foto visible no se montan: dos flechas muertas no aportan. */}
              {visibles.length > 1 && (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-between px-4">
                  <button
                    className={BTN_FLECHA}
                    onClick={() => irAlIndice(indiceActual - 1)}
                    disabled={!hayAnterior}
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="w-7 h-7" />
                  </button>
                  <button
                    className={BTN_FLECHA}
                    onClick={() => irAlIndice(indiceActual + 1)}
                    disabled={!haySiguiente}
                    aria-label="Foto siguiente"
                  >
                    <ChevronRight className="w-7 h-7" />
                  </button>
                </div>
              )}

              {itemAbierto.tipo === 'video' ? (
                <div style={{ aspectRatio: proporcion(itemAbierto) }} className="bg-black">
                  <video
                    src={itemAbierto.url}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <img
                  src={itemAbierto.url}
                  alt={itemAbierto.titulo ?? ''}
                  className="w-full h-auto max-h-[90vh] object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              )}

              {itemAbierto.titulo && (
                <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 to-transparent">
                  <h3 className="text-2xl md:text-4xl font-light">{itemAbierto.titulo}</h3>
                </div>
              )}
            </div>
          </div>
        )}

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
