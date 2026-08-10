# LQC — League Querétaro Championship

Sitio web público de la **League Querétaro Championship (LQC)**, la liga de esports
de **Revolution505** en Querétaro. Es un sitio **estático de presentación**: torneos,
galería, información de la liga y contacto. **No hay backend propio** y casi todo el
contenido **público** vive en los componentes.

**La excepción es la galería.** Desde el **2026-08-08**, `/galeria` lee la tabla
`public.galeria_media` y arma las URLs contra el bucket `galeria` de Storage — ver
[Galería dinámica](#galería-dinámica-galeria--panel). Las demás páginas públicas siguen
sin leer ninguna base.

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
  `authenticated`.
- **`storage.objects`** (bucket `galeria`) — SELECT público; INSERT y DELETE solo
  `authenticated`.

Es la **primera y única** superficie del proyecto con DELETE habilitado.

### Componentes

- **`SubirGaleria.tsx`** — uploader múltiple, pestaña «Galería».
- **`GestionGaleria.tsx`** — borrado, pestaña «Gestionar».
- **`Panel.tsx`** pasó del ternario binario a un mapa
  `Record<SeccionId, ComponentType>` con **3 pestañas**: Inscripciones / Galería /
  Gestionar. Con tres secciones el `else` del ternario era un cajón de sastre —cualquier
  id que no fuera el del `if` caía en el mismo componente—; el mapa tipado obliga a una
  entrada por cada id.

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
  components/layout/
    Header.tsx             navegación (arreglo navItems) + menú móvil
    Footer.tsx
  lib/
    supabase.ts            cliente de Supabase (perezoso; devuelve null sin credenciales)
    atak.ts                API pública de ATAK.GG: valida un Riot ID; nunca lanza ni bloquea
    reglamento.ts          ruta, nombre de descarga y peso del PDF del reglamento
  pages/                   Home · Torneos · Galeria · Acerca · Contacto · Registro · Reglamento
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

## Morado heredado — ya migrado

**No queda morado en el sitio.** Las 25 ocurrencias de `purple-*` que había en 6
archivos (`App.tsx`, `Home`, `Torneos`, `Acerca`, `Contacto`, `Galeria`) se
migraron a azul/cian el 2026-07-22. La verificación es
`grep -rn "purple" src/` → **0 resultados**.

Convenciones que dejó esa migración, a respetar en páginas nuevas:

- **Gradiente canónico de títulos** (idéntico en las 6 páginas):
  `from-blue-400 via-blue-300 to-lqc-accent`.
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
- **Canon del gradiente de títulos** (idéntico en las 6 páginas):
  `from-blue-400 via-blue-300 to-lqc-accent`.
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
