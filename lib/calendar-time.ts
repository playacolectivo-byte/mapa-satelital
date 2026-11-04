export const ESRI_PROJECT_FIRST_YEAR = 2010; // Oldest received local Esri acquisition at <=1 m/pixel, not coastwide coverage.
/** Calendar stops are independent of the number/order of available images. */
export const IMAGERY_FIRST_YEAR = 2011; // Earliest acquisition in the received Wayback catalogue.
export const MAP_FIRST_YEAR = 1986;

export function calendarYears(first: number, last: number) {
  const start = Math.trunc(first), end = Math.max(start, Math.trunc(last));
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function stepTimelineIndex(current: number, target: number, count: number) {
  const last = Math.max(0, count - 1);
  const from = Math.max(0, Math.min(last, Math.round(current)));
  const to = Math.max(0, Math.min(last, Math.round(target)));
  return from + Math.sign(to - from);
}

/** A pointer chooses its requested stop directly, without a playback queue. */
export function timelineIndex(target: number, count: number) {
  return Math.max(0, Math.min(Math.max(0, count - 1), Math.round(target)));
}

/** Metadata may refine the date label without repeatedly redirecting a valid
 * year selection. A newly identified future capture can be replaced. */
export class CalendarFrameChoice {
  private choices = new Map<string, string>();
  choose<T>(scope: string, values: T[], year: number, getKey: (value: T) => string, getDate: (value: T) => string): T | null {
    const key = this.choices.get(scope);
    const retained = key ? values.find(value => getKey(value) === key) : null;
    const value = datedChoiceForYear(values, year, getDate);
    // Local metadata may refine a regional hint. Retain an edition only
    // while its actual capture still belongs to the requested calendar year.
    const retainedDate = retained ? getDate(retained) : '';
    const retainedAllowed = retained && Number.isFinite(Date.parse(retainedDate)) &&
      (Number(retainedDate.slice(0, 4)) === year);
    if (retainedAllowed) { this.choices.delete(scope); this.choices.set(scope, key!); return retained; }
    if (value) {
      if (this.choices.size >= 96) this.choices.delete(this.choices.keys().next().value!);
      this.choices.set(scope, getKey(value));
    }
    return value;
  }
}

/** Exact calendar year only. Unknown or missing years remain unavailable. */
export function datedChoiceForYear<T>(values: T[], year: number, getDate: (value: T) => string): T | null {
  return values.filter(value => Number.isFinite(Date.parse(getDate(value))) && Number(getDate(value).slice(0, 4)) === year)
    .sort((a, b) => getDate(a).localeCompare(getDate(b))).at(-1) ?? null;
}
