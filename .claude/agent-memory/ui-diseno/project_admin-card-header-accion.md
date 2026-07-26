---
name: admin-card-header-accion
description: Patrón para meter un botón de acción (CTA) en la banda derecha del encabezado de una tarjeta colapsable del panel admin sin anidar <button> ni recortarlo contra la esquina redondeada
metadata:
  type: project
---

Patrón fijado el 2026-07-23 al arreglar el desborde del botón de pago en
`TarjetaEquipo` de `src/pages/admin/ListaInscripciones.tsx`. Sirve para cualquier
tarjeta colapsable del panel que necesite un botón de acción en la banda del
encabezado.

**Why:** el disparador del colapso es un `<button>`, y el badge/chevron viven
*dentro* de él. El botón de acción NO puede anidarse ahí (`<button>` dentro de
`<button>` es HTML inválido), así que va como **hermano**. El encabezado exterior
es `overflow-hidden rounded-2xl`: un CTA con gradiente propio, sin margen ni
contención, queda pegado y recortado contra la esquina redondeada, y un
`sm:border-l` divisor lo hace ver como panel aparte bolteado al borde.

**How to apply:**
- Fila exterior `flex flex-col sm:flex-row sm:items-center` — NO `items-stretch`.
  `items-stretch` + `sm:border-l` estira la celda de acción a toda la altura y
  dibuja un divisor vertical de arriba a abajo = "panel separado". `items-center`
  la deja en la **misma banda horizontal** que el badge y el chevron (que están
  centrados dentro del disparador), leyéndose como parte de la tarjeta.
- Disparador = `<button flex-1 min-w-0 ...>` (crece y se encoge, trunca el
  nombre). Celda de acción = `<div>` hermano con **`shrink-0`** para que conserve
  su ancho de contenido mientras el disparador absorbe el resto. Sin `shrink-0`,
  el estado de confirmación (texto `max-w-[15rem]` + 2 botones) pelea el ancho.
- Quitar el `sm:border-l`. Mantener `border-t border-white/10` + `sm:border-t-0`:
  el divisor solo aparece en móvil, donde la acción se apila bajo la info.
- Relleno: en sm+ `sm:pl-0` (el hueco con el chevron lo da el padding derecho del
  disparador, px-4/md:px-6) y `md:pr-6` de margen derecho. La clave anti-recorte:
  **el margen derecho del botón debe ser ≥ el radio de la esquina** (rounded-2xl =
  1rem); con el botón centrado verticalmente (items-center) libra la curva del
  `overflow-hidden`. En móvil se conserva `px-4 py-3`; en sm `sm:py-0` (la altura
  de la banda la fija el disparador, más alto).
- No cambiar la lógica ni el canon de botones: CTA `from-lqc-700 to-lqc-500`,
  secundario con `bg-none` (ver [[admin-panel-tool-mode]] y [[canon-formularios]]).

Ver también [[contraste-y-reglas-base]].
