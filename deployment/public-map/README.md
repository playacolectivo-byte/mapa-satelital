# Publicación gratuita del mapa

Este modo compila el mismo `components/explorer.tsx` y sus mismas capas. La interfaz, datos, fechas y fuentes se comparten con la versión Sites. No usa un proceso de aplicación, base de datos, claves privadas ni autenticación de ChatGPT para que los visitantes abran el mapa.

## Preparar y comprobar

```sh
npm run build:public
node scripts/check-data-delivery.mjs
node scripts/check-data-requests.mjs
node scripts/check-public-capacity.mjs
```

Salida: `dist/public-map`. Los originales de `public/data` se conservan. Las copias de entrega se generan en `public/data/runtime` con el SHA-256 de su contenido en el nombre y un índice trazable en `lib/generated/data-assets.json`.

## Publicar en Cloudflare Pages

Nombre propuesto: `mapa-satelital`, sujeto a disponibilidad durante la creación. No es un dominio reservado ni una URL ya activa. Alternativa descriptiva: `mapa-satelital-litoral`.

Se necesita una cuenta Cloudflare del propietario. Desde una sesión autorizada con Wrangler:

```sh
npx wrangler pages project create mapa-satelital --production-branch main
npx wrangler pages deploy dist/public-map --project-name mapa-satelital
```

No activar un plan de pago ni aceptar un nombre distinto como si estuviera reservado. Usar la URL devuelta por el proveedor, sin inventarla. El sitio estático utiliza el subdominio gratuito `pages.dev`; el nombre exacto se confirma al registrar el proyecto.

La compilación pública omite sólo las copias de las seis carpetas numéricas de caché de imágenes antiguas que ya no usa la interfaz. Sus originales permanecen intactos en `public/data/history`; se conservan los catálogos, metadatos y figuras de evidencia. La salida queda por debajo de 1,000 archivos y admite carga directa por ZIP en el panel. No subir `.openai`, el almacén científico privado, credenciales ni los ZIP de transferencia; publicar sólo la salida compilada.

## Operación

- HTML: comprobar la versión al abrir. JavaScript y datos con hash: caché de un año, URL nueva al cambiar el contenido.
- Las capas se preparan antes de publicar; el servidor no recalcula ciencia ni mezcla datos entre visitantes.
- Los reintentos del navegador tienen un límite y se cancelan al salir o agotar el tiempo.
- Esri y Sentinel siguen siendo proveedores externos. Su disponibilidad y los dispositivos de los visitantes no quedan validados por una prueba del alojamiento.
- Conservar la última versión funcional para revertir un despliegue. Verificar página, fecha y dos capas tras cada publicación pública.

Referencias oficiales consultadas el 23 de octubre de 2026:

- https://developers.cloudflare.com/pages/functions/pricing/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/workers/static-assets/headers/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://blog.cloudflare.com/big-ideas-on-pages/

Guía oficial de carga directa: https://developers.cloudflare.com/pages/get-started/direct-upload/
