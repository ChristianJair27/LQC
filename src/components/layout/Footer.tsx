import { Link } from 'react-router-dom'
import { Twitch, Facebook, MessageSquare, Mail, Trophy, MapPin } from 'lucide-react'

/* Enlaces de la lista de Navegación. Quedan en constantes —aunque hoy cada una se use en un
   solo lugar— para reponer una segunda lista con el mismo aspecto sin copiar la cadena. */
const CLASE_ENLACE =
  'text-sm text-gray-500 hover:text-white transition-colors flex items-center gap-2 group'
const CLASE_PUNTO =
  'w-1 h-1 rounded-full bg-gray-700 group-hover:bg-blue-400 transition-colors'

/* Botonera de iconos de "Conectar". En constante porque son cuatro enlaces con la misma
   caja; el de Twitch además le suma `group` para su punto pulsante.
   `after:hidden` desactiva la barra de gradiente que la regla base `a::after` de index.css
   dibuja al 100% del ancho en hover: pensada para enlaces de texto, en estos botones
   cuadrados con borde quedaba colgando 2px por debajo de la caja. Mismo parche —y misma
   razón— que `CLASE_ENLACE_COMUNIDAD` en Registro.tsx. */
const CLASE_ICONO =
  'after:hidden p-2 border border-gray-800 text-gray-500 hover:text-white hover:border-gray-700 transition-all duration-300 rounded-lg'

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

/* NO HAY BLOQUE "RECURSOS". Tenía cinco ítems y cuatro —Reglamento, Calendario,
   Estadísticas y FAQ— apuntaban a '#': prometían páginas que no existen. El quinto,
   «Inscripciones», iba a /registro, o sea al mismo destino que «Registro» de acá arriba: una
   sección de un solo enlace, duplicando con otro nombre al de la columna de al lado.
   Cuando alguna de esas cuatro páginas exista de verdad, se repone la sección con su ruta
   real y su <Link> — NUNCA con '#'. Un enlace a '#' no es un placeholder: es una promesa
   rota que el usuario descubre recién al hacer clic. */

export default function Footer() {
  return (
    <footer className="bg-black border-t border-gray-900">
      <div className="container mx-auto px-4 py-12">
        {/* Tres columnas, no cuatro: al irse el bloque "Recursos" quedaba una columna
            fantasma y las tres restantes apretadas contra el borde izquierdo. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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

          {/* Redes sociales y contacto. Solo canales que EXISTEN: acá vivían iconos de Twitter
              e Instagram apuntando a '#', que abrían una pestaña nueva con esta misma página y
              prometían cuentas que no hay. Si aparece un canal nuevo se repone con su URL real,
              nunca con '#'.
              Los iconos son mudos —no tienen texto visible— así que cada uno necesita su
              `aria-label`; sin él un lector de pantalla cae al href y lee la URL cruda. Los que
              abren pestaña nueva lo avisan en el propio nombre accesible, igual que
              Registro.tsx. Las URLs de Facebook y Discord son las mismas que ese archivo. */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white uppercase tracking-wider">Conectar</h4>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://twitch.tv/lqroc"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LQC en Twitch (abre en pestaña nueva)"
                className={`${CLASE_ICONO} group`}
              >
                <Twitch className="w-5 h-5" />
                <div className="absolute -top-2 -right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </a>

              <a
                href="https://www.facebook.com/lolqrochampionship/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LQC en Facebook (abre en pestaña nueva)"
                className={CLASE_ICONO}
              >
                <Facebook className="w-5 h-5" />
              </a>

              <a
                href="https://discord.gg/eS6zkvfkp"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LQC en Discord (abre en pestaña nueva)"
                className={CLASE_ICONO}
              >
                <MessageSquare className="w-5 h-5" />
              </a>

              <a
                href="mailto:contacto@revolution505.com"
                aria-label="Escribir a contacto@revolution505.com"
                className={CLASE_ICONO}
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
          
          {/* Acá había tres enlaces —Términos, Privacidad y Cookies— apuntando a '#'. En
              una franja legal eso es peor que en cualquier otro lugar del sitio: promete
              documentos exigibles que no existen, y quien los busca es justo quien más
              necesita encontrarlos.
              El aviso de privacidad SÍ está escrito: vive dentro de /registro. Cuando se
              extraiga a su propia página, este enlace vuelve apuntando a esa ruta. Los otros
              dos documentos todavía no existen ni redactados. */}
          <div className="text-right">
            <div className="text-xs text-gray-600">
              Este evento no está afiliado con Riot Games ni League of Legends.
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}