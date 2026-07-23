---
name: contraste-y-reglas-base
description: Al pintar fondos de color hay que comprobar el contraste del label y qué regla base de index.css hereda el tag (a vs button)
metadata:
  type: feedback
---

Antes de dar por cerrado un cambio de color de fondo, calcular el **contraste del
texto encima** y mirar **qué regla base de `src/index.css` le aplica al tag**.
`<button>` y `<a>` no parten del mismo color: `index.css` le da `color: white` a
los botones pero `color: #66a3ff` a los anchors.

**Why:** en la migración sin morado dejé dos CTA que son `<a>` sin `text-white`;
su label quedó en #66a3ff sobre azul (1.9:1 en `Home.tsx`, y 1.4:1 en hover) —
*peor* que el morado que reemplacé. Se veían idénticos a sus hermanos `<button>`
en el markup, pero heredaban un color distinto.

**How to apply:** cuando un CTA sea `<a>`, agregarle `text-white` explícito (ya
está en `AGENTS.md`). Y ojo con la **segunda** mitad de esa regla base, que no
está documentada: `a::after` le dibuja a **todo** enlace una barra de gradiente
que crece en hover. En un enlace de texto queda bien, pero en uno con forma de
pastilla o botón aparece un subrayado de más pegado al borde inferior. Se apaga
con `after:hidden` (genera `display:none` sobre el pseudo-elemento y gana por
especificidad); no hace falta tocar `index.css`.

Cuando elija un color de fondo nuevo, verificar ≥4.5:1 con
el texto — eso descarta `lqc-accent` (#00d4ff) como fondo de texto blanco, sirve
sólo como acento de iconos, bordes y degradados de título. Y en un sitio
monocromo, revisar que los gradientes tengan salto de **luminancia**, no de tono.

Ver también [[migracion-sin-morado]], [[verificar-alcance-con-grep]].
