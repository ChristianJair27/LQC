/* Hora local de Querétaro, sin red.

   Vive en `src/lib/` y no en el hook porque es transporte-de-nada: son dos formateadores de
   `Intl` y una función pura. El hook de arriba solo decide CUÁNDO volver a llamarla.

   POR QUÉ NO SALE DE LA API DEL CLIMA, aunque su respuesta traiga `utc_offset_seconds` y
   `timezone_abbreviation`: porque ataría la hora a la red. La regla de degradación de la
   tira es que ubicación, coordenadas y hora funcionan SIEMPRE —incluso sin conexión— y solo
   la temperatura depende de un servicio. Además `timezone_abbreviation` devuelve `"GMT-6"`,
   no `"CST"`, así que ni siquiera serviría para el formato que se quiere.

   CONTRATO: no lanza y no escribe en consola. `Intl.DateTimeFormat` puede lanzar con un ICU
   recortado que no conozca `America/Mexico_City`, y este módulo lo importa una página que no
   tiene ErrorBoundary por encima del layout — un throw acá se lleva el sitio entero a negro
   (es la misma razón por la que `supabase.ts` envuelve su `createClient`). Por eso los
   formateadores se crean UNA vez pero de forma perezosa y dentro de try/catch, y si algo
   falla la función devuelve `null` y la tira simplemente no muestra la hora. */

const ZONA = 'America/Mexico_City'

export type HoraQro = {
  /* 'HH:MM' en 24 h. */
  hora: string
  /* 'CST', o `null` si el runtime no la sabe dar (ver abajo). */
  abreviatura: string | null
  /* 'UTC-6', o `null`. */
  offset: string | null
}

type Formateadores = {
  hora: Intl.DateTimeFormat
  offset: Intl.DateTimeFormat
} | null

let formateadores: Formateadores
let intentado = false

/* `en-US` y no `es-MX`, que es la única concesión al inglés de toda la tira y es
   deliberada: comprobado en ICU 77, `es-MX` con `timeZoneName: 'short'` devuelve «GMT-6» y
   solo `en-US` devuelve «CST». La tira es universal a propósito —coordenadas, celsius y
   offset se leen igual en cualquier idioma— y «CST» es parte de ese vocabulario, no una
   traducción. El texto en español para lector de pantalla lo arma el componente. */
function obtenerFormateadores(): Formateadores {
  if (intentado) return formateadores
  intentado = true

  try {
    formateadores = {
      /* `hourCycle: 'h23'` y NO `hour12: false`: el segundo tiene un historial de devolver
         «24:00» en vez de «00:00» a la medianoche en algunos runtimes. */
      hora: new Intl.DateTimeFormat('en-US', {
        timeZone: ZONA,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZoneName: 'short'
      }),
      offset: new Intl.DateTimeFormat('en-US', {
        timeZone: ZONA,
        timeZoneName: 'shortOffset'
      })
    }
  } catch {
    formateadores = null
  }

  return formateadores
}

function parte(partes: Intl.DateTimeFormatPart[], tipo: Intl.DateTimeFormatPartTypes) {
  return partes.find((p) => p.type === tipo)?.value ?? null
}

/* Devuelve la hora de Querétaro en el instante dado, o `null` si el runtime no puede.

   `formatToParts` y no `format`: hace falta leer la abreviatura de zona por separado para
   poder descartarla sola. Un ICU viejo devuelve «GMT-6» donde uno moderno devuelve «CST», y
   «GMT-6 (UTC-6)» diría lo mismo dos veces; por eso la abreviatura solo se acepta si son
   3 a 5 letras mayúsculas, y si no, se omite ese pedazo y queda «21:47 UTC-6».

   México abolió el horario de verano en 2022, así que hoy el offset es constante: verificado
   que enero y julio de 2026 dan los dos CST / GMT-6. Igual se deriva de `Intl` y no se
   escribe a mano, para que el día que la ley cambie otra vez el sitio no mienta. */
export function leerHoraQro(ahora: Date): HoraQro | null {
  const f = obtenerFormateadores()
  if (f === null) return null

  try {
    const partesHora = f.hora.formatToParts(ahora)
    const h = parte(partesHora, 'hour')
    const m = parte(partesHora, 'minute')
    if (h === null || m === null) return null

    const abreviaturaCruda = parte(partesHora, 'timeZoneName')
    const abreviatura =
      abreviaturaCruda !== null && /^[A-Z]{3,5}$/.test(abreviaturaCruda) ? abreviaturaCruda : null

    /* `shortOffset` devuelve «GMT-6»; la tira dice «UTC-6», que es la forma que el público
       reconoce. Si alguna vez no empieza con GMT, se omite en vez de inventar. */
    const offsetCrudo = parte(f.offset.formatToParts(ahora), 'timeZoneName')
    const offset =
      offsetCrudo !== null && offsetCrudo.startsWith('GMT')
        ? `UTC${offsetCrudo.slice(3) || '+0'}`
        : null

    return { hora: `${h}:${m}`, abreviatura, offset }
  } catch {
    return null
  }
}
