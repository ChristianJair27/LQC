---
name: admin-feedback-no-textual
description: Acciones del panel admin cuyo único feedback de éxito es visual o un side-effect no textual (descargar CSV, copiar al portapapeles, refrescar) necesitan una región sr-only aria-live que anuncie el resultado a lectores de pantalla
metadata:
  type: project
---

Cuando una acción del panel `/admin` comunica su resultado SOLO por un efecto
visual o un side-effect no textual —el caso canónico es "Exportar CSV" en
`src/pages/admin/ListaInscripciones.tsx`, cuya única señal de éxito es que el
navegador descarga el archivo—, hay que acompañarla con una **región viva
`sr-only`** que anuncie el resultado.

**Why:** una descarga (o un copiar-al-portapapeles, o un refresco silencioso) no
le dice NADA a quien usa lector de pantalla: no hay cambio de texto en pantalla
que anunciar, así que la acción "no ocurrió" para ese usuario. La región viva es
la única señal audible de que pasó algo.

**How to apply:** para cualquier acción del panel cuyo feedback sea no textual
(descargas, copiar al portapapeles, refrescar), montar una región aria-live y
fijar su mensaje en el handler. Patrón adoptado:

- `<span role="status" aria-live="polite" className="sr-only">{mensaje}</span>`
  como **último hijo** del contenedor. `sr-only` (position:absolute) para no
  alterar el layout del encabezado.
- Se monta **siempre**, con el estado del mensaje arrancando en `''` (cadena
  vacía): así aria-live ya está observando el nodo y capta el cambio cuando el
  handler escribe el texto. Montarla recién al éxito puede perder el anuncio.
- El handler fija el mensaje en un `useState`: `'CSV descargado.'` al éxito,
  `'No hay inscripciones para exportar.'` en el guard defensivo. Mensajes en
  tuteo mexicano ([[registro-espanol-tuteo]]).
- `role="status"` YA implica `aria-live="polite"` (no interrumpe la lectura en
  curso); el `aria-live="polite"` explícito se deja solo por claridad.

Es el mismo espíritu que los **Estados** de [[admin-panel-tool-mode]]: el
skeleton de carga usa `role="status"` + texto `sr-only`, y `role="alert"` queda
reservado a errores. Regla de tono: `role="status"`/`polite` para
confirmaciones no urgentes; `role="alert"`/`assertive` solo para errores. Ver
también [[contraste-y-reglas-base]].
