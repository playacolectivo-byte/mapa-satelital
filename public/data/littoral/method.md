> Actualización de la vista, 26 de octubre de 2026: las barras recientes unen las posiciones guardadas del agua de 2021 y de la fecha elegida. Se retiraron las llaves, los rótulos de frente y la guía visual hasta el punto cero. El origen técnico y los ejes originales se conservan en los datos para reproducir las distancias. El método de extracción y sus límites no cambian.

# Piloto 1c Chelem · método y procedencia

Fecha de ejecución: 26 de octubre de 2026. Método propio `s2-c1-ndwi-water-edge-v2`. Resultado exploratorio, sin validación de precisión en campo. Las cifras del primer checkpoint se complementan con la ampliación de 2022 al final de este documento.

## Qué medimos y qué muestran las barras

Medimos la **posición aparente del borde del agua** en metros a lo largo de once ejes fijos. Una diferencia entre dos fechas describe dónde aparece ese borde; todavía no demuestra erosión, pérdida de volumen de arena, daño humano ni ancho real de playa. La marea, las olas, la humedad de la arena, el registro de las imágenes y la mezcla de píxeles pueden moverlo.

Cada barra del mapa conserva un transecto original de Alec. Su largo no representa metros de playa perdida. En los cortes históricos, el color y la ficha describen la tasa publicada del intervalo, en m/año. En los recientes, describen la dirección aparente de la diferencia frente a la observación propia del 25 de noviembre de 2021. Los puntos recientes son cruces calculados, no levantamientos topográficos. Una variación redondeada a cero no prueba estabilidad.

## Zona de análisis

- ID: `chelem-p16-490-520`. Tramo de conveniencia de aproximadamente 300 m dentro de Chelem–Progreso; no representa todo el corredor.
- Once ejes originales S34: P16_T490, T493, T496, T499, T502, T505, T508, T511, T514, T517 y T520. Geometrías y atributos están en `pilot.json`; el archivo conserva sus coordenadas originales. No se proponen límites de celdas ni predios.
- Límites originales WGS84: [-89.7428077134938,21.2710416119483,-89.7397955658669,21.2725065234591]. Ventana de procesamiento: [-89.74515651029935,21.268743139563455,-89.7374463452883,21.274806032816056]. La ventana se deriva del envolvente original con un margen de 250 m en UTM; no es una delimitación científica nueva.
- Grilla fija EPSG:32616, píxel de 10 m, origen ajustado a múltiplos de 10 m. Las dimensiones/transformación exactas están en cada `raw/<producto>/receipt.json`.
- El extremo sur original de cada eje es el origen, y la distancia aumenta hacia el mar. Para calcular, prolongamos el eje desde −80 hasta +220 m; para dibujar conservamos la geometría original. Se interpola cada 2 m, sin afirmar resolución de 2 m.

## Referencia histórica 1b

Fuente: Alec et al. (2023), DOI https://doi.org/10.1016/j.rsma.2023.103247 y KMZ original de autores identificado por SHA-256 `b46b1a221d228005fbc644b0db4993209d440313111b2b4376c7f0de91c1b836`. Se reutilizan los derivados y verificaciones del proyecto, no se rehace ese estudio.

El archivo del piloto proviene de `public/data/problems/s34-s2.geojson`, SHA-256 `7f3ed501d1e18cef6f5bd6abd20cfe0e3d97356e4ace0b053d54fa7fc819227b`. Sus atributos contienen tres cortes: L5 1986–2011, L8 2013–2021 y S2 2016–2021. En el piloto hay 33 tasas y clases originales. Son tasas de regresión LRR en m/año y periodos de análisis, no fechas de fotografía ni posiciones puntuales al cierre de 2021.

Los periodos se superponen. No sumamos tasas, no las convertimos en observaciones anuales y no restamos m/año de metros. La conexión con 1c es el identificador y eje espacial común; la homologación de métodos y de la definición física de costa queda pendiente. El KMZ recibido no permite identificar la última escena individual por transecto. Los derivados regionales seleccionaron clases de erosión: la falta de una barra no declara estabilidad.

## Acceso reproducible a Sentinel

Se consultaron las referencias oficiales vigentes de Copernicus Browser, Catalog API y Statistical API. El Browser sirve para explorar; un catálogo identifica productos y la API estadística requiere definir máscara y variable. Ninguna de ellas convierte por sí sola un índice de agua en distancia de erosión.

