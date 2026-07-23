---
name: supabase-inscripciones-rls
description: La tabla `inscripciones` de Supabase tiene RLS con INSERT anónimo pero SIN SELECT — encadenar .select() al insert lo hace fallar por permisos; el esquema no vive en el repo
metadata:
  type: project
---

El formulario de `/registro` escribe en la tabla **`inscripciones`** de Supabase.
La configuración de esa tabla **no está en el repo** (no hay migraciones ni backend),
así que no se puede deducir leyendo el código:

- **RLS activo. Los anónimos solo pueden INSERT, no SELECT.**
- Credenciales por `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (ver `.env.example`;
  no hay `.env` en el repo).

**Why:** cualquier `.select()` o `.single()` encadenado al `.insert()` devuelve un
error de permisos y el envío falla aunque la fila se haya escrito. Es el modo de falla
más fácil de reintroducir "para confirmar que se guardó". En supabase-js v2 el
`.insert()` ya no devuelve filas por defecto, así que la forma correcta es no pedirlas.
Y como toda variable `VITE_*` se empaqueta en el bundle del navegador, ahí solo puede ir
la clave anon/publishable: la `service_role` saltea RLS y sería una fuga real.

**How to apply:**
- Si el envío del registro falla "sin motivo", revisá primero si alguien agregó
  `.select()` / `.single()` al insert, antes de sospechar de la red o del payload.
- Al tocar `src/lib/supabase.ts` o el submit de `src/pages/Registro.tsx`, verificá el
  build **con y sin `.env`**: son dos bundles distintos. Sin credenciales, Rollup pliega
  el guard a `return null` y elimina supabase-js entero como código muerto (el chunk de
  /registro pasa de ~238 kB a ~25 kB); solo el build con `.env` ejercita la ruta real.
  Ver [[degradar-en-runtime-avisar-en-build]] para por qué el módulo nunca lanza.
- `src/` tiene invariante de **cero `console.*`** — en `Registro.tsx` es crítico porque
  el payload son datos personales. Nunca loguees el error del backend; mostrá el mensaje
  genérico. El `revisor` lo chequea.

Ver también [[build-warnings-no-fallan]].
