# Celestún: revisión de la orilla visible por fecha · 5 de noviembre de 2026

Se revisaron 379 perfiles de playa, 3,256 lecturas y 24 fechas reales de captura entre 2010 y 2026. Las 48 láminas de revisión contienen una columna por lectura y conservan el candidato previo, la propuesta y las correcciones explícitas. La revisión visual fue realizada por ChatGPT; no es una visita de campo ni una validación independiente humana.

## Qué se marcó

El contacto visible entre arena y agua en la imagen fechada. No se aceptan como orilla una franja de color dentro del mar, la vegetación de la duna, un camino, una nube ni la punta de un muelle. En desembocaduras y superficies sumergidas ambiguas la lectura queda pendiente.

Se aceptaron 3,157 posiciones; 99 quedaron pendientes. Se registraron 220 interpretaciones visuales explícitas que corrigen o completan el candidato numérico. Cinco propuestas se rechazaron por cruzar una huella de otra captura. La fecha también se comprobó en los metadatos de la escala de visualización: 3,157 comprobaciones, sin discrepancias de fecha.

## Posición y metros

1. Cada perfil conserva su eje cartográfico original. Se lee la imagen oficial de Esri Wayback y se busca por separado el límite arena/agua en cada fecha. Las imágenes RGB se usan como fotografías; no se presentan como reflectancia Sentinel o índices espectrales.
2. Se inspeccionan cinco líneas paralelas y después cada columna de imagen. Cuando el candidato confunde agua y costa, se traza el límite visible de forma explícita. Se guarda una huella SHA-256 de la lámina y la tesela, fecha, edición, perfil y decisión.
3. Los desplazamientos de píxeles EPSG:3857 se convierten a metros locales retirando la escala de Mercator. Las coordenadas resultantes se verifican contra la huella de captura en la posición y a tres metros de cada lado.
4. La base es la primera foto aceptada de ese perfil: 2010 si existe, después 2011 y, donde la captura antigua no permite leer la orilla, la primera fecha posterior interpretable. Nunca se reconstruye una costa de 2011 a partir del modelo.
5. La barra une la base fija y la posición de la foto elegida. La longitud se recalcula con la métrica local del elipsoide WGS84, verificada contra geodésicas inversas con PROJ/pyproj. El signo sigue el eje del perfil: negativo hacia tierra y positivo hacia el agua. Las cifras de la simulación anterior no intervienen en estos metros.

No se muestran resultados fotográficos de otro año sobre una captura incompatible. La selección de fechas consulta el perfil revisado próximo a la vista; las fechas de publicación de Wayback no se confunden con las fechas de toma.

## Precisión y límites

La posición es una interpretación del borde visible en una fotografía. Tiene una tolerancia de trazado de al menos 8 m, elevada a 12 m en imágenes pancromáticas y perfiles de desembocadura; también se incorpora la exactitud de registro indicada por el proveedor y el término de lectura de 3 m conservado del cálculo original. Se muestra dirección incierta cuando el cambio no supera ese indicador combinado. No es un intervalo estadístico validado del error físico total.

Las teselas utilizadas tienen aproximadamente 1.1 a 2.2 m por píxel según la fecha y escala, aunque el metadato de la imagen fuente indique un detalle más fino. Aumentar el zoom no crea precisión adicional. Marea, oleaje, arena mojada, nubosidad, registro entre sensores y fecha estacional pueden cambiar la orilla aparente. Estos resultados no prueban por sí solos pérdida permanente de playa, daño atribuible a una obra ni causalidad.

## Archivos y fuentes

- [Decisiones por perfil y fecha](celestun-image-review-20261105.json)
- [Comparaciones geodésicas por perfil](celestun-reviewed-comparisons.csv)
- [Esri: cómo interpretar Wayback y sus fechas](https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/mapping/use-world-imagery-wayback)
- [USGS: Digital Shoreline Analysis System](https://www.usgs.gov/centers/whcmsc/science/digital-shoreline-analysis-system-dsas). Referencia metodológica para comparar posiciones en transectos; no se afirma haber ejecutado DSAS ni obtenido su validación.
- Kassis et al. (2026), [Scientific Agent Skills](https://doi.org/10.48550/arXiv.2609.00065). Procedencia de las guías de unidades e incertidumbre usadas en el proceso; no constituye evidencia de erosión local.

Los datos originales y el modelo anterior se conservan sin sobrescribir. Esta revisión solamente modifica la representación derivada de Celestún.
