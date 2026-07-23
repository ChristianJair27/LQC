# Memoria — cazador-bugs (LQC)

## Zonas frágiles
- [Build verde ≠ CSS válido](build-warnings-no-fallan.md) — errores de `@theme` salen como WARNING de esbuild; hay que grepear la salida.
- [Namespaces lqc en @theme](theme-lqc-namespaces.md) — `--color-lqc-*` y `--shadow-lqc*` comparten prefijo; colisión latente al agregar tokens.
- [RLS de `inscripciones`](supabase-inscripciones-rls.md) — INSERT anónimo sin SELECT: un `.select()` encadenado rompe el envío del registro.
- [Nunca lanzar al evaluar un módulo](degradar-en-runtime-avisar-en-build.md) — degradar en runtime, avisar en `vite.config.ts`; ya hay ErrorBoundary pero el contrato sigue.
- [setState síncrono en useEffect](eslint-set-state-in-effect.md) — es ERROR de ESLint (no del build); resolver con inicializador perezoso de useState.
