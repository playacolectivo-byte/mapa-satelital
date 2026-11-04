# Barras con referencia fija · 3 de noviembre de 2026

El extremo blanco conserva una coordenada fija para cada perfil, aunque cambien el año, la cámara o la edición Esri. La barra muestra el cambio acumulado desde esa referencia: puede avanzar, retroceder o volver hacia ella; no se fuerza un deterioro creciente. Su distancia real no se amplifica para hacerla más visible. Las marcas menores que un píxel permanecen como símbolos de referencia.

## Referencia y extremos

1. Se utiliza una posición fotográfica aceptada de 2010, o de 2011 donde falta 2010. La elección se fija por perfil, independientemente de la foto que esté descargándose. Si no hay posición fotográfica aceptada de esos años, la referencia de 2011 se **reconstruye como estimación** desde la primera foto aceptada y los cambios del modelo ya existente; si tampoco hay fotos, desde la cartografía nominal de 2025. Nunca se denomina observación a esa reconstrucción.
2. Con referencia y extremo fotográficos compatibles, los metros son su diferencia sobre el mismo eje. El criterio de dirección incierta se conserva: falta de exactitud publicada o diferencia menor o igual al indicador combinado de posición. La lectura manual utiliza su tolerancia declarada en ese indicador, sin inventar dispersión de perfiles automáticos.
3. En los demás casos, el trazo discontinuo identifica una **estimación**: una posición interpolada entre fotos del mismo perfil, una extrapolación de hasta un año, una ubicación interpolada entre vecinos de la misma captura o los cambios del modelo anterior. Cada ficha indica qué recursos se usaron, las fechas fotográficas y si la referencia es reconstruida. Un año anterior a la referencia queda identificado como tal, no como cero erosión observada.

`cambio = posición del año elegido − posición fija de referencia`

Las coordenadas fotográficas se convierten con Web Mercator y la escala local por latitud. Las barras con referencia reconstruida siguen siendo estimadas aunque su extremo final proceda de una foto. Que una estimación se dibuje como línea no convierte sus extremos en costas históricas verificadas.

## Corrección localizada de Chelem

Se interpretaron manualmente 29 posiciones antes rechazadas del 1 de agosto de 2011, en los perfiles SC-90-0-0, SC-90-0-2 a SC-90-0-28 y SC-90-0-36. El trazo sigue el límite aparente de agua y arena en tres vistas registradas de la edición 11019. La intersección con cada eje produce un desplazamiento nuevo; no se traslada una cifra anterior para hacerla coincidir con la foto.

Se declara una tolerancia de trazado de 6 m, además de la exactitud publicada por el proveedor y la tolerancia instrumental existente. Es un indicador operativo, no precisión certificada ni intervalo estadístico. La foto, coordenadas de tesela, polilíneas en píxeles, hashes, valores anteriores y nuevos se conservan en [el registro separado de trazado](manual-digitization-20261103.json). Las lecturas originales y sus rechazos no se sobrescriben. Esta revisión localizada no valida individualmente los demás puntos de la costa.

## Límites

No se corrigieron marea, oleaje, estacionalidad ni registro mediante puntos de control estables. Las posiciones interpretadas, interpolaciones y modelos no confirman por sí solos pérdida permanente de playa. Las áreas sin apoyo fotográfico siguen identificadas como pendientes. No se atribuyen los valores del modelo a Alec ni se modifican sus tasas publicadas.

Fuentes: [método de posiciones fotográficas](position-method.md), [datos fotográficos recibidos](revised-data.json.gz), [modelo previo y apoyos](../scenario/model.json.gz) y [su método](../scenario/method.md). Procesamiento y revisión asistidos por ChatGPT; sin validación de campo.
