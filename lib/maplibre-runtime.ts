// The raster viewer does not need WebGL styles or its engine on first load.
// Keep both together behind the optional WebGL renderer's dynamic import.
import 'maplibre-gl/dist/maplibre-gl.css';
export { Map, Marker, Popup, ScaleControl } from 'maplibre-gl';
