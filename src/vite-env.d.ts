/// <reference types="vite/client" />

/* Variables de entorno propias del proyecto.

   `vite/client` declara `ImportMetaEnv` con un index signature (`Record<string,
   any>`), así que sin esta ampliación `import.meta.env.VITE_SUPABASE_URL`
   compila pero queda tipado como `any`. La interfaz se fusiona con la de Vite
   (declaration merging), por eso no hace falta redeclarar `ImportMeta`.

   Van como `string | undefined` a propósito: no hay `.env` en el repo y en
   Docker las `VITE_*` dependen de que quien despliega pase los `--build-arg`,
   así que un build sin credenciales sigue siendo un caso real y frecuente. Tiparlas como `string` a secas sería mentirle al
   compilador justo en el invariante que se rompe en producción; con
   `| undefined` el guard de `src/lib/supabase.ts` estrecha el tipo solo, sin
   `!` ni casts. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string | undefined
  readonly VITE_SUPABASE_ANON_KEY: string | undefined
}
