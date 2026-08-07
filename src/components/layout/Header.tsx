import { Link, useLocation } from 'react-router-dom'
import { Menu, X, ChevronRight } from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { to: '/', label: 'Inicio' },
  { to: '/torneos', label: 'Torneos' },
  { to: '/galeria', label: 'Galería' },
  { to: '/acerca', label: 'Acerca' },
  { to: '/contacto', label: 'Contacto' },
  { to: '/registro', label: 'Registro' },
]

/* Los dos enlaces externos del extremo derecho —ATAK.GG y Revolution505— comparten caja. En
   constantes y no repetidas inline porque ahora son DOS: con la cadena duplicada, el próximo
   retoque de padding o de hover se haría en una sola y quedarían despareados en la misma
   franja de 20px de alto, que es donde más se nota.
   `after:hidden` es lo ÚNICO que no venía del botón original, y arregla un defecto que este
   header arrastraba: la regla base `a::after` de index.css le dibuja a todo <a> una barra de
   gradiente al 100% del ancho en hover, y en una caja con borde queda colgando 2px por debajo.
   Es el mismo parche —y la misma razón— que CLASE_ICONO en Footer.tsx y CLASE_CTA_SECUNDARIO
   en Home.tsx. Se aplica a los dos para que no se comporten distinto al pasar el mouse.
   El resto es el estilo del botón de Revolution505 tal cual, con dos ajustes de ancho que el
   segundo botón obliga (ver el comentario de la navegación): `px-3` en vez de `px-5` hasta xl,
   y `gap-2` en vez de `gap-3`. */
const CLASE_BOTON_EXTERNO =
  'after:hidden hidden sm:flex items-center gap-2 xl:gap-3 px-3 xl:px-4 py-2.5 ' +
  'bg-gray-900 border text-gray-200 hover:text-white rounded-lg ' +
  'transition-all duration-300 shadow-md hover:shadow-lg text-sm font-medium'

/* ACENTO DE MARCA. Es lo único que distingue a un botón del otro, y por eso las dos constantes
   son idénticas salvo el nombre del color: mismo grosor de borde (el `border` de 1px vive en la
   base), mismas opacidades y mismas dos sombras. Si alguna vez hay que retocar el nivel, se
   retocan LAS DOS o dejan de ser pareja.
   El fondo NO participa: se queda en el `bg-gray-900` de la base en reposo y en hover. Lo que
   cambia al pasar el mouse es el borde (de 50% a 90% de opacidad, y un tono más claro) y la
   sombra (de `shadow-md` al 20% a `shadow-lg` al 40%). Es un realce, no un relleno.

   Por qué estos dos tonos y no otros, que es la parte que importa:
   Los colores salen de los logos. Muestreados, el de Revolution505 es cian/turquesa —hue 173°
   a 180°, saturación 100%— y el de ATAK es rojo puro, hue 0°.
   El cian de la casa, `lqc-accent` (#00d4ff), sería el calce literal para Revolution505 y es un
   token del proyecto, pero se descartó por un motivo medible: su luminancia relativa es 0.543
   contra 0.225 del rojo, o sea 2.4 veces más brillante. A la misma opacidad, ese botón habría
   gritado al lado del otro — justo lo contrario del requisito de que se vean parejos.
   `blue-500` y `red-500` sí son pareja: la paleta de Tailwind 4 los coloca en la MISMA
   luminosidad de oklch (L≈0.637), y sus luminancias relativas quedan en 0.229 y 0.225. Lo
   mismo vale para el par de hover, `blue-400`/`red-400` (L≈0.705 los dos). Por eso el azul del
   botón tira más a azul que a cian: es el precio de que las dos marcas pesen igual.
   Nota de paleta: el rojo es la única excepción a la regla azul/negro de CLAUDE.md, y es
   deliberada — es el color de una marca ajena, acotado a su propio botón. Nada de `purple-*`. */
const ACENTO_REVOLUTION =
  'border-blue-500/50 shadow-blue-500/20 hover:border-blue-400/90 hover:shadow-blue-500/40'
const ACENTO_ATAK =
  'border-red-500/50 shadow-red-500/20 hover:border-red-400/90 hover:shadow-red-500/40'

