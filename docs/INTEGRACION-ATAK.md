# Integración con ATAK.GG

**La sincronización con ATAK YA FUNCIONA en producción, pero no vive en este
repo.** Está implementada como **triggers de PostgreSQL dentro de Supabase**, así
que es invisible para cualquiera que solo lea el código del sitio.

Cuidado con generalizar eso: el sitio habla con ATAK por **dos vías distintas**.
Los triggers (esta sección y las que siguen) no están en el repo. La **validación
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

## ⚠️ Este documento describe el modelo VIEJO (`inscripciones`)

**El 2026-07-29 el registro se migró a `public.equipos` + `public.jugadores`** (ver
[AGENTS.md](../AGENTS.md), «Modelo de datos»). `inscripciones` sigue existiendo pero
**ya no recibe registros**, así que **todo el SQL de este archivo apunta a una tabla
que dejó de usarse**. Lo que se sabe del estado actual:

- **Baja/alta (archivar/restaurar): migrado.** El trigger equivalente cuelga ahora de
  **`equipos.archivado_en`**. El panel escribe esa columna con
  `UPDATE ... .eq('id', equipo.id)`, una sola fila.
- **Alta al registrarse: SIN CONFIRMAR.** El registro entra por la RPC
  `registrar_equipo`, no por un INSERT del cliente. **No está verificado desde el repo
  si esa función notifica el alta a ATAK.** Compruébalo contra la base —no lo asumas
  en ningún sentido— antes de afirmar nada: si no notificara, ningún equipo nuevo
  llegaría a ATAK y, por lo de más abajo, **nada lo delataría**.

Todo lo demás de este archivo —el porqué del `http://` interno, el alias de red
`atak-backend`, cómo diagnosticar con `net._http_response`, el límite de 7 jugadores
y, sobre todo, que las llamadas son **fire-and-forget**— sigue vigente tal cual:
describe el transporte, no el esquema.

---

## Qué hace

Dos triggers sobre `public.inscripciones` llaman a la API de ATAK.GG usando la
extensión **`pg_net`** (HTTP asíncrono desde Postgres).

| Trigger | Cuándo | Llamada |
| --- | --- | --- |
| `AFTER INSERT` | alguien completa `/registro` | `POST /register` — alta del equipo o del jugador |
| `AFTER UPDATE OF archivado_en` | el panel archiva o restaura | `POST /unregister` al archivar, `POST /register` al restaurar |

El segundo trigger tiene una **cláusula `WHEN`** para que **marcar pago o guardar
notas NO disparen nada**. Son dos filtros superpuestos:

1. `UPDATE OF archivado_en` — el trigger ni se considera si la sentencia no
   menciona esa columna. Las escrituras de pago (`pagado`, `pagado_en`) y de
   notas (`notas`) no la mencionan.
2. `WHEN (old.archivado_en IS DISTINCT FROM new.archivado_en)` — aunque una
   sentencia futura sí la incluyera, si el valor no cambia no se llama a ATAK.

Vale la pena conservar los dos: el primero solo mira las columnas *listadas* en
el `UPDATE`, no si cambiaron. El segundo es el que garantiza que hubo un cambio
real.

---

## Función central: `public.atak_enviar`

Centraliza la URL y el secreto en un solo lugar, para que los triggers no los
repitan y rotar el secreto sea un cambio de una línea.

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
ya corregido. Se deja escrito porque es la forma exacta que toma esta falla
cuando ocurre.

**Qué pasó.** Se archivó un equipo desde `/admin` mientras el hostname viejo ya
no resolvía. El trigger sí disparó —la escritura local fue normal—, pero `pg_net`
falló con `Couldn't resolve host name` y el `POST /unregister` **nunca llegó a
ATAK**.

**La consecuencia.** El equipo quedó **archivado en Supabase pero todavía
inscrito en el torneo de ATAK.GG**. El panel mostraba una cosa y el bracket otra.
**Sin un solo aviso en la interfaz**: para el admin, archivar había funcionado.

**Cómo se detectó.** Consultando `net._http_response` (ver arriba): la fila de esa
escritura tenía `status_code` nulo y el `error_msg` de resolución de nombre.

**Cómo se corrigió.** Llamando a la función a mano, con el equipo afectado:

```sql
select public.atak_enviar('/unregister', jsonb_build_object('equipo', '<nombre>'));
```

Respondió `team_deleted`, y las dos bases volvieron a coincidir.

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

| Respuesta | Significa |
| --- | --- |
| `team_created` | se creó el equipo en ATAK |
| `player_added` | se agregó un jugador a un equipo existente |
| `player_updated` | el jugador ya estaba y se actualizaron sus datos |
| `player_removed` | se quitó un jugador del equipo |
| `team_deleted` | se eliminó el equipo (se archivó su última inscripción) |
| `already_absent` | no había nada que quitar; la baja es idempotente |

---

## Límite de 7 jugadores por equipo

**Del lado de ATAK**, un equipo admite **como máximo 7 jugadores**. El octavo
registro devuelve **409**.

**Ese 409 NO bloquea el insert local.** La fila entra igual en
`public.inscripciones`, el jugador ve la confirmación de `/registro` y aparece en
el panel. O sea: **las dos bases divergen** y el sitio no muestra ninguna señal.

Hay que **detectarlo a mano** revisando `net._http_response` en busca de 409, o
comparando el conteo de jugadores del panel contra el de ATAK.

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

Los triggers son de `INSERT` y `UPDATE` **solamente**. Si alguien borra filas con
un `DELETE` a mano en la base, **ATAK no se entera**: el equipo se queda inscrito
en el torneo sin ninguna fila local que lo respalde.

Es una razón más para la regla que el panel ya sigue: **nunca borrar, archivar**
(`archivado_en`), que es la operación que sí propaga. La tabla además no tiene
política de DELETE para la app, así que un borrado solo puede venir de alguien
entrando a la base directamente.
