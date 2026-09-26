-- SEED LOCAL (Cabo B). DATOS 100% FICTICIOS. NUNCA copiar datos reales de prod aqui:
-- entre los inscritos hay menores y datos personales (nombre, correo, celular, nacimiento).
-- Se ejecuta con "npx supabase db reset", como postgres, DESPUES de las migraciones.
--
-- Pasa por la RPC real registrar_jugador (igual que el sitio) para ejercitar la logica de
-- roster/capitan/candado. atak_enviar es no-op en local: solo emite un NOTICE.
-- Estado final: inscripciones CERRADAS (como prod hoy).

insert into public.configuracion (id, inscripciones_abiertas) values (true, false)
on conflict (id) do nothing;

do $seed$
declare
  t record;
  i int;
  v_equipo_id uuid;
  r jsonb;
begin
  update public.configuracion set inscripciones_abiertas = true, actualizado_en = now();

  for t in
    select * from (values
      ('Prueba Alfa',    'alfa',    5),   -- roster minimo completo
      ('Prueba Beta',    'beta',    7),   -- lleno (5 titulares + 2 suplentes): prueba equipo_lleno
      ('Prueba Gamma',   'gamma',   3),   -- incompleto
      ('Prueba Delta',   'delta',   5),   -- se archiva abajo
      ('Prueba Epsilon', 'epsilon', 5)    -- se marca pagado abajo
    ) as x(nombre, prefijo, jugadores)
  loop
    v_equipo_id := null;
    for i in 1 .. t.jugadores loop
      r := public.registrar_jugador(jsonb_strip_nulls(jsonb_build_object(
        'equipo',           case when v_equipo_id is null then t.nombre end,
        'equipo_id',        v_equipo_id,
        'gamertag',         t.prefijo || i || '#0000',
        'nombre',           'Jugador Prueba ' || initcap(t.prefijo) || ' ' || i,
        'fecha_nacimiento', '2000-01-01',
        'celular',          '44200000' || lpad((i + length(t.prefijo))::text, 2, '0'),
        'correo',           t.prefijo || i || '@ejemplo.invalid',
        'municipio',        case when i % 2 = 0 then 'Corregidora' else 'Queretaro' end,
        'escolaridad',      'Licenciatura',
        'genero',           'Otro',
        'es_capitan',       (i = 1)
      )));
      if not coalesce((r->>'ok')::boolean, false) then
        raise exception 'seed: registrar_jugador fallo en % #%: %', t.nombre, i, r;
      end if;
      v_equipo_id := (r->>'equipo_id')::uuid;
    end loop;
  end loop;

  update public.equipos set pagado = true, pagado_en = now() where nombre = 'Prueba Epsilon';
  update public.equipos set archivado_en = now()             where nombre = 'Prueba Delta';

  update public.configuracion set inscripciones_abiertas = false, actualizado_en = now();
end
$seed$;
