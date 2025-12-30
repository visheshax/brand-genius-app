# frontend/Dockerfile

# --- Stage 1: Build the React App ---
    FROM node:18-alpine as build
    WORKDIR /app
    COPY package.json package-lock.json ./
    RUN npm install
    COPY . .
    # This creates the 'dist' folder with your static website
    RUN npm run build
    
    # --- Stage 2: Serve with Nginx ---
    # We use a lightweight web server to serve the static files
    FROM nginx:alpine
    COPY --from=build /app/dist /usr/share/nginx/html
    
    # Nginx needs to listen on port 8080 for Cloud Run
    COPY nginx.conf /etc/nginx/conf.d/default.conf
    EXPOSE 8080
    CMD ["nginx", "-g", "daemon off;"]