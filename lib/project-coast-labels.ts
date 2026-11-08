/** Display names requested by the project. Source keys, locality codes and
 * geographical assignments are retained independently and are not renamed. */
export const PROJECT_COAST_LABEL_NOTE='Rótulos del proyecto; la jurisdicción y los límites legales no están verificados.';
export function projectCoastLabel(sourceName:string):string{
 return sourceName==='Dzemul'?'Ixil San Benito · Ixil San Bruno':sourceName;
}
export function projectPlaceLabel(sourceName:string,localityCode?:string):string{
 if(localityCode==='310260035'||sourceName==='San Benito')return 'Ixil San Benito';
 if(localityCode==='310260004'||sourceName==='San Bruno')return 'Ixil San Bruno';
 return projectCoastLabel(sourceName);
}
export const hasProjectCoastLabel=(name:string)=>name==='Dzemul'||name==='San Benito'||name==='San Bruno';
