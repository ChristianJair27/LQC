---
name: lienzo-fondo-main
description: El fondo atmosférico del sitio público cuelga de <main> (.lqc-lienzo) y son DOS pseudos con estrategias de posicionado distintas; el grano quedó descartado por matemática de blending.
metadata:
  type: project
---

El fondo de marca del sitio público vive en `.lqc-lienzo`, sobre el `<main>` de
`LayoutPublico`, y son **dos pseudos que hacen cosas distintas a propósito**:

- **`::before` — atmósfera de VENTANA, `position: fixed`.** Dos halos (`lqc-accent` arriba a
  la derecha, `lqc-500` abajo a la izquierda) y un lavado vertical. Paso 1, commit `f07d107`
  (2026-09-15).
- **`::after` — tratamiento de CABECERA, `position: absolute` + `height: 100vh` + `mask-image`.**
  Mosaico geométrico de rectángulos (SVG data-uri, tile de 300px) en `lqc-500` al 4 % y 2.6 %
  y `lqc-accent` al 2 %. Paso 2, 2026-09-15.

**Why:** los halos que `body::before` declara desde el commit inicial nunca se vieron porque
cada página se pinta en su raíz un `bg-gradient-to-b from-black via-gray-950 to-black`
**opaco** (12 ocurrencias en 11 archivos `.tsx`). Repintar esas raíces quedó **descartado**;
el vehículo es `main`, que ya era `relative z-10`. Las dos decisiones de posicionado que
importan y que es fácil "corregir" mal: el mosaico NO puede ir como capa del `::before`
porque una `mask-image` aplica al **elemento entero** y se llevaría los halos puestos; y NO
puede ir `fixed` porque entonces el tercio superior de la PANTALLA tendría mosaico siempre y
la tabla de clasificación de `/torneos` le pasaría por debajo al scrollear.

**El grano NO va, y no es un pendiente.** `background-blend-mode: soft-light` sobre un lienzo
casi-negro es **matemáticamente invisible**: por la fórmula del W3C, con backdrop Cb = 0 el
resultado es 0 sea cual sea el origen. Verlo exigiría blending `normal` a ~2 %, que sí sube la
luminancia media — o sea, otra decisión de contraste, no una textura. Decisión explícita del
usuario: "si no se ve, se deja afuera".

**How to apply:** el contrato de apilamiento que hace funcionar todo esto es que los dos
pseudos van `z-index: 0` + `pointer-events: none` y el contenido de cada página vive en un
`<div className="relative z-10">`. Una página pública nueva que no envuelva su contenido así
queda **debajo** del lavado. Único caso hoy sin wrapper: el 404 inline de `App.tsx`, sin
impacto real. Medido en Chrome (ver [[feedback-medir-con-navegador-real]]): el mosaico deja de
ser perceptible a y≈564 (1440×900) y y≈618 (375×812) desde el tope del documento, muy por
encima de la tabla de `/torneos` (y=1388 / y=1117), así que no se solapan.

**Trampa al apagarlo en alto contraste:** el bloque `@media (prefers-contrast: high)` de
`index.css` —donde vive el `display: none` de los dos pseudos, y también `body{background:#000}`
y los overrides de `.glass`— **no matchea en Chromium**: medido, Chrome solo responde a
`prefers-contrast: more`. O sea que ese bloque entero es letra muerta en Chrome/Edge. Es
**preexistente**, no lo introdujo el lienzo, y tocarlo afecta mucho más que el fondo: si alguien
lo va a arreglar, va como cambio propio y no colado en un retoque de fondo.
Relacionado: [[verificar-alcance-con-grep]].
