# Comparación con base fija de 1993

Todas las barras comparables usan el mismo año base: **1993**. El catálogo recibido no contiene una observación satelital aceptada de ese año. Por ello, actualmente **ninguna base de 1993 es observada**: las 4,710 bases disponibles son **estimadas**, y deben mostrarse con ≈ y trazo de estimación aunque el extremo posterior sí sea observado.

Estas bases y comparaciones son **cálculos derivados del proyecto, realizados con asistencia de ChatGPT**. No son posiciones anuales ni comparaciones publicadas originalmente por Alec y colaboradores. Las tasas del estudio, las imágenes satelitales originales y el procesamiento del proyecto son tres procedencias distintas y se identifican por separado.

## Cómo se obtiene la base estimada

Se conserva el modelo existente `alec-anchored-trend-v1`, con la tasa publicada para el eje y el periodo L5 1986–2011. Se exige un ancla satelital real aceptada del mismo eje anterior a la evaluación matemática del 1 de julio de 1993, a las 12:00 UTC. Se aplica:

`posición estimada de 1993 = posición real del ancla + tasa × tiempo transcurrido`

Los 4,710 ejes admitidos ya tenían modelos y anclas compatibles. Otros 140 modelos L5 con anclas posteriores a 1993 no se usan retrospectivamente. Tampoco se sustituye 1993 por 1986, 1987 ni otro año vecino. Donde no existe base compatible permanece información no disponible; una posición posterior aislada no recibe una cifra de cambio desde 1993.

El 1 de julio es una fecha matemática: **no es una captura de 1993**. Los productos y fechas satelitales del ancla se conservan aparte. No se modifica `coastal-evolution.json` ni se incorporan puntos sintéticos a las observaciones originales.

## Extremo del año elegido

Una observación real aceptada del año seleccionado tiene prioridad y conserva fecha, producto y calidad preliminar propios. Si falta, puede usarse un modelo compatible del periodo publicado, con ancla anterior a su evaluación; se identifica también como estimado. No se arrastran observaciones de otro año. La tasa publicada no se extiende fuera de su periodo.

Si cualquiera de los extremos es estimado, **la comparación es estimada**. En 1993 se muestra el punto de partida, sin cifra de pérdida ni afirmación de estabilidad. No se muestran comparaciones anteriores a 1993 contra una base futura.

## Alcance y límites

Se compara la posición exploratoria del borde del agua sobre el mismo eje. La cifra se redondea a 10 m para comunicación; eso no significa exactitud de 10 m. La resolución nativa Landsat es de 30 m y Sentinel de 10 m. Faltan correcciones de marea, oleaje/runup, pendiente de playa, registro independiente, homologación entre sensores y validación de campo. El cálculo no certifica pérdida de arena, superficie erosionada, volumen, deterioro ecológico ni causas.

El fondo Geomediana de 1993 es un compuesto anual para explorar el mapa y **no se usa para medir ni validar estas bases**. Contar años con fotografías no equivale a contar años con erosión medida.

## Exportación separada

`changes-from-1993.csv.gz` conserva en columnas separadas el tipo de base, su año, evaluación matemática, tasa, periodo y ancla; hace lo mismo para el extremo posterior y conserva fechas/productos reales cuando existen. No rellena con fechas de captura falsas. El archivo incluye solo bases y comparaciones utilizables; `fixed-1993-summary.json` contabiliza también las ausencias por año. Los CSV anteriores se conservan como antecedentes.

La base lleva `baseline_provenance=project_estimate_assisted_by_chatgpt`. Cada extremo lleva `endpoint_provenance`: procesamiento satelital propio asistido por ChatGPT cuando es observado, o estimación del proyecto asistida por ChatGPT cuando es modelado. Las tasas conservan el enlace al estudio original; los puntos observados conservan sensor, producto, fecha y método de procesamiento propios. «Observado» describe una posición extraída de píxeles originales con controles preliminares, no una medición de campo validada ni un valor publicado por el artículo.

Fuente de tasas: [Alec y colaboradores, DOI 10.1016/j.rsma.2023.103247](https://doi.org/10.1016/j.rsma.2023.103247). Parámetros originales recibidos en `alec-trend-models.json` y observaciones preliminares en `coastal-evolution.json`.
