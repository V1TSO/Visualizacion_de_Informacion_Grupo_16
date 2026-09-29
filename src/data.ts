export type Day = 'all' | 'weekday' | 'weekend';
export type Movement = 'pickup' | 'dropoff';
export interface Dataset {
  days: Record<Day, number>;
  rows: [Movement, number, Exclude<Day, 'all'>, number, number][];
  metadata: { rawRows: number; month: string; source: string; sha256: string; coverage: Record<Movement, {inMonth: number; mapped: number; unknownZone: number; outsideMonth: number}> };
}
export function aggregate(data: Dataset, movement: Movement, day: Day, zone?: number) {
  const hours = Array<number>(24).fill(0);
  const zones: Record<number, number[]> = {};
  for (const [m, z, d, h, count] of data.rows) {
    if (m !== movement || (day !== 'all' && day !== d)) continue;
    (zones[z] ??= Array<number>(24).fill(0))[h] += count / data.days[day];
    if (zone === undefined || zone === z) hours[h] += count / data.days[day];
  }
  return { hours, zones };
}
export interface Summary {
  zoneMax: number;
  years: Record<string, { rawRows: number; days: Record<Day, number>; city: Record<Movement, Record<Exclude<Day, 'all'>, number[]>> }>;
}
export const NIGHT = [0, 1, 2, 3, 4], MORNING = [6, 7, 8, 9];
export const windowRatio = (end: number[], week: number[], hours: number[]) => hours.reduce((s, h) => s + end[h], 0) / hours.reduce((s, h) => s + week[h], 0);