/* Los logos se normalizan por ALTURA y no por caja cuadrada, que es lo que hacía el botón
   original con su `w-7 h-7`. El de Revolution505 es casi cuadrado (755×796) y llenaba esa caja;
   el de ATAK es APAISADO 3:2 (1264×843), así que dentro de una caja cuadrada `object-contain`
   lo habría encajado a 28 de ancho por 18.7 de alto, dejándolo con aire arriba y abajo y
   visiblemente más chico que su vecino. Con alto fijo los dos miden 28 de alto y cada uno el
   ancho que le toca —27 y 42— que es como se ven parejos.
   Es la misma regla, y por el mismo motivo, que ALTO_LOGO_PATROCINADOR en Home.tsx. */
const CLASE_LOGO_BOTON = 'h-7 w-auto object-contain'

/* El texto se esconde SOLO en la franja md (768–1023px), donde el header no tiene ancho para
   los 6 ítems del menú más dos botones rotulados: ahí quedan los logos, que siguen siendo
   clickeables. Es el mismo `md:hidden lg:inline` que ya usaba Revolution505. */
const CLASE_TEXTO_BOTON = 'md:hidden lg:inline'

/* El chevron sube de `lg` a `xl`. Cuesta 24px por botón —icono más su gap— y en `lg` esos 48px
   son la diferencia entre entrar holgado y entrar raspando. Es decoración, así que es lo
   primero que se va cuando falta ancho. */
const CLASE_CHEVRON_BOTON = 'w-4 h-4 hidden xl:block'

/* Los mismos dos enlaces dentro del cajón móvil, donde no hay problema de ancho y la caja es
   más grande. Sin `mt-4`: lo lleva solo el primero, para despegarse de los enlaces de
   navegación; entre ellos dos ya separa el `gap-3` del <nav> que los contiene. */
