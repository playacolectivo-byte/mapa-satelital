# Menú panorámico y páginas municipales · 4 de noviembre de 2026

La entrada pública `/` es una panorámica ligera con 13 enlaces municipales. Cada enlace abre una página real `/municipio/<municipio>/`, compatible con recarga y con Atrás/Adelante del navegador. El visor compartido se descarga sólo al entrar en una página municipal; volver al menú libera su estado. La barra superior permite regresar, cambiar de municipio o encuadrar el municipio actual.

## Carga y navegación

Los archivos de `public/data/municipalities/` son derivados. `scripts/build-municipal-pages.py` particiona los 4,356 perfiles originales por su municipio registrado, conservando los 3,110 perfiles de playa en total. Reindexa únicamente los apoyos que necesita cada subconjunto; mantiene las cifras, coordenadas, referencias fotográficas, revisión de fuentes y correcciones manuales. No sobrescribe los modelos ni las observaciones recibidas.

Las capas de contexto, obras, datos de Alec y cambios de manglar se sirven por sección y se cargan cuando se necesitan. Los manifiestos de fechas, fuentes y catálogos pequeños siguen compartidos. Las teselas de fondo se solicitan para el encuadre visible. La navegación tiene un margen de 0.012 grados alrededor de las ventanas costeras recibidas y un límite de alejamiento adaptado al municipio. Estas ventanas son operativas, no deslindes jurídicos.

Progreso usa 596 perfiles de playa; Ixil usa 36. Los controles conservan los tres periodos de estudio, las fotos compatibles por municipio, los resultados desde su referencia fija y el arranque de análisis en 2025.

## Kilómetros

El buscador de cada página ofrece las carreteras con referencias recibidas dentro de su ventana. Conserva 75 postes RNC originales y añade 56 ubicaciones de medios kilómetros a la selección regional. Las últimas se interpolan siguiendo las polilíneas de carretera recibidas, entre postes consecutivos, con distancia de red compatible (650–1,450 m) y puntos a no más de 40 m de su carretera. Los intervalos desconectados o sin apoyo no producen resultados.

Cada resultado muestra si es poste oficial o ubicación aproximada entre dos postes y conserva los identificadores de apoyo. Un kilómetro de carretera no equivale a una distancia recorrida por la playa. No todos los municipios tienen postes recibidos; el buscador lo indica sin inventarlos. Se acepta punto o coma decimal (12.5 / 12,5).

## Construcción

La compilación pública genera también los 13 `index.html` municipales. La carga directa a Cloudflare agrupa las particiones municipales y la serie anual en el lector estático ya utilizado por el proyecto; conserva las URL y verifica cada contenido decodificado por SHA-256. No necesita una base de datos ni calcula mediciones en el servidor.

Para actualizar los derivados: `.coast-python/bin/python scripts/build-municipal-pages.py`. Las compilaciones de producción sin `--prepared` los regeneran después de preparar los datos generales. Las iteraciones de interfaz con `--local-preview` reutilizan los derivados existentes. `--prepared` debe emplearse sólo con datos ya preparados y verificados.

Verificación: TypeScript, 33 pruebas incluyendo conservación de cifras y revisiones fotográficas en los 13 subconjuntos, rutas, búsqueda decimal, referencia fija y regresiones temporales. El recorrido visual revisa el menú, Progreso, cambio a Ixil, fechas, límites, regreso al menú y búsqueda del km 12.5. No implica validación científica nueva de todas las posiciones.

## Copia pública en GitHub

Esta copia contiene los recursos preparados de la entrega, no los originales de investigación ni las carpetas de trabajo internas. Para compilar se usa `pnpm build:public`, que ejecuta `scripts/build-repository-map.mjs`. Las instrucciones de regeneración anteriores describen el archivo científico completo y no son requisitos para abrir o compilar esta copia pública.
