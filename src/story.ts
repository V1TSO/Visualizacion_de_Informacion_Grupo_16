import type { Movement } from './data';

export type Lens = 'weekday' | 'weekend' | 'diff';
export type ChartMode = 'day' | 'speed' | 'years';
export interface Camera { center: [number, number]; zoom: number; pitch: number; bearing: number }
export interface View { year: number; hour: number; lens: Lens; movement: Movement; three: boolean; flows: boolean; selected?: number; chart: ChartMode; camera?: Camera; labels?: number[] }
export interface Step { when: string; title: string; text: string; points?: string[]; view: View }

export const CITY: Camera = {center: [-73.93, 40.72], zoom: 10.1, pitch: 0, bearing: 0};
const NIGHTLIFE: Camera = {center: [-73.99, 40.728], zoom: 12.2, pitch: 0, bearing: 0};
const FLOWS: Camera = {center: [-73.985, 40.737], zoom: 12.6, pitch: 0, bearing: 0};
const DAYTIME: Camera = {center: [-73.975, 40.735], zoom: 11.9, pitch: 0, bearing: 0};
const MIDTOWN: Camera = {center: [-73.968, 40.765], zoom: 12.5, pitch: 0, bearing: 0};
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
    when: 'Lunes a viernes, 08:00',
    title: 'Y va a Midtown',
    text: '17 de los 40 flujos más grandes de la hora terminan en Midtown, donde se concentran las oficinas; 6 vienen del Upper East Side. A Midtown Center llegan 6,6 veces más viajes que a la misma hora de un fin de semana.',
    view: {...base, lens: 'weekday', hour: 8, flows: true, camera: MIDTOWN, labels: [161, 236]},
  },
  {
    when: 'Sábado y domingo, 08:00',
    title: 'El fin de semana no madruga',
    text: 'A la misma hora del fin de semana empiezan 2.461 viajes: un 57 % menos. El mapa casi se apaga.',
    view: {...base, lens: 'weekend', hour: 8, camera: CITY},
  },
  {
    when: 'Sábado y domingo, 13:00',
    title: 'De día, sale a pasear',
    text: 'A la 1 de la tarde llegan el doble de viajes que un día de semana a Times Square y el Theatre District: 387 contra 194. Pasa lo mismo en East Village y West Village, barrios de teatros, bares y tiendas.',
    view: {...base, lens: 'diff', movement: 'dropoff', hour: 13, camera: DAYTIME, labels: [230, 79, 249]},
  },
  {
    when: 'Sábado y domingo, 01:00',
    title: 'Pero trasnocha',
    text: 'A la 01:00 empiezan 4.966 viajes, 3,3 veces más que un día de semana. La noche se enciende en East Village, West Village y el Lower East Side.',
    view: {...base, lens: 'weekend', hour: 1, camera: NIGHTLIFE, labels: [79, 249, 148]},
  },
  {
    when: 'Sábado y domingo, 01:00',
    title: 'Donde la noche pesa más',
    text: 'El color muestra cuántas veces más viajes salen que un día de semana a la misma hora. East Village tiene 7,9 veces más. JFK casi no cambia: el aeropuerto no sale de fiesta.',
    view: {...base, lens: 'diff', hour: 1, camera: CITY, labels: [79, 132]},
  },
  {
    when: 'Sábado y domingo, 01:00',
    title: 'Y termina cerca',
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
    title: 'En 2021, la noche casi se apagó',
    text: 'En enero de 2021, en plena pandemia, entre las 00:00 y las 05:00 el fin de semana tuvo solo 1,5 veces los viajes de un día de semana. En los otros siete eneros, entre 2,6 y 4,8 veces.',
    view: {...base, year: 2021, lens: 'diff', hour: 1, chart: 'years', camera: CITY},
  },
  {
    when: 'Enero de 2026',
    title: 'La noche volvió; el taxi cambió',
    text: 'Hoy hay la mitad de viajes que en 2019, y el viaje mediano cuesta 23,09 dólares: un 60 % más que en 2019, ya descontada la inflación de Nueva York. Pero la noche del fin de semana sigue ahí.',
    view: {...base, lens: 'diff', hour: 1, chart: 'years', camera: CITY},
  },
  {
    when: 'Ocho eneros, de 2019 a 2026',
    title: 'En resumen',
    text: 'Lo que muestran los viajes de taxi:',
    points: [
      'De lunes a viernes, la ciudad madruga: a las 08:00 empiezan 5.719 viajes, y muchos van a Midtown.',
      'El fin de semana no madruga, pero sale de día: a las 08:00 hay un 57 % menos viajes, y a las 13:00 llegan el doble a Times Square.',
      'Pero trasnocha: a la 01:00 hay 3,3 veces más viajes, sobre todo desde East Village.',
      'Pasa en los ocho eneros: de madrugada, el fin de semana tiene entre 1,5 y 4,8 veces los viajes de lunes a viernes.',
    ],
    view: {...base, lens: 'diff', hour: 1, camera: CITY, labels: [79]},
  },
];
