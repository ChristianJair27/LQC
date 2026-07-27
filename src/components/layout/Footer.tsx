import { Link } from 'react-router-dom'
import { Twitch, Mail, Trophy, MapPin } from 'lucide-react'

/* Clases compartidas por los enlaces de las listas (Navegación y Recursos). Viven en
   constantes porque el mismo enlace se pinta como <Link> o como <a> según a dónde vaya, y
   duplicar la cadena en cada rama es la forma más fácil de que se desincronicen. */
const CLASE_ENLACE =
  'text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-2 group'
const CLASE_PUNTO =
  'w-1 h-1 rounded-full bg-gray-700 group-hover:bg-blue-400 transition-colors'

/* Al pasar de <a href> a <Link>, la navegación deja de recargar el documento y el navegador
   ya no lleva la página nueva al tope: React Router en modo declarativo (<BrowserRouter> +
   <Routes>, ver main.tsx) NO resetea el scroll, y el proyecto no tiene <ScrollRestoration>.
   Como estos enlaces viven en el PIE, se pulsan siempre con la página abajo del todo, así que
   sin esto cada clic aterriza en mitad del destino. Scroll instantáneo (el `behavior` por
   defecto) para replicar lo que hacía la recarga, y no una animación que además pelearía con
   `prefers-reduced-motion`.
   NOTA: el mismo agujero existe en los <Link> de Header.tsx. Se arregla acá y no con un
   ScrollToTop global porque eso cambia el comportamiento de todo el sitio y es otro
   propósito; queda anotado. */
const irAlTope = () => window.scrollTo({ top: 0 })

/* Navegación: mismos 6 destinos que `navItems` de Header.tsx. Si se agrega o renombra una
   página hay que tocar los dos lugares (ver AGENTS.md, "Reglas de trabajo"). */
const NAVEGACION = [
  { label: 'Inicio', to: '/' },
  { label: 'Torneos', to: '/torneos' },
  { label: 'Galería', to: '/galeria' },
  { label: 'Acerca', to: '/acerca' },
  { label: 'Contacto', to: '/contacto' },
  { label: 'Registro', to: '/registro' }
]

/* Recursos: `to: null` = todavía no hay página a dónde apuntar. Esos cuatro siguen en '#'
   a la espera de una decisión de contenido; NO son un olvido. «Inscripciones» sí tiene
   destino real desde que /registro existe. */
const RECURSOS: { label: string; to: string | null }[] = [
  { label: 'Reglamento', to: null },
  { label: 'Inscripciones', to: '/registro' },
  { label: 'Calendario', to: null },
  { label: 'Estadísticas', to: null },
  { label: 'FAQ', to: null }
]

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
              {NAVEGACION.map((item) => (
                <li key={item.label}>
                  {/* <Link> y no <a href>: en una SPA el <a> fuerza una recarga completa
                      del documento —vuelve a bajar el bundle y pierde el estado— aunque el
                      destino sea correcto. Mismo criterio que Header.tsx. */}
                  <Link to={item.to} onClick={irAlTope} className={CLASE_ENLACE}>
                    <div className={CLASE_PUNTO}></div>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Recursos */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white uppercase tracking-wider">Recursos</h4>
            <ul className="space-y-3">
              {RECURSOS.map((item) => {
                /* El interior se arma una sola vez: escribirlo en las dos ramas es la misma
                   duplicación que las constantes de clases vinieron a evitar. */
                const contenido = (
                  <>
                    <div className={CLASE_PUNTO}></div>
                    {item.label}
                  </>
                )
                return (
                  <li key={item.label}>
                    {item.to ? (
                      <Link to={item.to} onClick={irAlTope} className={CLASE_ENLACE}>
                        {contenido}
                      </Link>
                    ) : (
                      <a href="#" className={CLASE_ENLACE}>
                        {contenido}
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Redes sociales y contacto */}
          {/* Solo quedan los canales que existen de verdad: Twitch y el correo. Los iconos de
              Twitter e Instagram apuntaban a '#' con target="_blank", así que abrían una
              pestaña nueva con esta misma página: prometían una cuenta que no hay. Cuando
              existan, se reponen con su URL real, target="_blank" y rel="noopener noreferrer". */}
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
                href="mailto:contacto@revolution505.com"
                className="p-2 border border-gray-800 text-gray-500 hover:text-white hover:border-gray-700 transition-all duration-300 rounded-lg"
              >
                <Mail className="w-5 h-5" />
              </a>
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