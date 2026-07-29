import { Trophy, Calendar, Star } from 'lucide-react'
import { useState } from 'react'

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

        {/* Próxima temporada CTA */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-4xl text-center">
            <div className="bg-gradient-to-br from-blue-950/30 to-lqc-900/20 backdrop-blur-md border border-blue-800/20 rounded-3xl p-12 shadow-2xl shadow-black/50">
              <h2 className="text-3xl font-light mb-6">Próxima Temporada</h2>
              {/* Decía «Invierno 2026», que no era la temporada siguiente sino ESTA misma con
                  otro nombre, según confirmaron los organizadores.
                  El encabezado «Próxima» es correcto mientras la temporada no arranque, pero
                  CADUCA SOLO: los organizadores dicen que la liga empieza el 25/08/2026, así
                  que a partir de esa fecha hay que cambiarlo a mano por «Temporada Actual».
                  Nada en el código avisa cuando eso pase. */}
              <p className="text-xl text-gray-300 mb-10">Otoño 2026 • ¡Prepárate!</p>

              {/* En ESTA tarjeta ya no hay cifras (el historial de arriba sí tiene, y son de
                  temporadas cerradas). Las tres que había acá se fueron por lo mismo: eran
                  datos hardcodeados sin fuente, anunciando una temporada que no arrancó.
                  «Enero / Inicio» se fue primero, y ese sí se sabía FALSO: la liga empieza el
                  25/08/2026 según los organizadores, así que una temporada de otoño que
                  arrancaba en enero se contradecía con su propio nombre.
                  «$50K+ Premios» contradecía al reglamento publicado, que dice «Premiación:
                  Por definir»: el sitio prometía un monto que el documento oficial no promete.
                  «20+ Equipos» no se sabe falso, pero tampoco tiene de dónde salir.
                  Se borró el contenedor entero y no solo los números: una caja de stats vacía
                  es peor que no tenerla. Vuelve con cifras que tengan fuente, y anotándola. */}
              <div className="flex flex-wrap justify-center gap-6">
                <button className="px-10 py-4 bg-black/50 border border-blue-800/40 text-gray-200 rounded-xl hover:bg-blue-900/30 transition-all duration-300">
                  Notificarme
                </button>
                <button className="px-10 py-4 bg-gradient-to-r from-lqc-700 to-lqc-500 rounded-xl hover:from-lqc-600 hover:to-lqc-400 transition-all duration-300 shadow-lg shadow-blue-900/30">
                  Ver detalles
                </button>
              </div>
            </div>
          </div>
        </section>
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