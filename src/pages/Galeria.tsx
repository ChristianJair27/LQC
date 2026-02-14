import { useState } from 'react'
import { Image as ImageIcon, Video as VideoIcon, X } from 'lucide-react'


type MediaItem = {
  id: number;
  title: string;
  type: 'foto' | 'video' | string;
  src: string;
  poster?: string;
  isVertical: boolean;
  views: string;
  duration?: string;
  tags: string[];
};

export default function Galeria() {
  const [activeFilter, setActiveFilter] = useState('todos')
  const [selectedMedia, setSelectedMedia] = useState<number | null>(null)

  const mediaItems: MediaItem[] = [
    // Videos verticales (reels/highlights típicos de esports)
    {
      id: 1,
      title: "Resumen Final Épico",
      type: "video",
      src: "/galeria/videos/video1.mp4",
      poster: "/galeria/posters/poster-video1.jpg",
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
      poster: "/galeria/posters/poster-video2.jpg",
      isVertical: true,
      views: "9.8K",
      duration: "3:20",
      tags: ["Premiación", "Trofeos", "Celebración"]
    },

    // Fotos placeholders – reemplaza src con tus paths reales
    ...Array.from({ length: 14 }, (_, i) => ({
      id: 3 + i,
      title: `Momento Épico ${i + 1}`,
      type: "foto",
      src: `/galeria/evento-pasado/foto-${i + 1}.jpeg`,
      views: `${Math.floor(Math.random() * 15 + 5)}K`,
      tags: ["Jugada", "Equipo", "Evento"],
      isVertical: Math.random() > 0.6 // algunos verticales para variedad
    })),

    ...Array.from({ length: 6 }, (_, i) => ({
      id: 17 + i,
      title: `Finalista Destacado ${i + 1}`,
      type: "foto",
      src: `/galeria/finalistas/finalista-${i + 1}.jpeg`,
      views: `${Math.floor(Math.random() * 10 + 4)}K`,
      tags: ["Final", "Trofeo", "Equipo"],
      isVertical: false
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
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white">
      {/* Fondo decorativo */}
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
            <h1 className="text-5xl md:text-7xl font-extralight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-blue-300 to-purple-400 mb-6">
              Galería LQC
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Momentos legendarios, jugadas inolvidables y celebraciones que definieron nuestras temporadas.
            </p>
          </div>
        </section>

        {/* Filtros */}
        <section className="py-12 bg-black/20">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="flex flex-wrap justify-center gap-4">
              {filters.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={`
                    px-6 py-3 rounded-full text-base font-medium transition-all duration-300 backdrop-blur-sm border
                    ${activeFilter === filter.id
                      ? 'bg-blue-900/40 border-blue-600 text-white shadow-lg shadow-blue-900/30'
                      : 'bg-black/30 border-white/10 text-gray-300 hover:border-blue-500/50 hover:text-white'
                    }
                  `}
                >
                  {filter.label} <span className="ml-2 opacity-70">({filter.count})</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Masonry Grid */}
        <section className="py-16 pb-24">
          <div className="container mx-auto px-6 max-w-7xl">
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  className="group break-inside-avoid cursor-pointer"
                  onClick={() => setSelectedMedia(item.id)}
                >
                  <div className="relative overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md border border-white/5 shadow-xl shadow-black/40 transition-all duration-500 group-hover:scale-[1.03] group-hover:shadow-blue-900/40 group-hover:border-blue-500/30">
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
                          preload="metadata"
                          controls={false}
                        />
                      </div>
                    ) : (
                      <div className={item.isVertical ? "aspect-[9/16]" : "aspect-square md:aspect-video"}>
                        <img
                          src={item.src}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    {/* Overlay info */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400 flex flex-col justify-end p-6">
                      <h3 className="text-lg font-medium mb-2 truncate">{item.title}</h3>
                      <div className="flex items-center justify-between text-sm text-gray-300">
                        <span>{item.views} vistas</span>
                        {item.duration && (
                          <span className="flex items-center gap-2">
                            <VideoIcon className="w-4 h-4" /> {item.duration}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Badge */}
                    <div className="absolute top-4 right-4 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium flex items-center gap-2">
                      {item.type === 'video' ? <VideoIcon className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                      {item.type}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Modal */}
        {selectedMedia !== null && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4"
            onClick={() => setSelectedMedia(null)}
          >
            <div
              className="relative max-w-6xl w-full max-h-[95vh] overflow-hidden rounded-2xl shadow-2xl shadow-black/80"
              onClick={e => e.stopPropagation()}
            >
              <button
                className="absolute top-4 right-4 z-20 p-4 bg-black/60 rounded-full hover:bg-black/80 transition-all backdrop-blur-md"
                onClick={() => setSelectedMedia(null)}
              >
                <X className="w-7 h-7" />
              </button>

              {mediaItems.find(m => m.id === selectedMedia)?.type === 'video' ? (
                <div className={mediaItems.find(m => m.id === selectedMedia)?.isVertical ? "aspect-[9/16] bg-black" : "aspect-video bg-black"}>
                  <video
                    src={mediaItems.find(m => m.id === selectedMedia)?.src}
                    poster={mediaItems.find(m => m.id === selectedMedia)?.poster}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <img
                  src={mediaItems.find(m => m.id === selectedMedia)?.src}
                  alt={mediaItems.find(m => m.id === selectedMedia)?.title}
                  className="w-full h-auto max-h-[90vh] object-contain"
                />
              )}

              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 to-transparent">
                <h3 className="text-2xl md:text-4xl font-light mb-3">
                  {mediaItems.find(m => m.id === selectedMedia)?.title}
                </h3>
                <div className="flex gap-8 text-gray-300 text-base md:text-lg">
                  <span>{mediaItems.find(m => m.id === selectedMedia)?.views} vistas</span>
                  {mediaItems.find(m => m.id === selectedMedia)?.duration && (
                    <span className="flex items-center gap-3">
                      <VideoIcon className="w-5 h-5" />
                      {mediaItems.find(m => m.id === selectedMedia)?.duration}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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