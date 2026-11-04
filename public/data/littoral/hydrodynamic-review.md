# Revisión de marea, olas y pérdida de playa

26 de octubre de 2026 · piloto Chelem, once ejes.

**Resultado: aún no se confirma pérdida de playa.** Las líneas recientes muestran cuánto se desplazó el borde aparente del agua entre dos capturas. Para saber cuánto corresponde a cambio real de la playa hacen falta controles adicionales; no se cambian las mediciones originales.

## Qué se consiguió

Se descargó el CSV público del Servicio Mareográfico Nacional de la UNAM para Progreso: 7,560 registros de un minuto, del 21 al 26 de octubre de 2026. El archivo conserva por separado pronóstico y nivel observado por radar. La página identifica el eje temporal como UTC.

Para la captura Sentinel del **25 de octubre de 2026, 16:37:42.288 UTC**, existe un registro a las **16:38:00 UTC**, 17.712 segundos después. Publica radar **5.6720 m** y pronóstico **5.427 m**. Estas son alturas en la referencia del portal: **no se interpretan como metros sobre el nivel medio del mar**. No se ha verificado aquí su datum, precisión, control de calidad ni representatividad para el agua frente al piloto de Chelem.

Solo una de las ocho fechas satelitales coincide con este archivo reciente. Faltan los niveles contemporáneos de las siete fechas anteriores, incluida la referencia del 25 de noviembre de 2021. No se sustituyen con el pronóstico actual ni con promedios mensuales.

Además se compararon los once sitios en dos pares de imágenes separados por cinco días (21–26 de octubre de 2023 y 24–29 de noviembre de 2024). Las 22 diferencias comunicadas van de **−10 a +5 m**. Es un diagnóstico de variación a corto plazo: no permite atribuir toda esa variación a marea, olas, error o erosión, ni constituye por sí solo una incertidumbre estadística.

## Qué impide confirmar erosión

- Falta una pendiente local comprobada de la franja por la que sube y baja el agua, o una estimación independiente con incertidumbre útil. No se utiliza una pendiente por defecto ni la de otra playa.
- Faltan niveles compatibles de ambas fechas de cada comparación. El registro de Progreso necesita revisar referencia vertical y representatividad local.
- Falta cuantificar elevación media y alcance de las olas en esta playa, además de validar el registro entre imágenes y la posición del agua con una referencia independiente.

No se han calculado posiciones corregidas por marea u olas ni mediciones de pérdida de playa confirmada en esta ampliación. Esto tampoco demuestra ausencia de erosión.

## Vías comprobadas para continuar

[CoastSat](https://github.com/kvos/CoastSat#24-tidal-correction-and-beach-slope-estimation) permite corregir posiciones usando niveles de agua y pendiente. [CoastSat.slope](https://github.com/kvos/CoastSat.slope) estima la pendiente a partir de una serie suficiente de posiciones y mareas. Las ocho fechas actuales son escasas e irregulares, con huecos de hasta unos 390 días; no se ha demostrado que permitan identificar esa pendiente.

La instalación oficial de [FES2022](https://github.com/kvos/CoastSat/blob/master/doc/FES2022_setup.md) requiere obtener los componentes del modelo mediante una cuenta AVISO. Se verificaron las instrucciones; no se recibieron los componentes ni se ejecutó una predicción FES para este piloto. El modelo de marea tampoco proporciona por sí solo pendiente o alcance de las olas.

Copernicus Marine tiene [reanálisis de oleaje](https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_WAV_001_032/description), cuya ficha consultada termina en agosto de 2026, y [análisis/pronóstico de oleaje](https://data.marine.copernicus.eu/product/GLOBAL_ANALYSISFORECAST_WAV_001_027/services), que incluye la fecha de octubre. Se localizaron productos y documentación, pero no se descargaron series de oleaje ni se ejecutó su transformación a la playa. La malla oceánica no equivale a una medición de las olas en cada predio.

El siguiente paso concreto es reunir niveles de las ocho fechas en una referencia vertical compatible y la pendiente del piloto; después evaluar la corrección con oleaje e incertidumbre y contrastar las posiciones con controles independientes. Una corrección de marea aislada no bastará para afirmar pérdida de arena.

## Fuentes y archivos

- [Progreso · Servicio Mareográfico Nacional, UNAM](https://www.mareografico.unam.mx/estaciones/?estacion=8) y [CSV público consultado](https://www.mareografico.unam.mx/estaciones/grdata/data-8_metros.csv). El CSV del portal cambia con el tiempo; el proyecto conserva la copia recibida con su SHA-256.
- [Comprobación de las ocho adquisiciones](./hydrodynamic-acquisitions.csv). Contiene fechas, coincidencia temporal, columnas originales diferenciadas, procedencia y motivo por el que no se aplicó una corrección.
- [Referencia de validación de algoritmos de costa y corrección de oleaje](https://github.com/SatelliteShorelines/SDS_Benchmark). No es un conjunto de mediciones locales de Chelem.

En el código editable: `scientific/pilot-1c/hydrodynamics-2026-10-26/` conserva los originales descargados, recibos, `audit.json` y las 22 diferencias. `python3 scientific/pilot-1c/audit_hydrodynamics.py` reproduce la revisión sin conexión a internet. No se contactó a terceros.
