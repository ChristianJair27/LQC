-- MIGRACION BASE (baseline) del esquema public de PRODUCCION, saneada para local.
-- DESVIACION LOCAL: en prod los objetos son de supabase_admin (superusuario); aqui son de postgres, porque el CLI migra como postgres. Version fiel a prod: fuera del repo.
-- Origen: pg_dump 15.8 --schema-only -n public de revolutionserv, 2026-09-26.
-- NO APLICAR EN PROD: prod YA tiene todo esto. Existe solo para reconstruir el entorno local.
-- Diferencias con prod: atak_enviar es no-op (sin secreto ni net.http_post); pg_trgm en public.
-- No contiene datos. Los cambios nuevos van en migraciones POSTERIORES a esta.
-- Ajuste local: CREATE SCHEMA IF NOT EXISTS public (en el Postgres local el esquema ya existe).

-- SANEADO para uso LOCAL. Generado de prod-public-schema.sql (pg_dump 15.8, solo esquema public).
-- Cambios respecto de prod: (1) atak_enviar es no-op y sin secreto; (2) pg_trgm en public.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS public;


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: armar_roster_atak(uuid); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.armar_roster_atak(p_equipo_id uuid) RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'equipo', e.nombre,
    'capitan_nombre', e.capitan_nombre,
    'capitan_celular', e.capitan_celular,
    'jugadores', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'gamertag', j.gamertag, 'nombre', j.nombre, 'correo', j.correo,
          'celular', j.celular, 'rol', j.rol,
          'escolaridad', j.escolaridad, 'municipio', j.municipio, 'genero', j.genero
        ) order by j.orden)
       from public.jugadores j where j.equipo_id = e.id),
      '[]'::jsonb)
  )
  from public.equipos e where e.id = p_equipo_id;
$$;


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER FUNCTION public.armar_roster_atak(p_equipo_id uuid) OWNER TO supabase_admin;

