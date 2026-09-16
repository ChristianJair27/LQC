import { useEffect, useState } from 'react'
import { obtenerTemperatura } from '../lib/clima'

/* Sondeo de la temperatura de Querétaro contra Open-Meteo.

   Mismo molde que `useTorneoAtak` —bandera `montado`, AbortController que pisa al anterior,
   cleanup completo, y un sondeo fallido que NO borra lo que ya está en pantalla—. El porqué
   de cada una está explicado allá y no se repite acá.

   `cargando` existe solo para la PRIMERA carga: es lo que deja a la tira reservar el hueco
   de la temperatura mientras llega, en vez de re-centrar la línea cuando aparece. Después
   del primer intento queda en `false` para siempre — los sondeos siguientes reemplazan un
   valor por otro y no vuelven a mostrar el hueco. */

/* 15 minutos, y el número no es arbitrario: la propia respuesta de Open-Meteo trae
   `interval: 900`, o sea que el dato del lado del servidor se recalcula cada 900 s.
   Sondear más seguido no traería nada nuevo, solo más peticiones. */
const REFRESCO_MS = 15 * 60 * 1000

export function useClimaQro(): { temperatura: number | null; cargando: boolean } {
  const [temperatura, setTemperatura] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let montado = true
    let enVuelo: AbortController | null = null

    const consultar = async () => {
      enVuelo?.abort()
      const propio = new AbortController()
      enVuelo = propio

      /* `obtenerTemperatura` nunca lanza: devuelve null ante cualquier fallo. */
      const grados = await obtenerTemperatura(propio.signal)
      if (!montado || propio.signal.aborted) return

      /* Un sondeo fallido no borra el valor que ya está a la vista. Con un refresco de 15
         minutos esto importa más que en los sondeos de ATAK: un fallo pasajero dejaría el
         segmento vacío por un cuarto de hora. */
      if (grados !== null) setTemperatura(grados)

      /* Fuera del `if`: un primer intento fallido también termina la carga, o el hueco
         quedaría reservado para siempre en vez de cerrarse. */
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

  return { temperatura, cargando }
}
