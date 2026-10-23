import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aggregate, arc, nightness, noteFor, NIGHT, SCALE, topFlows, windowRatio, type Dataset, type Summary } from './data.ts';
import { STEPS } from './story.ts';
const read = (file: string) => JSON.parse(readFileSync(new URL(`../public/data/${file}`, import.meta.url), 'utf8'));
const summary: Summary = read('years.json');
const data: Dataset = read('trips-2026.json');
const zones: Record<number, {zone: string; borough: string}> = Object.fromEntries(read('zones.geojson').features.map((f: {id: number; properties: {zone: string; borough: string}}) => [f.id, f.properties]));
const fmt = (n: number) => n.toLocaleString('es-CL', {maximumFractionDigits: 0});
const fmt1 = (n: number) => n.toLocaleString('es-CL', {maximumFractionDigits: 1});
const words = (i: number) => [STEPS[i].text, ...(STEPS[i].points ?? [])].join(' ');
const says = (i: number, ...parts: string[]) => { for (const p of parts) assert.ok(words(i).includes(p), `escena ${i + 1}: falta «${p}» en «${words(i)}»`); };
const week = aggregate(data, 'pickup', 'weekday'), end = aggregate(data, 'pickup', 'weekend');
const top = (zonesByHour: Record<number, number[]>, h: number, n: number) => Object.entries(zonesByHour).sort((a, b) => b[1][h] - a[1][h]).slice(0, n).map(([id]) => zones[Number(id)].zone);
const EAST_VILLAGE = 79, WEST_VILLAGE = 249, MIDTOWN_CENTER = 161, TIMES_SQUARE = 230;

test('Escenas 1, 3 y 5: viajes por hora y zonas más activas', () => {
  says(0, fmt(week.hours[8]));
  assert.deepEqual(top(week.zones, 8, 3), ['Upper East Side North', 'Upper East Side South', 'Penn Station/Madison Sq West']);
  says(2, fmt(end.hours[8]), `${fmt((1 - end.hours[8] / week.hours[8]) * 100)} %`);
  says(4, fmt(end.hours[1]), `${fmt1(end.hours[1] / week.hours[1])} veces`);
  assert.deepEqual(top(end.zones, 1, 3), ['East Village', 'West Village', 'Lower East Side']);
});

test('Escena 2: lunes a viernes, los flujos van a Midtown', () => {
  const flows = topFlows(data, 'weekday', 8, 'pickup');
  const midtown = flows.filter(f => zones[f.to].zone.startsWith('Midtown'));
  says(1, `${midtown.length} de los 40`, `${midtown.filter(f => zones[f.from].zone.startsWith('Upper East Side')).length} vienen del Upper East Side`);
  const arrivals = (day: 'weekday' | 'weekend') => aggregate(data, 'dropoff', day).zones[MIDTOWN_CENTER][8];
  says(1, `${fmt1(arrivals('weekday') / arrivals('weekend'))} veces`);
});

test('Escena 4: de día, el fin de semana llega el doble a Times Square', () => {
  const w = aggregate(data, 'dropoff', 'weekday').zones, e = aggregate(data, 'dropoff', 'weekend').zones;
  const times = (id: number) => e[id][13] / w[id][13];
  says(3, `${fmt(e[TIMES_SQUARE][13])} contra ${fmt(w[TIMES_SQUARE][13])}`);
  assert.equal(fmt1(times(TIMES_SQUARE)), '2', 'el doble');
  for (const id of [EAST_VILLAGE, WEST_VILLAGE]) assert.ok(times(id) > 1.8 && times(id) < 2.2, `${zones[id].zone}: ${times(id)}`);
});

test('Escena 6: East Village y JFK', () => {
  const all = aggregate(data, 'pickup', 'all');
  assert.equal(top(all.zones, 1, 1)[0], 'East Village');
  says(5, `${fmt1(end.zones[EAST_VILLAGE][1] / week.zones[EAST_VILLAGE][1])} veces`);
  const jfk = end.zones[132][1] / week.zones[132][1];
  assert.ok(jfk > 0.9 && jfk < 1.2, `JFK ${jfk}`);
});

