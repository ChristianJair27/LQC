---
name: admin-panel-tool-mode
description: Registro visual "herramienta, no póster" para las vistas de datos de /admin — distinto del modo póster de las páginas públicas; reusar en Fase 3 y futuras tablas
metadata:
  type: project
---

Las vistas de datos del panel admin (`/admin`, empezando por
`src/pages/admin/ListaInscripciones.tsx`, Fase 2, 2026-07-23) usan un registro
visual **"herramienta, no póster"**, deliberadamente más sobrio que las páginas
públicas del sitio.

**Why:** el panel es una herramienta de lectura de inscripciones reales, no una
landing. Glow, gradientes en los datos y Orbitron en todos lados matan la
legibilidad y la densidad que un admin necesita. La marca debe entrar solo en los
detalles.

**How to apply:** al agregar cualquier vista de datos bajo `/admin` (Fase 3:
botón de marcar pagado, notas, export; o nuevas tablas), seguir estas reglas en
vez de copiar el estilo de las páginas públicas.

- **Orbitron SOLO en el `<h1>` de la página** (el de `Panel.tsx`, con el gradiente
  canónico `from-blue-400 via-blue-300 to-lqc-accent`). Todo lo demás —números,
  nombres, badges, listas— en `font-sans` (Inter). Ojo: la regla base de
  `index.css` pinta `<h2>`–`<h6>` **y** `<button>` en Orbitron, así que cualquier
  dato dentro de esos tags necesita `font-sans` explícito para no heredarlo.
- **La marca entra en los detalles, no en los datos:**
  - Números del resumen: grandes, `text-blue-400` (azul claro, ~7:1 sobre el
    fondo). Etiqueta debajo en `font-mono text-[11px] uppercase tracking-wider`.
  - Badges de estado y acentos: `lqc-accent` (cian). Como **texto** sobre fondo
    oscuro el cian tiene alto contraste — la penalización 1.8:1 de
    [[contraste-y-reglas-base]] es solo cuando el cian es **fondo** de texto
    blanco. Igual se usa en borde/tinte suave (`bg-lqc-accent/10
    border-lqc-accent/30 text-lqc-accent`), no como relleno bajo texto blanco.
  - Metadatos (contadores, celulares, fechas, labels de campo): `font-mono`,
    `text-gray-400`. Fechas con `toLocaleDateString('es-MX', { day:'2-digit',
    month:'short', year:'numeric' })`.
- **Badge de pago on-paleta, sin colores nuevos:** "Confirmado" = positivo de
  marca (`text-lqc-accent` + tinte cian); "Pendiente" = **gris neutro apagado**
  (`text-gray-400 bg-white/5 border-white/10`). **No** se introdujo verde/ámbar:
  si "Pendiente" pareciera necesitar más urgencia, se reporta en vez de romper la
  paleta. `rose` sigue reservado **solo** a errores.
- **Tres niveles de botón, distinguidos por jerarquía, no solo por color** (en
  `ListaInscripciones.tsx`): `BTN_PRIMARIO` (CTA en gradiente `from-lqc-700`, acción
  primaria de una tarjeta), `BTN_SECUNDARIO` (sobrio gris-con-borde-azul, acción sutil
  de tarjeta) y `BTN_PANEL` (acción a **nivel del panel** — la barra del listado, p. ej.
  "Exportar CSV"). El nivel panel comparte el color sobrio del `BTN_SECUNDARIO` pero con
  la caja de "Cerrar sesión" en `Panel.tsx` (`rounded-xl`, px mayor, `bg-black/50`). Al
  agregar acciones de barra futuras (filtros, refrescar), usar `BTN_PANEL`, **no** el
  nivel tarjeta. `BTN_PANEL` no extiende `BTN_BASE` (chocarían `rounded-lg`/`px`) y por
  eso repite sus propias neutralizaciones (font-sans, sin salto -2px, sin glow).
- **"Azul de acento sobrio" en una acción secundaria = el azul vive en el borde y el
  hover, NUNCA en el label.** Colorear el texto de acento (cian/azul) lo haría competir
  con el CTA primario y leerse como link/badge. El texto va `text-gray-200` (~13:1) →
  `text-white` en hover; ambos estados con contraste de sobra. `text-blue-400`/
  `lqc-accent` como texto quedan para números del resumen y badges, no para botones.
- **Superficies sobrias:** tarjetas `border border-white/10 bg-white/[0.03]`,
  bordes en vez de sombras para separar (las sombras `shadow-lqc` quedan para
  acentos puntuales, no para cada tarjeta de una lista larga). Nada de glow.
- **Estados** (reutilizables como patrón): `cargando` = skeleton on-brand con
  `role="status"` + texto `sr-only`, arrancando desde el estado inicial para que
  no parpadee; `error` = genérico en familia `rose` con `role="alert"`, **nunca**
  expone el objeto de error (el estado es un enum, no guarda el error); `vacío` =
  mensaje amable (no error), reusa la caja punteada con `Inbox` en círculo azul.
- **Sin cliente Supabase** (build sin credenciales) el estado arranca en `error`
  desde el inicializador de `useState`, no con un `setState` síncrono dentro del
  efecto (lo marca `react-hooks/set-state-in-effect`). `obtenerSupabase()` es
  idempotente y nunca lanza, así que llamarlo en el inicializador es seguro.
- **Copy en tuteo mexicano** ([[registro-espanol-tuteo]]): "No pudimos cargar las
  inscripciones.", "Recarga la página e inténtalo de nuevo."

Ver también [[canon-formularios]], [[contraste-y-reglas-base]].
