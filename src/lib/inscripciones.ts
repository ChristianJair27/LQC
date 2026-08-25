/* Estado de la convocatoria del Split Otoño 2026.

   Nació el 2026-08-25, el día que arrancó el pareo suizo y la organización cerró las
   inscripciones. Hasta entonces el estado de la convocatoria NO existía en el repo: la
   frase «Inscripciones abiertas» estaba escrita a mano en Home.tsx y en Torneos.tsx, y
   los comentarios de las dos avisaban que el día del cierre había que borrarlas a mano.
   Este archivo es lo que reemplaza a ese "a mano".

   Vive en src/lib/ por el mismo motivo que reglamento.ts: es una constante con más de un
   consumidor, y duplicarla en cada página la desincroniza en silencio al primer cambio.

   PARA REABRIR LAS INSCRIPCIONES: poner `true` acá y rebuildear. Es el único cambio de
   código que hace falta. Vuelven todos juntos, porque los cuatro consumidores leen esta
   misma constante:
     · src/pages/Registro.tsx   — los campos del formulario, la casilla de privacidad y el
                                  botón «Registrarme»; el aviso de cierre del hero se va.
     · src/pages/Home.tsx       — el CTA «Registrarme» del hero y la sección «¿Vas a
                                  competir?» entera, con su QR.
     · src/pages/Torneos.tsx    — el CTA «Registrarme» del split, y el badge vuelve a
                                  verde con su pulso.
     · src/components/layout/Footer.tsx — la columna del QR «Regístrate» del pie.

   El tipo es `boolean` explícito y no el literal inferido: sin la anotación, TypeScript
   estrecha la constante a `false` y las dos ramas de cada condicional dejan de tipar
   igual, así que el cambio a `true` podría sacar errores que hoy no se ven. Anotado, las
   dos direcciones compilan igual y reabrir es de verdad una sola línea.

   LO QUE ESTE FLAG NO HACE, y conviene tenerlo claro antes de confiarle nada: NO cierra
   la RPC `registrar_jugador`. Es una bandera del frontend y nada más. La función sigue
   siendo pública para `anon` y sigue aceptando envíos de cualquiera que la llame con la
   URL del proyecto y la anon key — las dos van en el bundle por diseño, así que están a la
   vista de cualquiera que abra las herramientas de desarrollo. Esto cierra la puerta de
   entrada del sitio, no la base. Si se necesita un cierre real, va del lado de Supabase.

   Nota sobre el build, para no sacar conclusiones equivocadas al verificar: con el flag en
   `false`, Rollup propaga la constante entre módulos y ELIMINA del bundle el JSX que quedó
   detrás de los condicionales. O sea que grepear dist/ y no encontrar «Registrarme» ni
   `registrar_jugador` es lo ESPERADO, no una señal de que se borró algo. El código fuente
   está entero; lo que no viaja es el código muerto. Verificar siempre contra src/.

   Y hay dos textos que TAMPOCO alcanza, porque no son React. Al reabrir hay que volver a
   editarlos a mano:
     · Las metas de index.html (`description`, `og:description`, `twitter:description`) y
       el bloque <noscript>: son HTML estático.
     · La respuesta del FAQ «¿Cómo nos inscribimos?» en src/pages/Contacto.tsx, que es una
       cadena dentro del arreglo de preguntas, no un bloque condicionable. */
export const INSCRIPCIONES_ABIERTAS: boolean = false
