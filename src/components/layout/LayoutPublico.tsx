import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import TiraHud from '../TiraHud'

/* Chrome del sitio público (header + footer). Envuelve solo las rutas públicas
   vía <Outlet>: las rutas de /admin quedan fuera para que el panel no herede el
   nav ni el footer públicos. El <main> es idéntico al que tenía App.tsx. */
export default function LayoutPublico() {
  return (
    <>
      <Header />
      {/* La tira de datos va ACÁ y no en cada página: un solo punto de inserción cubre las
          8 públicas más el 404 en línea de App.tsx, y deja fuera a /admin por construcción
          —sus rutas son hermanas de este layout, no hijas—. Y como este componente es el
          elemento de la ruta PADRE, React Router no lo desmonta al navegar entre páginas
          hijas: el reloj y el sondeo del clima se montan una vez y sobreviven al nav. */}
      <main className="flex-grow relative z-10 lqc-lienzo">
        <TiraHud />
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
