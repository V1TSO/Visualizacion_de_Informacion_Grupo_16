import type { Movement } from './data';

export type Lens = 'weekday' | 'weekend' | 'diff';
export type ChartMode = 'day' | 'speed' | 'years';
export interface Camera { center: [number, number]; zoom: number; pitch: number; bearing: number }
export interface View { year: number; hour: number; lens: Lens; movement: Movement; three: boolean; flows: boolean; selected?: number; chart: ChartMode; camera?: Camera; labels?: number[] }
// say: lo que lee la voz al llegar a la escena (con sonido activado). chartTitle: el titular del gráfico en esa escena.
export interface Step { when: string; title: string; text: string; say: string; chartTitle: string; view: View }

export const CITY: Camera = {center: [-73.93, 40.72], zoom: 10.1, pitch: 0, bearing: 0};
const NIGHTLIFE: Camera = {center: [-73.99, 40.728], zoom: 12.2, pitch: 0, bearing: 0};
const CITY_AND_JFK: Camera = {center: [-73.88, 40.69], zoom: 10.8, pitch: 0, bearing: 0};
const FLOWS: Camera = {center: [-73.985, 40.737], zoom: 12.6, pitch: 0, bearing: 0};
const base = {year: 2026, movement: 'pickup', three: false, flows: false, chart: 'day'} as const;
const DAY_TITLE = 'Lunes a viernes madruga; el fin de semana trasnocha';
const YEARS_TITLE = 'La madrugada del fin de semana, en ocho eneros';

// Las cifras salen de public/data; src/story.test.ts las vuelve a calcular.
export const STEPS: Step[] = [
  {
    when: 'Lunes a viernes, 08:00',
    title: 'La ciudad que madruga',
    text: 'Un día de semana, entre las 8:00 y las 9:00, empiezan 5.719 viajes. Salen sobre todo del Upper East Side y de Penn Station: la mañana de trabajo.',
    say: 'Lunes a viernes, ocho de la mañana. La ciudad que madruga.',
    chartTitle: DAY_TITLE,
    view: {...base, lens: 'weekday', hour: 8, camera: CITY, labels: [236, 237, 186]},
  },
  {
    when: 'Sábado y domingo, 08:00',
    title: 'El fin de semana no madruga',
    text: 'A la misma hora del fin de semana empiezan 2.461 viajes: un 57 % menos. El mapa casi se apaga.',
    say: 'Sábado y domingo, ocho de la mañana. El fin de semana no madruga.',
    chartTitle: DAY_TITLE,
    view: {...base, lens: 'weekend', hour: 8, camera: CITY},
  },
  {
    when: 'Sábado y domingo, 01:00',
    title: 'Pero trasnocha',
    text: 'A la 01:00 empiezan 4.966 viajes, 3,3 veces más que un día de semana. La noche se enciende en East Village, West Village y el Lower East Side.',
    say: 'Sábado y domingo, una de la madrugada. Pero trasnocha.',
    chartTitle: DAY_TITLE,
    view: {...base, lens: 'weekend', hour: 1, camera: NIGHTLIFE, labels: [79, 249, 148]},
  },
  {
    when: 'Sábado y domingo, 01:00',
    title: 'No toda la ciudad trasnocha',
    text: 'Ahora el color compara cada zona con un día de semana a la misma hora. East Village tiene 7,9 veces más viajes. JFK casi no cambia: el aeropuerto no sale de fiesta.',
    say: 'No toda la ciudad trasnocha.',
    chartTitle: DAY_TITLE,
    view: {...base, lens: 'diff', hour: 1, camera: CITY_AND_JFK, labels: [79, 132]},
  },
  {
    when: 'Sábado y domingo, 01:00',
    title: 'Y termina cerca',
    text: '18 de los 40 flujos más grandes entre zonas distintas salen de East Village, sobre todo a Murray Hill, Kips Bay y Gramercy. Ninguno de los 40 sale de Manhattan. Otros 38 viajes al día ni siquiera salen de East Village: es el anillo.',
    say: 'Y termina cerca.',
    chartTitle: DAY_TITLE,
    view: {...base, lens: 'weekend', hour: 1, flows: true, camera: FLOWS, labels: [79, 170, 137, 107]},
  },
  {
    when: 'Sábado y domingo, 05:00',
    title: 'La noche es rápida',
    text: 'A las 5:00 de un fin de semana, un taxi avanza a 27,4 km/h. Un día de semana a las 11:00, a 12,5 km/h: menos de la mitad. Con sonido, los autos rápidos suenan más agudos y pasan más rápido; en los atascos, se oyen bocinas.',
    say: 'Sábado y domingo, cinco de la mañana. La noche es rápida.',
    chartTitle: 'La velocidad sube de noche y cae de día',
    view: {...base, lens: 'weekend', hour: 5, chart: 'speed', camera: CITY},
  },
  {
    when: 'Enero de 2021',
    title: 'En 2021, la noche casi se apagó',
    text: 'En enero de 2021, en plena pandemia, entre las 00:00 y las 05:00 el fin de semana tuvo solo 1,5 veces los viajes de un día de semana. En los otros siete eneros, entre 2,6 y 4,8 veces.',
    say: 'Enero de dos mil veintiuno. La noche casi se apagó.',
    chartTitle: YEARS_TITLE,
    view: {...base, year: 2021, lens: 'diff', hour: 1, chart: 'years', camera: CITY},
  },
  {
    when: 'Enero de 2026',
    title: 'La noche volvió; el taxi cambió',
    text: 'Hoy hay la mitad de viajes que en 2019, y el viaje mediano cuesta 23,09 dólares: un 60 % más que en 2019, ya descontada la inflación de Nueva York. Pero la noche del fin de semana sigue ahí.',
    say: 'Enero de dos mil veintiséis. La noche volvió; el taxi cambió.',
    chartTitle: YEARS_TITLE,
    view: {...base, lens: 'diff', hour: 1, chart: 'years', camera: CITY},
  },
];
