import { Link } from 'react-router-dom'
import { Trophy, Calendar, Star, Users, UserPlus, ChevronRight } from 'lucide-react'
import { useState } from 'react'

/* TERCERA copia de este helper (las otras están en Home.tsx y Footer.tsx). React Router en
   modo declarativo no resetea el scroll y el proyecto no tiene <ScrollRestoration>, así que
   un <Link> pulsado con la página scrolleada aterriza en mitad del destino. Hace falta acá
   porque el bloque destacado vive DEBAJO de un hero de `py-32 md:py-40`: quien pulsa
   «Registrarme» ya está ~500px abajo, y sin esto /registro abre a esa misma altura, con el
   formulario empezado.
   El comentario de Home.tsx dice que al aparecer un tercer lugar conviene extraerlo a un
   módulo compartido. Este ES el tercero, pero el cambio se limitó a Torneos.tsx, así que
   queda anotado en vez de hecho. */
const irAlTope = () => window.scrollTo({ top: 0 })

/* Los dos CTA del bloque destacado, con el canon de AGENTS.md. Son copia de las constantes
   homónimas de Home.tsx —no están exportadas allá y el cambio no podía tocar ese archivo—,
   así que si se retoca una hay que mirar la otra.
   Lo que un <a>/<Link> necesita y un <button> no: `text-white` explícito, porque la regla base
   `a { color: #66a3ff }` de index.css le pisaría el texto y el contraste sobre azul se caería;
   el anillo de foco, que index.css solo le da a <button>; y `after:hidden`, que mata la barra
   de gradiente de `a::after` —pensada para enlaces de texto— que en un botón queda colgando.
   `outline-hidden` y no `outline-none`: en Tailwind 4 este último compila a `outline-style:
   none` a secas, y como el anillo es un `box-shadow` que el modo de alto contraste de Windows
   no pinta, el foco desaparecería del todo ahí. */
const CLASE_CTA_PRIMARIO =
  'after:hidden inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl ' +
  'bg-gradient-to-r from-lqc-700 to-lqc-500 hover:from-lqc-600 hover:to-lqc-400 ' +
  'font-medium text-white transition-all duration-300 shadow-lg shadow-blue-900/30 ' +
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lqc-accent/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-black'

/* Secundario. `bg-none` en un <a> no hace nada —el gradiente que AGENTS.md manda desactivar en
   los secundarios vive en `button { background: var(--gradient-primary) }`— pero va puesto por
   si alguien pega esta constante en un <button>, que es el caso que el documento describe.
   Lo que sí hace falta en un <a> es `text-gray-200`, que pisa el color base de los enlaces. */
const CLASE_CTA_SECUNDARIO =
  'after:hidden inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl ' +
  'bg-none bg-black/40 border border-blue-800/40 text-gray-200 ' +
  'hover:bg-blue-950/40 hover:border-blue-600/60 hover:text-white ' +
  'font-medium transition-all duration-300 ' +
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lqc-accent/60 ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-black'

