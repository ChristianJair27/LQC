import { useEffect, useState } from 'react'
import { obtenerTorneo } from '../lib/atak'
import type { TorneoAtak } from '../lib/atak'

/* Sondeo del torneo en curso contra la API pública de ATAK.GG.

   VIVE EN SU PROPIO ARCHIVO, y no junto a `Clasificacion.tsx`, por una razón de
   herramienta y no de gusto: `react-refresh/only-export-components` —que el eslint
   del repo trata como ERROR— prohíbe que un archivo exporte a la vez un componente y
   algo que no lo es. Con el hook y el componente juntos, Fast Refresh deja de
   funcionar en toda la página durante el desarrollo. Es la primera carpeta `hooks/`
   del proyecto; si aparece un segundo hook, va acá al lado.

   Tampoco va en `src/lib/`: esa carpeta es de módulos SIN React —transporte,
   constantes, catálogos— y meter un hook adentro borra esa frontera. */

/* El torneo en curso. Se EXPORTA porque tiene un segundo consumidor: el botón «Ver en
   ATAK» de Torneos.tsx, que arma la URL del frontend de ATAK con el mismo slug. Tenerlo
   escrito en los dos lados es el defecto que `atak.ts` acaba de sacarse de encima con
   `BASE_ATAK` —dos copias de una constante se desincronizan en silencio en el primer
   cambio—, y acá la desincronización sería peor que cosmética: el sitio mostraría la
   clasificación de un split y el botón llevaría a otro.
   El día que arranque el split siguiente se cambia UNA vez, acá. */
export const SLUG_TORNEO = 'lqc-2026'

/* 30 s. Del lado del servidor hay 15 s de caché, así que sondear más seguido no
   traería nada nuevo, solo más peticiones. */
const REFRESCO_MS = 30_000

/* El fetch vive en un hook y no dentro de <Clasificacion> porque en Torneos hay DOS
   consumidores del mismo torneo: la tabla y el conteo de equipos del bloque
   destacado. Con el fetch adentro del componente, esa página pediría lo mismo dos
   veces cada 30 s. Así la página lo pide una vez y reparte por props.

   Molde tomado del estado del stream en Home.tsx —bandera `montado`,
   AbortController que pisa al anterior, cleanup completo—, con una diferencia que
   importa y está explicada abajo: acá el fallo NO escribe estado. */
export function useTorneoAtak(): { torneo: TorneoAtak | null; cargando: boolean } {
  const [torneo, setTorneo] = useState<TorneoAtak | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    /* `montado` antes de cada setState: la respuesta puede llegar después de que
       alguien se fue de la página. Mismo patrón que Home.tsx y Login.tsx. */
    let montado = true
    let enVuelo: AbortController | null = null

    const consultar = async () => {
      /* Aborta la anterior antes de lanzar la nueva: si una respuesta se demora más
         que el intervalo, no se apilan ni pueden resolverse fuera de orden. */
      enVuelo?.abort()
      const propio = new AbortController()
      enVuelo = propio

      /* `obtenerTorneo` nunca lanza: devuelve null ante cualquier fallo. */
      const datos = await obtenerTorneo(SLUG_TORNEO, propio.signal)
      if (!montado || propio.signal.aborted) return

      /* UN SONDEO FALLIDO NO BORRA LO QUE YA ESTÁ EN PANTALLA. Es la diferencia con
         Galeria.tsx, que carga una sola vez y puede permitirse un enum con estado
         'error': acá, en día de partida, un 502 de tres segundos haría parpadear la
         clasificación a vacío y volver. `torneo` se queda en null solo si NUNCA llegó
         nada, y ese es el caso en que la sección no se pinta. */
      if (datos !== null) setTorneo(datos)

      /* Fuera del `if`: un primer intento fallido también termina la carga. Si no, el
         esqueleto giraría para siempre en vez de desaparecer en silencio. */
      setCargando(false)
    }

    void consultar()
    const reloj = setInterval(() => void consultar(), REFRESCO_MS)

    return () => {
      montado = false
      enVuelo?.abort()
      clearInterval(reloj)
    }
  }, [])

  return { torneo, cargando }
}
