# Etapa 1: Build de la app React/Vite
FROM node:22-alpine AS builder

WORKDIR /app

# Copia solo lo necesario para instalar dependencias (mejora cache)
COPY package*.json ./
RUN npm ci  # Usa ci para builds reproducibles

# Copia el resto del código
COPY . .

# Credenciales de Supabase. Van acá porque Vite las inyecta en el bundle en
# TIEMPO DE BUILD: sin ellas el build igual pasa (0 errores, 0 warnings) pero el
# formulario de /registro no guarda nada. La única señal es el aviso "[LQC]" que
# imprime vite.config.ts. Los ARG valen solo en la etapa donde se declaran, por
# eso están en `builder` y no arriba del FROM. El ENV es necesario porque Vite
# las lee de process.env vía loadEnv, sin necesidad de generar un .env.
#
# SEGURIDAD: acá va SOLO la clave anon/publishable, NUNCA la service_role. Toda
# variable VITE_* termina empaquetada en el bundle que se descarga el navegador
# y, además, los build args quedan en el historial de la etapa builder (no en la
# imagen final, que parte de un FROM limpio — salvo que alguien publique
# `--target builder`). La anon key está diseñada para ser pública y es RLS quien
# la contiene; la service_role saltea RLS por completo.
#
# BuildKit avisa "SecretsUsedInArgOrEnv" por el nombre `*_KEY`. Acá es un falso
# positivo esperado y NO se silencia con `# check=skip=...`: esa misma regla es
# la que gritaría si alguien agregara la service_role.
#
#   docker build \
#     --build-arg VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co \
#     --build-arg VITE_SUPABASE_ANON_KEY=tu-clave-anon \
#     -t lqc-web .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Build la app (solo vite build, sin tsc si no lo necesitas)
RUN npm run build

# Etapa 2: Servir con Nginx (ligero y rápido)
FROM nginx:alpine

# Copia los archivos estáticos generados
COPY --from=builder /app/dist /usr/share/nginx/html

# Config básica de Nginx para SPA (redirect todas las rutas a index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]