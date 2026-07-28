/* API pública de ATAK.GG — primer acceso a un servicio externo desde el navegador.

   Vive aparte de la página que lo usa para que `/registro` no cargue con los
   detalles del transporte y para poder reusarlo cuando haga falta comprobar un
   Riot ID desde otro lado (el panel, por ejemplo).

   Este endpoint es PÚBLICO: no lleva el `x-lqc-secret` de la integración por
   triggers (ver docs/INTEGRACION-ATAK.md). No mandes secretos por acá: todo lo
   que salga de este módulo viaja en el bundle.

   CORS, verificado el 2026-07-27 y todavía incompleto: el backend responde
   `Access-Control-Allow-Origin: *` en el 404 de esta ruta —que hoy no está
   desplegada—, pero NO manda ningún header CORS en `/api/health`, la única ruta
   suya que devuelve 200. O sea que la cobertura es inconsistente por ruta y
   queda sin comprobar si la respuesta 200 real va a traer el header. Si no lo
   trae, el navegador bloquea la respuesta, esto devuelve 'indeterminado' —el
   registro sigue funcionando— pero la validación queda inerte y cada intento
   imprime un error de CORS en consola que este código no puede atrapar.
   Antes de dar la función por viva: comprobar el header en el 200, no en el 404.

   CONTRATO: ninguna función de este módulo lanza ni escribe en consola. Todo
   fallo —red, CORS, timeout, HTTP no-2xx, JSON con otra forma, Riot caído— se
   colapsa en 'indeterminado', que quien llama DEBE tratar como "seguí adelante".
   La razón es de negocio, no técnica: perder una inscripción de $500 porque una
   API de terceros estaba caída es mucho peor que aceptar un Riot ID inválido,
   que además se corrige a mano desde el panel. */

const URL_VALIDAR_RIOT_ID =
  'https://atakback.revolution505.com/api/public/v1/validate-riot-id'

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
