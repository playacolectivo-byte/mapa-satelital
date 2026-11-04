# Comparación con el año inmediato anterior

Investigación y cálculos del proyecto asistidos por ChatGPT. No son mediciones de campo ni resultados publicados por ChatGPT como organismo científico.

El año elegido Y compara únicamente Y−1 → Y. La foto Esri, la posición del borde del agua y su incertidumbre son datos distintos. Se conserva la fecha de cada captura; no se convierte una edición de Esri en la fecha de su fotografía.

## Estudio de las posiciones recibidas (2018–2025)

Se parte de 22,796 posiciones previamente procesadas y aceptadas con filtros cartográficos de playa. Cada pareja exige el mismo eje, identificador exacto de método, resolución original y años calendario consecutivos. Se limita la diferencia estacional a 45 días; es un criterio operativo del proyecto para reducir contrastes estacionales, no una corrección del nivel del mar. Entre varias parejas se elige primero la más próxima en temporada, luego la misma plataforma; la magnitud del cambio no interviene en la selección. No se mezclan Landsat y Sentinel dentro de una comparación.

Cambio aparente en metros = posición original sin redondear de Y − posición original sin redondear de Y−1. Los dos extremos dibujados son los puntos originales. Se verifica la consistencia geométrica con el eje fijo. Los metros se comunican redondeados según la resolución, sin convertir decimales del algoritmo en exactitud física. Se conservan producto, observación, método, fechas y enlaces originales. Un año con una sola toma no equivale a una mediana anual ni permite evaluar persistencia.

## Estudio experimental nativo Landsat C1 (2010–2012)

Se emparejan posiciones individuales con la misma plataforma, perfil, familia de método y orientación marina confirmada, en años consecutivos y con diferencia estacional máxima de 45 días. No se comparan estas posiciones TOA con Sentinel SR o Landsat C2. Los originales habían pasado reproducción independiente de DN, calibración MTL, BQA, cruces, anclas y corredores marinos; la revisión RGB disponible es representativa, no de todos los perfiles. Se conserva el estado de calidad de origen y se rotula experimental. El muestreo de 10 m sobre píxeles de 30 m no mejora su resolución. No se aplica una corrección de sesgo supuesta.

## Nuevo estudio con píxeles originales: 2020–2021

Se recibieron 20 capturas Sentinel-2 C1 L2A para 10 parejas de fechas de marzo–abril, sobre los mismos 2,884 perfiles de playa de la investigación regional. La selección exigió la misma plataforma y tesela y una separación estacional máxima de 15 días. Primero se ordenaron candidatos por cobertura y nubosidad; después se revisó el SCL nativo y se eligieron hasta dos parejas por tesela por cobertura conjunta de transiciones claras. La selección se fijó antes de conocer el desplazamiento. Los perfiles cartográficos no se presentan como costas observadas de 2020 o 2021.

Se descargaron por rangos únicamente los bloques necesarios de B03 y B08 de 10 m. Cada XML y la escala y el desplazamiento de su TIFF se verificaron individualmente; DN cero se excluye antes de calibrar. Se calculó NDWI, con controles de anclas de tierra y agua, orientación marina fija y conexión nativa con mar abierto. Se revisaron umbrales −0.1, 0 y +0.1 y una dispersión máxima de 30 m entre sus cruces. Se emplea la máscara SCL de 100 m; la alternativa de 60 m conserva las clases válidas del núcleo y sólo reduce el anillo exterior. No se reclasifican nubes. Ambas fechas deben conservar la misma familia de extracción. La pareja final por perfil prioriza máscara estricta y proximidad estacional, sin elegir por el signo del cambio.

El corte produjo 4,919 posiciones individuales y 900 comparaciones, con alguna observación en los 13 municipios y 12 perfiles sin atribución municipal única. La reproducción independiente comprobó 14,757 interpolaciones de umbral, 59,028 controles nativos de vecindad y las 900 restas y geometrías. Otra recepción de RGB nativo confirmó 6,832 muestras verde/NIR exactas en 56 recortes. Se examinaron visualmente 28 perfiles (perfil mediano en el orden de identificadores y cambio máximo por municipio, más fronteras ambiguas); esto no es revisión individual de las 900 barras. Dieciocho resultados conservan avisos por contexto, obras, vegetación, espuma o desplazamientos grandes.

Cada barra conserva las fechas exactas, los catálogos y bandas originales, las muestras, la calibración y su calidad. Es una pareja de capturas, no una mediana anual. No se trasladaron datos de 2025–2026. Las posiciones nuevas se agregan como puntos fechados sin unirlos artificialmente. Los cuerpos comprimidos originales se procesaron en memoria: se conservan sus hashes, recibos y muestras exactas, pero no todos los bloques completos para una redecodificación desconectada. Sigue pendiente el error físico total y la normalización por nivel del agua.

## 2025–2026

Se conserva íntegramente el estudio multifecha anterior y sus 2,502 barras, incluidas las estimaciones espaciales identificadas. No se extrapola ese modelo a otros años. Su procedimiento completo permanece en [el método original](/data/shorelines/method.md).

## Límites y trazabilidad

Estos resultados describen desplazamiento preliminar del borde del agua. Marea, oleaje, pendiente y registro físico entre capturas siguen sin corregirse; el error total no está cuantificado. Una dirección aparente no prueba pérdida permanente de arena, causalidad, volumen o deterioro continuo. También pueden existir avances hacia el agua. Los cambios de plataforma conservan sus posibles sesgos. Las ausencias nunca se convierten en cero, ni se rellena un año con otra fotografía o con el cambio de otro periodo.

La cobertura es parcial, no completa en los 13 municipios. Los años y tramos sin parejas compatibles se muestran sin resultado. El filtro respecto a la cartografía reciente puede excluir desplazamientos históricos grandes; un descarte no demuestra estabilidad.

La comparación de posiciones sobre un mismo transecto y la necesidad de considerar la incertidumbre se apoyan en [DSAS, USGS](https://www.usgs.gov/centers/whcmsc/science/digital-shoreline-analysis-system-dsas?page=1). Este cálculo no se presenta como una ejecución ni una certificación de DSAS. La distinción entre fecha de edición y de captura está documentada por [Esri](https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/imagery/wayback-with-world-imagery-metadata).

Cada ficha incluye sus fuentes primarias y fechas. El manifiesto conserva los hashes y el estado por periodo. La escala principal fija 2010–2026 comienza en la captura HD más antigua recibida en el proyecto: 14 de noviembre de 2010, con 0.5 m/píxel declarado en algunos puntos (Dzilam de Bravo, San Felipe y Río Lagartos). La vista inicial también tiene una captura Esri de 2006, pero a 15 m/píxel; no se presenta como HD. El inicio de 2010 no garantiza una fotografía de cada año en toda la costa ni cobertura HD completa de los municipios.
