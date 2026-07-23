---
name: canon-formularios
description: Decisiones de diseño para formularios LQC (color de error, radio pills, checkbox) tomadas al construir /registro — reusar en formularios futuros
metadata:
  type: project
---

Canon visual de formularios, fijado el 2026-07-22 al construir `src/pages/Registro.tsx`
(el formulario más grande del sitio). `Contacto.tsx` sigue siendo la referencia de
estructura; esto agrega lo que ahí no existía.

**Why:** la paleta del sistema es monocroma azul/cian y no define ningún color de
error ni estados de selección. Sin un criterio fijo, cada formulario nuevo
inventaría el suyo y las páginas se verían de familias distintas.

**How to apply:** al agregar cualquier formulario o campo validado, reusar estas
decisiones en lugar de elegir colores nuevos.

- **Error = familia `rose`**, nunca `red-500` plano ni un tono de la escala `lqc`.
  Texto `rose-300` (~9.7:1 sobre `#0a0a0f`), borde de input `rose-500/60`, resumen
  `bg-rose-950/30` + `border-rose-500/40` + `text-rose-200`. `rose` se lee como
  alarma sin chocar con el cian del acento; los rojos puros vibran feo al lado de
  `#00d4ff`. Es la **única** familia no azul admitida, y solo para errores.
- **Selección = `lqc-accent` como borde/punto, nunca como fondo de texto.** Pill
  elegida: `bg-lqc-900/50 border-lqc-accent/50 shadow-lqc`. Coherente con
  [[contraste-y-reglas-base]]: `#00d4ff` da 1.8:1 con blanco, así que se usa en
  bordes, puntos e iconos, jamás de relleno bajo un label.
- **Radios y checkbox: `<input className="peer sr-only">` + un `<span>` hermano
  con las clases.** Doble beneficio no obvio: además de evitar los `<option>`
  nativos, `sr-only` saca al input del flujo visual y con eso **esquiva los
  estilos base de `input` de `index.css`** (fondo, borde, padding), que si no
  pelean con cualquier control custom.
- **En esos controles el anillo va con `peer-focus:`, NO con
  `peer-focus-visible:`.** Cuando la validación mueve el foco por código
  (`element.focus()`) tras un envío fallido con el mouse, Chrome no considera ese
  foco "visible" y `:focus-visible` no matchea: el foco se mueve a un input de
  1×1 px invisible y el usuario no ve nada. Con `peer-focus` el anillo siempre se
  dibuja; el costo es que también aparece al hacer clic, que es aceptable.
  En los inputs de texto normales `focus-visible` sí funciona.
- **Tarjeta informativa destacada** (datos de pago): reusa el gradiente de
  tarjeta oscura de CTA `from-blue-950/30 to-lqc-900/20` + `shadow-lqc`. El dato
  copiable (CLABE) va en `font-mono tracking-wide text-lqc-accent`: es el único
  lugar donde el cian actúa como jerarquía de contenido, no de decoración.
- **`noValidate` en el `<form>`** y validación en el estado: los mensajes nativos
  salen en el idioma del navegador y con chrome del SO, imposible de poner
  on-brand. Igual se dejan `required` / `aria-required` por accesibilidad: con
  `noValidate` no disparan popups.
- **El foco al primer error se resuelve con una lista explícita de orden visual**
  (`ORDEN_CAMPOS`), no iterando las claves del objeto de errores: ese orden lo
  fija el código de validación y no tiene por qué coincidir con lo que se ve.
- **El estado de éxito también necesita foco, y la vuelta al formulario
  también.** Cada vez que se alterna formulario ⇄ éxito se desmonta el nodo que
  tenía el foco y éste cae a `<body>`. Foco al `<h2>` con `tabIndex={-1}` +
  `focus:outline-none` (es un encabezado, no un control) desde un `useEffect`
  sobre el flag de enviado — nunca desde el handler, donde el nodo todavía no
  existe — y al primer campo al volver.
- **Ese efecto se dispara comparando el valor previo del flag
  (`useRef(enviado)`), no con una bandera de "primer render".** Con `StrictMode`
  activo (lo está, en `main.tsx`) React monta, desmonta y remonta: una bandera de
  un solo uso ya viene consumida en el segundo pase y el efecto se ejecuta con el
  estado inicial, es decir **la página roba el foco apenas carga** — peor que el
  bug que se quería arreglar, y solo se ve en dev.
- **Nada de `role="status"` en la tarjeta de éxito.** Compite con el foco
  programático: la live region se inserta junto con su contenido (varios lectores
  no la anuncian) y, si anuncia, lee la tarjeta entera encima del `<h2>` recién
  enfocado. El foco solo alcanza y es determinista.
- **Con header sticky, `scrollIntoView({block:'start'})` deja el destino tapado.**
  La solución es `scroll-mt-28` en el elemento destino (header de `h-20`), no
  cambiar a `block:'center'`, que descuadra tarjetas altas.
- **Fechas: `toLocaleDateString('sv-SE')`, nunca `toISOString()`.** `sv-SE` da
  `YYYY-MM-DD` en hora local; `toISOString()` es UTC y en Querétaro (UTC−6)
  después de las 18:00 el "hoy" ya sería mañana, así que una fecha de hoy se
  rechazaría como futura.
- **Los límites de fecha se calculan relativos a hoy, nunca con un año literal**
  (`fechaHaceAnios(16)` / `fechaHaceAnios(80)`), y van también como `min`/`max`
  del input. Un piso hardcodeado tipo `1940` envejece y deja de tener sentido.
  El piso no es cosmético: sin él, un año tecleado a medias en un
  `<input type="date">` (`0206-05-14`) pasa la validación y llegaría así a la
  base. Ese caso debe dar un mensaje que apunte **al año**, no a la edad.
- **Mensajes de error nunca cromáticos.** Nada de "los campos en rojo": el
  resumen debe señalar "los campos que tienen un mensaje de error debajo".

Ver también [[migracion-sin-morado]], [[deuda-header-md]].
