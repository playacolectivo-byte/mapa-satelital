import { ArrowUpRight, Download } from 'lucide-react';
import { ExplanationPoints } from './explanation-points';

export function EarthPanel() {
  return <div className="earth-guide">
    <ExplanationPoints points={[
      { label: 'Abre Earth Pro.', text: 'Es una aplicación aparte para tu computadora. El mapa de esta página usa imágenes de Esri o Sentinel.' },
      { label: 'Carga el proyecto.', text: 'Descarga el archivo KMZ de abajo y ábrelo con Archivo → Abrir. Lleva las capas y sus fuentes; no incluye fotos copiadas de Google.' },
      { label: 'Elige una fecha.', text: 'Usa Ver → Imágenes históricas y mueve el reloj. Las fotos tienen sus propias fechas; los estudios conservan su periodo, aunque cambies la imagen.' },
    ]} />
    <a className="text-link" href="/data/earth/Celda_Chelem_Earth_Pro.kmz" download>Proyecto para Earth Pro <Download /></a>
    <a className="text-link" href="https://www.google.com/intl/es/earth/about/versions/" target="_blank" rel="noreferrer">Descarga oficial de Google <ArrowUpRight /></a>
    <a className="text-link" href="/data/earth/receipt.json" target="_blank" rel="noreferrer">Contenido y preparación del proyecto <ArrowUpRight /></a>
  </div>;
}
