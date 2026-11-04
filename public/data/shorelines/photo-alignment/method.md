# Interpretación experimental de fotografías costeras

Este método conserva la descripción de los datos originales anteriores.
Las dos vistas actuales usan un producto derivado separado, descrito en la
[revisión de posiciones del 2 de noviembre](position-method.md): barras sólo
con dos fotos compatibles y cifras modeladas conservadas en localizadores.
La conversión de coordenadas reproduce ahora el muestreo Web Mercator con
escala local de la captura, en lugar de la escala única del escenario.

Se revisó el inventario completo de 4,356 puntos de 13 municipios. Los resultados
separan posiciones interpretadas en fotografías, estimaciones entre fechas y
casos sin cruce claro. **No son una certificación de erosión ni de daño.**

## Imágenes y fechas

Se consultaron 22 ediciones públicas de [Esri World Imagery Wayback](https://livingatlas.arcgis.com/wayback/).
Las fechas usadas son las de adquisición publicadas en los polígonos de
metadatos; la fecha de edición del mapa no se trata como fecha de fotografía.
Se agruparon las ediciones que identifican una misma toma, fuente y resolución
en cada punto. Se verificó también la huella del extremo detectado. Una toma
fechada en un municipio no fecha las fotografías de los demás municipios.

2026 incluye solamente las capturas disponibles en cada lugar; no representa
una observación completa del año ni una foto de hoy.

Los dos selectores del apartado actual comparten los años compatibles de la
localidad o costa municipal elegida. Para ofrecer un año se exige una
referencia aceptada de 2010 o 2011 y un extremo fotográfico aceptado de ese año;
una fotografía fechada sin esa pareja no basta. Además, la edición elegida
debe contener ese mismo año en el perfil auditado más próximo al centro de la
localidad o encuadre municipal. Esa verificación local evita ofrecer, por
ejemplo, 2023 sobre la huella de 2022 de El Faro, Ixil. El ancla procede del
inventario recibido; es un muestreo próximo, no una verificación de cada píxel.

Para cada zona y año se fija una sola edición revisada: la que reúne más
posiciones aceptadas compatibles en las asignaciones municipales recibidas.
Un empate usa la edición revisada más reciente. Desplazar el mapa, ampliar o
recibir otros metadatos locales no modifica esa elección. La región, el año
y esa edición se resuelven juntos con el catálogo incluido en el visor.

Al solicitar otra fecha se conservan la imagen visible y sus resultados hasta
que la nueva imagen está lista. Se indica el año que sigue visible durante
la carga; sus cifras no se atribuyen al año solicitado. No se conservan
resultados de otra zona o de una imagen distinta de la realmente visible.

La lista inicial se incluye en el visor, sin esperar consultas de red. Si el
año anterior no es compatible con el nuevo lugar, se elige el año disponible
anterior más próximo o el primero si no hay ninguno anterior. Las elecciones
fuera de la lista se ignoran. Elegir un año conserva centro y zoom. Las fuentes
Sentinel e INEGI restringen además la lista a sus fondos recibidos disponibles.
La fecha real al centro permanece indicada: las huellas pueden variar dentro
de un municipio y con la escala. No se certifica cobertura municipal uniforme.

La recepción comprende 36,042 capturas únicas por punto y 10,601 teselas sobre
una franja de análisis. Se muestreó a nivel 16 cuando su fuente y fecha
coincidían con el nivel 17, y a nivel 17 en los demás casos. El muestreo gráfico
es aproximadamente de 2.2 o 1.1 metros por píxel, aunque la fuente indique una
resolución original más fina. Ampliar la imagen no reduce esa limitación.

## Detección reproducible

1. Por punto se examinan cinco perfiles paralelos, separados 6 metros, dentro
   de una franja de ±250 metros. La orientación y el lugar del muestreo parten
   del inventario recibido. No se reutilizan los metros del antiguo escenario
   para fijar los extremos o calcular los cambios nuevos.
2. Un clasificador de 32 árboles, profundidad máxima 10, utiliza RGB, índices
   visibles y variación local. Se entrenó con 10,630 muestras de 13 fotos
   interpretadas visualmente. Son etiquetas exploratorias, no verdad de campo.
   Las [anotaciones de entrenamiento](training-annotations.json) identifican
   los puntos, ediciones e intervalos. Se fijó la semilla 20261030.
3. Se busca un paso coherente de tierra a agua. Se rechazan falta de confianza
   en cualquiera de ambos lados (<0.85), discrepancia entre paralelas (>16 m),
   cruces junto al límite de búsqueda, bordes sin contraste suficiente y
   cambios de huella/fuente. Las obras, rompeolas y costa vegetada del inventario
   no se numeran automáticamente como pérdida de playa. Los valores rechazados
   permanecen en el archivo como revisión pendiente, nunca como cero cambio.

El primer detector de color produjo falsos bordes en agua turbia y se descartó.
La versión final añadió entrenamiento e inspección visual. Una muestra separada
de 26 fotos, aproximadamente 1.5 km de los puntos piloto, produjo 14 posiciones
con controles aprobados que se inspeccionaron visualmente. Esa revisión
cualitativa no establece un error físico general ni valida cada punto.

## Años y referencia por punto: 2010 o 2011

Cuando hay una posición aceptada del año y de la edición mostrada, se usa esa
captura. El cambio es la diferencia de los desplazamientos sobre el mismo
perfil: positivo hacia el agua y negativo hacia tierra.

La referencia usa una posición aceptada en una foto de 2010. Si no existe una
posición interpretable de ese año, se usa una foto aceptada de **2011** y el
cambio comienza en 2011. La ficha muestra el año y la fecha real de la base de
cada punto. No se reconstruye 2010 a partir de fotos posteriores ni se cambia
el año de una foto para completar esa referencia. Si tampoco hay referencia
aceptada de 2011, el punto sigue pendiente, sin cifra de cambio.

El visor actual sólo dibuja resultados compatibles cuyo extremo procede de
una foto del año solicitado. Las referencias de inicio se conservan como
referencias, sin llamarlas erosión. Se excluyen de la capa interactiva los
cruces rechazados, las bases ausentes, las capturas de otro año y los extremos
interpolados o extrapolados. La ausencia de una barra no significa cero cambio.

Los datos completos y las funciones de investigación conservan estimaciones
interpoladas o extrapoladas identificadas explícitamente; esas estimaciones
no habilitan años adicionales en los selectores actuales ni se convierten en
mediciones observadas. Los estudios publicados de Alec y el archivo histórico
conservan sus datos y sus periodos propios.

## Límites

Esta es interpretación de imágenes RGB renderizadas, **no NDWI ni análisis de
reflectancia calibrada**. Agua turbia, oleaje, sombras, obras, vegetación,
humedales y cambios de iluminación pueden producir errores. Faltan corrección
de marea/oleaje, registro entre imágenes con puntos estables y validación de
campo. El movimiento del agua visible no equivale a pérdida permanente de playa.

La combinación cuadrática de las precisiones cartográficas de la fuente y la
dispersión del detector se usa solamente como indicador de incertidumbre de
posición. No es un intervalo de confianza ni el error físico total; no incluye
la incertidumbre de interpolar años, la marea ni el oleaje.

## Archivos y reproducción

- [Revisión visual del 31 de octubre de 2026](visual-review.json): se
  inspeccionaron 39 pares de fotos de 13 municipios, priorizando los cambios
  más grandes en tres tercios espaciales de cada municipio. Se excluyeron del
  visor nueve lecturas que confundían caminos, vegetación o manchas de agua
  con la orilla. Se conserva la lectura original y no se asigna una cifra de
  reemplazo. Esta muestra no certifica los demás puntos ni sustituye la
  validación de campo.

- [Revisión visual del 2 de noviembre de 2026](position-review.json): 41
  capturas inspeccionadas y 21 lecturas adicionales excluidas por caminos,
  vegetación, agua o nubes confundidos con una orilla interpretable. El dato
  original se conserva. La revisión visual no abarca cada una de las 36,042
  capturas del inventario.
- [Control de identidad de las fuentes](source-position-review.json): se
  contrastó la huella fechada de las ubicaciones calculadas con los metadatos
  oficiales de cada edición. Las incompatibilidades o huellas ambiguas se
  conservan como revisión pendiente; no se cambia el año de una captura.

- [Datos completos comprimidos](data.json.gz), con captura, desplazamiento,
  edición y motivo de rechazo por punto.
- [Auditoría por punto y captura, CSV comprimido](observations.csv.gz). El
  desplazamiento candidato respecto de la cartografía no es, por sí solo,
  metros de erosión. La columna de control distingue los resultados rechazados.
- [Resumen por municipio y límites de cobertura](summary.json).
- Fuentes originales: servicios oficiales de metadatos y teselas identificados
  por las ediciones de Esri Wayback; la atribución del fondo se conserva.

El código y los recibos de recepción se conservan localmente en
`scientific/photo-alignment` y en la carpeta de trabajo de esta revisión. Las
observaciones de Landsat/Sentinel recibidas, el escenario anterior, el estudio
de Alec y los documentos históricos se conservan como fuentes independientes.
