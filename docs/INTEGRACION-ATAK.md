# Integración con ATAK.GG

**La sincronización con ATAK YA FUNCIONA en producción, pero no vive en este
repo.** Está implementada **dentro de Supabase**, en PL/pgSQL: en parte como un
**trigger** y en parte como una **llamada explícita desde la función de registro**
(ver «Estado vigente»). En cualquier caso es invisible para quien solo lea el
código del sitio.

Cuidado con generalizar eso: el sitio habla con ATAK por **dos vías distintas**.
Lo de Supabase (esta sección y las que siguen) no está en el repo. La **validación
del Riot ID** contra la API pública sí está, en `src/lib/atak.ts`, y se documenta
[más abajo](#api-pública-validación-de-riot-id-esto-sí-vive-en-el-repo).

Eso ya causó un error de diagnóstico: un agente grepeó el repo entero buscando
`atak`, `webhook`, `functions.invoke` y una carpeta `supabase/`, no encontró nada
y **concluyó que la integración no existía**. Buscar en el repo no alcanza; la
fuente de verdad es la base.

> Este documento describe la forma de la integración para que se entienda desde
> el sitio. El SQL de abajo es la referencia: **lo que corre de verdad es lo que
> está cargado en Supabase.** Ante una diferencia, manda la base.

---

## Estado vigente — modelo `equipos` + `jugadores`

**Todo lo de esta sección está verificado en producción el 2026-07-29**, el mismo día
en que el registro se migró de
`public.inscripciones` a `public.equipos` + `public.jugadores` (ver
[AGENTS.md](../AGENTS.md), «Modelo de datos»). `inscripciones` sigue existiendo pero
**ya no recibe registros**, y la sincronización con ATAK se movió entera al modelo
nuevo. Hay [una sección histórica](#histórico-los-triggers-sobre-inscripciones) al
final con lo que había antes.

Son **dos caminos, y solo uno es un trigger**:

| Qué | Cómo se dispara | Llamada |
| --- | --- | --- |
| **Alta** al registrarse | **NO es un trigger.** Lo llama `public.registrar_equipo` al final de su propia transacción | `POST /register-team` |
| **Baja y alta por archivado** | Trigger `trg_atak_equipo`, `AFTER UPDATE OF archivado_en ON public.equipos` | `POST /unregister` al archivar, `POST /register-team` al restaurar |

Las dos usan la extensión **`pg_net`** (HTTP asíncrono desde Postgres) a través de
`public.atak_enviar`, igual que antes.

---

## Alta: por qué NO es un trigger

Es la decisión menos obvia de toda la integración y conviene que quede escrita,
porque «esto debería ser un trigger» es la primera reacción de cualquiera que lo
lea.

**Un `AFTER INSERT` sobre `equipos` vería CERO jugadores.** `registrar_equipo`
inserta primero la fila del equipo y **después** el roster, así que un trigger por
fila sobre `equipos` correría en el medio, cuando todavía no hay ni un jugador que
mandar: ATAK daría de alta un equipo vacío. Por eso el alta la dispara la **propia
función**, al final, cuando la transacción ya tiene todo:

```sql
-- dentro de public.registrar_equipo(datos jsonb), al final
perform public.atak_enviar('/register-team', public.armar_roster_atak(id));
```

**Verificado el 2026-07-29:** respondió **200** con
`{"ok":true,"action":"team_created","teamSize":5}`.

---

## `public.armar_roster_atak(p_equipo_id uuid)`

Arma el payload que ATAK espera, a partir de un `equipo_id`:

```
{ equipo, capitan_nombre, capitan_celular, jugadores: [ ... ] }
```

con los jugadores **ordenados por `orden`** — el mismo orden que decidió quién es
titular y quién suplente al registrarse.

La usan **los dos** caminos que dan de alta: `registrar_equipo` y el desarchivado
del trigger. Existe justamente para que no haya dos versiones del payload que se
puedan desfasar.

---

## Trigger de archivado: `trg_atak_equipo`

```sql
after update of archivado_en on public.equipos
for each row
when (old.archivado_en is distinct from new.archivado_en)
```

- `archivado_en` **no nulo** → `POST /unregister` (baja del torneo).
- `archivado_en` **nulo** → `POST /register-team` con el roster completo (alta otra vez).

**Verificado el 2026-07-29:** archivar respondió **`team_deleted`**.

La cláusula `WHEN` está para que **marcar pago o guardar notas NO disparen nada**.
Son dos filtros superpuestos y vale la pena conservar los dos:

1. `UPDATE OF archivado_en` — el trigger ni se considera si la sentencia no
   menciona esa columna. Las escrituras de pago (`pagado`, `pagado_en`) y de
   notas (`notas`) no la mencionan.
2. `WHEN (old.archivado_en IS DISTINCT FROM new.archivado_en)` — aunque una
   sentencia futura sí la incluyera, si el valor no cambia no se llama a ATAK.

El primero solo mira las columnas *listadas* en el `UPDATE`, no si cambiaron. El
segundo es el que garantiza que hubo un cambio real.

---

## `/register-team` es idempotente

**Del lado de ATAK el endpoint es atómico** (toma un lock de fila) y **el roster que
se manda REEMPLAZA al que hubiera**. O sea: **reenviarlo es seguro**.

Esto es lo que hace barata la recuperación cuando una llamada se pierde —que, por lo
de más abajo, ocurre en silencio—: no hay que averiguar en qué estado quedó ATAK ni
limpiar nada antes. Se vuelve a mandar el roster y las dos bases quedan iguales:

```sql
select public.atak_enviar('/register-team', public.armar_roster_atak('<equipo_id>'));
```

---

## Función central: `public.atak_enviar`

Centraliza la URL y el secreto en un solo lugar, para que ni el trigger ni
`registrar_equipo` los repitan y rotar el secreto sea un cambio de una línea. **No
cambió con la migración**: es la única pieza que quedó igual.

```sql
create or replace function public.atak_enviar(ruta text, cuerpo jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base text := 'http://atak-backend:4000/api/integrations/lqc';
begin
  perform net.http_post(
    url     := base || ruta,
    body    := cuerpo,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-lqc-secret', '<X_LQC_SECRET>'
    )
  );
end;
$$;
```

---

## Por qué `http://` por red interna y no el dominio público

La URL apunta al **contenedor de ATAK por la red interna de Docker**
(`http://atak-backend:4000`), no al dominio público por HTTPS. No es descuido:

Al salir al dominio público desde el mismo servidor, el **hairpin NAT** del
router devuelve un **certificado autofirmado**, y `pg_net` **no puede saltarse la
validación TLS** (no expone una opción tipo `insecure`). El resultado es que
todas las llamadas fallan con:

```
SSL connect error
```

Por la red interna de Docker el tráfico no sale del host, así que no hay TLS que
validar y el problema desaparece.

---

## Por qué el hostname es `atak-backend` — RESUELTO

**Ya no hay nada que hacer después de cada deploy.** El backend de ATAK tiene un
**alias de red fijo, `atak-backend`, en la red `coolify`**, así que la URL de
`atak_enviar` no depende del deploy. Esta sección queda porque explica **por qué
la URL es la que es**, y por qué no hay que "simplificarla" volviendo al nombre
del contenedor.

**Lo que pasaba antes.** El nombre del contenedor de ATAK lleva un **sufijo de
timestamp que Coolify regenera en cada deploy del backend**. La URL apuntaba a
ese nombre, así que cada deploy la dejaba apuntando a un host que ya no existía y
el webhook fallaba con:

```
Couldn't resolve host name
```

Y ahí estaba lo peor: **los registros dejaban de llegar a ATAK EN SILENCIO.** El
`INSERT` local seguía funcionando perfecto, el jugador veía su confirmación en
`/registro`, la fila aparecía en el panel — y en ATAK.GG no había nadie. Nada en
el sitio lo delataba. Tumbó la integración más de una vez, y de ahí salió el
[incidente registrado](#incidente-registrado) de más abajo.

**Cómo se resolvió.** Con el alias de red: el nombre `atak-backend` lo fija la
configuración de red, no el deploy, así que sobrevive a los redespliegues.

**Lo que sigue importando:** si alguien saca el alias, mueve el backend fuera de
la red `coolify` o "limpia" la URL para que apunte al nombre real del contenedor,
vuelve **exactamente** este fallo, con el mismo silencio. El alias es parte de la
integración, no un detalle de infraestructura.

---

## Cómo diagnosticar

`pg_net` guarda cada respuesta en `net._http_response`:

```sql
select status_code, content, error_msg, created
from net._http_response
order by created desc;
```

Cómo leerlo:

- **`status_code` nulo** → la llamada **no llegó**. Mirá `error_msg`: si dice
  `Couldn't resolve host name`, el alias `atak-backend` no está resolviendo —el
  backend está caído, quedó fuera de la red `coolify`, o le sacaron el alias—; si
  dice `SSL connect error` es que la URL quedó apuntando al dominio público.
- **`status_code` 2xx** → llegó. `content` trae la respuesta de ATAK.
- **`status_code` 409** → llegó y ATAK lo rechazó (ver el límite de 7 jugadores).

Las filas son asíncronas: pueden tardar unos segundos en aparecer después de la
escritura.

---

## Incidente registrado

**Un equipo archivado en el panel que siguió inscrito en el torneo.** Caso real,
ya corregido. Ocurrió con el modelo viejo, pero **la falla no era del esquema sino
del transporte**, así que se deja escrito tal cual: es la forma exacta que toma
cuando ocurre, y con `equipos` puede volver a ocurrir igual.

**Qué pasó.** Se archivó un equipo desde `/admin` mientras el hostname viejo ya
no resolvía. El trigger sí disparó —la escritura local fue normal—, pero `pg_net`
falló con `Couldn't resolve host name` y el `POST /unregister` **nunca llegó a
ATAK**.

**La consecuencia.** El equipo quedó **archivado en Supabase pero todavía
inscrito en el torneo de ATAK.GG**. El panel mostraba una cosa y el bracket otra.
**Sin un solo aviso en la interfaz**: para el admin, archivar había funcionado.

**Cómo se detectó.** Consultando `net._http_response` (ver arriba): la fila de esa
escritura tenía `status_code` nulo y el `error_msg` de resolución de nombre.

**Cómo se corrigió.** Llamando a la función a mano, con el equipo afectado (forma
del **modelo viejo**, que identificaba al equipo por su nombre):

```sql
select public.atak_enviar('/unregister', jsonb_build_object('equipo', '<nombre>'));
```

Respondió `team_deleted`, y las dos bases volvieron a coincidir.

**Hoy, para el caso inverso** —un alta que no llegó— la reparación es reenviar el
roster, que es idempotente (ver [`/register-team` es
idempotente](#register-team-es-idempotente)). Para una baja que no llegó, confirmá
la forma del payload de `/unregister` contra la definición del trigger antes de
llamarlo a mano: la de arriba es la del esquema que ya no está.

**La lección, que sigue vigente con el alias puesto:** las llamadas son
**fire-and-forget**. `pg_net` no devuelve el resultado al trigger, así que si el
destino no responde **el panel no se entera** y las dos bases divergen **en
silencio**. El alias de red eliminó *una* causa —la más frecuente—, no la clase
entera: un backend caído, un 409 por el límite de jugadores o un error de red
producen el mismo desenlace mudo. **Revisar `net._http_response` es la única
forma de detectarlo.** Vale la pena mirarlo después de archivar o restaurar algo
que importe.

---

## Respuestas esperadas

El cuerpo llega como `{"ok":true,"action":"…"}`, y en `/register-team` además con
`teamSize`.

| Respuesta | De | Significa |
| --- | --- | --- |
| `team_created` | `/register-team` | se creó el equipo en ATAK con su roster. **Confirmada el 2026-07-29** (`{"ok":true,"action":"team_created","teamSize":5}`) |
| `team_deleted` | `/unregister` | se dio de baja el equipo del torneo. **Confirmada el 2026-07-29** |

Las respuestas a nivel JUGADOR que documentaba este archivo —`player_added`,
`player_updated`, `player_removed`— eran del endpoint `/register` del modelo viejo,
que daba de alta **de a un jugador por vez** porque cada fila de `inscripciones` era
una persona. Con `/register-team` la unidad es el equipo entero, así que no
aparecen. `already_absent` (baja idempotente, no había nada que quitar) se
documentaba para `/unregister` y no se volvió a comprobar con el modelo nuevo.

---

## Límite de 7 jugadores por equipo

**Del lado de ATAK**, un equipo admite **como máximo 7 jugadores**.

**Con el modelo nuevo el sitio ya no puede empujar un octavo.** El formulario de
`/registro` permite entre 5 y 7 tarjetas, y `registrar_equipo` valida el tamaño
**antes** de insertar nada: un roster de más devuelve `max_jugadores` y no escribe
ni una fila. O sea que el escenario viejo —el jugador nº 8 entraba local igual y las
dos bases divergían— **ya no puede originarse desde el sitio**.

Lo que sigue en pie: el límite es de ATAK, no nuestro, y una escritura hecha
directamente en la base saltea esa validación. Si eso pasa, se **detecta a mano**
revisando `net._http_response`, o comparando el conteo de jugadores del panel contra
el de ATAK.

---

## API pública: validación de Riot ID (esto SÍ vive en el repo)

Aparte de los triggers, ATAK expone un endpoint **público** que el sitio llama
directo desde el navegador. Es la única parte de la integración que sí está en el
código: **[`src/lib/atak.ts`](../src/lib/atak.ts)**, y la usa el campo Riot ID de
`/registro` al perder el foco.

```
GET https://atakback.revolution505.com/api/public/v1/validate-riot-id?riotId=<encodeURIComponent>
```

| Respuesta | Significa |
| --- | --- |
| `{ ok:true, data:{ valid:true, gameName, tagLine } }` | el Riot ID existe |
| `{ ok:true, data:{ valid:false, reason:"not_found" } }` | no existe |
| `{ ok:true, data:{ valid:false, reason:"format" } }` | formato inválido |
| `{ ok:true, data:{ valid:null, reason:"unavailable" } }` | Riot caído |

**No lleva `x-lqc-secret`**: es público y sin credenciales, al revés que
`atak_enviar`. Nada de lo que se mande por acá es secreto — viaja en el bundle.

**Regla que no se negocia: esta validación nunca bloquea un registro.** Solo
`not_found` frena el envío. Todo lo demás —`format`, `unavailable`, error de red,
timeout, CORS, un `reason` desconocido, un JSON con otra forma— se trata como "no se pudo
comprobar" y el registro sigue. Perder una inscripción de $500 porque una API de
terceros estaba caída es peor que aceptar un Riot ID inválido, que además se
corrige a mano desde el panel.

**Estado al 2026-07-27, verificado con `curl`:**

- La ruta **todavía no está desplegada**: devuelve **404**. El backend sí está
  vivo (`/api/health` responde 200). O sea que hoy la validación está inerte —el
  formulario funciona igual, que es justamente el punto del diseño— y se activa
  sola cuando la ruta exista.
- **CORS incompleto.** El 404 de esa ruta manda `Access-Control-Allow-Origin: *`,
  pero `/api/health` —la única ruta que hoy responde 200— **no manda ningún
  header CORS**. La cobertura es inconsistente por ruta, así que **queda sin
  comprobar si la respuesta 200 real va a traer el header**. Si no lo trae, el
  navegador bloquea la respuesta y la validación queda muda para siempre, además
  de imprimir un error de CORS en consola que el código no puede atrapar.
  **Antes de dar la función por viva, comprobar el header en el 200, no en el 404:**

```bash
curl -s -D - -o /dev/null -H "Origin: https://lqc.revolution505.com" \
  "https://atakback.revolution505.com/api/public/v1/validate-riot-id?riotId=Jugador%23MX1"
```

---

## Un `DELETE` directo en SQL no dispara nada

El único trigger es de `UPDATE OF archivado_en`, y el alta la dispara
`registrar_equipo`. **Ninguna de las dos cosas se entera de un `DELETE`.** Si
alguien borra filas de `equipos` o de `jugadores` a mano en la base, **ATAK no se
entera**: el equipo se queda inscrito en el torneo sin ninguna fila local que lo
respalde.

Es una razón más para la regla que el panel ya sigue: **nunca borrar, archivar**
(`archivado_en`), que es la operación que sí propaga. Las tablas además no tienen
política de DELETE para la app, así que un borrado solo puede venir de alguien
entrando a la base directamente.

**Ojo con `jugadores`:** borrar una fila de ahí tampoco avisa a nadie, y como el
roster que ATAK tiene es el que se le mandó la última vez, el equipo seguiría allá
con el jugador borrado. Para sincronizar después de tocar el roster a mano hay que
reenviarlo (es idempotente, ver arriba).

---

## Histórico: los triggers sobre `inscripciones`

**Ya no corren para nada nuevo** — `inscripciones` no recibe registros desde el
2026-07-29. Se conserva porque explica por qué varias cosas son como son: el
[incidente registrado](#incidente-registrado) ocurrió con este esquema, y la tabla de
respuestas a nivel jugador (`player_added`, `player_updated`, `player_removed`) solo
tiene sentido leyéndolo.

Eran **dos** triggers sobre `public.inscripciones`, donde **una fila era un jugador**
y el equipo era un string repetido:

| Trigger | Cuándo | Llamada |
| --- | --- | --- |
| `atak_inscripcion_insert` (`AFTER INSERT`) | alguien completaba `/registro` | `POST /register` — alta **de un jugador** |
| `atak_inscripcion_archivado` (`AFTER UPDATE OF archivado_en`) | el panel archivaba o restauraba | `POST /unregister` / `POST /register` |

```sql
-- Alta: cada fila nueva de /registro
create or replace function public.atak_on_insert()
returns trigger language plpgsql security definer as $$
begin
  perform public.atak_enviar('/register', to_jsonb(new));
  return new;
end;
$$;

create trigger atak_inscripcion_insert
  after insert on public.inscripciones
  for each row
  execute function public.atak_on_insert();
```

```sql
-- Archivar / restaurar
create or replace function public.atak_on_archivado()
returns trigger language plpgsql security definer as $$
begin
  if new.archivado_en is not null then
    perform public.atak_enviar('/unregister', to_jsonb(new));
  else
    perform public.atak_enviar('/register', to_jsonb(new));
  end if;
  return new;
end;
$$;

create trigger atak_inscripcion_archivado
  after update of archivado_en on public.inscripciones
  for each row
  when (old.archivado_en is distinct from new.archivado_en)
  execute function public.atak_on_archivado();
```

**Las dos diferencias que más importan** frente a lo vigente:

1. El alta **sí** era un trigger, y podía serlo porque el INSERT de una fila ya
   traía al jugador entero (`to_jsonb(new)`). Con `equipos` eso deja de funcionar:
   la fila del equipo se inserta antes que su roster, así que un trigger equivalente
   mandaría un equipo vacío. De ahí que ahora la llame `registrar_equipo`.
2. El archivado se disparaba **una vez por cada fila del equipo** —de ahí el estado
   `'parcial'` que tenía el panel—. Hoy es un solo UPDATE sobre una sola fila.
