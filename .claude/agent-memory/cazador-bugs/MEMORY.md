# Memoria — cazador-bugs (LQC)

## Zonas frágiles
- [Build verde ≠ CSS válido](build-warnings-no-fallan.md) — errores de `@theme` salen como WARNING de esbuild; hay que grepear la salida.
- [Namespaces lqc en @theme](theme-lqc-namespaces.md) — `--color-lqc-*` y `--shadow-lqc*` comparten prefijo; colisión latente al agregar tokens.
