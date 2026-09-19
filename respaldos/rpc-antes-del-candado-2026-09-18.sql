-- Respaldo previo al candado de inscripciones — 2026-09-18
-- Estado de registrar_jugador y registrar_equipo ANTES de agregar la
-- verificación contra public.configuracion.

CREATE OR REPLACE FUNCTION public.registrar_jugador(datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_equipo_id uuid;
  v_nombre_equipo text;
  v_orden int;
  v_total int;
  v_equipos int;
begin
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
$function$;

CREATE OR REPLACE FUNCTION public.registrar_equipo(datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  nuevo_id uuid;
  n_jugadores int;
  jugador jsonb;
  i int := 0;
begin
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
$function$;
