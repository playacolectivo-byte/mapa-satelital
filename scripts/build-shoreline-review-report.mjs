import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const audit=read('docs/qa/municipal-shoreline-complete-audit-20261106.json');
if(audit.status!=='pass')throw new Error('La auditoría municipal no pasó');
const names={progreso:'Progreso',hunucma:'Hunucmá',dzemul:'Ámbito original Dzemul'};
const rows=audit.municipalities.map(m=>{
 const review=read(`public/data/shorelines/photo-alignment/manual-${m.slug==='progreso'?'progreso-full':m.slug}-20261105.json`);
 return {...m,corrections:review.corrections.length,confirmed:review.reviewed_readings?.length??0};
});
const originals=['public/data/shorelines/photo-alignment/revised-data.json','public/data/shorelines/scenario/model.json','public/data/coastal-places.json'];
const hashes=originals.map(p=>`- \`${p}\`: \`${createHash('sha256').update(readFileSync(new URL(p,root))).digest('hex')}\``);
const text=`# Revisión del mapa costero, 6 de noviembre de 2026

Se revisaron las fotografías disponibles entre 2011 y 2025 de Progreso, Hunucmá y el ámbito originalmente identificado como Dzemul. La base se fija en una fotografía real de 2011; los extremos de las otras fechas se interpretan por separado sobre el borde aparente entre arena y mar. Una lectura no revisada, una fecha ausente o una base no interpretable permanece pendiente y no produce metros.

| Ámbito original | Perfiles de playa | Bases 2011 interpretables | Bases pendientes | Pares perfil–captura aprobados |
|---|---:|---:|---:|---:|
${rows.map(m=>`| ${names[m.slug]} | ${m.profiles} | ${m.references} | ${m.reference_gaps} | ${m.reviewed_endpoint_pairs} |`).join('\n')}

Los pares aprobados incluyen la propia base y solo se muestran como comparación en las ediciones expresamente verificadas. No equivalen a cobertura de todos los perfiles en todos los años. La [matriz completa de 16,710 filas](municipal-shoreline-year-matrix-20261106.csv) distingue foto disponible, lectura revisada y base ausente por perfil y año. El [informe automático](municipal-shoreline-complete-audit-20261106.json) terminó sin fallos.

En Progreso se conservaron los primeros cinco puntos que el usuario había considerado correctos y se dio prioridad a las 47 intersecciones con sus guías blancas. Las guías se registraron contra la fotografía original; las comprobaciones sobre las seis capturas están en los archivos \`guia-2011-*-verificada.png\`. Se inspeccionaron las 4,592 lecturas fechadas existentes: 4,547 quedaron aprobadas, 44 pendientes por estructuras, sombras u otras ambigüedades y una edición rechazada por metadatos incompatibles. Una fotografía publicada en 2026 puede contener una captura de 2025: se usa la fecha efectiva de captura. Al abrir 2011, se prioriza la edición que contiene las bases de agosto, también en Chelem y Chuburná.

La corrección de 2015 distingue la fecha de captura de la publicación de Esri. Progreso tiene fotografía de marzo de 2015 en parte de su costa; no se extiende esa fecha a Chelem, Chuburná ni Hunucmá cuando no existe. El visor permite consultar el año y avisa que los perfiles quedan pendientes, sin interpolar cifras entre fotografías.

En Hunucmá, 227 perfiles carecen de fotografía de 2011 en el inventario recibido y cuatro referencias coinciden con bocanas o contactos ambiguos. Se conservan como localizadores pendientes. Progreso tiene tres referencias pendientes en estructuras; el ámbito original Dzemul tiene sus 134 referencias interpretables. Estos casos explican las 234 bases pendientes entre los tres ámbitos.

La ampliación final de Hunucmá examinó otras 394 lecturas fechadas sobre perfiles con base válida: 386 ajustes quedaron verificados por dos revisores y ocho permanecen pendientes, seis por una fecha distinta en el contacto visible y dos por ambigüedad del borde. En el ámbito original Dzemul se aceptaron 1,072 de 1,073 lecturas inspeccionadas; una costura del mosaico de 2019 conserva la fecha incompatible y no produce una cifra. Estos pendientes se suman a los años sin fotografía y no se rellenan con interpolaciones.

Las revisiones tienen paneles conservados, decisiones manuales y contraste independiente de otros agentes. Se verificaron fecha y sensor en la coordenada del extremo, conservando consultas de Esri y huellas de las imágenes; una validación de metadatos no sustituye la inspección visual. Los archivos de revisión separan correcciones, confirmaciones y rechazos. Las tolerancias de 8 m, o 2 m para digitalizar las guías, son operativas y no certifican exactitud física. No se aplicó corrección de marea, oleaje, pendiente de playa ni registro relativo completo entre fechas; el resultado sigue siendo **cambio aparente**.

Se muestran **Ixil San Benito** e **Ixil San Bruno** como rótulos del proyecto en las localidades existentes. No se modificaron claves, coordenadas, rutas ni asignaciones originales. **Ixil Poniente queda sin asignar** porque no se encontró un tramo definido con suficiente certeza; no se inventó un cuarto nombre. La [nota de fuentes oficiales y nombres](../../public/data/project-coast-labels-20261105.md) documenta las diferencias entre INEGI y otros documentos del gobierno y no afirma que Dzemul carezca de playa ni resuelve jurisdicción.

Se mantuvo la libertad de navegación al poniente de Progreso y el enlace al vecino Hunucmá. No se restituyó el aviso que tapaba los primeros puntos. Se corrigió la selección de ediciones para ofrecer las fotografías que realmente tienen lecturas aprobadas en cada ámbito; no se toman fotografías de otros sectores para aparentar cobertura local.

Se aplicaron las skills geoespaciales ya instaladas para geodesia, transformación de coordenadas, lectura de rásteres, fuentes y unidades. No se añadieron skills sin procedencia verificable. Se conservaron los originales científicos y se generaron capas derivadas reversibles; no se publicó ni se envió ningún cambio a GitHub.

Huellas de los originales conservados:

${hashes.join('\n')}

La validación de código y la previsualización se registran por separado en \`revision-validacion-20261106.json\`. El repositorio ya presentaba 56 incidencias de lint; la comparación con HEAD, en \`lint-comparison-20261106.json\`, no encontró incidencias nuevas. Estas incidencias previas siguen pendientes.
`;
writeFileSync(new URL('docs/qa/revision-mapa-20261106.md',root),text);
console.log(JSON.stringify({report:'docs/qa/revision-mapa-20261106.md',rows}));
