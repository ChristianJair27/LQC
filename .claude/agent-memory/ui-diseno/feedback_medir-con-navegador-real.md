---
name: feedback-medir-con-navegador-real
description: Cuando el pedido dice "medí, no estimes" sobre alturas o solapamientos, hay que medir en un navegador real; hay receta armada con playwright-core + Chrome del sistema.
metadata:
  type: feedback
---

Si la consigna pide alturas de página, dónde empieza una sección o si dos capas se solapan,
**medir en un navegador real y pegar los números**. Estimar a mano no sirve acá.

**Why:** el usuario lo pidió textualmente ("ESTO ES LO QUE MÁS ME INTERESA — medí, no
estimes") al cerrar el paso 2 del lienzo de fondo. Y tiene razón técnica: en este sitio la
aritmética a mano se cae sola porque `index.css` mete `@media (max-width: 768px) { :root {
font-size: 14px } }`, así que **a 375px todas las utilidades en `rem` de Tailwind valen 0.875×
lo esperado** (`pt-28` = 98px, no 112px). Encima el `<header>` es `sticky` y está en flujo, o
sea que el tope de `main` no es y=0 sino y=64 (móvil) / y=81 (escritorio).

**How to apply:** receta que ya funcionó, sin tocar el repo ni bajar navegadores:
1. `npm run build` y `npm run preview` (sirve `dist/` en :4173).
2. En el scratchpad, `npm i playwright-core` y lanzar con `chromium.launch({ channel: 'chrome' })`
   — usa el Chrome/Edge que ya está instalado en la máquina; `playwright` a secas se baja
   ~150 MB de navegadores al pedo.
3. Posiciones con `el.getBoundingClientRect().top + scrollY`.
4. Para saber **hasta dónde pinta** una capa decorativa: dos capturas `fullPage`, una normal y
   otra con la regla anulada por `addStyleTag`, y diff de píxeles fila por fila.

**Dos trampas del diff de píxeles, las dos me dieron falsos positivos:**
- **Congelá el movimiento antes de la PRIMERA captura** (`*{animation:none!important}`) o los
  elementos animados del fondo aparecen como "diferencias" cientos de píxeles más abajo.
- **Tirá siempre una captura de control A-vs-A.** Chrome difiere de sí mismo en 1-3 px con
  delta 1-2 (dithering de gradientes casi negros): sin control, eso se lee como que la capa
  llega mucho más lejos de lo que llega. Un umbral de `n >= 20 px && delta RGB >= 5` separa
  limpio la capa real del ruido.
