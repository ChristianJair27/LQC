/* API pública de ATAK.GG — primer acceso a un servicio externo desde el navegador.

   Vive aparte de la página que lo usa para que `/registro` no cargue con los
   detalles del transporte y para poder reusarlo cuando haga falta comprobar un
   Riot ID desde otro lado (el panel, por ejemplo).

   Este endpoint es PÚBLICO: no lleva el `x-lqc-secret` de la integración por
   triggers (ver docs/INTEGRACION-ATAK.md). No mandes secretos por acá: todo lo
   que salga de este módulo viaja en el bundle.

   CORS RESUELTO el 2026-09-15, y con él la incógnita que este comentario dejó
   abierta desde el 2026-07-27. Entonces la ruta de validación todavía no estaba
   desplegada (daba 404) y el único 200 del backend —`/api/health`— no mandaba
   ningún header CORS, así que quedaba sin saber si el 200 real iba a traerlo.
   Hoy los dos endpoints que el sitio consume responden 200 CON el header,
   comprobado con curl desde `Origin: https://lqc.revolution505.com`:
     · /validate-riot-id    → 200, `Access-Control-Allow-Origin: *`
     · /tournaments/<slug>  → 200, `Access-Control-Allow-Origin: *`
   Los dos son GET simples y el único header que mandamos es `Accept`, que está
   en la lista segura de CORS: no hay preflight aparte que pueda fallar.
   (La respuesta trae además `Cross-Origin-Resource-Policy: same-origin`, que
   asusta al leerla y no aplica: CORP solo se comprueba en peticiones de modo
   'no-cors', y un `fetch` normal va en modo 'cors'.)
   Lo que NO cambia es la degradación: si el header desapareciera, el navegador
   bloquea la respuesta y cada función de acá cae en su valor de fallo, dejando
   en consola un error que este código no puede atrapar.

   CONTRATO: ninguna función de este módulo lanza ni escribe en consola. Todo
   fallo —red, CORS, timeout, HTTP no-2xx, JSON con otra forma, Riot caído— se
   colapsa en un valor de fallo que quien llama DEBE tratar como "seguí
   adelante": 'indeterminado' en la validación, `null` en el torneo.
   La razón es de negocio, no técnica: perder una inscripción de $500 porque una
   API de terceros estaba caída es mucho peor que aceptar un Riot ID inválido,
   que además se corrige a mano desde el panel. */

/* La base va aparte porque ya son DOS rutas. Escribir el host completo en cada
   una es el mismo defecto que hicieron nacer a reglamento.ts y a
   inscripciones.ts: dos copias de una constante se desincronizan en silencio en
   el primer cambio de dominio. */
const BASE_ATAK = 'https://atakback.revolution505.com/api/public/v1'

const URL_VALIDAR_RIOT_ID = `${BASE_ATAK}/validate-riot-id`
const URL_TORNEOS = `${BASE_ATAK}/tournaments`

/* 5 s, deliberadamente más corto que los 15 s del insert de Supabase. Esto corre
   mientras alguien llena el formulario y ya movió el cursor al campo siguiente:
   un indicador colgado ahí estorba. El insert, en cambio, es la acción final y
   sí vale la pena esperarlo. */
const TIEMPO_LIMITE_RIOT_ID_MS = 5_000

/* 'indeterminado' es el único valor que NO habilita a bloquear nada: agrupa
   "Riot caído" con todos los fallos de transporte a propósito, porque quien
   llama tiene que reaccionar igual ante los dos. */
export type ResultadoRiotId = 'existe' | 'no_existe' | 'indeterminado'

/* Lectura defensiva del cuerpo: llega como `unknown` y solo dos formas exactas
   producen un veredicto. La respuesta viene de un servicio que no está en este
   repo y puede cambiar sin avisar, así que cualquier otra cosa —claves ausentes,
   tipos distintos, un `reason` que no conocemos— cae en 'indeterminado'. */
