import { LATITUD_QRO, LONGITUD_QRO } from '../lib/clima'
import { useClimaQro } from '../hooks/useClimaQro'
import { useHoraLocal } from '../hooks/useHoraLocal'

/* Tira de datos del sitio público: dónde, qué temperatura y qué hora es en Querétaro.

       QRO · MX · 20.59°N 100.39°W · 22°C · 21:47 CST (UTC-6)

   Es la línea monoespaciada de los pósters de la liga llevada a la web. Universal a
   propósito: coordenadas, grados Celsius y offset UTC se leen igual en cualquier idioma, y
   por eso no se traduce ni se localiza el formato.

   DÓNDE VIVE Y POR QUÉ. La monta `LayoutPublico`, como primer hijo del <main>. Un solo
   punto de inserción que cubre las 8 páginas públicas más el 404 en línea de App.tsx, y que
   deja fuera a /admin POR CONSTRUCCIÓN: las rutas del panel son hermanas de LayoutPublico,
   no hijas, así que nunca montan ese <main>. Cero `useLocation`, cero condicionales.
   Y como el layout es el elemento de la ruta PADRE, React Router no lo desmonta al navegar
   entre páginas hijas: el reloj y el sondeo del clima se montan una vez y sobreviven a la
   navegación. Puesto en cada página, cada clic del nav dispararía un fetch nuevo.

   EL `relative z-10` NO ES DECORATIVO. `<main>` lleva `lqc-lienzo`, cuyos dos pseudos son
   hijos suyos posicionados en `z-index: 0`. Un hijo de `main` SIN posicionar se pinta antes
   que ellos y recibiría los tintes del lienzo POR ENCIMA en vez de por debajo — sobre un
   texto eso lo atenúa, no lo realza. Es el mismo defecto que tuvo el 404 y que está anotado
   en App.tsx. Ver AGENTS.md, «contrato de apilamiento».

   AL SCROLLEAR no hace nada, y eso es el efecto. El header es `sticky top-0 z-50` y OPACO,
   y esta tira está en el flujo dentro de `main` (z-10): al subir el scroll se mete debajo
   del header y se funde con su negro, sin convertirse en una segunda barra flotante. No hay
   listener de scroll, no hay animación, no hay una segunda fuente de verdad de la altura
   del header, y vuelve sola al volver arriba. `prefers-reduced-motion` no tiene nada que
   apagar: lo único que se mueve es el dígito del minuto, que es cambio de contenido.
   Ojo con la tentación de resolver esto con `animation-timeline: scroll()`: la manta de
   `prefers-reduced-motion` de index.css pone `animation-duration: 0.01ms !important` sobre
   todo, y a una animación de scroll no la acelera, la deja PLANTADA en su fotograma final.
   Quien reduce movimiento vería la tira permanentemente en el estado colapsado. */

/* Las coordenadas salen de las MISMAS constantes que alimentan la consulta del clima, no de
   dos cadenas escritas a mano: una sola fuente, y el formato se deriva. Dos decimales es lo
   que pide la línea del póster y alcanza para ubicar la ciudad. */
function coordenada(valor: number, positivo: string, negativo: string): string {
  return `${Math.abs(valor).toFixed(2)}°${valor >= 0 ? positivo : negativo}`
}

const COORDENADAS = `${coordenada(LATITUD_QRO, 'N', 'S')} ${coordenada(LONGITUD_QRO, 'E', 'W')}`

/* «UTC-6» en voz alta sale como «UTC guion seis», que no es lo que dice. Para el texto
   del lector de pantalla se deletrea el signo. El símbolo visible no se toca: ahí «UTC-6»
   es exactamente la forma que se reconoce de un vistazo. */
function offsetHablado(offset: string | null): string {
  if (offset === null) return ''
  const signo = offset.slice(3, 4)
  const horas = offset.slice(4)
  if (signo === '-') return `, UTC menos ${horas}`
  if (signo === '+') return `, UTC más ${horas}`
  return `, ${offset}`
}

/* El separador viaja DENTRO del segmento que precede, y es lo que hace que ocultar un
   segmento no deje un `·` colgando. Funciona porque «QRO» es siempre el primero y nunca se
   oculta, así que ningún segmento visible empieza la línea con un separador. */