export default function Torneos() {
  const [activeSeason, setActiveSeason] = useState("Otoño 2025")

  const tournaments = [
    {
      id: 1,
      name: "LQC Otoño 2025",
      season: "Otoño 2025",
      date: "Octubre - Diciembre 2025",
      participants: 24,
      prizePool: "$45,000 MXN",
      champion: "Galaxy Gaming",
      finalist: "CROW GAMING",
      status: "Finalizado",
      stats: {
        matches: 156,
        viewers: "12.5K",
        duration: "8 semanas"
      }
    },
    {
      id: 2,
      name: "LQC Verano 2025",
      season: "Verano 2025",
      date: "Julio - Septiembre 2025",
      participants: 20,
      prizePool: "$40,000 MXN",
      champion: "CROW GAMING",
      finalist: "Galaxy Gaming",
      status: "Finalizado",
      stats: {
        matches: 132,
        viewers: "10.2K",
        duration: "7 semanas"
      }
    },
    {
      id: 3,
      name: "LQC Primavera 2025",
      season: "Primavera 2025",
      date: "Marzo - Junio 2025",
      participants: 18,
      prizePool: "$35,000 MXN",
      champion: "Querétaro Warriors",
      finalist: "CROW GAMING",
      status: "Finalizado",
      stats: {
        matches: 120,
        viewers: "8.7K",
        duration: "6 semanas"
      }
    }
  ]

  const currentTournament = tournaments.find(t => t.season === activeSeason) || tournaments[0]

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white">
      {/* Fondo decorativo sutil - igual que Home */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="h-full w-full bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:30px_30px]" />
        </div>
        <img
          src="/assets/LOGO COPA.png"
          alt="LQC Trophy Logo"
          className="
            absolute 
            -left-[60%] sm:-left-[40%] md:-left-[30%] lg:-left-[20%] xl:-left-[10%]
            top-[10%] sm:top-[5%]
            w-[110%] sm:w-[90%] md:w-[80%] lg:w-[70%] xl:w-[60%]
            max-w-none opacity-10
            animate-float-slow pointer-events-none blur-[1px]
          "
        />
      </div>

      <div className="relative z-10">
        {/* Hero */}
        <section className="py-32 md:py-40">
          <div className="container mx-auto px-6 max-w-5xl text-center">
            <div className="flex flex-col items-center gap-6">
              <div className="flex items-center justify-center gap-6 flex-wrap">
                <img
                  src="/assets/2 LQC.png"
                  alt="LQC Logo"
                  className="h-24 md:h-32 w-auto object-contain drop-shadow-xl"
                />
                <Trophy className="w-20 md:w-28 h-20 md:h-28 text-blue-500 opacity-80" />
              </div>

              <h1 className="text-5xl md:text-7xl font-extralight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-lqc-accent">
                Archivo de Torneos
              </h1>

              <p className="text-xl text-gray-300 max-w-3xl mt-6 leading-relaxed">
                Revive campeones, resultados y momentos históricos de todas las temporadas del League Querétaro Championship.
              </p>

              <div className="inline-flex items-center gap-4 mt-8">
                <span className="px-6 py-2.5 text-base bg-blue-950/40 text-blue-300 backdrop-blur-sm border border-blue-800/30 rounded-full shadow-lg">
                  Histórico Completo
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* SPLIT ACTUAL. Va acá, pegado al hero y ANTES de todo lo demás, porque es el único
            torneo del presente: el selector, el podio y el historial que siguen son archivo.
            Sin `py` propio arriba —el hero ya trae `py-32 md:py-40` de sobra— y con `pb-20`
            abajo para despegarse de la banda tintada del selector.
            Reusa la tarjeta de gradiente que AGENTS.md marca como canon, que es la misma que
            llevaba la sección «Próxima Temporada» del final: esa se eliminó y su tratamiento
            se muda acá, así que la página no pierde el bloque destacado, lo asciende.
            Sin campeón ni subcampeón, a diferencia de las tarjetas del historial: el torneo
            está en curso y todavía no hay podio que mostrar. */}
        <section className="pb-20">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="bg-gradient-to-br from-blue-950/30 to-lqc-900/20 backdrop-blur-md border border-blue-800/20 rounded-3xl p-8 md:p-12 shadow-2xl shadow-black/50 text-center">
              {/* El badge tiene que leerse como lo OPUESTO al «Finalizado» gris de las tarjetas
                  del historial (`bg-gray-800/80`, sin movimiento). Va en verde y no en azul por
                  dos razones: el verde es el código que el sitio YA usa para «pasando ahora»
                  —es el mismo `bg-green-950/50 / text-green-300 / border-green-800/40` del
                  badge «EN VIVO» de la portada— y porque un azul más en esta página, que es
                  azul de arriba a abajo, no se distinguiría de nada.
                  El punto lleva dos capas: una fija y otra que se expande con `animate-ping`.
                  Eso es lo que da la sensación de latido; la regla global de
                  `prefers-reduced-motion` de index.css ya la desactiva sola.
                  El texto va en minúsculas en el JSX y lo pone en caja alta el `uppercase`, así
                  un lector de pantalla lee la frase y no deletrea las mayúsculas.
                  OJO: «Inscripciones abiertas» no sale de ningún dato del repo —nada acá
                  registra el estado de la convocatoria—, es el mensaje de la campaña. Ya está
                  escrito a mano en la portada (Home.tsx, bajo el CTA del hero); ahora son DOS
                  lugares que hay que borrar a mano el día que las inscripciones cierren. */}
              <div className="inline-flex items-center gap-2.5 rounded-full border border-green-800/40 bg-green-950/50 px-4 py-1.5 text-sm font-medium uppercase tracking-wide text-green-300 shadow-lg shadow-green-900/20">
                <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-400" />
                </span>
                Inscripciones abiertas
              </div>

              <h2 className="mt-6 text-3xl md:text-5xl font-light">LQC Split Otoño 2026</h2>

              {/* Los dos datos duros, con el mismo separador «•» que ya usan las filas de
                  metadatos de esta página. El punto va con `aria-hidden`: es decoración, y sin
                  eso un lector de pantalla lo lee como «bala» entre dos frases.
                  «Hasta 32 equipos» dice el TECHO y no un conteo: no hay nada en el repo que
                  sepa cuántos equipos van inscritos, y un número en vivo pediría una fuente. */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-gray-300">
                <span className="inline-flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
                  25 de agosto — 28 de noviembre 2026
                </span>
                <span className="text-gray-600" aria-hidden="true">•</span>
                <span className="inline-flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
                  Hasta 32 equipos
                </span>
              </div>

              {/* Apilados en móvil y en fila desde `sm`. `w-full sm:w-auto` para que apilados
                  midan lo mismo: con el ancho por contenido, «Registrarme» y «Ver en ATAK»
                  quedarían de anchos distintos, uno debajo del otro y centrados, que se lee
                  como un error de maquetación. */}
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/registro" onClick={irAlTope} className={`${CLASE_CTA_PRIMARIO} w-full sm:w-auto`}>
                  <UserPlus className="w-5 h-5 shrink-0" aria-hidden="true" />
                  Registrarme
                  <ChevronRight className="w-5 h-5 shrink-0" aria-hidden="true" />
                </Link>
                {/* El aria-label arranca con el texto visible EXACTO para no romper el control
                    por voz (WCAG 2.5.3, «Label in Name») y recién después avisa lo que el texto
                    no dice. Misma fórmula que los enlaces externos del footer y del header. */}
                <a
                  href="https://atakgg.revolution505.com/tournaments/lqc-2026"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Ver en ATAK (abre en pestaña nueva)"
                  className={`${CLASE_CTA_SECUNDARIO} w-full sm:w-auto`}
                >
                  <Trophy className="w-5 h-5 shrink-0" aria-hidden="true" />
                  Ver en ATAK
                  <ChevronRight className="w-5 h-5 shrink-0" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Selector de Temporada */}
        <section className="py-16 bg-black/20">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="flex flex-col items-center gap-6">
              <div className="flex items-center gap-4">
                <Calendar className="w-6 h-6 text-blue-400" />
                <h2 className="text-2xl font-light">Seleccionar Temporada</h2>
              </div>

              <div className="flex flex-wrap justify-center gap-4">
                {tournaments.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveSeason(t.season)}
                    className={`
                      px-6 py-3 text-sm font-medium rounded-full transition-all duration-300 backdrop-blur-sm border
                      ${activeSeason === t.season
                        ? 'bg-blue-900/30 border-blue-600 text-white shadow-lg shadow-blue-900/30'
                        : 'bg-black/30 border-white/10 text-gray-300 hover:border-blue-500/50 hover:text-white'
                      }
                    `}
                  >
                    {t.season}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Info principal del torneo seleccionado */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-light mb-4">{currentTournament.name}</h2>
              <div className="flex flex-wrap justify-center gap-6 text-gray-400">
                <span>{currentTournament.date}</span>
                <span>•</span>
                <span>{currentTournament.participants} equipos</span>
                <span>•</span>
                <span className="text-blue-400 font-medium">{currentTournament.prizePool}</span>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-8 mb-16">
              <div className="bg-black/30 backdrop-blur-sm p-6 rounded-2xl border border-white/5 text-center">
                <div className="text-4xl font-light text-white mb-2">{currentTournament.stats.matches}</div>
                <div className="text-sm text-gray-400 uppercase tracking-wider">Partidos</div>
              </div>
              <div className="bg-black/30 backdrop-blur-sm p-6 rounded-2xl border border-white/5 text-center">
                <div className="text-4xl font-light text-white mb-2">{currentTournament.stats.viewers}</div>
                <div className="text-sm text-gray-400 uppercase tracking-wider">Espectadores pico</div>
              </div>
              <div className="bg-black/30 backdrop-blur-sm p-6 rounded-2xl border border-white/5 text-center">
                <div className="text-4xl font-light text-white mb-2">{currentTournament.stats.duration}</div>
                <div className="text-sm text-gray-400 uppercase tracking-wider">Duración</div>
              </div>
              <div className="bg-black/30 backdrop-blur-sm p-6 rounded-2xl border border-white/5 text-center">
                <div className="text-4xl font-light text-white mb-2">{currentTournament.participants}</div>
                <div className="text-sm text-gray-400 uppercase tracking-wider">Equipos</div>
              </div>
            </div>

            {/* Podio */}
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Trophy className="w-6 h-6 text-blue-400" />
                <h3 className="text-xl font-medium">Podio de la Temporada</h3>
              </div>

              <div className="space-y-5">
                <div className="flex items-center gap-5 bg-black/40 backdrop-blur-sm p-5 rounded-xl border border-white/5">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-900/60 to-blue-800/40 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-7 h-7 text-blue-300" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-400">Campeón</div>
                    <div className="text-2xl font-medium">{currentTournament.champion}</div>
                  </div>
                  <div className="text-lg font-bold text-yellow-400">1°</div>
                </div>

                <div className="flex items-center gap-5 bg-black/30 backdrop-blur-sm p-5 rounded-xl border border-white/5">
                  <div className="w-14 h-14 rounded-full bg-gray-800/50 flex items-center justify-center flex-shrink-0">
                    <Star className="w-7 h-7 text-gray-300" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-400">Subcampeón</div>
                    <div className="text-xl text-gray-200">{currentTournament.finalist}</div>
                  </div>
                  <div className="text-lg font-bold text-gray-400">2°</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ACÁ NO HAY PESTAÑAS "Brackets / Clasificaciones / Estadísticas". Eran una barra de
            tabs sobre iframes de Battlefy, y se fueron las dos cosas: sin embeds, la barra no
            tenía nada que mostrar (y «Estadísticas» ya estaba `disabled` desde antes, o sea
            que de las tres pestañas ninguna llevaba a contenido vivo).
            Con ellas se fueron los arrays de embeds y los estados activeTab / activeBracket /
            activeStanding, que existían solo para elegir qué iframe pintar.
            Lo de arriba y lo de abajo NO dependía de eso y sigue igual: el selector de
            temporada, `currentTournament`, las tarjetas de stats, el podio y este historial
            salen del array `tournaments`, que es local (el CTA de más abajo está hardcodeado
            en el JSX, ni siquiera pasa por ahí).
            Cuando ATAK exponga brackets y clasificaciones, la barra vuelve con contenido
            detrás — no antes. */}

        {/* Historial resumido */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
              <h2 className="text-3xl font-light">Historial de Temporadas</h2>
            </div>

            <div className="space-y-10">
              {tournaments.map((t) => (
                <div
                  key={t.id}
                  className="bg-black/30 backdrop-blur-sm p-8 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all duration-300"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-4 mb-3">
                        <h3 className="text-2xl font-medium">{t.name}</h3>
                        <span className="px-3 py-1 text-xs bg-gray-800/80 text-gray-300 rounded-full">
                          {t.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                        <span>{t.date}</span>
                        <span>•</span>
                        <span>{t.participants} equipos</span>
                        <span>•</span>
                        <span className="text-blue-400">{t.prizePool}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-8 text-sm">
                      <div>
                        <div className="text-gray-400">Campeón</div>
                        <div className="text-white font-medium">{t.champion}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Subcampeón</div>
                        <div className="text-gray-300">{t.finalist}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ACÁ NO HAY UNA SECCIÓN «PRÓXIMA TEMPORADA». Se fue entera, y la reemplaza el bloque
            del split actual que ahora abre la página, arriba del selector. Tres razones:
            1. Anunciaba «Otoño 2026 • ¡Prepárate!», que es EXACTAMENTE el mismo torneo que el
               bloque de arriba. Dejar las dos era la misma temporada contada dos veces y con
               distinto estado —una «próxima», la otra con inscripciones abiertas—, que es una
               contradicción a la vista del mismo scroll.
            2. Su encabezado caducaba solo. El comentario que vivía acá lo decía: la liga
               empieza el 25/08/2026 según los organizadores, así que a partir de esa fecha
               «Próxima» pasaba a ser falso y había que cambiarlo a mano. El bloque nuevo no
               tiene ese problema porque no se llama «próxima» ni «actual»: se llama por su
               nombre y muestra sus fechas.
            3. Sus dos botones no llevaban a ningún lado. Eran <button> sin `onClick`:
               «Notificarme» no notificaba nada —no hay lista de correo en el proyecto— y «Ver
               detalles» no tenía detalles que abrir. Los dos del bloque nuevo sí navegan: uno
               a /registro y el otro al torneo en ATAK.
            Lo que NO hay que perder de lo que decía su comentario, porque sigue vigente para
            cualquier cifra que alguien quiera reponer en esta página: acá hubo tres stats
            hardcodeadas sin fuente y se borraron. «Enero / Inicio» era falsa de plano (una
            temporada de otoño que arrancaba en enero se contradecía con su propio nombre).
            «$50K+ Premios» contradecía al reglamento publicado, que dice «Premiación: Por
            definir» — el sitio prometía un monto que el documento oficial no promete. «20+
            Equipos» no se sabía falsa, pero tampoco tenía de dónde salir. La regla que dejaron:
            vuelven con cifras que tengan fuente, y anotándola. Es la misma razón por la que el
            bloque de arriba dice «Hasta 32 equipos» —el techo, que es un dato de reglamento— y
            no un conteo de inscritos, que nadie en el repo sabe. */}
      </div>

      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-40px) rotate(2deg); }
        }
        .animate-float-slow {
          animation: float-slow 14s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}