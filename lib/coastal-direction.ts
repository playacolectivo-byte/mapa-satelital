/** An explicit overlap warning cannot become a directional finding merely
 * because an older record omitted the newer boolean quality flag. */
export function coastalDirectionUnresolved(properties:Record<string,unknown>):boolean{
  return properties.direction_unresolved===true||String(properties.persistence_screen??'').split(';')[0]==='variacion_intrannual_se_superpone';
}
