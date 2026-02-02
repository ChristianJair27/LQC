import { useState } from 'react'
import { 
  Image as ImageIcon, Video as VideoIcon, 
  X, 
} from 'lucide-react'
import Footer from '../components/layout/Footer'

export default function Galeria() {
  const [activeFilter, setActiveFilter] = useState('todos')
  const [selectedMedia, setSelectedMedia] = useState<number | null>(null)

  const mediaItems = [
    // 2 Videos verticales – asegúrate de tener los pósters para evitar negro
    {
      id: 1,
      title: "Resumen Final Épico",
      type: "video",
      src: "/galeria/videos/video1.mp4",
      poster: "/galeria/posters/poster-video1.jpg", // ← importante: sube esta imagen
      isVertical: true,
      views: "12.4K",
      duration: "1:45",
      tags: ["Final", "Highlight", "Épico"]
    },
    {
      id: 2,
      title: "Ceremonia de Clausura y Premiación",
      type: "video",
      src: "/galeria/videos/video2.mp4",
      poster: "/galeria/posters/poster-video2.jpg", // ← importante
      isVertical: true,
      views: "9.8K",
      duration: "3:20",
      tags: ["Premiación", "Trofeos", "Celebración"]
    },

    // 14 Fotos del evento pasado – reemplaza con tus nombres reales
    ...Array.from({ length: 14 }, (_, i) => ({
      id: 3 + i,
      title: `Momento del Evento Pasado ${i + 1}`,
      type: "foto",
      src: `/galeria/evento-pasado/foto-${i + 1}.jpeg`, // ← cambia si tus nombres son distintos
      views: `${Math.floor(Math.random() * 15 + 4)}K`,
      tags: ["Evento", "Jugada", "Equipo"],
      isVertical: false,
      poster: undefined
    })),

    // 6 Fotos de finalistas – reemplaza con tus nombres reales
    ...Array.from({ length: 6 }, (_, i) => ({
      id: 17 + i,
      title: `Finalista Liga Antepasada ${i + 1}`,
      type: "foto",
      src: `/galeria/finalistas/finalista-${i + 1}.jpeg`, // ← cambia si es necesario
      views: `${Math.floor(Math.random() * 10 + 3)}K`,
      tags: ["Finalistas", "Equipo", "Trofeo"],
      isVertical: false,
      poster: undefined
    })),
  ]

  const filters = [
    { id: 'todos', label: 'Todos', count: mediaItems.length },
    { id: 'foto', label: 'Fotos', count: mediaItems.filter(m => m.type === 'foto').length },
    { id: 'video', label: 'Videos', count: mediaItems.filter(m => m.type === 'video').length },
  ]

  const filteredItems = activeFilter === 'todos'
    ? mediaItems
    : mediaItems.filter(item => item.type === activeFilter)

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Fondo minimalista */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-950 to-black" />
        <div className="absolute inset-0 opacity-5">
          <div className="h-full w-full bg-[linear-gradient(90deg,transparent_50%,rgba(255,255,255,0.02)_50%)] bg-[size:30px_30px]" />
        </div>
        <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-blue-900/20 to-transparent" />
        
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

      <div className="relative z-10">
        {/* Hero */}
        <div className="border-b border-gray-900/30 py-20 md:py-32">
          <div className="container mx-auto px-6 max-w-5xl text-center">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              Galería <span className="text-blue-500">LQC</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Revive las jugadas legendarias, celebraciones inolvidables y los momentos que definieron nuestras temporadas.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="py-10">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex flex-wrap justify-center gap-3 md:gap-4">
              {filters.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`
                    px-6 py-2.5 rounded-full text-sm md:text-base font-medium transition-all duration-300
                    ${activeFilter === filter.id
                      ? 'bg-blue-600/25 text-white border border-blue-500/40 shadow-blue-900/20 shadow-md'
                      : 'bg-gray-900/30 text-gray-300 border border-gray-700/50 hover:bg-gray-800/40 hover:border-gray-600'
                    }
                  `}
                >
                  {filter.label}
                  <span className="ml-2 opacity-70">({filter.count})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Galería Masonry */}
        <div className="py-12 pb-24">
          <div className="container mx-auto px-6 max-w-7xl">
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-5 md:gap-6 space-y-5 md:space-y-6">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  className="group break-inside-avoid cursor-pointer"
                  onClick={() => setSelectedMedia(item.id)}
                >
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-gray-950/40 to-black/60 shadow-xl shadow-black/40 transition-all duration-500 group-hover:scale-[1.03] group-hover:shadow-blue-900/30">
                    {item.type === 'video' ? (
                      <div className={item.isVertical ? "aspect-[9/16]" : "aspect-video"}>
                        <video
                          src={item.src}
                          poster={item.poster}
                          className="w-full h-full object-cover"
                          autoPlay
                          muted
                          loop
                          playsInline
                          preload="auto"
                          controls={false}
                        />
                      </div>
                    ) : (
                      <div className="aspect-video">
                        <img
                          src={item.src}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400 flex flex-col justify-end p-5">
                      <h3 className="text-lg font-medium mb-1 truncate">{item.title}</h3>
                      <div className="flex items-center justify-between text-sm text-gray-300">
                        <span>{item.views} vistas</span>
                        {'duration' in item && item.duration && (
                          <span className="flex items-center gap-1">
                            <VideoIcon className="w-3.5 h-3.5" /> {item.duration}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Badge tipo */}
                    <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/60 text-xs backdrop-blur-md border border-white/10">
                      {item.type === 'video' ? (
                        <VideoIcon className="inline w-3.5 h-3.5 mr-1.5" />
                      ) : (
                        <ImageIcon className="inline w-3.5 h-3.5 mr-1.5" />
                      )}
                      {item.type}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal */}
        {selectedMedia !== null && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
            onClick={() => setSelectedMedia(null)}
          >
            <div 
              className="relative max-w-5xl w-full max-h-[90vh] overflow-hidden rounded-2xl"
              onClick={e => e.stopPropagation()}
            >
              <button 
                className="absolute top-4 right-4 z-10 p-3 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                onClick={() => setSelectedMedia(null)}
              >
                <X className="w-6 h-6" />
              </button>

              {mediaItems.find(m => m.id === selectedMedia)?.type === 'video' ? (
                <div className={mediaItems.find(m => m.id === selectedMedia)?.type === 'video' && mediaItems.find(m => m.id === selectedMedia)?.isVertical ? "aspect-[9/16] bg-black" : "aspect-video bg-black"}>
                  <video
                    src={mediaItems.find(m => m.id === selectedMedia)?.src}
                    poster={mediaItems.find(m => m.id === selectedMedia)?.poster}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <div className="aspect-video bg-black">
                  <img
                    src={mediaItems.find(m => m.id === selectedMedia)?.src}
                    alt="Media seleccionada"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent">
                <h3 className="text-2xl md:text-3xl font-light mb-2">
                  {mediaItems.find(m => m.id === selectedMedia)?.title}
                </h3>
                <div className="flex gap-6 text-gray-300 text-sm md:text-base">
                  <span>{mediaItems.find(m => m.id === selectedMedia)?.views} vistas</span>
                  {'duration' in (mediaItems.find(m => m.id === selectedMedia) || {}) && (
                    <span className="flex items-center gap-2">
                      <VideoIcon className="w-4 h-4" />
                      {(mediaItems.find(m => m.id === selectedMedia) as any)?.duration}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <Footer />
      </div>

      {/* Animación copa */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-25px); }
        }
        .animate-float-slow {
          animation: float-slow 14s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}