const CLASE_BOTON_EXTERNO_MOVIL =
  'after:hidden flex items-center justify-between px-6 py-4 text-xl font-medium ' +
  'bg-gray-900 border rounded-xl transition-all duration-300 ' +
  'text-gray-200 hover:text-white shadow-md hover:shadow-lg'

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

          {/* Navegación Desktop, en TRES escalones y no en dos.
              El de siempre: en la franja md (768–1023px) el header no tiene ancho para 6 ítems,
              así que ahí se compacta —gap chico, poco padding, texto chico— y los botones de la
              derecha se reducen a sus logos.
              El nuevo: `lg` (1024–1279px) era el escalón que ya venía justo y que el segundo
              botón termina de romper. Con el contenedor topado en 1024 y `lg:px-8`, ahí hay
              960px útiles, repartidos así con los valores viejos —hueco de 32, padding lateral
              de 20 y texto de 18px—: logo de LQC 116 + menú ~772 + botón 214 = ~1102.
              (Los nombres de esas clases viejas NO se escriben acá: Tailwind escanea los .tsx
              como texto plano y no distingue un comentario del código, así que mencionarlas
              reviviría las tres reglas en el CSS de producción sin que nadie las use. Es la
              misma trampa que el `@source not` de index.css tapa para los .md.)
              Ya se pasaba de
              largo ANTES de agregar nada, y como `body` lleva `overflow-x: hidden`, en vez de
              verse la barra se recortaba el botón contra el borde.
              Los valores de `lg` de ahora —`gap-2`, el `px-2.5` de md y `text-base`— lo dejan
              en 116 + 486 + 295 = ~897 de 960: 63px de aire con los DOS botones puestos. El
              texto baja un escalón (18px → 16px) solo en esa franja; entre dos rótulos quedan
              10 + 8 + 10 = 28px, que es espaciado de navbar normal, no apretado.
              En `xl` (≥1280px) el contenedor pasa a 1280 y sobran 1216px útiles, así que todo
              vuelve a lo espacioso: `px-4`, `gap-4` y el `text-lg` original. Ojo que 1280 y
              1440 son el MISMO caso —el contenedor se topa en 1280 hasta `2xl`— y solo cambian
              los márgenes de afuera.
              Anchos calculados desde el CSS compilado y las dimensiones reales de los PNG; el
              ancho del texto del menú es el único estimado. */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2 xl:gap-4">
            {navItems.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`
                  relative px-2.5 xl:px-4 py-2.5 text-sm lg:text-base xl:text-lg font-medium transition-all duration-300 group
                  ${isActive(item.to)
                    ? 'text-white'
                    : 'text-gray-300 hover:text-white'
                  }
                `}
              >
                {item.label}
                <span
                  className={`
                    absolute bottom-1.5 left-2.5 right-2.5 xl:left-4 xl:right-4 h-0.5 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full
                    transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center
                    ${isActive(item.to) ? 'scale-x-100' : ''}
                  `}
                />
              </Link>
            ))}
          </nav>

          {/* Acciones derecha. El `gap` baja de 24 a 8 en la franja `lg`, que es donde el ancho
              está contado; en `xl` vuelve a 12. Abajo de `md` los dos enlaces no se renderizan
              —se recogen al cajón— y el único hijo es la hamburguesa, así que ahí el gap no
              separa nada. */}
          <div className="flex items-center gap-3 lg:gap-2 xl:gap-3">
            {/* ATAK.GG va a la IZQUIERDA de Revolution505 y no al revés: Revolution505 es quien
                organiza la liga y ya vivía pegado al borde derecho, que es donde la gente lo
                busca. Mover el ancla conocida para hacerle lugar a la nueva sería el cambio más
                ruidoso de los dos.
                El aria-label no está en el botón original y se agrega en los dos: el enlace
                abre una pestaña nueva y sin esto nadie lo anuncia. Arranca con el texto visible
                EXACTO para no romper el control por voz (WCAG 2.5.3, «Label in Name»), igual
                que los enlaces del footer. Además cubre la franja md, donde el rótulo está
                oculto y el enlace se queda sin nombre accesible propio. */}
            <a
              href="https://atakgg.revolution505.com/tournaments"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="ATAK.GG (abre en pestaña nueva)"
              className={`${CLASE_BOTON_EXTERNO} ${ACENTO_ATAK}`}
            >
              {/* El `alt` se conserva aunque el aria-label ya fije el nombre accesible: si el
                  PNG no carga, es el texto que se pinta en su lugar. */}
              <img
                src="/assets/logo-atakkgg.png"
                alt="ATAK.GG"
                className={CLASE_LOGO_BOTON}
              />
              <span className={CLASE_TEXTO_BOTON}>ATAK.GG</span>
              <ChevronRight className={CLASE_CHEVRON_BOTON} />
            </a>

            {/* Promo Revolution505 */}
            <a
              href="https://revolution505.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Revolution505 (abre en pestaña nueva)"
              className={`${CLASE_BOTON_EXTERNO} ${ACENTO_REVOLUTION}`}
            >
              <img
                src="/images/revolution505-logo.png"
                alt="Revolution505"
                className={`${CLASE_LOGO_BOTON} rounded`}
              />
              <span className={CLASE_TEXTO_BOTON}>Revolution505</span>
              <ChevronRight className={CLASE_CHEVRON_BOTON} />
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

              {/* Los dos enlaces externos en móvil, en el mismo orden que arriba. El `mt-4` lo
                  lleva solo el primero, para despegar el par de los enlaces de navegación;
                  entre ellos ya separa el `gap-3` de este <nav>.
                  Acá no hay problema de ancho —cada uno ocupa una fila entera— así que los dos
                  van con logo, rótulo y chevron, sin nada oculto. El `onClick` que cierra el
                  cajón va en los dos: sin él, volver atrás desde la pestaña nueva encuentra el
                  menú todavía abierto. */}
              <a
                href="https://atakgg.revolution505.com/tournaments"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="ATAK.GG (abre en pestaña nueva)"
                className={`mt-4 ${CLASE_BOTON_EXTERNO_MOVIL} ${ACENTO_ATAK}`}
              >
                <div className="flex items-center gap-4">
                  {/* Alto fijo y ancho automático, igual que en la barra: el logo es apaisado
                      3:2 y en la caja cuadrada `w-9 h-9` del original habría quedado con aire
                      arriba y abajo, más chico que el de Revolution505. */}
                  <img
                    src="/assets/logo-atakkgg.png"
                    alt="ATAK.GG"
                    className="h-9 w-auto object-contain"
                  />
                  <span>ATAK.GG</span>
                </div>
                <ChevronRight className="w-6 h-6" />
              </a>

              <a
                href="https://revolution505.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Revolution505 (abre en pestaña nueva)"
                className={`${CLASE_BOTON_EXTERNO_MOVIL} ${ACENTO_REVOLUTION}`}
              >
                <div className="flex items-center gap-4">
                  <img
                    src="/images/revolution505-logo.png"
                    alt="Revolution505"
                    className="h-9 w-auto object-contain rounded"
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