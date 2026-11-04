# Posiciones y cambio aparente en fotografías · revisión del 2 de noviembre de 2026

Actualización del 3 de noviembre: se añadieron 29 interpretaciones manuales de Chelem, registradas por separado. El dibujo ahora utiliza [referencias fijas y trazos estimados identificados](fixed-reference-method.md); no convierte el modelo en fotografías observadas.

Este producto experimental se calculó con asistencia de ChatGPT. Interpreta un borde visible en fotos Esri fechadas; no es un levantamiento de campo ni certifica pérdida permanente de playa. Se conservaron por separado los datos y el modelo anteriores.

## Alcance y resultados de la revisión

Se procesaron los 4,356 perfiles y sus 36,042 registros de imagen recibidos, en 13 municipios. El análisis de playa utiliza 3,110 perfiles; 493 corresponden a obras y 753 a vegetación u otros tipos de costa. Las obras conservan su propia capa, sin tratar sus muelles como playa erosionada.

La inspección visual no comprende cada imagen. Se revisaron todos los 184 candidatos cuyo desplazamiento absoluto respecto de la cartografía superaba 40 m, 26 pares con los mayores cambios positivos/negativos por municipio y una muestra separada de 26 capturas, además de las capturas usadas para desarrollar el algoritmo. Se descartaron 95 lecturas concretas por errores o ambigüedad visual. No se sustituyeron por una cifra arbitraria.

El conjunto conserva 14,858 lecturas que pasan los controles numéricos y visuales aplicados. Eso no equivale a 14,858 mediciones verificadas individualmente ni a precisión exacta. En la edición 26334 hay 2,046 posiciones fotográficas, 251 localizadores interpolados y 813 ubicaciones de playa pendientes. La cantidad de parejas fotográficas depende de la fecha y de la zona.

## Detector de borde visible

1. Se reutilizan las teselas y el plan de muestreo recibidos. Se comparan los colores RGB mostrados por el proveedor; no se afirma haber calculado NDWI, reflectancia, Sentinel ni un índice espectral a partir de estas fotos.
2. Sobre cada eje original se muestrean cinco perfiles paralelos, separados lateralmente a −12, −6, 0, 6 y 12 m. Se buscan cruces dentro de ±150 m de la cartografía, con un paso de 1 m. Ese paso no crea resolución nueva: las teselas se muestrearon a niveles 16 o 17 según la fuente fechada disponible.
3. Se suaviza el color con sigma de 1 m y se comparan dos bandas de cinco muestras, de −6 a −2 m y de +2 a +6 m. El lado de tierra requiere R/(G+1) ≥ 0.94, B/(G+1) ≤ 0.97 y brillo medio ≥ 100; el lado de agua, R/(G+1) ≤ 0.98 y B/(G+1) ≥ 0.62. Se exige una caída de rojo ≥ 12 y de R/(G+1) ≥ 0.025.
4. Debe persistir tierra en al menos la mitad de las muestras entre 10 y 22 m detrás del borde. Se necesitan al menos cuatro perfiles coincidentes, incluido el central, dispersión percentil 90–10 ≤ 12 m y diferencia del central respecto de la mediana ≤ 6 m. Entre cruces separados que cumplen los criterios se conserva el más cercano a la cartografía; esta elección sigue pudiendo equivocarse.
5. Una segunda comprobación utiliza un área de imagen de ±200 m a través de la costa y ±120 m a lo largo, con paso de 2 m. Busca conectividad de arena/vegetación hacia tierra y del agua hacia el lado marino. También exige cuatro perfiles y dispersión ≤ 12 m. Ambos detectores deben aceptar y diferir ≤ 12 m. Se conserva el desplazamiento del primer detector; la discrepancia se incorpora al indicador de dispersión.
6. Los casos que fallan, cruzan una huella de imagen incompatible o resultan ambiguos en la revisión visual permanecen rechazados. Los umbrales son reglas experimentales de esta revisión, no estándares certificados ni garantías de exactitud.

Los caminos, nubes, espuma, sombras, agua turbia y vegetación pueden engañar a ambos detectores. Las lecturas aceptadas requieren revisión adicional para usos de ingeniería, jurídicos o de decisiones sobre predios.

## Posición en el mapa y metros

