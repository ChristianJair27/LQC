# LQC — League Querétaro Championship

Sitio web público de la **League Querétaro Championship (LQC)**, la liga de esports
de **Revolution505** en Querétaro. Es un sitio **estático de presentación**: torneos,
galería, información de la liga y contacto. **No hay backend propio** y **todo el
contenido del sitio vive en los componentes** — no se lee nada de ninguna base.

La única excepción, y lo único que el código del sitio envía a un servicio de
datos, es el **formulario de `/registro`**: hace un **INSERT anónimo** en la tabla
`inscripciones` de Supabase. **No hay lectura**, no hay sesiones y no hay usuarios.
(El sitio sí pide fuentes a Google Fonts desde `index.html`, pero eso no manda
datos de nadie.)

La configuración de RLS —INSERT permitido para anónimos, SELECT no— es lo
acordado con quien administra el proyecto de Supabase, pero **no está en el repo
y todavía no se verificó de punta a punta**. Si un día el INSERT falla por
permisos, ese es el primer lugar donde mirar, no el código.

## Stack

- **React 19** + **TypeScript** (strict) + **Vite 7**
- **Tailwind CSS 4** vía `@tailwindcss/vite` — el tema se define con `@theme` en
  `src/index.css`, **no** hay `tailwind.config.js`
- **react-router-dom 7** — rutas declaradas en `src/App.tsx`
- `lucide-react` (iconos), `react-lazy-load-image-component` (galería)
- **`@supabase/supabase-js`** — solo para el INSERT del formulario de `/registro`
- **Infra:** Docker + nginx (`Dockerfile`, `nginx.conf`) y `nixpacks.toml`

## Estructura

```
src/
  App.tsx                  rutas (<Route>) + fallback de carga + 404
  main.tsx                 entrypoint
  index.css                tema Tailwind (@theme), tokens y utilidades
  vite-env.d.ts            tipos de las variables de entorno (VITE_*)
  components/layout/
    Header.tsx             navegación (arreglo navItems) + menú móvil
    Footer.tsx
  lib/
    supabase.ts            cliente de Supabase (perezoso; devuelve null sin credenciales)
  pages/                   Home · Torneos · Galeria · Acerca · Contacto · Registro
public/                    assets, galeria/, images/, sponsors/, LOGO-COPA.ico
```

Las páginas se cargan con `lazy()` + `<Suspense>`. Cada página es un archivo
autocontenido con su markup y sus clases de Tailwind inline.

## Sistema de diseño (NO negociable)

- **Paleta azul/negro.** Azul principal `#0066ff`, acento cian `#00d4ff`, fondo
  `#0a0a0f`. La escala vive en `index.css` como tokens planos
  `--color-lqc-50` … `--color-lqc-900`, más `--color-lqc-accent` y
  `--color-lqc-metal`. En el markup conviven las clases `lqc-*` (superficies de
  marca: acento, CTA, tarjetas) y las `blue-*` de Tailwind para el resto.
- **REGLA "sin morado": nada de clases `purple-*`.** Es la regla de color central
  del proyecto. Ya no queda morado heredado (ver más abajo): `grep -rn "purple" src/`
  debe seguir dando **0 resultados**.
- **Tipografía:** títulos con `--font-heading` (**Orbitron**), cuerpo con
  `--font-sans` (**Inter**).
- **Sombras:** usar los tokens `--shadow-lqc`, `--shadow-lqc-lg`, `--shadow-lqc-xl`.
  No inventar sombras nuevas.
- **Todos los textos de la UI van en español**, con acentos correctos.
- **Mobile-first**, con breakpoints `md` y `lg`.
- Preferir clases de Tailwind inline; CSS suelto solo para tokens en `index.css`.

## Morado heredado — ya migrado

**No queda morado en el sitio.** Las 25 ocurrencias de `purple-*` que había en 6
archivos (`App.tsx`, `Home`, `Torneos`, `Acerca`, `Contacto`, `Galeria`) se
migraron a azul/cian el 2026-07-22. La verificación es
`grep -rn "purple" src/` → **0 resultados**.

Convenciones que dejó esa migración, a respetar en páginas nuevas:

- **Gradiente canónico de títulos** (idéntico en las 6 páginas):
  `from-blue-400 via-blue-300 to-lqc-accent`.
