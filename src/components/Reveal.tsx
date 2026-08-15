import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/* Envuelve un bloque para que entre con fade + slide-up cuando aparece en el viewport.
   Reusa `.animate-slide-in-up` de index.css tal cual; acá no hay CSS nuevo.

   EL ESTADO OCULTO VIVE EN EL KEYFRAME, NUNCA EN UNA CLASE BASE — es la única decisión de
   este archivo que muerde si se toca. El wrapper arranca SIN clase de animación, o sea
   visible, y la clase se agrega recién al intersectar.
   La versión intuitiva es la contraria: `opacity-0` de base y quitarlo al aparecer. Rompe.
   La manta de `prefers-reduced-motion` (index.css:595-603) no apaga la animación, la deja en
   0.01ms con una sola iteración, y como `.animate-slide-in-up` no declara
   `animation-fill-mode`, al terminar el elemento vuelve a SU propio valor. Con un `opacity-0`
   de base ese valor es 0: quien pide menos movimiento se queda con las secciones invisibles
   para siempre. Con el ocultamiento dentro del keyframe (`from { opacity: 0 }`), lo peor que
   puede pasar es que el bloque aparezca de golpe.
   Es la misma razón por la que los dos caminos de degradación —un navegador sin
   IntersectionObserver, o un bloque tan alto que nunca alcance el umbral— terminan sin
   animación pero jamás sin contenido. */
export default function Reveal({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  const [visto, setVisto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const elemento = ref.current
    if (!elemento || typeof IntersectionObserver !== 'function') return

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada?.isIntersecting) return
        setVisto(true)
        /* Una sola vez: no se re-anima al volver a scrollear. */
        observador.disconnect()
      },
      { threshold: 0.15 }
    )

    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])

  const clases = [className, visto ? 'animate-slide-in-up' : null].filter(Boolean).join(' ')

  return (
    <div ref={ref} className={clases || undefined}>
      {children}
    </div>
  )
}
