import { Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react' // ← Para lazy loading (mejor performance)

import Header from './components/layout/Header'
import Footer from './components/layout/Footer'

// Lazy loading de páginas (carga solo cuando se necesita)
const Home = lazy(() => import('./pages/Home'))
const Torneos = lazy(() => import('./pages/Torneos'))
const Galeria = lazy(() => import('./pages/Galeria'))
const Acerca = lazy(() => import('./pages/Acerca'))
const Contacto = lazy(() => import('./pages/Contacto'))

// Componente de carga (skeleton o spinner mientras carga la página)
const LoadingFallback = () => (
  <div className="min-h-[70vh] flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
  </div>
)

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-black text-gray-100 antialiased">
      {/* Header fijo */}
      <Header />

      {/* Contenido principal con Suspense para lazy loading */}
      <main className="flex-grow relative z-10">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/torneos" element={<Torneos />} />
            <Route path="/galeria" element={<Galeria />} />
            <Route path="/acerca" element={<Acerca />} />
            <Route path="/contacto" element={<Contacto />} />
            
            {/* Ruta 404 básica (opcional pero recomendado) */}
            <Route path="*" element={
              <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
                <h1 className="text-6xl md:text-8xl font-bold text-purple-500 mb-6">404</h1>
                <p className="text-2xl md:text-3xl mb-8">Página no encontrada</p>
                <a 
                  href="/" 
                  className="px-8 py-4 bg-purple-600 hover:bg-purple-700 rounded-full text-lg font-medium transition-all"
                >
                  Volver al Inicio
                </a>
              </div>
            } />
          </Routes>
        </Suspense>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}