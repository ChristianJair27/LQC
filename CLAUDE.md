# CLAUDE.md

El contexto completo del proyecto vive en **[AGENTS.md](./AGENTS.md)** — leélo
primero. Es la fuente canónica: qué es el sitio, stack, estructura, sistema de
diseño y reglas de trabajo. Este archivo solo agrega lo específico de Claude Code.

## Lo esencial en tres líneas

- Sitio estático de la **League Querétaro Championship (LQC)**, liga de esports de
  **Revolution505** en Querétaro. React 19 + TypeScript + Vite + Tailwind 4, sin
  backend propio: todo el contenido **público** vive en los componentes. Lo que sí
  toca Supabase es `/registro` —cada jugador se registra solo, con las RPC
  `buscar_equipos` (sugerencias de equipo) y `registrar_jugador` (el envío)— y el
  panel de `/admin`, detrás de login. **El detalle del modelo está en AGENTS.md y
  cambió dos veces: leelo antes de tocar el registro.** Ojo: `inscripciones`, la
  tabla del modelo original, ya no la usa nadie.
- **Regla de color: paleta azul/negro (`#0066ff` / acento `#00d4ff` / fondo `#0a0a0f`)
  y nada de `purple-*`.**
- **`npm run build` (`tsc -b && vite build`) debe pasar antes de commitear.** Que
  pase no garantiza que el formulario funcione: sin `VITE_SUPABASE_URL` ni
  `VITE_SUPABASE_ANON_KEY` (ver `.env.example`) el build sale verde igual y
  `/registro` no guarda nada. El aviso `[LQC]` del build es la única señal.

## Subagentes

En `.claude/agents/`: `cazador-bugs` (depuración), `ui-diseno` (UI/estilo),
`contenido` (copy), `revisor` (review de solo lectura). Los tres primeros llevan
`memory: project`; `revisor` no escribe archivos por diseño.

Delegá según la tarea: bug o error de build → **cazador-bugs**; estilo, layout o
responsive → **ui-diseno**; textos → **contenido**; antes de commitear o tras un
cambio grande → **revisor**.

## Convenciones al trabajar acá

- Textos de la UI **siempre en español**, con acentos correctos.
- Al agregar o renombrar una página: actualizar la `<Route>` en `src/App.tsx`
  **y** `navItems` en `src/components/layout/Header.tsx`.
- No inventar datos de torneos, fechas, resultados ni patrocinadores. Si falta
  información, preguntá.
- Fix mínimo y verificado; nada de refactors oportunistas.
