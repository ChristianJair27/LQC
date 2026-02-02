import { Twitch, Mail, Instagram, Twitter, Trophy, MapPin, ChevronRight } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="bg-black border-t border-gray-900">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo y descripción */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-800/30 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="text-lg font-bold text-white">LQC</div>
                <div className="text-xs text-gray-500 tracking-wider">QUERÉTARO</div>
              </div>
            </div>
            
            <p className="text-sm text-gray-400 leading-relaxed">
              League Querétaro Championship<br />
              El torneo competitivo de League of Legends más importante de la región.
            </p>
            
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <MapPin className="w-4 h-4" />
              <span>Querétaro, México</span>
            </div>
          </div>

          {/* Enlaces rápidos */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white uppercase tracking-wider">Navegación</h4>
            <ul className="space-y-3">
              {[
                { label: 'Inicio', path: '/' },
                { label: 'Torneos', path: '/torneos' },
                { label: 'Galería', path: '/galeria' },
                { label: 'Acerca', path: '/acerca' },
                { label: 'Contacto', path: '/contacto' }
              ].map((item) => (
                <li key={item.label}>
                  <a 
                    href={item.path} 
                    className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-2 group"
                  >
                    <div className="w-1 h-1 rounded-full bg-gray-700 group-hover:bg-blue-400 transition-colors"></div>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Recursos */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white uppercase tracking-wider">Recursos</h4>
            <ul className="space-y-3">
              {[
                { label: 'Reglamento', action: '#' },
                { label: 'Inscripciones', action: '#' },
                { label: 'Calendario', action: '#' },
                { label: 'Estadísticas', action: '#' },
                { label: 'FAQ', action: '#' }
              ].map((item) => (
                <li key={item.label}>
                  <a 
                    href={item.action} 
                    className="text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-2 group"
                  >
                    <div className="w-1 h-1 rounded-full bg-gray-700 group-hover:bg-blue-400 transition-colors"></div>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Redes sociales y contacto */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-white uppercase tracking-wider">Conectar</h4>
              <div className="flex items-center gap-3">
                <a 
                  href="https://twitch.tv/lqroc" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 border border-gray-800 text-gray-500 hover:text-white hover:border-gray-700 transition-all duration-300 rounded-lg group"
                >
                  <Twitch className="w-5 h-5" />
                  <div className="absolute -top-2 -right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </a>
                
                <a 
                  href="#" 
                  target="_blank" 
                  className="p-2 border border-gray-800 text-gray-500 hover:text-white hover:border-gray-700 transition-all duration-300 rounded-lg"
                >
                  <Twitter className="w-5 h-5" />
                </a>
                
                <a 
                  href="#" 
                  target="_blank" 
                  className="p-2 border border-gray-800 text-gray-500 hover:text-white hover:border-gray-700 transition-all duration-300 rounded-lg"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                
                <a 
                  href="mailto:contacto@revolution505.com" 
                  className="p-2 border border-gray-800 text-gray-500 hover:text-white hover:border-gray-700 transition-all duration-300 rounded-lg"
                >
                  <Mail className="w-5 h-5" />
                </a>
              </div>
            </div>
            
            {/* Newsletter */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white uppercase tracking-wider">Notificaciones</h4>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  className="flex-1 px-3 py-2 text-sm bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-600 focus:border-blue-600 focus:outline-none transition-colors"
                />
                <button className="px-3 py-2 text-sm bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-all duration-300 rounded-lg">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Recibe noticias sobre próximos torneos.
              </p>
            </div>
          </div>
        </div>

        {/* Separador */}
        <div className="my-8 border-t border-gray-900"></div>

        {/* Información legal y copyright */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="text-xs text-gray-600">
            © {new Date().getFullYear()} League Querétaro Championship
          </div>
          
          <div className="text-center">
            <div className="text-xs text-gray-600">
              Design by Revolution505
            </div>
          </div>
          
          <div className="text-right space-y-2">
            <div className="text-xs text-gray-600">
              Este evento no está afiliado con Riot Games ni League of Legends.
            </div>
            <div className="flex items-center justify-end gap-4">
              <a href="#" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                Términos
              </a>
              <a href="#" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                Privacidad
              </a>
              <a href="#" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                Cookies
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}