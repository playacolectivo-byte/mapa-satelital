# Escenario orientativo generado con ayuda de ChatGPT

**Sin validación científica local.** Este archivo conserva el modelo hipotético para 2010–2026 y 13 municipios. Sus cifras no son nuevas mediciones, conclusiones verificadas de erosión ni un aval profesional. El visor abre «Fotos y estimaciones»; «Fotos comparadas» conserva por separado las parejas fotográficas aceptadas.

## Datos restaurados y representación revisada · 2 de noviembre de 2026

Se conserva el escenario original de 4,356 puntos, con base 2010 y 17 años,
sin modificar el modelo ni las cifras descargables. La revisión posterior
de ubicación distingue 3,110 perfiles de playa de 493 perfiles sobre obras
y 753 de otros tipos de costa. Las obras y los demás tipos no se presentan
como barras de pérdida de playa. Sus antecedentes siguen en los originales.

En la vista «Fotos y estimaciones», una barra exige dos orillas fotográficas
compatibles y su distancia se recalcula de forma independiente del modelo.
Si falta esa pareja, la cifra del modelo se conserva en un punto y no se
dibuja una segunda orilla hipotética. El punto puede localizarse en la toma,
interpolarse con apoyos de la misma captura o seguir cartográfico, por revisar.
Cada caso se identifica al pulsarlo. Véase la
[revisión de posiciones y distancias](../photo-alignment/position-method.md).

El año del análisis y la fecha del fondo son independientes. Si no hay una
foto compatible del año modelado, se conserva una foto de referencia con su
fecha propia; nunca se la presenta como una captura de ese año. Los extremos
simulados no se ajustan a la foto para aparentar una medición. El cambio de
representación no convierte la magnitud original en una observación.

## Qué se utiliza

- Inventario recibido de 2,884 perfiles y sus comparaciones preliminares. Se utilizan valores de la categoría procesada (`status=1`), aunque la dirección pueda seguir marcada como incierta. Esto no elimina su incertidumbre. Las capturas o ventanas parciales disponibles no representan un seguimiento completo de cada año; el escenario las utiliza como incrementos de calendario por convenio.
- Cartografía costera INEGI recibida, con insumos de 2023–2025. Se añaden puntos cada 100 m sobre las líneas físicas de playa, vegetación, rompeolas y construcciones. No se numeran como erosión las líneas virtuales de cierre. Esta es cobertura de la cartografía disponible en el área del proyecto, no una auditoría de cada metro físico ni de cada predio.
- Los municipios dudosos y los puntos nuevos se asignan por proximidad a los perfiles conocidos. La ficha lo identifica como atribución aproximada; los límites originales no se modifican.

## Regla de estimación reproducible

1. Por punto y año con apoyos, se eligen hasta cinco perfiles procesados más cercanos. Se calcula una mediana ponderada con pesos proporcionales a `1 / max(distancia,250m)²`. Esta suavización es una decisión del escenario, no un modelo costero calibrado.
2. Entre años con apoyos se interpola linealmente. Antes del primer año disponible y después del último se mantiene la tasa del año de apoyo más cercano. En particular, la serie anterior a 2016 es una proyección retrospectiva; no observaciones de esos años. Los años y perfiles usados están guardados en el modelo.
3. Los cambios anuales se redondean a metros enteros. Para comparar con 2010, 2015 o 2020 se suman los incrementos anuales posteriores a la base. No se obliga a que el cambio tenga siempre signo de retroceso. El inicio de un acumulado es cero por definición gráfica, no porque se haya comprobado ausencia de erosión.
4. Se usa la cartografía actual como ancla nominal de 2025. Los extremos de otros años se simulan sumando o restando los incrementos sobre una normal aproximada. La orientación usa los cambios firmados ya recibidos y, donde faltan, un apoyo cercano. Para la cartografía adicional se orienta su normal por ese apoyo. **Los extremos no reconstruyen posiciones históricas comprobadas del agua.** La foto conserva su fecha real.

## Cómo interpretar las cifras

Las líneas discontinuas y la etiqueta «Escenario sin validar» identifican esta capa. Rojo y verde muestran el signo supuesto del escenario; no certifican daño o recuperación. Una cifra próxima a cero tampoco certifica estabilidad. El procedimiento no está calibrado para costas vegetadas o construidas, tormentas, puertos, espolones ni cambios estacionales.

No se corrigieron marea, oleaje, registro, pendiente ni diferencias entre sensores. No se cuantificó el error físico ni se verificó la hipótesis con trabajo de campo. La distancia a los apoyos puede ser grande. Los ejemplos de la ficha corresponden al primer y último año de apoyo; todos los apoyos y pesos reproducibles están en los datos descargables. La cobertura gráfica completa no equivale a cobertura científica validada.

## Datos y reproducción

- [Modelo completo, parámetros, perfiles de apoyo y huellas SHA256](model.json.gz)
- [Cifras de cada tramo y año, CSV comprimido](values.csv.gz)
- [Inventario y alcance del escenario](manifest.json)
- [Método de los datos preliminares de referencia](../series-2015/method.md)

Se reproduce con `node scripts/build-coastwide-scenario.mjs`. Ese programa lee los datos existentes y escribe únicamente este apartado; no cambia los originales, Alec ni el archivo 1910–1985. Las comprobaciones de software verifican aritmética, procedencia y cobertura del escenario, no su exactitud física. El año 2026 sigue siendo parcial en sus datos de apoyo y no representa un año observado completo.
