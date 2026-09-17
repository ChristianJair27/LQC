# LQC — League Querétaro Championship

Sitio web público de la **League Querétaro Championship (LQC)**, la liga de esports
de **Revolution505** en Querétaro. Es un sitio **estático de presentación**: torneos,
galería, información de la liga y contacto. **No hay backend propio** y casi todo el
contenido **público** vive en los componentes.

**Hay dos excepciones, y leen de fuentes distintas.**

1. **La galería.** Desde el **2026-08-08**, `/galeria` lee la tabla
   `public.galeria_media` y arma las URLs contra el bucket `galeria` de Storage — ver
   [Galería dinámica](#galería-dinámica-galeria--panel).
2. **El split en vivo.** Desde el **2026-09-15**, `/` y `/torneos` pintan la **tabla de
   posiciones** real del torneo en curso, y `/torneos` además los **emparejamientos de la
   ronda**, leyendo la **API pública de ATAK.GG** —no una base nuestra— con
   `obtenerTorneo()` y `obtenerBracket()` de `src/lib/atak.ts` — ver
   [Clasificación en vivo](#clasificación-en-vivo-desde-el-2026-09-15).

Ninguna otra página pública lee nada.

> **LEER ANTES DE TOCAR `/registro`: las inscripciones están CERRADAS desde el
> 2026-08-25.** El formulario existe y está entero, pero no se renderiza: lo apaga la
> bandera `INSCRIPCIONES_ABIERTAS` de `src/lib/inscripciones.ts`. Todo lo que describe la
> sección de abajo sigue siendo cierto del modelo y de las RPC —la base no cambió—, pero
> hoy **nada de eso se dispara desde el sitio**. Ver
> [Inscripciones cerradas](#inscripciones-cerradas-desde-el-2026-08-25--inscripciones_abiertas).

## Modelo de datos: el equipo es una entidad (migrado el 2026-07-29)

**La tabla `inscripciones` ya NO se usa.** Sigue existiendo en la base —no se borró—
pero ni el registro ni el panel la tocan. El modelo pasó de *una fila = un jugador*,
con el equipo como un **string repetido** en cada fila, a dos tablas.

> **Cómo se registra la gente cambió DOS veces, y las dos siguen dejando rastro.**
> Las tablas de abajo son las mismas desde el 2026-07-29; lo que cambió el
> **2026-07-30** es la superficie pública. Resumen, porque el orden importa para leer
> los comentarios viejos del repo:
>
> 1. **Registro individual sobre `inscripciones`** — una fila por jugador y el equipo
>    como texto libre repetido. Un typo partía el equipo en dos.
> 2. **Registro por equipo** (`registrar_equipo`) — el capitán cargaba el roster de 5
>    a 7 jugadores en un solo envío. Arregló el typo, pero puso a una persona a
>    tipear los datos personales de otras seis desde un teléfono.
> 3. **Registro individual sobre el esquema relacional** (vigente) — cada quien manda
>    lo suyo otra vez, pero el equipo se **elige de una lista** que sale de la base,
>    no se escribe de memoria. El typo se evita por reconocimiento.
>
> **`registrar_equipo` ya no la llama nadie desde el repo.** No se comprobó si sigue
> existiendo en la base: si vas a tocarla, verificá primero.

- **`public.equipos`** — `id` (uuid), `nombre`, `nombre_norm`,
  `capitan_nombre` (**⚠ lleva el Riot ID, no un nombre — ver la trampa de abajo**),
  `capitan_celular`, `pagado`, `pagado_en`, `notas`, `archivado_en`, `creado_en`.
- **`public.jugadores`** — `id`, `equipo_id`, `orden`, `gamertag`, `nombre`,
  `fecha_nacimiento`, `celular`, `correo`, `municipio`, `escolaridad`, `genero`,
  `rol` (`'titular'|'suplente'`), `creado_en`. **`localidad` ya no existe.**

Tres cosas tocan Supabase (la tercera, la galería, está documentada en su propia
sección más abajo):

- El **formulario público de `/registro`** llama a **dos** RPC, y a nada más. El
  cliente anónimo **no lee las tablas**: no intentes un `.select()` sobre `equipos` ni
  `jugadores`, no va a devolver nada y no es un bug de RLS.

  - **`buscar_equipos(termino)`** — alimenta el combobox de equipo. Devuelve hasta 5
    filas `{ id, nombre, jugadores }` ordenadas por similitud, por coincidencia
    parcial **y difusa** (`pg_trgm` según quien la escribió; desde el repo no se puede
    comprobar), así que «los pandit» encuentra «Los Panditas».
    Es pública y **no devuelve datos personales**: solo el nombre del equipo y cuántos
    jugadores tiene. Ese conteo no es decorativo — es lo que deja reconocer al equipo
    correcto entre dos nombres parecidos y lo que marca a un equipo lleno (7).
  - **`registrar_jugador(datos jsonb)`** — el envío. `datos` lleva siempre los datos
    del jugador (`gamertag`, `nombre`, `fecha_nacimiento`, `celular`, `correo`,
    `municipio`, `escolaridad`, `genero`, `es_capitan`) **más una de estas dos, nunca
    las dos**: `equipo_id` si se eligió un equipo de las sugerencias, o `equipo` con
    un nombre nuevo, que la función crea. **`rol` y `orden` no se mandan**: los asigna
    la función —titular los 5 primeros, suplente del 6º— contando lo que ya hay.
    Devuelve `{ ok:true, equipo_id, orden }` o `{ ok:false, error }` con los códigos
    `falta_gamertag`, `falta_equipo`, `equipo_lleno`, `gamertag_duplicado` y
    `torneo_lleno` (ver el tope de 32 equipos más abajo).

  **La página lee `orden` como "cuántos jugadores tiene el equipo ahora"** para poder
  decir «tu equipo tiene 3 de 5 jugadores mínimos» en la pantalla de éxito. Eso exige
  que `orden` sea **1-based**, y lo es: **verificado el 2026-07-30**, la función hace
  `v_orden := v_total + 1`. (Estuvo un día documentado como suposición del cliente; ya
  no lo es.)

  **Hay un tope de 32 EQUIPOS en toda la liga**, el que fija el reglamento oficial
  («Esta liga estará limitada a un máximo de 32 equipos»). Lo hace cumplir la RPC, que
  rechaza con **`torneo_lleno`**. Lo importante de ese código, y lo que su mensaje en
  `/registro` explica: **el tope bloquea CREAR equipos nuevos, no unirse a uno ya
  inscrito.** Un `torneo_lleno` no significa que la persona no pueda participar —
  significa que tiene que elegir su equipo de las sugerencias en vez de escribir un
  nombre nuevo. Redactar ese mensaje como «el torneo está cerrado» hace que alguien
  que sí podía inscribirse se vaya.

  **TRAMPA: `capitan_nombre` NO lleva un nombre, lleva el RIOT ID del capitán**
  (formato `nombre#tag`), porque es lo que ATAK espera en ese campo. Confirmado por
  los organizadores el 2026-07-29. El nombre de la columna engaña y es de lo más fácil
  de malinterpretar leyendo solo el esquema. **No la renombres:** el nombre es el mismo
  contrato que espera ATAK, y cambiarlo obligaría a tocar funciones que viven en la
  base y no en el repo. El panel la etiqueta «Capitán (Riot ID)» y el CSV la exporta
  como «Riot ID del Capitán», justamente para que nadie la lea como un nombre mal
  escrito.

  Ojo con una consecuencia del modelo nuevo: **el formulario ya no manda
  `capitan_nombre` ni `capitan_celular`**. Manda un booleano `es_capitan` por jugador,
  y quién termina en esas columnas de `equipos` lo resuelve la base. Cómo lo resuelve
  exactamente **no está verificado desde acá** — si te importa, leelo en Supabase, no
  lo deduzcas del formulario. Lo que sí es decisión del cliente: la casilla **no es
  obligatoria y no se valida**. Esta página no puede saber si alguien más del equipo
  ya la marcó (no lee las tablas), así que advertir «nadie es capitán todavía» sería
  mentir; si nadie la marca, la organización toma al primero que se registró.
- El **panel de administración (`/admin`)**, detrás de login, lee las dos tablas con
  **un solo SELECT con join** (`equipos` con sus `jugadores` ordenados por `orden`) y
  **ya no agrupa nada en el cliente**. Tiene sesión de usuario; los admins se crean a
  mano en Supabase, no hay alta pública. Sobre `equipos` escribe con
  `UPDATE ... .eq('id', equipo.id)`: pago (`pagado`, `pagado_en`), notas (`notas`) y
  archivado (`archivado_en`).
  **De los jugadores edita SOLO el nombre y el correo, y NO por UPDATE**: el grant de
  UPDATE de `authenticated` sobre `jugadores` fue **revocado**, y la única vía es la RPC
  `editar_jugador(p_jugador_id uuid, p_cambios jsonb)`, que acepta únicamente esas dos
  claves, valida del lado de la base y sincroniza el correo con ATAK.GG. Todo lo demás del
  jugador —`gamertag`, `celular`, `fecha_nacimiento`, `municipio`, `escolaridad`, `genero`,
  `rol` y `orden`— sigue sin poder tocarse desde el panel. `rol` y `orden` en particular
  los asigna `registrar_jugador` contando los que ya estaban: cambiarlos a mano rompería la
  correspondencia entre posición en el roster y quién es titular.
  **La RPC devuelve `{ ok: false, error: <código> }` con HTTP 200 al rechazar**, así que
  `error` de supabase-js viene null: hay que mirar `data.ok`. Verificar solo el error de la
  librería daría por bueno un guardado que la base no hizo.
  **Nunca DELETE sobre `equipos` ni `jugadores`**: no hay política de DELETE para esas
  dos, así que un borrado fallaría en silencio —devolvería 0 filas *sin* error— y
  archivar es la alternativa (`archivado_en` null = activo, con fecha = archivado). El
  archivado depende además de que el SELECT siga devolviendo las filas archivadas.
  (`galeria_media` **sí** tiene DELETE, y es la única: ver "Galería dinámica".)

**Lo que desapareció con la migración, y no hay que reponer:** el estado `'parcial'`
del archivado y su detección de éxito parcial. Existían porque archivar eran *N*
updates que podían fallar a medias; con una fila por equipo el UPDATE es atómico y el
resultado es ok o error. (El `.select()` posterior al UPDATE de archivado **sí** se
conservó, pero con otro propósito: comprobar que alcanzó una fila visible, o sea
0 filas = error.)

**Registrar o archivar un equipo dispara efectos FUERA de este repo.** Hay PL/pgSQL en
Supabase que sincroniza con **ATAK.GG** vía `pg_net`, por **dos caminos y solo uno es
un trigger** (verificado en producción el 2026-07-29):

- **Alta: NO es un trigger, y sigue sin serlo** (verificado en producción el
  **2026-07-30**, con el modelo de registro individual ya desplegado).
  `registrar_jugador` termina su cuerpo con
  `perform public.atak_enviar('/register', <datos del jugador>)`. Lo verificado es
  **qué** hace la función, no por qué se eligió así: el argumento viejo —un
  `AFTER INSERT` sobre `equipos` mandaría el equipo antes de tener roster— ya no
  aplica, porque acá cada INSERT de `jugadores` sí trae la fila entera. O sea que hoy
  **sí podría** ser un trigger y no lo es; por qué, no está documentado.

  Ojo con dos diferencias respecto del modelo anterior, que la doc vieja no cubre:
  el endpoint es **`/register`** (jugador), no `/register-team` (roster entero), y se
  llama **una vez por jugador**, no una por equipo. Del lado de ATAK eso se resuelve
  solo: responde **`team_created`** con el primer jugador de un equipo y
  **`player_added`** con los siguientes. Confirmado con respuestas reales.

  (La RPC vieja `registrar_equipo` llamaba en cambio a
  `atak_enviar('/register-team', armar_roster_atak(id))`. Ya no la llama nadie desde
  el repo.)
- **Baja y alta por archivado: sí es trigger.** `trg_atak_equipo`, `AFTER UPDATE OF
  archivado_en ON public.equipos`, con `WHEN (old IS DISTINCT FROM new)` para que
  marcar pago o guardar notas no disparen nada. Archivar llama a `/unregister`;
  restaurar, a `/register-team`.

`/register-team` es **atómico e idempotente** del lado de ATAK (lock de fila, y el
roster enviado reemplaza al que hubiera), así que reenviarlo es la forma barata de
reparar una llamada perdida. Ojo: eso está comprobado de `/register-team`, que hoy usa
**solo el trigger de archivado**. De `/register` —el del alta— **no se comprobó si es
idempotente**, así que no des por hecho que reenviarlo sea inofensivo.

**De nada de esto hay una sola línea en el repo** —ni webhook, ni edge function, ni
carpeta `supabase/`—, así que grepear el código y no encontrar nada **no** prueba que
la integración no exista: ya llevó a un agente a concluir exactamente eso. (Ojo:
`src/lib/atak.ts` **sí** es código de ATAK, pero es otra cosa —la validación del Riot
ID contra la API pública— y no tiene nada que ver con esta sincronización.)
Antes de afirmar nada sobre ATAK.GG, leé
**[docs/INTEGRACION-ATAK.md](./docs/INTEGRACION-ATAK.md)**, que documenta los dos
caminos con su SQL, el riesgo vigente (las llamadas son **fire-and-forget**: `pg_net`
no devuelve el resultado a quien la hizo, así que si la llamada falla o ATAK la
rechaza, la escritura local sale bien igual y las dos bases divergen sin un solo
aviso) y cómo diagnosticarlo con `net._http_response`. Ese archivo conserva además,
en una sección marcada como histórica, los triggers viejos sobre `inscripciones`:
sirven para entender por qué las cosas son como son, pero **no corren para nada
nuevo**.

(El sitio además pide fuentes a Google Fonts desde `index.html`, pero eso no manda
datos de nadie.)

La RLS con el modelo nuevo:

- **`equipos` y `jugadores`**: el anónimo **no lee ni escribe** ninguna de las dos —su
  única superficie son las RPC `buscar_equipos` y `registrar_jugador`, que corren con
  permisos propios—. `buscar_equipos` es la excepción aparente y no lo es: devuelve
  nombre y conteo, nunca datos personales. El usuario **autenticado** tiene **SELECT en
  las dos** y **UPDATE solo en `equipos`**.
- **El UPDATE de `authenticated` sobre `jugadores` está REVOCADO.** El panel edita nombre y
  correo por la RPC **`editar_jugador(p_jugador_id uuid, p_cambios jsonb)`**, que corre con
  permisos propios y es la **única** vía de escritura sobre esa tabla desde el sitio.
  `p_cambios` acepta solo las claves `nombre` y `correo`; cualquier otra se rechaza con
  `campo_no_permitido`. Devuelve `{ ok: true, jugador_id, correo, nombre }` o
  `{ ok: false, error: <código> }` —`campo_no_permitido`, `correo_invalido`,
  `correo_vacio`, `nombre_vacio`, `sin_cambios`, `jugador_no_encontrado`— **siempre con
  HTTP 200**, así que el rechazo no llega como excepción y hay que leer `data.ok`.
- **`inscripciones`** (la tabla vieja, ya sin uso): INSERT anónimo y SELECT
  autenticado. Se verificó de punta a punta en producción el 2026-07-23, cuando era la
  tabla en uso.
- **`galeria_media` y `storage.objects`** (bucket `galeria`): son las únicas con DELETE.
  El detalle está en "Galería dinámica", acá abajo.

Nada de esto está en el repo. Si algún día una lectura o una escritura falla por
permisos, ese es el primer lugar donde mirar, no el código.

## Inscripciones CERRADAS desde el 2026-08-25 — `INSCRIPCIONES_ABIERTAS`

**El 2026-08-25 arrancó el pareo suizo y la organización cerró las inscripciones.** El
estado de la convocatoria vive ahora en **`src/lib/inscripciones.ts`**, en una única
constante:

```ts
export const INSCRIPCIONES_ABIERTAS: boolean = false
```

**Para reabrir: poner `true` ahí y rebuildear.** Es el único cambio de **código**; aparte
hay que editar a mano las metas de `index.html`, que son HTML estático (ver abajo). Verificado
el 2026-08-25 en las dos direcciones: con `true` el build también pasa con 0 errores y 0
warnings, y el chunk de `/registro` vuelve de 16 kB a 43 kB.

### Los cinco consumidores

Todo lo que el flag gobierna, y qué hace cada uno cuando está en `false`:

| Archivo | Qué se apaga |
| --- | --- |
| `src/pages/Registro.tsx` | Los campos del formulario, la casilla obligatoria de privacidad y el bloque de errores + botón «Registrarme». Aparece en su lugar un aviso de cierre bajo el título del hero. |
| `src/pages/Home.tsx` | El CTA «Registrarme» del hero con su línea «Inscripciones abiertas», y la sección «¿Vas a competir?» entera, con su QR. |
| `src/pages/Torneos.tsx` | El CTA «Registrarme» del split. El badge NO desaparece: pasa de verde con `animate-ping` a gris neutro con el texto «Inscripciones cerradas». |
| `src/pages/Contacto.tsx` | La respuesta del FAQ «¿Cómo nos inscribimos?» — la primera, la que el acordeón abre por defecto — cambia por la de cierre. Las dos redacciones viven en `RESPUESTA_INSCRIPCION_ABIERTA` y `RESPUESTA_INSCRIPCION_CERRADA`, a nivel de módulo. |
| `src/components/layout/Footer.tsx` | La columna del QR «Regístrate». El enlace «Registro» del bloque Recursos **se queda**. |

Lo que **no** se tocó y no hay que "arreglar": la ruta `/registro` en `App.tsx`, los 6
ítems de `navItems` en `Header.tsx`, y los tres enlaces a
`atakgg.revolution505.com/tournaments` — el alta en ATAK la dispara la base, no un link
del sitio, y ver el torneo sigue siendo válido con la convocatoria cerrada.

### Cómo está implementado en `Registro.tsx`, y por qué así

El `<form>` **se sigue montando siempre**. Dentro, solo tres bloques están condicionados:
los campos, la casilla de privacidad y el bloque de envío. **Las tarjetas informativas
—Pago de Inscripción con la CLABE, Reglamento y el texto del Aviso de Privacidad— quedan
visibles siempre y en su posición original.** No se movió un solo nodo del árbol: están
anidadas dentro del `<form>` y sacarlas de ahí, en un archivo de 2531 líneas, era riesgo
sin beneficio.

`onSubmit` se quita cuando está cerrado (`INSCRIPCIONES_ABIERTAS ? handleSubmit :
undefined`). Sin campos ni botón no hay forma normal de disparar un submit, pero uno
programático sí lo haría y el handler llamaría a `registrar_jugador` con el formulario
vacío.

**El contenido envuelto NO está re-indentado, a propósito.** Son ~270 líneas: sangrarlas
convertiría un cambio de seis líneas en un diff de cuatrocientas. Si el diff parece raro,
es esto.

### ⚠ El flag NO cierra la RPC

**`registrar_jugador` sigue abierta.** Es una bandera del frontend y nada más: la función
sigue siendo pública para `anon` y acepta envíos de cualquiera que la llame con la URL del
proyecto y la anon key, las dos a la vista en el bundle por diseño. Esto cierra **la puerta
de entrada del sitio, no la base**. Si hace falta un cierre real, va del lado de Supabase.

### El único texto que el flag NO alcanza

**`index.html`** — `description`, `og:description`, `twitter:description` y el
`<noscript>`. Es HTML estático, no pasa por el bundle, así que al abrir o cerrar la
convocatoria hay que editarlo **a mano**. Se le quitó «Inscripciones abiertas» el
2026-08-25 y, de paso, **«premios en efectivo»**: el reglamento oficial dice «Premiación:
Por definir», así que era una promesa sin respaldo. No reponerla sin fuente.

**Ojo con un razonamiento que ya falló una vez.** El commit del cierre (`b05082d`) listaba
acá un segundo texto fuera de alcance: la respuesta del FAQ de `Contacto.tsx`, con el
argumento de que era «una cadena dentro de un arreglo, no un bloque de JSX». **Es falso**:
la bandera gobierna cualquier expresión de TypeScript, no solo JSX. La consecuencia no era
teórica — al reabrir, la primera respuesta del FAQ habría seguido diciendo «cerradas»
hasta que alguien la editara a mano. Se corrigió con un ternario y Contacto pasó a ser el
5.º consumidor. **Regla: si un texto vive en un `.ts` o `.tsx`, el flag LO ALCANZA.** La
única frontera real es lo que no pasa por el bundle.

### Verificar esto NO se hace grepeando `dist/`

Con el flag en `false`, Rollup propaga la constante entre módulos y **elimina del bundle**
el JSX que quedó detrás de los condicionales. Que `grep "Registrarme" dist/` dé 0 es lo
**esperado**, no una señal de que se borró código. El fuente está entero: verificar contra
`src/`.

### Deuda que esto saldó

Los comentarios de `Home.tsx` y `Torneos.tsx` que avisaban que «Inscripciones abiertas»
estaba escrito a mano en dos archivos y que **había que borrarlo a mano el día del cierre**
ya cumplieron su función y **se reemplazaron** por el flag. Si alguien los busca por el
texto viejo, no están; la nota que los sustituye apunta a `src/lib/inscripciones.ts`.

## Galería dinámica (`/galeria` + panel)

**Hecho el 2026-08-08, en producción.** `Galeria.tsx` **ya no lleva un array estático**:
lee `public.galeria_media` con un `select('*')` y arma la URL de cada imagen con
`supabase.storage.from('galeria').getPublicUrl(storage_path)`. Ese `getPublicUrl` es
**síncrono** —no pega a la red, arma la URL con la del proyecto— porque el bucket es
público, así que se resuelve una vez por fila al cargar y no en cada render.

### `public.galeria_media`

| Columna | Tipo |
| --- | --- |
| `id` | uuid, default `gen_random_uuid()` |
| `storage_path` | text, **UNIQUE**, not null — nombre del archivo en el bucket, **no** una URL |
| `titulo` | text, nullable |
| `tipo` | text, default `'foto'`, CHECK `foto`/`video` |
| `es_vertical` | bool, not null |
| `ancho` / `alto` | int, nullable |
| `orden` | int, default 0 |
| `subido_por` | uuid, nullable, ref `auth.users` |
| `creado_en` | timestamptz |

### Bucket `galeria`

Público para lectura, **límite de 10 MB por archivo** y MIME permitidos: `image/webp`,
`image/jpeg`, `image/png`.

### Policies

Todas con **condición real** — nunca `check = true`:

- **`galeria_media`** — SELECT público (`anon` + `authenticated`); INSERT y DELETE solo
  `authenticated`. **No hay policy de UPDATE**, y por eso la edición de título del panel
  falla en runtime. Ojo además: los GRANTS de `anon` y `authenticated` son bastante más
  anchos que estas policies (INSERT/UPDATE/DELETE/TRUNCATE completos), así que lo que
  contiene la escritura hoy es la RLS, no los privilegios. Las dos cosas, con el detalle
  y el orden en que hay que arreglarlas, en «Edición de título (GestionGaleria.tsx)».
- **`storage.objects`** (bucket `galeria`) — SELECT público; INSERT y DELETE solo
  `authenticated`.

Es la **primera y única** superficie del proyecto con DELETE habilitado.

### Componentes

- **`SubirGaleria.tsx`** — uploader múltiple, pestaña «Galería».
- **`GestionGaleria.tsx`** — borrado y edición de título, pestaña «Gestionar».
- **`Panel.tsx`** pasó del ternario binario a un mapa
  `Record<SeccionId, ComponentType>` con **3 pestañas**: Inscripciones / Galería /
  Gestionar. Con tres secciones el `else` del ternario era un cajón de sastre —cualquier
  id que no fuera el del `if` caía en el mismo componente—; el mapa tipado obliga a una
  entrada por cada id.

### Lightbox con navegación (Galeria.tsx)

**Hecho el 2026-08-10.** El modal de la galería pública (estado `seleccionado` = id de la
foto abierta) permite navegar entre fotos sin cerrarlo: teclado ←/→ (anterior/siguiente) y
Escape (cerrar), más flechas en pantalla (ChevronLeft/ChevronRight de lucide-react, estilo
lqc-accent). CRÍTICO: la navegación se mueve por la lista FILTRADA (`visibles`), no por
`items` — respeta el filtro activo. No envuelve en los extremos (primera/última foto
atenúan la flecha). El título de la foto se muestra en el overlay si existe y se actualiza
al navegar.

### Uploader (`SubirGaleria.tsx`)

Sube **varias fotos en un lote y EN SERIE**, nunca en paralelo: cada compresión decodifica
el original entero en memoria y veinte a la vez tumban la pestaña.

Por foto: comprime a **WebP con canvas** (lado mayor máx. **1920 px**, calidad **~0.85**),
mide las dimensiones **reales del resultado** para `es_vertical`, `ancho` y `alto`, sube al
bucket con nombre **`crypto.randomUUID()` + extensión** —nunca el nombre original, que
traería acentos, espacios y choques contra el UNIQUE de `storage_path`— e inserta la fila
con **`titulo: null`**.

**Atomicidad por archivo (`publicarUna`):** upload → insert → si el insert falla,
**rollback** con `storage.remove()` **verificando `data.length > 0`**. El `catch` **no**
hace rollback: ahí la excepción es ambigua —no se sabe si el archivo llegó a subirse— y
borrar a ciegas podría eliminar algo que sí quedó bien registrado.

**Fallo parcial:** un archivo que falla **no detiene el lote**, y lo ya publicado **nunca
se revierte**. La única excepción que corta todo es no tener cliente o no tener sesión, y
se corta **antes de subir nada**, así que tampoco deja huérfanos.

**Cerrojo `publicandoRef`** (un `useRef`, no estado) para cerrar la ventana de doble clic
— ver la trampa correspondiente en "Trampas conocidas".

v1 sube **solo fotos, no videos**, sin título por foto (se edita después) y no borra ni
reordena desde este componente.

### Borrado (`GestionGaleria.tsx`)

Borra **de a una**, con confirmación de dos pasos on-brand: el botón «Borrar» se reemplaza
**en su lugar** por «Confirmar / Cancelar». **Ni `window.confirm` ni modal**, que es la
regla del panel.

El borrado son **DOS PASOS, y el orden fila→archivo es a propósito**:

1. `.from('galeria_media').delete().eq('id', id).select('id')` → verificar
   `data.length > 0`. **El `.select('id')` es obligatorio:** sin él un DELETE de PostgREST
   **no devuelve filas nunca**, así que no hay forma de distinguir «borré» de «la RLS
   denegó» (0 filas *sin* error).
2. **Solo si el paso 1 confirmó el borrado:** `storage.remove([storage_path])`.

**La verificación del paso 1 es la que AUTORIZA el paso 2.** Nunca borrar el archivo con
la fila viva: dejaría un hueco roto **visible** en la galería pública.

Si el paso 2 falla después de un paso 1 correcto, el resultado es **éxito** —la foto ya no
está en la galería, que es lo que se pidió— con un **huérfano** en el bucket. Se le avisa
al admin con el `storage_path`, porque limpiarlo es manual y sin el nombre no hay dónde
buscarlo.

**Por qué el borrado NO puede ser una RPC.** Dos motivos independientes, y cualquiera de
los dos alcanza:

1. `storage.objects` trae de fábrica el guard **`storage.protect_delete`** (trigger
   `BEFORE DELETE`) que bloquea **todo DELETE por SQL directo**, salvo con la señal
   `storage.allow_delete_query = 'true'`.
2. Y aunque se pusiera esa señal, **borrar la fila de `storage.objects` por SQL no borra
   el archivo físico de MinIO**. Solo la API de Storage (`storage.remove`) borra el
   archivo y su registro juntos.

Por eso el borrado del archivo va **por frontend** y no por función SQL.

### Edición de título (GestionGaleria.tsx) — UI LISTA, FALTA POLICY EN PROD

**Hecho el 2026-08-10, PERO no funciona todavía.** La UI de edición de título está
completa (botón "Editar título" con Pencil, input que precarga el título actual, guardar/
cancelar, manejo de foco y estados por-item como el borrado). Guarda con
`.update({ titulo }).eq('id').select('id')`, verificando error Y data.length > 0 (patrón
"0 filas sin error"). Vacío se guarda como NULL, no ''.

**BLOQUEANTE:** `galeria_media` NO tiene policy de UPDATE (solo SELECT/INSERT/DELETE), así
que el guardado FALLA en runtime con el mensaje "La base no guardó nada... tu sesión no
tenga permiso". Esto es esperado: la UI maneja el fallo con gracia. Para que funcione hay
que crear la policy de UPDATE en prod (trabajo pendiente).

**Deuda asociada (verificado 2026-08-10):** los GRANTS de `galeria_media` son demasiado
anchos — `anon` y `authenticated` tienen INSERT/UPDATE/DELETE/TRUNCATE completos (grants
por defecto de Supabase nunca revocados). Hoy es seguro porque RLS los contiene (solo las
policies existentes pasan), pero al crear la policy de UPDATE conviene, en la MISMA sesión,
revocar de `anon` los privilegios de escritura que no debe tener (solo necesita SELECT).
Cambio de RLS → probar en local (Cabo B) antes de prod.

### Infra de Storage (Supabase self-hosted)

Hallazgos de reconocimiento sobre producción; nada de esto se puede verificar desde el
repo:

- El Supabase de producción está montado como **servicio de Coolify**, no como una
  instalación a mano. Sus archivos viven en
  `/data/coolify/services/dd3pab1anj2tgzmw5xt6nvxd/` — ese uuid **es** el servicio
  Supabase.
- El backend de Storage es **MinIO local** (contenedor `supabase-minio`): interfaz S3,
  pero disco físico en el mismo `revolutionserv`.
  `STORAGE_S3_ENDPOINT=http://supabase-minio:9000`.
- Límite de subida global: `UPLOAD_FILE_SIZE_LIMIT` y `UPLOAD_FILE_SIZE_LIMIT_STANDARD`
  = **524288000** (500 MB), **hardcodeadas en el `docker-compose.yml`** del servicio. Para
  `galeria` el techo que de verdad manda es el del bucket (10 MB), muy por debajo.

## Clasificación en vivo (desde el 2026-09-15)

**Hecho el 2026-09-15.** `/` y `/torneos` pintan la tabla de posiciones **real** del split
en curso, leída de la **API pública de ATAK.GG**. Es la primera vez que una página pública
muestra datos de un servicio externo (la galería lee Supabase; esto no).

```
GET https://atakback.revolution505.com/api/public/v1/tournaments/<slug>
```

Pública, sin credenciales. Slug del split actual: `lqc-2026` (`SLUG_TORNEO`, exportada
desde `lib/atak.ts` junto a `BASE_ATAK` — es un dato de la API, no de React, y lo comparten
los dos sondeos y el botón «Ver en ATAK» de `/torneos`). Según el backend
de ATAK hay **caché de 15 s del lado del servidor** — no es observable desde afuera: la
respuesta trae `ETag` pero ni `Cache-Control` ni `Age`. Responde `{ ok:true, data:{ standings:[{position, team, wins, losses,
points}], teamsRegistered, … } }` (`teamsMax` y el resto de los campos llegan, pero el
tipo no los recoge).

### Las tres piezas

| Archivo | Qué hace |
| --- | --- |
| `src/lib/atak.ts` | Transporte: `obtenerTorneo(slug, señal)` y `obtenerBracket(slug, señal)`, las dos sobre un `pedirJson()` privado que concentra el corte y la composición de la señal. Mismo CONTRATO que `validarRiotId` — **nunca lanza, nunca escribe en consola**, todo fallo colapsa en `null`. También exporta `SLUG_TORNEO`. |
| `src/hooks/useTorneoAtak.ts` | Sondeo cada **30 s** (con 15 s de caché del lado del servidor, más seguido no traería nada nuevo). |
| `src/components/Clasificacion.tsx` | **Solo presentación.** Variantes `completa` (tabla de los 19) y `compacta` (bloque de portada). |
| `src/hooks/useBracketAtak.ts` | Sondeo del **bracket**, 30 s, gemelo del anterior. |
| `src/components/Emparejamientos.tsx` | **Solo presentación.** La ronda en curso, en `/torneos`. |

**Son DOS sondeos, no uno.** Van a endpoints distintos y cada uno falla por su cuenta: que
la clasificación no cargue no se lleva puestos los emparejamientos, ni al revés.

**El hook lo llama la PÁGINA, no el componente.** En `/torneos` hay dos consumidores del
mismo torneo —la tabla y el conteo de equipos del bloque destacado—, y con el fetch dentro
del componente esa página pediría lo mismo dos veces cada 30 s. La página lo pide una vez y
lo reparte por props. Vive en `hooks/` y no junto al componente porque
`react-refresh/only-export-components` —que el eslint del repo trata como **error**—
prohíbe exportar un hook desde un archivo que también exporta un componente.

### La degradación es la regla, no un detalle

**Si la API falla, la sección DESAPARECE EN SILENCIO.** Nada de tarjeta roja tipo
`ErrorGaleria`, nada de «no se pudieron cargar los datos». Es un sitio público en día de
partida y un cartel de error sobre la clasificación es peor que no tener la sección.

- El `<section>` y el `<h2>` viven **dentro** del componente. Si vivieran en la página
  quedaría un encabezado colgado sobre un hueco.
- Lo único visible sin datos es el **esqueleto de la primera carga**.
- **Un sondeo fallido NO borra lo que ya está en pantalla.** Es la diferencia con
  `Galeria.tsx`, que carga una sola vez y puede permitirse un enum con estado `'error'`:
  acá un 502 de tres segundos haría parpadear la clasificación a vacío y volver.
- **También se oculta si no se jugó ninguna jornada**, y la condición es
  `standings.some(f => f.wins + f.losses > 0)`, no `standings.length > 0`. Un split recién
  sembrado puede devolver las 19 filas en `0-0 / 0 pts`: eso no es una clasificación, es la
  lista de inscritos con ceros, y pintada dejaría a los 19 equipos compartiendo el 1º puesto
  y a la portada diciendo «19 equipos en la punta — 0 pts». (Qué devuelve ATAK antes de la
  primera jornada **no está verificado** — el torneo ya estaba empezado cuando se hizo esto;
  la condición cubre las dos formas.)

### Empates: NO se publica un ranking que no existe

ATAK numera las filas **1…19 de corrido**, o sea que declara un orden entre equipos que
están empatados. Pintar eso tal cual publica un ranking que la liga no hizo. Dos reglas,
las dos en `marcarFilas()`:

1. **Se reordena.** Dentro de un mismo puntaje, ATAK no agrupa por récord: al 2026-09-15,
   RAKU (1-2) le quedaba en medio a ocho equipos de 1-1. Respetando ese orden, dos equipos
   con el **mismo récord** terminaban con números distintos —uno 7º y otro 13º—. Se ordena
   por **puntos desc, y a igual puntaje por derrotas asc**; `sort` es estable, así que
   dentro de un récord se conserva el orden de ATAK (su desempate, que no conocemos).
2. **El número se suprime en el empate, y el empate se mide por RÉCORD V-D, no por
   puntos.** En suizo a 3 puntos por victoria `points` es 3 × `wins`: no sabe nada de las
   derrotas, así que agrupar por puntos metería a un 2-1 en el mismo cajón que los 2-0.
   Solo la primera fila de cada récord lleva número; las demás llevan «=». El **tinte de
   fondo sí alterna por puntos**, que es la lectura gruesa.

En la portada el bloque compacto muestra **el grupo puntero completo**, no «el top 5»:
cortar en cinco partiría un empate al medio. Pasado un tope de **8** no nombra a nadie —
dice cuántos son y enlaza a `/torneos`.

**Ese bloque dice «N equipos en la punta», nunca «N equipos empatados».** El grupo puntero
se arma por PUNTOS, y por puntos hoy entran cinco 2-0 y un 2-1; llamarlos empatados diría
lo contrario de lo que `/torneos` declara a dos clics, donde ese 2-1 lleva su propio
número. Las dos pantallas se contradecirían y la que más se ve es la portada.

### Emparejamientos de la ronda (`/torneos`)

```
GET https://atakback.revolution505.com/api/public/v1/tournaments/<slug>/bracket
```

Devuelve **todas las partidas de todas las rondas**; el sitio pinta **solo la ronda en curso**, en
una sección que va **entre la tarjeta del split y la clasificación** — el emparejamiento es
más presente que la tabla.

**Tres trampas de estos datos, y las tres publican mentiras si se ignoran:**

1. **`status` NO significa lo que su nombre promete, y el sitio NO lo lee.** Dice `"active"`
   en partidas que solo están **emparejadas y sin jugar** (sin `gameId`, sin marcador) y
   `"complete"` en un BYE que nadie jugó. Los tres estados se derivan de campos que no
   engañan, **y el orden importa porque un BYE también trae `winner`**:
   `team2 === 'BYE'` → descansa · `winner === null` → **«Por jugar»** · si no → jugada.
   Nada de «EN VIVO» ni de punto pulsante: **la API no expone ningún campo que marque una
   partida en juego**, así que ese estado no es que no se pinte, es que no se puede.
2. **El BYE cuenta como VICTORIA y suma 3 puntos.** Verificado cruzando los dos endpoints el
   2026-09-15: los tres equipos que descansaron aparecen en `standings` con exactamente una
   victoria más de las que tienen en el bracket. Por eso la tarjeta dice **«Sin rival ·
   cuenta como victoria»** y no solo «descansa»: sin esa línea, quien compare las dos
   secciones concluye que una miente.
3. **`score1`/`score2` son `null`** en las pendientes y en los BYE. Todo el render lo
   aguanta, y el marcador se comprueba con `!== null` y no con un truthy — **un 0 es un
   marcador válido**.

**Qué ronda se muestra: `max(round)`, siempre.** En suizo los emparejamientos de la ronda
N+1 solo se publican cuando la N terminó, así que la más alta es la que se juega. Se
descartó «la de mayor número con alguna partida sin ganador» porque **retrocede**: si a una
ronda vieja le faltara cargar un resultado, presentaría una ronda ya cerrada como la actual.
Con `max` el caso «el suizo terminó» se resuelve solo.

**No se pintan `gameId` ni `gameRegion`** (solo vienen en las jugadas y no los muestra
ninguna pantalla), ni el bracket completo de las 3 rondas.

### Lo que NO se pinta, y por qué

- **`startDate`** dice `2026-09-01` y el reglamento oficial dice **25 de agosto**. Hay un
  dato mal y no se resuelve desde el sitio. La fecha del bloque destacado de `/torneos`
  sigue escrita a mano a propósito.
- **`rulesUrl`** es una ruta **relativa** (`/docs/reglamento-lqc.pdf`) que un `<a>`
  resolvería contra **nuestro** dominio y daría 404. El PDF ya tiene una sola fuente:
  `src/lib/reglamento.ts`.
- **`phase`**, **`format`** y **`teamsMax`** no los muestra ninguna pantalla, así que no
  están en el tipo.

**`teamsRegistered` es el único campo suelto que sí se usa**: es el «19 equipos
participantes» del bloque destacado de `/torneos`, que hasta el 2026-09-15 era un «Hasta
32 equipos» escrito a mano.

**Dice «participantes» y no «19 de 32», a propósito.** Una fracción comunica lugares
libres —«quedan 13»— y ese renglón está a cuatro líneas del badge «Inscripciones
cerradas»: desde el 2026-08-25 no hay cupo que ofrecer. Por eso `teamsMax` tampoco está en
el tipo: al salir de esa línea se quedó **sin un solo consumidor en el repo**, y un campo
que nadie lee es código muerto. El «Hasta 32 equipos» sobrevive únicamente como
**respaldo** si la petición falla, y ahí es un dato del **reglamento** («máximo de 32
equipos»), no un campo de ATAK.

## Carta de jugador (`/carta`)

**Hecho el 2026-08-14.** Generador de "carta de jugador": el usuario elige un campeón y la
página compone una tarjeta con el arte y la descarga como PNG. El catálogo y el arte de
campeones salen de **Riot Data Dragon** vía `src/lib/datadragon.ts` (~173 campeones); el
render final se arma en un **`<canvas>`** y se baja con `toBlob()`. Incluye el **aviso
legal de Riot** obligatorio (contenido no endosado por Riot). Se llega desde el **Home**
(CTA) y desde el **footer**. Trampas de canvas: ver
[Animación y movimiento](#animación-y-movimiento).

## Scroll y animaciones

**Hecho el 2026-08-14/15.** Tres piezas de comportamiento visual, todas frontend:

- **`ScrollToTop.tsx` (global).** Montado una vez en el árbol de rutas; en cada cambio de
  ruta devuelve el scroll al tope, con **guard de hash** para no romper los anclajes
  `#seccion`. Reemplaza a los viejos `onClick={irAlTope}` regados por las páginas; **quedan
  4 onClick deliberados en el Footer** que no hay que borrar.
- **`Reveal.tsx`.** Animación de entrada al hacer scroll, con `IntersectionObserver`. **Hoy
  solo está en el Home**; extenderlo al resto de páginas es un pendiente menor abierto.
- **Glow del hero.** Glow animado sutil en los logos del hero. Efecto de 3 capas pensado
  para reusarse; **no colgarlo de `.pill-marca`** — ver la trampa correspondiente.

El 2026-09-16 se sumó una cuarta: la **copa de fondo**, una sola en `LayoutPublico`, con la
trayectoria continua entre páginas y recargas — ver «La copa de fondo» en el sistema de diseño.

## Stack

- **React 19** + **TypeScript** (strict) + **Vite 7**
- **Tailwind CSS 4** vía `@tailwindcss/vite` — el tema se define con `@theme` en
  `src/index.css`, **no** hay `tailwind.config.js`
- **react-router-dom 7** — rutas declaradas en `src/App.tsx`
- `lucide-react` (iconos), `react-lazy-load-image-component` (galería)
- **`@supabase/supabase-js`** — las dos RPC anónimas de `/registro`
  (`buscar_equipos` y `registrar_jugador`), el login + SELECT autenticado del
  panel de `/admin`, y la galería: SELECT público sobre `galeria_media` más
  **Storage** (`getPublicUrl`, `upload`, `remove`) sobre el bucket `galeria`
- **Infra:** Docker + nginx (`Dockerfile`, `nginx.conf`) y `nixpacks.toml`

## Estructura

```
src/
  App.tsx                  rutas (<Route>) + fallback de carga + 404
  main.tsx                 entrypoint
  index.css                tema Tailwind (@theme), tokens y utilidades
  vite-env.d.ts            tipos de las variables de entorno (VITE_*)
  components/
    ScrollToTop.tsx        vuelve al tope en cada cambio de ruta (con guard de hash)
    TiraHud.tsx            tira de datos (QRO · MX · coords · °C · hora) del layout público
    Reveal.tsx             animación de entrada al scroll (IntersectionObserver)
    Clasificacion.tsx      tabla de posiciones del split (variante completa / compacta);
                           solo presentación, y no se pinta si no hay datos
    layout/
      Header.tsx           navegación (arreglo navItems) + menú móvil
      Footer.tsx
  hooks/
    useTorneoAtak.ts       sondeo del torneo en ATAK cada 30 s; lo llama la PÁGINA, no
                           el componente (Torneos tiene dos consumidores del mismo dato)
    useBracketAtak.ts      sondeo del bracket, 30 s; gemelo del anterior
    useClimaQro.ts         sondeo de la temperatura (Open-Meteo), 15 min
    useHoraLocal.ts        reloj de la tira: un tick por minuto, sin red
  lib/
    clima.ts               temperatura de Querétaro (Open-Meteo, sin API key) + sus coordenadas
    horaQro.ts             hora local de Querétaro con Intl; sin red, nunca lanza
    supabase.ts            cliente de Supabase (perezoso; devuelve null sin credenciales)
    atak.ts                API pública de ATAK.GG: valida un Riot ID y trae el torneo
                           con su clasificación; nunca lanza ni bloquea
    datadragon.ts          catálogo y arte de campeones (Riot Data Dragon) para la carta
    reglamento.ts          ruta, nombre de descarga y peso del PDF del reglamento
    inscripciones.ts       bandera INSCRIPCIONES_ABIERTAS: estado de la convocatoria
  pages/                   Home · Torneos · Galeria · Acerca · Contacto · Registro · Reglamento · Carta
    admin/                 panel protegido: Login · RutaProtegida · Panel ·
                           ListaInscripciones · SubirGaleria · GestionGaleria
public/                    assets, galeria/, images/, sponsors/, LOGO-COPA.ico,
                           reglamento-lqc-2026.pdf
```

El PDF del reglamento lo enlazan **dos** páginas —`/reglamento` (visor + acciones) y la
tarjeta del reglamento de `/registro`—, y por eso su ruta, su nombre de descarga y su
**peso escrito a mano** viven en `src/lib/reglamento.ts` y no en una de las dos. Al
reemplazar el PDF hay que actualizar `PESO_REGLAMENTO` ahí: no se calcula solo.

**Iconos y favicon.** `index.html` declara **solo** `/LOGO-COPA.ico`: no existen los PNG
de 16/32/180/192/512 y `site.webmanifest` **no tiene bloque `icons`**, así que no hay
icono de "agregar a pantalla de inicio". Si se completan, hay que tocar los dos lugares.
Queda además un huérfano conocido: **`public/images/Logorevazul.ico` no lo referencia
nadie** —ni ahora ni en ningún commit de la historia— y sobrevivió a la limpieza de
assets del 2026-07-31 solo porque es un archivo único, no un duplicado, y podría estar
puesto para un cambio de favicon. Si nadie lo usa, se borra sin más análisis.

**No hay duplicados en `public/`.** Los había —el mismo logo en `assets/` y en
`sponsors/`, o en `images/` y en `sponsors/`— y se barrieron. Antes de agregar una imagen,
comprobá que no esté ya en otra carpeta: la copia sin usar se publica igual a `dist/` y se
sirve por nginx sin que nadie la pida.

**`public/galeria/` se llama igual que la ruta `/galeria`**, y eso rompía la ruta en carga
directa hasta que se sacó `$uri/` del `nginx.conf`. Antes de tocar esa línea o de agregar
algo en la raíz de `public/`, leé «nginx: una carpeta de `public/` con el nombre de una
ruta» en Trampas conocidas.

Las páginas se cargan con `lazy()` + `<Suspense>`. Cada página es un archivo
autocontenido con su markup y sus clases de Tailwind inline.

## Sistema de diseño (NO negociable)

- **Paleta azul/negro.** Azul principal `#0066ff`, acento cian `#00d4ff`, fondo
  `#0a0a0f`. La escala vive en `index.css` como tokens planos
  `--color-lqc-50` … `--color-lqc-900`, más `--color-lqc-accent` y
  `--color-lqc-metal`. En el markup conviven las clases `lqc-*` (superficies de
  marca: acento, CTA, tarjetas) y las `blue-*` de Tailwind para el resto.
- **REGLA "sin morado": nada de clases `purple-*`.** Es la regla de color central
  del proyecto. Ya no queda morado heredado (ver más abajo): `grep -rn "purple" src/`
  debe seguir dando **0 resultados**.
- **Tipografía:** títulos con `--font-heading` (**Orbitron**), cuerpo con
  `--font-sans` (**Inter**).
- **Sombras:** usar los tokens `--shadow-lqc`, `--shadow-lqc-lg`, `--shadow-lqc-xl`.
  No inventar sombras nuevas.
- **Todos los textos de la UI van en español**, con acentos correctos.
- **Mobile-first**, con breakpoints `md` y `lg`.
- Preferir clases de Tailwind inline; CSS suelto solo para tokens en `index.css`.

### El lienzo de fondo (`.lqc-lienzo`) y su contrato de apilamiento

**Hecho el 2026-09-15**, en dos pasos. El fondo atmosférico del sitio público son **dos
pseudo-elementos** de la clase `lqc-lienzo`, que lleva el `<main>` de `LayoutPublico.tsx:12`:

| | Qué | Posición | Por qué |
| --- | --- | --- | --- |
| **el fondo de `main`** | `background-color: #001433` (`lqc-900`) | — | **el color del sitio**, desde el 2026-09-16 |
| `::before` | dos halos de marca | `fixed` | atmósfera de ventana, cubre siempre |
| `::after` | mosaico geométrico (SVG inline, 19 rectángulos, 3 tonos) | `absolute`, `100vh` | tratamiento de **cabecera**: con `fixed`, la tabla de 19 filas de `/torneos` le pasaría por debajo al scrollear |

**EL SITIO PÚBLICO ES AZUL, y el color vive en el fondo de `main`.** Hasta el 2026-09-16 cada
página se pintaba en su raíz un `bg-gradient-to-b from-black via-gray-950 to-black` **opaco**
que tapaba el fondo de `body` y su `body::before` — por eso los halos que `index.css` declara
**desde el commit inicial** nunca se habían visto. Las **8 raíces públicas se vaciaron**;
conservan el degradado negro las **4 que no son públicas** (`admin/Login` ×2, `admin/Panel`,
`ErrorBoundary`), a propósito: el panel es modo herramienta.

Por qué el color va ahí y no en los tres lugares obvios:

- **No en `body`:** `--gradient-dark` corre a 135° sobre el **documento** entero, así que en
  una página larga el azul queda en una esquina y el 98 % del alto es `#0a0a0f`. Y obligaría
  a tocar el `bg-black` de `App.tsx`, cuyo `<div>` envuelve **también `/admin`**.
- **No repintando las raíces:** la rampa sería **por página** sobre un `min-h-screen` que no
  es el alto real, o sea que el mismo token daría colores distintos según el largo del
  documento. Y deja 8 fuentes de verdad: la próxima página nace negra otra vez.
- **No como capa opaca en el `::before`:** ese pseudo es `fixed` dentro del contexto `z-10`
  de `main`, y **`<footer>` no está posicionado**. Con tintes del 3–7 % da igual, pero una
  capa **opaca** taparía el pie entero al scrollear hasta abajo.

El fondo del elemento que **establece** el contexto se pinta por debajo de todo lo de adentro
y **nunca fuera de su caja**: el pie queda intocable sin tocarle el `z-index`.

**Header y pie quedan NEGROS** (`bg-black`, los dos fuera de `main`) contra un `main` azul.
Es deliberado: el encuadre de póster de la liga, y es lo que la `TiraHud` ya asumía.

> **CONTRATO, y es lo único de esta sección que muerde: los dos pseudos van en `z-index: 0` y
> cada página pública envuelve TODO su contenido en un `<div className="relative z-10">`.**
> Una página nueva que no lo haga recibe el lienzo **encima** en vez de debajo. Hoy los tintes
> son del 2 % al 6 % y no rompe nada a la vista, pero **el margen es más fino de lo que
> parece**: el día que se probó una capa al 30 %, el texto del pie —que está exactamente en
> ese caso— cayó bajo AA. El wrapper es lo que separa «tinte inofensivo» de «texto atenuado».
> Ya pasó una vez: el 404 en línea de `App.tsx` era la única ruta pública sin ese wrapper y
> hubo que ponérselo.

Lo demás que conviene saber antes de tocarlo:

- **`position: fixed`, nunca `background-attachment: fixed`**: el segundo repinta en cada
  frame de scroll y iOS lo ignora.
- **No se anima**, así que `prefers-reduced-motion` no tiene nada que apagar. Si alguna vez se
  animara, tiene que ser ciclo cerrado tipo `hero-glow` — ver «Animación y movimiento».
- **Los canales van literales** (`rgb(0 102 255 / 4%)`), no `var(--color-lqc-500)`, por lo
  mismo que `.pill-marca`. Están anotados en el comentario de la regla.
- **⚠ NO agregues una capa oscura al `::before`.** Se intentó —un oscurecedor vertical a
  30 % de negro, para recuperar contraste en la mitad inferior— y **rompía el pie**: el
  pseudo es `fixed` y cubre la ventana entera, y sobre el `<footer>`, que no está
  posicionado, el velo cae **encima** del texto en vez de debajo. Medido: `text-gray-400` del
  pie a **4,27:1** y `text-blue-400` a **3,28:1**, ocho elementos bajo AA, a cambio de +0,2
  de contraste en el cuerpo. Subir el pie a `z-20` tampoco sirve: el lightbox de `/galeria`
  es `fixed z-50` pero vive **dentro** del `relative z-10` de la página, o sea atrapado en el
  contexto de `main`, y el pie se le pintaría encima.
- **Contrastes sobre `#001433`** (L 0,00739 contra 0,00316 del negro anterior; paleta v4 en
  **oklch**, no los hex de v3 — `gray-400` es `#99a1af`, `gray-500` es `#6a7282`):
  `white` 18,3:1 · `gray-300` 12,4:1 · `gray-400` 7,0:1 · `gray-500` **3,8:1**.
  **Nada bajó de AA que no estuviera ya debajo.** Los `bg-black/NN` **mejoran** sobre azul (un
  negro translúcido lo oscurece), y el «ritmo de fondos» alternado pasa de 1,012:1 a 1,038:1,
  o sea que por fin se distingue.
- **Se apaga entero en `prefers-contrast: high`**, color de fondo incluido. Ojo: **ese media query no matchea en
  Chromium**, que solo reconoce `more`. Es un defecto **preexistente** que afecta a todo ese
  bloque —`body { background: #000 }` y los overrides de `.glass` incluidos—, no solo al
  lienzo. Arreglarlo es un cambio propio.
- **`/admin` no lo recibe**: sus rutas son hermanas de `LayoutPublico`, no hijas, así que
  nunca montan ese `<main>`. El panel queda negro plano a propósito.
- El **grano** de los pósters quedó afuera: `background-blend-mode: soft-light` sobre un
  lienzo casi-negro es invisible por definición —con backdrop en 0 el resultado es 0—, y
  forzarlo con blending `normal` sí sube la luminancia media. No es un pendiente.

### La copa de fondo (`.lqc-copa-deriva` / `.lqc-copa-balanceo`)

**Hecha el 2026-09-16.** La copa blanca que flota detrás del contenido vive **una sola vez**,
en `LayoutPublico.tsx`, como primer hijo del `<main>`. Antes eran **8 capas `fixed inset-0`
copiadas por página** —con la copa y una retícula de puntos— y **6 `<style>` que redefinían
`@keyframes float-slow`** cada uno; al navegar, la capa se remontaba y el movimiento
reiniciaba. Las 14 se borraron, y con ellas los keyframes `float` y `float-slow` de
`index.css`, que quedaron sin consumidores. Efectos buscados: **Reglamento gana copa** (no
tenía), **Registro pierde su movimiento de 6 s**, y las 8 públicas más el 404 tienen
exactamente el mismo fondo.

| | Valor | Por qué |
| --- | --- | --- |
| Tamaño | `min(58vw,45vh)` en base, `min(32vw,45vh)` desde `xl` | **405 px a 1440×900, 217 px a 375×812.** El tope en `vh` la mantiene entera en una ventana ancha y baja |
| Posición | `fixed`, `top-[20vh]`, centrada con `inset-x-0 mx-auto` | **completa en pantalla en todo el recorrido**, rotación incluida: medido de 320×568 a 2560×1440 y en 1920×600. Único roce: teléfono apaisado (375 de alto), donde la CAJA entra hasta 22 px bajo el header en el tope del balanceo — pero el dibujo empieza ~20 px adentro de la caja |
| Opacidad | `0.07` + `blur-[1px]` | techo medido 0,08: la copa es **blanco puro**, y es lo que más sube la luminancia detrás del texto |
| Deriva (el `<div>`) | `translateX` ±6vw, **97 s** | |
| Balanceo (la `<img>`) | `translateY` ±3,5vh y `rotate` ±2,5°, **61 s** | 97 y 61 son primos entre sí: la figura no se repite hasta 1 h 39 min |

- **Dos nodos porque son dos animaciones de `transform`**, y un elemento lleva una sola. Por
  lo mismo **se centra con `inset-x-0 mx-auto` y nunca con `-translate-x-1/2`**: la deriva
  pisaría el `transform` y la copa quedaría corrida media anchura.
- **La trayectoria sobrevive a navegar, a F5 y a volver de `/admin`.** Navegar entre hijas
  no remonta el layout (el mismo mecanismo que `TiraHud`). Para lo demás, cada animación
  lleva un **`animation-delay` negativo** igual a `(Date.now()/1000) % periodo`: arranca en la
  fase que le tocaría si hubiera corrido desde siempre. Cero rAF, cero timers. Es **aproximado**:
  en carga en frío la animación arranca ~0,35 s después del `Date.now()` (medido), o sea que
  la copa retrocede menos de 2 px al recargar. Con el chunk en caché son ~0,01 s.
  ⚠ **Los periodos están DOS veces**: en los keyframes de `index.css` y en
  `PERIODO_DERIVA_S` / `PERIODO_BALANCEO_S` de `LayoutPublico.tsx`. **Si cambiás uno sin el
  otro, la copa salta al recargar** y nada falla. La fase va en un `useState` con
  inicializador perezoso: recalcularla en un re-render movería la copa de golpe, y como
  constante de módulo arrastraría la fase vieja al volver de `/admin`.
- **La curva va por fotograma, no en el shorthand.** 0 %, 50 % y 100 % son el centro; 25 % y
  75 %, los extremos. Con un `ease-in-out` global la copa se **frenaría en el centro** cada
  vuelta; con media senoide por tramo la velocidad es continua.
- **`prefers-reduced-motion`: QUIETA y en el centro**, por su propio `animation: none` fuera
  de capas, no por la manta de `0.01ms`. Y aunque la manta actuara, el último fotograma ES el
  centro. **`prefers-contrast: high`** la oculta junto con los pseudos del lienzo (con el mismo
  defecto de Chromium de arriba).
- **Apilamiento:** `z-0`, igual que los pseudos. Orden de árbol dentro de ese nivel:
  `::before` (halos) → copa → `::after` (mosaico). Todo por debajo del `relative z-10` de cada
  página, así que el **contrato de arriba no cambia**.
- **⚠ Va dentro de un `<div className="absolute inset-0 z-0 [clip-path:inset(0)]">`, y ese
  recorte es lo que la saca del pie.** Es el mismo caso que el `::before`: `fixed` dentro del
  contexto `z-10` de `main`, con un `<footer>` sin posicionar. Sin el recorte, al scrollear
  hasta abajo la copa se pinta **encima** del pie negro — medido: la silueta se ve clara, y
  `gray-400` del pie baja de 8,1:1 a 7,8:1. No rompe AA, rompe el encuadre de póster. Las 8
  capas viejas tenían el mismo defecto, tapado porque estaban medio fuera de pantalla.
  `clip-path` recorta también a los descendientes `fixed` —`overflow: hidden` **no**—, y no
  crea bloque contenedor, así que la copa sigue anclada a la ventana. **No lo subas a
  `main`**: recortaría también el lightbox de `/galeria`, que vive adentro. Verificado en
  Chromium; Safari y Firefox, no.
- **La retícula de puntos blancos del fondo se retiró en este mismo cambio y no vuelve**, a
  propósito: blanco al 3 % sobre azul sube la luminancia de toda la pantalla, y el mosaico ya
  hace de textura. La trama que sigue en `BloqueSinTransmision` de `Home.tsx` es otra cosa:
  vive dentro del bloque, sobre su propio negro.

### La tira de datos (`TiraHud`)

**Hecha el 2026-09-15.** La línea monoespaciada de los pósters, llevada a la web:

```
QRO · MX · 20.59°N 100.39°W · 22°C · 21:47 CST (UTC-6)
```

La monta **`LayoutPublico.tsx`, como primer hijo del `<main>`**. Un solo punto de inserción
cubre las **8** páginas públicas más el 404 en línea de `App.tsx`, y deja fuera a `/admin`
**por construcción** — sus rutas son hermanas del layout, no hijas. Y como el layout es el
elemento de la ruta padre, **React Router no lo desmonta al navegar**: el reloj y el sondeo
del clima se montan una vez. En cada página, cada clic del nav dispararía un fetch nuevo.

- **Lleva `relative z-10`, y no es decorativo.** Un hijo de `main` sin posicionar se pinta
  antes que los pseudos del lienzo y recibiría el lavado encima. Ver el contrato de
  apilamiento más arriba.
- **Al scrollear no hace nada, y eso es el efecto.** El header es `sticky` **y opaco**, así
  que la tira se mete debajo y se funde con su negro sin ser una segunda barra. Sin listener
  de scroll, sin animación, sin segunda fuente de verdad de la altura del header.
  ⚠ **No lo «mejores» con `animation-timeline: scroll()`**: la manta de
  `prefers-reduced-motion` pone `animation-duration: 0.01ms !important` y a una animación de
  scroll no la acelera, la deja **plantada en su fotograma final** — quien reduce movimiento
  vería la tira colapsada para siempre.
- **En móvil se caen dos segmentos**, en este orden: las **coordenadas** (19 de 54
  caracteres, y dicen lo mismo que «QRO» con más píxeles) y la abreviatura **`CST`** — lo
  universal es el offset, no la forma anglosajona. Queda `QRO · MX · 22°C · 21:47 UTC-6`,
  que entra hasta 320 px. Cada `<span>` **incluye el separador que lo precede**, así al
  ocultarse se lleva su `·` y no queda ninguno colgando.
- **Degradación DISTINTA a la de ATAK: acá no desaparece la sección.** Ubicación,
  coordenadas y hora son locales —constantes + `Intl`— y funcionan sin conexión. Si falla el
  clima se cae **solo ese segmento**. Nada de `--°C` ni «n/d»: un placeholder permanente es
  un mensaje de error disfrazado.
- **Accesibilidad:** la línea visible va `aria-hidden` y al lado hay un `sr-only` con la
  forma larga en español. **Sin `aria-live`**: la hora cambia sola cada minuto y anunciarla
  sería interrumpir.

**Open-Meteo, sin API key, y es requisito duro** — esta SPA es estática y toda `VITE_*` viaja
en el bundle. `access-control-allow-origin: *`, verificado. Refresco de **15 min**, que es el
`interval: 900` del propio dato. `clima.ts` tiene el mismo contrato que `atak.ts`: nunca
lanza, nunca escribe en consola, todo fallo colapsa en `null`.

> **Las coordenadas son constantes NUESTRAS, no de la API.** La respuesta trae un
> `latitude`/`longitude` que son los del centro de su celda de grilla: se pidió
> `20.5888 / -100.3899` y contestó `20.56239 / -100.43347`, ~5 km al oeste. Leerlas de ahí
> «para no repetirlas» publicaría coordenadas equivocadas.

La hora **no** sale del clima aunque su respuesta traiga `utc_offset_seconds`: eso ataría la
hora a la red. Sale de `Intl` con `America/Mexico_City`. Detalle: `timezone_abbreviation` de
Open-Meteo devuelve `"GMT-6"`, y **`CST` solo lo da el locale `en-US`** — es la única
concesión al inglés de la tira, y es deliberada. México abolió el horario de verano en 2022,
así que el offset es constante (verificado en enero y julio).

**JetBrains Mono se carga desde el 2026-09-15.** `--font-mono` la declaraba desde el commit
inicial pero `index.html` solo pedía Inter y Orbitron, así que `font-mono` caía en la mono
del sistema y medía distinto en cada aparato. Va en las **dos** líneas de `index.html`
(`preload` y `stylesheet`): si difieren, se precarga un recurso que no se usa.

## Morado heredado — ya migrado

**No queda morado en el sitio.** Las 25 ocurrencias de `purple-*` que había en 6
archivos (`App.tsx`, `Home`, `Torneos`, `Acerca`, `Contacto`, `Galeria`) se
migraron a azul/cian el 2026-07-22. La verificación es
`grep -rn "purple" src/` → **0 resultados**.

Convenciones que dejó esa migración, a respetar en páginas nuevas:

- **Título de hero (canon, idéntico en las 7 páginas).** Clases:
  `font-heading font-bold uppercase text-4xl sm:text-5xl md:text-7xl tracking-tight leading-[0.95]`
  más el glow `[text-shadow:0_0_40px_rgba(0,212,255,0.35)]` y el gradiente
  `from-blue-400 via-blue-300 to-lqc-accent` (bg-clip-text text-transparent). El escalón base
  `text-4xl` existe para que títulos largos en mayúsculas (ej. "ARCHIVO DE TORNEOS", 18
  caracteres) no desborden a 375px. Debajo del `<h1>` va una línea divisoria (ver más abajo).
  El hero usa padding mobile-first `pt-28 pb-16 md:py-40` (excepción: Reglamento ya tenía el
  suyo, `pt-24 pb-12 md:pt-32 md:pb-16`).
- **CTA primario:** `from-lqc-700 to-lqc-500` con
  `hover:from-lqc-600 hover:to-lqc-400` y `shadow-blue-900/30`. Rampa dentro de
  la escala `lqc` (#003d99 → #0066ff): salto de luminancia visible y ~4.8:1 con
  texto blanco. **No terminar en `lqc-accent`** (#00d4ff da 1.8:1 con blanco).
  Si el CTA es un `<a>` y no un `<button>`, agregarle `text-white`: la regla base
  `a { color: #66a3ff }` de `index.css` no da contraste sobre azul.
- **Tarjetas oscuras de CTA:** `from-blue-950/30 to-lqc-900/20`.
- **Secundario reforzado** (`CLASE_VER_REGLAMENTO` en `Registro.tsx`): `bg-lqc-900/40`
  con `border-lqc-accent/40` y `text-lqc-accent`. Es para la acción principal **de una
  tarjeta** cuando la página ya tiene su CTA primario en otra parte: el gradiente del
  canon repetido dentro de una tarjeta empata al CTA real y deja de haber un solo camino
  obvio. Va con `sm:flex-1` en las dos acciones de la tarjeta, o el ancho lo decide el
  largo del texto y la principal puede terminar más angosta que la secundaria.
- Al necesitar cian, usar el token `lqc-accent` — nunca `cyan-*` ni un morado.

## Reglas de trabajo

1. **`npm run build` debe pasar sin errores de TypeScript antes de cualquier commit.**
   El script es `tsc -b && vite build`: si los tipos fallan, el build entero se corta.
   Ojo: que el build pase **no** garantiza que el formulario funcione — ver
   "Variables de entorno" más abajo.
2. Al **agregar o renombrar una página** hay que tocar **dos** lugares: la `<Route>`
   en `src/App.tsx` **y** el arreglo `navItems` en `src/components/layout/Header.tsx`.
   Olvidar el segundo es el error más fácil de cometer acá. El nav tiene hoy
   **6 ítems** (Inicio, Torneos, Galería, Acerca, Contacto, Registro).
   **Excepción vigente: `/reglamento`.** Es pública y vive en `LayoutPublico`, pero **no**
   está en `navItems`: se entra desde el bloque "Recursos" del pie. No es un olvido — con
   6 ítems el menú ya se quedó sin ancho en la franja `md` (768–1023px) y hubo que
   compactarlo, y «Reglamento» es la etiqueta más larga. Sumarla es una línea en `navItems`
   **más** una revisión del layout a 768px. Está anotado también en `App.tsx`, al lado de
   la ruta.
3. **No inventar contenido** (fechas, resultados, nombres de torneos, patrocinadores).
   Si falta un dato, marcarlo como pendiente y preguntar.
4. Rama de trabajo: `main`. Remoto: `github.com/ChristianJair27/LQC`.
5. Fix mínimo: no refactorizar de más ni tocar lo no relacionado.

## Cómo trabajar en este proyecto

- **Medí el alcance real antes de actuar.** Antes de delegar o cambiar algo,
  contá las ocurrencias con `grep`. **No confíes en los conteos escritos en la
  documentación**: este archivo decía "17 ocurrencias" de `purple-*` y el conteo
  real era **25**. La doc envejece; el código no miente.
- **Cambios mínimos, un propósito por vez.** Nada de refactors oportunistas
  mientras arreglás otra cosa.
- **Después de cada cambio, verificá con `npm run build`**: debe terminar con
  **0 warnings y 0 errores**. Un warning nuevo es un fallo, no ruido. La regla
  es sobre `npm run build`: `docker build` emite 2 warnings esperados de
  BuildKit (`SecretsUsedInArgOrEnv`) que **no** hay que silenciar — ver
  "Variables de entorno".
- **Verificación independiente.** El reporte de un agente no alcanza como prueba.
  Confirmá por tu cuenta con `grep`, con el build y **leyendo el diff**.
- **Pasá los cambios visibles por el agente `revisor`** antes de commitear.
- **Un commit por propósito.** Nunca mezcles un fix de infraestructura con
  cambios de UI.
- **Mantené este archivo al día.** Si cambia un conteo o un canon de diseño,
  actualizalo **en el mismo commit** que introduce el cambio.

## Trampas conocidas (técnicas)

- **`@theme` solo acepta custom properties planas.** Los tokens van como
  `--color-lqc-500: #0066ff;`, uno por línea — **nunca** con sintaxis de objeto
  anidada entre llaves. Esa forma no es CSS válido: no compila, no genera
  utilidades y la paleta queda inerte mientras el build parece funcionar.
- **Tailwind 4 escanea todo el repo**, incluidas `.claude/agent-memory/` y
  `docs/`. Los nombres de clase escritos **en prosa** (notas, documentación) se
  detectan como uso real y se cuelan al CSS de producción. Por eso
  `src/index.css` tiene `@source not "../.claude";` y
  `@source not "../**/*.md";` — **mantenelos**. Ojo con el glob: `../*.md` solo
  cubre los `.md` de la raíz; `../**/*.md` cubre la raíz **y** las subcarpetas.
- **La regla base `a { color: #66a3ff }`** de `index.css` pisa el color de
  cualquier enlace. Todo `<a>` que funcione como CTA necesita `text-white`
  explícito o el contraste falla (llega a bajar a ~1.9:1). Los `<button>` no
  tienen el problema: la regla base ya les da `color: white`.
- **La regla base aplica un gradiente a todo `<button>`**, y las utilidades de
  Tailwind solo pisan `background-color`, **no `background-image`**. Un botón
  secundario con `bg-black/50` igual se pinta con el gradiente completo y termina
  viéndose **más vívido que el CTA primario**. Los secundarios necesitan `bg-none`.
- **Canon del CTA primario:** `from-lqc-700 to-lqc-500` con
  `hover:from-lqc-600 hover:to-lqc-400`.
- **Canon del título de hero** (idéntico en las 7 páginas): tipografía pesada
  `font-heading font-bold uppercase` con `text-4xl sm:text-5xl md:text-7xl leading-[0.95]`,
  glow `[text-shadow:0_0_40px_rgba(0,212,255,0.35)]` y el gradiente
  `from-blue-400 via-blue-300 to-lqc-accent`. Debajo, una **línea divisoria** en dos
  variantes según la alineación del hero:
  - Heros **centrados** (Torneos, Acerca, Galería, Contacto, Home, Reglamento, Carta): la línea
    en sí es `h-px w-40 bg-gradient-to-r from-transparent via-lqc-accent/60 to-transparent`
    — corta, simétrica. El centrado y la separación dependen del hero: si usa
    `flex flex-col items-center` (Torneos, Acerca, Home) la línea hereda el centro y el gap; si
    no (Galería, Contacto, Reglamento, Carta) la línea lleva `mx-auto mb-6` propios.
  - Hero de **Registro** (alineado a la izquierda):
    `h-px w-full bg-gradient-to-r from-lqc-accent/60 via-blue-500/20 to-transparent`
    — ancha, asimétrica.
- **Un guard derivado de estado NO protege contra el doble clic.** Un
  `const ocupado = estado === 'x'` recién se vuelve true **después de un re-render**, así
  que si el handler hace `await` **antes** de tocar estado, un segundo clic entra por esa
  ventana y lanza la operación dos veces. Le pasó al uploader de galería: el `await` de
  `getSession()` estaba antes del cambio de estado y un doble clic subía el lote entero
  **dos veces**, con archivos y filas duplicados que hay que limpiar a mano. Se cierra con
  un **`useRef` puesto en la primera línea del handler, antes de cualquier `await`, y
  liberado en un `finally`**: un ref cambia en el acto y no espera al render.
- **«0 filas sin error» también aplica a DELETE y a Storage.** Ya estaba documentado para
  el UPDATE de archivado, y vale igual para los dos casos nuevos: un `.delete()` de
  PostgREST **no devuelve filas** si no se le encadena `.select(...)`, y
  `storage.remove()` puede volver con `error: null` **sin haber borrado nada** si la
  política del bucket no lo permite. En los dos hay que comprobar `data.length > 0`, no
  el `error`.
- **Un build verde puede salir con el formulario muerto.** Si faltan las
  variables de entorno de Supabase, `npm run build` **pasa igual** (0 errores,
  0 warnings) y el sitio se ve perfecto, pero `/registro` no guarda nada: el
  cliente devuelve `null` y el formulario muestra su error genérico. La única
  señal es el aviso `[LQC] Aviso: faltan variables de entorno …` que imprime
  `vite.config.ts`. **No lo pases por alto.** Detalle: sin credenciales Rollup
  elimina `supabase-js` entero como código muerto, así que ese build tampoco
  sirve para probar la ruta real (el chunk de `/registro` pasa de ~238 kB a
  ~25 kB).

### nginx: una carpeta de `public/` con el nombre de una ruta, y por qué `$uri/` no va

**Arreglado el 2026-09-16.** `/galeria` daba **403 en carga directa** —abrirla desde un link,
con F5 o escribiendo la URL— durante meses sin que nadie lo viera, porque navegando
**dentro** del sitio React cambia de ruta sin pedirle nada al servidor. Solo fallaba esa
ruta.

**La causa eran dos cosas juntas:**

1. `nginx.conf` tenía `try_files $uri $uri/ /index.html;`.
2. Existe `public/galeria/` —las fotos viejas de antes del bucket— y Vite la copia a
   `dist/galeria/`. O sea, en el servidor hay un **directorio real** con el mismo nombre que
   la ruta de React.

Con eso:

- **`/galeria/`**: `$uri` ya es ese directorio → nginx busca `galeria/index.html`, no
  existe, y sin `autoindex` responde **403**. Nunca llega al `/index.html` de la SPA.
- **`/galeria`**: `$uri/` encuentra el directorio → nginx manda **301 a
  `http://…/galeria/`** —`http` porque escucha en el 80 detrás del proxy de Coolify—, el
  proxy lo sube a https y termina en el mismo 403.

> **REGLA: en `nginx.conf` va `try_files $uri /index.html;` y NUNCA `$uri/`.** Una SPA no
> tiene directorios con su propio `index.html`; lo único que hace `$uri/` es meterse en las
> carpetas de assets y devolver 301/403 donde tendría que responder React. Es la forma que
> traen casi todos los ejemplos de «nginx para SPA» copiados de internet, y por eso es fácil
> de reintroducir. Si vuelve, `/galeria` se rompe al instante: la carpeta sigue ahí.

- **Con la regla puesta, una CARPETA homónima ya no rompe nada**, pero un **ARCHIVO** sí:
  `$uri` sirve primero lo que exista, así que un `public/carta` sin extensión taparía la ruta
  `/carta`. Antes de agregar algo en la raíz de `public/`, comparalo contra las `<Route>` de
  `App.tsx`.
- **No se reproduce en local.** `npm run dev` y `vite preview` no usan nginx: los dos
  responden `/galeria/` con la SPA y 200 (verificado). Para probar algo de nginx hay que
  construir la imagen con el `Dockerfile` y pedir las rutas **con `curl`, en carga
  directa y con y sin barra**. Clickear en el sitio no prueba nada.
- **Producción usa ESTE `nginx.conf`**, con el build pack Dockerfile y no con la config que
  Coolify genera para Nixpacks. Verificado desde afuera: `/50x.html` se sirve —la de Coolify
  lo marca `internal`— y `/50x` cae al index —la de Coolify probaría `$uri.html`—.
- **Finales de línea.** En git `nginx.conf` está en **LF**, y así lo clona Coolify. El CRLF
  que se ve en Windows lo pone `core.autocrlf=true` al hacer checkout. Ojo: `sed -i` de Git
  Bash convierte la copia de trabajo a LF sin avisar. Al commitear da igual, porque git
  guarda LF, pero `cat -A` lo delata.

#### Pendientes de nginx (detectados el 2026-09-16, sin tocar a propósito)

Salieron en la misma batería de pruebas y quedan **fuera** de ese arreglo. Cada uno va en su
propio commit, con su propio análisis:

1. **Un archivo que no existe responde el `index.html` con 200.** `/assets/no-existe.js`
   devuelve `200 text/html`: el mismo fallback que hace andar las rutas de React se lo
   aplica también a los assets. Es el más importante de los tres. Lo esperable, **sin
   verificar todavía**: un navegador con el `index.html` viejo en caché que pide un chunk
   con hash de un deploy anterior recibe HTML en vez de un 404, y la importación dinámica
   falla con un error de MIME en vez de uno de red. Antes de arreglarlo hay que ver qué hace
   hoy `ErrorBoundary.tsx` con un chunk que falla (tiene un botón de recarga manual) y cómo
   se cachea `index.html`.
2. **`/favicon.ico` y `/robots.txt` devuelven la SPA** (200 `text/html`) por la misma vía:
   no existen en `public/`. El favicon real es `/LOGO-COPA.ico`, declarado en `index.html`.
   Pero hay navegadores y lectores de feeds que piden `/favicon.ico` igual, y un crawler que
   pide `robots.txt` recibe HTML.
3. **`site.webmanifest` sale como `application/octet-stream`** en vez de
   `application/manifest+json`: los `mime.types` de nginx no conocen esa extensión.

### Animación y movimiento

- **CORS de canvas: `crossOrigin` antes de `.src`.** Para exportar el canvas a PNG, la
  imagen de Data Dragon debe cargarse con `img.crossOrigin = 'anonymous'` **asignado antes**
  de `img.src`. Si se asigna después (o se omite), el canvas queda *tainted* y `toBlob()` /
  `toDataURL()` **lanzan SecurityError**: el build no avisa, la carta se ve bien en pantalla
  y lo único que revienta es la descarga.
- **Glow reusable de 3 capas: no colgarlo de `.pill-marca`.** El glow son 3 capas y está
  pensado para reusarse. Si se acopla a `.pill-marca` solo funciona ahí y se rompe al
  reusarlo en otro elemento. Debe vivir como utilidad propia, independiente de esa clase.
- **`prefers-reduced-motion` acelera a 0.01ms, no apaga — y no cubre la animación por JS.**
  El reset típico pone `animation-duration: 0.01ms` (ver la manta en `index.css:595-603`),
  que **acelera** a casi-instantáneo pero **no desactiva**. Como es media query de CSS,
  cubre cualquier animación declarada en CSS —incluido el `<Reveal>`, cuyo JS solo agrega la
  clase `animate-slide-in-up` y deja la animación al CSS— pero **no toca lo animado por JS
  puro** (canvas, rAF/WAAPI): eso necesita su propio chequeo con
  `matchMedia('(prefers-reduced-motion: reduce)')`.
- **Fase continua con `animation-delay` negativo inline: el shorthand no la pisa, un cambio
  de valor sí la rompe.** El `style={{ animationDelay }}` de la copa de `LayoutPublico` gana
  sobre el `animation:` de la clase porque un estilo inline le gana a cualquier selector. Lo
  que la rompe es **recalcular** el delay con la animación en curso: el navegador reubica la
  animación en el acto y la copa salta. Por eso va en un inicializador perezoso de
  `useState`, y por eso los periodos duplicados entre CSS y TS tienen que coincidir.
- **Reveal seguro: el estado oculto va en el keyframe, nunca en una clase base
  `opacity-0`.** Si el `opacity: 0` inicial vive en una clase base y el observer no dispara
  (JS desactivado, error, elemento que nunca entra al viewport), el contenido queda
  **invisible para siempre**. El estado oculto debe vivir **dentro del keyframe**, de modo
  que el default sin animar sea *visible*.

### Policies de `jugadores`: seguras HOY solo porque no hay login de jugador (deuda P1)

Las policies RLS de `public.jugadores` para el rol `authenticated` son permisivas sin
filtro real:
- **SELECT** "Solo admins leen jugadores" → `qual = true` (VIVA: `authenticated` tiene
  GRANT SELECT, necesario para el embed `equipos → jugadores` del panel).
- **UPDATE** "Solo admins actualizan jugadores" → `qual = true, check = true` (MUERTA:
  el GRANT UPDATE de `authenticated` está revocado, así que hoy no habilita nada. La
  única escritura legítima es la RPC `editar_jugador`, SECURITY DEFINER).

Los nombres MIENTEN: no filtran por admin. La base **no tiene concepto de admin de LQC**;
los 3 usuarios de `auth.users` son staff de confianza (todos `@revolution505.com`), así
que "cualquier authenticated lee todo" == "los admins leen todo". El registro de jugadores
es anónimo (`anon` no tiene SELECT), así que ningún jugador tiene sesión.

**Por qué es seguro hoy:** no hay nadie no-staff con sesión autenticada. Verificado
2026-08-09: 3 usuarios en `auth.users`, todos admins creados por el equipo.

**GATILLO (P1) — antes de habilitar CUALQUIER login de jugador/capitán:** crear una tabla
`app_admins(user_id uuid)` con los uuids del staff y cambiar AMBAS policies a
`USING (auth.uid() in (select user_id from app_admins))`. Sin esto, el día que un jugador
pueda autenticarse podrá leer `/rest/v1/jugadores?select=*` con su token (saltándose el
frontend por completo, vía la API REST de PostgREST) y sacar nombre + correo de TODOS los
inscritos, menores incluidos. Es cambio de modelo de auth → va probado en local primero
(Cabo B), no en caliente sobre prod.

### Cabo B — entorno local que espeje prod (diagnóstico HECHO, montaje pendiente)

**Cómo está montado prod (verificado 2026-08-10, vía SSH a revolutionserv):**
Supabase self-hosted armado con el **compose oficial de Supabase vía Coolify** (NO
instalación a mano, NO el CLI de Supabase). Raíz del proyecto en el servidor:
`/data/coolify/services/dd3pab1anj2tgzmw5xt6nvxd/`. Los scripts de init de la DB
viven en `volumes/db/` (roles.sql, jwt.sql, realtime.sql, webhooks.sql, pooler.sql,
logs.sql, _supabase.sql). `roles.sql` es el crítico para espejar roles/grants.
Datos físicos en el volumen Docker `dd3pab1anj2tgzmw5xt6nvxd_supabase-db-data`.

**Versiones exactas del stack (para pinear el local):**
- Postgres: supabase/postgres:15.8.1.085 (server_version 15.8)
- PostgREST: v14.6
- GoTrue (auth): v2.186.0
- Storage API: v1.44.2
- MinIO: ghcr.io/coollabsio/minio (fork de Coolify, NO el oficial — ojo al espejar Storage)
- Kong 3.9.1 · Studio 2026.03.16 · supavisor 2.7.4 · realtime v2.76.5 · edge-runtime v1.71.2

**Estrategia elegida: A (CLI oficial de Supabase en local, pineado a estas versiones,
portando esquema + roles).** NO replicar el compose entero de Coolify (Kong, supavisor,
analytics, vector — innecesario para probar RLS/policies/RPCs). El objetivo del local es
probar cambios de RLS/policies/RPCs/triggers ANTES de tocar prod, no correr el stack completo.

**Primeros pasos del montaje (próxima sesión, cabeza fresca):**
1. `Test-Path supabase` en C:\Dev\LQC — ¿ya hay carpeta de CLI o se arranca de cero?
2. Extraer esquema de prod: pg_dump --schema-only (comando exacto a definir con cuidado, es lectura sobre prod viva).
3. Replicar roles base desde roles.sql.

## Variables de entorno

Un build **funcional** necesita las dos variables documentadas en `.env.example`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` — la clave **anon/publishable**, nunca la
  `service_role`: toda variable `VITE_*` se empaqueta en el bundle del navegador.

Se inyectan en **tiempo de build**, así que cambiarlas exige rebuildear. No hay
`.env` en el repo (está en `.gitignore`); copiá `.env.example` como `.env`.

**En Docker** van como build args (el `Dockerfile` las declara con `ARG` + `ENV`
en la etapa `builder`; Vite las lee de `process.env` vía `loadEnv`, sin que haga
falta generar un `.env`):

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=tu-clave-anon \
  -t lqc-web .
```

Si se omiten, la imagen se construye igual y sale con el formulario muerto: el
aviso `[LQC]` en el log del build es la única señal. BuildKit avisa
`SecretsUsedInArgOrEnv` por el nombre `*_KEY`: es un falso positivo esperado
—la anon key es pública por diseño— y **no se silencia a propósito**, porque esa
misma regla es la que avisaría si alguien pusiera la `service_role`.

`.dockerignore` deja fuera `.env` y `.env.*` (también `.env.example`, que el
build no necesita), además de `node_modules`, `dist` y `.git`.

**En nixpacks** (la otra vía de deploy) no hay nada que declarar en
`nixpacks.toml`: alcanza con configurar las dos variables en el entorno de
**build** de la plataforma, porque `loadEnv` las toma de `process.env`. Si la
plataforma solo las inyecta en runtime, no sirven: este es un sitio estático y
para cuando corre nginx el bundle ya está compilado. Nunca hardcodearlas en
`nixpacks.toml`: quedarían commiteadas.

**Verificado (2026-07-23):** las variables ya están configuradas en el deploy y
se confirmó un **registro real de punta a punta** — una inscripción anónima desde
producción llegó a la tabla `inscripciones`. Por eso `/registro` ya es una página
normal del nav (está en `navItems`).

## Comandos

```bash
npm run dev       # servidor de desarrollo (Vite)
npm run build     # tsc -b && vite build  ← la verificación obligatoria
npm run lint      # eslint
npm run preview   # sirve el build de producción
```

## Equipo de agentes

Definidos en `.claude/agents/`:

- **cazador-bugs** — depuración: causa raíz, fix mínimo, verificación con build.
- **ui-diseno** — UI, layout, responsive y estilo, con el sistema de diseño de arriba.
- **contenido** — copy y textos en español.
- **revisor** — revisión de código de solo lectura, antes de commitear.
