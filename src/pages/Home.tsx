import { Twitch, Calendar, ChevronRight, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { useState, useEffect } from 'react'


const sponsors = [
  { id: 1, name: 'Yuri Japonesa', logo: '/sponsors/YuriJaponesa.png', url: 'https://example.com' },
  { id: 2, name: 'TableTop', logo: '/sponsors/5 Tabletop.png', url: 'https://example.com' },
  { id: 3, name: 'Los Arcos CQ', logo: '/sponsors/6 Los Arcos CQ.png', url: 'https://example.com' },
  { id: 4, name: 'Ser Sejuve', logo: '/sponsors/10 Ser Sejuve.png', url: 'https://example.com' },
  { id: 5, name: 'La Forja', logo: '/sponsors/8 La Forja.png', url: 'https://example.com' },
  { id: 6, name: 'Queretaro Con Futuro', logo: '/sponsors/9 Queretaro Con Futuro.png', url: 'https://example.com' },
  { id: 7, name: 'Space Riders', logo: '/sponsors/7 Space Riders.png', url: 'https://example.com' },
  { id: 8, name: 'Revolution 505', logo: '/sponsors/LOGONUEVOREV.png', url: 'https://revolution505.com' },
  { id: 9, name: 'LQC', logo: '/sponsors/2 LQC.png', url: 'https://lqc.revolution505.com' },
  { id: 10, name: 'La Peña de Santiago', logo: '/sponsors/penaLogoNaran.jpeg', url: 'https://lqc.revolution505.com' },
]

export default function Home() {
  const [streamStatus, setStreamStatus] = useState<'online' | 'offline'>('online')
  const [] = useState('1.2K')
  const [currentSponsorIndex, setCurrentSponsorIndex] = useState(0)
  const [isPlaying] = useState(true)
  
  
  const twitchChannel = "lqroc"
  
  const streamSchedule = [
    { day: 'Martes', time: '20:30 - 22:00', type: 'Grupos' },
    { day: 'Jueves', time: '21:00 - 22:00', type: 'Grupos' },
    
  ]

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setCurrentSponsorIndex((prev) => (prev + 1) % sponsors.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [isPlaying, sponsors.length])

  const nextSponsor = () => setCurrentSponsorIndex((prev) => (prev + 1) % sponsors.length)
  const prevSponsor = () => setCurrentSponsorIndex((prev) => (prev - 1 + sponsors.length) % sponsors.length)

  useEffect(() => {
    const checkStreamStatus = () => setStreamStatus('online')
    checkStreamStatus()
    const interval = setInterval(checkStreamStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white">
      {/* Fondo decorativo sutil */}
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
            top-[15%] sm:top-[10%]
            w-[120%] sm:w-[90%] md:w-[80%] lg:w-[70%] xl:w-[60%]
            max-w-none opacity-10
            animate-float-slow pointer-events-none blur-[2px]
          "
        />
      </div>

      {/* Contenido principal */}
      <div className="relative z-10">
        {/* Hero - más limpio y centrado */}
        <section className="py-32 md:py-40">
          <div className="container mx-auto px-6 max-w-5xl text-center">
            <div className="flex flex-col items-center gap-6">
              <div className="flex items-center justify-center gap-6 flex-wrap">
                <img
                  src="/assets/2 LQC.png"
                  alt="LQC Querétaro Logo"
                  className="h-24 md:h-32 w-auto object-contain drop-shadow-xl"
                />
                <img
                  src="/assets/LOGO COPA.png"
                  alt="Copa LQC"
                  className="h-20 md:h-28 w-auto object-contain drop-shadow-xl"
                />
              </div>
              
              <h1 className="text-5xl md:text-7xl font-extralight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-purple-400">
                League Querétaro
              </h1>
              
              <div className="inline-flex items-center gap-4 mt-4">
                <span className="px-5 py-2 text-base bg-blue-950/40 text-blue-300 backdrop-blur-sm border border-blue-800/30 rounded-full shadow-lg">
                  Primavera 2026
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Transmisión en vivo - sin bordes duros */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
              <h2 className="text-3xl font-light">Transmisión en Vivo</h2>
              <div className={`px-4 py-1.5 text-sm rounded-full flex items-center gap-2 backdrop-blur-sm ${
                streamStatus === 'online' 
                  ? 'bg-green-950/50 text-green-300 border border-green-800/40' 
                  : 'bg-gray-900/50 text-gray-400 border border-gray-800/40'
              }`}>
                <div className={`w-3 h-3 rounded-full ${streamStatus === 'online' ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                {streamStatus === 'online' ? 'EN VIVO' : 'OFFLINE'}
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-10">
              <div className="lg:col-span-2 space-y-10">
                <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-black/60 backdrop-blur-md border border-white/5">
                  <div className="relative aspect-video">
                    <iframe
                      src={`https://player.twitch.tv/?channel=${twitchChannel}&parent=${window.location.hostname}&autoplay=true`}
                      height="100%"
                      width="100%"
                      allowFullScreen
                      className="border-0"
                      title="Twitch Stream"
                    />
                    <div className="absolute top-4 left-4">
                      <div className={`px-4 py-1.5 rounded-full text-sm font-medium shadow-lg ${
                        streamStatus === 'online' ? 'bg-red-600 text-white' : 'bg-gray-800/80 text-gray-200'
                      }`}>
                        {streamStatus === 'online' ? '🔴 EN VIVO' : '⚪ OFFLINE'}
                      </div>
                    </div>
                  </div>
                  <div className="p-5 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-purple-500/20 flex items-center justify-center">
                          <Twitch className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                          <div className="font-medium">LQROC</div>
                          <div className="text-sm text-gray-400">Canal oficial LQC</div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 hidden sm:block">
                        Idioma: Español
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-black/40 backdrop-blur-md border border-white/5">
                  <div className="bg-gradient-to-r from-gray-900/60 to-gray-800/40 px-5 py-4">
                    <div className="font-medium">Chat de Twitch</div>
                  </div>
                  <div className="h-64 sm:h-80">
                    <iframe
                      src={`https://www.twitch.tv/embed/${twitchChannel}/chat?parent=${window.location.hostname}&darkpopout`}
                      height="100%"
                      width="100%"
                      className="border-0"
                      title="Twitch Chat"
                    />
                  </div>
                </div>
              </div>

              {/* Sidebar sigue similar pero más limpio */}
              <div className="space-y-10">
                {/* Horario */}
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Calendar className="w-6 h-6 text-blue-400" />
                    <h3 className="text-xl font-medium">Horario de Transmisiones</h3>
                  </div>
                  <div className="space-y-4 bg-black/30 backdrop-blur-sm p-6 rounded-2xl border border-white/5">
                    {streamSchedule.map((schedule, i) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                        <div>
                          <div className="font-medium">{schedule.day}</div>
                          <div className="text-sm text-gray-400">{schedule.type}</div>
                        </div>
                        <div className="text-gray-300">{schedule.time}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Próximo + stats + botón */}
                <div className="space-y-8">
                 

                  

                  <a
                    href={`https://www.twitch.tv/${twitchChannel}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 w-full py-4 bg-gradient-to-r from-purple-700 to-blue-700 hover:from-purple-600 hover:to-blue-600 rounded-xl font-medium transition-all duration-300 shadow-lg shadow-purple-900/30"
                  >
                    <Twitch className="w-5 h-5" />
                    Ir al canal de Twitch
                    <ChevronRight className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Brackets - nueva sección */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
              <h2 className="text-3xl font-light">Brackets - Fase Regular</h2>
            </div>
            
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-black/50 backdrop-blur-md border border-white/5 min-h-[600px]">
              <iframe
                src="https://battlefy.com/embeds/694306c449965900f6362ff6/stage/698a2254cd5d9a0030a25efb"
                title="Battlefy Tournament - Fase regular - Pareo Suizo"
                width="100%"
                height="100%"
                scrolling="yes"
                frameBorder="0"
                className="min-h-[600px] md:min-h-[700px] lg:min-h-[800px]"
              />
            </div>
          </div>
        </section>

        {/* Standings - nueva sección */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
              <h2 className="text-3xl font-light">Clasificación / Standings</h2>
            </div>
            
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-black/50 backdrop-blur-md border border-white/5 min-h-[600px]">
              <iframe
                src="https://battlefy.com/embeds/694306c449965900f6362ff6/stage/698a2254cd5d9a0030a25efb/standings"
                title="Battlefy Tournament - Fase regular - Pareo Suizo - Standings"
                width="100%"
                height="100%"
                scrolling="yes"
                frameBorder="0"
                className="min-h-[600px] md:min-h-[700px] lg:min-h-[800px]"
              />
            </div>
          </div>
        </section>

        {/* Patrocinadores - versión más limpia */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
              <h2 className="text-3xl font-light">Nuestros Patrocinadores</h2>
            </div>

            <div className="relative">
              <button
                onClick={prevSponsor}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-20 w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-gray-300 hover:text-white hover:border-blue-500/50 transition-all"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              <button
                onClick={nextSponsor}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-20 w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-gray-300 hover:text-white hover:border-blue-500/50 transition-all"
              >
                <ChevronRightIcon className="w-6 h-6" />
              </button>

              <div className="overflow-hidden rounded-2xl">
                <div 
                  className="flex transition-transform duration-700 ease-out"
                  style={{ transform: `translateX(-${currentSponsorIndex * 100}%)` }}
                >
                  {sponsors.map((sponsor) => (
                    <div key={sponsor.id} className="w-full flex-shrink-0 px-4">
                      <div className="bg-gradient-to-br from-gray-900/30 to-gray-800/20 backdrop-blur-md border border-white/5 rounded-2xl p-10 hover:border-blue-500/30 transition-all duration-500 group max-w-2xl mx-auto">
                        <div className="flex flex-col items-center space-y-8">
                          <div className="w-56 h-56 rounded-xl bg-black/40 border border-white/5 p-6 group-hover:border-blue-500/20 transition-all overflow-hidden flex items-center justify-center">
                            <img
                              src={sponsor.logo}
                              alt={sponsor.name}
                              className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => (e.currentTarget.src = '/placeholder-logo.png')}
                            />
                          </div>
                          <div className="text-center space-y-3">
                            <h3 className="text-2xl font-medium">{sponsor.name}</h3>
                            <p className="text-gray-400">Patrocinador oficial LQC Primavera 2026</p>
                          </div>
                          <a
                            href={sponsor.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-8 py-3 border border-white/10 hover:border-blue-500/50 text-gray-300 hover:text-white rounded-xl transition-all duration-300"
                          >
                            Visitar sitio web
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        

        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
              <h2 className="text-3xl font-light">Equipos Inscritos</h2>
            </div>
            
            <p className="text-gray-300 mb-8 max-w-3xl">
              Conoce a los equipos que competirán por el título en la temporada Primavera 2026. Actualizado en tiempo real.
            </p>

            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-black/50 backdrop-blur-md border border-white/5">
              <iframe
                src="https://battlefy.com/embeds/teams/694306c449965900f6362ff6"
                title="Equipos participantes - LQC Primavera 2026"
                width="100%"
                height="720"
                scrolling="yes"
                frameBorder="0"
                className="bg-gray-950/50"
              />
            </div>
          </div>
        </section>

      </div>

      {/* Animación flotante */}
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