# Revisión visual de contactos arena–agua, 9 de noviembre de 2026

Este registro incorpora por etapas decisiones individuales sobre las fotografías de Dzemul, Yobaín, Celestún y Progreso. Sólo las decisiones incluidas en el JSON modifican lecturas; un punto compatible visualmente no se presenta como una medición certificada.

Cada ajuste conserva el valor y estado anteriores, fecha de adquisición, edición mostrada, motivo y evidencia con SHA-256. Los índices locales de captura se resuelven contra el inventario común por perfil, fecha, sensor y edición. La aplicación exige que los valores previos coincidan exactamente. Las revisiones manuales y la evidencia de auditorías anteriores permanecen en el historial.

Las propuestas se revisaron sobre imágenes z17 y contextos de los mismos píxeles retenidos. La fecha y el sensor se verificaron en los polígonos oficiales de Esri, tanto en el nuevo contacto como a ambos lados; el archivo de evidencia conserva los controles, URL oficial y huella de la respuesta. Los intervalos de posición describen la franja visual aproximada sobre el eje del perfil. Su semiancho se registra como indicador operativo de interpretación, no como un intervalo estadístico ni como incertidumbre física total. El redondeo nominal de algunos offsets a 0.5 m no representa esa exactitud.

El contacto buscado es arena–agua conectado a la playa; una banda de arena sumergida, arena húmeda/seca o material varado no basta por sí sola para fijarlo. Si el contacto o la identidad de adquisición siguen ambiguos, la lectura se retira de las aceptadas y queda sin offset de medida. No se sustituye por un valor interpolado.

Los controles revisados conservan sus coordenadas originales frente a la grilla derivada de 100 m. Una nueva intersección entre controles requiere su propia revisión. Al ampliar a HD se conserva la observación de la imagen general de esa edición, con aviso de que el detalle aún no fue verificado; no se inventa otra posición ni precisión adicional.

No se efectuó validación de campo ni corrección de marea, oleaje o registro entre imágenes. Las diferencias son aparentes entre posiciones fotográficas; no prueban por sí solas pérdida permanente de playa.

- [Decisiones aplicables](./coastal-audit-20261109.json)
- [Decisiones de origen y controles de metadatos](./coastal-audit-20261109-evidence.json)
- [Segunda comprobación de Celestún, primera mitad](./coastal-audit-20261109-celestun-first-half-evidence.json)
- [Revisión completa de Progreso y controles de sus posiciones](./coastal-audit-20261109-progreso-evidence.json)

El conjunto final enumera 515 cambios: 349 recolocaciones de lecturas aceptadas, 66 recuperaciones y 100 retiros. Cinco lecturas de Progreso compartidas con el contexto protegido de Ixil tienen nueva comprobación independiente; su revisión anterior se conserva íntegra en el historial. La lectura protegida cuyo nuevo contexto permaneció inconcluso conserva el valor anterior. Veintitrés recolocaciones pequeñas de Progreso están dentro de su propio intervalo visual y no deben describirse como diferencias estadísticamente resueltas.

Las imágenes de revisión permanecen en el espacio de trabajo local indicado por sus rutas y huellas en la evidencia. El contenedor original de Yobaín llamado `candidate-00.jpg` contiene JSON comprimido con GZIP y relleno, no una imagen; se conservó intacto. El JSON de evidencia registra también la huella del contenido descomprimido. Este paquete no cambia por sí solo las particiones municipales ya compiladas.
