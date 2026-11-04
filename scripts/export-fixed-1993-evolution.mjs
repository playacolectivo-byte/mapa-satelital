/** Derived fixed-1993 comparisons. Never modifies observations or legacy exports. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { stableGzip } from './stable-gzip.mjs';
import { createEvolutionIndex, evolutionComparison, validateEvolutionCatalogue } from '../lib/coastal-evolution.ts';
import { validateAlecTrends } from '../lib/alec-trend.ts';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const quote = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
const periodText = (model, catalogue) => model ? `${catalogue.periods[model.series].start}–${catalogue.periods[model.series].end}` : '';
const protectedFiles = [
  'public/data/littoral/coastal-evolution.json',
  'public/data/littoral/alec-trend-models.json',
  'public/data/problems/s34-l5.geojson', 'public/data/problems/s34-l8.geojson', 'public/data/problems/s34-s2.geojson',
  'public/data/littoral/measurements.csv', 'public/data/littoral/changes-from-1986.csv',
  'public/data/littoral/changes-from-1986.csv.gz',
  'public/data/littoral/changes-from-first-observation.csv.gz',
  'public/data/littoral/alec-trend-estimates.csv.gz',
];

export async function exportFixed1993Evolution() {
  const before = Object.fromEntries(await Promise.all(protectedFiles.map(async path => [path, sha(await read(path))])));
  const catalogue = validateEvolutionCatalogue(JSON.parse(await read(protectedFiles[0])));
  const trends = validateAlecTrends(JSON.parse(await read(protectedFiles[1])));
  for (const [path, expected] of Object.entries(trends.input_sha256)) {
    if (sha(await read(path)) !== expected) throw new Error('Scientific input changed: ' + path);
  }
  const inventory = new Set();
  for (const path of protectedFiles.slice(2, 5))
    for (const f of JSON.parse(await read(path)).features) inventory.add(f.properties.idPol_Tran);
  const index = createEvolutionIndex(catalogue, { referencePolicy: '1993', trends });
  if (index.references.size !== 0 || index.baselineEstimates.size !== 4710 || index.baselineValues.size !== 4710)
    throw new Error('Unexpected reviewed baseline coverage; reassess before exporting');
  const fields = [
    'transect_id', 'selected_year', 'kind', 'baseline_year', 'baseline_kind', 'baseline_provenance',
    'baseline_observation_date', 'baseline_observation_product',
    'baseline_evaluation_date_not_capture', 'baseline_model_anchor_date', 'baseline_model_anchor_product',
    'baseline_alec_series', 'baseline_alec_period', 'baseline_alec_rate_m_year', 'baseline_source',
    'baseline_anchor_sensor_platform', 'baseline_model_method', 'original_published_rate_source',
    'endpoint_kind', 'endpoint_provenance', 'observation_date', 'observation_product', 'observation_sensor_platform', 'observation_processing_method',
    'endpoint_evaluation_date_not_capture', 'endpoint_model_anchor_date', 'endpoint_model_anchor_product',
    'endpoint_alec_series', 'endpoint_alec_period', 'endpoint_alec_rate_m_year', 'endpoint_source',
    'change_m', 'unit', 'communication_rounding_m', 'baseline_longitude', 'baseline_latitude',
    'endpoint_longitude', 'endpoint_latitude', 'comparison_method', 'limits',
  ];
  const lines = ['\ufeff' + fields.map(quote).join(',')];
  const coverage = [];
  const limits = 'BASE 1993 ESTIMADA POR EL PROYECTO CON ASISTENCIA DE CHATGPT; NO ES UNA CAPTURA DE 1993 NI UNA POSICIÓN PUBLICADA POR EL ESTUDIO. Las tasas originales de Alec se conservan como fuente separada. Extremo observado cuando tiene fecha/producto propios; de otro modo estimado y señalado. Cambio exploratorio redondeado a 10 m, sin exactitud de 10 m validada. Sin corrección de marea/oleaje, homologación ni validación independiente; no confirma pérdida de arena.';
  let rows = 0;
  for (let year = 1993; year <= 2026; year++) {
    const counts = { year, inventory_axes: inventory.size, baseline_observed_axes: index.references.size,
      baseline_estimated_axes: index.baselineEstimates.size, baseline_missing_axes: inventory.size - index.baselineValues.size,
      baseline: 0, available: 0, estimated: 0, no_reference: 0, no_observation: 0,
      estimated_base_observed_endpoint: 0, estimated_base_estimated_endpoint: 0,
      no_observation_with_base: 0, no_observation_without_base: 0 };
    for (const id of inventory) {
      const c = evolutionComparison(index, id, year);
      counts[c.status]++;
      if (c.status === 'no_observation') {
        counts[c.before ? 'no_observation_with_base' : 'no_observation_without_base']++;
        continue;
      }
      if (c.status === 'no_reference') continue;
      if (!c.before || !c.after) throw new Error('Comparison without both endpoints');
      const b = c.baselineEstimate, e = c.estimate;
      const endpointKind = c.status === 'baseline' ? 'estimated_base_1993' : c.afterCut ? 'observed_preliminary' : e ? 'estimated' : 'missing';
      if (endpointKind === 'missing') throw new Error('Unexplained endpoint provenance');
      if (c.status !== 'baseline') counts[c.afterCut ? 'estimated_base_observed_endpoint' : 'estimated_base_estimated_endpoint']++;
      const values = [id, year, c.status, 1993, b ? 'estimated' : 'observed_preliminary',
        b ? 'project_estimate_assisted_by_chatgpt' : 'project_satellite_processing_assisted_by_chatgpt',
        c.beforeCut?.datetime, c.beforeCut?.product?.id,
        b?.evaluationDate, b?.anchorCut.datetime, b?.anchorCut.product?.id,
        b?.model.series, periodText(b?.model, trends), b?.model.rate_m_year, b?.sourceUrl ?? c.beforeCut?.source_url,
        b?.anchorCut.product?.platform ?? c.beforeCut?.product?.platform, b ? trends.method_id : '', trends.source_url,
        endpointKind, c.afterCut ? 'project_satellite_processing_assisted_by_chatgpt' : 'project_estimate_assisted_by_chatgpt',
        c.afterCut?.datetime, c.afterCut?.product?.id, c.afterCut?.product?.platform, c.afterCut?.method_id,
        c.status === 'baseline' ? b?.evaluationDate : e?.evaluationDate,
        c.status === 'baseline' ? b?.anchorCut.datetime : e?.anchorCut.datetime,
        c.status === 'baseline' ? b?.anchorCut.product?.id : e?.anchorCut.product?.id,
        c.status === 'baseline' ? b?.model.series : e?.model.series,
        c.status === 'baseline' ? periodText(b?.model, trends) : periodText(e?.model, trends),
        c.status === 'baseline' ? b?.model.rate_m_year : e?.model.rate_m_year,
        c.afterCut?.source_url ?? e?.sourceUrl ?? b?.sourceUrl,
        c.changeM, 'm', 10, c.before.point?.[0], c.before.point?.[1],
        c.after.point?.[0], c.after.point?.[1], 'fixed-1993-waterline-comparison-v1', limits];
      lines.push(values.map(quote).join(','));
      rows++;
    }
    coverage.push(counts);
  }
  const bytes = Buffer.from(lines.join('\r\n') + '\r\n');
  const compressed = stableGzip(bytes);
  const file = 'public/data/littoral/changes-from-1993.csv.gz';
  await writeFile(new URL(file, root), compressed);
  const after = Object.fromEntries(await Promise.all(protectedFiles.map(async path => [path, sha(await read(path))])));
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Protected source or legacy export changed during export');
  const summary = {
    schema_version: 1, comparison_method: 'fixed-1993-waterline-comparison-v1', baseline_year: 1993,
    policy: 'Exact 1993 observation when received; otherwise already reviewed L5 model with real anchor strictly before its 1993 evaluation. No adjacent-year substitution or retrospective anchor.',
    inventory_axes: inventory.size, observed_baseline_axes: index.references.size,
    estimated_baseline_axes: index.baselineEstimates.size, missing_baseline_axes: inventory.size - index.baselineValues.size,
    new_satellite_observations: 0, source_observation_count: catalogue.observations.length,
    baseline_provenance: 'project_estimate_assisted_by_chatgpt',
    observed_endpoint_provenance: 'project_satellite_processing_assisted_by_chatgpt',
    modeled_endpoint_provenance: 'project_estimate_assisted_by_chatgpt',
    original_published_rate_source: trends.source_url,
    provenance_note: 'Published study rates, satellite source pixels, and project calculations assisted by ChatGPT are distinct. Modeled 1993 positions and comparisons are project derivatives, not original published study results.',
    csv: { file, rows, uncompressed_bytes: bytes.length, uncompressed_sha256: sha(bytes),
      compressed_bytes: compressed.length, compressed_sha256: sha(compressed) },
    coverage, protected_inputs_sha256: before, protected_inputs_unchanged: true,
    limits: '1993 is a modeled statistical reference for all currently comparable axes. No received observed 1993 baseline. Native satellite resolution and tide/wave/registration limitations remain; no annual municipal completeness or sand-loss validation.',
  };
  await writeFile(new URL('public/data/littoral/fixed-1993-summary.json', root), JSON.stringify(summary, null, 2) + '\n');
  return summary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const summary = await exportFixed1993Evolution();
  console.log(JSON.stringify({ observed_baseline_axes: summary.observed_baseline_axes,
    estimated_baseline_axes: summary.estimated_baseline_axes, missing_baseline_axes: summary.missing_baseline_axes,
    rows: summary.csv.rows, compressed_bytes: summary.csv.compressed_bytes,
    protected_inputs_unchanged: summary.protected_inputs_unchanged }));
}
