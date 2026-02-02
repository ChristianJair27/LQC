import { Trophy, Calendar, ChevronRight, Star  } from 'lucide-react'
import { useState } from 'react'
import Footer from '../components/layout/Footer'

export default function Torneos() {
  const [activeSeason, setActiveSeason] = useState("Otoño 2025")
  const [activeTab, setActiveTab] = useState("brackets")

  const [activeBracket, setActiveBracket] = useState<string>("groups");     // default: fase de grupos
const [activeStanding, setActiveStanding] = useState<string>("groups-standings");

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

  const currentTournament = tournaments[0]

  const tournamentEmbeds = [
    {
      id: "teams",
      title: "Equipos Participantes",
      description: "Todos los equipos que compitieron en el torneo",
      src: "https://battlefy.com/embeds/teams/6852287c98498e0084e4cff1",
      height: "600px"
    },
    {
      id: "groups",
      title: "FASE DE GRUPOS - Bracket",
      description: "Resultados y enfrentamientos de la fase de grupos",
      src: "https://battlefy.com/embeds/6852287c98498e0084e4cff1/stage/68ae011e24d77d05705932ee",
      height: "620px"
    },
    {
      id: "playins",
      title: "Play Ins - Bracket",
      description: "Ronda de clasificación para los playoffs",
      src: "https://battlefy.com/embeds/6852287c98498e0084e4cff1/stage/68e259ecb9681c0021c34aec",
      height: "620px"
    },
    {
      id: "top8",
      title: "Top 8 - Eliminación Directa",
      description: "Fase final del torneo con los mejores equipos",
      src: "https://battlefy.com/embeds/6852287c98498e0084e4cff1/stage/6900080ca7e3f1002186119f",
      height: "620px"
    }
  ]

  const standingsEmbeds = [
    {
      id: "groups-standings",
      title: "FASE DE GRUPOS - Standings",
      src: "https://battlefy.com/embeds/6852287c98498e0084e4cff1/stage/68ae011e24d77d05705932ee/standings",
      height: "600px"
    },
    {
      id: "playins-standings",
      title: "Play Ins - Standings",
      src: "https://battlefy.com/embeds/6852287c98498e0084e4cff1/stage/68e259ecb9681c0021c34aec/standings",
      height: "600px"
    },
    {
      id: "top8-standings",
      title: "Top 8 - Standings",
      src: "https://battlefy.com/embeds/6852287c98498e0084e4cff1/stage/6900080ca7e3f1002186119f/standings",
      height: "600px"
    }
  ]

  return (
    <div className="min-h-screen bg-black">
     {/* Fondo minimalista */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-950 to-black"></div>
        <div className="absolute inset-0 opacity-5">
          <div className="h-full w-full bg-[linear-gradient(90deg,transparent_50%,rgba(255,255,255,0.02)_50%)] bg-[size:30px_30px]"></div>
        </div>
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-blue-900/20 to-transparent"></div>
        
       {/* Copa minimalista - más a la izquierda y más pequeña */}
<img
  src="/assets/LOGO COPA.png"   // ← ruta corregida (sin "src/"), asume que está en public/assets/
  alt="LQC Trophy Logo"
  className="
    absolute 
    -left-[75%]           /* mucho más a la izquierda – ajusta entre -50% y -80% según prefieras */
    sm:-left-[55%]
    md:-left-[50%]
    lg:-left-[45%]
    xl:-left-[29%]
    top-1/2
    -translate-y-1/2
    w-[90%]               /* tamaño base más pequeño que antes */
    sm:w-[80%]
    md:w-[70%]
    lg:w-[60%]
    xl:w-[55%]
    max-w-none
    opacity-12            /* un poco más sutil, antes era 15→10 en md+ */
    animate-float-slow
    pointer-events-none
  "
/>
      </div>

      {/* Contenido principal */}
      <div className="relative z-10">
        {/* Hero Section Minimalista */}
        <div className="border-b border-gray-900 py-20 md:py-28">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-2 h-12 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                <div>
                  <h1 className="text-5xl md:text-6xl font-light tracking-tight text-white mb-2">
                    Archivo de
                  </h1>
                  <div className="flex items-center gap-3">
                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white">
                      Torneos
                    </h1>
                    <span className="px-3 py-1 text-sm bg-blue-900/30 text-blue-400 border border-blue-800/50 rounded-full">
                      HISTÓRICO
                    </span>
                  </div>
                </div>
              </div>
              
              <p className="text-lg text-gray-400 font-light max-w-2xl leading-relaxed">
                Revive las estadísticas, brackets y resultados de todas las temporadas 
                anteriores del League Querétaro Championship.
              </p>
            </div>
          </div>
        </div>

        {/* Selector de temporadas minimalista */}
        <div className="border-b border-gray-900 py-8">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-5 h-5 text-blue-400" />
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                  Seleccionar Temporada
                </h2>
              </div>
              
              <div className="flex items-center gap-2">
                {tournaments.map((tournament) => (
                  <button
                    key={tournament.id}
                    onClick={() => setActiveSeason(tournament.season)}
                    className={`
                      px-6 py-3 text-sm font-medium transition-all duration-300 border
                      ${activeSeason === tournament.season 
                        ? 'border-blue-600 text-white bg-blue-900/10' 
                        : 'border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700'
                      }
                    `}
                  >
                    {tournament.season}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Estadísticas del torneo - Integrado al diseño */}
        <div className="border-b border-gray-900 py-12">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="mb-10">
                <h2 className="text-3xl font-light text-white mb-2">{currentTournament.name}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>{currentTournament.date}</span>
                  <span>•</span>
                  <span>{currentTournament.participants} equipos</span>
                  <span>•</span>
                  <span className="text-blue-400">{currentTournament.prizePool} en premios</span>
                </div>
              </div>

              {/* Estadísticas en línea */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                {Object.entries(currentTournament.stats).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <div className="text-2xl font-light text-white">{value}</div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider">
                      {key === 'matches' && 'Partidos'}
                      {key === 'viewers' && 'Espectadores'}
                      {key === 'duration' && 'Duración'}
                    </div>
                  </div>
                ))}
                <div className="space-y-1">
                  <div className="text-2xl font-light text-white">{currentTournament.participants}</div>
                  <div className="text-sm text-gray-500 uppercase tracking-wider">Equipos</div>
                </div>
              </div>

              {/* Campeones - Diseño integrado */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Trophy className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                    Podio de la Temporada
                  </h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4 pb-4 border-b border-gray-900">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-800/30 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium">Campeón</div>
                      <div className="text-lg text-white">{currentTournament.champion}</div>
                    </div>
                    <div className="text-sm text-gray-500">1° Lugar</div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-900/50 border border-gray-800 flex items-center justify-center">
                      <Star className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-gray-400 font-medium">Subcampeón</div>
                      <div className="text-lg text-gray-300">{currentTournament.finalist}</div>
                    </div>
                    <div className="text-sm text-gray-500">2° Lugar</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navegación de contenido */}
        <div className="border-b border-gray-900 py-8">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("brackets")}
                  className={`
                    px-8 py-3 text-sm font-medium border-b-2 transition-all duration-300
                    ${activeTab === "brackets" 
                      ? 'border-blue-600 text-white' 
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                    }
                  `}
                >
                  Brackets
                </button>
                <button
                  onClick={() => setActiveTab("standings")}
                  className={`
                    px-8 py-3 text-sm font-medium border-b-2 transition-all duration-300
                    ${activeTab === "standings" 
                      ? 'border-blue-600 text-white' 
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                    }
                  `}
                >
                  Tablas de Posiciones
                </button>
                <button className="px-8 py-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-300 transition-all duration-300">
                  Estadísticas
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Contenido dinámico */}
        <div className="py-12">
  <div className="container mx-auto px-4">
    <div className="max-w-6xl mx-auto">
      

      {activeTab === "brackets" ? (
        <div className="space-y-10">
          {/* Selector de Brackets */}
          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            {tournamentEmbeds.map((embed) => (
              <button
                key={embed.id}
                onClick={() => setActiveBracket(embed.id)}
                className={`
                  px-5 py-2.5 text-sm font-medium rounded-lg border transition-all duration-300
                  ${activeBracket === embed.id 
                    ? 'border-blue-500 bg-blue-950/60 text-white shadow-md' 
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'}
                `}
              >
                {embed.title.replace(" - Bracket", "").replace(" - Eliminación Directa", "")}
              </button>
            ))}
          </div>

          {/* Solo UN iframe de brackets */}
          {tournamentEmbeds.find(e => e.id === activeBracket) && (
            <div className="space-y-4">
              <h3 className="text-xl font-light text-white">
                {tournamentEmbeds.find(e => e.id === activeBracket)?.title}
              </h3>
              <p className="text-sm text-gray-500">
                {tournamentEmbeds.find(e => e.id === activeBracket)?.description}
              </p>
              
              <div className="border border-gray-900 rounded-xl overflow-hidden shadow-2xl">
                <iframe
                  key={activeBracket} // ← fuerza recarga al cambiar (importante)
                  src={tournamentEmbeds.find(e => e.id === activeBracket)?.src}
                  title={tournamentEmbeds.find(e => e.id === activeBracket)?.title}
                  width="100%"
                  height="680px" // un poco más alto para mejor UX
                  scrolling="yes"
                  frameBorder="0"
                  allowFullScreen
                  loading="lazy"
                  className="w-full bg-gray-950"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {/* Selector de Standings */}
          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            {standingsEmbeds.map((embed) => (
              <button
                key={embed.id}
                onClick={() => setActiveStanding(embed.id)}
                className={`
                  px-5 py-2.5 text-sm font-medium rounded-lg border transition-all duration-300
                  ${activeStanding === embed.id 
                    ? 'border-blue-500 bg-blue-950/60 text-white shadow-md' 
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'}
                `}
              >
                {embed.title.replace(" - Standings", "")}
              </button>
            ))}
          </div>

          {/* Solo UN iframe de standings */}
          {standingsEmbeds.find(e => e.id === activeStanding) && (
            <div className="space-y-4">
              <h3 className="text-xl font-light text-white">
                {standingsEmbeds.find(e => e.id === activeStanding)?.title}
              </h3>
              
              <div className="border border-gray-900 rounded-xl overflow-hidden shadow-2xl">
                <iframe
                  key={activeStanding}
                  src={standingsEmbeds.find(e => e.id === activeStanding)?.src}
                  title={standingsEmbeds.find(e => e.id === activeStanding)?.title}
                  width="100%"
                  height="680px"
                  scrolling="yes"
                  frameBorder="0"
                  allowFullScreen
                  loading="lazy"
                  className="w-full bg-gray-950"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  </div>
</div>

        {/* Historial de temporadas */}
        <div className="border-t border-gray-900 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                <h2 className="text-2xl font-light text-white">Historial de Temporadas</h2>
              </div>
              
              <div className="space-y-8">
                {tournaments.map((tournament) => (
                  <div key={tournament.id} className="pb-8 border-b border-gray-900 last:border-0">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl text-white">{tournament.name}</h3>
                          <span className="text-xs px-2 py-1 bg-gray-900 text-gray-400 rounded-full">
                            {tournament.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{tournament.date}</span>
                          <span>•</span>
                          <span>{tournament.participants} equipos</span>
                          <span>•</span>
                          <span className="text-blue-400">{tournament.prizePool}</span>
                        </div>
                      </div>
                      
                      <button className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-1">
                        Ver detalles
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="space-y-1">
                        <div className="text-gray-500">Campeón</div>
                        <div className="text-white">{tournament.champion}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-gray-500">Subcampeón</div>
                        <div className="text-gray-300">{tournament.finalist}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-gray-500">Partidos</div>
                        <div className="text-white">{tournament.stats.matches}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Llamada a la acción minimalista */}
        <div className="border-t border-gray-900 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="w-2 h-12 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                <div>
                  <h2 className="text-2xl font-light text-white mb-2">Próxima Temporada</h2>
                  <p className="text-gray-500">Invierno 2026</p>
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="text-center">
                  <div className="text-3xl font-light text-white mb-1">Enero</div>
                  <div className="text-sm text-gray-500">Inicio</div>
                </div>
                <div className="w-12 h-px bg-gray-800"></div>
                <div className="text-center">
                  <div className="text-3xl font-light text-white mb-1">20+</div>
                  <div className="text-sm text-gray-500">Equipos</div>
                </div>
                <div className="w-12 h-px bg-gray-800"></div>
                <div className="text-center">
                  <div className="text-3xl font-light text-white mb-1">$50K+</div>
                  <div className="text-sm text-gray-500">Premios</div>
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-4">
                <button className="px-8 py-3 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-all duration-300 text-sm">
                  Notificarme
                </button>
                <button className="px-8 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-all duration-300 text-sm">
                  Ver detalles
                </button>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  )
}