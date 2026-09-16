---
name: lienzo-fondo-main
description: El fondo atmosférico del sitio público cuelga de <main> (.lqc-lienzo), no de body; el mosaico y el grano son un paso 2 que el usuario dejó pendiente a propósito.
metadata:
  type: project
---

El 2026-09-15 se implementó el **paso 1** de la dirección A del fondo global: `.lqc-lienzo`
en el `<main>` de `LayoutPublico`, con tres capas (halo `lqc-accent`, halo `lqc-500`, lavado
vertical). El **paso 2 —mosaico y grano— NO se hizo y puede que no se haga nunca**: fue una
decisión explícita del usuario, no un olvido ni trabajo a medias.

**Why:** los halos que `body::before` declara desde el commit inicial nunca se vieron porque
cada página se pinta en su raíz un `bg-gradient-to-b from-black via-gray-950 to-black`
**opaco** (12 ocurrencias en 11 archivos `.tsx`, medido). Repintar esas 12 raíces era el
camino largo y quedó **descartado**; el vehículo elegido fue `main`, que ya era
`relative z-10`. El usuario pidió el cambio partido en dos pasos para poder mirar el paso 1
solo antes de decidir si el mosaico/grano suman o ensucian.

**How to apply:** si alguien pide "arreglar el fondo", "que se vean los halos" o "sumarle
textura", primero preguntá si estamos hablando del paso 2 — no lo agregues por iniciativa
propia, y NO toques `body`, `body::before` ni las raíces opacas de las páginas. El contrato
de apilamiento que hace funcionar esto: el pseudo va `z-index: 0` y el contenido de cada
página vive en un `<div className="relative z-10">`. Una página pública nueva que no envuelva
su contenido así queda **debajo** del lavado (no lo tapa nada, pero recibe el tinte). Único
caso hoy sin wrapper: el 404 inline de `App.tsx`, con tinte ≤7% y sin impacto real. El porqué
técnico completo (fixed vs background-attachment, canales literales, por qué no se anima) vive
en el comentario largo de `src/index.css`, no acá. Relacionado: [[verificar-alcance-con-grep]].
