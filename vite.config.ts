// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'   // ← importante

/* Variables que el formulario de /registro necesita para poder enviar datos. */
const VARIABLES_SUPABASE = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']

/* Config en forma de función para recibir `mode` y poder leer el .env con
   `loadEnv`. Vite las inyecta en el bundle en tiempo de build: si faltan acá,
   el bundle sale sin credenciales y ya no hay forma de arreglarlo en runtime.

   Es un aviso y NO un fallo a propósito: `npm run build` es la verificación
   obligatoria antes de cada commit y hoy nadie tiene un `.env` local, así que
   cortar el build rompería el flujo de trabajo entero. El cliente
   (`src/lib/supabase.ts`) degrada solo: devuelve `null` y el formulario muestra
   su mensaje genérico de error, sin tumbar la página.

   Este archivo está fuera de `src/`, así que el `console.warn` no rompe el
   invariante de cero `console.*` del código de la app. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const faltantes = VARIABLES_SUPABASE.filter((nombre) => !env[nombre])

  if (faltantes.length > 0) {
    console.warn(
      `\n[LQC] Aviso: faltan variables de entorno (${faltantes.join(', ')}).\n` +
        '      El formulario de /registro no va a poder guardar inscripciones\n' +
        '      con este build. Copia .env.example como .env y completa la URL\n' +
        '      del proyecto y la clave anon/publishable de Supabase.\n'
    )
  }

  return {
    plugins: [
      react(),
      tailwindcss(),           // ← este plugin hace la magia
    ],
  }
})