function leerVeredicto(cuerpo: unknown): ResultadoRiotId {
  if (typeof cuerpo !== 'object' || cuerpo === null) return 'indeterminado'

  const { ok, data } = cuerpo as { ok?: unknown; data?: unknown }
  if (ok !== true || typeof data !== 'object' || data === null) return 'indeterminado'

  const { valid, reason } = data as { valid?: unknown; reason?: unknown }
  if (valid === true) return 'existe'

  /* Solo 'not_found' es un veredicto negativo firme. Los otros dos casos de
     `valid:false` NO bloquean:
     - 'format': la API y la validación local no coinciden sobre qué es un Riot ID
       bien formado. Eso es un desacuerdo entre validadores, no un jugador que no
       existe, y además no debería llegar acá (el formato se valida antes).
     - cualquier `reason` nuevo: no sabemos qué significa, así que no frena a nadie.
     `valid:null` ('unavailable') es Riot caído y cae solo en el return de abajo. */
  if (valid === false && reason === 'not_found') return 'no_existe'

  return 'indeterminado'
}

/* Comprueba contra Riot si el Riot ID existe de verdad. `riotId` va con el
   formato completo `nombre#tag` y ya validado de formato por quien llama. */
export async function validarRiotId(riotId: string): Promise<ResultadoRiotId> {
  try {
    const respuesta = await fetch(
      `${URL_VALIDAR_RIOT_ID}?riotId=${encodeURIComponent(riotId)}`,
      {
        headers: { Accept: 'application/json' },
        /* Corta a los 5 s. Sin esto el fetch queda a merced del timeout del
           navegador, que puede ser de minutos, y el campo se quedaría en
           "Validando…" mucho después de que la persona siguió llenando. */
        signal: AbortSignal.timeout(TIEMPO_LIMITE_RIOT_ID_MS)
      }
    )

    if (!respuesta.ok) return 'indeterminado'
    return leerVeredicto(await respuesta.json())
  } catch {
    /* Red caída, DNS, CORS, aborto por timeout o cuerpo que no es JSON. Sin
       console.*: el invariante de cero salida por consola vale para todo src/. */
    return 'indeterminado'
  }
}

/* ------------------------------------------------------------------ */
/*  Torneo: clasificación pública                                      */
/* ------------------------------------------------------------------ */

/* 8 s, no los 5 del Riot ID. Aquel corre mientras alguien llena el formulario y ya
   movió el cursor al campo siguiente: un indicador colgado ahí estorba. Este pinta
   una sección entera, nadie lo está esperando con el teclado y el próximo intento
   está a 30 s. Es el mismo número que el `CORTE_MS` del estado del stream en
   Home.tsx, que es el otro sondeo periódico del sitio. */
const TIEMPO_LIMITE_TORNEO_MS = 8_000

/* Una fila de la clasificación, ya validada.

   `position` es el puesto que ATAK asigna y NO es el número que el sitio pinta:
   hoy numera 1…19 de corrido, o sea que publica un orden entre equipos que están
   empatados. Se conserva porque es el campo que ORDENA la lista (ver más abajo);
   el número visible lo deriva quien renderiza, agrupando por récord. */
export type FilaClasificacion = {
  position: number
  team: string
  wins: number
  losses: number
  points: number
}

/* SOLO los campos que el sitio pinta. El tipo no es un espejo de la respuesta: lo
   que no se renderiza no entra, porque un campo que nadie lee es código muerto que
   el próximo lector confunde con un pendiente.

   La respuesta trae bastante más de lo que está acá (`id`, `name`, `region`, `prize`,
   `description`, `logoUrl`, `bannerUrl`, `fearless`, `registrationUrl`, `teams`…). Los de
   abajo se listan porque son los que alguien podría querer pintar —sin conteo, que es lo
   que envejece—, y cada uno trae su motivo para no estar:
     · `startDate` dice 2026-09-01 y el reglamento oficial dice 25 de agosto. Hay un
       dato mal y no se arregla desde acá. NO lo pintes sin resolver eso primero.
     · `rulesUrl` es una ruta RELATIVA ('/docs/reglamento-lqc.pdf') que un <a>
       resolvería contra NUESTRO dominio y daría un 404. El PDF del reglamento ya
       tiene una sola fuente y es src/lib/reglamento.ts.
     · `phase` y `format` no los muestra ninguna pantalla hoy. Se agregan el día que
       haya dónde ponerlos, no antes.
     · `teamsMax` (el cupo, 32) estuvo acá y SE FUE el 2026-09-15, el día que el bloque
       destacado de /torneos pasó de «19 de 32 equipos» a «19 equipos participantes».
       Una fracción comunica lugares libres, y las inscripciones están cerradas desde el
       2026-08-25. Sin esa línea se quedó sin un solo consumidor, así que salió del tipo
       en vez de quedarse como campo que nadie lee. El techo que sigue escrito a mano en
       esa página, como respaldo si la API no responde, sale del reglamento y no de acá. */
