# Licencias de datos e imagen

La licencia MIT del repositorio cubre el código y la documentación original de la aplicación. No cambia la titularidad ni las condiciones de los datos de terceros.

- **INEGI (S01, S02 y contexto S50):** libre uso con atribución, conservación de metadatos y declaración de transformaciones. Consulta `public/data/sources.json` y `public/data/metadata-evidence.zip`.
- **CONABIO / SMMM (S12 y S13):** los metadatos específicos registran CC BY 4.0 con atribución. Consulta las copias preservadas en `public/data/metadata-evidence.zip`.
- **Esri World Imagery:** se solicita directamente al proveedor durante la visualización; no se almacena en este repositorio. Deben mantenerse su atribución y condiciones. Consulta `public/data/imagery-sources.json`.

Los GeoJSON de `public/data/` son derivados de visualización con identificadores y hashes de procedencia. No deben presentarse como nuevas publicaciones institucionales ni como validación científica de límites o procesos litorales.

- **Esri World Imagery Wayback:** las imágenes se solicitan al servicio oficial durante la visualización, conservando atribución. El catálogo `public/data/history/wayback-chelem.json` conserva respuestas de metadatos, no imágenes. Condiciones: https://github.com/Esri/wayback-core#the-imagery. El software `@esri/wayback-core` tiene licencia Apache 2.0, que no se extiende a las imágenes.
- **Google Earth Timelapse:** visor de inserción oficial dentro de un iframe, con su atribución íntegra. Mosaicos anuales 1984–2022; CC BY 4.0 según https://developers.google.com/earth-engine/timelapse/about. Atribución: Google Earth Timelapse (Google, Landsat, Copernicus). No se extraen ni almacenan imágenes del archivo de escritorio Earth Pro.
