import { useState } from 'react'
import { 
  Image, Video, Users, Trophy, Award, Star, 
  Filter, Grid, Calendar, MapPin, Download, Share2, X, ChevronRight 
} from 'lucide-react'
import Footer from '../components/layout/Footer'

export default function Galeria() {
  const [activeFilter, setActiveFilter] = useState('todos')
  const [selectedMedia, setSelectedMedia] = useState<number | null>(null)

  const filters = [
    { id: 'todos', label: 'Todos', count: 24 },
    { id: 'fotos', label: 'Fotos', count: 12 },
    { id: 'videos', label: 'Videos', count: 8 },
    { id: 'momentos', label: 'Momentos', count: 4 },
  ]

  const galleries = [
    {
      id: 1,
      title: "Grand Final Otoño 2025",
      season: "Otoño 2025",
      type: "video",
      thumbnail: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80",
      views: "15.2K",
      duration: "4:32",
      tags: ["Final", "Team Phoenix", "Épico"]
    },
    {
      id: 2,
      title: "Ceremonia de Premiación",
      season: "Verano 2025",
      type: "foto",
      thumbnail: "https://images.unsplash.com/photo-1598136490937-f77b0ce520fe?auto=format&fit=crop&w=800&q=80",
      views: "8.7K",
      likes: "1.2K",
      tags: ["Premios", "Trophy", "Celebración"]
    },
    {
      id: 3,
      title: "Pentakill Legendario",
      season: "Primavera 2025",
      type: "momento",
      thumbnail: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80",
      views: "12.4K",
      duration: "0:48",
      tags: ["Jugada", "Highlight", "Pentakill"]
    },
    {
      id: 4,
      title: "Backstage del Torneo",
      season: "Invierno 2024",
      type: "foto",
      thumbnail: "https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=800&q=80",
      views: "5.3K",
      likes: "845",
      tags: ["Tras bambalinas", "Equipos", "Preparación"]
    },
    {
      id: 5,
      title: "Entrevista al Campeón",
      season: "Otoño 2025",
      type: "video",
      thumbnail: "https://images.unsplash.com/photo-1574267432553-4b4628081c31?auto=format&fit=crop&w=800&q=80",
      views: "7.8K",
      duration: "6:15",
      tags: ["Entrevista", "Campeón", "Team Phoenix"]
    },
    {
      id: 6,
      title: "Fans en el Arena",
      season: "Verano 2025",
      type: "foto",
      thumbnail: "https://images.unsplash.com/photo-1533134486753-c833f0ed4866?auto=format&fit=crop&w=800&q=80",
      views: "9.1K",
      likes: "2.3K",
      tags: ["Comunidad", "Fans", "Arena"]
    }
  ]

  const featuredContent = {
    title: "Momento Destacado de la Semana",
    description: "La jugada definitiva que coronó al campeón de Otoño 2025",
    stats: {
      views: "25.4K",
      likes: "3.8K",
      shares: "1.2K"
    }
  }

  const mediaTypes = {
    video: { icon: Video, color: "text-blue-400", bg: "bg-blue-900/20" },
    foto: { icon: Image, color: "text-green-400", bg: "bg-green-900/20" },
    momento: { icon: Star, color: "text-yellow-400", bg: "bg-yellow-900/20" }
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Fondo minimalista */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-950 to-black"></div>
        <div className="absolute inset-0 opacity-5">
          <div className="h-full w-full bg-[linear-gradient(45deg,transparent_50%,rgba(255,255,255,0.02)_50%)] bg-[length:40px_40px]"></div>
        </div>
        <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-blue-900/10 to-transparent"></div>
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
                    Galería de
                  </h1>
                  <div className="flex items-center gap-3">
                    <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white">
                      Momentos
                    </h1>
                    <span className="px-3 py-1 text-sm bg-blue-900/30 text-blue-400 border border-blue-800/50 rounded-full">
                      Fotos y Videos
                    </span>
                  </div>
                </div>
              </div>
              
              <p className="text-lg text-gray-400 font-light max-w-2xl leading-relaxed">
                Revive los mejores momentos, jugadas épicas y celebraciones 
                memorables de todas las temporadas del LQC.
              </p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="border-b border-gray-900 py-8">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Filter className="w-5 h-5 text-blue-400" />
                  <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                    Filtrar por
                  </h2>
                </div>
                <div className="text-sm text-gray-500">
                  {galleries.length} elementos
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                {filters.map((filter) => {
                  const isActive = activeFilter === filter.id
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setActiveFilter(filter.id)}
                      className={`
                        px-4 py-2 text-sm font-medium transition-all duration-300 border
                        ${isActive 
                          ? 'border-blue-600 text-white bg-blue-900/10' 
                          : 'border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700'
                        }
                      `}
                    >
                      {filter.label}
                      <span className={`ml-2 ${isActive ? 'text-blue-400' : 'text-gray-600'}`}>
                        ({filter.count})
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Contenido destacado */}
        <div className="border-b border-gray-900 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1 h-10 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                <h2 className="text-2xl font-light text-white">Destacado</h2>
              </div>
              
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-xl font-light text-white">{featuredContent.title}</h3>
                  <p className="text-gray-400 leading-relaxed">
                    {featuredContent.description}
                  </p>
                  
                  <div className="flex items-center gap-6 pt-4">
                    {Object.entries(featuredContent.stats).map(([key, value]) => (
                      <div key={key} className="space-y-1">
                        <div className="text-2xl font-light text-white">{value}</div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">
                          {key === 'views' && 'Vistas'}
                          {key === 'likes' && 'Me gusta'}
                          {key === 'shares' && 'Compartidos'}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-4 pt-4">
                    <button className="px-6 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-all duration-300 text-sm">
                      Ver completo
                    </button>
                    <button className="px-6 py-2 bg-gray-900 text-white hover:bg-gray-800 transition-all duration-300 text-sm flex items-center gap-2">
                      <Share2 className="w-4 h-4" />
                      Compartir
                    </button>
                  </div>
                </div>
                
                <div className="relative">
                  <div className="aspect-video bg-gradient-to-br from-blue-900/20 to-gray-900/30 border border-gray-800 rounded-lg overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 flex items-center justify-center mx-auto mb-4">
                          <Video className="w-10 h-10 text-white" />
                        </div>
                        <div className="text-gray-400">Video destacado</div>
                      </div>
                    </div>
                    <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/70 text-white text-sm rounded-full">
                      4:32
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Galería principal */}
        <div className="py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <Grid className="w-5 h-5 text-blue-400" />
                  <h2 className="text-2xl font-light text-white">Galería Completa</h2>
                </div>
                <div className="flex items-center gap-4">
                  <button className="text-sm text-gray-500 hover:text-white transition-colors">
                    <span className="hidden sm:inline">Vista previa</span>
                    <ChevronRight className="w-4 h-4 inline ml-1" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {galleries.map((item) => {
                  const MediaIcon = mediaTypes[item.type as keyof typeof mediaTypes].icon
                  const iconColor = mediaTypes[item.type as keyof typeof mediaTypes].color
                  const iconBg = mediaTypes[item.type as keyof typeof mediaTypes].bg
                  
                  return (
                    <div 
                      key={item.id}
                      className="group cursor-pointer"
                      onClick={() => setSelectedMedia(item.id)}
                    >
                      <div className="relative overflow-hidden rounded-lg border border-gray-900 group-hover:border-gray-700 transition-all duration-300">
                        {/* Thumbnail */}
                        <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 relative">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <div className={`w-16 h-16 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-3`}>
                                <MediaIcon className={`w-8 h-8 ${iconColor}`} />
                              </div>
                              <div className="text-gray-500 text-sm">Imagen representativa</div>
                            </div>
                          </div>
                          
                          {/* Overlay info */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <div className="flex items-center justify-between">
                                <div className="text-white font-medium truncate">{item.title}</div>
                                <div className="text-xs text-gray-400">
                                  {item.type === 'video' || item.type === 'momento' ? item.duration : `${item.likes} likes`}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Type indicator */}
                          <div className="absolute top-3 left-3">
                            <div className={`px-2 py-1 text-xs ${iconBg} ${iconColor} rounded-full`}>
                              {item.type}
                            </div>
                          </div>
                        </div>
                        
                        {/* Content info */}
                        <div className="p-4 bg-gray-950/50">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-white font-medium truncate">{item.title}</h3>
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              👁️ {item.views}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-400">{item.season}</div>
                            <div className="flex items-center gap-1">
                              {item.tags.slice(0, 2).map((tag, idx) => (
                                <span key={idx} className="text-xs px-2 py-0.5 bg-gray-900 text-gray-500 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Modal de visualización */}
        {selectedMedia !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
            <div className="max-w-4xl w-full bg-gray-950 border border-gray-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-900">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-6 bg-gradient-to-b from-blue-600 to-blue-400"></div>
                  <h3 className="text-lg font-medium text-white">
                    {galleries.find(g => g.id === selectedMedia)?.title}
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedMedia(null)}
                  className="p-2 hover:bg-gray-900 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 flex items-center justify-center mx-auto mb-6">
                    <Video className="w-12 h-12 text-white" />
                  </div>
                  <div className="text-gray-400 mb-4">Vista previa del contenido</div>
                  <div className="text-sm text-gray-500">
                    En desarrollo - Próximamente disponible
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-900">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="text-sm text-gray-400">
                      Temporada: <span className="text-white">{galleries.find(g => g.id === selectedMedia)?.season}</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      Vistas: <span className="text-white">{galleries.find(g => g.id === selectedMedia)?.views}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-all duration-300 text-sm">
                      <Download className="w-4 h-4 inline mr-2" />
                      Descargar
                    </button>
                    <button className="px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 transition-all duration-300 text-sm">
                      <Share2 className="w-4 h-4 inline mr-2" />
                      Compartir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Colecciones por temporada */}
        <div className="border-t border-gray-900 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center gap-3 mb-10">
                <Calendar className="w-5 h-5 text-blue-400" />
                <h2 className="text-2xl font-light text-white">Por Temporada</h2>
              </div>
              
              <div className="space-y-6">
                {[
                  { season: "Otoño 2025", items: 8, color: "from-blue-900/30 to-blue-800/20" },
                  { season: "Verano 2025", items: 6, color: "from-gray-900/30 to-gray-800/20" },
                  { season: "Primavera 2025", items: 5, color: "from-gray-900/30 to-gray-800/20" },
                  { season: "Invierno 2024", items: 5, color: "from-gray-900/30 to-gray-800/20" },
                ].map((collection, index) => (
                  <div 
                    key={index}
                    className={`p-6 border border-gray-900 rounded-lg hover:border-gray-700 transition-all duration-300 ${collection.color}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-white mb-1">{collection.season}</h3>
                        <div className="text-sm text-gray-400">{collection.items} elementos</div>
                      </div>
                      <button className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-1">
                        Ver colección
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  )
}