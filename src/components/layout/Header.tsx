import { Link, useLocation } from 'react-router-dom'
import { Menu, X, Trophy, ChevronRight } from 'lucide-react'  // Quitamos Twitch
import { useState } from 'react'


const navItems = [
  { to: '/', label: 'Inicio', icon: Trophy },
  { to: '/torneos', label: 'Torneos', icon: Trophy },
  { to: '/galeria', label: 'Galería', icon: Trophy },
  { to: '/acerca', label: 'Acerca', icon: Trophy },
  { to: '/contacto', label: 'Contacto', icon: Trophy },
]

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  
  const isActive = (path: string) => location.pathname === path

  return (
    <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo LQC - con imagen personalizada */}
<Link to="/" className="flex items-center gap-3 transition-transform hover:scale-105">
  <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-blue-900/40 to-blue-800/30 border-2 border-blue-700/50 shadow-lg shadow-blue-900/30 flex items-center justify-center">
    <img 
      src="/assets/LOGO COPA.png"  // ← Cambia esto por la ruta real de TU imagen (ej: /assets/tu-foto-o-logo.png)
      alt="LQC Querétaro Logo" 
      className="w-full h-full object-cover"  // object-cover para que llene bien el círculo sin distorsión
    />
  </div>
  <div className="flex flex-col">
    <div className="text-xl md:text-2xl font-bold text-white tracking-tight leading-none w-30">
      <img 
      src="/assets/2 LQC.png"  
      alt="LQC Querétaro Logo" 
      
    />
    </div>
    
  </div>
</Link>

          {/* Navegación Desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`
                  px-5 py-2 text-sm font-medium transition-all duration-300 relative
                  ${isActive(item.to) 
                    ? 'text-white' 
                    : 'text-gray-500 hover:text-gray-300'
                  }
                `}
              >
                {item.label}
                {isActive(item.to) && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-0.1 bg-gradient-to-r from-blue-600 to-blue-400"></div>
                )}
              </Link>
            ))}
          </nav>

          {/* Reemplazo: Promo Revolution505 en desktop */}
          <div className="hidden sm:flex items-center gap-4">
            <a
              href="https://revolution505.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 transition-all duration-300 text-sm rounded-lg"
            >
              {/* Logo Revolution505 */}
              <img
  src="/images/revolution505-logo.png"
  alt="Revolution505"
  width={28}
  height={28}
  loading="lazy"
  className="object-contain rounded"
/>
              <span>Revolution505</span>
              <ChevronRight size={14} />
            </a>

            {/* Botón menú móvil */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-gray-400 hover:text-white transition-colors p-2"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Menú móvil */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-900 bg-black/95 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <nav className="flex flex-col">
              {navItems.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center justify-between px-4 py-3 text-lg transition-all duration-300 border-b border-gray-900 last:border-0
                    ${isActive(item.to) 
                      ? 'text-white' 
                      : 'text-gray-400 hover:text-white'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${isActive(item.to) ? 'bg-blue-400' : 'bg-gray-700'}`}></div>
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${isActive(item.to) ? 'text-blue-400' : 'text-gray-600'}`} />
                </Link>
              ))}
              
              {/* Promo Revolution505 en móvil */}
              <a
                href="https://revolution505.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-4 py-3 text-lg text-gray-400 hover:text-white transition-colors border-t border-gray-900 mt-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center gap-3">
                  <img
  src="/images/revolution505-logo.png"
  alt="Revolution505"
  width={28}
  height={28}
  loading="lazy"
  className="object-contain rounded"
/>
                  <span>Revolution505</span>
                </div>
                <ChevronRight className="w-5 h-5" />
              </a>
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}