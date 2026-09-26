-- PERMISOS como prod (2026-09-26). SOLO LOCAL, igual que la migracion base: NO aplicar en prod.
-- DESVIACION LOCAL: en prod los objetos son de supabase_admin (superusuario); aqui son de postgres, porque el CLI migra como postgres. Version fiel a prod: fuera del repo.
--
-- Por que existe: pg_dump solo sabe expresar permisos que EXISTEN, no los que FALTAN. La imagen
-- de Postgres local trae privilegios por defecto que dan todo a anon/authenticated en cada objeto
-- nuevo, y el dump de prod no incluye los REVOKE que en prod los quitaron (2026-09-18 y 2026-09-25).
-- Sin esto el local deja a anon ejecutar las 11 funciones y tocar las 5 tablas.
--
-- Fuente: la foto de permisos de prod (q-superficie.sql, 2026-09-26), NO la documentacion.
-- Se reproduce prod TAL CUAL, incluida su deuda conocida: anon conserva privilegios de escritura
-- sobre galeria_media y EXECUTE sobre 3 funciones de trigger. Se corrigen en migraciones aparte.

-- 1. Privilegios por defecto: objetos NUEVOS de public ya no nacen abiertos a anon/authenticated.
--    (Las secuencias se dejan como estaban, a proposito, igual que en prod.)
alter default privileges for role postgres       in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres       in schema public revoke all on functions from anon, authenticated;
-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] alter default privileges for role supabase_admin in schema public revoke all on tables    from anon, authenticated;
-- [LOCAL: omitido, "supabase db reset" corre como postgres y no puede] alter default privileges for role supabase_admin in schema public revoke all on functions from anon, authenticated;

-- 2. Tablas. galeria_media NO se toca (en prod anon/authenticated conservan todo; RLS lo contiene).
revoke all on table public.configuracion, public.equipos, public.inscripciones, public.jugadores
  from anon, authenticated;
grant select, update on table public.equipos    to authenticated;
grant select         on table public.jugadores  to authenticated;

-- 3. Funciones (EXECUTE). Se resuelven por nombre para no depender de las firmas.
do $$
declare f regprocedure;
begin
  -- Cerradas a todo menos postgres/service_role.
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname in ('armar_roster_atak', 'atak_enviar', 'purgar_equipo', 'sincronizar_capitan')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  -- Solo con sesion (authenticated): no anon.
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('editar_jugador', 'registrar_equipo')
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- buscar_equipos y registrar_jugador quedan publicas; las 3 funciones de trigger quedan como en prod.
end
$$;
