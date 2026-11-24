# Referencia de 2011 a partir de las líneas blancas del usuario

Se adoptaron 47 cruces de perfiles existentes con los trazos blancos de las seis capturas aportadas el 5 de noviembre de 2026. La fecha de referencia es el 1 de agosto de 2011. Esta capa de corrección sustituye exclusivamente esas posiciones de partida; los perfiles fuera de las líneas y las lecturas de otras fechas se conservan.

## Cómo se ubicaron los trazos

Cada captura se localizó sobre las teselas originales de Esri Wayback 11019, nivel 17, mediante correspondencias de detalles de la fotografía. Se verificaron entre 106 y 2321 correspondencias por captura. El error mediano de ajuste fue inferior a 0.10 píxeles de la tesela; este error describe la localización de la captura, no la exactitud física de la costa ni del trazo a mano.

Se extrajeron los píxeles blancos de los trazos, excluyendo encabezados, controles, texto y componentes pequeños. Cada posición se obtuvo del cruce del eje del perfil con el centro del grosor del trazo. Se conservan el archivo y su hash, la matriz de captura a tesela, la coordenada del cruce y los metadatos oficiales consultados en esa coordenada. La fotografía original no se desplazó para hacer coincidir los puntos.

Cinco perfiles aparecen en capturas solapadas. Se eligió la captura donde el cruce queda más lejos de los bordes laterales y se guardaron ambas alternativas. Los trazos solapados difieren hasta unos 9 m; representan indicaciones manuales distintas sobre el mismo lugar. En dos cruces con un pequeño trazo de retorno se eligió la rama superior que continúa la línea principal. No se promediaron posiciones que podrían quedar fuera del trazo.

## Cálculo para los demás años

La referencia elegida permanece fija al cambiar de año, imagen o nivel de acercamiento. Las comparaciones posteriores se recalculan como posición final menos posición de referencia. Las posiciones finales fotografiadas no se trasladan junto con la base. La foto de diciembre de 2011 no sustituye a la de agosto.

Una corrección de la base no valida automáticamente las fotos posteriores. Los extremos interpretados, interpolados o estimados conservan su identificación; las fechas sin comparación compatible mantienen su condición de pendientes. Antes de 2011 no se inventa una medición desde esta referencia.

## Alcance de la precisión

Los 2 m asignados a la digitalización representan una tolerancia operativa del cruce con un trazo dibujado, no una precisión topográfica certificada. El visor combina por separado la exactitud de posición publicada por el proveedor. No se aplicaron correcciones de marea, oleaje, pendiente ni registro relativo entre años; no hay validación de campo.

El [registro de cruces y decisiones](user-guides-2011-20261105.json) conserva los valores anteriores y las alternativas. Las capturas, teselas y verificaciones visuales se retienen localmente en `work/shoreline-user-guides-20261105/`, fuera de la publicación. Fuentes de la fotografía: Esri World Imagery Wayback y sus proveedores, conservados en los metadatos por punto.
