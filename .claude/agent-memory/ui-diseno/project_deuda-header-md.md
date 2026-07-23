---
name: deuda-header-md
description: RESUELTA (2026-07-23) — el header con 6 ítems entra en la franja md compactando nav+promo solo en md; lg quedó intacto
metadata:
  type: project
---

**Estado: resuelta el 2026-07-23.** Al publicar `/registro` en `navItems` el nav
pasó a **6 ítems** y disparó el desborde que esta medición anticipaba. Se resolvió
en `src/components/layout/Header.tsx` **compactando solo la franja `md`
(768–1023px)**, sin ocultar nada:

- **Promo de Revolution505 reducido a su logo en `md`:** el `<span>` del texto y el
  `<ChevronRight>` llevan `md:hidden lg:inline` / `md:hidden lg:block`. El logo del
  patrocinador sigue visible y el `<a>` clickeable — **no desaparece** (la
  restricción dura del usuario). Vuelve completo en `lg`. Padding del promo sin
  tocar (`px-5`), así que en sm (640–767px) se ve igual que antes.
- **Enlaces del nav compactados en `md`:** `px-2.5 lg:px-5`, `text-sm lg:text-lg`,
  gap del `<nav>` `gap-1 lg:gap-8`, y el subrayado activo `left-2.5 right-2.5
  lg:left-4 lg:right-4` para que su inset siga al padding.
- **`lg`+ quedó idéntico a antes:** no se tocó ningún valor `lg:*`.

**Why:** el caso peor era 768px, donde el `container` topa en 768px de ancho
(útil ~720px con `px-6`) y conviven nav de 6 enlaces + logo + promo, con el menú
móvil ya oculto (`md:hidden`) y el promo ya presente (`hidden sm:flex`). Con la
compactación la cuenta baja a ~628px < 720px. La opción de mandar el promo a
`hidden lg:flex` quedó **descartada por el usuario**: dejaría al patrocinador
invisible entre md y lg.

**How to apply:** si hay que sumar un **7º** ítem al nav, volver a medir a 768px y
900px. Ya no queda margen fácil por compactación; la siguiente palanca que
**preserva el promo** es pasar la navegación a hamburguesa hasta `lg` (correr
`md:hidden`/`md:flex` a `lg:hidden`/`lg:flex`) — es más invasivo, avisar al
usuario antes.

Ver también [[canon-formularios]], [[registro-espanol-tuteo]].
