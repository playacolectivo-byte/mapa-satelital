/** An explicit overlap warning cannot become a directional finding merely
 * because an older record omitted the newer boolean quality flag. */
export function coastalDirectionUnresolved(properties:Record<string,unknown>):boolean{
  return properties.direction_unresolved===true||String(properties.persistence_screen??'').split(';')[0]==='variacion_intrannual_se_superpone';
}

export type CoastalApparentDirection = 'toward-land' | 'toward-water' | 'unchanged' | null;

/** Display the signed displacement without changing its scientific quality flags.
 * A direction inside the positional uncertainty is apparent, not established.
 * Missing or pending measurements must never acquire a model fallback or zero. */
export function coastalApparentDirection(properties: Record<string, unknown>): CoastalApparentDirection {
  if (properties.context_review === true || properties.photo_review_pending === true || properties.before_reference === true) return null;
  const delta = properties.delta_m !== undefined ? properties.delta_m
    : properties.apparent_change_toward_water_m !== undefined ? properties.apparent_change_toward_water_m
    : properties.scenario_delta_m;
  if (typeof delta !== 'number' || !Number.isFinite(delta)) return null;
  if (properties.reference_only === true || delta === 0) return 'unchanged';
  return delta < 0 ? 'toward-land' : 'toward-water';
}