La conversión al mapa reproduce el plano de píxeles Web Mercator y su escala local por latitud. No se utiliza una conversión fija de grados para toda la costa. El punto se vincula a la edición realmente visible, no a la que todavía está descargándose.

Una barra requiere una lectura aceptada en la fecha final y una referencia fotografiada de 2010; donde no existe una referencia interpretable de 2010, se usa 2011 explícitamente. Ambas lecturas están sobre el mismo perfil:

`cambio aparente = desplazamiento final − desplazamiento de referencia`

Negativo significa hacia tierra; positivo, hacia el agua. El extremo final corresponde a la foto visible de ese punto; el otro extremo representa la fecha anterior y no tiene que tocar la orilla de la fotografía actual. El primer año es una referencia, no «cero erosión observada».

Cuando falta una pareja fotográfica, el cambio se muestra con trazo discontinuo y una referencia fija, identificado como estimado. La reconstrucción se explica en [el método de referencia fija](fixed-reference-method.md); sus extremos no se presentan como costas observadas. Dos vecinos pueden interpolar un extremo estimado, sin convertirlo en una lectura fotográfica, cuando tienen la misma captura, rodean el punto, están a menos de 300 m cada uno, suman como máximo 500 m, tienen normales con producto escalar ≥ 0.95 y difieren ≤ 30 m en su desplazamiento. Sus valores de erosión no se copian. Si no hay apoyos suficientes, se usa el modelo identificado como estimado; cuando tampoco hay fotos aceptadas en ese perfil, se mantiene gris y por revisar. No se atribuyen metros fotográficos confirmados. Las píldoras «100 m» describen el intervalo nominal original; no miden exactamente la separación de las posiciones ajustadas.

## Fechas, incertidumbre y límites

Se contrastaron las ubicaciones fotográficas e interpoladas con los metadatos del proveedor en las 22 ediciones recibidas: 39,014 coincidencias de fuente al nivel 17 y, donde había huellas inequívocas, 19,142 al nivel 18. Se bloquearon 31 combinaciones de perfil y edición. La ausencia de metadatos a una escala más fina no prueba que no exista una imagen. Verificar la identidad de fuente no valida el detector ni la pérdida de playa.

La fecha de publicación de una edición Esri no es la fecha de adquisición de todas sus imágenes. Fecha, fuente y detalle pueden variar por lugar y nivel de zoom; véanse la [explicación oficial de metadatos Wayback](https://www.esri.com/arcgis-blog/products/arcgis-living-atlas/imagery/wayback-with-world-imagery-metadata) y la [nota oficial sobre fechas por tesela y escala](https://support.esri.com/en-us/knowledge-base/faq-can-the-date-of-an-image-be-determined-from-the-wor-000012181).

El indicador de posición combina la exactitud publicada por el proveedor, una tolerancia instrumental de 3 m y la dispersión de cada lectura; para dos fechas se combinan ambos indicadores cuadráticamente. Si falta la exactitud publicada, no se inventa. Ese indicador no es un intervalo estadístico ni incluye el error físico total. No se corrigieron marea, oleaje, estacionalidad, pendientes de playa ni registro con puntos estables. Un borde de agua distinto puede reflejar esas condiciones, además del cambio del terreno.

La comparación por perfiles, fechas y diferencias sigue un principio descrito por [USGS DSAS](https://www.usgs.gov/centers/whcmsc/science/digital-shoreline-analysis-system-dsas). No se ejecutó DSAS ni sus fuentes certifican este producto; no se transfiere automáticamente su validación a este algoritmo.

## Datos y reproducción

- [Lecturas de esta revisión](revised-data.json.gz), con candidatos rechazados conservados.
- [Tabla por perfil y fecha](revised-observations.csv).
- [Exclusiones visuales concretas](revised-visual-review.json).
- [Control de huellas y fechas](revised-source-review.json).
- [Lecturas originales anteriores](data.json.gz) y [método anterior](method.md).
- [Escenario anterior intacto](../scenario/model.json.gz) y [valores anuales originales](../scenario/values.csv.gz).

El código reproducible está en `scientific/photo-alignment/revision-20261102/`, con los umbrales congelados y las listas de revisión. Las figuras de control y los recibos de teselas/metadatos se conservan en el expediente local de esta revisión. La generación de geometría y la revisión de menús no requieren nuevas descargas científicas al cambiar de año; la carga de fotografías depende del servicio Esri y de la conexión.
