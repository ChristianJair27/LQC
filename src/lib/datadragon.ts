/* Data Dragon — el CDN público de Riot con los datos y el arte de los campeones de
   League of Legends. Segundo acceso a un servicio externo desde el navegador, después
   de `src/lib/atak.ts`, y escrito con sus mismas reglas.

   CONTRATO, igual que el de atak.ts: ninguna función de este módulo lanza ni escribe en
   consola. Todo fallo —red, CORS, timeout, HTTP no-2xx, JSON con otra forma— se colapsa
   en un valor seguro que quien llama trata como "seguí adelante": la versión de respaldo
   para `obtenerVersion`, la lista vacía para `obtenerCampeones`. La razón acá es más
   blanda que la de atak.ts —esto adorna una carta para compartir, no cobra una
   inscripción— pero el modo de fallar tiene que ser el mismo en todo `src/`.

   Este CDN es PÚBLICO y anónimo: no lleva credenciales de ningún tipo, así que no hay
   nada que se filtre por el bundle. Riot responde `Access-Control-Allow-Origin: *` tanto
   en el JSON como en las imágenes, que es justamente lo que permite dibujar el arte en
   un <canvas> y después exportarlo: sin ese header el canvas queda contaminado y
   `toBlob()` lanza SecurityError. Quien cargue estas imágenes tiene que hacerlo con
   `crossOrigin="anonymous"` para que ese permiso se aproveche.

   LA VERSIÓN NO SE FIJA A MANO. Data Dragon publica una versión nueva cada dos semanas
   más o menos y las rutas versionadas de la anterior siguen vivas, así que un valor
   hardcodeado no rompe nada — simplemente sirve arte viejo y a los campeones nuevos ni
   los conoce. Por eso `obtenerVersion()` la consulta y `VERSION_FALLBACK` existe solo
   para que la feature nunca se quede sin un valor con el que armar URLs. */

const BASE = 'https://ddragon.leagueoflegends.com'

const URL_VERSIONES = `${BASE}/api/versions.json`

/* Idioma del catálogo. Data Dragon devuelve los nombres traducidos —«Wukong», «el Rey de
   los Monos»—; en `en_US` saldrían en inglés y desentonarían con el resto de la UI, que va
   toda en español. */
const IDIOMA = 'es_MX'

/* `fetch` no trae timeout propio: sin esto la petición queda a merced del timeout del
   navegador, que puede ser de minutos.
   Dos cortes distintos porque los dos cuerpos no se parecen en nada. `versions.json` son
   5 kB y se resuelve al instante, así que mantiene los 5 s de atak.ts. `champion.json`
   son ~156 kB SIN comprimir —el CDN no devolvió `Content-Encoding`— y con 5 s en una
   conexión mala se cortaba a mitad de descarga y el catálogo caía a vacío. */
const TIEMPO_LIMITE_VERSION_MS = 5_000
const TIEMPO_LIMITE_CATALOGO_MS = 10_000

/* Valor de respaldo cuando `versions.json` no se puede leer. Verificado vigente el
   2026-08-13. Que quede viejo NO rompe la feature: las rutas versionadas de versiones
   anteriores siguen sirviéndose, así que el peor caso es arte desactualizado y campeones
   recientes ausentes del catálogo. Se exporta para que quien llame pueda distinguir "esta
   es la versión real" de "esto es el respaldo", si algún día le importa. */
export const VERSION_FALLBACK = '16.16.1'

/* Lo mínimo que la UI necesita de un campeón. `id` es el identificador interno con el que
   se arman las URLs del arte y `name` es el nombre para mostrar. NO son lo mismo y en
   varios campeones difieren: Wukong tiene `id: "MonkeyKing"`. Por eso van los dos, y por
   eso el buscador tiene que filtrar por `name` pero pedir el arte con `id`. */
export type Campeon = {
  id: string
  name: string
}

/* Único punto de red del módulo. Devuelve el cuerpo sin interpretar, o `null` si algo
   falló. Los dos consumidores tratan `null` igual que cualquier otra forma inesperada, así
   que no hace falta distinguir POR QUÉ falló: el resultado sería el mismo.
   (Un cuerpo JSON que sea literalmente `null` es indistinguible de un fallo acá. No
   importa: las lecturas de abajo lo rechazarían igual y caerían al mismo valor seguro.) */
async function pedirJson(url: string, tiempoLimiteMs: number): Promise<unknown> {
  try {
    const respuesta = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(tiempoLimiteMs)
    })

    /* `fetch` NO rechaza por 4xx/5xx. Sin este guard, un 403 con cuerpo XML —que es
       exactamente lo que devuelve este CDN ante una ruta mal armada— seguiría a .json()
       y reventaría adentro del try en vez de caer acá ordenadamente. */
    if (!respuesta.ok) return null

    return await respuesta.json()
  } catch {
    /* Red caída, DNS, CORS, aborto por timeout o cuerpo que no es JSON. Sin console.*:
       el invariante de cero salida por consola vale para todo `src/`. */
    return null
  }
}

