import { Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react' // ← Para lazy loading (mejor performance)

// Import directo (no lazy): son estructura, no páginas. El boundary tiene que
// estar siempre disponible para atrapar los errores de render y los chunks lazy
// que fallan al cargar; el layout público envuelve las rutas del sitio.
import ErrorBoundary from './components/ErrorBoundary'
import LayoutPublico from './components/layout/LayoutPublico'
import ScrollToTop from './components/ScrollToTop'

// Lazy loading de páginas (carga solo cuando se necesita)
const Home = lazy(() => import('./pages/Home'))
const Torneos = lazy(() => import('./pages/Torneos'))
const Galeria = lazy(() => import('./pages/Galeria'))
const Acerca = lazy(() => import('./pages/Acerca'))
const Contacto = lazy(() => import('./pages/Contacto'))
const Registro = lazy(() => import('./pages/Registro'))
const Reglamento = lazy(() => import('./pages/Reglamento'))

// Panel de administración (acceso solo por URL directa, fuera del nav público)
const Login = lazy(() => import('./pages/admin/Login'))
const Panel = lazy(() => import('./pages/admin/Panel'))
const RutaProtegida = lazy(() => import('./pages/admin/RutaProtegida'))

// Componente de carga (skeleton o spinner mientras carga la página)
const LoadingFallback = () => (
  <div className="min-h-[70vh] flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-lqc-accent border-t-transparent rounded-full animate-spin" />
  </div>
)

export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col bg-black text-gray-100 antialiased">
        {/* Sube al tope en cada cambio de ruta. Va acá y no en main.tsx porque usa
            `useLocation`, que necesita estar DEBAJO del <BrowserRouter> — en main.tsx sería
            hermano del router y lanzaría. Al mismo nivel que <Routes> y no adentro: una sola
            instancia para todo el sitio, admin incluido, y sin depender de qué ruta matchee.
            No renderiza nada. */}
        <ScrollToTop />

        {/* Suspense global: cubre TODAS las rutas lazy, incluidas las de /admin
            (que quedan fuera de LayoutPublico). Si el Suspense viviera dentro del
            layout, las rutas admin se cargarían sin boundary y React lanzaría. */}
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Rutas públicas: comparten el chrome (Header/Footer) de LayoutPublico */}
            <Route element={<LayoutPublico />}>
              <Route path="/" element={<Home />} />
              <Route path="/torneos" element={<Torneos />} />
              <Route path="/galeria" element={<Galeria />} />
              <Route path="/acerca" element={<Acerca />} />
              <Route path="/contacto" element={<Contacto />} />
              <Route path="/registro" element={<Registro />} />

              {/* /reglamento NO está en `navItems` de Header.tsx, a diferencia del resto de
                  las públicas. Se entra desde el pie (bloque "Recursos"). Es una excepción
                  DELIBERADA a la regla de AGENTS.md de mantener ruta y menú en sincronía, y
                  está anotada también allá para que no se lea como un olvido.
                  (No es el mismo caso que /admin: aquello está fuera de LayoutPublico y sin
                  ningún enlace en el sitio. Esta es pública y enlazada; lo que no es, es
                  navegación principal.)
                  El motivo de fondo es que sumarla no sale gratis: Header.tsx documenta que
                  con 6 ítems el menú ya se quedó sin ancho en la franja md (768–1023px) y hubo
                  que compactarlo, y «Reglamento» es la etiqueta más larga de todas. O sea, una
                  línea en `navItems` MÁS una revisión del layout a 768px. Si se decide que
                  vale la pena, es eso lo que hay que hacer. */}
              <Route path="/reglamento" element={<Reglamento />} />

              {/* Ruta 404 básica (opcional pero recomendado). Va dentro del layout
                  público para conservar header/footer en la página no encontrada. */}
              <Route path="*" element={
                <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
                  <h1 className="text-6xl md:text-8xl font-bold text-blue-500 mb-6">404</h1>
                  <p className="text-2xl md:text-3xl mb-8">Página no encontrada</p>
                  <a
                    href="/"
                    className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-full text-lg font-medium text-white transition-all"
                  >
                    Volver al Inicio
                  </a>
                </div>
              } />
            </Route>

            {/* Panel de administración — solo por URL directa, no va en navItems.
                Hermanas del layout público: sin Header/Footer del sitio.
                El login es público; /admin queda tras la ruta protegida. */}
            <Route path="/admin/login" element={<Login />} />
            <Route
              path="/admin"
              element={
                <RutaProtegida>
                  <Panel />
                </RutaProtegida>
              }
            />
          </Routes>
        </Suspense>
      </div>
    </ErrorBoundary>
  )
}
