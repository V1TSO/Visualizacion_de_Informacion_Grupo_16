export type Day = 'all' | 'weekday' | 'weekend';
export type DayType = Exclude<Day, 'all'>;
export type Movement = 'pickup' | 'dropoff';
export type Curve = (number | null)[];
// Origen, destino, hora de salida, viajes en el mes.
export type Flow = [number, number, number, number];
export interface Dataset {
  days: Record<Day, number>;
  rows: [Movement, number, DayType, number, number][];
  speed: { city: Record<DayType, Curve>; zones: Record<Movement, Record<string, Record<DayType, Curve>>> };
  flows: Record<DayType, Flow[]>;
  metadata: { rawRows: number; month: string; source: string; sha256: string; coverage: Record<Movement, {inMonth: number; mapped: number; unknownZone: number; outsideMonth: number}> };
}
export interface Summary {
  zoneMax: number;
  years: Record<string, { rawRows: number; days: Record<Day, number>; city: Record<Movement, Record<DayType, number[]>>; speed: Record<DayType, Curve>; fare: number }>;
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
export const NIGHT = [0, 1, 2, 3, 4], MORNING = [6, 7, 8, 9];
export const windowRatio = (end: number[], week: number[], hours: number[]) => hours.reduce((s, h) => s + end[h], 0) / hours.reduce((s, h) => s + week[h], 0);

// Salidas: a dónde van los viajes de la zona. Llegadas: de dónde vienen. Sin zona: los flujos más grandes de la ciudad.
export function topFlows(data: Dataset, day: DayType, hour: number, movement: Movement, zone?: number) {
  const side = movement === 'pickup' ? 0 : 1;
  return data.flows[day]
    .filter(f => f[2] === hour && (zone === undefined || f[side] === zone))
    .sort((a, b) => b[3] - a[3])
    .slice(0, zone === undefined ? 40 : 6)
    .map(([from, to, , n]) => ({from, to, perDay: n / data.days[day]}));
}

// Curva cuadrática que se dobla a la derecha del sentido del viaje: A→B y B→A no se superponen.
export function arc(a: [number, number], b: [number, number], steps = 24): [number, number][] {
  const k = Math.cos(40.7 * Math.PI / 180); // un grado de longitud mide menos que uno de latitud en Nueva York
  const dx = (b[0] - a[0]) * k, dy = b[1] - a[1];
  const cx = (a[0] + b[0]) / 2 + dy * 0.15 / k, cy = (a[1] + b[1]) / 2 - dx * 0.15;
  return Array.from({length: steps + 1}, (_, i) => {
    const t = i / steps, u = 1 - t;
    return [u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]];
  });
}

// Escala pentatónica: cualquier velocidad suena afinada. 10 km/h o menos = nota más grave; 28 km/h o más = más aguda.
export const SCALE = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5'];
export const noteFor = (kmh: number) => SCALE[Math.max(0, Math.min(SCALE.length - 1, Math.round((kmh - 10) / 18 * (SCALE.length - 1))))];

// 0 de día (08:00–20:00), 1 de madrugada; transición suave al amanecer y al anochecer.
export const nightness = (hour: number) => {
  const t = Math.min(1, Math.max(0, (((1 + Math.cos(2 * Math.PI * (hour - 2) / 24)) / 2) ** 2 - 0.3) / 0.6));
  return t * t * (3 - 2 * t);
};