export type TorneoAtak = {
  standings: FilaClasificacion[]
  teamsRegistered: number | null
}

function numeroFinito(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null
}

function textoONulo(valor: unknown): string | null {
  return typeof valor === 'string' && valor ? valor : null
}

/* Mismo criterio que `normalizarItems` en Galeria.tsx: se itera, se valida campo por
   campo y la fila que no tiene la forma exacta SE DESCARTA en vez de reventar la
   tabla entera. Una fila sin nombre de equipo, o con un marcador que no es número,
   no se puede pintar; perder esa fila es mucho mejor que perder la clasificación.

   Devuelve `null` solo si `standings` ni siquiera es un arreglo, que es un cambio de
   forma de la API y no una fila rota. Un arreglo VACÍO es válido: es un torneo que
   todavía no jugó una jornada, y quien llama decide qué hacer con eso. */
function leerClasificacion(cuerpo: unknown): FilaClasificacion[] | null {
  if (!Array.isArray(cuerpo)) return null

  const filas: FilaClasificacion[] = []
  for (const cruda of cuerpo) {
    if (typeof cruda !== 'object' || cruda === null) continue

    const { position, team, wins, losses, points } = cruda as {
      position?: unknown
      team?: unknown
      wins?: unknown
      losses?: unknown
      points?: unknown
    }

    const equipo = textoONulo(team)
    const puesto = numeroFinito(position)
    const ganados = numeroFinito(wins)
    const perdidos = numeroFinito(losses)
    const puntos = numeroFinito(points)

    if (
      equipo === null ||
      puesto === null ||
      ganados === null ||
      perdidos === null ||
      puntos === null
    ) {
      continue
    }

    filas.push({
      position: puesto,
      team: equipo,
      wins: ganados,
      losses: perdidos,
      points: puntos
    })
  }

  /* Por `position` y no por el orden del arreglo: es el campo que ATAK declara como
     el orden, así que una respuesta que llegue desordenada se pinta igual de bien.
     `sort` es estable desde ES2019, o sea que dos filas con el mismo `position`
     conservan el orden en que vinieron. */
  filas.sort((a, b) => a.position - b.position)
  return filas
}

/* Gemela de `leerVeredicto`: el cuerpo entra como `unknown` y solo una forma exacta
   produce un torneo. Devolver `null` acá es lo que hace DESAPARECER la sección del
   sitio, así que el criterio es estricto a propósito. */
function leerTorneo(cuerpo: unknown): TorneoAtak | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null

  const { ok, data } = cuerpo as { ok?: unknown; data?: unknown }
  if (ok !== true || typeof data !== 'object' || data === null) return null

  const { standings, teamsRegistered } = data as {
    standings?: unknown
    teamsRegistered?: unknown
  }

  const clasificacion = leerClasificacion(standings)
  if (clasificacion === null) return null

  return {
    standings: clasificacion,
    teamsRegistered: numeroFinito(teamsRegistered)
  }
}

