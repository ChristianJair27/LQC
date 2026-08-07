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

/* BLOQUE "RECURSOS": vuelve, pero solo con destinos que EXISTEN.
   Se había ido entero (f18aa5b) porque cuatro de sus cinco ítems —Reglamento, Calendario,
   Estadísticas y FAQ— apuntaban a '#'. Ahora el reglamento es un PDF real en public/, así que
   la sección tiene una razón de ser propia. Calendario, Estadísticas y FAQ SIGUEN AFUERA: la
   regla no cambió —un enlace a '#' no es un placeholder, es una promesa rota que el usuario
   descubre recién al hacer clic— y vuelven de a una, cuando cada página exista.

   «Registro» se MUDÓ acá desde Navegación; no está duplicado. El quinto ítem de la sección
   original era exactamente esa duplicación, y era la otra mitad del argumento para borrarla:
   un enlace que repetía el destino de la columna vecina con otro nombre. El PDF justifica que
   la sección vuelva a existir, no justifica que vuelva el duplicado, así que se repone una
   cosa y no la otra.
   Se llama «Registro» y no «Inscripciones» —como se llamó un rato— para decirle igual que el
   header a la misma página. El header es sticky, así que los dos nombres se veían a la vez y
   parecían dos destinos distintos. */

export default function Footer() {
  return (
    <footer className="bg-black border-t border-gray-900">
      <div className="container mx-auto px-4 py-12">
        {/* Cinco bloques, pero NO cinco columnas iguales — y esa distinción es todo el
            comentario. La restricción de siempre: la botonera de "Conectar" mide 188px
            —4 botones de 38px (icono w-5 de 20 + p-2 de 16 + borde de 2) y 3 huecos de 12— y
            es el elemento más ancho que no se puede envolver sin que se parta en dos filas.
            Eso ya pasó una vez: la versión anterior a f18aa5b saltaba de 1 a 4 columnas en
            `md` (768px), donde cada una da 160px, y la botonera se partía. De ahí el escalón
            `md:grid-cols-2 lg:grid-cols-4` que la tablet resuelve en 2×2 (352px por columna).

            Al sumar el QR, `lg:grid-cols-5` habría repetido el mismo error: en `lg` el
            contenedor mide 1024px y quedan 992 útiles tras el px-4, así que cinco columnas
            iguales con `gap-8` dan (992 − 4 huecos de 32) / 5 = 172.8px. Otra vez por debajo
            de 188 y otra vez la botonera en dos filas.
            La salida es que el QR NO sea una columna igual: `[1fr_1fr_1fr_1fr_7rem]` le da
            una pista fija de 112px —lo que mide su cuadro y nada más— y reparte el resto
            entre las cuatro de contenido. Con `lg:gap-x-6` (24px) eso deja
            (992 − 4 huecos de 24 − 112) / 4 = 196px por columna: 8px de margen sobre los 188
            de la botonera. El gap horizontal baja de 32 a 24 solo en `lg` y solo en el eje x,
            que es de donde salen esos 8px; el vertical sigue en 32 para no tocar el ritmo de
            `md`, donde las columnas se apilan de a dos.
            En `xl` el contenedor pasa a 1280px y sobra de todo: 260px por columna.
            Anchos calculados desde el CSS compilado, no medidos en un navegador. */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_7rem] gap-8 lg:gap-x-6">
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
                {/* Apunta a /reglamento, la página con el visor, y NO al PDF directo como
                    hacía antes. Al ser ruta interna vuelve a ser <Link> + irAlTope, igual que
                    Navegación: ya no hay pestaña nueva que avisar ni archivo que anunciar, así
                    que tampoco necesita aria-label —el texto visible ya es el nombre completo
                    del destino—. Esas dos cosas ahora las dice la página, que es donde el
                    usuario decide si abrir o descargar. */}
                <Link to="/reglamento" onClick={irAlTope} className={CLASE_ENLACE}>
                  <div className={CLASE_PUNTO}></div>
                  Reglamento
                </Link>
              </li>
              <li>
                <Link to="/registro" onClick={irAlTope} className={CLASE_ENLACE}>
                  <div className={CLASE_PUNTO}></div>
                  Registro
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

          {/* QR al registro, como bloque propio y último de la grilla — o sea la columna de la
              derecha en `lg`. Antes colgaba del final de «Conectar», que lo dejaba leyéndose
              como un apéndice de las redes sociales y no como lo que es: un quinto destino.
              Con encabezado propio, en el mismo `<h4>` uppercase que los otros tres, ya es un
              par de ellos y no algo pegado abajo.
              La otra ubicación posible —la franja legal del final— sigue descartada: es un
              `grid ... items-center` de texto `text-xs`, y un bloque de 108px le triplicaba el
              alto a la fila y descolocaba el aviso de Riot.
              Cómo se acomoda en cada tamaño:
              · `lg`: pista fija de 112px (ver el comentario de la grilla). El cuadro mide 108,
                así que el contenido pasa a vertical —`lg:flex-col`— y el texto cae DEBAJO del
                código, envolviendo en dos o tres líneas. De lado no entraría.
              · `md` (2×2): quedan cinco bloques en dos columnas, así que este cae solo en la
                tercera fila, en la celda izquierda de 352px. Para que no se lea huérfano el
                contenido va en horizontal: cuadro y texto uno al lado del otro ocupan ~265px
                de esos 352 y llenan la celda en vez de dejar un cuadradito suelto.
              · móvil (1 columna): mismo horizontal, a lo ancho de la pantalla.
              Mismo tratamiento que el QR de «¿Vas a competir?» en Home.tsx: si se toca uno,
              mirar el otro. No están extraídos a un componente compartido porque son dos cajas
              de cinco líneas con tamaños y textos distintos, y el envoltorio costaría más de lo
              que ahorra. */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-white uppercase tracking-wider">Regístrate</h4>
            <div className="flex items-center gap-3 lg:flex-col lg:items-start">
              {/* El SVG ya trae su propio `<rect fill="white">`, así que este `bg-white` no tapa
                  transparencia: extiende ese blanco por detrás del `p-1.5` para que la esquina
                  redondeada quede limpia y el código no corte a filo contra el negro del pie.
                  El `ring` en gris es el mismo registro de los bordes de acá (`border-gray-800`
                  de CLASE_ICONO): sin él, un cuadrado blanco puro sobre `bg-black` se lee como
                  una imagen que no cargó bien. */}
              <div className="rounded-lg bg-white p-1.5 shadow-lg shadow-black/50 ring-1 ring-gray-800">
                {/* 96px es el TECHO que impone la pista de 112px, no una preferencia: 96 + los
                    12 del `p-1.5` dan los 108 del cuadro. Sirve como marca visual y escanea de
                    cerca, pero no es un QR "de cartel": son 37 módulos (versión 5) en 96px, o
                    sea 2.1px por módulo. Para que escanee con holgura harían falta ~144px, y
                    ese ancho en `lg` deja las otras columnas en 185px — por debajo de los 188
                    de la botonera. O sea que el pie NO puede alojar un QR grande sin reacomodar
                    «Conectar»; el grande es el de Home, que tiene la tarjeta entera para él.
                    `width`/`height` además de las clases porque el SVG declara `width="45mm"`
                    —unos 170px intrínsecos— y sin medidas explícitas se pintaría a ese tamaño.
                    `block` evita el hueco de línea base de una imagen `inline`, que acá se
                    vería como más blanco abajo que arriba. */}
                <img
                  src="/assets/qr_lqc_azul.svg"
                  alt="Código QR para registrarse en LQC"
                  width={96}
                  height={96}
                  loading="lazy"
                  className="block h-24 w-24"
                />
              </div>
              {/* Sin `<br />`: el texto tiene que poder acomodarse solo, porque cambia de forma
                  según el tamaño —una línea al lado del cuadro en móvil y `md`, dos o tres
                  debajo en `lg`— y un salto fijo lo rompería en alguno de los dos.
                  `text-gray-400` y no `gray-500`: a `text-xs` sobre negro, gray-500 da ~4.3:1 y
                  queda por debajo del 4.5:1 que pide AA para texto normal. Es el mismo ajuste
                  —y la misma razón— que el enlace de «Acceso administradores» de más abajo. */}
              <span className="text-xs text-gray-400 leading-snug">
                Escanéame para registrarte
              </span>
            </div>
          </div>
        </div>

        {/* Separador */}
        <div className="my-8 border-t border-gray-900"></div>

        {/* CRÉDITO DE REVOLUTION505, en franja propia entre la grilla y lo legal.
            Va acá y no como sexta columna porque la grilla de arriba tiene su ancho contado al
            píxel —la botonera de «Conectar» mide 188px y no se puede envolver, ver el
            comentario de la grilla—: una columna más la rompía. Y tampoco dentro de la franja
            legal, que es tipografía chica y un logo la desbalancea, el mismo motivo por el que
            el QR terminó arriba y no ahí.
            Reemplaza al «Design by Revolution505» que vivía suelto en el centro de la franja
            legal, en gray-600 y sin enlace. No conviven: era el mismo crédito, y dejar los dos
            habría puesto a Revolution505 tres veces en el mismo pie (con el correo de contacto).
            «Diseñado y desarrollado» —no solo «diseñado»— y en español, confirmado al pedir
            este cambio. El texto viejo estaba en inglés, único caso en un sitio cuya regla es
            que la UI va toda en español.

            Presencia, no anuncio: una sola caja centrada, del ancho de su contenido, con el
            fondo apenas levantado del negro (el mismo `bg-white/[0.02]` de las celdas de
            patrocinadores de Home). El logo mide 32px, menos que el bloque de marca de LQC
            arriba a la izquierda, para que el pie siga siendo de LQC.
            El bloque ENTERO es el enlace, no solo el nombre: da un área de toque cómoda en
            móvil y evita el patrón de «clic acá» minúsculo. `group` engancha el hover del texto
            al marco, así que todo se ilumina junto.
            `after:hidden` mata la barra de gradiente que la regla base de index.css le dibuja a
            todo enlace al 100% del ancho en hover, que en una caja con borde queda colgando por
            debajo. El anillo de foco va explícito porque index.css solo se lo da a los botones.
            El aria-label arranca con el texto visible EXACTO —la suma de las dos líneas— para
            no romper el control por voz (WCAG 2.5.3), y el logo va con alt vacío porque ese
            nombre accesible ya lo cubre: repetirlo lo haría sonar dos veces. */}
        <div className="flex justify-center">
          <a
            href="https://revolution505.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Diseñado y desarrollado por Revolution505 (abre en pestaña nueva)"
            className="after:hidden group inline-flex items-center gap-3.5 rounded-xl border border-gray-800 bg-white/[0.02] px-5 py-3 transition-all duration-300 hover:border-blue-700/50 hover:bg-white/[0.04] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lqc-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <img
              src="/images/revolution505-logo.png"
              alt=""
              width={32}
              height={32}
              loading="lazy"
              className="h-8 w-8 shrink-0 rounded object-contain"
            />
            {/* Bloque de dos líneas en vez de una sola frase: en una línea, «Diseñado y
                desarrollado por Revolution505» mide más que el ancho útil de un teléfono de
                320px y parte por cualquier lado. Partido a propósito, el nombre queda entero en
                su renglón y con el peso visual que le toca.
                Las dos líneas van en gray-400 y gray-200 —ninguna en gray-500— porque a este
                tamaño gray-500 sobre negro da ~4.3:1 y no llega al 4.5:1 que pide AA. La
                jerarquía la dan el tamaño, el peso y el `tracking`, no el contraste. */}
            <span className="text-left">
              <span className="block text-xs uppercase tracking-[0.1em] text-gray-400 transition-colors duration-300 group-hover:text-gray-300">
                Diseñado y desarrollado por
              </span>
              <span className="block text-sm font-medium leading-tight text-gray-200 transition-colors duration-300 group-hover:text-white">
                Revolution505
              </span>
            </span>
          </a>
        </div>

        <div className="my-8 border-t border-gray-900"></div>

        {/* Información legal y copyright.
            Antes eran tres celdas con tres alineaciones distintas —izquierda, centro, derecha—
            y en móvil el `grid-cols-1` las apilaba conservando cada una la suya, así que
            quedaban tres bloques desalineados entre sí. De ahí el aspecto de texto suelto.
            Ahora el `text-center` vive en el CONTENEDOR, así que en móvil las tres comparten
            eje, y recién en `md` cada celda recupera su alineación con `md:text-left` y
            `md:text-right`. El centro no necesita nada: hereda el centrado en los dos tamaños.
            Contraste: el copyright y el aviso de Riot pasan de gray-600 a gray-400. Sobre negro
            gray-600 da ~2.8:1, muy por debajo del 4.5:1 de AA, y son texto legal — justo lo que
            alguien puede necesitar leer de verdad. gray-400 da ~7.6:1. */}
        <div className="grid grid-cols-1 gap-4 text-center md:grid-cols-3 md:gap-6 md:items-center">
          <div className="text-xs text-gray-400 md:text-left">
            © {new Date().getFullYear()} League Querétaro Championship
          </div>

          {/* ACCESO AL PANEL. Va en esta franja y no en «Recursos» —ni en el header, que es
              público y siempre visible— por dos razones. Una, de contenido: es una puerta para
              el staff, no un recurso para los equipos; entre Reglamento y Registro habría
              quedado como un tercer destino más para el capitán que viene a inscribirse. Dos,
              de forma: acá la tipografía chica (text-xs) ya existe, así que el enlace queda
              visible para quien lo busca sin llamar la atención de quien no. En «Recursos»
              habría heredado el text-sm de CLASE_ENLACE y pesado igual que ellos, que es justo
              lo contrario de lo que se pide.
              Sobre el color: este enlace ya estaba en gray-400 cuando el resto de la franja iba
              en gray-600, porque ahí daba ~2.8:1 y no llegaba al mínimo AA. Ahora los otros dos
              subieron al mismo gray-400 por esa misma razón, así que el enlace dejó de
              distinguirse por color y se distingue por ser enlace: el cursor, el hover a blanco
              y la barra de `a::after`. Si alguna vez hace falta que resalte en reposo, el
              camino es subirlo a gray-300 —no bajar a los otros dos, que son texto legal—.
              Sigue en text-xs para no pesar más que ellos.
              Apunta a /admin y NO a /admin/login: RutaProtegida ya decide —panel si hay sesión,
              login si no (ver App.tsx)—, y saltar directo al login mandaría a rehacer el
              trámite a quien ya está dentro.
              Dice «administradores» y no «Iniciar sesión»: el sitio no tiene cuentas de
              jugador, así que un «Iniciar sesión» a secas le prometería una al capitán y lo
              haría buscar la suya.
              Conserva a propósito la barra de hover que index.css le pone a todo <a> —nada de
              `after:hidden` como en CLASE_ICONO—: en un enlace tan tenue es la señal de que es
              pulsable. El anillo de foco es el mismo patrón del resto del sitio (Home.tsx,
              Registro.tsx) porque index.css solo le da outline propio a los <button>. */}
          <div>
            <Link
              to="/admin"
              onClick={irAlTope}
              className="inline-block rounded-sm text-xs text-gray-400 hover:text-white transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lqc-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Acceso administradores
            </Link>
          </div>
          
          {/* Acá había tres enlaces —Términos, Privacidad y Cookies— apuntando a '#'. En
              una franja legal eso es peor que en cualquier otro lugar del sitio: promete
              documentos exigibles que no existen, y quien los busca es justo quien más
              necesita encontrarlos.
              El aviso de privacidad SÍ está escrito: vive dentro de /registro. Cuando se
              extraiga a su propia página, este enlace vuelve apuntando a esa ruta. Los otros
              dos documentos todavía no existen ni redactados. */}
          <div className="text-xs text-gray-400 md:text-right">
            Este evento no está afiliado con Riot Games ni League of Legends.
          </div>
        </div>
      </div>
    </footer>
  )
}