/* Temperatura actual de Querétaro — Open-Meteo, para la tira de datos del sitio público.

   POR QUÉ OPEN-METEO Y NO OTRA: no pide API key. Es un requisito duro, no una comodidad.
   Esta SPA es estática y toda variable `VITE_*` termina empaquetada en el bundle del
   navegador, así que una clave acá sería una clave pública. El endpoint es abierto y
   responde `access-control-allow-origin: *` — verificado con curl el 2026-09-15 desde
   `Origin: https://lqc.revolution505.com`, HTTP 200.

   CONTRATO, el mismo que `atak.ts`: esta función NUNCA lanza y NUNCA escribe en consola.
   Todo fallo —red, DNS, CORS, timeout, HTTP no-2xx, JSON con otra forma, un número que no
   es finito— se colapsa en `null`, que quien llama trata como «no hay temperatura que
   mostrar» y resuelve ocultando SOLO ese segmento de la tira. Ver la nota de degradación
   más abajo: acá, a diferencia de las secciones de ATAK, el fallo no se lleva la sección. */

const URL_OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'

/* Coordenadas de Querétaro. Son CONSTANTES NUESTRAS y tienen dos consumidores: la consulta
   de acá y el texto que pinta la tira («20.59°N 100.39°W»), que las deriva de estos mismos
   números para que haya una sola fuente.

   NO LAS REEMPLACES POR LAS QUE DEVUELVE LA API. La respuesta trae un `latitude`/`longitude`
   que NO son los que se mandaron: son los del centro de la celda de grilla que le tocó al
   punto. Verificado el 2026-09-15 — se pidió 20.5888 / -100.3899 y contestó 20.56239 /
   -100.43347, unos 5 km al oeste. Leerlos de ahí «para no repetirlos» haría que el sitio
   publique coordenadas equivocadas. */
export const LATITUD_QRO = 20.5888
export const LONGITUD_QRO = -100.3899

/* 8 s, el mismo corte que los sondeos de ATAK. Nadie está esperando este dato con el
   teclado y el próximo intento está a 15 minutos. */
const TIEMPO_LIMITE_MS = 8_000

/* Lectura defensiva, mismo criterio que `leerVeredicto` en atak.ts: el cuerpo entra como
   `unknown` y solo una forma exacta produce un número. Cualquier otra cosa —claves
   ausentes, un string donde va un número, `NaN`, `Infinity`— cae en `null`, que es lo que
   hace imposible pintar «NaN°C» en la tira.

   Se redondea acá y no en el render porque el dato que el sitio muestra es un entero: la
   API devuelve décimas (17.7) y la tira dice 18°C. `Math.round` y no `toFixed`, que
   devuelve string y arrastraría el formateo hasta el componente. */
function leerTemperatura(cuerpo: unknown): number | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null

  const { current } = cuerpo as { current?: unknown }
  if (typeof current !== 'object' || current === null) return null

  const { temperature_2m } = current as { temperature_2m?: unknown }
  if (typeof temperature_2m !== 'number' || !Number.isFinite(temperature_2m)) return null

  return Math.round(temperature_2m)
}

/* Temperatura actual en grados Celsius, ya redondeada, o `null` si no se pudo.

   `current=temperature_2m` y nada más: se pide SOLO el campo que se pinta. La API acepta
   una lista y devolver de más no cuesta nada del lado del servidor, pero cada campo extra
   es una tentación de pintarlo sin decidirlo.
   `timezone` no hace falta para la temperatura —es un instante, no una serie— pero se manda
   igual para que el `current.time` de la respuesta venga en hora local y sea legible al
   depurar. La hora que muestra la tira NO sale de acá: sale de `Intl`, sin red, para que un
   fallo del clima no se lleve puesta la hora.

   La composición de la señal externa con el corte es la misma que `pedirJson` en atak.ts, y
   está repetida a propósito: son dos módulos distintos, con dos servicios distintos y dos
   timeouts que pueden divergir. Compartirla ataría el clima al cliente de ATAK. */
export async function obtenerTemperatura(señal?: AbortSignal): Promise<number | null> {
  const propio = new AbortController()
  const corte = setTimeout(() => propio.abort(), TIEMPO_LIMITE_MS)
  const alAbortarExterno = () => propio.abort()

  /* El listener va ANTES del chequeo de `aborted`: sobre una señal ya abortada el evento
     nunca vuelve a dispararse, así que sin esa segunda línea el fetch saldría igual. */
  señal?.addEventListener('abort', alAbortarExterno, { once: true })
  if (señal?.aborted) propio.abort()

  const parametros = new URLSearchParams({
    latitude: String(LATITUD_QRO),
    longitude: String(LONGITUD_QRO),
    current: 'temperature_2m',
    timezone: 'America/Mexico_City'
  })

  try {
    const respuesta = await fetch(`${URL_OPEN_METEO}?${parametros}`, {
      headers: { Accept: 'application/json' },
      signal: propio.signal
    })

    /* `fetch` NO rechaza por 4xx/5xx: sin este guard, un 500 con cuerpo HTML seguiría a
       .json() y el error saldría por el catch como si fuera un fallo de red. */
    if (!respuesta.ok) return null
    return leerTemperatura(await respuesta.json())
  } catch {
    /* Red caída, DNS, CORS, aborto (propio o externo) o cuerpo que no es JSON. Sin
       console.*: el invariante de cero salida por consola vale para todo src/. */
    return null
  } finally {
    clearTimeout(corte)
    señal?.removeEventListener('abort', alAbortarExterno)
  }
}
