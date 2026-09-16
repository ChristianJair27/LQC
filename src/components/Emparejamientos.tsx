import { Check } from 'lucide-react'
import type { PartidaBracket } from '../lib/atak'

/* Emparejamientos de la ronda en curso, de la API pública de ATAK.GG.

   Es SOLO PRESENTACIÓN, igual que `Clasificacion.tsx`: no pide nada. El sondeo vive en
   `src/hooks/useBracketAtak.ts` y lo llama la página.

   MISMA REGLA DE DEGRADACIÓN que la clasificación: si la API falla, o si no hay ninguna
   ronda que mostrar, la sección DESAPARECE EN SILENCIO. Por eso el <section> y el <h2>
   viven acá adentro y no en la página: allá quedaría un encabezado colgado sobre un hueco.
   Lo único visible sin datos es el esqueleto de la primera carga. */

/* El literal que ATAK pone en `team2` cuando a un equipo le toca descansar. NO es un
   equipo. Con 19 participantes —número impar— hay exactamente uno por ronda. */
const BYE = 'BYE'

/* Los tres estados posibles. Ver el comentario de `PartidaBracket` en lib/atak.ts: NO
   salen de `status`, que dice "active" en partidas que solo están emparejadas y
   "complete" en un BYE que nadie jugó. Salen de campos que no engañan. */
type EstadoPartida = 'descansa' | 'por-jugar' | 'jugada'

/* EL ORDEN DE ESTAS TRES LÍNEAS ES EL PUNTO. Un BYE también trae `winner` —el equipo que
   descansa figura como ganador—, así que si se preguntara primero por `winner` caería en
   'jugada' y se pintaría con un marcador que no existe. El BYE se descarta primero. */
function estadoDe(partida: PartidaBracket): EstadoPartida {
  if (partida.team1 === BYE || partida.team2 === BYE) return 'descansa'
  if (partida.winner === null) return 'por-jugar'
  return 'jugada'
}

/* Cuál de los dos lados es el equipo de verdad. Hoy el BYE viene SIEMPRE en `team2` —los
   tres del torneo, siempre en `matchNumber` 10—, así que mirar los dos lados no cambia
   nada en pantalla. Está igual porque el costo es una línea y el fallo sería visible: una
   tarjeta anunciando a un «equipo» llamado BYE, con su palomita de ganador. */
function equipoQueDescansa(partida: PartidaBracket): string {
  return partida.team1 === BYE ? partida.team2 : partida.team1
}

/* La ronda a mostrar es SIEMPRE la de número más alto que exista en los datos.

   En un suizo los emparejamientos de la ronda N+1 solo se publican cuando la N terminó,
   así que la ronda más alta ES la que se está jugando. Punto.

   La alternativa que se descartó era «la de mayor número con al menos una partida sin
   ganador», y falla en un caso real: si la última ronda quedara toda cerrada y a una
   ronda anterior le faltara cargar un resultado, esa regla RETROCEDE y presenta una
   ronda ya terminada como si fuera la actual. Con `max` eso no puede pasar, y el caso
   «el suizo terminó» se resuelve solo: la última ronda se muestra con todas sus partidas
   jugadas, que es exactamente lo que hay que ver.

   `reduce` y no `Math.max(...array)`: el spread pasa un argumento por partida y con un
   arreglo grande revienta la pila. Hoy son 30, pero la forma correcta no cuesta más. */
function rondaAMostrar(partidas: PartidaBracket[]): number | null {
  if (partidas.length === 0) return null
  return partidas.reduce((alta, p) => (p.round > alta ? p.round : alta), partidas[0].round)
}

function contar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/* ------------------------------------------------------------------ */
/*  Piezas                                                             */
/* ------------------------------------------------------------------ */

