# Etapa 1: Build de la app React/Vite
FROM node:20-alpine AS builder

WORKDIR /app

# Copia solo lo necesario para instalar dependencias (mejora cache)
COPY package*.json ./
RUN npm ci  # Usa ci para builds reproducibles

# Copia el resto del código
COPY . .

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