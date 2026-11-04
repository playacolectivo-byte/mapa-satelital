# Cambio del borde del agua desde 1986

Las posiciones principales se miden en Landsat y Sentinel. Alec es información
histórica complementaria: sus ejes e identificadores permiten consultar el
mismo sitio, pero sus tasas no se convierten en posiciones anuales.

La referencia preferida es Landsat del 14 de abril de 1986. Si no contiene una
posición utilizable para un eje, se busca otra captura real de 1986 aceptada
explícitamente, empezando por la más antigua. Se conserva la fecha propia de
esa referencia en la ficha y el CSV. Nunca se sustituye por 2021 ni se inventa
un punto de partida. Las referencias de abril ya aceptadas permanecen intactas.

Para cada barra, el año elegido busca la última posición técnicamente utilizable
de ese año en los registros incorporados. Puede tener una fecha distinta de
otra barra si la escena más reciente tiene nubes o no cubre el lugar. Las dos
fechas y los dos productos aparecen en la ficha. No se arrastran posiciones de
otro año para llenar vacíos. El calendario incluye todos los años, aunque no
haya mediciones para cada parada.

La línea une la posición guardada de 1986 con la posición del año elegido. El
valor comunicado se calcula restando las posiciones interpoladas sobre el mismo
eje y redondeando a 10 m. La geometría conserva ambos extremos originales sin
ajustarlos visualmente a la fotografía de Esri. La foto mantiene su propia fecha.
Un valor redondeado de cero no prueba estabilidad y puede conservar dos extremos
ligeramente distintos en el mapa.

- Rojo: el borde del agua aparece más hacia tierra; tonos más intensos para
  mayores desplazamientos aparentes.
- Verde: aparece más hacia el mar. No certifica recuperación ecológica.
- Gris: punto de partida, diferencia redondeada cercana a cero, o un punto de
  agua observado que aún no tiene referencia aceptada de 1986. Este último
  conserva su fecha y no tiene segmento ni cifra de desplazamiento.
- «Información no disponible»: no hay posición aceptada del año elegido en
  ese sitio. No significa ausencia de erosión ni ausencia de estudios históricos.

La escala cromática es fija: hasta 10 m, hasta 30 m, hasta 60 m y más de 60 m.
Son intervalos gráficos, no categorías validadas de deterioro. No se obliga a
que los colores empeoren con el paso de los años: las mediciones pueden mostrar
movimientos en ambos sentidos.

## Medición y controles

Landsat Collection 2 Level 2: verde/NIR con escala DN × 0.0000275 − 0.2, NDWI
= 0, sensibilidad a umbrales ±0.05, máscaras de relleno, nubes, sombras, nieve y
saturación, separación de máscara de 90 m, cruce único conectado al componente
marino y anclas de tierra y agua. Resolución nativa de 30 m. Los recortes usan
la intersección real con el rectángulo de la escena; la corrección v2 conserva
los números digitales de origen. Los rechazos y ensayos previos permanecen
guardados fuera del conjunto aceptado.

La ampliación usa los 1,366 ejes originales dentro de la ventana existente de
Chelem–Progreso, no una nueva delimitación de celda. Esta ampliación no cubre
automáticamente los 9,645 ejes regionales del inventario. Los resultados
regionales anteriores se conservan y toda barra usa las mismas reglas de
fecha, referencia y ausencia de información.

La serie anual añade recortes Landsat C2 L2 y Sentinel-2 Collection 1 L2A,
catalogados y procesados con `scientific/annual-waterlines/process.py`.
Sentinel utiliza verde/NIR a 10 m, escala y desplazamiento indicados por cada
producto STAC, SCL nativa a 20 m transferida por vecino más próximo, buffer de
60 m y anclas a 15–40 m; el cruce debe ser único y conectado al mar, y debe
pasar los tres umbrales −0.05, 0 y +0.05. Las cifras interpoladas no aumentan
la resolución. Landsat mantiene el núcleo de cálculo v2 ya revisado.

