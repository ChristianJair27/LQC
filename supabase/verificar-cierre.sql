-- PRUEBAS del cierre de permisos. Cada bloque va en su transaccion y termina en ROLLBACK: no deja datos.
-- Correr ANTES y DESPUES de la migracion 20260926000200 y comparar. Sin ON_ERROR_STOP: los errores esperados se imprimen.
-- Simula el JWT con request.jwt.claims (en psql directo no hay JWT y auth.role() daria null).

\echo '=== T1 anon SELECT galeria_media -> DEBE FUNCIONAR (count)'
begin; set local role anon; select count(*) from public.galeria_media; rollback;

\echo '=== T2 anon INSERT galeria_media -> debe FALLAR (antes: violacion de RLS; despues: permission denied)'
begin; set local role anon; insert into public.galeria_media (storage_path, es_vertical) values ('t.webp', false); rollback;

\echo '=== T3a anon UPDATE galeria_media -> debe FALLAR'
begin; set local role anon; update public.galeria_media set titulo = 'x'; rollback;
\echo '=== T3b anon DELETE galeria_media -> debe FALLAR'
begin; set local role anon; delete from public.galeria_media; rollback;
\echo '=== T3c anon TRUNCATE galeria_media -> debe FALLAR (antes: TRUNCATE SI PASABA)'
begin; set local role anon; truncate public.galeria_media; rollback;

\echo '=== T4 authenticated CON JWT: insert, update, delete en galeria_media -> DEBEN FUNCIONAR'
begin; set local role authenticated; select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
insert into public.galeria_media (storage_path, es_vertical) values ('t.webp', false) returning storage_path;
update public.galeria_media set titulo = 'ok' where storage_path = 't.webp' returning titulo;
delete from public.galeria_media where storage_path = 't.webp' returning storage_path;
rollback;

\echo '=== T5a archivar equipo como authenticated -> el trigger DEBE seguir disparando (1 fila + NOTICE)'
begin; set local role authenticated; update public.equipos set archivado_en = now() where nombre = 'Prueba Gamma' returning nombre, (archivado_en is not null) as archivado; rollback;
\echo '=== T5b restaurar equipo archivado como authenticated -> DEBE FUNCIONAR (usa armar_roster_atak)'
begin; set local role authenticated; update public.equipos set archivado_en = null where nombre = 'Prueba Delta' returning nombre, (archivado_en is null) as restaurado; rollback;

\echo '=== T6 DELETE crudo sobre equipos -> la guardia DEBE seguir bloqueando'
begin; delete from public.equipos where nombre = 'Prueba Gamma'; rollback;

\echo '=== T7a anon ejecuta funcion de trigger -> debe FALLAR (antes: "trigger functions can only be called as triggers")'
begin; set local role anon; select public.notificar_atak(); rollback;
\echo '=== T7b anon ejecuta purgar_equipo -> debe FALLAR (permission denied)'
begin; set local role anon; select public.purgar_equipo(gen_random_uuid()); rollback;

\echo '=== T8a anon sigue pudiendo buscar_equipos -> DEBE FUNCIONAR'
begin; set local role anon; select count(*) from public.buscar_equipos('prueba'); rollback;
\echo '=== T8b anon registrar_jugador -> DEBE responder inscripciones_cerradas'
begin; set local role anon; select public.registrar_jugador('{}'::jsonb); rollback;
