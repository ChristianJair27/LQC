---
name: lienzo-fondo-main
description: El fondo atmosférico del sitio público cuelga de <main> (.lqc-lienzo) y son DOS pseudos con estrategias de posicionado distintas; el grano quedó descartado por matemática de blending.
metadata:
  type: project
---

El fondo de marca del sitio público vive en `.lqc-lienzo`, sobre el `<main>` de
`LayoutPublico`, y son **dos pseudos que hacen cosas distintas a propósito**:

- **`::before` — atmósfera de VENTANA, `position: fixed`.** Dos halos (`lqc-accent` arriba a
  la derecha, `lqc-500` abajo a la izquierda). Paso 1, commit `f07d107` (2026-09-15). El
  lavado vertical que lo acompañaba se quitó el 2026-09-16.
- **`::after` — tratamiento de CABECERA, `position: absolute` + `height: 100vh` + `mask-image`.**
  Desde el 2026-09-16, el wordmark LQC gigante (logo real vectorizado y condensado, 112 % del
  ancho, `repeat-y`) en `lqc-500` al 6,5 %, calibrado contra un póster oficial
  («Top Visión · Ronda 3») que NO se versiona: lleva gamertags reales y el repo es público.
  Antes era un mosaico de rectángulos (paso 2, 2026-09-15). Detalle en AGENTS.md.

**Why:** los halos que `body::before` declara desde el commit inicial nunca se vieron porque
cada página se pinta en su raíz un `bg-gradient-to-b from-black via-gray-950 to-black`
**opaco** (12 ocurrencias en 11 archivos `.tsx`). Repintar esas raíces quedó **descartado**;
el vehículo es `main`, que ya era `relative z-10`. Las dos decisiones de posicionado que
importan y que es fácil "corregir" mal: el `::after` NO puede ir como capa del `::before`
porque una `mask-image` aplica al **elemento entero** y se llevaría los halos puestos; y NO
puede ir `fixed` porque entonces el tercio superior de la PANTALLA tendría letras siempre y
la tabla de clasificación de `/torneos` le pasaría por debajo al scrollear.

**El grano NO va, y no es un pendiente.** `background-blend-mode: soft-light` sobre un lienzo
casi-negro es **matemáticamente invisible**: por la fórmula del W3C, con backdrop Cb = 0 el
resultado es 0 sea cual sea el origen. Verlo exigiría blending `normal` a ~2 %, que sí sube la
luminancia media — o sea, otra decisión de contraste, no una textura. Decisión explícita del
usuario: "si no se ve, se deja afuera".

**How to apply:** el contrato de apilamiento que hace funcionar todo esto es que los dos
pseudos van `z-index: 0` + `pointer-events: none` y el contenido de cada página vive en un
`<div className="relative z-10">`. Una página pública nueva que no envuelva su contenido así
recibe el lienzo **encima**. El 404 inline de `App.tsx`, que era el único caso, ya lleva su
wrapper. El `::after` no alcanza la tabla de `/torneos` por construcción: la máscara es
transparente al 78 % de 100vh, o sea y≈783 (1440×900) e y≈697 (375×812) desde el tope del
documento, contra y=1388 / y=1117 donde empieza la tabla (ver
[[feedback-medir-con-navegador-real]]).

**Trampa al apagarlo en alto contraste:** el bloque `@media (prefers-contrast: high)` de
`index.css` —donde vive el `display: none` de los dos pseudos, y también `body{background:#000}`
y los overrides de `.glass`— **no matchea en Chromium**: medido, Chrome solo responde a
`prefers-contrast: more`. O sea que ese bloque entero es letra muerta en Chrome/Edge. Es
**preexistente**, no lo introdujo el lienzo, y tocarlo afecta mucho más que el fondo: si alguien
lo va a arreglar, va como cambio propio y no colado en un retoque de fondo.
Relacionado: [[verificar-alcance-con-grep]].
