-- CIERRE DE PERMISOS (2026-09-26). A DIFERENCIA de las dos migraciones anteriores, esta SI va a PROD.
-- Flujo: probar en local (supabase db reset + supabase/verificar-cierre.sql) -> aplicar a mano en prod,
-- en UNA sola corrida del SQL editor -> volver a medir con supabase/verificar-superficie.sql.
--
-- 1) galeria_media: anon solo necesita SELECT (la galeria publica lee con la anon key). Las escrituras ya
--    las contenia la RLS; TRUNCATE/REFERENCES/TRIGGER ni siquiera pasan por RLS. authenticated NO se toca.
-- 2) Funciones de trigger (notificar_atak, notificar_atak_equipo, guardia_no_borrar_equipos): no son llamables
--    a mano, y PostgreSQL solo exige EXECUTE al CREAR el trigger, no al dispararlo. Se les quita a public,
--    anon y authenticated; postgres y service_role conservan el suyo.

revoke insert, update, delete, truncate, references, trigger on table public.galeria_media from anon;

revoke all on function public.notificar_atak()            from public, anon, authenticated;
revoke all on function public.notificar_atak_equipo()     from public, anon, authenticated;
revoke all on function public.guardia_no_borrar_equipos() from public, anon, authenticated;

-- ROLLBACK (solo si algo falla; ejecutar como dueno):
--   grant insert, update, delete, truncate, references, trigger on table public.galeria_media to anon;
--   grant execute on function public.notificar_atak()            to public, anon, authenticated;
--   grant execute on function public.notificar_atak_equipo()     to public, anon, authenticated;
--   grant execute on function public.guardia_no_borrar_equipos() to public, anon, authenticated;
