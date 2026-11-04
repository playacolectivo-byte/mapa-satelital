# Serie costera 2015–2026: observaciones y estimaciones separadas

> Corte vigente V5 ·29oct2026. Incluye posiciones nuevas Landsat8Collection1TOA de2015/2016/2017/2020, recibidas y revisadas como familia independiente. Hay1,166referencias2015(1,075observadas y91modeladas), con cobertura parcial en12municipios; Yobaín no tiene base2015admisible en las tres fechas del piloto. En2017hay alguna comparación anual en13municipios, sin continuidad científica validada de toda la costa. La comparación acumulada2015→2026sigue siendo parcial:230registros, incluidos sólo4escenarios nuevos que cumplen el enlace estricto. Los detalles y los demás años están en el manifiesto. No interpretar estos conteos como metros o kilómetros validados.

Trabajo local del proyecto asistido por ChatGPT, 29 de octubre de 2026. Los resultados son cambios preliminares del borde del agua; no son una certificación de pérdida de playa ni un levantamiento de campo. La geometría de referencia cartográfica sólo ubica las celdas de evaluación.

## Fuentes y dos inventarios diferentes

1. Posiciones aceptadas anteriormente sobre ejes `P…_T…`, conservadas en `coastal-evolution.json` y filtradas en `observed-waterline-points.geojson`. Se agrupan por eje, identificador exacto de método, resolución original y temporada. No se mezclan por cercanía con el inventario regional.
2. Perfiles regionales originales (2,884) con normales y atribución municipal. Se conservan los extremos de las parejas Sentinel-2 nativas de 2020–2021 y los agregados multifecha de 2025–2026, descartando contextos señalados, orientación contradictoria y residuos fuera del eje mayores de 0.15 m. Las diferencias entre estas dos formas de extracción se rotulan **estimadas y con homologación pendiente**, incluso con posiciones derivadas de píxeles reales.
3. Si existe `review/new-sentinel/positions.geojson`, las nuevas posiciones del piloto se incorporan con su propio identificador de extracción. No se promueven a validación física, ni se mezclan automáticamente con otros métodos.

Los hashes de los archivos realmente leídos quedan en el manifiesto. Los originales no se reescriben. El número de celdas o ejes no equivale a kilómetros de costa con erosión validada.

## Selección y cálculo

Se conserva una posición de apoyo por año, método y temporada, elegida por proximidad a una fecha de referencia estacional antes de considerar los metros de cambio. Se mantienen separadas las temporadas de primavera y de otoño–invierno. Las parejas de apoyo deben estar separadas como máximo 45 días dentro del calendario estacional.

En años sin posición compatible, sólo se interpola **dentro** de dos apoyos del mismo eje, separados como máximo cuatro años:

`posición(Y) = posición(A) + (Y−A)/(B−A) × [posición(B)−posición(A)]`

`cambio = posición(año seleccionado) − posición(año anterior)`

La posición de 2015 se conserva idéntica al calcular la comparación acumulada. Si no hay posición compatible de 2015 y del extremo, no se fabrica una base. No se extrapola antes del primer apoyo o después del último ni se toman metros de perfiles vecinos. Los puntos modelados se sitúan sobre el mismo eje de los dos apoyos, comprobando la distancia geométrica contra el cambio sin redondear.

## Comprobación por omisión

Se retira cada apoyo anual interior y se predice a partir de sus dos vecinos. Se publican los errores por perfil, año, familia de extracción y amplitud del intervalo. Es un diagnóstico del modelo; no una validación independiente de la orilla ni un intervalo de confianza físico. Hay solapamiento temporal y espacial entre comprobaciones, y las ventanas del diagnóstico pueden llegar a seis años mientras que las estimaciones entregadas se limitan a cuatro.

No se ofrece interpolación de una familia/temporada que carezca de al menos diez comprobaciones por omisión. Este umbral es un control operativo del proyecto, no una prueba de precisión aceptada universalmente. La diferencia debe superar el p90 diagnóstico de su familia para colorearse con dirección resuelta en esta serie. Los valores menores, o sin diagnóstico, conservan dirección incierta; no equivalen a cambio cero.

## Cobertura municipal y vacíos

El inventario regional conserva todos los 2,884 perfiles y los 13 municipios. Cada año indica **procesado**, **estimado** o **sin cuantificación admisible**. Las celdas longitudinales se ubican en la referencia cartográfica y no se presentan como orillas históricas. `delta_m:null` significa falta de una comparación compatible; nunca significa estabilidad.

En el corte inicial no hay parejas anuales suficientes de método compatible para2015–2018. La base2015 conserva las174 referencias observadas y se amplía con escenarios acotados de tasa publicada, descritos abajo. Las nuevas bandas y pruebas del piloto amplían el banco de apoyos de manera explícita, no por renombrar otros años.

## Escenarios de base2015 con tasa del propio eje

Se verificaron los hashes de los modelos L8 de Alec para2013–2021 y sus anclas. Se admiten sólo240 ejes con ancla Landsat8 aceptada y un segundo producto Landsat8 aceptado del mismo eje dentro del periodo. La base observada de2015 tiene preferencia. Cuando falta, se evalúa el modelo en1jul2015: posición del ancla + tasa propia × años transcurridos, dentro de2013–2021. Una evaluación anterior al ancla no se presenta como observación; es un escenario dentro del intervalo de ajuste publicado.