/* Chip de estado. NINGUNO lleva punto pulsante ni verde: el verde y el latido son, en
   este sitio, el código de «pasando ahora» —el badge EN VIVO de la portada— y ninguna
   de estas partidas está pasando ahora. Una «Por jugar» pintada así diría que hay algo
   que mirar cuando no lo hay.
   'jugada' es el único con color, y es azul de marca porque es el único que trae
   información nueva (un marcador). Los otros dos van en el gris neutro que la página ya
   usa para el badge de inscripciones cerradas. */
const CHIP_BASE =
  'shrink-0 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide'

const CHIP: Record<EstadoPartida, string> = {
  'por-jugar': `${CHIP_BASE} border-gray-700/60 bg-gray-900/70 text-gray-400`,
  jugada: `${CHIP_BASE} border-blue-800/40 bg-blue-950/40 text-blue-300`,
  descansa: `${CHIP_BASE} border-gray-700/60 bg-gray-900/70 text-gray-400`
}

const ETIQUETA: Record<EstadoPartida, string> = {
  'por-jugar': 'Por jugar',
  jugada: 'Jugada',
  descansa: 'Descansa'
}

/* Una fila de equipo dentro de la tarjeta. `ganador` solo se pasa en las partidas
   jugadas: en las pendientes NADIE va resaltado, que es lo que evita sugerir un favorito
   donde todavía no se jugó nada. */
function FilaEquipo({
  nombre,
  marcador,
  ganador
}: {
  nombre: string
  marcador: number | null
  ganador: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      {/* `min-w-0` + `break-words`: la misma defensa que documenta la celda de equipo de
          Clasificacion.tsx. Los nombres los escribe un capitán al registrarse y no tienen
          tope de largo; un flex item arranca en `min-width: auto`, así que una sola palabra
          muy larga no se parte, empuja el ancho mínimo de la tarjeta y mete scroll
          horizontal a 375px. Hoy el token más largo es «BreakersStorm» y entra de sobra:
          esto es el guardarraíl, no un arreglo. */}
      <span
        className={`flex min-w-0 items-baseline gap-2 break-words ${ganador ? 'text-white' : 'text-gray-300'}`}
      >
        {nombre}
        {ganador && (
          <>
            <span className="sr-only">(ganó)</span>
            <Check className="h-4 w-4 shrink-0 self-center text-lqc-accent" aria-hidden="true" />
          </>
        )}
      </span>
      {/* `!== null` y no un truthy: un 0 es un marcador válido y con `&&` desaparecería. */}
      {marcador !== null && (
        <span className={`shrink-0 tabular-nums ${ganador ? 'text-white' : 'text-gray-400'}`}>
          {marcador}
        </span>
      )}
    </div>
  )
}

function Tarjeta({ partida }: { partida: PartidaBracket }) {
  const estado = estadoDe(partida)

  return (
    <li className="rounded-2xl border border-white/5 bg-black/30 p-5 backdrop-blur-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs uppercase tracking-wide text-gray-400">
          Partida {partida.matchNumber}
        </span>
        <span className={CHIP[estado]}>{ETIQUETA[estado]}</span>
      </div>

      <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
        {estado === 'descansa' ? (
          <>
            <div className="break-words text-gray-100">{equipoQueDescansa(partida)}</div>
            {/* El BYE NO es «no pasó nada»: comprobado contra el endpoint de
                clasificación el 2026-09-15, suma una victoria y 3 puntos igual que
                ganar. Los tres equipos que descansaron aparecen en la tabla con una
                victoria más de las que tienen en el bracket. Sin esta línea, alguien
                que compare las dos secciones concluye que una de las dos miente. */}
            <div className="text-sm text-gray-400">Sin rival · cuenta como victoria</div>
          </>
        ) : (
          <>
            <FilaEquipo
              nombre={partida.team1}
              marcador={partida.score1}
              ganador={partida.winner === partida.team1}
            />
            <FilaEquipo
              nombre={partida.team2}
              marcador={partida.score2}
              ganador={partida.winner === partida.team2}
            />
          </>
        )}
      </div>
    </li>
  )
}

