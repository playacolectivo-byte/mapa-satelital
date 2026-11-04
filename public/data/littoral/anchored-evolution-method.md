# Barras de cambio observado y estimado

Cada barra parte de la posición del agua más antigua utilizable **entre las
observaciones que hemos recibido, procesado y aceptado de forma preliminar**
para ese eje. Puede ser 1986, 1987, 2022 u otra fecha. No significa que sea la
imagen más antigua que existe en todos los archivos del mundo.

Una línea continua une esa referencia con la última posición utilizable de
su propio año. Ambas fechas y productos son reales. El primer año de cada
barra muestra su punto de partida; no certifica estabilidad ni ausencia de
erosión. Las demás observaciones del mismo año permanecen en el catálogo.

Si falta una posición anual, una línea discontinua puede mostrar un resultado
**estimado según el estudio**, siguiendo `alec-anchored-trend-v1`:

1. Se conserva la tasa original de Alec y colaboradores para el eje y periodo
   correspondiente: L5 1986–2011, L8 2013–2021 o S2 2016–2021, en m/año.
2. Dentro de ese periodo se requiere una posición real aceptada del mismo eje
   y un sensor de la familia correspondiente. Esa posición ancla la tendencia.
3. Se calcula `posición estimada = posición del ancla + tasa × años transcurridos`.
   La evaluación anual usa el 1 de julio a las 12:00 UTC y años de 365.2425 días.
   Es una fecha matemática, **no una fecha de captura**. No se estima antes
   del ancla ni fuera del periodo publicado.

En solapes se prefiere S2 y luego L8 si hay anclas compatibles; no se suman
tasas de periodos diferentes. Siempre gana una observación anual utilizable.
El cambio mostrado compara la referencia propia de la barra con el extremo
observado o estimado. La incertidumbre de combinar métodos no está validada.

Los ejes conservan su geometría original. La dirección positiva hacia el mar
se calcula en UTM 16N, igual que en el procesador recibido. Los parámetros de
visualización conservan su ancla, tasa, periodo, procedencia y hashes. El
extremo estimado es una proyección de la tendencia desde una posición real;
no reproduce necesariamente el ajuste original de regresión de los autores,
pues no disponemos aquí de todos sus interceptos y observaciones originales.

Rojo indica desplazamiento hacia tierra y verde hacia el mar, medido o
estimado según el trazo. El cambio se comunica redondeado a 10 m; esto no es
una exactitud de 10 m. Las posiciones medidas originales quedan intactas.
Faltan correcciones de marea y oleaje, registro independiente, homologación
entre sensores, pendiente de playa y validación de campo. No se confirma
pérdida de arena, salud ecológica ni causas por el color de una barra.

2012 no tiene un intervalo publicado ni una observación aceptada: sigue sin
información. Las tendencias de Alec no se extienden a 2022–2026. Donde no hay
posición real ni modelo anclado compatible, permanece «Información no disponible».

La fotografía de referencia Esri tiene fecha propia. El servicio permite
explorar y ampliar, pero las capturas recibidas se repiten en varios años.
Por ello no cumple todavía la condición de un fondo histórico distinto para
cada año. Los PNG históricos conservados no sustituyen automáticamente a Esri.

Archivos separados:

- `coastal-evolution.json`: observaciones originales, sin puntos sintéticos.
- `changes-from-first-observation.csv.gz`: comparación anual de posiciones reales.
- `alec-trend-models.json`: parámetros y anclas de las estimaciones.
- `alec-trend-estimates.csv.gz`: resultados estimados, sin fecha/producto de
  observación inventados; incluye fecha matemática, tasa y producto del ancla.
- Los archivos anteriores con referencia 1986 se conservan como antecedentes.

Fuente de las tasas: https://doi.org/10.1016/j.rsma.2023.103247