Se contrasta cada tasa anclada con la otra posición interna del propio eje:240 residuos, mediana6.09m y p9017.90m en el corte inicial. No es validación independiente: las posiciones pueden estar relacionadas con el periodo del estudio, y los métodos anteriores y posteriores no están homologados. Por ello todas estas comparaciones acumuladas se rotulan estimadas, aunque alguno de sus extremos tenga captura real.

Los extremos pueden modelarse sólo dentro de2013–2021. Después de2021 no se prolonga la tasa: debe existir una posición satelital recibida del mismo eje, con fecha y fuente propias. No se unen ejes vecinos. La base2015 se mantiene fija en toda la serie por eje; no se vuelve a elegir cada año. Las fechas de evaluación de un modelo se guardan separadas de las fechas de captura.

## Incertidumbre y alcance

No se corrigieron marea, oleaje, pendiente de playa ni error físico de registro de cada captura. El borde instantáneo del agua puede cambiar sin pérdida permanente de arena. La precisión de los decimales permite reproducir las restas, no comunicar exactitud centimétrica. Un movimiento hacia tierra no demuestra causalidad, pérdida de volumen, daño permanente o deterioro monótono. La fuente HD visible es una referencia visual con su fecha propia; su nitidez no elimina la incertidumbre de las posiciones satelitales usadas para calcular.

Este procesamiento sigue el principio de comparar posiciones sobre perfiles y declarar incertidumbre, documentado por [DSAS del USGS](https://www.usgs.gov/centers/whcmsc/science/digital-shoreline-analysis-system-dsas?page=1). No se afirma haber ejecutado DSAS o CoastSat. La documentación de [CoastSat](https://github.com/kvos/CoastSat) describe controles adicionales de extracción, marea y pendiente útiles para una siguiente validación.

## Comparación regional suplementaria desde2020

Se ofrece un modo separado desde2020; no reemplaza la base2015 ni transforma2020en2015. Requiere una posición real recibida de2020. Se fija una sola familia de extracción y una sola posición de base por perfil para todos los años siguientes. Se prioriza la reextracción con la misma función `received-normal-ndwi-v1.1-double-precision` cuando existe; no se cambia la base al encontrar otro método en un año posterior.

Las nuevas posiciones piloto de2018,2019,2024 y las reextracciones offline de2020,2021,2025,2026 conservan sus fechas y muestras originales. Los pares de la misma función se distinguen de los puentes hacia otros agregados, que permanecen estimados. Los modelos de2022–2023 usan apoyos del mismo eje dentro del límite temporal permitido. El banco regional contiene algún resultado en los13municipios, pero esto no acredita continuidad numérica en cada metro de costa ni cobertura HD anual de cada municipio.

Las advertencias físicas generales (marea, oleaje, registro, ausencia de campo) se mantienen separadas de una ambigüedad marina local real, que sí lleva a exclusión. Los casos señalados como `marine_ambiguous` no se incorporan como nuevos apoyos del piloto.

## Adición nativa Landsat8Collection1TOA: familia independiente

La rama L8 utiliza bandas originales B3/B5 de30m y BQA de Collection1L1, no la escala ni las máscaras de SentinelSR. La reflectancia se obtiene con los coeficientes de su MTL y el seno de elevación solar de la escena. La admisión de resultados exige una verificación final independiente y hashes de los dos archivos recibidos. Las clases de confianza desconocida de BQA no se aceptan como cielo claro.

Las posiciones de2015/2016/2017/2020 permanecen separadas del procesamiento Sentinel. Un par de la misma familia, mismo eje y orientación puede producir una comparación preliminar. No se convierte una posición LandsatTOA en SentinelSR ni se copian valores de otro año.

### Escenario opcional de enlace por2020

Sólo se considera donde existan una base Landsat2015real, dos capturas Landsat2020y dos capturas Sentinel2020en fechas diferentes, emparejadas con una distancia temporal máxima de15días por pareja sobre el mismo eje y orientación. Las parejas se seleccionan por proximidad de fecha e identificadores antes de examinar los metros. Dos teselas de la misma fecha no cuentan como dos épocas independientes. Si faltan estos apoyos, no se relaja el límite ni se crea el enlace.

La fórmula es `(L8_2020−L8_2015)+(S2_Y−S2_2020)`. Se calcula un offset para cada pareja2020y se usa su mediana como enlace **hipotético constante**, conservando el rango de sensibilidad entre ambas alternativas. No es una homologación atmosférica ni geométrica validada. El extremo posterior corregido se dibuja como **modelado**; la base2015sigue siendo la posición real recibida. La dirección se mantiene incierta porque dos épocas de2020no validan un sesgo constante hasta otros años ni cuantifican error físico, marea u oleaje.

Cada ficha conserva la ecuación, posiciones originales, fechas de los dos pares, offset, dispersión y fuentes. El rango de sensibilidad a dos offsets no es un intervalo físico de confianza. El escenario no demuestra pérdida permanente de playa. No se aplica una tasa regional ni se usa un municipio para rellenar otro.


### Coherencia entre ficha y color

Cuando el estado del resultado indica que la variación entre capturas se superpone y no permite resolver la dirección, la barra conserva `direction_unresolved=true`. Los metros calculados no se modifican: se evita interpretarlos como una dirección resuelta. Esta normalización de presentación no añade una observación ni cambia la categoría de estimación.
