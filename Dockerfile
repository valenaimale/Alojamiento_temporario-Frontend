FROM nginx:alpine
COPY docker/replica.conf /etc/nginx/conf.d/default.conf
COPY vistas /usr/share/nginx/html/vistas
COPY estilos /usr/share/nginx/html/estilos
COPY funcionalidades /usr/share/nginx/html/funcionalidades
COPY imagenes /usr/share/nginx/html/imagenes
