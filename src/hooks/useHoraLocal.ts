import { useEffect, useState } from 'react'
import { leerHoraQro } from '../lib/horaQro'
import type { HoraQro } from '../lib/horaQro'

/* Reloj de la tira de datos: la hora de Querétaro, actualizada UNA VEZ POR MINUTO.

   Por minuto y no por segundo, que es lo que se pidió y además lo correcto: la tira no
   muestra segundos, así que repintar 60 veces por minuto sería trabajo invisible — y en
   móvil, batería gastada en nada. */

/* El tick NO es `setInterval(60_000)`. Se reprograma cada vez con un `setTimeout` calculado
   hasta el próximo borde de minuto, por dos razones:

   1. SIN DERIVA. Un intervalo fijo arranca cuando se montó el componente, así que el dígito
      cambiaría a los 37 segundos de cada minuto y quedaría hasta 59 s desfasado de la hora
      real. Con el borde calculado, el minuto de la pantalla cambia cuando cambia de verdad.
   2. SOBREVIVE A LA SUSPENSIÓN. Los navegadores estrangulan los timers de pestañas de fondo
      y los congelan si el aparato se duerme. Con un intervalo fijo, al volver la pestaña
      muestra la hora de cuando se durmió hasta el próximo disparo; acá, el primer tick tras
      despertar recalcula el borde y se reacomoda solo.

   Los 250 ms de más son un margen: `setTimeout` puede disparar un pelo ANTES del borde, y
   sin ese colchón se formatearía todavía el minuto viejo y el dígito se quedaría atrasado
   un minuto entero hasta el tick siguiente. */
const MARGEN_MS = 250

export function useHoraLocal(): HoraQro | null {
  /* Inicializador perezoso: se calcula en el primer render y no en cada uno. `leerHoraQro`
     nunca lanza; devuelve null si el runtime no puede con la zona. */
  const [hora, setHora] = useState<HoraQro | null>(() => leerHoraQro(new Date()))

  useEffect(() => {
    let montado = true
    let id: ReturnType<typeof setTimeout>

    const programar = () => {
      const faltan = 60_000 - (Date.now() % 60_000)
      id = setTimeout(() => {
        if (!montado) return
        setHora(leerHoraQro(new Date()))
        programar()
      }, faltan + MARGEN_MS)
    }

    /* NO se vuelve a leer acá. El inicializador perezoso del useState ya lo hizo en el
       primer render, y un `setHora` síncrono en el cuerpo del efecto es exactamente lo que
       la regla `react-hooks/set-state-in-effect` marca como error en este repo: fuerza un
       segundo render para un valor que, entre el render y el efecto, no cambió. El único
       escenario en que diferirían es que se cruzara un borde de minuto en esos microsegundos,
       y ese caso se corrige solo en el primer tick. */
    programar()

    return () => {
      montado = false
      clearTimeout(id)
    }
  }, [])

  return hora
}
