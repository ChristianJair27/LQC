# Memoria — cazador-bugs (LQC)

## Zonas frágiles
- [Build verde ≠ CSS válido](build-warnings-no-fallan.md) — errores de `@theme` salen como WARNING de esbuild; hay que grepear la salida.
- [Namespaces lqc en @theme](theme-lqc-namespaces.md) — `--color-lqc-*` y `--shadow-lqc*` comparten prefijo; colisión latente al agregar tokens.
- [RLS de `inscripciones`](supabase-inscripciones-rls.md) — INSERT anónimo sin SELECT: un `.select()` encadenado rompe el envío del registro.
- [Nunca lanzar al evaluar un módulo](degradar-en-runtime-avisar-en-build.md) — sin ErrorBoundary un throw apaga el sitio entero; el aviso va en `vite.config.ts`.
