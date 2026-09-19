/* Estado de la convocatoria del Split Otoño 2026.

   Nació el 2026-08-25, el día que arrancó el pareo suizo y la organización cerró las
   inscripciones. Hasta entonces el estado de la convocatoria NO existía en el repo: la
   frase «Inscripciones abiertas» estaba escrita a mano en Home.tsx y en Torneos.tsx, y
   los comentarios de las dos avisaban que el día del cierre había que borrarlas a mano.
   Este archivo es lo que reemplaza a ese "a mano".

   Vive en src/lib/ por el mismo motivo que reglamento.ts: es una constante con más de un
   consumidor, y duplicarla en cada página la desincroniza en silencio al primer cambio.

   OJO, ESTO SOLO DECIDE SI EL FORMULARIO SE VE. Para que la base acepte registros hace
   falta además `public.configuracion.inscripciones_abiertas` en true: un UPDATE, sin
   deploy. Ver AGENTS.md, «Candado de inscripciones (2026-09-18)».
   Con `true` acá (y rebuild), el formulario vuelve entero, porque los cinco consumidores
   leen esta misma constante:
     · src/pages/Registro.tsx   — los campos del formulario, la casilla de privacidad y el
                                  botón «Registrarme»; el aviso de cierre del hero se va.
     · src/pages/Home.tsx       — el CTA «Registrarme» del hero y la sección «¿Vas a
                                  competir?» entera, con su QR.
     · src/pages/Torneos.tsx    — el CTA «Registrarme» del split, y el badge vuelve a
                                  verde con su pulso.
     · src/pages/Contacto.tsx   — la respuesta del FAQ «¿Cómo nos inscribimos?», que es la
                                  primera y la que el acordeón abre por defecto.
     · src/components/layout/Footer.tsx — la columna del QR «Regístrate» del pie.

   El tipo es `boolean` explícito y no el literal inferido: sin la anotación, TypeScript
   estrecha la constante a `false` y las dos ramas de cada condicional dejan de tipar
   igual, así que el cambio a `true` podría sacar errores que hoy no se ven. Anotado, las
   dos direcciones compilan igual y mostrar el formulario es de verdad una sola línea.

   LO QUE ESTE FLAG NO HACE: NO cierra la RPC `registrar_jugador`, que sigue siendo
   ejecutable por `anon` con la URL y la anon key del bundle. Esto cierra la puerta del
   sitio, no la base. El cierre real, desde el 2026-09-18, es el candado de
   `public.configuracion` (ver arriba).

   Nota sobre el build, para no sacar conclusiones equivocadas al verificar: con el flag en
   `false`, Rollup propaga la constante entre módulos y ELIMINA del bundle el JSX que quedó
   detrás de los condicionales. O sea que grepear dist/ y no encontrar «Registrarme» ni
   `registrar_jugador` es lo ESPERADO, no una señal de que se borró algo. El código fuente
   está entero; lo que no viaja es el código muerto. Verificar siempre contra src/.

   Y hay UN texto que TAMPOCO alcanza, porque no es React: las metas de index.html
   (`description`, `og:description`, `twitter:description`) y el bloque <noscript>. Son
   HTML estático y hay que editarlos a mano en los dos sentidos.

   Ese "un texto" fueron dos hasta que se corrigió el error: el commit del cierre daba por
   perdida también la respuesta del FAQ de Contacto.tsx, con el argumento de que era «una
   cadena dentro de un arreglo, no un bloque de JSX». El argumento era falso —esta bandera
   gobierna cualquier expresión de TypeScript, no solo JSX— y ya se arregló con un ternario.
   Queda anotado porque el mismo razonamiento equivocado puede volver: si un texto vive en
   un .ts o .tsx, el flag LO ALCANZA. La única frontera real es lo que no pasa por el
   bundle. */
export const INSCRIPCIONES_ABIERTAS: boolean = false
