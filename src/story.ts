import type { Movement } from './data';

export type Lens = 'weekday' | 'weekend' | 'diff';
export type ChartMode = 'day' | 'speed' | 'years';
export interface Camera { center: [number, number]; zoom: number; pitch: number; bearing: number }
export interface View { year: number; hour: number; lens: Lens; movement: Movement; three: boolean; flows: boolean; selected?: number; chart: ChartMode; camera?: Camera; labels?: number[] }
export interface Step { when: string; title: string; text: string; view: View }

export const CITY: Camera = {center: [-73.93, 40.72], zoom: 10.1, pitch: 0, bearing: 0};
const NIGHTLIFE: Camera = {center: [-73.99, 40.728], zoom: 12.2, pitch: 0, bearing: 0};
const RELIEF: Camera = {center: [-73.87, 40.685], zoom: 10.9, pitch: 55, bearing: -22};
const FLOWS: Camera = {center: [-73.985, 40.737], zoom: 12.6, pitch: 0, bearing: 0};
const base = {year: 2026, movement: 'pickup', three: false, flows: false, chart: 'day'} as const;

// Las cifras salen de public/data; src/story.test.ts las vuelve a calcular.
export const STEPS: Step[] = [
  {
    when: 'Lunes a viernes, 08:00',
    title: 'La ciudad que madruga',
    text: 'Un día de semana, entre las 8:00 y las 9:00, empiezan 5.719 viajes. Salen sobre todo del Upper East Side y de Penn Station: la ciudad va a trabajar.',
    view: {...base, lens: 'weekday', hour: 8, camera: CITY, labels: [236, 237, 186]},
  },
  {
    when: 'Sábado y domingo, 08:00',
    title: 'El fin de semana no madruga',
    text: 'A la misma hora del fin de semana empiezan 2.461 viajes: un 57 % menos. El mapa casi se apaga.',
    view: {...base, lens: 'weekend', hour: 8, camera: CITY},
  },
  {
    when: 'Sábado y domingo, 01:00',
    title: 'Pero trasnocha',
    text: 'A la 01:00 empiezan 4.966 viajes, 3,3 veces más que un día de semana. La noche se enciende en East Village, West Village y el Lower East Side.',
    view: {...base, lens: 'weekend', hour: 1, camera: NIGHTLIFE, labels: [79, 249, 148]},
  },
  {
    when: 'Sábado y domingo, 01:00',
    title: 'La noche tiene relieve',
    text: 'La altura muestra cuántos viajes salen; el color, cuánto más que un día de semana. La torre más alta, East Village, tiene 7,9 veces más viajes. JFK también es alta, pero casi no cambia: el aeropuerto no sale de fiesta.',
    view: {...base, lens: 'diff', hour: 1, three: true, camera: RELIEF, labels: [79, 132]},
  },
  {
    when: 'Sábado y domingo, 01:00',
    title: 'Y vuelve a casa cerca',
    text: '18 de los 40 flujos más grandes de la hora salen de East Village. Van a Murray Hill, Kips Bay y Gramercy. Ninguno de los 40 sale de Manhattan.',
    view: {...base, lens: 'weekend', hour: 1, flows: true, camera: FLOWS, labels: [79, 170, 137, 107]},
  },
  {
    when: 'Sábado y domingo, 05:00',
    title: 'La noche es rápida',
    text: 'A las 5:00 de un fin de semana, un taxi avanza a 27,4 km/h. Un día de semana a las 11:00, a 12,5 km/h: menos de la mitad. Con sonido, el tono sube con la velocidad.',
    view: {...base, lens: 'weekend', hour: 5, chart: 'speed', camera: CITY},
  },
  {
    when: 'Enero de 2021',
    title: 'Solo la pandemia apagó la noche',
    text: 'En enero de 2021, entre las 00:00 y las 05:00, el fin de semana tuvo 1,5 veces los viajes de un día de semana. En los otros siete eneros, entre 2,6 y 4,8 veces.',
    view: {...base, year: 2021, lens: 'diff', hour: 1, chart: 'years', camera: CITY},
  },
  {
    when: 'Enero de 2026',
    title: 'La noche volvió; el taxi cambió',
    text: 'Hoy hay la mitad de viajes que en 2019, y el viaje mediano cuesta el doble: 23,09 dólares, contra 11,30. Pero la noche del fin de semana sigue ahí.',
    view: {...base, lens: 'diff', hour: 1, chart: 'years', camera: CITY},
  },
];
