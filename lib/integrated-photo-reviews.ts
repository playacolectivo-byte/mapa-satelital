import type {PhotoCoastData} from './photo-coast.ts';
import {applyDatedImageReview,type DatedImageReview} from './dated-image-review.ts';
import {datedImageReviews} from './dated-image-reviews.ts';
import {applyPhotoPilotReview,type PhotoPilotReview} from './photo-pilot-review.ts';
import {applyUserShorelineGuides,type UserShorelineGuides} from './user-shoreline-guides.ts';
import {applyCurrentMunicipalReviews} from './current-shoreline-reviews.ts';
import {applyRegionalShorelineReviews} from './regional-shoreline-reviews.ts';
import {applyCoastalAuditReview,type CoastalAuditReview} from './coastal-audit-reviews.ts';
import pilot from '../public/data/shorelines/photo-alignment/manual-progreso-oeste-20261105.json' with {type:'json'};
import guides from '../public/data/shorelines/photo-alignment/user-guides-2011-20261105.json' with {type:'json'};
import coastalAudit from './generated/coastal-audit-20261109.json' with {type:'json'};
import dzemulAudit from './generated/coastal-audit-dzemul-20261113.json' with {type:'json'};
import progresoAudit from './generated/coastal-audit-progreso-2025-20261113.json' with {type:'json'};
import progresoIxilAudit from './generated/coastal-audit-progreso-ixil-20261113.json' with {type:'json'};
import progreso2022Audit from './generated/coastal-audit-progreso-2022-20261113.json' with {type:'json'};
import progresoRecoveryAudit from './generated/coastal-audit-progreso-recoveries-20261113.json' with {type:'json'};
import progresoScreenshotAudit from './generated/coastal-audit-progreso-screenshots-20261113.json' with {type:'json'};
import progresoWithdrawalAudit from './generated/coastal-audit-progreso-2012-endpoint-20261113.json' with {type:'json'};
import progreso2012Recovery from './generated/coastal-audit-progreso-2012-recuperacion-20261115.json' with {type:'json'};
import ixilMarked2025 from './generated/coastal-audit-ixil-2025-marcas-20261116.json' with {type:'json'};
import audit20261116Malecon from './generated/coastal-audit-progreso-malecon-20261116.json' with {type:'json'};
import audit20261116Oriente from './generated/coastal-audit-progreso-oriente-20261116.json' with {type:'json'};
import audit20261116CostaAislada from './generated/coastal-audit-ixil-costa-aislada-20261116.json' with {type:'json'};
import audit20261116Espolones from './generated/coastal-audit-progreso-espolones-20261116.json' with {type:'json'};
import audit20261116PuntosRojos from './generated/coastal-audit-ixil-puntos-rojos-20261116.json' with {type:'json'};
import audit202611162014Anual from './generated/coastal-audit-progreso-2014-anual-20261116.json' with {type:'json'};
import audit20261116Espolones2019 from './generated/coastal-audit-progreso-espolones-2019-20261116.json' with {type:'json'};
import audit202611162020Anual from './generated/coastal-audit-progreso-2020-anual-20261116.json' with {type:'json'};
import audit20261116Anual20222023 from './generated/coastal-audit-progreso-anual-2022-2023-20261116.json' with {type:'json'};
import audit202611162014Resto from './generated/coastal-audit-progreso-2014-resto-20261116.json' with {type:'json'};
import audit20261116ComparacionFotografica from './generated/coastal-audit-progreso-comparacion-fotografica-20261116.json' with {type:'json'};
import audit20261116Yucalpeten from './generated/coastal-audit-progreso-yucalpeten-20261116.json' with {type:'json'};
import audit20261116RojosAbril from './generated/coastal-audit-progreso-rojos-abril-20261116.json' with {type:'json'};
import audit20261116Captura2015 from './generated/coastal-audit-ixil-captura-2015-20261116.json' with {type:'json'};
import audit202611162012Resto from './generated/coastal-audit-progreso-2012-resto-20261116.json' with {type:'json'};

/** Each independently versioned review checks the unchanged common input.
 * Latest local dated reviews win only for their explicitly audited profiles;
 * applying one branch's offsets as another branch's raw observations is invalid. */
