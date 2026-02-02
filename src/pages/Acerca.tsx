import { Trophy, Users, MapPin, Calendar, Award, Target, Globe, Heart, Star, ChevronRight } from 'lucide-react'
import Footer from '../components/layout/Footer'

export default function Acerca() { 
  const stats = [
    { value: "12+", label: "Temporadas", icon: Trophy },
    { value: "200+", label: "Equipos", icon: Users },
    { value: "$500K+", label: "En Premios", icon: Award },
    { value: "1000+", label: "Partidos", icon: Target },
  ]

  const milestones = [
    { year: "2019", event: "Primera temporada del LQC", detail: "8 equipos participantes" },
    { year: "2020", event: "Expansión a formato profesional", detail: "Stream oficial en Twitch" },
    { year: "2022", event: "Alianza con patrocinadores", detail: "Premios en efectivo" },
    { year: "2023", event: "Comunidad de 10K+", detail: "Cobertura regional" },
    { year: "2024", event: "Formato competitivo", detail: "Sistema de playoffs" },
    { year: "2025", event: "Ecosistema establecido", detail: "Temporadas regulares" },
  ]

  const teamMembers = [
    { name: "Director del Torneo", role: "Organización general", experience: "5+ años en esports" },
    { name: "Coordinador de Equipos", role: "Gestión de participantes", experience: "4+ temporadas" },
    { name: "Productor de Contenido", role: "Stream y producción", experience: "3+ años en broadcasting" },
    { name: "Juez Principal", role: "Reglas y fair play", experience: "6+ años competitivos" },
  ]

  const values = [
    { 
      title: "Competitividad", 
      description: "Fomentamos el juego al más alto nivel con integridad deportiva",
      icon: Trophy
    },
    { 
      title: "Comunidad", 
      description: "Un espacio donde jugadores y fans se unen por la pasión al juego",
      icon: Users
    },
    { 
      title: "Innovación", 
      description: "Constantemente mejorando el formato y experiencia del torneo",
      icon: Target
    },
    { 
      title: "Accesibilidad", 
      description: "Oportunidades para equipos de todos los niveles en Querétaro",
      icon: Heart
    },
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
        {/* Hero Section */}
        <div className="border-b border-gray-900 py-24 md:py-32">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-2 h-16 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                <div>
                  <h1 className="text-5xl md:text-6xl font-light tracking-tight text-white mb-3">
                    Acerca de
                  </h1>
                  <div className="flex items-center gap-3">
                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white">
                      LQC
                    </h1>
                    <span className="px-3 py-1 text-sm bg-blue-900/30 text-blue-400 border border-blue-800/50 rounded-full">
                      League Querétaro Championship
                    </span>
                  </div>
                </div>
              </div>
              
              <p className="text-lg text-gray-400 font-light max-w-2xl leading-relaxed">
                El torneo más competitivo y prestigioso de League of Legends en Querétaro, 
                donde la pasión por los esports se encuentra con la excelencia competitiva.
              </p>
            </div>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="border-b border-gray-900 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {stats.map((stat, index) => (
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

        {/* Nuestra Historia */}
        <div className="border-b border-gray-900 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-12">
                <div className="w-1 h-10 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                <h2 className="text-2xl font-light text-white">Nuestra Historia</h2>
              </div>
              
              <div className="space-y-12">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-xl font-light text-white">Orígenes</h3>
                    <p className="text-gray-400 leading-relaxed">
                      Fundado en 2019, el LQC nació de la visión de crear un espacio competitivo 
                      serio para la creciente comunidad de League of Legends en Querétaro. 
                      Lo que comenzó como un torneo local entre amigos rápidamente evolucionó 
                      en el campeonato más importante de la región.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-xl font-light text-white">Evolución</h3>
                    <p className="text-gray-400 leading-relaxed">
                      A lo largo de 12+ temporadas, hemos refinado nuestro formato, 
                      implementado sistemas profesionales de competencia y construido 
                      una comunidad sólida. Hoy, el LQC es referencia de esports 
                      estudiantil y amateur en el centro de México.
                    </p>
                  </div>
                </div>

                {/* Línea de tiempo */}
                <div className="space-y-8">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-medium text-white">Hitos Importantes</h3>
                  </div>
                  
                  <div className="space-y-6">
                    {milestones.map((milestone, index) => (
                      <div key={index} className="flex items-start gap-4">
                        <div className="w-16 flex-shrink-0">
                          <div className="text-sm text-blue-400 font-medium">{milestone.year}</div>
                        </div>
                        <div className="flex-1 pb-6 border-b border-gray-900 last:border-0 last:pb-0">
                          <div className="text-white font-medium mb-1">{milestone.event}</div>
                          <div className="text-sm text-gray-500">{milestone.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Misión y Valores */}
        <div className="border-b border-gray-900 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-1 h-10 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                      <h2 className="text-2xl font-light text-white">Nuestra Misión</h2>
                    </div>
                    <p className="text-gray-400 leading-relaxed">
                      Crear y mantener el ecosistema competitivo de esports más sólido 
                      en Querétaro, proporcionando a jugadores de todos los niveles 
                      una plataforma profesional para demostrar su talento, mientras 
                      construimos una comunidad unida alrededor de la pasión por 
                      League of Legends.
                    </p>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-blue-400" />
                      <div>
                        <div className="text-white font-medium">Ubicación</div>
                        <div className="text-gray-400 text-sm">Querétaro, México</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-blue-400" />
                      <div>
                        <div className="text-white font-medium">Alcance</div>
                        <div className="text-gray-400 text-sm">Comunidad regional y streaming internacional</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1 h-10 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                    <h2 className="text-2xl font-light text-white">Valores Fundamentales</h2>
                  </div>
                  
                  <div className="space-y-6">
                    {values.map((value, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center gap-3">
                          <value.icon className="w-5 h-5 text-blue-400" />
                          <h3 className="text-lg font-medium text-white">{value.title}</h3>
                        </div>
                        <p className="text-gray-400 text-sm pl-8">
                          {value.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Equipo */}
        <div className="border-b border-gray-900 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-12">
                <div className="w-1 h-10 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                <h2 className="text-2xl font-light text-white">El Equipo</h2>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8">
                {teamMembers.map((member, index) => (
                  <div key={index} className="space-y-3 pb-6 border-b border-gray-900 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-white">{member.name}</h3>
                      <Star className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-sm text-gray-400">{member.role}</div>
                    <div className="text-xs text-gray-500">{member.experience}</div>
                  </div>
                ))}
              </div>
              
              <div className="mt-12 pt-8 border-t border-gray-900">
                <div className="text-center">
                  <p className="text-gray-400 mb-6">
                    ¿Interesado en unirte al equipo o colaborar con el LQC?
                  </p>
                  <button className="px-8 py-3 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-all duration-300 text-sm">
                    Contactar al equipo
                    <ChevronRight className="w-4 h-4 inline ml-2" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Llamada a la acción */}
        <div className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-2xl font-light text-white">Forma Parte de la Historia</h2>
                  <p className="text-gray-400 max-w-2xl mx-auto">
                    Ya sea como jugador, espectador o patrocinador, hay un lugar para ti 
                    en la comunidad del LQC. Únete a nosotros en la próxima temporada.
                  </p>
                </div>
                
                <div className="flex items-center justify-center gap-4">
                  <button className="px-8 py-3 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-all duration-300 text-sm">
                    Ver Temporada Actual
                  </button>
                  <button className="px-8 py-3 bg-gray-900 text-white hover:bg-gray-800 transition-all duration-300 text-sm">
                    Unirse a Discord
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  )
}