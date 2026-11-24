# Revisión visual de 22 perfiles del extremo oeste de Progreso

Revisión del 5 de noviembre de 2026, asistida por ChatGPT. Comprende los perfiles SC-258-0-30 a SC-258-0-51, los primeros 22 perfiles de playa de Progreso ordenados de oeste a este. Es el tramo de las capturas señaladas por el usuario, al oeste de Chuburná; no una revisión de todo Chelem ni del municipio.

## Refinamiento de la referencia de 2011 (segunda revisión)

Se atendió la corrección del usuario sobre la orilla indicada con una línea blanca. Se conservaron las posiciones de los puntos 1–5, 11 y 13; se revisaron por separado los puntos 6, 7, 8, 9, 10, 12, 14, 15, 16, 17, 18, 19, 20, 21 y 22. La numeración empieza en el primer perfil de Progreso al oeste: punto 1 = SC-258-0-30, punto 22 = SC-258-0-51.

La primera interpretación situó algunos cruces demasiado dentro de la franja de arena o sobre agua. Esta revisión cambia la posición de referencia en cada eje, conserva las lecturas finales de los primeros veinte perfiles y recalcula las diferencias desde la nueva base. La excepción es SC-258-0-49 en 2022: la amplia playa conectada al espigón se había confundido con agua; ese cruce también se corrigió y queda identificado por separado. Para los puntos 21 y 22 se revisaron las siete ediciones antes de incorporarlos.

El registro incluye el hash de la revisión anterior, las quince correcciones solicitadas y sus valores anteriores. Las dos capturas adjuntas se contrastaron con los puntos del visor para verificar la numeración; la guía dibujada se usó como referencia visual, no como una línea topográfica con exactitud certificada. Cada nueva posición se interpretó sobre la imagen original conservada.

## Referencia y fechas

La referencia fija de los 22 puntos es la fotografía del **1 de agosto de 2011**, edición Wayback 11019. Antes no había una lectura aceptada de esa foto en estos puntos: la aplicación reconstruía el inicio con el escenario anterior.

Se interpretaron individualmente 154 intersecciones, en siete mosaicos recibidos del proveedor:

| Edición | Fecha real en los puntos revisados |
| --- | --- |
| 11019 | 1 ago 2011, los 22 puntos |
| 27946 | 13 feb 2013, puntos 30–32; 1 dic 2011, puntos 33–51 |
| 18820 | 18 sep 2014, los 22 puntos |
| 20753 | 22 nov 2019, los 22 puntos |
| 17825 | 30 dic 2020, los 22 puntos |
| 25285 | 24 ene 2022, los 22 puntos |
| 22252 | 13 feb 2025, los 22 puntos |

**2013 tiene cobertura parcial:** los otros 19 puntos siguen sobre una foto de diciembre de 2011 en esa edición y no reciben una comparación de 2013. No se convierten años sin foto en mediciones anuales, ni se rellenan con interpolaciones o con el modelo. Las lecturas corregidas se integran en la vista habitual de Progreso; una posición incompatible permanece pendiente.

## Lectura y cálculo

Se descargaron 315 teselas de nivel 17, manteniendo sus bytes y SHA-256 en el expediente local de revisión. Se verificaron los metadatos puntuales de fecha, fuente y resolución del proveedor. Los mosaicos usan la cuadrícula Web Mercator original, sin trasladar, deformar o registrar las fotos para hacer coincidir las orillas.

En cada eje se interpretó el límite aparente continuo entre el agua y la arena, separándolo de bandas de color sumergidas, espuma aislada y el borde de vegetación. Los paneles de revisión muestran cada eje, la cartografía nominal y la intersección seleccionada. Las filas anotadas se convierten de manera reproducible en desplazamientos respecto del eje original; el tamaño de visualización de 0.5 m por píxel no aumenta la resolución de la fuente, aproximadamente 1.1 m por píxel de tesela a esta latitud y nivel.

`cambio aparente = posición revisada de la fecha final − posición revisada del 1 ago 2011`

El inicio permanece idéntico al cambiar de año. Negativo significa hacia tierra; positivo, hacia el mar. La geometría final se obtiene de la lectura de cada fecha, no desplazando una cifra anterior. Diciembre de 2011 se conserva como una lectura adicional y no sustituye la referencia de agosto.

## Incertidumbre y alcance

Se declara una tolerancia operativa de interpretación de 6 m en 2014 y 2025, y de 8 m en las demás fuentes por espuma y transiciones difusas. No es una desviación estándar ni una exactitud certificada. Se conserva por separado la exactitud publicada del proveedor y el indicador de posición que utiliza el visor. Las cifras se muestran como aproximadas; una dirección que no supera ese indicador sigue incierta.

No se dispone de controles de campo ni de puntos estables suficientes para cuantificar y corregir el registro relativo. No se corrigieron marea, pendiente, oleaje ni estacionalidad. Por tanto, el resultado describe el borde aparente de estas fotografías, no una medición validada de pérdida permanente de arena.

Los originales y sus candidatos rechazados se conservan intactos. Las nuevas lecturas y las anteriores, fechas, ediciones, coordenadas de imagen, hashes y enlaces a los metadatos están en [el registro de esta revisión](manual-progreso-oeste-20261105.json). El expediente de la segunda revisión se conserva en `work/shoreline-reference-refinement-20261105/`; los paneles y la primera revisión permanecen en `work/shoreline-review-20261105/`, fuera de la publicación pública y del control de versiones.

Fuentes de imagen: Esri World Imagery Wayback, con las atribuciones DigitalGlobe, Maxar/Vantor y sus sensores conservadas por fecha. La validación de fecha e identidad de fuente no valida la precisión física de la interpretación.
