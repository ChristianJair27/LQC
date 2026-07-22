---
name: theme-lqc-namespaces
description: En el @theme de LQC conviven --color-lqc-* y --shadow-lqc*, que comparten prefijo pero generan utilidades distintas — zona frágil al editar tokens
metadata:
  type: project
---

`src/index.css` tiene dos familias de tokens que empiezan igual y es fácil pisarlas:

- `--color-lqc-<escala>` → namespace de color. Genera `bg-`, `text-`, `border-`,
  `shadow-`, `ring-`, etc.
- `--shadow-lqc`, `--shadow-lqc-lg`, `--shadow-lqc-xl` → namespace de box-shadow.
  Son los que SÍ se usan hoy en los componentes.

**Why:** el namespace de color hace que `shadow-lqc-accent` / `shadow-lqc-metal` existan
como *color de sombra* (`--tw-shadow-color`), mientras `shadow-lqc-lg` sigue siendo la
*sombra completa* (`box-shadow`). No chocan hoy porque ningún sufijo se repite (`lg`/`xl`
no son colores; `50`..`900`/`accent`/`metal` no son tamaños de sombra), pero es una
colisión latente: agregar un `--color-lqc-lg` o un `--shadow-lqc-accent` rompería el otro
en silencio, sin warning de build (ver [[build-warnings-no-fallan]]).

**How to apply:**
- Antes de agregar un token `lqc`, chequeá que el sufijo no exista ya en la otra familia.
- Si tocás la paleta, verificá que `.shadow-lqc`, `.shadow-lqc-lg` y `.shadow-lqc-xl`
  sigan emitiendo `box-shadow` en el CSS compilado — es lo que usan los componentes.
- La paleta es regla de proyecto (azul/negro, sin `purple-*`): nunca cambies un hex
  "de paso" mientras arreglás sintaxis.
