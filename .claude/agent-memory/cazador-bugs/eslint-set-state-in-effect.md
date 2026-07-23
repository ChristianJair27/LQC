---
name: eslint-set-state-in-effect
description: En LQC, un setState síncrono en el cuerpo de un useEffect es ERROR de ESLint (react-hooks/set-state-in-effect) — resolver con inicializador perezoso de useState, no con un set en el efecto
metadata:
  type: feedback
---

`npm run build` (`tsc -b && vite build`) **no** cataliza esta regla: un `setState()`
llamado de forma **síncrona dentro del cuerpo de un `useEffect`** compila sin problema
pero es **error** de `npx eslint` (`react-hooks/set-state-in-effect`, viene en
`reactHooks.configs.flat.recommended` de `eslint.config.js`).

**Why:** al construir el panel de admin (2026-07-23) resolvía el caso "sin cliente
Supabase" con un `if (!supabase) { setEstado('sin-sesion'); return }` dentro del efecto.
Build verde, pero ESLint lo cortó por renders en cascada. Detalle que confunde: la regla
marcó `RutaProtegida` (deps `[]`) pero **no** `Login` (deps `[navigate]`) pese a tener la
misma forma; no te fíes de que "si no marcó el gemelo, está bien" — arreglá los dos.

**How to apply:**
- Si el valor inicial del estado se puede decidir en el render, usá un **inicializador
  perezoso**: `useState(() => obtenerSupabase() ? 'verificando' : 'sin-sesion')`. Así el
  único `setState` queda en un callback **asíncrono** (`.then`, `onAuthStateChange`,
  handlers), que la regla permite.
- Los `setState` dentro de `.then()`/`.catch()`/callbacks de suscripción **no** disparan
  la regla (no son síncronos respecto del cuerpo del efecto).
- El invariante de verificación del repo incluye `npx eslint` sobre los archivos nuevos,
  no solo `npm run build`. Un build verde no garantiza lint limpio.
- Patrón que se repite en flujos de sesión: estado "verificando" inicial sin flash +
  suscripción a `onAuthStateChange` con flag `montado` y `unsubscribe()` en el cleanup.
