import { Link } from 'react-router-dom'
import type { FilaClasificacion, TorneoAtak } from '../lib/atak'

/* Clasificación en vivo del split, leída de la API pública de ATAK.GG.

   Vive como componente compartido y no dentro de una página porque la pintan DOS
   —Torneos (tabla completa) y Home (bloque compacto)— con el mismo agrupado de empates
   y la misma degradación. Copiarlo en las dos es el defecto que el repo ya arrastra con
   CLASE_CTA_PRIMARIO, duplicada en Home.tsx y Torneos.tsx con un comentario que avisa
   «si se retoca una hay que mirar la otra».

   Es SOLO PRESENTACIÓN: no pide nada. El fetch y el sondeo de 30 s viven en
   `src/hooks/useTorneoAtak.ts` y los llama la página, que le pasa el resultado por
   props. Está separado así porque en Torneos el mismo dato lo comparten la tabla y el
   conteo de equipos del bloque destacado, y porque eslint prohíbe exportar un hook
   desde un archivo que también exporta un componente (rompe Fast Refresh).

   REGLA DE DEGRADACIÓN, que es lo que manda acá: si la API falla, la sección
   DESAPARECE EN SILENCIO. Nada de tarjeta roja tipo `ErrorGaleria`, nada de «no se
   pudieron cargar los datos». Es un sitio público en día de partida y un cartel de
   error sobre la clasificación es peor que no tener la sección. Por eso el <section>
   y el <h2> viven ACÁ adentro y no en las páginas: si vivieran allá quedaría un
   encabezado colgado sobre un hueco, que es justo lo que el comentario de Home.tsx
   marca como peor opción.

   Lo ÚNICO que se ve mientras no hay datos es el esqueleto de la primera carga. */

/* Tope del bloque compacto de la portada. Pasado ese número, el grupo puntero se
   RESUME en una frase en vez de nombrar equipos: una lista de doce nombres deja de
   ser un resumen, y recortarla a los primeros publicaría un corte dentro de un
   empate, que es exactamente lo que esta pantalla evita. */
const TOPE_GRUPO_PUNTERO = 8

/* ------------------------------------------------------------------ */
/*  Empates                                                            */
/* ------------------------------------------------------------------ */

type FilaMarcada = {
  fila: FilaClasificacion
  /* El número a imprimir, o `null` si esta fila empata con la de arriba y lleva «=». */
  numero: number | null
  /* El puesto del grupo al que pertenece; es lo que lee un lector de pantalla en las
     filas que muestran «=», para que el empate se oiga y no solo se vea. */
  puestoGrupo: number
  /* Índice del grupo de PUNTOS —no de récord—, que es lo que alterna el tinte. */
  grupoPuntos: number
  /* Primera fila de su grupo de puntos: lleva la línea divisoria de arriba. */
  abreGrupoPuntos: boolean
}

/* Ordena y marca los empates. Son las dos decisiones que evitan publicar un ranking
   que no existe, así que van juntas y explicadas:

   1. SE REORDENA, a propósito. ATAK numera las filas 1…19 de corrido y dentro de un
      mismo puntaje NO agrupa por récord: al 2026-09-15, RAKU (1-2) le queda en medio
      a ocho equipos de 1-1. Respetando ese orden, dos equipos con el MISMO récord
      terminarían con números distintos —uno 7º y el otro 13º—, que es exactamente el
      ranking inventado que esta pantalla existe para no publicar. Se ordena por
      puntos descendente y, a igual puntaje, por derrotas ascendente: menos derrotas
      con los mismos puntos es menos partidos jugados, o sea mejor. `sort` es estable
      desde ES2019, así que dentro de un mismo récord se conserva el orden de ATAK,
      que es su desempate y no lo conocemos.

   2. EL NÚMERO SE SUPRIME EN EL EMPATE, y dos filas empatan cuando su renglón entero
      es idéntico: mismos PUNTOS y mismo RÉCORD V-D. Agrupar solo por puntos metería a
      un 2-1 en el mismo cajón que los 2-0 —en suizo a 3 puntos por victoria `points`
      es 3 × `wins` y no sabe nada de las derrotas—, y agrupar solo por récord dejaría
      empatadas a dos filas con puntajes distintos el día que los puntos dejen de salir
      de las victorias. Solo la primera fila de cada grupo lleva número; las demás
      llevan «=». El tinte de fondo sí alterna por PUNTOS, que es la lectura gruesa.

      La tercera clave del sort (`b.wins - a.wins`) no cambia NADA con los datos de hoy
      —verificado: salida idéntica con y sin ella— y está por lo mismo que la condición
      de `points`: sin ella, `(puntos, derrotas)` no es una clave total, y filas con la
      misma terna pueden quedar SEPARADAS por otra que se cuela en el medio. Con
      `[A 1-1 6pts, M 2-1 6pts, B 1-1 6pts]`, A y B —idénticas— salían 1º y 3º. Es el
      ranking inventado que esta función existe para no publicar, y aparecería sin
      romper el build el día que un bye, un walkover o una sanción desacoplen los
      puntos de las victorias. Con 19 equipos hay bye en cada ronda.

   No muta el arreglo que recibe: `filas` viene del estado de React. */
