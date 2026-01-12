import { Twitch, Trophy, Users, Calendar, Award, ChevronRight, Eye, Clock, Mic } from 'lucide-react'
import { useState } from 'react'
import Footer from '../components/layout/Footer'

export default function Home() {
  const [streamStatus] = useState<'online' | 'offline'>('online')
  const [streamViewers] = useState('1.2K')
  
  const streamSchedule = [
    { day: 'Lunes', time: '18:00 - 22:00', type: 'Grupos' },
    { day: 'Miércoles', time: '18:00 - 22:00', type: 'Grupos' },
    { day: 'Viernes', time: '19:00 - 23:00', type: 'Playoffs' },
    { day: 'Sábado', time: '17:00 - 23:00', type: 'Finales' }
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
        
        {/* Copa minimalista */}
        <img
          src="/assets/lqc-trophy-logo.jpg"
          alt="LQC Trophy Logo"
          className="
            absolute 
            -left-48 sm:-left-40 md:-left-32 lg:-left-28 xl:-left-24
            top-1/2
            -translate-y-1/2
            w-[140%] sm:w-[120%] md:w-[100%] lg:w-[90%] xl:w-[80%]
            max-w-none
            opacity-15 md:opacity-10
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
                <div>
                  <h1 className="text-5xl md:text-6xl font-light tracking-tight text-white mb-3">
                    League Querétaro
                  </h1>
                  <div className="flex items-center gap-3">
                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white">
                      Championship
                    </h1>
                    <span className="px-3 py-1 text-sm bg-blue-900/30 text-blue-400 border border-blue-800/50 rounded-full">
                      Primavera 2026
                    </span>
                  </div>
                </div>
              </div>
              
              <p className="text-lg text-gray-400 font-light max-w-2xl leading-relaxed">
                El torneo más competitivo de League of Legends en Querétaro, 
                donde los mejores equipos luchan por la gloria y el reconocimiento regional.
              </p>
            </div>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="border-b border-gray-900 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {[
                  { icon: Users, label: "Equipos", value: "16+" },
                  { icon: Trophy, label: "Premio Total", value: "$50K+" },
                  { icon: Award, label: "Edición", value: "12ª" },
                  { icon: Eye, label: "Espectadores", value: "10K+" }
                ].map((stat, index) => (
                  <div key={index} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-800/30 flex items-center justify-center">
                        <stat.icon className="w-5 h-5 text-blue-400" />
                      </div>
                      <div className="text-3xl font-light text-white">{stat.value}</div>
                    </div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stream en vivo - Sección principal */}
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

              <div className="grid lg:grid-cols-3 gap-8">
                {/* Contenedor del stream */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Embed de Twitch */}
                  <div className="border border-gray-900 rounded-lg overflow-hidden bg-black">
                    <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-gray-800">
                      {/* Aquí iría el embed real de Twitch */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                        <div className="text-center">
                          <div className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center mx-auto mb-6">
                            <Twitch className="w-10 h-10 text-white" />
                          </div>
                          <h3 className="text-xl font-medium text-white mb-3">Transmisión LQC</h3>
                          <p className="text-gray-400 mb-6">
                            {streamStatus === 'online' 
                              ? 'Transmitiendo en vivo desde el estudio LQC' 
                              : 'La transmisión comenzará próximamente'}
                          </p>
                          
                          {/* Estado del stream */}
                          <div className="flex items-center justify-center gap-6 mb-6">
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4 text-gray-400" />
                              <span className="text-white">{streamViewers}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mic className="w-4 h-4 text-gray-400" />
                              <span className="text-white">Comentaristas LQC</span>
                            </div>
                          </div>
                          
                          {/* Botón de acción */}
                          <a
                            href="https://www.twitch.tv/lqroc"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 transition-all duration-300 rounded-lg text-sm font-medium"
                          >
                            <Twitch className="w-4 h-4" />
                            {streamStatus === 'online' ? 'Ver en Twitch' : 'Ir al canal'}
                            <ChevronRight className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                      
                      {/* Overlay de estado */}
                      <div className="absolute top-4 left-4">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          streamStatus === 'online' 
                            ? 'bg-red-600 text-white' 
                            : 'bg-gray-800 text-gray-300'
                        }`}>
                          {streamStatus === 'online' ? '🔴 EN VIVO' : '⚪ OFFLINE'}
                        </div>
                      </div>
                      
                      {/* Título actual */}
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="text-white font-medium truncate">
                          {streamStatus === 'online' 
                            ? 'LQC Primavera 2026 - Fase de Grupos | Día 3' 
                            : 'Próximamente: LQC Primavera 2026'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Información del stream */}
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
                  
                  {/* Chat simulado (opcional) */}
                  <div className="border border-gray-900 rounded-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-4 py-3 border-b border-gray-900">
                      <div className="text-white font-medium">Chat de la transmisión</div>
                    </div>
                    <div className="h-48 bg-black p-4">
                      <div className="text-center text-gray-500 text-sm">
                        Conéctate a Twitch para participar en el chat en vivo
                      </div>
                    </div>
                  </div>
                </div>

                {/* Información del stream */}
                <div className="space-y-8">
                  {/* Horario de transmisiones */}
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
                  
                  {/* Próximo partido */}
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
                    
                    <button className="w-full py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-all duration-300 text-sm">
                      Programar recordatorio
                    </button>
                  </div>
                  
                  {/* Estadísticas del stream */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white">Estadísticas</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="text-2xl font-light text-white">1.2K</div>
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
    </div>
  )
}