/* Las versiones de Data Dragon son `16.16.1` o, en las viejas, `lolpatch_3.7`. Este
   control no es paranoia decorativa: el valor que devuelve `obtenerVersion()` se
   interpola en las URLs de `squareUrl` y del catálogo, así que viene de una respuesta
   remota y termina dentro de una ruta. Una cadena con `../` o con un host entero adentro
   armaría una URL que no es la que este módulo cree estar pidiendo. Letras, dígitos,
   guiones bajos y puntos cubren todo el histórico del CDN y cierran esa puerta. */
const FORMATO_VERSION = /^[\w.]+$/

/* Versión vigente del CDN. Nunca falla: si no se puede leer, devuelve `VERSION_FALLBACK`.

   Se valida SOLO el elemento [0] y no el array entero. Es el único que se devuelve, y
   recorrer los 497 restantes para comprobar que también son cadenas no cambiaría el
   resultado ni una vez. */
export async function obtenerVersion(): Promise<string> {
  const cuerpo = await pedirJson(URL_VERSIONES, TIEMPO_LIMITE_VERSION_MS)

  if (!Array.isArray(cuerpo)) return VERSION_FALLBACK

  const vigente: unknown = cuerpo[0]
  if (typeof vigente !== 'string') return VERSION_FALLBACK
  if (!FORMATO_VERSION.test(vigente)) return VERSION_FALLBACK

  return vigente
}

/* Catálogo completo de campeones, ordenado alfabéticamente por nombre visible. Nunca
   falla: si no se puede leer, devuelve `[]` y quien llame muestra su propio aviso.

   ENTRADAS ROTAS SE SALTEAN, no tiran abajo la lista. Si un campeón viniera sin `id` o
   sin `name` —forma nueva del JSON, dato incompleto del lado de Riot— se descarta ese y
   los demás siguen. Para un catálogo de 173 elementos que solo adorna una carta,
   perderse uno es mucho mejor que perderlos todos, y es la misma lógica de "seguí
   adelante" que gobierna el resto del módulo.

   El orden se calcula acá y no en la UI porque el JSON viene ordenado por `id` interno,
   que es un orden que no le sirve a nadie: pondría a Wukong entre Miss Fortune y Mordekaiser
   —por «MonkeyKing»— en vez de donde una persona lo busca. `localeCompare` en español para
   que los acentos no manden a Céfiro después de Zed. */
export async function obtenerCampeones(version: string): Promise<Campeon[]> {
  const cuerpo = await pedirJson(
    `${BASE}/cdn/${encodeURIComponent(version)}/data/${IDIOMA}/champion.json`,
    TIEMPO_LIMITE_CATALOGO_MS
  )

  if (typeof cuerpo !== 'object' || cuerpo === null) return []

  const { data } = cuerpo as { data?: unknown }
  if (typeof data !== 'object' || data === null) return []

  const campeones: Campeon[] = []

  for (const entrada of Object.values(data as Record<string, unknown>)) {
    if (typeof entrada !== 'object' || entrada === null) continue

    const { id, name } = entrada as { id?: unknown; name?: unknown }
    if (typeof id !== 'string' || id.length === 0) continue
    if (typeof name !== 'string' || name.length === 0) continue

    campeones.push({ id, name })
  }

  return campeones.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

/* ------------------------------------------------------------------ */
/*  URLs del arte. Síncronas: solo arman cadenas, no tocan la red.     */
/* ------------------------------------------------------------------ */

/* CUÁL LLEVA VERSIÓN Y CUÁL NO. No es una convención que se pueda deducir: está
   comprobada contra el CDN el 2026-08-13, y equivocarse no degrada, ROMPE.
     · splash  SIN versión → 200   ·  splash  CON versión → 403
     · loading SIN versión → 200   ·  loading CON versión → 403
     · square  CON versión → 200   ·  square  SIN versión → 403
   O sea que las tres formas equivocadas devuelven 403, no 404 ni un redirect. El motivo de
   fondo es que el arte de campeones es estable entre parches y por eso vive fuera del
   árbol versionado, mientras que los íconos cuadrados se rehacen con cada rediseño y sí
   necesitan quedar clavados a una versión.

   `_0` es la skin por defecto (la base). Las demás skins son `_1`, `_2`, etc., y cuáles
   existen para cada campeón sale de `champion/{id}.json`, que este módulo no consulta.

   `encodeURIComponent` sobre valores que hoy son ASCII plano (`Aatrox`, `MonkeyKing`) es
   deliberado igual: el `id` sale de una respuesta remota y termina dentro de una ruta, así
   que se codifica por la misma razón por la que se valida el formato de la versión. */

export function splashUrl(championId: string): string {
  return `${BASE}/cdn/img/champion/splash/${encodeURIComponent(championId)}_0.jpg`
}

export function loadingUrl(championId: string): string {
  return `${BASE}/cdn/img/champion/loading/${encodeURIComponent(championId)}_0.jpg`
}

export function squareUrl(championId: string, version: string): string {
  return `${BASE}/cdn/${encodeURIComponent(version)}/img/champion/${encodeURIComponent(championId)}.png`
}