function marcarFilas(filas: FilaClasificacion[]): FilaMarcada[] {
  const ordenadas = [...filas].sort(
    (a, b) => b.points - a.points || a.losses - b.losses || b.wins - a.wins
  )

  let puestoGrupo = 1
  let grupoPuntos = 0

  return ordenadas.map((fila, i) => {
    const previa = ordenadas[i - 1]
    const mismoRecord =
      previa !== undefined &&
      previa.points === fila.points &&
      previa.wins === fila.wins &&
      previa.losses === fila.losses
    const abreGrupoPuntos = previa !== undefined && previa.points !== fila.points

    if (!mismoRecord) puestoGrupo = i + 1
    if (abreGrupoPuntos) grupoPuntos++

    return {
      fila,
      numero: mismoRecord ? null : i + 1,
      puestoGrupo,
      grupoPuntos,
      abreGrupoPuntos
    }
  })
}

/* `key` estable y única: el nombre del equipo alcanzaría hoy, pero nada garantiza que
   ATAK no repita uno, y una `key` duplicada hace que React reutilice la fila
   equivocada al reordenar. */
function clave(fila: FilaClasificacion): string {
  return `${fila.position}-${fila.team}`
}

function contar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/* ------------------------------------------------------------------ */
/*  Piezas compartidas                                                 */
/* ------------------------------------------------------------------ */

/* Mismo encabezado de sección que ya usan «Transmisión en Vivo» (Home) e «Historial
   de Temporadas» (Torneos): barra vertical en degradado + <h2> liviano. */
function Encabezado() {
  return (
    <div className="flex items-center gap-4 mb-12">
      <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
      <h2 className="text-3xl font-light">Clasificación</h2>
    </div>
  )
}

/* El marcador V-D, con la lectura larga para quien no ve la abreviatura. */
function Marcador({ fila }: { fila: FilaClasificacion }) {
  return (
    <>
      <span className="sr-only">
        {contar(fila.wins, 'victoria', 'victorias')},{' '}
        {contar(fila.losses, 'derrota', 'derrotas')}
      </span>
      <span aria-hidden="true">
        {fila.wins}-{fila.losses}
      </span>
    </>
  )
}

/* Esqueletos: misma geometría que el contenido real para que al llegar los datos no
   salte el layout. Molde de `EsqueletoGaleria`: `role="status"`, el texto en
   `sr-only` y las cajas con `aria-hidden` porque no significan nada.
   El número de filas es fijo porque antes de la respuesta no se sabe cuántos equipos
   hay — igual que la galería, que dibuja 8 huecos siempre. */