/* Trae un torneo por su slug (hoy 'lqc-2026'). Mismo CONTRATO que `validarRiotId`:
   no lanza y no escribe en consola. `null` colapsa TODO fallo —red, DNS, CORS,
   timeout, 4xx/5xx, `ok:false`, JSON con otra forma— igual que 'indeterminado' allá
   y que el `null` de `obtenerSupabase()`.

   Quien llama trata el `null` como "no hay nada que mostrar" y NO pinta un error:
   esto alimenta una sección de un sitio público en día de partida, y un cartel rojo
   sobre la clasificación es peor que no tener la sección.

   El corte vive ACÁ y no en quien llama, para que la promesa siempre resuelva sola
   —es el mismo contrato que ya tiene la validación del Riot ID—. `señal` es el
   aborto EXTERNO (desmontar el componente, o un sondeo que pisa al anterior) y se
   compone a mano con el del corte: `AbortSignal.any` haría esto en una línea, pero
   es reciente de más para un sitio público y no vale estrenarlo por dos líneas. */
export async function obtenerTorneo(
  slug: string,
  señal?: AbortSignal
): Promise<TorneoAtak | null> {
  const propio = new AbortController()
  const corte = setTimeout(() => propio.abort(), TIEMPO_LIMITE_TORNEO_MS)
  const alAbortarExterno = () => propio.abort()

  /* El listener va ANTES del chequeo de `aborted`: sobre una señal ya abortada el
     evento nunca vuelve a dispararse, así que sin esa segunda línea el fetch saldría
     igual y recién se cortaría por timeout. */
  señal?.addEventListener('abort', alAbortarExterno, { once: true })
  if (señal?.aborted) propio.abort()

  try {
    const respuesta = await fetch(`${URL_TORNEOS}/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
      signal: propio.signal
    })

    /* `fetch` NO rechaza por 4xx/5xx: sin este guard, un 500 con cuerpo HTML seguiría
       a .json() y el error saldría por el catch como si fuera un fallo de red. */
    if (!respuesta.ok) return null
    return leerTorneo(await respuesta.json())
  } catch {
    /* Red caída, DNS, CORS, aborto (propio o externo) o cuerpo que no es JSON. Sin
       console.*: el invariante de cero salida por consola vale para todo src/. */
    return null
  } finally {
    clearTimeout(corte)
    señal?.removeEventListener('abort', alAbortarExterno)
  }
}


/* ------------------------------------------------------------------ */
/*  Bracket: emparejamientos de la ronda                               */
/* ------------------------------------------------------------------ */

/* Una partida del bracket, ya validada. SOLO los campos que el sitio pinta.

   TRES QUE LA RESPUESTA TRAE Y QUE NO ESTÁN, y el primero importa de verdad:

     · `status` NO se lee, y es a propósito. Dice `"active"` en partidas que están
       simplemente EMPAREJADAS Y SIN JUGAR —sin `gameId`, sin marcador— y dice
       `"complete"` en un BYE, que tampoco se jugó. O sea que no significa lo que su
       nombre promete y pintarlo como «en vivo» publicaría una mentira. Los tres
       estados reales se derivan de campos que no engañan, y el ORDEN importa porque
       un BYE también trae `winner`:
         1. `team2 === 'BYE'`  → descansa
         2. `winner === null`  → por jugar
         3. si no             → jugada
       No lo agregues al tipo «por completitud»: el día que alguien lo lea va a
       creerle.
     · `gameId` y `gameRegion` solo vienen en las partidas realmente jugadas y no se
       muestran en ninguna pantalla. Verificado el 2026-09-15: los 11 nulos de esos
       campos son exactamente las 8 pendientes más los 3 BYE.

   Y una consecuencia de lo anterior que conviene saber antes de que la pidan: la API
   NO expone ningún campo que marque una partida EN JUEGO AHORA. No es que no lo
   pintemos, es que no se puede. Los únicos estados representables son esos tres. */
export type PartidaBracket = {
  id: string
  round: number
  matchNumber: number
  team1: string
  /* Puede ser el literal 'BYE', que NO es un equipo: es el descanso que le toca a
     alguien cuando el torneo tiene un número impar de participantes (hoy 19, así que
     hay uno por ronda, siempre en `matchNumber` 10). Quien renderiza lo trata aparte;
     acá se guarda tal cual viene para no perder la distinción. */
  team2: string
  winner: string | null
  score1: number | null
  score2: number | null
}

/* Mismo criterio que `leerClasificacion`: se valida campo por campo y la fila que no
   tiene la forma exacta SE DESCARTA, en vez de romper la sección entera.

   Los cinco campos exigidos son los que hacen falta para PINTAR una tarjeta: sin `id`
   no hay key estable, sin `round` no se puede agrupar, sin `matchNumber` no hay
   etiqueta, y sin los dos equipos no hay partida que mostrar. `winner` y los dos
   marcadores son nullables por diseño: en las pendientes y en los BYE vienen en null,
   y todo el render tiene que aguantarlo. */
function leerPartidas(cuerpo: unknown): PartidaBracket[] | null {
  if (!Array.isArray(cuerpo)) return null

  const partidas: PartidaBracket[] = []
  for (const cruda of cuerpo) {
    if (typeof cruda !== 'object' || cruda === null) continue

    const { id, round, matchNumber, team1, team2, winner, score1, score2 } = cruda as {
      id?: unknown
      round?: unknown
      matchNumber?: unknown
      team1?: unknown
      team2?: unknown
      winner?: unknown
      score1?: unknown
      score2?: unknown
    }

    const idPartida = textoONulo(id)
    const ronda = numeroFinito(round)
    const numero = numeroFinito(matchNumber)
    const equipo1 = textoONulo(team1)
    const equipo2 = textoONulo(team2)

    if (
      idPartida === null ||
      ronda === null ||
      numero === null ||
      equipo1 === null ||
      equipo2 === null
    ) {
      continue
    }

    partidas.push({
      id: idPartida,
      round: ronda,
      matchNumber: numero,
      team1: equipo1,
      team2: equipo2,
      winner: textoONulo(winner),
      score1: numeroFinito(score1),
      score2: numeroFinito(score2)
    })
  }

  return partidas
}

/* Gemela de `leerTorneo`. Devuelve solo el arreglo de partidas porque `phase` es el
   único otro campo de `data` y no lo muestra ninguna pantalla.
   Un arreglo VACÍO es válido —un torneo sin emparejamientos publicados todavía— y
   quien llama decide qué hacer con eso. */
function leerBracket(cuerpo: unknown): PartidaBracket[] | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null

  const { ok, data } = cuerpo as { ok?: unknown; data?: unknown }
  if (ok !== true || typeof data !== 'object' || data === null) return null

  const { matches } = data as { matches?: unknown }
  return leerPartidas(matches)
}

/* Trae el bracket de un torneo por su slug. MISMO CONTRATO que el resto del módulo:
   no lanza, no escribe en consola, y todo fallo —red, DNS, CORS, timeout, 4xx/5xx,
   `ok:false`, JSON con otra forma— colapsa en `null`, que quien llama trata como «no
   hay nada que mostrar» y resuelve haciendo desaparecer la sección en silencio.

   El corte y la composición de la señal externa son idénticos a `obtenerTorneo`; el
   porqué de cada línea está explicado allá y no se repite acá. */
export async function obtenerBracket(
  slug: string,
  señal?: AbortSignal
): Promise<PartidaBracket[] | null> {
  const propio = new AbortController()
  const corte = setTimeout(() => propio.abort(), TIEMPO_LIMITE_TORNEO_MS)
  const alAbortarExterno = () => propio.abort()

  señal?.addEventListener('abort', alAbortarExterno, { once: true })
  if (señal?.aborted) propio.abort()

  try {
    const respuesta = await fetch(`${URL_TORNEOS}/${encodeURIComponent(slug)}/bracket`, {
      headers: { Accept: 'application/json' },
      signal: propio.signal
    })

    if (!respuesta.ok) return null
    return leerBracket(await respuesta.json())
  } catch {
    return null
  } finally {
    clearTimeout(corte)
    señal?.removeEventListener('abort', alAbortarExterno)
  }
}