Las capturas se examinan también por las nubes sobre los ejes costeros, no
solo por la nubosidad global de la escena. Los candidatos pasan a la capa
únicamente al quedar enumerados en `acceptance-review.json`, tras la revisión
exploratoria de las bandas de contexto disponibles, NDWI, máscaras y posición general. Eso no equivale a una
validación de campo de cada punto. La reproducción offline comprueba hashes,
intersecciones de grilla y resultados sin modificar los registros fuente.

La medición puede completarse sin rojo/azul cuando están las bandas verde/NIR
y las bandas de calidad necesarias. En ese caso el diagnóstico usa la banda
verde en escala de grises, se declara que el RGB está incompleto y no se
presenta una fotografía inventada. Las limitaciones particulares de cada
captura, incluido el bandado visible en algunas Landsat 4, se conservan en
las notas de calidad de la ficha, el catálogo y el CSV.

Las imágenes Landsat 7 posteriores a mayo de 2003 pueden tener franjas sin
píxeles por el fallo del corrector SLC. Los vacíos y las máscaras conservadoras
pueden impedir medir una costa aunque exista la escena. No se rellenan con
una imagen de otro año, ni se declara que todos los productos posibles hayan
sido agotados. El catálogo público consultado contiene productos para todos
los años 1986–2020; disponibilidad no significa medición aceptada. En la copia
Sentinel L2A consultada para esta zona hay fechas desde 2018, por lo que se
usa Landsat para los años anteriores.

Se conservan las ocho observaciones procesadas del piloto con el método
`s2-c1-ndwi-water-edge-v2`, resolución nativa de 10 m y máscaras SCL. No se
reprocesaron ni reemplazaron esos originales. Las distancias recientes que
originalmente se exportaron respecto a 2021 se conservan en su CSV original;
el mapa nuevo y `changes-from-1986.csv` calculan la comparación con 1986 aparte.
En el catálogo de entrega, los campos `source_baseline_*` y `source_change_m`
conservan esa procedencia original. No son el desplazamiento de la vista nueva;
su referencia fija se declara a nivel de catálogo y el CSV identifica el cambio
como `change_from_1986_m`.

Faltan correcciones de marea, oleaje/runup, pendiente de playa, registro
independiente y homologación de los sensores. La referencia de abril y las
observaciones de otras temporadas pueden tener condiciones distintas. Los
transectos cercanos pueden compartir píxeles y no son observaciones espaciales
independientes a la escala de cada predio. Interpolar sobre un eje no mejora la
resolución del satélite ni produce exactitud de campo.

Por eso los cambios mostrados son exploratorios: no demuestran por sí solos
pérdida de arena, superficie erosionada, volumen, deterioro ecológico ni causalidad
de una obra. Las tasas históricas son m/año para intervalos completos y no se
suman ni convierten en una serie de posiciones anuales.

## Fuentes y reproducción

Imágenes Landsat: cortesía del U.S. Geological Survey, distribución pública por
Microsoft Planetary Computer. Sentinel-2: Copernicus, distribución Earth Search.
Los productos, fechas, métodos y controles por observación están en
`coastal-evolution.json`; los valores originales y procedencia de 1c permanecen
en `pilot-series.json` y `measurements.csv`.

- https://doi.org/10.1016/j.rsma.2023.103247
- https://www.usgs.gov/faqs/how-do-i-use-a-scale-factor-landsat-level-2-science-products
- https://www.usgs.gov/landsat-missions/landsat-collection-2-known-issues
- https://developers.google.com/earth-engine/datasets/catalog/LANDSAT_LT05_C02_T1_L2
- https://planetarycomputer.microsoft.com/dataset/landsat-c2-l2
- https://www.usgs.gov/faqs/what-landsat-7-etm-slc-data
- https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/S2L2A.html

El código reproducible está en `scientific/baseline-1986/process.py` y
`scientific/annual-waterlines/process.py`; los
catálogos recibidos, recortes DN, hashes, diagnósticos, rechazos y revisión de
aceptación se conservan junto a él. `scripts/export-coastal-evolution.mjs`
genera la consulta sin modificar las fuentes científicas recibidas.
