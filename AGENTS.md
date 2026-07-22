# LQC — League Querétaro Championship

Sitio web público de la **League Querétaro Championship (LQC)**, la liga de esports
de **Revolution505** en Querétaro. Es un sitio **estático de presentación**: torneos,
galería, información de la liga y contacto. **No hay backend ni base de datos** —
todo el contenido vive en los componentes.

## Stack

- **React 19** + **TypeScript** (strict) + **Vite 7**
- **Tailwind CSS 4** vía `@tailwindcss/vite` — el tema se define con `@theme` en
  `src/index.css`, **no** hay `tailwind.config.js`
- **react-router-dom 7** — rutas declaradas en `src/App.tsx`
- `lucide-react` (iconos), `react-lazy-load-image-component` (galería)
- **Infra:** Docker + nginx (`Dockerfile`, `nginx.conf`) y `nixpacks.toml`

## Estructura

```
src/
  App.tsx                  rutas (<Route>) + fallback de carga + 404
  main.tsx                 entrypoint
  index.css                tema Tailwind (@theme), tokens y utilidades
  components/layout/
    Header.tsx             navegación (arreglo navItems) + menú móvil
    Footer.tsx
  pages/                   Home · Torneos · Galeria · Acerca · Contacto
public/                    assets, galeria/, images/, sponsors/, LOGO-COPA.ico
```

Las páginas se cargan con `lazy()` + `<Suspense>`. Cada página es un archivo
autocontenido con su markup y sus clases de Tailwind inline.

## Sistema de diseño (NO negociable)

- **Paleta azul/negro.** Azul principal `#0066ff`, acento cian `#00d4ff`, fondo
  `#0a0a0f`. La escala completa vive en `--color-lqc` (`index.css`); en el markup
  se usan las clases `blue-*` de Tailwind.
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

- **Gradiente canónico de títulos** (idéntico en las 5 páginas):
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
2. Al **agregar o renombrar una página** hay que tocar **dos** lugares: la `<Route>`
   en `src/App.tsx` **y** el arreglo `navItems` en `src/components/layout/Header.tsx`.
   Olvidar el segundo es el error más fácil de cometer acá.
3. **No inventar contenido** (fechas, resultados, nombres de torneos, patrocinadores).
   Si falta un dato, marcarlo como pendiente y preguntar.
4. Rama de trabajo: `main`. Remoto: `github.com/ChristianJair27/LQC`.
5. Fix mínimo: no refactorizar de más ni tocar lo no relacionado.

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
