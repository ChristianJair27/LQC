import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/* Lleva la página nueva al tope en cada cambio de ruta.

   POR QUÉ HACE FALTA. En una recarga de verdad el navegador arranca el documento arriba,
   pero una SPA no recarga nada: React Router en modo declarativo (<BrowserRouter> + <Routes>,
   ver main.tsx y App.tsx) cambia el árbol y deja el scroll donde estaba. Resultado: quien
   navega desde el pie de una página larga aterriza a media página de la siguiente.

   POR QUÉ NO <ScrollRestoration />. Es lo que uno buscaría primero y en este proyecto NO se
   puede usar: en react-router-dom 7.12 ese componente llama a `useScrollRestoration`, que a
   su vez hace `invariant()` sobre el DataRouterContext. Ese contexto solo lo provee un data
   router (`createBrowserRouter` + `<RouterProvider>`), y acá el router es `<BrowserRouter>`.
   O sea que no degrada en silencio: lanza excepción en render y rompe la app. Tener el
   componente manual no es una elección de estilo, es la única opción sin migrar el router.

   EL GUARD DEL HASH. Si la URL trae ancla, subir al tope sería justamente lo contrario de lo
   que pidió quien hizo clic. Hoy el sitio no tiene ni un enlace con hash —está verificado— así
   que esta rama no se ejecuta nunca; va igual porque el día que alguien agregue un ancla, sin
   esto el scroll-to-top se la comería y el síntoma sería difícil de atribuir a este archivo.
   `hash` va en las dependencias además de `pathname` para que la regla de exhaustividad de
   eslint-plugin-react-hooks quede conforme. Con el guard adelante eso no cambia el
   comportamiento: navegar entre dos anclas de la misma página dispara el efecto y sale por el
   `return` sin tocar el scroll.

   SCROLL INSTANTÁNEO, sin `behavior: 'smooth'`. Reemplaza lo que hacía una recarga completa, y
   una recarga no anima. Una animación acá además pelearía con `prefers-reduced-motion`. Es el
   mismo criterio que ya venían usando los `irAlTope` sueltos del sitio.

   QUEDAN 4 `onClick={irAlTope}` DELIBERADOS, todos en Footer.tsx (navegación, /reglamento,
   /registro, /carta). No son deuda: el pie se renderiza en esas mismas rutas, así que pulsar
   uno estando ya en el destino no cambia el `pathname` y este efecto no corre. Los de Home.tsx
   y Torneos.tsx sí se sacaron —apuntaban fuera de su propia página, siempre hay cambio de
   ruta— junto con sus copias del helper.

   Dos cosas que NO cubre, por si el síntoma reaparece:
   · Las páginas son `lazy()` bajo un <Suspense> con fallback corto (App.tsx). En el PRIMER
     viaje a una ruta —cuando su chunk todavía no está en caché— el efecto corre con el
     fallback en pantalla, no con la página real montada. El documento se encoge y vuelve a
     crecer, y ahí el navegador puede dejar el scroll en un lugar distinto del tope. Si eso se
     ve en la práctica, la corrección es de este archivo, no de las rutas.
   · No restaura la posición al volver con el botón «atrás»; siempre sube al tope. Es lo que se
     pidió. Restaurar exigiría guardar posiciones por `location.key`, que es otro propósito. */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) return
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}
