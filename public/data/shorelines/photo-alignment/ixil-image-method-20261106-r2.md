# Ixil y corredor vecino visible · revisión del 6 de noviembre de 2026

La revisión comprende 142 perfiles: los 36 del inventario de Ixil y 106 del contexto próximo de Progreso y Dzemul que aparece en la panorámica. Se mantienen sus municipios originales. Es una franja acotada de la vista, no una nueva delimitación municipal ni un levantamiento de toda la costa de esos municipios vecinos.

Se comprobaron 1,030 lecturas, incluidas las 228 de la revisión anterior de Ixil. Hay 957 posiciones interpretables y 73 lecturas pendientes. Los 142 perfiles tienen una posición interpretable de 2025 y una referencia fotográfica anterior. Las posiciones se interpretaron con ayuda de ChatGPT; no cuentan con validación independiente de campo.

## Qué se corrigió

La página anterior sólo descargaba los 36 perfiles propios de Ixil, aunque dejaba ver más playa a los lados. Ahora carga también los 106 perfiles del corredor próximo, con sus fotos y resultados revisados. No descarga el modelo completo del litoral.

En las lecturas nuevas se inspeccionaron 18 láminas de propuestas y 21 láminas adicionales con contexto amplio, que incluyen 165 comprobaciones de sitios difíciles. Se corrigieron propuestas que seguían techos, embarcaciones, manchas sumergidas, acumulaciones oscuras o el borde interior de la playa. Los ángulos y las puntas se leen sobre el eje original: no se crea una barra sobre una estructura portuaria ni se une una curva atravesando el mar.

## Fechas y cobertura

| Captura real | Lecturas aceptadas |
| --- | ---: |
| 2011-08-01 | 116 |
| 2012-12-15 | 142 |
| 2015-02-16 | 135 |
| 2019-09-30 | 89 |
| 2019-11-22 | 62 |
| 2020-04-17 | 10 |
| 2022-03-03 | 63 |
| 2022-03-31 | 79 |
| 2023-07-01 | 42 |
| 2023-08-14 | 59 |
| 2025-03-13 | 43 |
| 2025-10-11 | 20 |
| 2025-11-25 | 66 |
| 2025-12-21 | 31 |

Una fecha puede estar representada por más de un registro de proveedor o resolución, por lo que estas lecturas no equivalen necesariamente a perfiles distintos. La edición 26334 permite mostrar los 142 perfiles en imágenes realmente adquiridas en 2025, con fechas diferentes según el tramo. El año de publicación de la edición de Esri no se presenta como la fecha de la foto.

El selector utiliza las capturas aceptadas próximas a la cámara y prioriza la edición que conserva mayor cobertura revisada del corredor para ese año. No ofrece 2020 o 2023 donde no hay una foto compatible. No se crean observaciones anuales para rellenar años sin evidencia.

## Cálculo y referencia fija

1. Cada lectura marca el contacto aparente entre la arena conectada a tierra y el agua de esa fotografía. La inspección se hace con los píxeles originales de Esri en nivel 17, aproximadamente 1.1 m por píxel en esta latitud; ampliarlos no añade resolución física.
2. La referencia es la primera foto interpretable de cada perfil: 2011 en 116 perfiles y 2012 en 26. En esos 26, una franja oscura o un objeto impiden separar de manera fiable arena y agua en 2011. No se reconstruye una supuesta posición de 2010 o 2011 desde imágenes posteriores. Los 36 perfiles propios de Ixil conservan su referencia de 2011.
3. Las posiciones se convierten de píxeles de Web Mercator a metros locales quitando la escala de la proyección. La diferencia se recalcula entre las dos coordenadas con el elipsoide WGS84 y se contrasta con geodésicas inversas de PROJ/pyproj. El modelo anual anterior no interviene en los metros revisados. La coordenada inicial permanece fija al cambiar de año.
4. Para cada posición aceptada se comprueban los metadatos de la edición en el punto y a tres metros a cada lado. Sólo se conservan ediciones con la misma fecha real de adquisición. Las decisiones, teselas y láminas mantienen identificadores y huellas SHA-256.

## Incertidumbre

Se conserva una tolerancia orientativa de trazado de 8–12 m según la claridad del límite. El indicador mostrado en las comparaciones combina esa tolerancia con el registro declarado por el proveedor y el término de lectura del visor. No es un intervalo estadístico validado ni la incertidumbre física total. Si el cambio no supera ese indicador, la dirección queda incierta; eso no significa cero cambio.

Las 73 lecturas pendientes son 26 de 2011, siete de 2015 y 40 de noviembre de 2019. No se les asignan metros observados. No se han corregido marea, oleaje, pendiente de playa, estacionalidad ni diferencias de registro entre sensores. Un cambio aparente entre dos fotos no demuestra por sí solo daño permanente ni su causa.

## Evidencia consultable

- [Decisiones y procedencia por lectura](ixil-image-review-20261106-r2.json)
- [Comparaciones y distancias por perfil](ixil-reviewed-comparisons-r2.csv)
- [Revisión anterior de los 36 perfiles propios de Ixil](ixil-image-method-20261106.md)
- [Esri: imágenes Wayback y fechas de adquisición](https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/mapping/use-world-imagery-wayback)
- [USGS: Digital Shoreline Analysis System](https://www.usgs.gov/centers/whcmsc/science/digital-shoreline-analysis-system-dsas), referencia metodológica; no se afirma haber ejecutado DSAS.
- [Scientific Agent Skills](https://doi.org/10.48550/arXiv.2609.00065), procedencia de las guías de geometría, unidades e incertidumbre; no constituye evidencia de erosión local.

Los archivos originales recibidos no se modifican. Las capturas «antes» y «después» muestran el cambio del visor y sus resultados; no representan una validación independiente de las mediciones.
