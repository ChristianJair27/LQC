---
name: deuda-header-md
description: Medición archivada — el header no aguanta un 6º ítem de navegación entre md y lg; revisarla antes de agregar uno
metadata:
  type: project
---

**Estado: latente.** El nav volvió a **5 ítems** el 2026-07-22 (el ítem
"Registro" se quitó el mismo día por decisión de producto, ver
[[canon-formularios]]), así que hoy no hay síntoma visible. La medición queda
para el próximo que quiera sumar una página.

La barra del header se queda **sin ancho en la franja 768–1024px** (`md` hasta
`lg`) apenas hay **6 enlaces**, porque ahí conviven además el logo y el botón
promocional de Revolution505.

**Why:** al medir el caso peor a 768px (contenedor útil ~720px) la suma da
~960px: nav ~590px (6 enlaces con `px-4` y `text-base`), logo ~116px y el promo
de Revolution505 ~210px. El promo es `hidden sm:flex`, así que aparece justo en
la franja donde el menú móvil (`md:hidden`) ya se ocultó. Con 5 enlaces la cuenta
ya va apretada (~855px): un 6º ítem no crearía el problema, lo haría visible.
El usuario decidió **no tocar el promo de Revolution505** para ganar ese espacio.

**How to apply:** antes de agregar una página al `navItems` de
`src/components/layout/Header.tsx`, verificar en el navegador a 768px y a 900px.
Si hay que ganar espacio, el orden de menor a mayor daño es: (1) compactar los
enlaces solo en `md` (`px-2.5 lg:px-5`, `text-sm lg:text-lg`) — no alcanza solo;
(2) pasar el promo de Revolution505 a `hidden lg:flex`, que libera ~210px pero
**deja al patrocinador invisible entre md y lg** porque el menú móvil no está
disponible ahí; (3) mover la navegación a un menú hamburguesa hasta `lg`.
La opción (2) toca visibilidad de un patrocinador: **ya fue descartada una vez**,
es decisión del usuario y no del agente.

Ver también [[canon-formularios]].
