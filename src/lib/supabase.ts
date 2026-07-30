/* Cliente de Supabase — único punto de acceso a la base desde el navegador.

   Las credenciales llegan por variables de entorno de Vite (`VITE_*`), que se
   inyectan en tiempo de build. Ver `.env.example` en la raíz del repo.

   SEGURIDAD: acá va solo la clave anon/publishable. Toda variable `VITE_*`
   termina empaquetada en el bundle del navegador, o sea que es pública por
   definición: la anon key está diseñada para eso y es RLS quien la contiene.
   La `service_role` saltea RLS por completo y NUNCA debe llegar al cliente. */

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

/* El tipo exportado, no `ReturnType<typeof createClient>`: `createClient` está
   declarado como const de tipo función genérica, así que `ReturnType` instancia
   `Database` con su restricción (`unknown`) en vez de su default (`any`) y toda
   tabla termina resolviendo a `never` — el insert pediría un `never[]`. */
type ClienteSupabase = SupabaseClient

const url = import.meta.env.VITE_SUPABASE_URL
const claveAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

/* Instancia memoizada: `createClient` corre una sola vez, no en cada envío. */
let cliente: ClienteSupabase | null = null

/* CONTRATO: esta función NUNCA lanza. Devuelve el cliente, o `null` si el build
   salió sin credenciales o con credenciales inválidas.

   El contrato existe porque `App.tsx` no tiene ErrorBoundary y `<Suspense>`
   solo captura promesas pendientes, no errores: un throw acá o al evaluar este
   módulo hace que React desmonte el root entero y el sitio se va a negro
   completo —header y footer incluidos—, no solo /registro. Y como el
   `Dockerfile` solo recibe las `VITE_*` si quien despliega pasa los
   `--build-arg`, un build que los omita cae exactamente en ese escenario.

   Por eso el `try/catch`: el guard de arriba no alcanza, porque `createClient`
   valida la URL y lanza por su cuenta. Casos reales verificados contra la
   librería —pegar el host sin `https://` en el panel del hosting es el más
   probable—:
     'ejemplo.supabase.co'         → Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.
     'https://ejemplo supabase.co' → Invalid supabaseUrl: Provided URL is malformed.
     '   '                         → supabaseUrl is required.   (es truthy: pasa el guard)
   Una URL malformada se trata igual que una credencial ausente.

   Quien llama trata el `null` como un fallo de envío más y muestra el mensaje
   genérico de error, así la página sigue en pie con los datos de contacto y de
   pago a la vista. El aviso para quien desarrolla o despliega está en
   `vite.config.ts`, que avisa por consola durante el build. */
export function obtenerSupabase(): ClienteSupabase | null {
  if (cliente) return cliente
  if (!url || !claveAnon) return null

  try {
    cliente = createClient(url, claveAnon, {
      /* persistSession + autoRefreshToken: el panel de admin (`/admin`) necesita
         mantener la sesión entre recargas y refrescar el token antes de que
         venza. Las dos RPC anónimas de `/registro` —`buscar_equipos` y
         `registrar_jugador`— no se ven afectadas: persistir la sesión no cambia
         el request, y sin sesión se sigue pudiendo llamar a las dos, que corren
         con permisos propios (ver AGENTS.md).
         detectSessionInUrl se queda en false: el panel entra solo con
         correo+contraseña, no hay OAuth ni magic links que dejen el token en el
         hash de la URL para parsear al cargar. */
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
  } catch {
    /* Sin logs: el invariante de cero salida por consola vale para todo `src/`.
       El aviso equivalente lo da `vite.config.ts` en tiempo de build. */
    return null
  }

  return cliente
}
