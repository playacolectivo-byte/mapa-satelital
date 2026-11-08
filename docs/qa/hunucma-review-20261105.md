# Hunucmá: referencias y cobertura fotográfica, 5 de noviembre de 2026

La capa municipal recibida tiene 384 perfiles de playa. Ninguno tenía una lectura aceptada de 2011. El programa reconstruía 343 referencias mediante fotos posteriores y el modelo, utilizaba 40 referencias fotográficas de 2010 y dejaba una referencia basada únicamente en cartografía/modelo. Esos mecanismos no proporcionan una posición observada de la costa en 2011.

## Propuesta de referencias observadas

Se descargó únicamente la banda de cada perfil, a zoom nativo 17 y hasta ±150 m de su centro, de la edición histórica 11019 de Esri Wayback. Para los 157 perfiles cuya ficha identifica una foto del 1 de agosto de 2011, se conservan 135 teselas originales, SHA-256, mosaico, GeoTIFF y 12 paneles de perfiles. Los archivos están en `work/hunucma-audit-20261105/release-11019/`.

Se interpretaron manualmente 153 intersecciones del perfil con el borde aparente entre agua y arena. Los candidatos automáticos basados en RGB se descartaron porque confundían oleaje, caminos y otros límites; `candidates.json` no es una fuente aprobada. Las marcas manuales están en `manual-*.png` y en la variable `rows` de `scripts/digitize-hunucma-reference.py`.

Para cada posición manual corregida se consultó de nuevo la capa oficial de metadatos, en la coordenada final. Los 153 endpoints corresponden a la fecha y al sensor de la ficha de 2011; no se extrapoló la fecha desde el centro nominal del perfil. Se conservaron la URL completa, respuesta JSON original y SHA-256. La fecha de publicación de la edición histórica no se utilizó como fecha de adquisición.

La revisión está en `public/data/shorelines/photo-alignment/manual-hunucma-20261105.json`, con estado `independently_reviewed`. No modifica los datos científicos originales. Incluye 153 correcciones, 153 capturas de referencia aprobadas y 231 referencias pendientes:

- 227 perfiles carecen de una fotografía fechada en 2011 en el inventario recibido. Hay imágenes de 2010 o 2012, pero no se las denomina 2011.
- Los perfiles SC-5-0-156, SC-5-0-157, SC-5-0-158 y SC-258-0-0 atraviesan un área de bocana con más de un borde, o el borde queda fuera de la banda de ±150 m. Se mantienen pendientes.

La tolerancia operativa manual de 8 m en la propuesta sirve para representar límites de interpretación, no es una desviación estándar ni una exactitud física certificada. Los metadatos del proveedor declaran SRC_ACC aproximadamente 10,2 m y SAMP_RES 0,5 m. La resolución del panel no mejora esos valores: las teselas z17 tienen aproximadamente 1,1 m por píxel en el terreno; el panel se interpola a 0,5 m por píxel de pantalla para facilitar la lectura.

## Años y fechas reales

El inventario anual contiene 5.760 combinaciones perfil/año, y separa existencia de foto fechada, aceptación anterior del detector y respaldo de la referencia. Los recuentos siguientes describen los datos originales, antes de incorporar la propuesta manual. Una lectura aceptada por el detector no equivale a validación visual independiente.

| Año | Perfiles con foto fechada | Perfiles con alguna lectura anteriormente aceptada |
| --- | ---: | ---: |
| 2011 | 157 | 0 |
| 2012 | 162 | 82 |
| 2013 | 384 | 117 |
| 2014 | 55 | 27 |
| 2015 | 0 | 0 |
| 2016 | 194 | 119 |
| 2017 | 150 | 89 |
| 2018 | 141 | 136 |
| 2019 | 142 | 100 |
| 2020 | 384 | 289 |
| 2021 | 0 | 0 |
| 2022 | 247 | 217 |
| 2023 | 0 | 0 |
| 2024 | 231 | 213 |
| 2025 | 375 | 311 |

No hay fotografías locales fechadas en 2015, 2021 ni 2023 en este inventario. Las capas de esos años deben identificarse como pendientes, o como estimaciones si se conserva el modelo. Mostrar una fotografía de otra fecha con el rótulo de esos años produciría una comparación falsa.

