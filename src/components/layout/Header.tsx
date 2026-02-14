import { Link, useLocation } from 'react-router-dom'
import { Menu, X, ChevronRight } from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { to: '/', label: 'Inicio' },
  { to: '/torneos', label: 'Torneos' },
  { to: '/galeria', label: 'Galería' },
  { to: '/acerca', label: 'Acerca' },
  { to: '/contacto', label: 'Contacto' },
]

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  
  const isActive = (path: string) => location.pathname === path

  return (
    <header className="sticky top-0 z-50 bg-black border-b border-gray-800/80 shadow-lg shadow-black/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 md:h-20">
          {/* Logo - grande, prominente y sin morado */}
          <Link 
            to="/" 
            className="flex items-center gap-3 md:gap-4 transition-transform hover:scale-105 duration-300"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-xl overflow-hidden bg-gradient-to-br from-blue-950 to-blue-900 border-2 border-blue-700/70 shadow-xl shadow-blue-900/50 flex items-center justify-center">
              <img 
                src="/assets/LOGO COPA.png"
                alt="LQC Trophy"
                className="w-10 h-10 md:w-12 md:h-12 object-contain p-1"
              />
            </div>
            
            <img 
              src="/assets/2 LQC.png"
              alt="League Querétaro Championship"
              className="h-9 md:h-11 w-auto object-contain drop-shadow-lg"
            />
          </Link>

          {/* Navegación Desktop */}
          <nav className="hidden md:flex items-center gap-2 lg:gap-8">
            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`
                  relative px-4 lg:px-5 py-2.5 text-base lg:text-lg font-medium transition-all duration-300 group
                  ${isActive(item.to)
                    ? 'text-white'
                    : 'text-gray-300 hover:text-white'
                  }
                `}
              >
                {item.label}
                <span 
                  className={`
                    absolute bottom-1.5 left-4 right-4 h-0.5 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full
                    transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center
                    ${isActive(item.to) ? 'scale-x-100' : ''}
                  `}
                />
              </Link>
            ))}
          </nav>

          {/* Acciones derecha */}
          <div className="flex items-center gap-4 md:gap-6">
            {/* Promo Revolution505 */}
            <a
              href="https://revolution505.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-3 px-5 py-2.5 bg-gray-900 border border-gray-700 hover:border-blue-600 text-gray-200 hover:text-white rounded-lg transition-all duration-300 shadow-md hover:shadow-blue-900/40 text-sm font-medium"
            >
              <img
                src="/images/revolution505-logo.png"
                alt="Revolution505"
                className="w-7 h-7 object-contain rounded"
              />
              <span>Revolution505</span>
              <ChevronRight className="w-4 h-4" />
            </a>

            {/* Menú móvil - siempre visible en móvil */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-200 hover:text-white focus:outline-none transition-colors"
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            >
              {mobileMenuOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menú móvil - slide desde arriba */}
      <div 
        className={`
          md:hidden fixed inset-x-0 top-0 z-40 transform transition-transform duration-500 ease-in-out
          ${mobileMenuOpen 
            ? 'translate-y-0' 
            : '-translate-y-full'
          }
        `}
      >
        <div className="bg-black border-b border-gray-800/80 shadow-2xl shadow-black/70 pt-20 pb-10">
          <div className="container mx-auto px-6">
            <nav className="flex flex-col gap-3">
              {navItems.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center justify-between px-6 py-4 text-xl font-medium rounded-xl transition-all duration-300 border border-transparent
                    ${isActive(item.to)
                      ? 'bg-blue-950/60 text-white border-blue-700/50 shadow-md shadow-blue-900/40'
                      : 'text-gray-300 hover:bg-gray-900/70 hover:text-white hover:border-blue-800/40'
                    }
                  `}
                >
                  <span>{item.label}</span>
                  <ChevronRight className="w-6 h-6 opacity-70" />
                </Link>
              ))}

              {/* Promo en móvil */}
              <a
                href="https://revolution505.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-4 flex items-center justify-between px-6 py-4 text-xl font-medium bg-gray-900 border border-gray-700 hover:border-blue-600 rounded-xl transition-all duration-300 text-gray-200 hover:text-white shadow-md"
              >
                <div className="flex items-center gap-4">
                  <img
                    src="/images/revolution505-logo.png"
                    alt="Revolution505"
                    className="w-9 h-9 object-contain rounded"
                  />
                  <span>Revolution505</span>
                </div>
                <ChevronRight className="w-6 h-6" />
              </a>
            </nav>
          </div>
        </div>
      </div>

      {/* Overlay para cerrar al tocar fuera */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/70 z-30 transition-opacity duration-500"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </header>
  )
}