function EsqueletoTabla({ filas }: { filas: number }) {
  return (
    <div role="status">
      <span className="sr-only">Cargando la clasificación…</span>
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: filas }, (_, i) => (
          <div
            key={i}
            className="h-11 animate-pulse rounded-lg border border-white/5 bg-white/[0.03]"
          />
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Variante completa (Torneos)                                        */
/* ------------------------------------------------------------------ */

const CELDA = 'px-3 py-3 md:px-4'

/* Encabezado de columna: la abreviatura a la vista, la palabra entera para el lector
   de pantalla. Un «V» suelto no se entiende leído en voz alta. */
function Columna({ corto, largo, clase = '' }: { corto: string; largo?: string; clase?: string }) {
  return (
    <th
      scope="col"
      className={`${CELDA} ${clase} font-sans text-xs font-medium uppercase tracking-wide text-gray-400`}
    >
      {largo === undefined ? (
        corto
      ) : (
        <>
          <span className="sr-only">{largo}</span>
          <span aria-hidden="true">{corto}</span>
        </>
      )}
    </th>
  )
}

function TablaCompleta({ standings }: { standings: FilaClasificacion[] }) {
  const marcadas = marcarFilas(standings)

  return (
    <>
      {/* Un <table> de verdad y no una grilla de <div>: es dato tabular, y es lo que
          deja que un lector de pantalla anuncie «Equipo, Mythical Dragons. Victorias,
          2» en vez de leer cinco números sueltos. Es la primera tabla del sitio.
          El borde redondeado vive en el contenedor con `overflow-hidden`: aplicárselo
          a la <table> deja las esquinas de las celdas asomando. Ese `overflow-hidden`
          RECORTA en vez de scrollear, así que el nombre del equipo lleva `break-words`:
          los nombres vienen de una API ajena y no tienen tope de largo, y uno de una
          sola palabra muy larga empujaría el ancho mínimo de la tabla hasta cortar la
          columna «Pts», que quedaría inalcanzable. */}
      <div className="overflow-hidden rounded-3xl border border-blue-800/20 bg-black/30 shadow-2xl shadow-black/50 backdrop-blur-md">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">
            Clasificación del Split Otoño 2026. Los equipos con el mismo récord comparten
            puesto: solo el primero de cada grupo lleva número.
          </caption>
          <thead>
            <tr className="border-b border-blue-800/30">
              <Columna corto="#" largo="Puesto" clase="w-14 text-center" />
              <Columna corto="Equipo" />
              <Columna corto="V" largo="Victorias" clase="w-12 text-center" />
              <Columna corto="D" largo="Derrotas" clase="w-12 text-center" />
              <Columna corto="Pts" largo="Puntos" clase="w-16 text-center" />
            </tr>
          </thead>
          <tbody>
            {marcadas.map(({ fila, numero, puestoGrupo, grupoPuntos, abreGrupoPuntos }) => (
              <tr
                key={clave(fila)}
                className={[
                  /* El tinte alterna por grupo de PUNTOS y arranca encendido, así el
                     grupo puntero queda destacado sin necesidad de un caso especial
                     que diga «el primero va distinto». */
                  grupoPuntos % 2 === 0 ? 'bg-blue-950/20' : 'bg-transparent',
                  abreGrupoPuntos ? 'border-t border-blue-800/25' : ''
                ].join(' ')}
              >
                <td className={`${CELDA} text-center text-sm tabular-nums`}>
                  {numero !== null ? (
                    <span className="text-gray-300">{numero}º</span>
                  ) : (
                    <>
                      <span className="sr-only">Empatado en el puesto {puestoGrupo}</span>
                      <span aria-hidden="true" className="text-gray-600">
                        =
                      </span>
                    </>
                  )}
                </td>
                <th
                  scope="row"
                  className={`${CELDA} break-words font-sans text-sm font-normal text-gray-100 md:text-base`}
                >
                  {fila.team}
                </th>
                <td className={`${CELDA} text-center text-sm tabular-nums text-gray-400`}>
                  {fila.wins}
                </td>
                <td className={`${CELDA} text-center text-sm tabular-nums text-gray-400`}>
                  {fila.losses}
                </td>
                <td className={`${CELDA} text-center text-sm font-semibold tabular-nums text-white`}>
                  {fila.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* La nota NO es decorativa: sin ella el «=» es un símbolo sin significado, y la
          tabla volvería a leerse como un ranking de 1 a 19. */}
      <p className="mt-4 text-sm leading-relaxed text-gray-400">
        Los equipos con el mismo récord comparten puesto y se marcan con «=». El orden
        dentro de un grupo no es una posición: el desempate lo resuelve el pareo suizo.
      </p>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Variante compacta (Home)                                           */
/* ------------------------------------------------------------------ */

function BloqueCompacto({ standings }: { standings: FilaClasificacion[] }) {
  const marcadas = marcarFilas(standings)
  /* El grupo puntero es el grupo de PUNTOS 0, no «las primeras cinco filas». Hoy son
     seis equipos con 6 pts —cinco de 2-0 y uno de 2-1— y cortar en cinco partiría un
     empate al medio, publicando un quinto y un sexto puesto que la liga no declaró. */
  const punteros = marcadas.filter((m) => m.grupoPuntos === 0)
  const puntos = punteros[0]?.fila.points ?? 0
  const resto = standings.length - punteros.length
  const resumir = punteros.length > TOPE_GRUPO_PUNTERO

  return (
    <div className="rounded-3xl border border-blue-800/20 bg-gradient-to-br from-blue-950/30 to-lqc-900/20 p-8 shadow-2xl shadow-black/50 backdrop-blur-md md:p-10">
      {/* «N equipos en la punta», NO «N equipos empatados». El grupo puntero se arma por
          PUNTOS, y por puntos hoy entran cinco 2-0 y un 2-1: llamarlos empatados diría
          justo lo contrario de lo que la tabla de /torneos declara a dos clics —allá el
          2-1 lleva su propio número porque su récord es distinto—. Las dos pantallas se
          contradecirían, y la que más se ve es esta. El «— N pts» ya dice qué comparten;
          el récord de cada uno está a la derecha de su nombre. */}
      <p className="text-sm uppercase tracking-wide text-lqc-accent">
        {punteros.length === 1
          ? `Líder — ${puntos} pts`
          : `${contar(punteros.length, 'equipo', 'equipos')} en la punta — ${puntos} pts`}
      </p>

      {/* Pasado el tope NO se nombra a nadie: cualquier subconjunto sería un recorte
          arbitrario dentro del empate, que es justo lo que este bloque existe para no
          hacer. Queda el renglón de arriba —que ya dice cuántos son y con cuántos
          puntos— y el enlace a la tabla completa. No va un párrafo explicando lo mismo
          con otras palabras: sería la misma frase dos veces seguidas. */}
      {resumir ? null : (
        <ul className="mt-5 grid grid-cols-1 gap-x-10 sm:grid-cols-2">
          {punteros.map(({ fila }) => (
            <li
              key={clave(fila)}
              className="flex items-baseline justify-between gap-4 border-b border-white/5 py-2.5"
            >
              <span className="text-gray-100">{fila.team}</span>
              <span className="shrink-0 text-sm tabular-nums text-gray-400">
                <Marcador fila={fila} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        {resto > 0 && (
          <p className="text-sm text-gray-400">+ {contar(resto, 'equipo', 'equipos')}</p>
        )}
        {/* Enlace de texto, no un CTA: la acción primaria de la portada no es esta.
            Conserva a propósito el color y la barra de `a::after` de index.css, que es
            para lo que están pensados. */}
        <Link to="/torneos" className="ml-auto text-sm">
          Ver clasificación completa →
        </Link>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Componente                                                         */
/* ------------------------------------------------------------------ */

/* `torneo` y `cargando` llegan por props y NO se piden acá: los pide la página con
   `useTorneoAtak()`, porque en Torneos el mismo dato lo comparte la fila de metadatos
   del split. Este componente es solo presentación. */
export default function Clasificacion({
  variante,
  torneo,
  cargando
}: {
  variante: 'completa' | 'compacta'
  torneo: TorneoAtak | null
  cargando: boolean
}) {
  const completa = variante === 'completa'
  /* `some(...)` y no `length > 0`: un split recién sembrado puede devolver las 19 filas
     en 0-0 y 0 pts. Eso no es una clasificación, es la lista de inscritos con ceros — y
     pintada dejaría a los 19 equipos compartiendo el 1º puesto y a la portada diciendo
     «19 equipos en la punta — 0 pts». Alcanza con que UNO haya jugado. */
  const hayDatos =
    torneo !== null && torneo.standings.some((f) => f.wins + f.losses > 0)

  /* Sin datos y sin carga en curso, no se pinta NADA: ni <section>, ni encabezado, ni
     aviso. La página queda como si esta sección no existiera. Cubre los tres casos: la
     API falló, `standings` vino vacío, o el torneo no jugó todavía ninguna jornada.
     Un <h2> sobre un contenedor vacío es peor que no tener la sección. */
  if (!hayDatos && !cargando) return null

  return (
    <section className={completa ? 'pb-20' : 'py-20 bg-black/20'}>
      <div className="container mx-auto px-6 max-w-4xl">
        <Encabezado />
        {hayDatos ? (
          completa ? (
            <TablaCompleta standings={torneo.standings} />
          ) : (
            <BloqueCompacto standings={torneo.standings} />
          )
        ) : (
          <EsqueletoTabla filas={completa ? 10 : 6} />
        )}
      </div>
    </section>
  )
}
