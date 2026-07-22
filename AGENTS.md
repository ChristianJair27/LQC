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
  del proyecto. Hay morado heredado pendiente de migrar (ver más abajo) — al tocar
  un archivo que lo tenga, migrarlo a `blue-*`.
- **Tipografía:** títulos con `--font-heading` (**Orbitron**), cuerpo con
  `--font-sans` (**Inter**).
- **Sombras:** usar los tokens `--shadow-lqc`, `--shadow-lqc-lg`, `--shadow-lqc-xl`.
  No inventar sombras nuevas.
- **Todos los textos de la UI van en español**, con acentos correctos.
- **Mobile-first**, con breakpoints `md` y `lg`.
- Preferir clases de Tailwind inline; CSS suelto solo para tokens en `index.css`.

## Deuda conocida — morado heredado

`purple-*` aparece **17 veces en 6 archivos** (medido el 2026-07-22):

| Archivo | Ocurrencias | Qué es |
|---|---|---|
| `src/App.tsx` | 3 | spinner de carga + título y botón del 404 |
| `src/pages/Acerca.tsx` | 4 | gradiente del h1, botón CTA, tarjeta, botón final |
| `src/pages/Home.tsx` | 4 | gradiente del h1, badge de Twitch, botón CTA |
| `src/pages/Torneos.tsx` | 3 | gradiente del h1, tarjeta, botón |
| `src/pages/Contacto.tsx` | 2 | gradiente del h1, botón de envío |
| `src/pages/Galeria.tsx` | 1 | gradiente del h1 |

El patrón dominante es el gradiente de títulos
`from-blue-400 via-blue-300 to-purple-400`, repetido en las 5 páginas — conviene
migrarlo de una sola vez y de forma consistente, no página por página.

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
