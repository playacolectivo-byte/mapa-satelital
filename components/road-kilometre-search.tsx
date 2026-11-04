'use client';
import {useEffect,useState} from 'react';
import {findRoadKilometre,parseRoadKilometre,type RoadSearchRecord} from '@/lib/road-search';
export function RoadKilometreSearch({records,onSelect}:{records:RoadSearchRecord[];onSelect:(record:RoadSearchRecord)=>void}){
 const roads=[...new Set(records.map(r=>r.road))].sort();
 const [open,setOpen]=useState(false),[road,setRoad]=useState(roads[0]??''),[value,setValue]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{if(!roads.includes(road))setRoad(roads[0]??'');},[records,road]);
 return <div className="road-search">
  <button type="button" className="road-search-toggle" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>Buscar km</button>
  {open&&<form className="road-search-panel" aria-label="Buscador de kilómetros" onSubmit={e=>{e.preventDefault();const found=findRoadKilometre(records,road,value);if(!found){setMessage(parseRoadKilometre(value)===null?'Escribe un kilómetro, por ejemplo 12 o 12.5.':'No hay una ubicación disponible para ese kilómetro en este municipio.');return;}setMessage(found.kind==='official'?'Poste de referencia RNC.':'Ubicación aproximada entre dos postes, siguiendo la carretera.');onSelect(found);setOpen(false);}}>
   <label>Carretera<select aria-label="Carretera del buscador" value={road} onChange={e=>{setRoad(e.target.value);setMessage('');}}>{roads.map(r=><option key={r}>{r}</option>)}</select></label>
   <label>Kilómetro<input aria-label="Kilómetro a buscar" inputMode="decimal" placeholder="Ej. 12.5" list="available-road-km" value={value} onChange={e=>{setValue(e.target.value);setMessage('');}}/></label>
   <datalist id="available-road-km">{records.filter(r=>r.road===road).sort((a,b)=>a.km-b.km).map(r=><option key={r.id} value={r.km}/>)}</datalist>
   <button type="submit" disabled={!records.length}>Ir al kilómetro</button>
   {!records.length&&<p>Aún no hay postes de referencia recibidos para esta zona.</p>}
   <output aria-live="polite">{message}</output>
  </form>}
 </div>;
}
