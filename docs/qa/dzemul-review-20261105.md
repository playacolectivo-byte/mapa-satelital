# Dzemul: revisión de costa aparente, 5–6 de noviembre de 2026

Se inspeccionaron visualmente las 1,073 lecturas fotográficas recibidas de 134 perfiles (`SC-88-0-164` a `SC-88-0-297`) entre 2011 y 2025. El overlay contiene 1,072 posiciones manuales sobre el borde interpretable agua-arena, todas con segunda revisión visual independiente; una lectura queda pendiente por costura entre fotografías. Las 134 referencias iniciales corresponden realmente al 1 de agosto de 2011 y fueron revisadas además por el agente principal. El agente responsable de Hunucmá comprobó independientemente las otras 938 posiciones, sus píxeles, coordenadas, huellas, fechas y sensores, sin detectar desvíos claros mayores de 8 m. La etiqueta municipal de procedencia se conserva como `Dzemul`; este trabajo no determina jurisdicciones administrativas.

La primera lectura se hizo sobre tiras derivadas de teselas originales de Esri Wayback a z17, a lo largo de cada perfil y sus vecinas. Se anotaron manualmente coordenadas sobre el borde visible, se redondearon a metros y se volvió a dibujar cada propuesta para comprobar su correspondencia con la imagen. Los candidatos automáticos RGB se mantuvieron separados: en 2020, 2022 y 2025 varios señalaban frentes cromáticos de agua somera, decenas de metros mar adentro. No se promovieron por superar un umbral automático. Las 1,072 posiciones propuestas se verificaron además contra los polígonos oficiales de procedencia en el extremo corregido, comprobando fecha y sensor.

La tolerancia operativa de interpretación es de 8 m. No es una desviación estándar, exactitud certificada ni cota total del cambio físico de costa. No están resueltos globalmente marea, oleaje, pendiente de playa, registro relativo entre escenas y diferencias de datum vertical. La imagen z17 equivale a unos 1.11 m por píxel en el terreno; la resolución nominal original del sensor no convierte esta digitalización en una medición de centímetros. La aproximación métrica del mapa se contrastó con WGS84/Geod: discrepancia máxima 0.231 m en los desplazamientos propuestos.

| Año real | Perfiles con propuesta | Pendientes |
| --- | ---: | ---: |
| 2011 | 134 | 0 |
| 2012 | 134 | 0 |
| 2013 | 50 | 84 |
| 2014 | 0 | 134 |
| 2015 | 84 | 50 |
| 2016 | 0 | 134 |
| 2017 | 0 | 134 |
| 2018 | 0 | 134 |
| 2019 | 133 | 1 |
| 2020 | 91 | 43 |
| 2021 | 0 | 134 |
| 2022 | 70 | 64 |
| 2023 | 123 | 11 |
| 2024 | 0 | 134 |
| 2025 | 134 | 0 |

El pendiente de 2019 es `SC-88-0-236`, captura 188, nominalmente 12 de octubre de 2019/WV02: el borde propuesto se encuentra en la huella 30 de septiembre de 2019/WV03. Ya estaba rechazado por `capture_footprint_seam`. Se conserva pendiente, con desplazamiento numérico nulo en el cuadro anual; no se transforma la costura de mosaico en una nueva observación de fecha inventada. En los otros huecos no se recibió fotografía realmente fechada en ese año. El cuadro anual explicita esos vacíos y no los completa con interpolación presentada como medición.

La edición 22252 no representa una fotografía homogénea de 2025: incluye huellas reales de marzo de 2022, julio de 2023 y abril de 2025. La edición 18820 contiene mayo de 2013 en 50 perfiles, febrero de 2015 en 62 y marzo de 2015 en 22. Las fechas del overlay siempre son las de adquisición comprobadas, no las de publicación del servicio. Las observaciones reales de 2025 incluidas aquí proceden de abril, octubre, noviembre y diciembre, según el perfil.

Se conservaron 814 teselas originales con SHA-256, las respuestas originales de procedencia, los manifiestos, las anotaciones y los paneles. Los controles comprobaron cobertura exacta de las 1,073 lecturas, unicidad de claves, referencias de 2011, valores anteriores, hashes, fecha/sensor, escala y coordenadas. No falló ninguna comprobación de integridad. Se recuperaron 232 lecturas antes rechazadas que sí resultaron interpretables visualmente. Entre los desplazamientos anteriores no nulos, la modificación mediana es de 2 m; 42 ajustes superan 20 m y el máximo es de 140 m. La validación física de campo permanece pendiente.

Archivos de entrega:

- `public/data/shorelines/photo-alignment/manual-dzemul-20261105.json`: overlay con propuestas, fuentes, referencia fija y rechazo explícito.
- `docs/qa/dzemul-review-validation-20261105.json`: controles y estadísticas.
- `docs/qa/dzemul-year-coverage-20261105.csv`: estado de cada perfil/año; vacíos sin medida numérica.
- `docs/qa/dzemul-manual-reference-20261105.csv` y `dzemul-manual-years-20261105.csv`: anotaciones y posiciones anteriores.
- `docs/qa/dzemul-independent-reference-review-20261105.json`: segunda revisión independiente de las 134 referencias iniciales.
- `docs/qa/dzemul-independent-temporal-review-20261105.json`: segunda revisión independiente de las otras 938 posiciones.
- `work/dzemul-audit-20261105/manual-reference-*.png` y `manual-year-*.png`: naranja = propuesta manual; cian = lectura anterior; verde/rojo = candidato RGB separado.

Reproducción: ejecutar `review-dzemul-coast.py`, `digitize-dzemul-reference.py`, `panel-dzemul-years.py`, `digitize-dzemul-years.py` y `audit-dzemul-review.py`, en ese orden. Las descargas usan caché, hasta cuatro trabajadores, HTTPS con validación normal y seguimiento limitado a redirecciones oficiales de ArcGIS. Las habilidades aplicadas fueron las instaladas de pyproj, Rasterio y evaluación de incertidumbre/unidades; no se agregó una habilidad de procedencia no evaluada.
