-- SOLO LECTURA. Superficie de permisos del esquema public. Sin datos ni secretos.
\echo '=== A. EXECUTE por funcion (sin las de extensiones)'
select p.proname, p.prosecdef as secdef,
  has_function_privilege('anon', p.oid, 'execute') as anon,
  has_function_privilege('authenticated', p.oid, 'execute') as auth,
  has_function_privilege('service_role', p.oid, 'execute') as svc,
  (p.proconfig is not null) as fija_search_path,
  pg_get_userbyid(p.proowner) as dueno
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by 1;
\echo '=== B. privilegios en tablas'
select c.relname, r.rol,
  array_to_string(array(select pr from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) pr
    where has_table_privilege(r.rol, c.oid, pr)), ',') as privs
from pg_class c join pg_namespace n on n.oid = c.relnamespace
cross join (values ('anon'),('authenticated'),('service_role')) r(rol)
where n.nspname = 'public' and c.relkind = 'r'
order by 1, 2;
\echo '=== C1. RLS por tabla'
select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forzada
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by 1;
\echo '=== C2. policies'
select tablename, policyname, cmd, roles::text as roles, qual, with_check
from pg_policies where schemaname = 'public' order by 1, 2;
\echo '=== D. triggers'
select event_object_table as tabla, trigger_name, action_timing as cuando, event_manipulation as evento
from information_schema.triggers where trigger_schema = 'public' order by 1, 2, 4;
\echo '=== E. privilegios por defecto'
select pg_get_userbyid(d.defaclrole) as rol, coalesce(n.nspname, '(global)') as esquema,
  d.defaclobjtype as tipo, d.defaclacl::text as acl
from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace order by 1, 2, 3;