La edición 11019 mezcla 65 fotos de 2010, 157 de 2011 y 162 de 2012, según la ubicación. La edición 22252 mezcla fechas de 2024 y 2025. La edición más reciente también contiene fotos de 2026, que no se deben usar como observaciones de 2025. Cada lectura posterior requiere su fecha local, y cada punto corregido debe respetar la huella de esa fuente.

## Comprobaciones de unidades y procedencia

Se contrastaron 2.039 desplazamientos anteriormente aceptados con `pyproj.Geod(ellps='WGS84')`, utilizando siempre longitud/latitud y metros. La distancia geodésica real equivale a 0,994607–0,997662 veces el desplazamiento calculado por la aproximación local Mercator del proyecto: una diferencia de 0,23–0,54 m por cada 100 m. No se detectó intercambio de ejes ni una conversión de unidades de órdenes de magnitud; la interpretación del borde y el registro entre fotos dominan el error actual.

No se ha corregido ni validado marea, oleaje, pendiente de playa o registro relativo entre imágenes. Por eso se trata de cambio aparente del borde visible, no de erosión geomorfológica certificada. La comprobación de metadatos confirma la fuente y la fecha, no la exactitud física de la línea.

Fuentes reproducibles:

- Inventario completo y hashes: `docs/qa/hunucma-inventory-20261105.json`.
- Perfil y origen de la referencia anterior: `docs/qa/hunucma-profiles-20261105.csv`.
- Cobertura de cada perfil/año: `docs/qa/hunucma-year-coverage-20261105.csv`.
- Descarga acotada y paneles: `scripts/review-hunucma-photos.py`.
- Digitalización manual y verificación de cada endpoint: `scripts/digitize-hunucma-reference.py`.

## Trabajo pendiente

El cotejo independiente de las 153 referencias concluyó: detectó tres errores claros y tres refinamientos cerca de la bocana; se corrigieron las seis posiciones y se repitieron sus consultas de metadatos. El informe independiente es `docs/qa/hunucma-independent-visual-review-20261105.json`. La capa final tiene estado `independently_reviewed`, 153 referencias aprobadas y 231 pendientes, sin superposición entre ambas listas.

Se inspeccionaron los 96 paneles de ocho ediciones posteriores (27946, 18820, 15045, 20753, 10321, 64776, 25285 y 22252), sobre los 157 perfiles del sector que sí tiene foto de 2011. Se conservó el desplazamiento de 795 lecturas anteriormente aceptadas que resultaron compatibles visualmente con el borde dentro de la tolerancia operativa de 8 m. Cada posición se verificó además contra la fecha y sensor de sus propios metadatos. Las lecturas que ya estaban rechazadas no se promovieron automáticamente.

Una lectura compartida entre ediciones mostró una costura de imágenes: SC-5-0-156, captura 52, offset 32 m, identifica 22 de noviembre de 2019/WV02 en la edición 20753, pero su endpoint cae en 4 de octubre de 2019/GE01 en la edición 15045. Se bloquea solo 15045 y se conserva la fuente verificada 20753. El respaldo está en `docs/qa/hunucma-source-endpoints-baseline-20261105.json`; las aprobaciones visuales fijan el hash del panel y el offset exacto en `reviewed_readings`.

La comprobación del flujo de integración en `docs/qa/hunucma-integration-check-20261105.json` confirmó 153 referencias de 2011, 126 comparaciones fechadas de 2025, 50.490 verificaciones de referencia estable y 8.448 verificaciones de 2015 sin fotografía, delta ni trayectoria inventados. La cobertura restante por año está en `docs/qa/hunucma-verified-year-coverage-20261105.json`. Esto no constituye una validación visual de los 384 perfiles de todos los años: los 227 sin fotografía de 2011 y los intervalos sin fotografías fechadas permanecen pendientes.

Las 227 ausencias de foto de 2011 requieren localizar otra fuente fechada o permanecer explícitamente pendientes. Las cuatro bocanas ambiguas requieren una ventana mayor y decisión sobre la playa que representa cada transecto.
