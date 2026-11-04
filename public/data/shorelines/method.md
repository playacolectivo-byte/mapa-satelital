# Investigación costera del proyecto · asistida por ChatGPT

Actualización local: 29 de octubre de 2026. Resultados procesados sobre datos satelitales originales. La asistencia de ChatGPT consiste en diseñar, programar, contrastar y explicar el procesamiento; las observaciones proceden de los satélites y conservan sus fuentes.

## Comparación regional 2025–2026

Se comparan capturas Sentinel-2 C1 L2A de marzo–abril de cada año sobre perfiles aproximadamente perpendiculares a las playas cartografiadas por INEGI. Los perfiles se mantienen en las mismas coordenadas entre fechas, separados aproximadamente 100 metros a lo largo de la costa. La cartografía de referencia ubica el muestreo y no se hace pasar por una costa observada en 2025 o 2026.

1. Se seleccionan fechas adicionales por tesela y por los perfiles que aún no tienen suficientes observaciones. Se conserva la fecha de adquisición de cada producto. Una huella de catálogo no cuenta como píxeles recibidos.
2. Se leen muestras de bandas originales verde e infrarroja cercana, la clasificación SCL y metadatos radiométricos. Se aplican escala, offset y datos ausentes antes de calcular NDWI = (verde − infrarrojo)/(verde + infrarrojo).
3. Se conservan dos familias de detección: la primera exige anclas en los extremos del perfil; la segunda evalúa anclas terrestres locales en barreras estrechas y comprueba la continuidad marina hasta 500 m y el corredor de 500–5,000 m, con controles de topología y contexto. La segunda se usa donde la primera no resuelve las anclas, sin duplicar una captura ni reclasificar nubes. En cada normal se comprueba una orientación compatible tierra–agua con anclas espectrales y de clasificación; se buscan cruces únicos y se rechazan cruces múltiples, nubes, sombras, ausencia de datos y sensibilidad excesiva al umbral. El control de SCL incluye el entorno del cruce. No se convierte automáticamente arena brillante en datos despejados.
4. Cada posición conserva producto, fecha, muestras originales, controles y motivos de rechazo. Por perfil y año se calcula la mediana de las posiciones válidas y su dispersión (MAD, cuartiles y rango entre capturas).
5. La barra compara mediana 2026 menos mediana 2025 sobre el mismo eje orientado hacia el agua: un signo negativo indica movimiento hacia tierra y uno positivo hacia el agua. La geometría une las posiciones calculadas; no se alarga para aparentar un daño mayor.
6. Un control de persistencia exige al menos tres observaciones válidas por año y contrasta los rangos entre capturas. Las comparaciones parciales conservan su estado parcial. La dispersión observada no se presenta como un intervalo de confianza de toda la medición.

La combinación actual reúne 96 escenas y 10,441 observaciones individuales: conserva las 8,710 observaciones del primer corte de 60 escenas y agrega 197 de fechas alternativas y 1,437 de vecindad de calidad de 60 m y 97 de un segundo lote dirigido de fechas alternativas. El entorno original de 100 m se mantiene como fuente; el rescate de 60 m conserva los píxeles, la calibración y las clases SCL permitidas. Se reprodujeron de forma independiente las vecindades nativas, los cruces y anclas de los aportes nuevos, las medianas, dispersiones, signos y geometrías. Se inspeccionaron casos RGB seleccionados, incluidos extremos y estructuras; no todas las capturas recibieron inspección visual individual. Los conflictos de orientación y contexto mantienen una advertencia. Son controles de reproducción y plausibilidad; no constituyen una validación de precisión física o de campo.

### Qué significa la cifra

Es un cambio procesado del borde del agua en la ventana estacional examinada. Marea, oleaje, pendiente y sesgo de registro siguen siendo componentes pendientes de la incertidumbre total. Las cifras no son por sí mismas un balance de arena, daño económico, erosión física confirmada ni el cierre de todo el año 2026. Un valor nulo significa que la comparación no pudo resolverse; no significa cero erosión.

La entrega actual contiene 2,113 comparaciones procesadas y 389 estimaciones espaciales, identificadas por separado: 2,105 comparaciones corresponden al corte de marzo–abril y ocho a ventanas alternativas de febrero o mayo. Estas ocho usan una sola captura por año, emparejadas con una diferencia de calendario de hasta 15 días; no se incorporan a las medianas de marzo–abril ni se consideran una comprobación de persistencia. Se reprodujeron radiometría, SCL, cruces y geometrías y se inspeccionaron las dos imágenes RGB de cada par. Un noveno candidato se excluyó porque el borde detectado estaba en agua somera o vegetación y separado de la playa visible. Dos de los ocho retenidos conservan revisión contextual por canal/obras o vegetación/turbidez; un perfil mantiene atribución municipal ambigua. Se conservaron las muestras DN y sus hashes, XML y SCL originales; los bloques DN comprimidos conservan recibos y hashes, por lo que su descompresión original no puede repetirse sin nueva recepción.

