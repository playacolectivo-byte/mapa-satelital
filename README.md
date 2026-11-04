# Mapa satelital del litoral de Yucatán

Visor de Colectivo Playa para explorar imágenes y comparaciones costeras de Celestún a El Cuyo.

**Sitio:** https://mapa-satelital.pages.dev/

Esta copia corresponde a la versión publicada el **4 de noviembre de 2026**, con menú panorámico, 13 páginas municipales y buscador de kilómetros. Conserva el código y los datos públicos preparados que utiliza esa entrega.

## Qué incluye

- Vista general y páginas independientes en `/municipio/<municipio>/`.
- Carga de datos por municipio, navegación limitada a su ventana costera y regreso al menú.
- Fechas de imagen disponibles por municipio y resultados con cálculo y fuentes consultables.
- Tres periodos: 2010–2026, investigación publicada de Alec et al. (1986–2021) y archivo histórico (1910–1985).
- Búsqueda de postes kilométricos y medios kilómetros donde existen apoyos en la red vial recibida. Los medios kilómetros se identifican como aproximados.

## Ejecutar

Requiere Node.js 22.13 o posterior y pnpm 11.25.0. No requiere claves de OpenAI, credenciales de Cloudflare ni una base de datos para visualizar el mapa.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Abre `http://127.0.0.1:4173/`. Las imágenes de proveedores externos necesitan conexión a Internet y conservan su atribución.

## Compilar y revisar

```sh
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build:public
corepack pnpm preview
```

La salida estática queda en `dist/public-map/`, con los 13 accesos municipales preparados para abrir directamente o recargar. El comando de compilación de este repositorio utiliza los datos incluidos; no vuelve a calcular mediciones ni necesita los archivos de trabajo internos.

Para generar el paquete de carga directa de Cloudflare Pages:

```sh
python3 scripts/package-pages-dashboard.py mapa-satelital-pages.zip --source dist/public-map --date 2026-11-04
```

El paquete conserva el lector de archivos agrupados utilizado por la entrega. No configura cuentas ni publica automáticamente. Las solicitudes atendidas por ese lector están sujetas a los límites del servicio de alojamiento.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `components/`, `app/`, `lib/`, `hooks/` | Interfaz y lógica del visor |
| `deployment/public-map/` | Entrada de la aplicación pública |
| `public/data/` | Datos públicos preparados, catálogos, fuentes y particiones municipales |
| `scripts/` | Compilación, empaquetado y herramientas de preparación |
| `tests/` | Verificaciones temporales, geométricas y de conservación de datos |
| `docs/` | Alcance de las páginas municipales y del buscador |

Los scripts de investigación y regeneración histórica conservados como referencia pueden requerir originales y recibos del archivo científico, que no forman parte de esta copia. No se deben ejecutar para reconstruir supuestos datos ausentes. La compilación normal usa únicamente los recursos ya preparados.

## Cómo interpretar los resultados

La fecha de una fotografía es independiente del año del análisis. El visor distingue posiciones comparadas en fotos, resultados de investigaciones publicadas y estimaciones del proyecto. Una estimación asistida por ChatGPT no constituye una medición validada en campo. El cambio aparente del borde del agua puede incluir efectos de registro, marea y oleaje; no demuestra por sí solo pérdida permanente de playa ni su causa.

Las ventanas municipales son límites de navegación operativos, no deslindes jurídicos. Un kilómetro de carretera no equivale a un kilómetro de playa.

## Datos y licencias

El código conserva su licencia MIT. Los datos y las imágenes de terceros mantienen sus condiciones y atribuciones: consulta [DATA_LICENSES.md](DATA_LICENSES.md) y los registros de fuentes del visor. No se incluyen contraseñas, sesiones, notas internas, entornos de Python, dependencias instaladas ni archivos de trabajo privados. No se incorporan capturas nuevas de Google Maps o Google Earth.

Consulta [la documentación de municipios y kilómetros](docs/MUNICIPIOS_Y_BUSCADOR_2026_11_04.md) para conocer cobertura, preparación y límites.
