# Integración con ATAK.GG

**Esta integración YA FUNCIONA en producción, pero no vive en este repo.** Está
implementada como **triggers de PostgreSQL dentro de Supabase**, así que es
invisible para cualquiera que solo lea el código del sitio.

Eso ya causó un error de diagnóstico: un agente grepeó el repo entero buscando
`atak`, `webhook`, `functions.invoke` y una carpeta `supabase/`, no encontró nada
y **concluyó que la integración no existía**. Buscar en el repo no alcanza; la
fuente de verdad es la base.

> Este documento describe la forma de la integración para que se entienda desde
> el sitio. El SQL de abajo es la referencia: **lo que corre de verdad es lo que
> está cargado en Supabase.** Ante una diferencia, manda la base.

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
  base text := 'http://<CONTENEDOR_ATAK>:4000/api/integrations/lqc';
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
(`http://<CONTENEDOR_ATAK>:4000`), no al dominio público por HTTPS. No es
descuido:

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

## ⚠️ El nombre del contenedor caduca en cada deploy

**Este es el modo de falla más importante y el más difícil de notar.**

El nombre del contenedor de ATAK lleva un **sufijo de timestamp que Coolify
regenera en cada deploy**. Cuando cambia, la URL de `atak_enviar` apunta a un
host que ya no existe y el webhook falla con:

```
Couldn't resolve host name
```

Y acá está el problema: **los registros dejan de llegar a ATAK EN SILENCIO.** El
`INSERT` local sigue funcionando perfecto, el jugador ve su confirmación en
`/registro`, la fila aparece en el panel — y en ATAK.GG no hay nadie. Nada en el
sitio lo delata.

**Después de cada deploy de ATAK hay que verificar la integración** (ver abajo) y,
si el nombre cambió, actualizar `base` en `public.atak_enviar`.

**Pendiente:** configurar un **alias de red estable** para el contenedor, de modo
que la URL deje de depender del nombre generado. Mientras eso no exista, esta
verificación manual es obligatoria.

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
  `Couldn't resolve host name` es el nombre del contenedor caducado; si dice
  `SSL connect error` es que la URL quedó apuntando al dominio público.
- **`status_code` 2xx** → llegó. `content` trae la respuesta de ATAK.
- **`status_code` 409** → llegó y ATAK lo rechazó (ver el límite de 7 jugadores).

Las filas son asíncronas: pueden tardar unos segundos en aparecer después de la
escritura.

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

## Un `DELETE` directo en SQL no dispara nada

Los triggers son de `INSERT` y `UPDATE` **solamente**. Si alguien borra filas con
un `DELETE` a mano en la base, **ATAK no se entera**: el equipo se queda inscrito
en el torneo sin ninguna fila local que lo respalde.

Es una razón más para la regla que el panel ya sigue: **nunca borrar, archivar**
(`archivado_en`), que es la operación que sí propaga. La tabla además no tiene
política de DELETE para la app, así que un borrado solo puede venir de alguien
entrando a la base directamente.