Los 389 modelos espaciales mantienen el corte de apoyo anterior; no se recalibraron con estas ocho comparaciones. Se contrastaron ocultando bloques con tamaños semejantes a los huecos reales; se probaron interpolación lineal, tendencia local y proceso gaussiano. Se conservaron los fallos locales aunque el promedio municipal fuera favorable. De las estimaciones, 315 quedan entre observaciones y 74 usan apoyo unilateral contrastado. No se utilizaron perfiles con las 41 alertas contextuales como anclas.

Cada ficha conserva perfiles de apoyo, pesos, capturas, modelo, parámetros y margen empírico frente al indicador satelital procesado. En 378 estimaciones ese margen admite desplazamientos en ambas direcciones: se muestran como «dirección incierta», sin concluir ni retroceso ni cero erosión. Los márgenes se ampliaron cuando los bloques densos revelaron más sensibilidad. Esta es validación interna con bloques correlacionados e imágenes compartidas; no una prueba externa intacta ni validación de campo. El error físico total sigue sin determinarse. No se añaden las predicciones al conteo de observaciones. Los 382 perfiles restantes conservan la comparación sin resolver; no se convierten en cero.

Para que el mapa sea ligero, la geometría se carga junto con atributos mínimos y el cálculo completo llega al pulsar una barra. Los archivos comprimidos se verifican contra los bytes originales. En la vista panorámica se dibujan símbolos de localización por grupos de color; no se suman ni promedian las mediciones. Al acercar se muestran las barras individuales con sus geometrías calculadas.

## Trazos históricos

Las líneas de colores proceden de posiciones observadas ya recibidas en Landsat y Sentinel. Existen datos de 2013, 2015 y 2018–2026; son coberturas parciales y cada trazo conserva su fecha real. Se unen únicamente perfiles consecutivos de la misma captura, grupo e indicador, a menos de 100 m y sobre la misma pieza cartográfica de playa. Se apartan puntos próximos a puertos, cierres y costa no clasificada como playa. Las coordenadas originales no se desplazan para hacerlas coincidir con el fondo Esri.

Estos trazos no son una línea única observada de todo el año. Landsat tiene píxeles de 30 m y Sentinel de 10 m: la calidad visual del fondo Esri no aumenta la precisión de esas mediciones.

## Comparación desde 1993

La opción «Desde 1993» conserva la base estimada del proyecto y las tendencias publicadas que la respaldan, con sus periodos y anclas. Se muestra separada de la nueva comparación 2025–2026. No existe aquí una observación directa de 1993 para todas las barras. Sus fichas mantienen la distinción entre investigación publicada, posiciones procesadas y estimaciones asistidas por ChatGPT.

## Fuentes y reproducibilidad

- [Sentinel-2 C1 L2A en AWS Open Data](https://registry.opendata.aws/sentinel-2-l2a-cogs/).
- [Documentación de Earth Search: Sentinel-2 C1 L2A](https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a).
- [Línea de costa INEGI](https://www.inegi.org.mx/app/biblioteca/ficha.html?upc=794551196540).
- [Investigación publicada de Alec y colaboradores](https://doi.org/10.1016/j.rsma.2023.103247).
- [Manifiesto de posiciones históricas](manifest.json).
- [Fechas y productos de las capturas históricas](capture-manifest.csv).
- [Resultados del corte de marzo–abril y estado de recepción](resumen.json).
- [Resultados por perfil de marzo–abril y motivos de rechazo](resultados-por-perfil.csv).
- [Resultados de las ventanas alternativas revisadas](resultados-alternativos-por-perfil.csv).
- [Comparaciones procesadas 2025–2026, descarga completa comprimida](regional-2025-2026.geojson.gz).
- [Conteo exacto de la entrega y perfiles pendientes](entrega.json).
- [Procedencia de la revisión independiente](quality-provenance.json).
- [Revisión de las ventanas alternativas y exclusión visual](quality-provenance-alternatives.json).

Las fichas de las barras enlazan además los productos originales concretos utilizados en cada cálculo. Esri se utiliza para exploración visual remota con atribución, mostrando las capturas distintas consultadas al centro de la vista; sus fechas pueden variar dentro del encuadre y al cambiar de escala.
