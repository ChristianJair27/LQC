import { Twitch, Trophy, Users, Calendar, ChevronRight, Clock, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import Footer from '../components/layout/Footer'

const sponsors = [
  { id: 1, name: 'Yuri Japonesa', logo: '/sponsors/YuriJaponesa.png', url: 'https://example.com' },
  { id: 2, name: 'TableTop', logo: '/sponsors/5 Tabletop.png', url: 'https://example.com' },
  { id: 3, name: 'Los Arcos CQ', logo: '/sponsors/6 Los Arcos CQ.png', url: 'https://example.com' },
  { id: 4, name: 'Ser Sejuve', logo: '/sponsors/10 Ser Sejuve.png', url: 'https://example.com' },
  { id: 5, name: 'La Forja', logo: '/sponsors/8 La Forja.png', url: 'https://example.com' },
  { id: 6, name: 'Queretaro Con Futuro', logo: '/sponsors/9 Queretaro Con Futuro.png', url: 'https://example.com' },
  { id: 7, name: 'Space Riders', logo: '/sponsors/7 Space Riders.png', url: 'https://example.com' },
  { id: 8, name: 'Revolution 505', logo: '/sponsors/LOGONUEVOREV.png', url: 'https://revolution505.com' },
  { id: 9, name: 'LQC', logo: '/sponsors/2 LQC.png', url: 'https://example.com' },
]

export default function Home() {
  const [streamStatus, setStreamStatus] = useState<'online' | 'offline'>('online')
  const [streamViewers] = useState('1.2K')
  const [currentSponsorIndex, setCurrentSponsorIndex] = useState(0)
  const [isPlaying, ] = useState(true)
  const sponsorsContainerRef = useRef<HTMLDivElement>(null)
  
  const twitchChannel = "lqroc"
  
  const streamSchedule = [
    { day: 'Lunes', time: '18:00 - 22:00', type: 'Grupos' },
    { day: 'Miércoles', time: '18:00 - 22:00', type: 'Grupos' },
    { day: 'Viernes', time: '19:00 - 23:00', type: 'Playoffs' },
    { day: 'Sábado', time: '17:00 - 23:00', type: 'Finales' }
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
    <div className="min-h-screen bg-black">
      {/* Fondo minimalista */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-950 to-black" />
        <div className="absolute inset-0 opacity-5">
          <div className="h-full w-full bg-[linear-gradient(90deg,transparent_50%,rgba(255,255,255,0.02)_50%)] bg-[size:30px_30px]" />
        </div>
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-blue-900/20 to-transparent" />
        
        {/* Copa flotante de fondo (la que ya tenías) */}
        <img
          src="/assets/LOGO COPA.png"
          alt="LQC Trophy Logo"
          className="
            absolute 
            -left-[75%] sm:-left-[55%] md:-left-[50%] lg:-left-[45%] xl:-left-[29%]
            top-1/2 -translate-y-1/2
            w-[90%] sm:w-[80%] md:w-[70%] lg:w-[60%] xl:w-[55%]
            max-w-none opacity-12
            animate-float-slow pointer-events-none
          "
        />
      </div>

      {/* Contenido principal */}
      <div className="relative z-10">
        {/* Hero Section */}
        <div className="border-b border-gray-900 py-24 md:py-32">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-2 h-16 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                <div className="flex items-center gap-4">
                  {/* Logo LQC */}
                  <img
                    src="/assets/2 LQC.png"
                    alt="LQC Querétaro Logo"
                    className="h-20 md:h-28 w-auto object-contain"
                  />
                  {/* Copa al lado del logo LQC */}
                  <img
                    src="/assets/LOGO COPA.png"
                    alt="Copa LQC"
                    className="h-16 md:h-24 w-auto object-contain"
                  />
                </div>
              </div>
              
              <h1 className="text-5xl md:text-6xl font-light tracking-tight text-white mb-3">
                League Querétaro
              </h1>
              <div className="flex items-center gap-3">
                
                <span className="px-3 py-1 text-sm bg-blue-900/30 text-blue-400 border border-blue-800/50 rounded-full">
                  Primavera 2026
                </span>
              </div>
              
            </div>
          </div>
        </div>

        {/* Stream en vivo */}
        <div className="border-b border-gray-900 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-1 h-10 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                <h2 className="text-2xl font-light text-white">Transmisión en Vivo</h2>
                <div className={`px-3 py-1 text-xs rounded-full flex items-center gap-1 ${
                  streamStatus === 'online' 
                    ? 'bg-green-900/30 text-green-400 border border-green-800/50' 
                    : 'bg-gray-900/30 text-gray-400 border border-gray-800/50'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    streamStatus === 'online' ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
                  }`}></div>
                  {streamStatus === 'online' ? 'EN VIVO' : 'OFFLINE'}
                </div>
              </div>

              {/* El resto del código de stream se mantiene igual */}
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="border border-gray-900 rounded-lg overflow-hidden bg-black">
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
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          streamStatus === 'online' 
                            ? 'bg-red-600 text-white' 
                            : 'bg-gray-800 text-gray-300'
                        }`}>
                          {streamStatus === 'online' ? '🔴 EN VIVO' : '⚪ OFFLINE'}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 border-t border-gray-900">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-800/30 flex items-center justify-center">
                            <Twitch className="w-5 h-5 text-purple-400" />
                          </div>
                          <div>
                            <div className="text-white font-medium">LQROC</div>
                            <div className="text-sm text-gray-500">Canal oficial LQC</div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          Idioma: Español
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-gray-900 rounded-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-4 py-3 border-b border-gray-900">
                      <div className="text-white font-medium">Chat de Twitch</div>
                    </div>
                    <div className="h-48">
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

                <div className="space-y-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-blue-400" />
                      <h3 className="text-lg font-medium text-white">Horario de Transmisiones</h3>
                    </div>
                    <div className="space-y-3">
                      {streamSchedule.map((schedule, index) => (
                        <div key={index} className="flex items-center justify-between pb-3 border-b border-gray-900 last:border-0 last:pb-0">
                          <div>
                            <div className="text-white">{schedule.day}</div>
                            <div className="text-sm text-gray-500">{schedule.type}</div>
                          </div>
                          <div className="text-gray-400">{schedule.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 p-4 border border-gray-900 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-gray-400">Próximamente</span>
                    </div>
                    <div className="space-y-3">
                      <div className="text-center">
                        <div className="text-lg font-medium text-white mb-1">Galaxy Gaming</div>
                        <div className="text-sm text-gray-500">vs</div>
                        <div className="text-lg font-medium text-white mt-1">CROW GAMING</div>
                      </div>
                      <div className="text-center text-sm text-gray-500">
                        Hoy • 19:00
                      </div>
                    </div>
                    <button className="w-full py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-all duration-300 text-sm rounded-lg">
                      Programar recordatorio
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white">Estadísticas</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-2xl font-light text-white">{streamViewers}</div>
                        <div className="text-sm text-gray-500">Espectadores</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-light text-white">156</div>
                        <div className="text-sm text-gray-500">Suscriptores</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-light text-white">24</div>
                        <div className="text-sm text-gray-500">Transmisiones</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-light text-white">85%</div>
                        <div className="text-sm text-gray-500">Tasa de retención</div>
                      </div>
                    </div>
                  </div>

                  <a
                    href={`https://www.twitch.tv/${twitchChannel}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all duration-300 rounded-lg text-sm font-medium"
                  >
                    <Twitch className="w-4 h-4" />
                    Ir al canal de Twitch
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Carrusel de Patrocinadores (sin cambios) */}
        <div className="border-b border-gray-900 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-1 h-10 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                <h2 className="text-2xl font-light text-white">Nuestros Patrocinadores</h2>
              </div>

              <div className="relative">
                <button
                  onClick={prevSponsor}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 w-10 h-10 rounded-full bg-gray-900/80 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:border-blue-600 transition-all duration-300"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                <button
                  onClick={nextSponsor}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 w-10 h-10 rounded-full bg-gray-900/80 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:border-blue-600 transition-all duration-300"
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>

                <div className="overflow-hidden">
                  <div 
                    ref={sponsorsContainerRef}
                    className="flex transition-transform duration-500 ease-in-out"
                    style={{ transform: `translateX(-${currentSponsorIndex * 100}%)` }}
                  >
                    {sponsors.map((sponsor) => (
                      <div 
                        key={sponsor.id} 
                        className="w-full flex-shrink-0 flex items-center justify-center"
                      >
                        <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 border border-gray-800/50 rounded-xl p-8 hover:border-blue-600/50 transition-all duration-300 group cursor-pointer w-full max-w-md">
                          <div className="flex flex-col items-center space-y-6">
                            <div className="w-48 h-48 rounded-lg bg-gray-900/50 border border-gray-800 flex items-center justify-center p-4 group-hover:border-blue-600/30 transition-all duration-300 overflow-hidden">
                              <img
                                src={sponsor.logo}
                                alt={`Logo de ${sponsor.name}`}
                                className="max-w-full max-h-full object-contain"
                                onError={(e) => {
                                  e.currentTarget.src = '/placeholder-logo.png'
                                  console.error(`Error cargando logo: ${sponsor.logo}`)
                                }}
                              />
                            </div>
                            
                            <div className="text-center">
                              <h3 className="text-xl font-medium text-white mb-2">{sponsor.name}</h3>
                              <p className="text-gray-400 text-sm">
                                Patrocinador oficial de la LQC Primavera 2026
                              </p>
                            </div>
                            
                            <a
                              href={sponsor.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-6 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-blue-600 transition-all duration-300 text-sm rounded-lg"
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
          </div>
        </div>

        {/* Inscripciones */}
        <div className="border-b border-gray-900 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="space-y-8">
                <div className="flex items-center gap-3">
                  <Trophy className="w-5 h-5 text-blue-400" />
                  <h2 className="text-2xl font-light text-white">Inscripciones Abiertas</h2>
                </div>
                
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <p className="text-gray-400 leading-relaxed">
                      Forma tu equipo y participa en la próxima temporada del LQC. 
                      Las inscripciones están abiertas para equipos de todos los niveles.
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                      <div className="text-white">Sin costo de inscripción</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                      <div className="text-white">Premios en efectivo</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                      <div className="text-white">Exposición en stream</div>
                    </div>
                  </div>
                  
                  <div className="border border-gray-800 rounded-lg overflow-hidden">
                    <iframe
                      src="https://battlefy.com/embeds/join/694306c449965900f6362ff6"
                      title="Inscribirse - LQC Primavera 2026"
                      width="100%"
                      height="60"
                      scrolling="no"
                      frameBorder="0"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Equipos participantes */}
        <div className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-1 h-10 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                <h2 className="text-2xl font-light text-white">Equipos Inscritos</h2>
              </div>
              
              <div className="space-y-4 mb-8">
                <p className="text-gray-400">
                  Conoce a los equipos que competirán por el título en la temporada Primavera 2026
                </p>
                <div className="text-sm text-gray-500">
                  Actualizado en tiempo real • {new Date().getFullYear()}
                </div>
              </div>

              <div className="border border-gray-900 rounded-lg overflow-hidden">
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-4 border-b border-gray-900">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-medium text-white">Lista de equipos participantes</h3>
                  </div>
                </div>
                
                <iframe
                  src="https://battlefy.com/embeds/teams/694306c449965900f6362ff6"
                  title="Equipos participantes - LQC Primavera 2026"
                  width="100%"
                  height="680"
                  scrolling="yes"
                  frameBorder="0"
                  allowFullScreen
                  className="w-full bg-gray-950"
                />
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>

      {/* Animaciones */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}