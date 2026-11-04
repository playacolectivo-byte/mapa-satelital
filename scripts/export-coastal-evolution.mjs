import { readFile, readdir, writeFile, mkdir, rm } from 'node:fs/promises';
import { stableGzip } from './stable-gzip.mjs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateEvolutionCatalogue, createEvolutionIndex, evolutionComparison } from '../lib/coastal-evolution.ts';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
export async function exportCoastalEvolution() {
  const sourceBytes = await read('public/data/littoral/pilot-series.json');
  const series = JSON.parse(sourceBytes);
  let records = [];
  try {
    const directory = new URL('scientific/baseline-1986/records/', root);
    records = await Promise.all((await readdir(directory, { recursive: true })).filter((name) => name.endsWith('.json')).map(async (name) => JSON.parse(await readFile(new URL(name, directory), 'utf8'))));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  let review = { accepted_observation_ids: [], baseline_observation_id: null };
  try { review = JSON.parse(await read('scientific/baseline-1986/acceptance-review.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const accepted = records.filter((record) => ['preliminary_usable', 'partial_usable'].includes(record.acceptance) && review.accepted_observation_ids.includes(record.id));
  let regionalReview = { accepted_observation_ids: [] };
  try { regionalReview = JSON.parse(await read('scientific/annual-waterlines/acceptance-review.json')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  try {
    const directory = new URL('scientific/annual-waterlines/records/', root);
    const regional = await Promise.all((await readdir(directory, { recursive: true })).filter((name) => name.endsWith('.json')).map(async (name) => JSON.parse(await readFile(new URL(name, directory), 'utf8'))));
    accepted.push(...regional.filter((record) => regionalReview.accepted_observation_ids.includes(record.id) && record.quality_diagnostics?.valid_transects > 0).map((record) => ({
      ...record,
      source_record_acceptance: record.acceptance,
      acceptance: 'exploratory_partial_accepted',
      acceptance_review: 'scientific/annual-waterlines/acceptance-review.json',
      acceptance_scope: regionalReview.review_scope,
      source_quality_note: record.quality_note,
      quality_note: ['Posición preliminar del borde del agua. Sin corrección de marea y oleaje ni validación independiente del registro o de las diferencias entre sensores.', ...(regionalReview.visual_reviews?.find((entry) => entry.id === record.id)?.capture_limitations ?? [])].join(' '),
    })));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  // A wider selection of axes within the already received pilot rasters.
  // Per-product positions already delivered elsewhere are preserved verbatim;
  // the extension adds only new product/axis pairs after explicit image review.
  const knownPositions = new Map([...accepted, ...series.cuts.filter((cut) => cut.origin === 'sentinel')]
    .flatMap((cut) => cut.measurements.filter((m) => m.point && m.value !== null && m.quality !== 'no_data')
      .map((m) => [cut.product.id + '|' + m.transect_id, m])));
  try {
    const extensionReview = JSON.parse(await read('scientific/coverage-extension/acceptance-review.json'));
    const directory = new URL('scientific/coverage-extension/records/', root);
    const extension = await Promise.all((await readdir(directory)).filter((name) => name.endsWith('.json')).map(async (name) => JSON.parse(await readFile(new URL(name, directory), 'utf8'))));
    if (extensionReview.accepted_observation_ids.some((id) => !extension.some((cut) => cut.id === id)))
      throw new Error('An accepted cached extension is missing its scientific source record');
    for (const record of extension.filter((cut) => extensionReview.accepted_observation_ids.includes(cut.id))) {
      const measurements = record.measurements.filter((m) => {
        if (!m.point || m.value === null || m.quality === 'no_data') return false;
        const previous = knownPositions.get(record.product.id + '|' + m.transect_id);
        if (previous && (JSON.stringify(previous.point) !== JSON.stringify(m.point) || previous.value !== m.value ||
          (previous.raw_interpolated_position_m ?? previous.value) !== (m.raw_interpolated_position_m ?? m.value)))
          throw new Error('A cached extension changed an already delivered product/axis position');
        return !previous;
      });
      if (measurements.length) accepted.push({ ...record, measurements,
        source_record_acceptance: record.acceptance, acceptance: 'exploratory_partial_accepted',
        acceptance_review: 'scientific/coverage-extension/acceptance-review.json',
        acceptance_scope: extensionReview.review_scope,
      });
      for (const m of measurements) knownPositions.set(record.product.id + '|' + m.transect_id, m);
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const baseline = accepted.find((record) => record.id === review.baseline_observation_id) ?? null;
  if (review.baseline_observation_id && !baseline) throw new Error('The specified 1986 reference has not passed technical and visual review');
  // Delivery derivative only: repeated prose per measurement stays in the preserved source records.
  const observations = [...accepted, ...series.cuts.filter((cut) => cut.origin === 'sentinel')].map((cut) => ({
    ...cut, source_baseline_observation_id: cut.baseline_observation_id, source_baseline_date: cut.baseline_date,
    baseline_observation_id: null, baseline_date: null,
    // Full accepted/rejected diagnostics stay in the immutable scientific records.
    // Delivery needs only actual usable positions; omitted axes remain unmeasured.
    measurements: cut.measurements.filter((m) => m.point && m.value !== null && m.quality !== 'no_data').map((m) => ({
      transect_id: m.transect_id, value: m.value, point: m.point, quality: m.quality, change_m: null,
      raw_interpolated_position_m: m.raw_interpolated_position_m ?? m.value,
      ...(m.change_m !== null && m.change_m !== undefined ? { source_change_m: m.change_m } : {}),
      ...(m.native_resolution_m ? { native_resolution_m: m.native_resolution_m } : {}),
    })),
  })).toSorted((a, b) => a.datetime.localeCompare(b.datetime));
  const catalogue = validateEvolutionCatalogue({
    schema_version: 1, baseline_year: 1986, baseline_observation_id: baseline?.id ?? null,
    baseline_reference_policy: 'preferred-then-earliest-1986',
    generated_at: [series.generated_at, ...accepted.map((record) => record.processed_at)].sort().at(-1),
    observations, reviewed_1986_products: new Set(records.filter((record) => record.datetime.startsWith('1986')).map((record) => record.product.id)).size,
    source_sha256: createHash('sha256').update(sourceBytes).digest('hex'),
    quality_note: 'Medición principal propia con Landsat y Sentinel. Referencia real de 1986 y última posición utilizable de cada año, con fecha propia por barra. Un punto gris puede mostrar agua observada sin referencia de 1986; no expresa pérdida. Alec es información complementaria. Sin corrección de marea/oleaje ni homologación validada entre sensores.',
  });
  await writeFile(new URL('public/data/littoral/coastal-evolution.json', root), JSON.stringify(catalogue)+'\n');
  const index = createEvolutionIndex(catalogue);
  const keys = ['transect_id','selected_year','status','baseline_date','observation_date','baseline_product','observation_product','baseline_position_m','observation_position_m','change_from_1986_m','unit','method','quality','baseline_lon','baseline_lat','observation_lon','observation_lat','source','baseline_source','baseline_raw_interpolated_position_m','observation_raw_interpolated_position_m','origin','baseline_method','quality_note'];
  const escape = (value) => '"'+String(value ?? '').replaceAll('"','""')+'"';
  const rows = observations.flatMap((cut) => cut.measurements.map((measurement) => {
    if (!measurement.point || measurement.value === null || measurement.quality === 'no_data') return null;
    const comparison = evolutionComparison(index, measurement.transect_id, Number(cut.datetime.slice(0,4)));
    // Extra within-year dates remain in the source JSON. The CSV follows the same annual cut as the slider.
    if (comparison.afterCut?.id !== cut.id) return null;
    return [measurement.transect_id,comparison.year,comparison.status,comparison.beforeCut?.datetime,cut.datetime,
      comparison.beforeCut?.product?.id,cut.product.id,comparison.before?.value,measurement.value,comparison.changeM,
      'm',cut.method_id,measurement.quality,comparison.before?.point?.[0],comparison.before?.point?.[1],
      measurement.point?.[0],measurement.point?.[1],cut.source_url,comparison.beforeCut?.source_url,
      comparison.before?.raw_interpolated_position_m ?? comparison.before?.value,
      measurement.raw_interpolated_position_m ?? measurement.value,cut.origin,comparison.beforeCut?.method_id,cut.quality_note];
  }).filter(Boolean));
  const csv = Buffer.from('\ufeff'+[keys,...rows].map((row) => row.map(escape).join(',')).join('\r\n')+'\r\n');
  await mkdir(new URL('scientific/annual-waterlines/exports/', root), { recursive: true });
  await writeFile(new URL('scientific/annual-waterlines/exports/changes-from-1986.csv', root), csv);
  await writeFile(new URL('public/data/littoral/changes-from-1986.csv.gz', root), stableGzip(csv));
  // Large plain CSVs are delivered losslessly compressed and downloaded as CSV
  // by the client; satellite analysis is never run for a visitor request.
  if (csv.length < 24 * 1024 * 1024) await writeFile(new URL('public/data/littoral/changes-from-1986.csv', root), csv);
  else await rm(new URL('public/data/littoral/changes-from-1986.csv', root), { force: true });
  return { observations: observations.length, processed_records: records.length, reviewed_1986_products: catalogue.reviewed_1986_products, accepted_1986_products: new Set(accepted.filter((record) => record.datetime.startsWith('1986')).map((record) => record.product.id)).size, baseline_product: baseline?.product.id ?? null, csv_rows: rows.length };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await exportCoastalEvolution()));