/* Esqueleto con la misma grilla y alto aproximado que las tarjetas reales, para que al
   llegar los datos no salte el layout. Molde de `EsqueletoTabla` en Clasificacion.tsx:
   `role="status"`, el texto en `sr-only` y las cajas con `aria-hidden`. */
function Esqueleto() {
  return (
    <div role="status">
      <span className="sr-only">Cargando los emparejamientos…</span>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]"
          />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Componente                                                         */
/* ------------------------------------------------------------------ */

export default function Emparejamientos({
  partidas,
  cargando
}: {
  partidas: PartidaBracket[] | null
  cargando: boolean
}) {
  const ronda = partidas === null ? null : rondaAMostrar(partidas)

  const deLaRonda =
    partidas === null || ronda === null
      ? []
      : partidas
          .filter((p) => p.round === ronda)
          /* `sort` muta, pero muta el arreglo NUEVO que devolvió `filter`, no el que
             viene del estado de React. Si alguna vez se saca el filter, hace falta un
             `.slice()` antes del sort. */
          .sort((a, b) => a.matchNumber - b.matchNumber)

  /* Sin partidas y sin carga en curso no se pinta NADA: ni <section>, ni encabezado, ni
     aviso. Son dos casos: la API falló, o respondió sin una sola partida.
     NO hay un tercero por filas descartadas: `rondaAMostrar` deriva la ronda de las filas
     que SOBREVIVIERON, así que mientras quede alguna, su ronda tiene al menos una. */
  if (deLaRonda.length === 0 && !cargando) return null

  const porJugar = deLaRonda.filter((p) => estadoDe(p) === 'por-jugar').length
  const jugadas = deLaRonda.filter((p) => estadoDe(p) === 'jugada').length
  const descansan = deLaRonda.filter((p) => estadoDe(p) === 'descansa').length

  /* El resumen se arma con lo que hay: un cero no se nombra. Con la ronda entera cerrada
     queda «Ronda 3 · 9 jugadas · 1 sin rival», y la ausencia de «por jugar» es la señal de
     que eso son resultados — no hace falta una etiqueta aparte que lo diga.
     «sin rival» y no «descansa»: los otros dos son sintagmas nominales y un verbo
     conjugado en el medio se lee mal, además de que así repite el copy de la tarjeta. */
  const resumen = [
    ronda === null ? null : `Ronda ${ronda}`,
    porJugar > 0 ? `${porJugar} por jugar` : null,
    jugadas > 0 ? contar(jugadas, 'jugada', 'jugadas') : null,
    descansan > 0 ? `${descansan} sin rival` : null
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="pb-20">
      <div className="container mx-auto px-6 max-w-4xl">
        {/* Mismo encabezado de sección que «Clasificación» e «Historial de Temporadas»:
            barra vertical en degradado + <h2> liviano. Con una diferencia: `mb-8` y no el
            `mb-12` de aquellas, porque la caja del título acá es más alta —lleva el resumen
            debajo— y con `mb-12` el aire hasta las tarjetas se duplicaba.
            El resumen va ANIDADO junto al
            <h2> dentro del flex, no como hermano de la fila: así hereda la alineación
            del título sin un padding izquierdo a ojo que se desincroniza al primer
            retoque del ancho de la barra.
            El <h2> dice «Emparejamientos» y no «Ronda 3» para que no cambie de texto
            cuando llegan los datos: el número de ronda vive en el resumen, que
            simplemente no está mientras se carga. */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
          <div>
            <h2 className="text-3xl font-light">Emparejamientos</h2>
            {deLaRonda.length > 0 && <p className="mt-1 text-sm text-gray-400">{resumen}</p>}
          </div>
        </div>

        {deLaRonda.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {deLaRonda.map((p) => (
              <Tarjeta key={p.id} partida={p} />
            ))}
          </ul>
        ) : (
          <Esqueleto />
        )}
      </div>
    </section>
  )
}
