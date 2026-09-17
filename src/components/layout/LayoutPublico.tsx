import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import TiraHud from '../TiraHud'

/* Periodos de las dos animaciones de la copa, en segundos. TIENEN que coincidir con los de
   `.lqc-copa-deriva` y `.lqc-copa-balanceo` en src/index.css: si difieren, la fase calculada
   acá cae en otro punto del ciclo y la copa salta al recargar. 97 y 61 son primos entre sí,
   así que la figura combinada recién se repite a las 1 h 39 min. */
const PERIODO_DERIVA_S = 97
const PERIODO_BALANCEO_S = 61

/* `animation-delay` NEGATIVO: la animación arranca ya avanzada esos segundos, o sea en la fase
   que le tocaría si hubiera corrido desde el epoch. Eso es lo que hace que la trayectoria
   sobreviva a F5 y a volver desde /admin —donde este layout SÍ se desmonta—, sin un solo rAF
   ni timer: un `Date.now()` por montaje y el resto lo hace el compositor. */
const fase = (periodo: number) => `-${((Date.now() / 1000) % periodo).toFixed(2)}s`

/* Chrome del sitio público (header + footer). Envuelve solo las rutas públicas
   vía <Outlet>: las rutas de /admin quedan fuera para que el panel no herede el
   nav ni el footer públicos. El <main> nació idéntico al que tenía App.tsx; hoy suma
   el lienzo, la tira de datos y la copa de fondo. */
export default function LayoutPublico() {
  /* Inicializador perezoso: una vez por MONTAJE. Si se recalculara en un re-render, cambiar el
     delay de una animación en curso la movería de golpe. Tampoco puede ser constante de módulo:
     el módulo se evalúa una vez por carga, y al volver de /admin arrastraría la fase vieja. */
  const [fases] = useState(() => ({ deriva: fase(PERIODO_DERIVA_S), balanceo: fase(PERIODO_BALANCEO_S) }))

  return (
    <>
      <Header />
      {/* La tira de datos va ACÁ y no en cada página: un solo punto de inserción cubre las
          8 públicas más el 404 en línea de App.tsx, y deja fuera a /admin por construcción
          —sus rutas son hermanas de este layout, no hijas—. Y como este componente es el
          elemento de la ruta PADRE, React Router no lo desmonta al navegar entre páginas
          hijas: el reloj y el sondeo del clima se montan una vez y sobreviven al nav. */}
      <main className="flex-grow relative z-10 lqc-lienzo">
        {/* LA COPA DE FONDO, una sola vez para las 8 públicas y el 404, por el mismo motivo que
            la tira: al navegar entre hijas no se remonta y el movimiento sigue de largo.
            DOS nodos porque son dos animaciones de `transform`, y un elemento solo puede
            llevar una: el exterior deriva en X, la <img> se balancea en Y y rota. Por lo mismo
            se centra con `inset-x-0 mx-auto` y NUNCA con `-translate-x-1/2`, que la deriva
            pisaría.
            Geometría: `min(58vw,45vh)` en base y `min(32vw,45vh)` desde xl, arriba a 20vh.
            405 px a 1440×900 y 217 px a 375×812, completa en pantalla en todo el recorrido.
            El tope en `vh` es lo que la mantiene entera en una ventana ancha y baja.
            `z-0` va con el contrato de apilamiento del lienzo (ver AGENTS.md): por encima del
            fondo de `main`, por debajo de todo lo que lleva `relative z-10`.
            EL ENVOLTORIO RECORTADO ES LO QUE LA SACA DEL PIE. La copa es `fixed` dentro del
            contexto z-10 de `main` y <footer> no está posicionado, así que al scrollear hasta
            abajo se pintaba ENCIMA del pie negro. `clip-path` —a diferencia de `overflow`—
            recorta también a los descendientes `fixed`, y como no crea bloque contenedor la
            copa sigue anclada a la ventana. El recorte va en este `<div>` del tamaño de `main`
            y NUNCA en `main`: ahí recortaría también el lightbox de /galeria, que vive adentro. */}
        <div aria-hidden="true" className="absolute inset-0 z-0 pointer-events-none [clip-path:inset(0)]">
          <div
            className="lqc-copa-deriva fixed inset-x-0 top-[20vh] mx-auto w-[min(58vw,45vh)] xl:w-[min(32vw,45vh)]"
            style={{ animationDelay: fases.deriva }}
          >
            <img
              src="/assets/logo-copa.webp"
              alt=""
              decoding="async"
              className="lqc-copa-balanceo w-full h-auto opacity-[0.07] blur-[1px]"
              style={{ animationDelay: fases.balanceo }}
            />
          </div>
        </div>
        <TiraHud />
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
