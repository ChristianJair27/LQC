import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

/* Chrome del sitio público (header + footer). Envuelve solo las rutas públicas
   vía <Outlet>: las rutas de /admin quedan fuera para que el panel no herede el
   nav ni el footer públicos. El <main> es idéntico al que tenía App.tsx. */
export default function LayoutPublico() {
  return (
    <>
      <Header />
      <main className="flex-grow relative z-10">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
