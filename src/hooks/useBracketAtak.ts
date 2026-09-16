import { useEffect, useState } from 'react'
import { obtenerBracket } from '../lib/atak'
import type { PartidaBracket } from '../lib/atak'
import { SLUG_TORNEO } from './useTorneoAtak'

/* Sondeo del bracket del torneo en curso contra la API pública de ATAK.GG.

   Es el gemelo de `useTorneoAtak` y comparte con él cada decisión —bandera `montado`,
   AbortController que pisa al anterior, cleanup completo, y sobre todo que un sondeo
   fallido NO borra lo que ya está en pantalla—. El porqué de cada una está explicado
   allá y no se repite acá.

   Lo que NO comparten es el estado: son dos peticiones a dos endpoints distintos y
   cada una falla por su cuenta. Que la clasificación no cargue no tiene por qué llevarse
   puestos los emparejamientos, ni al revés: cada sección degrada sola.

   El slug se IMPORTA de `useTorneoAtak` en vez de repetirlo. Es la misma constante y ya
   tiene tres consumidores —los dos sondeos y el botón «Ver en ATAK» de Torneos.tsx—; una
   cuarta copia es la que un día apunta a otro split que las demás. */

/* 30 s, igual que el otro sondeo: del lado del servidor hay caché y pedir más seguido no
   traería nada nuevo. Las dos peticiones salen juntas al montar la página y después cada
   una sigue su propio reloj; no se coordinan a propósito, porque coordinarlas ataría el
   fallo de una al de la otra. */
const REFRESCO_MS = 30_000

export function useBracketAtak(): { partidas: PartidaBracket[] | null; cargando: boolean } {
  const [partidas, setPartidas] = useState<PartidaBracket[] | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let montado = true
    let enVuelo: AbortController | null = null

    const consultar = async () => {
      enVuelo?.abort()
      const propio = new AbortController()
      enVuelo = propio

      const datos = await obtenerBracket(SLUG_TORNEO, propio.signal)
      if (!montado || propio.signal.aborted) return

      /* Un sondeo fallido no borra lo ya pintado: `partidas` se queda en null solo si
         NUNCA llegó nada, y ese es el caso en que la sección no se pinta. */
      if (datos !== null) setPartidas(datos)

      /* Fuera del `if`: un primer intento fallido también termina la carga, o el
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

  return { partidas, cargando }
}