- **CTA primario:** `from-lqc-700 to-lqc-500` con
  `hover:from-lqc-600 hover:to-lqc-400` y `shadow-blue-900/30`. Rampa dentro de
  la escala `lqc` (#003d99 → #0066ff): salto de luminancia visible y ~4.8:1 con
  texto blanco. **No terminar en `lqc-accent`** (#00d4ff da 1.8:1 con blanco).
  Si el CTA es un `<a>` y no un `<button>`, agregarle `text-white`: la regla base
  `a { color: #66a3ff }` de `index.css` no da contraste sobre azul.
- **Tarjetas oscuras de CTA:** `from-blue-950/30 to-lqc-900/20`.
- Al necesitar cian, usar el token `lqc-accent` — nunca `cyan-*` ni un morado.

## Reglas de trabajo

1. **`npm run build` debe pasar sin errores de TypeScript antes de cualquier commit.**
   El script es `tsc -b && vite build`: si los tipos fallan, el build entero se corta.
   Ojo: que el build pase **no** garantiza que el formulario funcione — ver
   "Variables de entorno" más abajo.
2. Al **agregar o renombrar una página** hay que tocar **dos** lugares: la `<Route>`
   en `src/App.tsx` **y** el arreglo `navItems` en `src/components/layout/Header.tsx`.
   Olvidar el segundo es el error más fácil de cometer acá.
   **Excepción deliberada:** `/registro` tiene `<Route>` pero **no** va en `navItems`
   — es una página sin enlazar, accesible solo por URL, hasta que el pipeline de
   producción pase las variables de entorno y se verifique un registro real de
   punta a punta.
3. **No inventar contenido** (fechas, resultados, nombres de torneos, patrocinadores).
   Si falta un dato, marcarlo como pendiente y preguntar.
4. Rama de trabajo: `main`. Remoto: `github.com/ChristianJair27/LQC`.
5. Fix mínimo: no refactorizar de más ni tocar lo no relacionado.

## Cómo trabajar en este proyecto

- **Medí el alcance real antes de actuar.** Antes de delegar o cambiar algo,
  contá las ocurrencias con `grep`. **No confíes en los conteos escritos en la
  documentación**: este archivo decía "17 ocurrencias" de `purple-*` y el conteo
  real era **25**. La doc envejece; el código no miente.
- **Cambios mínimos, un propósito por vez.** Nada de refactors oportunistas
  mientras arreglás otra cosa.
- **Después de cada cambio, verificá con `npm run build`**: debe terminar con
  **0 warnings y 0 errores**. Un warning nuevo es un fallo, no ruido.
- **Verificación independiente.** El reporte de un agente no alcanza como prueba.
  Confirmá por tu cuenta con `grep`, con el build y **leyendo el diff**.
- **Pasá los cambios visibles por el agente `revisor`** antes de commitear.
- **Un commit por propósito.** Nunca mezcles un fix de infraestructura con
  cambios de UI.
- **Mantené este archivo al día.** Si cambia un conteo o un canon de diseño,
  actualizalo **en el mismo commit** que introduce el cambio.

## Trampas conocidas (técnicas)

- **`@theme` solo acepta custom properties planas.** Los tokens van como
  `--color-lqc-500: #0066ff;`, uno por línea — **nunca** con sintaxis de objeto
  anidada entre llaves. Esa forma no es CSS válido: no compila, no genera
  utilidades y la paleta queda inerte mientras el build parece funcionar.
- **Tailwind 4 escanea todo el repo**, incluida `.claude/agent-memory/`. Los
  nombres de clase escritos **en prosa** (notas, documentación) se detectan como
  uso real y se cuelan al CSS de producción. Por eso `src/index.css` tiene
  `@source not "../.claude";` y `@source not "../*.md";` — **mantenelos**.
- **La regla base `a { color: #66a3ff }`** de `index.css` pisa el color de
  cualquier enlace. Todo `<a>` que funcione como CTA necesita `text-white`
  explícito o el contraste falla (llega a bajar a ~1.9:1). Los `<button>` no
  tienen el problema: la regla base ya les da `color: white`.
- **La regla base aplica un gradiente a todo `<button>`**, y las utilidades de
  Tailwind solo pisan `background-color`, **no `background-image`**. Un botón
  secundario con `bg-black/50` igual se pinta con el gradiente completo y termina
  viéndose **más vívido que el CTA primario**. Los secundarios necesitan `bg-none`.
- **Canon del CTA primario:** `from-lqc-700 to-lqc-500` con
  `hover:from-lqc-600 hover:to-lqc-400`.
- **Canon del gradiente de títulos** (idéntico en las 6 páginas):
  `from-blue-400 via-blue-300 to-lqc-accent`.
- **Un build verde puede salir con el formulario muerto.** Si faltan las
  variables de entorno de Supabase, `npm run build` **pasa igual** (0 errores,
  0 warnings) y el sitio se ve perfecto, pero `/registro` no guarda nada: el
  cliente devuelve `null` y el formulario muestra su error genérico. La única
  señal es el aviso `[LQC] Aviso: faltan variables de entorno …` que imprime
  `vite.config.ts`. **No lo pases por alto.** Detalle: sin credenciales Rollup
  elimina `supabase-js` entero como código muerto, así que ese build tampoco
  sirve para probar la ruta real (el chunk de `/registro` pasa de ~238 kB a
  ~25 kB).

## Variables de entorno

Un build **funcional** necesita las dos variables documentadas en `.env.example`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` — la clave **anon/publishable**, nunca la
  `service_role`: toda variable `VITE_*` se empaqueta en el bundle del navegador.

Se inyectan en **tiempo de build**, así que cambiarlas exige rebuildear. No hay
`.env` en el repo (está en `.gitignore`); copiá `.env.example` como `.env`.

**Pendiente (va en su propio commit):** el pipeline de producción todavía **no**
pasa esas variables — el `Dockerfile` no tiene `ARG` ni `ENV` para las `VITE_*` y
no existe `.dockerignore`. Hasta que se resuelva, cualquier imagen construida
desde un checkout limpio sale con el formulario sin guardar nada.

## Comandos

```bash
npm run dev       # servidor de desarrollo (Vite)
npm run build     # tsc -b && vite build  ← la verificación obligatoria
npm run lint      # eslint
npm run preview   # sirve el build de producción
```

## Equipo de agentes

Definidos en `.claude/agents/`:

- **cazador-bugs** — depuración: causa raíz, fix mínimo, verificación con build.
- **ui-diseno** — UI, layout, responsive y estilo, con el sistema de diseño de arriba.
- **contenido** — copy y textos en español.
- **revisor** — revisión de código de solo lectura, antes de commitear.