El catálogo público CDSE respondió, pero los servicios Sentinel Hub de catálogo/procesamiento devolvieron HTTP 401 sin OAuth en este entorno. La alternativa utilizada fue Earth Search v 1 de Element 84, colección API **sentinel-2-c 1-l 2 a**, con COG públicos y sin credenciales. `catalogue.json` conserva los 1549 productos de la consulta paginada; `catalogue-receipt.json` registra consulta, 17 páginas, conteos, hashes y hora de corte. De ellos, 384 corresponden a MGRS16 QBJ/órbita relativaR040. Un producto inventariado no es una observación aceptada.

Se priorizaron escenas de octubre/noviembre, misma tesela y órbita, bajo porcentaje de nubes de tesela y separación temporal útil. No se afirma exhaustividad de fechas despejadas ni de toda la misión Sentinel. La consulta de esta colección recuperó seis productos del filtro espacial/órbita en 2022, ninguno en septiembre–noviembre; falta procesar los de diciembre y contrastar esa laguna de catálogo con CDSE.

Solo se descargaron **ventanas de DN originales** de bandas B03, B08, SCL y B04/B02 para QA visual; no se recibió ni se descargó el SAFE completo. Los TIFF conservan los números de origen, sus metadatos, URLs y SHA-256. El lector HTTPS valida TLS y rangos 206/Content-Range y no desactiva comprobaciones de certificado. Los problemas de CA de GDAL se resolvieron con lectura HTTPS acotada mediante urllib.

Se descartó la colección API antigua `sentinel-2-l2a` para el cálculo porque la comprobación de píxeles encontró DN ya corregidos junto a un offsetSTAC que provocaría doble corrección. En los recortes C1 usados aquí se aplica escala 0.0001 y offset−0.1 una sola vez. Los NoData se excluyen antes del offset. Se guarda el baseline de procesamiento por producto; el nombre de colección del proveedor no garantiza homogeneidad de todas las versiones ESA (entre los candidatos hay PB05.09).

## Transformación de píxeles en posición

1. Reproyectar B03/B08 a la grilla común con interpolación bilineal y SCL con vecino más próximo. B03/B08 son de 10 m; SCL es de 20 m y no mejora al remuestrear.
2. Excluir NoData, reflectancias negativas y denominadores ≤0.01. Admitir SCL4/5/6 y excluir el resto con un margen de 60 m; es una regla de control del piloto, no garantía de ausencia de nubes. Se conservan conteos de clases y fracción válida.
3. Calcular NDWI=(B03−B08)/(B03+B08). El NDWI no tiene unidades de distancia.
4. Segmentar agua con umbral 0 y repetir con −0.05/+0.05. Exigir conexión de agua al borde norte marino de la ventana. Extraer en cada eje un cruce único tierra→agua, con anclas válidas de tierra/mar a 15–40 m a cada lado. Rechazar cruces ambiguos o sin anclas y conservar `null` más motivo.
5. Interpolar el cruce, convertirlo a posición en metros sobre el eje y redondear la comunicación a 5 m. Los datos originales interpolados se conservan para reproducir el cálculo; no expresan exactitud milimétrica ni submétrica.
6. Guardar por fecha posición, punto, sensibilidad al umbral, productos, máscaras, grilla, versión, hora de procesamiento y diagnóstico. `verify.py` reproduce el cálculo sin red y guarda los rásteres NDWI/máscara en `derived/`.
7. Exportar solo las observaciones con once cruces técnicamente utilizables. La captura parcial conserva diez posiciones y un rechazo en su registro, fuera de la serie pública actual; no se rellena. Revisar visualmente RGB, máscara, contorno y cruces antes de la aceptación exploratoria.

La referencia fija para diferencias propias es `S2B_T16QBJ_20211125T163131_L2A` (2021-11-25 T16:37:39.044 Z). Incorporar una fecha anterior no cambia esa referencia en silencio. Las diferencias públicas se calculan entre las posiciones comunicadas redondeadas, sin anualizarlas.

## Control de calidad y límites

Los ocho productos del primer checkpoint tienen SCL4/5/6 en los recortes examinados. Las máscaras incluyen además píxeles de reflectancia inválida, por eso la fracción válida no tiene que ser 100%. El borde calculado sigue visualmente la transición costera a la resolución disponible; esta revisión no sustituye puntos independientes, marea ni control de registro.

Se priorizó temporada comparable y hora orbital similar. Falta conocer nivel del agua a la hora exacta de cada escena, oleaje/runup, pendiente local de playa y desplazamiento relativo entre escenas. Sin pendiente y nivel de agua no se puede corregir de forma justificada la posición horizontal de la marea. Falta validar el proxy NDWI frente a una referencia independiente y homologarlo con la definición de costa de Alec.