test('Escena 7: flujos de la noche', () => {
  const flows = topFlows(data, 'weekend', 1, 'pickup');
  assert.equal(flows.length, 40);
  says(6, `${flows.filter(f => f.from === EAST_VILLAGE).length} de los 40`);
  assert.ok(flows.every(f => zones[f.from].borough === 'Manhattan' && zones[f.to].borough === 'Manhattan'));
  assert.deepEqual(topFlows(data, 'weekend', 1, 'pickup', EAST_VILLAGE).slice(0, 3).map(f => zones[f.to].zone), ['Murray Hill', 'Kips Bay', 'Gramercy']);
});

test('Escena 8: velocidad', () => {
  const {weekday, weekend} = summary.years['2026'].speed;
  says(7, `${fmt1(weekend[5]!)} km/h`, `${fmt1(weekday[11]!)} km/h`);
  assert.equal(Math.min(...weekday as number[]), weekday[11]);
  assert.ok(weekday[11]! < weekend[5]! / 2);
});

test('Escenas 9–10: ocho eneros', () => {
  const ratio = (y: string) => windowRatio(summary.years[y].city.pickup.weekend, summary.years[y].city.pickup.weekday, NIGHT);
  const others = Object.keys(summary.years).filter(y => y !== '2021').map(ratio);
  says(8, `${fmt1(ratio('2021'))} veces`, `entre ${fmt1(Math.min(...others))} y ${fmt1(Math.max(...others))}`);
  const perDay = (y: string) => { const v = summary.years[y]; const s = (a: number[]) => a.reduce((x, n) => x + n, 0); return s(v.city.pickup.weekday) * v.days.weekday + s(v.city.pickup.weekend) * v.days.weekend; };
  const trips = perDay('2026') / perDay('2019'), fare = summary.years['2026'].fare / summary.years['2019'].fare;
  assert.ok(trips > 0.45 && trips < 0.55, `${trips}`);
  // IPC de enero, área Nueva York–Newark–Jersey City (BLS, serie CUURS12ASA0): el alza en dólares corrientes (el doble) exagera.
  const CPI_2019 = 275.144, CPI_2026 = 350.947;
  says(9, `${summary.years['2026'].fare.toLocaleString('es-CL', {minimumFractionDigits: 2})} dólares`, `un ${fmt((fare * CPI_2019 / CPI_2026 - 1) * 100)} % más`);
});

test('Escena 11: el resumen repite las cifras de la historia', () => {
  const last = STEPS.length - 1;
  const ratios = Object.values(summary.years).map(y => windowRatio(y.city.pickup.weekend, y.city.pickup.weekday, NIGHT));
  says(last, fmt(week.hours[8]), 'Midtown', 'el doble a Times Square', `${fmt((1 - end.hours[8] / week.hours[8]) * 100)} %`, `${fmt1(end.hours[1] / week.hours[1])} veces`, 'East Village');
  says(last, `entre ${fmt1(Math.min(...ratios))} y ${fmt1(Math.max(...ratios))} veces`);
});

test('Las etiquetas del mapa nombran zonas citadas en el texto', () => {
  const short = (name: string) => name.replace(/ (North|South)$/, '').replace(/\/.*$/, '').replace(' Airport', '');
  STEPS.forEach((s, i) => (s.view.labels ?? []).forEach(id => assert.ok(words(i).includes(short(zones[id].zone)), `escena ${i + 1}: ${zones[id].zone}`)));
});

test('Ayudas: arco, nota y noche', () => {
  const a: [number, number] = [-74, 40.7], b: [number, number] = [-73.9, 40.8];
  const line = arc(a, b);
  assert.deepEqual(line[0], a);
  assert.ok(Math.abs(line.at(-1)![0] - b[0]) < 1e-9 && Math.abs(line.at(-1)![1] - b[1]) < 1e-9);
  assert.equal(noteFor(0), SCALE[0]);
  assert.equal(noteFor(40), SCALE.at(-1));
  assert.ok(SCALE.indexOf(noteFor(12)) < SCALE.indexOf(noteFor(25)));
  assert.ok(nightness(2) > 0.99 && nightness(1) > 0.99 && nightness(8) === 0 && nightness(14) === 0 && nightness(20) === 0 && nightness(5) > 0.5);
});
