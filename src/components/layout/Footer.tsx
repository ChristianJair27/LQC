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

/* Navegación: los mismos destinos que `navItems` de Header.tsx MENOS /registro, que se mudó
   al bloque "Recursos" de acá abajo (ver el comentario de ahí para el porqué). Son 5 de los
   6; el que falta no desapareció del pie, cambió de columna.
   Si se agrega o renombra una página hay que tocar los dos lugares (ver AGENTS.md, "Reglas
   de trabajo"). */
const NAVEGACION = [
  { label: 'Inicio', to: '/' },
  { label: 'Torneos', to: '/torneos' },
  { label: 'Galería', to: '/galeria' },
  { label: 'Acerca', to: '/acerca' },
  { label: 'Contacto', to: '/contacto' }
]

/* Archivo estático servido desde public/. El año va en el nombre porque el reglamento cambia
   por temporada: cuando exista el de 2027 se sube AL LADO y se cambia esta constante.
   OJO, es la condición de la que depende todo lo anterior: el PDF de 2026 NO se borra. Si se
   reemplaza, cualquier enlace ya compartido pasa a devolver 404, que es justo lo que el
   nombre versionado viene a evitar. El costo de dejarlos es ~340 KB por temporada, para
   siempre, en la historia de git. */
const RUTA_REGLAMENTO = '/reglamento-lqc-2026.pdf'

/* BLOQUE "RECURSOS": vuelve, pero solo con destinos que EXISTEN.
   Se había ido entero (f18aa5b) porque cuatro de sus cinco ítems —Reglamento, Calendario,
   Estadísticas y FAQ— apuntaban a '#'. Ahora el reglamento es un PDF real en public/, así que
   la sección tiene una razón de ser propia. Calendario, Estadísticas y FAQ SIGUEN AFUERA: la
   regla no cambió —un enlace a '#' no es un placeholder, es una promesa rota que el usuario
   descubre recién al hacer clic— y vuelven de a una, cuando cada página exista.

   «Inscripciones» se MUDÓ acá desde Navegación (donde se llamaba «Registro»); no está
   duplicado. El quinto ítem de la sección original era exactamente esa duplicación, y era la
   otra mitad del argumento para borrarla: un enlace que repetía el destino de la columna
   vecina con otro nombre. El PDF justifica que la sección vuelva a existir, no justifica que
   vuelva el duplicado, así que se repone una cosa y no la otra.
   Lo que sí cuesta esta decisión, dicho para que no sorprenda: /registro ahora se llama
   «Inscripciones» en el pie y «Registro» en el header. Es un nombre distinto para la misma
   página, y como el header es sticky los dos se ven a la vez. Se resuelve unificando el
   nombre en los dos lados; queda anotado y sin hacer porque es una decisión de copy. */

export default function Footer() {
  return (
    <footer className="bg-black border-t border-gray-900">
      <div className="container mx-auto px-4 py-12">
        {/* Cuatro columnas otra vez, al volver "Recursos" — pero con un escalón intermedio
            que la versión de 4 columnas anterior a f18aa5b no tenía (el estado inmediatamente
            anterior a este cambio era de 3 columnas, sin "Recursos").
            Aquella saltaba de 1 a 4 en `md` (768px), y ahí cada columna mide 160px:
            (768 − 32 de px-4 − 3 huecos de 32) / 4. La botonera de "Conectar" mide 188px
            —4 botones de 38px (icono w-5 de 20 + p-2 de 16 + borde de 2) y 3 huecos de 12—,
            así que no entraba y se partía en dos filas.
            Con `md:grid-cols-2 lg:grid-cols-4` la tablet va a 2×2 (352px por columna) y las
            4 en línea entran recién en `lg` (1024px), donde dan 224px: 36px de margen sobre
            los 188px de la botonera, que es el elemento más ancho que no se puede envolver.
            Anchos calculados desde el CSS compilado, no medidos en un navegador. */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
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
              <li>
                {/* <a href> y NO <Link>: el reglamento es un archivo estático de public/, no
                    una ruta de React Router. Un <Link> lo trataría como navegación interna,
                    el router no encontraría esa ruta y terminaría en la pantalla de 404 en
                    vez de abrir el PDF. Por eso tampoco lleva `irAlTope`: no hay cambio de
                    página que scrollear.
                    Abre en pestaña nueva para no sacar a nadie del sitio, y `noopener
                    noreferrer` va siempre con `target="_blank"`.
                    El aria-label dice las dos cosas que el texto «Reglamento» no dice: que
                    es un PDF y que abre en otra pestaña. Comparte con los iconos de
                    "Conectar" la convención de avisar la pestaña nueva en el nombre
                    accesible, pero no la razón de existir: los iconos son mudos y ahí el
                    aria-label REEMPLAZA texto que no hay, mientras que acá lo AMPLÍA. Por eso
                    arranca con la palabra visible «Reglamento» —si no, el control por voz
                    dejaría de encontrarlo (WCAG 2.5.3, "Label in Name")—. */}
                <a
                  href={RUTA_REGLAMENTO}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Reglamento de la LQC en PDF (abre en pestaña nueva)"
                  className={CLASE_ENLACE}
                >
                  <div className={CLASE_PUNTO}></div>
                  Reglamento
                </a>
              </li>
              <li>
                {/* Este sí es ruta interna: <Link> + irAlTope, igual que Navegación. */}
                <Link to="/registro" onClick={irAlTope} className={CLASE_ENLACE}>
                  <div className={CLASE_PUNTO}></div>
                  Inscripciones
                </Link>
              </li>
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
                href="mailto:contactolqc@revolution505.com"
                aria-label="Escribir a contactolqc@revolution505.com"
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