El campo `screening_tolerance_m` tiene un mínimo elegido de 20 m e incorpora sensibilidad al umbral cuando es mayor. **No es incertidumbre total, intervalo de confianza ni umbral probado de significancia.** Una diferencia menor no demuestra estabilidad; una mayor tampoco demuestra automáticamente erosión. No se cuantifica daño a geotubos, manglares ni causas por estas mediciones.

Los contrastes radiométricos, turbidez y objetos pequeños cerca de la costa merecen control adicional. Las manchas oscuras marinas no se interpretan como daño. NDWI verde/NIR con umbral fijo es un procedimiento propio; no reproduce el algoritmo CoastSat.

## Persistencia y versiones

`records/s2-c1-ndwi-water-edge-v2/<producto>.json` es el registro persistente por producto/método. Reprocesar los mismos IDs no añade duplicados ni sobrescribe resultados. Una modificación metodológica requiere otra versión y nueva carpeta. `public/data/littoral/pilot-series.json` y `measurements.csv` son la exportación de consulta y contienen la geometría común, valores, unidades, fuentes, periodo/fecha, calidad, versión y hora de procesamiento. No se suman tasas.

Los dos registros diagnósticos v 1, fuera de la carpeta v 2, se conservan por trazabilidad y nunca se publicaron como mediciones aceptadas. v 1comprobaba la conectividad marina en una muestra interpolada situada solo 2 m después del cruce y podía seguir sobre el píxel terrestre más próximo. v 2 corrige ese error de implementación verificando las anclas marinas a 15–40 m. No se relajó la máscara ni se inventaron posiciones para completar ejes.

En el visor, el deslizador recorre **cortes de datos**, con huecos explícitos, y mantiene la cámara. La ficha abierta se actualiza por ID de barra. La fotografía puede quedarse fija: su fecha se muestra por separado y nunca se atribuye al corte seleccionado. Los datos ya procesados se cargan como JSON; arrastrar no ejecuta análisis satelital ni bloquea esperando nuevas fotos.

## Ampliación verificada de 2022 · 26 de octubre

Se procesaron tres productos adicionales de la misma tesela y órbita, sin cambiar el método, umbrales ni referencia fija de 2021:

| Adquisición UTC | Producto Sentinel-2 | Cruces técnicamente utilizables | Uso en el visor |
|---|---|---:|---|
|2022-12-10T16:37:40.227Z|`S2B_T16QBJ_20221210T163003_L2A`|2/11|Parcial conservado fuera de la serie pública|
|2022-12-15T16:37:43.077Z|`S2A_T16QBJ_20221215T163324_L2A`|0/11|Sin mediciones utilizables con este método; rechazo conservado|
|2022-12-20T16:37:42.451Z|`S2B_T16QBJ_20221220T163016_L2A`|11/11|Aceptación técnica preliminar tras revisión de RGB, máscara, contorno y cruces|

La incorporación del 20 de diciembre añade once posiciones verificables; no rellena otros días o meses de 2022. El total de consulta pasa a ocho observaciones y 88 posiciones recientes, además de las 33 tasas históricas intactas. Quedan once productos procesados en total y tres productos parciales o rechazados fuera de la serie pública.

Las nuevas fechas de diciembre no son una temporada idéntica a la referencia de noviembre. Persisten los controles pendientes de nivel del agua, oleaje, pendiente local, registro espacial y validación independiente. La aceptación técnica no convierte las diferencias en erosión demostrada.

Los quince nuevos recortes de bandas y seis rásteres derivados se conservan con hashes. `evidence/reproduction-2022-2026-10-26.json` reproduce exactamente los tres registros nuevos, incluidos sus rechazos. `evidence/incremental-2022-2026-10-26.json` comprueba que los once productos no se duplican y que los cortes anteriores mantienen sus mediciones. Los recibos del primer checkpoint siguen guardados; sus exportaciones exactas están además en `evidence/previous-export-v19/`.

## Referencias técnicas consultadas

- https://documentation.dataspace.copernicus.eu/Applications/Browser.html
- https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Catalog.html
- https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html
- https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html
- https://sentiwiki.copernicus.eu/web/s2-products
- https://custom-scripts.sentinel-hub.com/sentinel-2/ndwi/
- https://custom-scripts.sentinel-hub.com/sentinel-2/scene-classification/
- https://earth-search.aws.element84.com/v1/
- https://github.com/kvos/CoastSat