export async function applyIntegratedPhotoReviews(data:PhotoCoastData,sha:string,load:(url:string,sha:string)=>Promise<DatedImageReview>,audit:CoastalAuditReview|null=coastalAudit as CoastalAuditReview):Promise<PhotoCoastData>{
 let local=data;
 const protectedIds=new Set<string>();
 for(const version of datedImageReviews){
  const review=await load(version.url,version.sha256);
  local=applyDatedImageReview(local,review,sha,version);
  for(const decision of review.decisions)protectedIds.add(decision.profile_id);
 }
 const pilotData=applyPhotoPilotReview(data,pilot as PhotoPilotReview,sha);
 const guided=applyUserShorelineGuides(pilotData,guides as UserShorelineGuides,sha);
 const remote=applyRegionalShorelineReviews(applyCurrentMunicipalReviews(guided,sha),sha);
 if(remote.targets.length!==local.targets.length||remote.targets.some((row,i)=>row.id!==local.targets[i].id)||JSON.stringify(remote.captures)!==JSON.stringify(local.captures))throw new Error('Inventarios de revisión incompatibles');
 const merged={...remote,targets:remote.targets.map((row,i)=>{if(protectedIds.has(row.id))return local.targets[i];const clean={...row};if(!clean.fixed_reference)delete clean.fixed_reference;if(!clean.reference_unavailable)delete clean.reference_unavailable;return clean;})};
 const reviewed=applyCoastalAuditReview(merged,audit,sha);
 if(audit!==coastalAudit)return reviewed;
 const withDzemul=applyCoastalAuditReview(reviewed,dzemulAudit as CoastalAuditReview,sha);
 const withProgreso=applyCoastalAuditReview(withDzemul,progresoAudit as CoastalAuditReview,sha);
 const withProgresoIxil=applyCoastalAuditReview(withProgreso,progresoIxilAudit as CoastalAuditReview,sha);
 const withProgreso2022=applyCoastalAuditReview(withProgresoIxil,progreso2022Audit as CoastalAuditReview,sha);
 const withRecoveries=applyCoastalAuditReview(withProgreso2022,progresoRecoveryAudit as CoastalAuditReview,sha);
 const withScreenshots=applyCoastalAuditReview(withRecoveries,progresoScreenshotAudit as CoastalAuditReview,sha);
 const withWithdrawal=applyCoastalAuditReview(withScreenshots,progresoWithdrawalAudit as CoastalAuditReview,sha);
 const withProgreso2012=applyCoastalAuditReview(withWithdrawal,progreso2012Recovery as CoastalAuditReview,sha);
 const withAudit20261116Malecon=applyCoastalAuditReview(withProgreso2012,ixilMarked2025 as CoastalAuditReview,sha);
 const withAudit20261116Oriente=applyCoastalAuditReview(withAudit20261116Malecon,audit20261116Malecon as CoastalAuditReview,sha);
 const withAudit20261116CostaAislada=applyCoastalAuditReview(withAudit20261116Oriente,audit20261116Oriente as CoastalAuditReview,sha);
 const withAudit20261116Espolones=applyCoastalAuditReview(withAudit20261116CostaAislada,audit20261116CostaAislada as CoastalAuditReview,sha);
 const withAudit20261116PuntosRojos=applyCoastalAuditReview(withAudit20261116Espolones,audit20261116Espolones as CoastalAuditReview,sha);
 const withAudit202611162014Anual=applyCoastalAuditReview(withAudit20261116PuntosRojos,audit20261116PuntosRojos as CoastalAuditReview,sha);
 const withAudit20261116Espolones2019=applyCoastalAuditReview(withAudit202611162014Anual,audit202611162014Anual as CoastalAuditReview,sha);
 const withAudit202611162020Anual=applyCoastalAuditReview(withAudit20261116Espolones2019,audit20261116Espolones2019 as CoastalAuditReview,sha);
 const withAudit20261116Anual20222023=applyCoastalAuditReview(withAudit202611162020Anual,audit202611162020Anual as CoastalAuditReview,sha);
 const withAudit202611162014Resto=applyCoastalAuditReview(withAudit20261116Anual20222023,audit20261116Anual20222023 as CoastalAuditReview,sha);
 const withAudit20261116ComparacionFotografica=applyCoastalAuditReview(withAudit202611162014Resto,audit202611162014Resto as CoastalAuditReview,sha);
 const withAudit20261116Yucalpeten=applyCoastalAuditReview(withAudit20261116ComparacionFotografica,audit20261116ComparacionFotografica as unknown as CoastalAuditReview,sha);
 const withAudit20261116RojosAbril=applyCoastalAuditReview(withAudit20261116Yucalpeten,audit20261116Yucalpeten as unknown as CoastalAuditReview,sha);
 const withAudit20261116Captura2015=applyCoastalAuditReview(withAudit20261116RojosAbril,audit20261116RojosAbril as unknown as CoastalAuditReview,sha);
 const withAudit202611162012Resto=applyCoastalAuditReview(withAudit20261116Captura2015,audit20261116Captura2015 as unknown as CoastalAuditReview,sha);
 return applyCoastalAuditReview(withAudit202611162012Resto,audit202611162012Resto as unknown as CoastalAuditReview,sha);
}
