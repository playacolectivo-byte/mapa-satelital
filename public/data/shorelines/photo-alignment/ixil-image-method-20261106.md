# Ixil: revisión de la orilla visible por fecha · 6 de noviembre de 2026

Se revisaron las 228 lecturas de los 36 perfiles del inventario de Ixil, en nueve fechas de captura entre 2011 y 2025. Hay 217 posiciones interpretables y 11 lecturas pendientes. Se recuperaron 105 lecturas antes descartadas y se corrigieron 189 posiciones respecto a los candidatos anteriores. La revisión visual fue realizada por ChatGPT con las fotografías oficiales; no es una visita de campo ni una validación humana independiente.

## Qué representa la marca

El límite aparente entre la arena conectada a tierra y el agua en esa fotografía. Se distingue del borde interior de vegetación o del cordón de restos oscuros. Una franja amarilla dentro del agua, una casa, una sombra o una barra de arena sumergida no se aceptan como costa. En cuatro lecturas de 2015 el agua somera turbia impide separar el contacto; en siete de noviembre de 2019 una franja oscura lo oculta. Se conservan como pendientes, sin metros inventados.

## Fechas realmente interpretadas

| Captura | Posiciones aceptadas |
| --- | ---: |
| 2011-08-01 | 36 |
| 2012-12-15 | 36 |
| 2015-02-16 | 32 |
| 2019-09-30 | 6 |
| 2019-11-22 | 29 |
| 2022-03-03 | 10 |
| 2022-03-31 | 26 |
| 2023-08-14 | 6 |
| 2025-11-25 | 36 |

No todas las fechas cubren todos los perfiles. Las dos fechas de 2022 corresponden a sectores distintos, y agosto de 2023 sólo está documentado en seis perfiles occidentales. El selector usa las fechas aceptadas del perfil próximo a la vista; no renombra una fotografía de 2022 como 2023. Las fechas anteriores son de adquisición, no de publicación del mosaico Wayback.

## Cómo se calculó

1. Se conservan los ejes originales y se lee cada fecha por separado. Se inspeccionaron once láminas amplias, seis de detalle, siete de contexto y nueve adicionales para comprobar agua turbia y márgenes difíciles. Una segunda revisión de las seis láminas finales verifica las posiciones incorporadas. Los candidatos de color y brillo sirven como orientación; las lecturas finales se registran explícitamente por perfil y fecha y pueden rechazarlos.
2. Las teselas oficiales se leen en nivel 17. En esta latitud son aproximadamente 1.1 m por píxel. La ampliación visual e interpolación del visor no añaden resolución física. El desplazamiento de píxeles en EPSG:3857 se convierte a metros locales quitando la escala de Mercator. No se mide distancia usando grados de latitud/longitud como si fueran metros.
3. La referencia fija es la foto del 1 de agosto de 2011 en los 36 perfiles. Se calcula la distancia entre esa coordenada y la de cada captura posterior con el elipsoide WGS84. La implementación local se contrasta con la geodésica inversa independiente de PROJ/pyproj. Signo negativo: hacia tierra; positivo: hacia el agua. Los incrementos del modelo anual anterior no intervienen en estos metros.
4. Los metadatos oficiales de cada edición se comprueban en la nueva posición y a tres metros de cada lado. Sólo se permiten las ediciones que conservan la misma fecha de captura. La ficha enlaza las decisiones y fuentes; los originales permanecen intactos.

## Incertidumbre y límites

Las posiciones son interpretaciones del límite visible, con una tolerancia de trazado de 8 m en las fotos más claras y 12 m en las capturas de 2015, noviembre de 2019 y 2025 por agua turbia o margen difuso. El indicador de comparación incorpora por separado la exactitud de registro declarada por el proveedor y el término de lectura de 3 m del visor. No es un intervalo estadístico validado ni la incertidumbre física total. Cuando la diferencia no supera el indicador combinado, la dirección queda incierta; no se transforma en cero cambio ni en erosión confirmada.

No se han corregido marea, oleaje, pendiente de playa ni efectos estacionales, ni se ha realizado un ajuste independiente entre sensores. Un desplazamiento aparente entre fotografías no demuestra por sí solo pérdida permanente de playa ni su causa. Los perfiles y su adscripción municipal provienen del inventario previo, marcado aproximado; no delimitan predios ni jurisdicciones legales.

## Archivos y fuentes

- [Decisiones, coordenadas, fechas y huellas SHA-256](ixil-image-review-20261106.json)
- [Comparaciones por perfil](ixil-reviewed-comparisons.csv)
- [Esri: archivo Wayback y fechas de publicación frente a adquisición](https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/mapping/use-world-imagery-wayback)
- [USGS: Digital Shoreline Analysis System](https://www.usgs.gov/centers/whcmsc/science/digital-shoreline-analysis-system-dsas). Referencia metodológica para posiciones y transectos; no se afirma haber ejecutado DSAS.
- Kassis, T., Agarwal, V., He, Y., Patel, D., y Brueckner, A. M. (2026), [Scientific Agent Skills](https://doi.org/10.48550/arXiv.2609.00065). Procedencia de las guías geoespaciales y de unidades e incertidumbre usadas; no constituye evidencia de erosión local.

La revisión de Celestún y los datos de los otros municipios se conservan sin cambios. Esta incorporación sólo modifica los resultados derivados de Ixil.
