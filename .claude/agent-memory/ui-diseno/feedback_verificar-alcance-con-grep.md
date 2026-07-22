---
name: verificar-alcance-con-grep
description: Medir el alcance con grep en vez de confiar en los conteos de AGENTS.md, y pegar la salida de grep + npm run build en el reporte
metadata:
  type: feedback
---

Antes de un cambio transversal de estilo, **medir el alcance real con `grep`** en
lugar de tomar los conteos de `AGENTS.md` como ciertos. Y al terminar, **pegar la
salida literal** de la verificación (`grep` + `npm run build`) en el reporte.

**Why:** `AGENTS.md` documentaba "17 ocurrencias de `purple-*`"; el conteo real
era **25**. El usuario lo detectó y corrigió el alcance a mano. Los números
embebidos en la documentación envejecen mal.

**How to apply:** en cualquier tarea del tipo "eliminá/renombrá X en todo el
sitio", correr el `grep` propio primero y contrastarlo con lo que dice el doc; si
difieren, avisar y trabajar sobre el número medido. Si la tarea deja obsoleto un
conteo escrito en `AGENTS.md`, actualizar ese texto en el mismo cambio (sin
reescribir el resto del documento). Verificar además que las utilidades con
tokens (`from-lqc-500`, `border-lqc-accent/20`, variantes `hover:`) realmente
aparezcan en `dist/assets/*.css`: si Tailwind no las genera, el build igual pasa
y el color desaparece en silencio.

Ver también [[migracion-sin-morado]].
