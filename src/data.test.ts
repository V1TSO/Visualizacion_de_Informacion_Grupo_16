import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aggregate, type Dataset, type Summary } from './data.ts';
const read = (file: string) => JSON.parse(readFileSync(new URL(`../public/data/${file}`, import.meta.url), 'utf8'));
const summary: Summary = read('years.json');
const years = Object.keys(summary.years);
test('Ocho eneros, 2019–2026', () => assert.deepEqual(years, ['2019','2020','2021','2022','2023','2024','2025','2026']));
for (const year of years) {
 const data: Dataset = read(`trips-${year}.json`);
 test(`${year}: calendario y promedio ponderado`, () => {
  const {weekday, weekend} = data.days;
  assert.equal(weekday + weekend, 31);
  for (const m of ['pickup','dropoff'] as const) {
   const all = aggregate(data,m,'all').hours, week = aggregate(data,m,'weekday').hours, end = aggregate(data,m,'weekend').hours;
   for (let h=0;h<24;h++) assert.ok(Math.abs(all[h]*31-week[h]*weekday-end[h]*weekend)<0.00001);
   assert.ok(Math.abs(all.reduce((a,b)=>a+b,0)*31-data.metadata.coverage[m].mapped)<0.001);
   for (let h=0;h<24;h++) {
    assert.ok(Math.abs(summary.years[year].city[m].weekday[h]-week[h])<0.001);
    assert.ok(Math.abs(summary.years[year].city[m].weekend[h]-end[h])<0.001);
   }
  }
 });
 test(`${year}: detalle, escala común y cobertura`, () => {
  for (const m of ['pickup','dropoff'] as const) for (const d of ['all','weekday','weekend'] as const) {
   const a = aggregate(data,m,d);
   for (const [id,hours] of Object.entries(a.zones)) {
    assert.deepEqual(aggregate(data,m,d,Number(id)).hours,hours);
    assert.ok(hours.every(n=>n>=0&&n<=summary.zoneMax));
   }
  }
  for (const c of Object.values(data.metadata.coverage)) assert.equal(c.mapped+c.unknownZone+c.outsideMonth,data.metadata.rawRows);
 });
}
