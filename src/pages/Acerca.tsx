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
    { title: "Competitividad", description: "Fomentamos el juego al más alto nivel con integridad deportiva", icon: Trophy },
    { title: "Comunidad", description: "Un espacio donde jugadores y fans se unen por la pasión al juego", icon: Users },
    { title: "Innovación", description: "Constantemente mejorando el formato y experiencia del torneo", icon: Target },
    { title: "Accesibilidad", description: "Oportunidades para equipos de todos los niveles en Querétaro", icon: Heart },
  ]

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
                Acerca de LQC
              </h1>

              <p className="text-xl text-gray-300 max-w-3xl mt-6 leading-relaxed">
                El torneo más competitivo y prestigioso de League of Legends en Querétaro, 
                donde la pasión por los esports se encuentra con la excelencia competitiva.
              </p>

              <div className="inline-flex items-center gap-4 mt-8">
                <span className="px-6 py-2.5 text-base bg-blue-950/40 text-blue-300 backdrop-blur-sm border border-blue-800/30 rounded-full shadow-lg">
                  Desde 2019
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Estadísticas */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div 
                  key={index} 
                  className="bg-black/30 backdrop-blur-sm p-8 rounded-2xl border border-white/5 text-center hover:border-blue-500/30 hover:shadow-blue-900/20 transition-all duration-300 group"
                >
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-900/40 to-blue-800/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <stat.icon className="w-8 h-8 text-blue-400" />
                    </div>
                  </div>
                  <div className="text-4xl font-light mb-2">{stat.value}</div>
                  <div className="text-sm text-gray-400 uppercase tracking-wider">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Nuestra Historia */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex items-center gap-4 mb-16">
              <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
              <h2 className="text-3xl font-light">Nuestra Historia</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-12 mb-16">
              <div className="space-y-6">
                <h3 className="text-2xl font-light">Orígenes</h3>
                <p className="text-gray-300 leading-relaxed text-lg">
                  Fundado en 2019, el LQC nació de la visión de crear un espacio competitivo serio para la creciente comunidad de League of Legends en Querétaro. Lo que comenzó como un torneo local entre amigos rápidamente evolucionó en el campeonato más importante de la región.
                </p>
              </div>
              
              <div className="space-y-6">
                <h3 className="text-2xl font-light">Evolución</h3>
                <p className="text-gray-300 leading-relaxed text-lg">
                  A lo largo de más de 12 temporadas, hemos refinado nuestro formato, implementado sistemas profesionales de competencia y construido una comunidad sólida. Hoy, el LQC es referencia de esports estudiantil y amateur en el centro de México.
                </p>
              </div>
            </div>

            {/* Línea de tiempo */}
            <div className="space-y-10">
              <div className="flex items-center gap-4 mb-8">
                <Calendar className="w-6 h-6 text-blue-400" />
                <h3 className="text-2xl font-light">Hitos Importantes</h3>
              </div>

              <div className="space-y-8">
                {milestones.map((milestone, index) => (
                  <div 
                    key={index} 
                    className="flex items-start gap-6 bg-black/30 backdrop-blur-sm p-6 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all duration-300"
                  >
                    <div className="w-20 flex-shrink-0 text-center">
                      <div className="text-2xl font-medium text-blue-400">{milestone.year}</div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-medium mb-2">{milestone.event}</h4>
                      <p className="text-gray-400">{milestone.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Misión y Valores */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid md:grid-cols-2 gap-16">
              <div className="space-y-10">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
                  <h2 className="text-3xl font-light">Nuestra Misión</h2>
                </div>
                <p className="text-gray-300 leading-relaxed text-lg">
                  Crear y mantener el ecosistema competitivo de esports más sólido en Querétaro, proporcionando a jugadores de todos los niveles una plataforma profesional para demostrar su talento, mientras construimos una comunidad unida alrededor de la pasión por League of Legends.
                </p>

                <div className="space-y-6 mt-10">
                  <div className="flex items-center gap-4 bg-black/30 backdrop-blur-sm p-5 rounded-xl border border-white/5">
                    <MapPin className="w-6 h-6 text-blue-400 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Ubicación</div>
                      <div className="text-gray-400 text-sm">Querétaro, México</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-black/30 backdrop-blur-sm p-5 rounded-xl border border-white/5">
                    <Globe className="w-6 h-6 text-blue-400 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Alcance</div>
                      <div className="text-gray-400 text-sm">Comunidad regional y streaming internacional</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-10">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
                  <h2 className="text-3xl font-light">Valores Fundamentales</h2>
                </div>

                <div className="grid gap-6">
                  {values.map((value, index) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-5 bg-black/30 backdrop-blur-sm p-6 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all duration-300 group"
                    >
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-900/40 to-blue-800/30 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                        <value.icon className="w-7 h-7 text-blue-300" />
                      </div>
                      <div>
                        <h3 className="text-xl font-medium mb-2">{value.title}</h3>
                        <p className="text-gray-400">{value.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Equipo */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex items-center gap-4 mb-16">
              <div className="w-1.5 h-12 bg-gradient-to-t from-blue-600 to-blue-400 rounded-full" />
              <h2 className="text-3xl font-light">El Equipo</h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {teamMembers.map((member, index) => (
                <div 
                  key={index} 
                  className="bg-black/30 backdrop-blur-sm p-8 rounded-2xl border border-white/5 hover:border-blue-500/30 hover:shadow-blue-900/20 transition-all duration-300 text-center"
                >
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-gray-800/50 to-gray-700/30 flex items-center justify-center">
                    <Star className="w-8 h-8 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">{member.name}</h3>
                  <div className="text-blue-300 mb-2">{member.role}</div>
                  <div className="text-sm text-gray-400">{member.experience}</div>
                </div>
              ))}
            </div>

            <div className="mt-16 text-center">
              <p className="text-gray-300 mb-8 text-lg">
                ¿Interesado en unirte al equipo o colaborar con el LQC?
              </p>
              <button className="inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-blue-900/40 to-purple-900/20 border border-blue-700/30 text-gray-200 rounded-xl hover:from-blue-800/50 hover:to-purple-800/30 transition-all duration-300 shadow-lg shadow-blue-900/20">
                Contactar al equipo
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-20">
          <div className="container mx-auto px-6 max-w-4xl text-center">
            <div className="bg-gradient-to-br from-blue-950/30 to-purple-950/20 backdrop-blur-md border border-blue-800/20 rounded-3xl p-12 shadow-2xl shadow-black/50">
              <h2 className="text-3xl font-light mb-6">Forma Parte de la Historia</h2>
              <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
                Ya sea como jugador, espectador o patrocinador, hay un lugar para ti en la comunidad del LQC. Únete a nosotros en la próxima temporada.
              </p>

              <div className="flex flex-wrap justify-center gap-6">
                <button className="px-10 py-4 border border-blue-800/40 text-gray-200 rounded-xl hover:bg-blue-900/30 transition-all duration-300">
                  Ver Temporada Actual
                </button>
                <button className="px-10 py-4 bg-gradient-to-r from-blue-700 to-purple-700 rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-300 shadow-lg shadow-blue-900/30">
                  Unirse a Discord
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