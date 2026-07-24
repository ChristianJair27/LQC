---
name: boton-anidado-tarjeta-colapsable
description: En ListaInscripciones el encabezado de TarjetaEquipo es un <button> completo (disparador del colapso); meter otro <button> dentro es HTML inválido que NI build NI ESLint detectan
metadata:
  type: project
---

En `src/pages/admin/ListaInscripciones.tsx`, `TarjetaEquipo` usa **el encabezado entero
como un `<button>`** (disparador del colapso, con `aria-expanded`/`aria-controls`). Su
contenido es solo de frase: `<span>` + iconos SVG + `<BadgePago>` (que renderiza un
`<span>`). **Nunca metas un `<button>`, `<div>`, `<p>`, `<dl>` u otro bloque dentro de ese
disparador.**

**Why:** un `<button>` anidado en otro `<button>` (o un bloque dentro de un botón) es HTML
inválido, pero **no lo caza nada del pipeline**: `tsc -b && vite build` pasa en verde y
`npx eslint` sale limpio (no hay plugin jsx-a11y de anidamiento activo). El navegador lo
"arregla" reflotando el botón interno fuera, con eventos y foco impredecibles. En Fase 3
(2026-07-23) hubo que reestructurar el encabezado para agregar el botón "Marcar pagado":
la solución fue hacer el disparador y el botón de pago **hermanos** dentro de un contenedor
flex (`<div class="flex flex-col sm:flex-row">`), no anidarlos. Las notas y su botón
"Guardar" viven en el panel expandido, que ya es un `<div>` hermano fuera del disparador.

**How to apply:**
- Al agregar cualquier control interactivo a una tarjeta colapsable, ponelo **al lado** del
  disparador (hermano), nunca dentro. Verificá a ojo que cada `<button>` cierre antes del
  siguiente hermano.
- Si tocás el contenido del disparador, mantenelo como contenido de frase (`<span>`), no
  metas `<div>`/`<p>`.
- Recordá que el build verde y el ESLint limpio **no** garantizan markup válido acá; es una
  revisión manual. Relacionado con la regla base que pinta todo `<button>` (ver
  [[degradar-en-runtime-avisar-en-build]] y AGENTS.md "Trampas conocidas").
