---
name: migracion-sin-morado
description: La migración purple-* → azul/cian ya se completó (2026-07-22); razones detrás de cada mapeo de color elegido
metadata:
  type: project
---

El sitio quedó **sin una sola clase `purple-*`** el 2026-07-22 (25 ocurrencias en
6 archivos: `App.tsx` + las 5 páginas). Los patrones resultantes están
documentados en `AGENTS.md` (sección "Morado heredado — ya migrado"); acá queda
sólo el **razonamiento**, que no se deduce leyendo el markup.

**Why:** las decisiones de mapeo fueron juicio de diseño, no reemplazos
mecánicos. Repetirlas sin el porqué produce deriva visual entre páginas.

**How to apply:** al agregar una página o un CTA nuevo, reusar estos criterios en
lugar de inventar un color.

- **Títulos → `to-lqc-accent`** (no otro azul): `#00d4ff` conserva la progresión
  azul→cian del degradado. Cualquier `blue-*` lo dejaba casi monocromo. Es
  idéntico en las 5 páginas a propósito — no variar por página.
- **Criterio general del reemplazo:** conservar la opacidad exacta
  (`purple-900/20` → un azul `/20`) y que los pares de gradiente sigan teniendo
  **dos pasos distinguibles**, nunca planos.
- **CTA primario** (`from-lqc-700 to-lqc-500`, hover `lqc-600 → lqc-400`): mi
  primer intento fue `from-blue-700 to-lqc-500` y **el revisor lo rechazó por
  plano** — `blue-700` (#1d4ed8, ~224°) y `lqc-500` (#0066ff, ~216°) están a 8°
  de tono, contra los 48° del par morado original. Dentro de una paleta de un
  solo tono, un gradiente sólo se lee si la **rampa es de luminancia**: por eso
  #003d99 → #0066ff. No terminar en `lqc-accent`: da 1.8:1 con texto blanco.
- **Twitch en Home**: el morado era branding de Twitch. Se pasó a `lqc-accent`
  (icono + `border-lqc-accent/20`) porque el cian es el acento de "en vivo" del
  sistema; la regla sin-morado no admite excepciones de marca ajena.
- **App.tsx**: spinner en `border-lqc-accent` (marca y máxima legibilidad sobre
  `#0a0a0f`); 404 en `blue-500`/`blue-600` — deliberadamente sobrio, sin cian,
  para que un error no compita con el acento.

Ver también [[verificar-alcance-con-grep]].