function Sep() {
  return <span className="text-lqc-accent/70"> · </span>
}

export default function TiraHud() {
  const { temperatura, cargando } = useClimaQro()
  const hora = useHoraLocal()

  /* Dos formas de la hora, porque en móvil no entra la completa. En ≥640px va
     «21:47 CST (UTC-6)»; abajo, «21:47 UTC-6». Lo que se cae es la ABREVIATURA y no el
     offset: lo universal es el offset —un coreano sabe al instante qué hora es acá— y
     «CST» es la parte anglosajona.
     Si el runtime no supo dar la abreviatura, los paréntesis pierden su razón de ser
     (existen para separarla del offset) y las dos formas colapsan en la misma. */
  const horaLarga =
    hora === null
      ? null
      : hora.abreviatura !== null && hora.offset !== null
        ? `${hora.hora} ${hora.abreviatura} (${hora.offset})`
        : `${hora.hora}${hora.offset !== null ? ` ${hora.offset}` : ''}`

  const horaCorta =
    hora === null ? null : `${hora.hora}${hora.offset !== null ? ` ${hora.offset}` : ''}`

  /* Texto para lector de pantalla, en español y con las abreviaturas desplegadas: «QRO»,
     «°N» y «CST» leídos en voz alta son ruido. Se prefiere esto a `<abbr title>`, que los
     lectores no anuncian de forma confiable.
     NO va en una región viva: la hora cambia sola cada minuto y anunciarla sería
     interrumpir a alguien que está leyendo otra cosa. Sin `aria-live`, el cambio
     simplemente no se anuncia, que es lo que se quiere. */
  const descripcion = [
    'Querétaro, México.',
    `Coordenadas ${Math.abs(LATITUD_QRO).toFixed(2)} norte, ${Math.abs(LONGITUD_QRO).toFixed(2)} oeste.`,
    temperatura !== null ? `Temperatura ${temperatura} grados Celsius.` : null,
    hora !== null ? `Hora local ${hora.hora}${offsetHablado(hora.offset)}.` : null
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="relative z-10 container mx-auto px-6 py-2.5">
      {/* `text-[11px]` en px absolutos y no `text-xs`: index.css baja el root a 14px por
          debajo de 768px, así que `text-xs` daría 10.5px — ilegible para un dato que se
          quiere leer. Sin `whitespace-nowrap` a propósito: si alguna mono resultara más
          ancha de lo estimado, que envuelva en vez de desbordar.
          `tabular-nums` aunque la fuente sea monoespaciada: es el seguro de que el minuto
          no haga saltar la línea el día que la fuente no cargue y se caiga a otra. */}
      <p
        aria-hidden="true"
        className="text-center font-mono text-[11px] tabular-nums text-gray-400 md:text-xs md:tracking-[0.1em] lg:text-[13px]"
      >
        <span>QRO</span>

        <span>
          <Sep />
          MX
        </span>

        {/* El segmento más ancho —19 de los 54 caracteres— y el más redundante: dice lo
            mismo que «QRO» con más píxeles. Por eso es el primero que se cae. */}
        <span className="hidden sm:inline">
          <Sep />
          {COORDENADAS}
        </span>

        {/* Tres estados. Con dato, el valor. En la PRIMERA carga, el mismo hueco pero
            invisible, para que la línea centrada no se corra ~40px cuando llegue la
            respuesta. Si falló, NADA: ni «--°C» ni «n/d», que son mensajes de error
            disfrazados de dato. El separador se va con el segmento, así que no queda
            ningún `·` suelto. */}
        {temperatura !== null ? (
          <span>
            <Sep />
            {temperatura}°C
          </span>
        ) : cargando ? (
          <span className="invisible">
            <Sep />
            00°C
          </span>
        ) : null}

        {horaLarga !== null && (
          <span className="hidden sm:inline">
            <Sep />
            {horaLarga}
          </span>
        )}
        {horaCorta !== null && (
          <span className="sm:hidden">
            <Sep />
            {horaCorta}
          </span>
        )}
      </p>

      <span className="sr-only">{descripcion}</span>
    </div>
  )
}
