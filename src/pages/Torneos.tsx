import { Trophy, Calendar, ChevronRight, Star } from 'lucide-react'
import { useState } from 'react'
import Footer from '../components/layout/Footer'

export default function Torneos() {
  const [activeSeason, setActiveSeason] = useState("Otoño 2025")
  const [activeTab, setActiveTab] = useState("brackets")
  const [activeBracket, setActiveBracket] = useState<string>("groups")
  const [activeStanding, setActiveStanding] = useState<string>("groups-standings")

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

  const tournamentEmbeds = [
    {
      id: "teams",
      title: "Equipos Participantes",
      description: "Lista completa de equipos que compitieron",
      src: "https://battlefy.com/embeds/teams/6852287c98498e0084e4cff1",
      height: "680px"
    },
    {
      id: "groups",
      title: "FASE DE GRUPOS - Bracket",
      description: "Enfrentamientos y resultados de la fase regular",
      src: "https://battlefy.com/embeds/6852287c98498e0084e4cff1/stage/68ae011e24d77d05705932ee",
      height: "720px"
    },
    {
      id: "playins",
      title: "Play Ins - Bracket",
      description: "Ronda clasificatoria hacia playoffs",
      src: "https://battlefy.com/embeds/6852287c98498e0084e4cff1/stage/68e259ecb9681c0021c34aec",
      height: "720px"
    },
    {
      id: "top8",
      title: "Top 8 - Eliminación Directa",
      description: "Fase final - bracket decisivo",
      src: "https://battlefy.com/embeds/6852287c98498e0084e4cff1/stage/6900080ca7e3f1002186119f",
      height: "800px"
    }
  ]

  const standingsEmbeds = [
    {
      id: "groups-standings",
      title: "FASE DE GRUPOS - Clasificación",
      src: "https://battlefy.com/embeds/6852287c98498e0084e4cff1/stage/68ae011e24d77d05705932ee/standings",
      height: "680px"
    },
    {
      id: "playins-standings",
      title: "Play Ins - Clasificación",
      src: "https://battlefy.com/embeds/6852287c98498e0084e4cff1/stage/68e259ecb9681c0021c34aec/standings",
      height: "680px"
    },
    {
      id: "top8-standings",
      title: "Top 8 - Clasificación",
      src: "https://battlefy.com/embeds/6852287c98498e0084e4cff1/stage/6900080ca7e3f1002186119f/standings",
      height: "680px"
    }
  ]

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

              <h1 className="text-5xl md:text-7xl font-extralight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-purple-400">
                Archivo de Torneos
              </h1>

              <p className="text-xl text-gray-300 max-w-3xl mt-6 leading-relaxed">
                Revive brackets, clasificaciones y momentos históricos de todas las temporadas del League Querétaro Championship.
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

        {/* Tabs */}
        <section className="py-12 bg-black/20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex justify-center border-b border-white/5">
              <button
                onClick={() => setActiveTab("brackets")}
                className={`
                  px-10 py-4 text-lg font-medium transition-all duration-300 relative
                  ${activeTab === "brackets"
                    ? 'text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-500'
                    : 'text-gray-400 hover:text-gray-200'
                  }
                `}
              >
                Brackets
              </button>
              <button
                onClick={() => setActiveTab("standings")}
                className={`
                  px-10 py-4 text-lg font-medium transition-all duration-300 relative
                  ${activeTab === "standings"
                    ? 'text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-500'
                    : 'text-gray-400 hover:text-gray-200'
                  }
                `}
              >
                Clasificaciones
              </button>
              <button
                className="px-10 py-4 text-lg font-medium text-gray-500 cursor-not-allowed"
                disabled
              >
                Estadísticas
              </button>
            </div>
          </div>
        </section>

        {/* Contenido dinámico - Brackets o Standings */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-6xl">
            {activeTab === "brackets" ? (
              <div className="space-y-12">
                <div className="flex flex-wrap justify-center gap-4">
                  {tournamentEmbeds.map((embed) => (
                    <button
                      key={embed.id}
                      onClick={() => setActiveBracket(embed.id)}
                      className={`
                        px-6 py-3 text-sm font-medium rounded-full transition-all duration-300 backdrop-blur-sm border
                        ${activeBracket === embed.id
                          ? 'bg-blue-900/40 border-blue-600 text-white shadow-lg shadow-blue-900/30'
                          : 'bg-black/30 border-white/10 text-gray-300 hover:border-blue-500/50 hover:text-white'
                        }
                      `}
                    >
                      {embed.title.replace(" - Bracket", "").replace(" - Eliminación Directa", "")}
                    </button>
                  ))}
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-light mb-2">
                      {tournamentEmbeds.find(e => e.id === activeBracket)?.title}
                    </h3>
                    <p className="text-gray-400">
                      {tournamentEmbeds.find(e => e.id === activeBracket)?.description}
                    </p>
                  </div>

                  <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-black/50 backdrop-blur-md border border-white/5">
                    <iframe
                      key={activeBracket}
                      src={tournamentEmbeds.find(e => e.id === activeBracket)?.src}
                      title={tournamentEmbeds.find(e => e.id === activeBracket)?.title}
                      width="100%"
                      height="100%"
                      className="min-h-[700px] md:min-h-[800px] lg:min-h-[900px]"
                      scrolling="yes"
                      frameBorder="0"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-12">
                <div className="flex flex-wrap justify-center gap-4">
                  {standingsEmbeds.map((embed) => (
                    <button
                      key={embed.id}
                      onClick={() => setActiveStanding(embed.id)}
                      className={`
                        px-6 py-3 text-sm font-medium rounded-full transition-all duration-300 backdrop-blur-sm border
                        ${activeStanding === embed.id
                          ? 'bg-blue-900/40 border-blue-600 text-white shadow-lg shadow-blue-900/30'
                          : 'bg-black/30 border-white/10 text-gray-300 hover:border-blue-500/50 hover:text-white'
                        }
                      `}
                    >
                      {embed.title.replace(" - Clasificación", "")}
                    </button>
                  ))}
                </div>

                <div className="space-y-6">
                  <h3 className="text-2xl font-light mb-2">
                    {standingsEmbeds.find(e => e.id === activeStanding)?.title}
                  </h3>

                  <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-black/50 backdrop-blur-md border border-white/5">
                    <iframe
                      key={activeStanding}
                      src={standingsEmbeds.find(e => e.id === activeStanding)?.src}
                      title={standingsEmbeds.find(e => e.id === activeStanding)?.title}
                      width="100%"
                      height="100%"
                      className="min-h-[700px] md:min-h-[800px] lg:min-h-[900px]"
                      scrolling="yes"
                      frameBorder="0"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

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
            <div className="bg-gradient-to-br from-blue-950/30 to-purple-950/20 backdrop-blur-md border border-blue-800/20 rounded-3xl p-12 shadow-2xl shadow-black/50">
              <h2 className="text-3xl font-light mb-6">Próxima Temporada</h2>
              <p className="text-xl text-gray-300 mb-10">Invierno 2026 • ¡Prepárate!</p>

              <div className="flex flex-wrap justify-center gap-12 mb-12">
                <div>
                  <div className="text-4xl font-light text-white">Enero</div>
                  <div className="text-sm text-gray-400">Inicio</div>
                </div>
                <div>
                  <div className="text-4xl font-light text-white">20+</div>
                  <div className="text-sm text-gray-400">Equipos</div>
                </div>
                <div>
                  <div className="text-4xl font-light text-white">$50K+</div>
                  <div className="text-sm text-gray-400">Premios</div>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-6">
                <button className="px-10 py-4 bg-black/50 border border-blue-800/40 text-gray-200 rounded-xl hover:bg-blue-900/30 transition-all duration-300">
                  Notificarme
                </button>
                <button className="px-10 py-4 bg-gradient-to-r from-blue-700 to-purple-700 rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-300 shadow-lg shadow-blue-900/30">
                  Ver detalles
                </button>
              </div>
            </div>
          </div>
        </section>

        <Footer />
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