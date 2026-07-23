import { Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react' // ← Para lazy loading (mejor performance)

// Import directo (no lazy): son estructura, no páginas. El boundary tiene que
// estar siempre disponible para atrapar los errores de render y los chunks lazy
// que fallan al cargar; el layout público envuelve las rutas del sitio.
import ErrorBoundary from './components/ErrorBoundary'
import LayoutPublico from './components/layout/LayoutPublico'

// Lazy loading de páginas (carga solo cuando se necesita)
const Home = lazy(() => import('./pages/Home'))
const Torneos = lazy(() => import('./pages/Torneos'))
const Galeria = lazy(() => import('./pages/Galeria'))
const Acerca = lazy(() => import('./pages/Acerca'))
const Contacto = lazy(() => import('./pages/Contacto'))
const Registro = lazy(() => import('./pages/Registro'))

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
