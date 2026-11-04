import { evolutionComparison, type EvolutionIndex } from './coastal-evolution.ts';
import { publishedValues, type ErosionData, type ErosionFeature } from './problems.ts';
export const HISTORICAL_CONTEXT_PERIOD='1986–2011';
export function historicalContextForYear(inventory:ErosionData|null,index:EvolutionIndex|null,year:number):ErosionData|null {
  if(!inventory||!index||year<(index.referencePolicy==='1993'?1993:1986)||year>2011)return null;
  return {type:'FeatureCollection',features:inventory.features.flatMap(feature=>{
    const value=publishedValues(feature,'L5');
    if(!value||!value.category.startsWith('Erosión')||['available','estimated'].includes(evolutionComparison(index,feature.properties.idPol_Tran,year).status))return [];
    return [{...feature,properties:{...feature.properties,series:'L5',rate:value.rate,category:value.category,historical_context:true,historical_period:HISTORICAL_CONTEXT_PERIOD}} as ErosionFeature];
  })};
}
export function historicalContextMessage(feature:ErosionFeature,year:number) {
  const value=publishedValues(feature,'L5');if(!value||!value.category.startsWith('Erosión'))return null;
  const amount=Math.abs(value.rate).toLocaleString('es-MX',{maximumFractionDigits:2});
  const movement=value.rate===0?'un promedio redondeado de 0 m por año':`un movimiento promedio de ≈ ${amount} m por año ${value.rate<0?'hacia tierra':'hacia el mar'}`;
  return `La investigación publicada de Alec y colaboradores para 1986–2011 lo clasificó como ${value.category.toLocaleLowerCase('es-MX').replace('acreción','acumulación de arena')}, con ${movement}. Es el promedio de todo ese periodo; falta una medición anual para saber dónde estaba el agua en ${year}.`;
}