--
-- Name: atak_enviar(text, jsonb); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.atak_enviar(ruta text, cuerpo jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
begin
  -- LOCAL (Cabo B): NO-OP a proposito. La version de prod hace net.http_post hacia
  -- ATAK con un secreto. Aqui solo avisa, para poder comprobar que la RPC la llama.
  raise notice 'atak_enviar (no-op local): % %', ruta, left(cuerpo::text, 200);
end;
$$;


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER FUNCTION public.atak_enviar(ruta text, cuerpo jsonb) OWNER TO supabase_admin;

--
-- Name: buscar_equipos(text); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.buscar_equipos(termino text) RETURNS TABLE(id uuid, nombre text, jugadores integer)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  select e.id, e.nombre, count(j.id)::int
  from public.equipos e
  left join public.jugadores j on j.equipo_id = e.id
  where e.archivado_en is null
    and (
      e.nombre_norm like '%' || lower(btrim(termino)) || '%'
      or similarity(e.nombre_norm, lower(btrim(termino))) > 0.3
    )
  group by e.id, e.nombre
  order by similarity(e.nombre_norm, lower(btrim(termino))) desc
  limit 5;
$$;


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER FUNCTION public.buscar_equipos(termino text) OWNER TO supabase_admin;

--
-- Name: editar_jugador(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.editar_jugador(p_jugador_id uuid, p_cambios jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $_$
declare
  v_correo        text;
  v_nombre        text;
  v_toca_correo   boolean;
  v_toca_nombre   boolean;
  v_equipo        text;
  v_gamertag      text;
  v_correo_final  text;
  v_nombre_final  text;
begin
  -- 1. Solo estas dos claves son válidas. Cualquier otra => error explícito.
  if exists (
    select 1 from jsonb_object_keys(p_cambios) k
    where k not in ('correo', 'nombre')
  ) then
    return jsonb_build_object('ok', false, 'error', 'campo_no_permitido');
  end if;

  v_toca_correo := p_cambios ? 'correo';
  v_toca_nombre := p_cambios ? 'nombre';

  if not v_toca_correo and not v_toca_nombre then
    return jsonb_build_object('ok', false, 'error', 'sin_cambios');
  end if;

  -- 2. El jugador debe existir. Traemos llave ATAK (equipo + gamertag).
  select e.nombre, j.gamertag
    into v_equipo, v_gamertag
  from public.jugadores j
  join public.equipos e on e.id = j.equipo_id
  where j.id = p_jugador_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'jugador_no_encontrado');
  end if;

  -- 3. Validaciones de formato en el servidor.
  if v_toca_correo then
    v_correo := btrim(p_cambios->>'correo');
    if coalesce(v_correo, '') = '' then
      return jsonb_build_object('ok', false, 'error', 'correo_vacio');
    end if;
    if v_correo !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
      return jsonb_build_object('ok', false, 'error', 'correo_invalido');
    end if;
  end if;

  if v_toca_nombre then
    v_nombre := btrim(p_cambios->>'nombre');
    if coalesce(v_nombre, '') = '' then
      return jsonb_build_object('ok', false, 'error', 'nombre_vacio');
    end if;
  end if;

  -- 4. UPDATE aditivo: solo columnas tocadas (coalesce conserva lo no enviado).
  update public.jugadores
     set correo = case when v_toca_correo then v_correo else correo end,
         nombre = case when v_toca_nombre then v_nombre else nombre end
   where id = p_jugador_id
  returning correo, nombre into v_correo_final, v_nombre_final;

  -- 5. Re-sincroniza con ATAK. /register es upsert por gamertag (merge no
  --    destructivo del lado de ATAK). Mandamos llave + campos tocados.
  perform public.atak_enviar('/register', jsonb_build_object(
    'equipo',   v_equipo,
    'gamertag', v_gamertag,
    'nombre',   v_nombre_final,
    'correo',   v_correo_final
  ));

  return jsonb_build_object(
    'ok', true,
    'jugador_id', p_jugador_id,
    'correo', v_correo_final,
    'nombre', v_nombre_final
  );
end;
$_$;


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER FUNCTION public.editar_jugador(p_jugador_id uuid, p_cambios jsonb) OWNER TO supabase_admin;

--
-- Name: guardia_no_borrar_equipos(); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.guardia_no_borrar_equipos() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if current_setting('lqc.permitir_borrado', true) is distinct from 'si' then
    raise exception
      'DELETE bloqueado en equipos. Usa el archivado (archivado_en). Para borrado físico intencional, ejecuta primero: set lqc.permitir_borrado = ''si'';';
  end if;
  return old;
end;
$$;


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER FUNCTION public.guardia_no_borrar_equipos() OWNER TO supabase_admin;

--
-- Name: notificar_atak(); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.notificar_atak() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
begin
  if tg_op = 'INSERT' then
    perform public.atak_enviar('/register', jsonb_build_object('type', 'INSERT', 'record', to_jsonb(new)));
    return new;
  end if;

  if old.archivado_en is null and new.archivado_en is not null then
    perform public.atak_enviar('/unregister', jsonb_build_object('equipo', new.equipo, 'gamertag', new.gamertag));
  elsif old.archivado_en is not null and new.archivado_en is null then
    perform public.atak_enviar('/register', jsonb_build_object('type', 'INSERT', 'record', to_jsonb(new)));
  end if;
  return new;
end;
$$;


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER FUNCTION public.notificar_atak() OWNER TO supabase_admin;

--
-- Name: notificar_atak_equipo(); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.notificar_atak_equipo() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if old.archivado_en is null and new.archivado_en is not null then
    perform public.atak_enviar('/unregister', jsonb_build_object('equipo', new.nombre));
  elsif old.archivado_en is not null and new.archivado_en is null then
    perform public.atak_enviar('/register-team', public.armar_roster_atak(new.id));
  end if;
  return new;
end;
$$;


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER FUNCTION public.notificar_atak_equipo() OWNER TO supabase_admin;

--
-- Name: purgar_equipo(uuid); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.purgar_equipo(p_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_nombre text;
  v_archivado timestamptz;
  v_pagado boolean;
begin
  select nombre, archivado_en, pagado into v_nombre, v_archivado, v_pagado
  from public.equipos where id = p_id;

  if v_nombre is null then
    return 'No existe equipo con ese id.';
  end if;
  if v_archivado is null then
    raise exception 'No se puede purgar "%": primero archívalo (archivado_en está vacío).', v_nombre;
  end if;
  if v_pagado then
    raise exception 'No se puede purgar "%": tiene pago registrado. Los registros con pago no se borran.', v_nombre;
  end if;

  set local lqc.permitir_borrado = 'si';
  delete from public.equipos where id = p_id;
  return 'Equipo "' || v_nombre || '" purgado (borrado físico). Jugadores eliminados por cascade.';
end;
$$;


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER FUNCTION public.purgar_equipo(p_id uuid) OWNER TO supabase_admin;

--
-- Name: registrar_equipo(jsonb); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.registrar_equipo(datos jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  nuevo_id uuid;
  n_jugadores int;
  jugador jsonb;
  i int := 0;
begin
  if not coalesce((select inscripciones_abiertas from public.configuracion limit 1), false) then
    return jsonb_build_object('ok', false, 'error', 'inscripciones_cerradas');
  end if;

  n_jugadores := jsonb_array_length(coalesce(datos->'jugadores', '[]'::jsonb));

  if n_jugadores < 5 then
    return jsonb_build_object('ok', false, 'error', 'min_jugadores');
  end if;
  if n_jugadores > 7 then
    return jsonb_build_object('ok', false, 'error', 'max_jugadores');
  end if;
  if coalesce(btrim(datos->>'equipo'), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'falta_equipo');
  end if;

  begin
    insert into public.equipos (nombre, capitan_nombre, capitan_celular)
    values (btrim(datos->>'equipo'), btrim(datos->>'capitan_nombre'), btrim(datos->>'capitan_celular'))
    returning id into nuevo_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'equipo_duplicado');
  end;

  for jugador in select * from jsonb_array_elements(datos->'jugadores')
  loop
    i := i + 1;
    insert into public.jugadores (
      equipo_id, orden, gamertag, nombre, fecha_nacimiento,
      celular, correo, municipio, escolaridad, genero, rol
    ) values (
      nuevo_id, i,
      btrim(jugador->>'gamertag'), btrim(jugador->>'nombre'),
      (jugador->>'fecha_nacimiento')::date,
      btrim(jugador->>'celular'), btrim(jugador->>'correo'),
      btrim(jugador->>'municipio'), btrim(jugador->>'escolaridad'),
      btrim(jugador->>'genero'),
      coalesce(nullif(btrim(jugador->>'rol'), ''), case when i <= 5 then 'titular' else 'suplente' end)
    );
  end loop;

  perform public.atak_enviar('/register-team', public.armar_roster_atak(nuevo_id));

  return jsonb_build_object('ok', true);
end;
$$;


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER FUNCTION public.registrar_equipo(datos jsonb) OWNER TO supabase_admin;

--
-- Name: registrar_jugador(jsonb); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.registrar_jugador(datos jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_equipo_id uuid;
  v_nombre_equipo text;
  v_orden int;
  v_total int;
  v_equipos int;
begin
  if not coalesce((select inscripciones_abiertas from public.configuracion limit 1), false) then
    return jsonb_build_object('ok', false, 'error', 'inscripciones_cerradas');
  end if;

  if coalesce(btrim(datos->>'gamertag'), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'falta_gamertag');
  end if;

  v_equipo_id := nullif(datos->>'equipo_id', '')::uuid;

  if v_equipo_id is null then
    v_nombre_equipo := btrim(datos->>'equipo');
    if coalesce(v_nombre_equipo, '') = '' then
      return jsonb_build_object('ok', false, 'error', 'falta_equipo');
    end if;

    select count(*) into v_equipos
    from public.equipos where archivado_en is null;
    if v_equipos >= 32 then
      return jsonb_build_object('ok', false, 'error', 'torneo_lleno');
    end if;

    begin
      insert into public.equipos (nombre) values (v_nombre_equipo)
      returning id into v_equipo_id;
    exception when unique_violation then
      select id into v_equipo_id from public.equipos
      where nombre_norm = lower(btrim(v_nombre_equipo));
    end;
  end if;

  select count(*) into v_total from public.jugadores where equipo_id = v_equipo_id;
  if v_total >= 7 then
    return jsonb_build_object('ok', false, 'error', 'equipo_lleno');
  end if;

  if exists (
    select 1 from public.jugadores
    where equipo_id = v_equipo_id and lower(gamertag) = lower(btrim(datos->>'gamertag'))
  ) then
    return jsonb_build_object('ok', false, 'error', 'gamertag_duplicado');
  end if;

  v_orden := v_total + 1;

  insert into public.jugadores (
    equipo_id, orden, gamertag, nombre, fecha_nacimiento,
    celular, correo, municipio, escolaridad, genero, rol, es_capitan
  ) values (
    v_equipo_id, v_orden,
    btrim(datos->>'gamertag'), btrim(datos->>'nombre'),
    (datos->>'fecha_nacimiento')::date,
    btrim(datos->>'celular'), btrim(datos->>'correo'),
    btrim(datos->>'municipio'), btrim(datos->>'escolaridad'),
    btrim(datos->>'genero'),
    case when v_orden <= 5 then 'titular' else 'suplente' end,
    coalesce((datos->>'es_capitan')::boolean, false)
  );

  perform public.sincronizar_capitan(v_equipo_id);

  perform public.atak_enviar('/register', jsonb_build_object(
    'equipo', (select nombre from public.equipos where id = v_equipo_id),
    'gamertag', btrim(datos->>'gamertag'),
    'nombre', btrim(datos->>'nombre'),
    'correo', btrim(datos->>'correo'),
    'celular', btrim(datos->>'celular'),
    'municipio', btrim(datos->>'municipio'),
    'escolaridad', btrim(datos->>'escolaridad'),
    'genero', btrim(datos->>'genero')
  ));

  return jsonb_build_object('ok', true, 'equipo_id', v_equipo_id, 'orden', v_orden);
end;
$$;


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER FUNCTION public.registrar_jugador(datos jsonb) OWNER TO supabase_admin;

--
-- Name: sincronizar_capitan(uuid); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.sincronizar_capitan(p_equipo_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_cap record;
begin
  select gamertag, celular into v_cap
  from public.jugadores
  where equipo_id = p_equipo_id
  order by es_capitan desc, orden asc
  limit 1;

  update public.equipos
  set capitan_nombre = v_cap.gamertag, capitan_celular = v_cap.celular
  where id = p_equipo_id;
end;
$$;


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER FUNCTION public.sincronizar_capitan(p_equipo_id uuid) OWNER TO supabase_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: configuracion; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.configuracion (
    id boolean DEFAULT true NOT NULL,
    inscripciones_abiertas boolean DEFAULT false NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT configuracion_una_fila CHECK (id)
);


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER TABLE public.configuracion OWNER TO supabase_admin;

--
-- Name: equipos; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.equipos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    nombre_norm text GENERATED ALWAYS AS (lower(btrim(nombre))) STORED,
    capitan_nombre text,
    capitan_celular text,
    pagado boolean DEFAULT false NOT NULL,
    pagado_en timestamp with time zone,
    notas text,
    archivado_en timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    capitan_gamertag text
);


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER TABLE public.equipos OWNER TO supabase_admin;

--
-- Name: galeria_media; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.galeria_media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    storage_path text NOT NULL,
    titulo text,
    tipo text DEFAULT 'foto'::text NOT NULL,
    es_vertical boolean DEFAULT false NOT NULL,
    ancho integer,
    alto integer,
    orden integer DEFAULT 0 NOT NULL,
    subido_por uuid,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT galeria_media_tipo_check CHECK ((tipo = ANY (ARRAY['foto'::text, 'video'::text])))
);


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER TABLE public.galeria_media OWNER TO supabase_admin;

--
-- Name: inscripciones; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.inscripciones (
    id bigint NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    equipo text NOT NULL,
    gamertag text NOT NULL,
    nombre text NOT NULL,
    fecha_nacimiento date NOT NULL,
    celular text NOT NULL,
    escolaridad text NOT NULL,
    municipio text NOT NULL,
    localidad text NOT NULL,
    correo text NOT NULL,
    genero text NOT NULL,
    capitan_nombre text NOT NULL,
    capitan_celular text NOT NULL,
    pagado boolean DEFAULT false NOT NULL,
    pagado_en timestamp with time zone,
    notas text,
    archivado_en timestamp with time zone
);


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER TABLE public.inscripciones OWNER TO supabase_admin;

--
-- Name: inscripciones_id_seq; Type: SEQUENCE; Schema: public; Owner: supabase_admin
--

ALTER TABLE public.inscripciones ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.inscripciones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: jugadores; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.jugadores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    equipo_id uuid NOT NULL,
    orden integer NOT NULL,
    gamertag text NOT NULL,
    nombre text NOT NULL,
    fecha_nacimiento date NOT NULL,
    celular text NOT NULL,
    correo text NOT NULL,
    municipio text NOT NULL,
    rol text DEFAULT 'titular'::text NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    escolaridad text NOT NULL,
    genero text NOT NULL,
    es_capitan boolean DEFAULT false NOT NULL,
    CONSTRAINT jugadores_rol_check CHECK ((rol = ANY (ARRAY['titular'::text, 'suplente'::text])))
);


-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER TABLE public.jugadores OWNER TO supabase_admin;

--
-- Name: configuracion configuracion_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.configuracion
    ADD CONSTRAINT configuracion_pkey PRIMARY KEY (id);


--
-- Name: equipos equipos_nombre_norm_key; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_nombre_norm_key UNIQUE (nombre_norm);


--
-- Name: equipos equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.equipos
    ADD CONSTRAINT equipos_pkey PRIMARY KEY (id);


--
-- Name: galeria_media galeria_media_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.galeria_media
    ADD CONSTRAINT galeria_media_pkey PRIMARY KEY (id);


--
-- Name: galeria_media galeria_media_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.galeria_media
    ADD CONSTRAINT galeria_media_storage_path_key UNIQUE (storage_path);


--
-- Name: inscripciones inscripciones_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_pkey PRIMARY KEY (id);


--
-- Name: jugadores jugadores_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.jugadores
    ADD CONSTRAINT jugadores_pkey PRIMARY KEY (id);


--
-- Name: galeria_media_orden_idx; Type: INDEX; Schema: public; Owner: supabase_admin
--

CREATE INDEX galeria_media_orden_idx ON public.galeria_media USING btree (orden, creado_en DESC);


--
-- Name: idx_inscripciones_archivado; Type: INDEX; Schema: public; Owner: supabase_admin
--

CREATE INDEX idx_inscripciones_archivado ON public.inscripciones USING btree (archivado_en);


--
-- Name: inscripciones_equipo_idx; Type: INDEX; Schema: public; Owner: supabase_admin
--

CREATE INDEX inscripciones_equipo_idx ON public.inscripciones USING btree (equipo);


--
-- Name: equipos trg_atak_equipo; Type: TRIGGER; Schema: public; Owner: supabase_admin
--

CREATE TRIGGER trg_atak_equipo AFTER UPDATE OF archivado_en ON public.equipos FOR EACH ROW WHEN ((old.archivado_en IS DISTINCT FROM new.archivado_en)) EXECUTE FUNCTION public.notificar_atak_equipo();


--
-- Name: equipos trg_guardia_no_borrar_equipos; Type: TRIGGER; Schema: public; Owner: supabase_admin
--

CREATE TRIGGER trg_guardia_no_borrar_equipos BEFORE DELETE ON public.equipos FOR EACH ROW EXECUTE FUNCTION public.guardia_no_borrar_equipos();


--
-- Name: inscripciones trg_notificar_atak; Type: TRIGGER; Schema: public; Owner: supabase_admin
--

CREATE TRIGGER trg_notificar_atak AFTER INSERT ON public.inscripciones FOR EACH ROW EXECUTE FUNCTION public.notificar_atak();


--
-- Name: inscripciones trg_notificar_atak_archivado; Type: TRIGGER; Schema: public; Owner: supabase_admin
--

CREATE TRIGGER trg_notificar_atak_archivado AFTER UPDATE OF archivado_en ON public.inscripciones FOR EACH ROW WHEN ((old.archivado_en IS DISTINCT FROM new.archivado_en)) EXECUTE FUNCTION public.notificar_atak();


--
-- Name: galeria_media galeria_media_subido_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.galeria_media
    ADD CONSTRAINT galeria_media_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: jugadores jugadores_equipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.jugadores
    ADD CONSTRAINT jugadores_equipo_id_fkey FOREIGN KEY (equipo_id) REFERENCES public.equipos(id) ON DELETE CASCADE;


--
-- Name: equipos Solo admins actualizan equipos; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY "Solo admins actualizan equipos" ON public.equipos FOR UPDATE TO authenticated USING (true);


--
-- Name: jugadores Solo admins actualizan jugadores; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY "Solo admins actualizan jugadores" ON public.jugadores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: equipos Solo admins leen equipos; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY "Solo admins leen equipos" ON public.equipos FOR SELECT TO authenticated USING (true);


--
-- Name: jugadores Solo admins leen jugadores; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY "Solo admins leen jugadores" ON public.jugadores FOR SELECT TO authenticated USING (true);


--
-- Name: inscripciones Solo admins pueden actualizar; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY "Solo admins pueden actualizar" ON public.inscripciones FOR UPDATE TO authenticated USING (true);


--
-- Name: inscripciones Solo admins pueden ver inscripciones; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY "Solo admins pueden ver inscripciones" ON public.inscripciones FOR SELECT TO authenticated USING (true);


--
-- Name: configuracion; Type: ROW SECURITY; Schema: public; Owner: supabase_admin
--

ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

--
-- Name: equipos; Type: ROW SECURITY; Schema: public; Owner: supabase_admin
--

ALTER TABLE public.equipos ENABLE ROW LEVEL SECURITY;

--
-- Name: galeria_media galeria insert authenticated; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY "galeria insert authenticated" ON public.galeria_media FOR INSERT TO authenticated WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: galeria_media galeria lectura publica; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY "galeria lectura publica" ON public.galeria_media FOR SELECT TO authenticated, anon USING (true);


--
-- Name: galeria_media; Type: ROW SECURITY; Schema: public; Owner: supabase_admin
--

ALTER TABLE public.galeria_media ENABLE ROW LEVEL SECURITY;

--
-- Name: galeria_media galeria_media delete authenticated; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY "galeria_media delete authenticated" ON public.galeria_media FOR DELETE TO authenticated USING ((auth.role() = 'authenticated'::text));


--
-- Name: galeria_media galeria_media update authenticated; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY "galeria_media update authenticated" ON public.galeria_media FOR UPDATE TO authenticated USING ((auth.role() = 'authenticated'::text)) WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: inscripciones; Type: ROW SECURITY; Schema: public; Owner: supabase_admin
--

ALTER TABLE public.inscripciones ENABLE ROW LEVEL SECURITY;

--
-- Name: jugadores; Type: ROW SECURITY; Schema: public; Owner: supabase_admin
--

ALTER TABLE public.jugadores ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION armar_roster_atak(p_equipo_id uuid); Type: ACL; Schema: public; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION public.armar_roster_atak(p_equipo_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.armar_roster_atak(p_equipo_id uuid) TO postgres;
GRANT ALL ON FUNCTION public.armar_roster_atak(p_equipo_id uuid) TO service_role;


--
-- Name: FUNCTION atak_enviar(ruta text, cuerpo jsonb); Type: ACL; Schema: public; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION public.atak_enviar(ruta text, cuerpo jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.atak_enviar(ruta text, cuerpo jsonb) TO postgres;
GRANT ALL ON FUNCTION public.atak_enviar(ruta text, cuerpo jsonb) TO service_role;


--
-- Name: FUNCTION buscar_equipos(termino text); Type: ACL; Schema: public; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION public.buscar_equipos(termino text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.buscar_equipos(termino text) TO postgres;
GRANT ALL ON FUNCTION public.buscar_equipos(termino text) TO anon;
GRANT ALL ON FUNCTION public.buscar_equipos(termino text) TO authenticated;
GRANT ALL ON FUNCTION public.buscar_equipos(termino text) TO service_role;


--
-- Name: FUNCTION editar_jugador(p_jugador_id uuid, p_cambios jsonb); Type: ACL; Schema: public; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION public.editar_jugador(p_jugador_id uuid, p_cambios jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.editar_jugador(p_jugador_id uuid, p_cambios jsonb) TO postgres;
GRANT ALL ON FUNCTION public.editar_jugador(p_jugador_id uuid, p_cambios jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.editar_jugador(p_jugador_id uuid, p_cambios jsonb) TO service_role;


--
-- Name: FUNCTION guardia_no_borrar_equipos(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.guardia_no_borrar_equipos() TO postgres;
GRANT ALL ON FUNCTION public.guardia_no_borrar_equipos() TO anon;
GRANT ALL ON FUNCTION public.guardia_no_borrar_equipos() TO authenticated;
GRANT ALL ON FUNCTION public.guardia_no_borrar_equipos() TO service_role;


--
-- Name: FUNCTION notificar_atak(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.notificar_atak() TO postgres;
GRANT ALL ON FUNCTION public.notificar_atak() TO anon;
GRANT ALL ON FUNCTION public.notificar_atak() TO authenticated;
GRANT ALL ON FUNCTION public.notificar_atak() TO service_role;


--
-- Name: FUNCTION notificar_atak_equipo(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.notificar_atak_equipo() TO postgres;
GRANT ALL ON FUNCTION public.notificar_atak_equipo() TO anon;
GRANT ALL ON FUNCTION public.notificar_atak_equipo() TO authenticated;
GRANT ALL ON FUNCTION public.notificar_atak_equipo() TO service_role;


--
-- Name: FUNCTION purgar_equipo(p_id uuid); Type: ACL; Schema: public; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION public.purgar_equipo(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.purgar_equipo(p_id uuid) TO postgres;
GRANT ALL ON FUNCTION public.purgar_equipo(p_id uuid) TO service_role;


--
-- Name: FUNCTION registrar_equipo(datos jsonb); Type: ACL; Schema: public; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION public.registrar_equipo(datos jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_equipo(datos jsonb) TO postgres;
GRANT ALL ON FUNCTION public.registrar_equipo(datos jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_equipo(datos jsonb) TO service_role;


--
-- Name: FUNCTION registrar_jugador(datos jsonb); Type: ACL; Schema: public; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION public.registrar_jugador(datos jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.registrar_jugador(datos jsonb) TO postgres;
GRANT ALL ON FUNCTION public.registrar_jugador(datos jsonb) TO anon;
GRANT ALL ON FUNCTION public.registrar_jugador(datos jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_jugador(datos jsonb) TO service_role;


--
-- Name: FUNCTION sincronizar_capitan(p_equipo_id uuid); Type: ACL; Schema: public; Owner: supabase_admin
--

REVOKE ALL ON FUNCTION public.sincronizar_capitan(p_equipo_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.sincronizar_capitan(p_equipo_id uuid) TO postgres;
GRANT ALL ON FUNCTION public.sincronizar_capitan(p_equipo_id uuid) TO service_role;


--
-- Name: TABLE configuracion; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON TABLE public.configuracion TO postgres;
GRANT ALL ON TABLE public.configuracion TO service_role;


--
-- Name: TABLE equipos; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON TABLE public.equipos TO postgres;
GRANT SELECT,UPDATE ON TABLE public.equipos TO authenticated;
GRANT ALL ON TABLE public.equipos TO service_role;


--
-- Name: TABLE galeria_media; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON TABLE public.galeria_media TO postgres;
GRANT ALL ON TABLE public.galeria_media TO anon;
GRANT ALL ON TABLE public.galeria_media TO authenticated;
GRANT ALL ON TABLE public.galeria_media TO service_role;


--
-- Name: TABLE inscripciones; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON TABLE public.inscripciones TO postgres;
GRANT ALL ON TABLE public.inscripciones TO service_role;


--
-- Name: SEQUENCE inscripciones_id_seq; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON SEQUENCE public.inscripciones_id_seq TO postgres;
GRANT ALL ON SEQUENCE public.inscripciones_id_seq TO anon;
GRANT ALL ON SEQUENCE public.inscripciones_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.inscripciones_id_seq TO service_role;


--
-- Name: TABLE jugadores; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON TABLE public.jugadores TO postgres;
GRANT SELECT ON TABLE public.jugadores TO authenticated;
GRANT ALL ON TABLE public.jugadores TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES  TO postgres;
-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES  TO anon;
-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES  TO authenticated;
-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS  TO postgres;
-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES  TO postgres;
-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES  TO service_role;


--
-- PostgreSQL database dump complete
--

