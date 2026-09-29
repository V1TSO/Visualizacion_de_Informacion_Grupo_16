import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as maplibregl from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { FeatureCollection, LineString, Point } from 'geojson';
import Plotly from 'plotly.js-basic-dist-min';
import * as Tone from 'tone';
import { aggregate, arc, DAY_ORDER, dayPosition, honkChance, nightness, topFlows, topStays, windowRatio, NIGHT, type Dataset, type DayType, type Summary } from './data';
import { honk, passCar } from './sound';
import { CITY, STEPS, type ChartMode, type Lens, type View } from './story';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

maplibregl.setWorkerUrl(mapWorkerUrl);
const fmt = (n: number) => n.toLocaleString('es-CL', {maximumFractionDigits: 0});
const fmt1 = (n: number) => n.toLocaleString('es-CL', {maximumFractionDigits: 1});
const clock = (h: number) => `${String(h).padStart(2, '0')}:00`;
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
// Cantidad en violeta: no reutiliza el azul (lunes a viernes) ni el naranjo (fin de semana) de las comparaciones.
const COLORS = ['#dcd5ee', '#b3a7d8', '#8a78bf', '#5f479c', '#35166b'];
// Densidad en viajes por km²: cada marca multiplica por 10.
const DENSITY_STOPS = [0.1, 1, 10, 100, 1000];
const DIVERGING = ['#245978', '#8fb3c9', '#ffffff', '#e8a36b', '#b65d23'];
// Gris neutro para «sin viajes» y para el mapa de fondo de los flujos; distinto del blanco de «igual».
const LAND = '#e3e7e5';
// Altura 3D lineal: la longitud se lee como cantidad; el color sigue siendo logarítmico.
const TOWER_METERS = 6000;
// El agua no cambia con la hora: un fondo que se oscurece altera cómo se perciben los colores del mapa (contraste local).
const WATER = '#dfeaf0';
const WEEK_COLOR = '#245978', END_COLOR = '#b65d23';
const LENS: Record<Lens, string> = {weekday: 'Lunes a viernes', weekend: 'Sábado y domingo', diff: 'Fin de semana contra lunes a viernes'};
const EXPLORE_START: View = {year: 2026, hour: 1, lens: 'diff', movement: 'pickup', three: false, flows: false, chart: 'day'};
const EMPTY: FeatureCollection = {type: 'FeatureCollection', features: []};
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const dayOf = (lens: Lens): DayType => lens === 'weekday' ? 'weekday' : 'weekend';
const load = async (file: string) => {
  const r = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!r.ok) throw new Error('No se pudieron cargar los datos. Recarga la página.');
  return r.json();
};
type Zone = {zone: string; borough: string; cx: number; cy: number; km2: number};
type Arc = {coords: [number, number][]; w: number; taxis: number};

function Horizon({summary}: {summary: Summary}) {
  const {weekday, weekend} = summary.years['2026'].city.pickup;
  const W = 1200, H = 170, max = Math.max(...weekday, ...weekend);
  // De mediodía a mediodía: la noche queda entera en el centro del dibujo.
  const x = (h: number) => dayPosition(h) / 23 * W, y = (n: number) => H - n / max * (H - 24);
  const points = (a: number[]) => DAY_ORDER.map(h => `${x(h).toFixed(1)},${y(a[h]).toFixed(1)}`).join(' ');
  return <svg className="horizon" viewBox={`0 -10 ${W} ${H + 40}`} role="img" aria-label="Viajes por hora en enero de 2026, de mediodía a mediodía. El fin de semana tiene su máximo de madrugada; los días de semana, a las 18:00 y en la mañana.">
    <polyline className="line-week" points={points(weekday)} pathLength={1}/>
    <polyline className="line-end" points={points(weekend)} pathLength={1}/>
    <text className="label-end" x={x(1) + 14} y={y(weekend[1]) - 12}>sábado y domingo</text>
    <text className="label-week" x={x(18)} y={y(weekday[18]) - 14} textAnchor="middle">lunes a viernes</text>
    {[12, 18, 0, 6, 11].map(h => <text key={h} className="tick" x={x(h)} y={H + 26} textAnchor={h === 12 ? 'start' : h === 11 ? 'end' : 'middle'}>{clock(h)}</text>)}
  </svg>;
}

function App() {
  const [summary, setSummary] = useState<Summary>();
  const [geo, setGeo] = useState<FeatureCollection>();
  const [sets, setSets] = useState<Record<number, Dataset>>({});
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [explore, setExplore] = useState<View>(EXPLORE_START);
  const [hover, setHover] = useState<{id: number; x: number; y: number}>();
  const [query, setQuery] = useState('');
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(false);
  const [ready, setReady] = useState(false);
  const mapNode = useRef<HTMLDivElement>(null);
  const chartNode = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const exploreNode = useRef<HTMLElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  // Salida de audio: un panner por tipo de día (izquierda lunes a viernes, derecha fin de semana).
  const audio = useRef<Tone.Panner[] | null>(null);
  const arcs = useRef<Arc[]>([]);
  const onZone = useRef<(id: number) => void>(() => {});
  const loading = useRef(new Set<number>());

  const inStory = step < STEPS.length;
  const v = inStory ? STEPS[step].view : explore;
  const data = sets[v.year];
  const day = dayOf(v.lens);
  const relief = v.three && !v.flows;

  const want = (year: number) => {
    if (loading.current.has(year)) return;
    loading.current.add(year);
    load(`trips-${year}.json`).then(d => setSets(s => ({...s, [year]: d}))).catch(e => {loading.current.delete(year); setError(String(e.message));});
  };
  useEffect(() => {
    Promise.all(['years.json', 'zones.geojson'].map(load)).then(([s, g]) => {setSummary(s); setGeo(g);}).catch(e => setError(String(e.message)));
    return () => {audio.current?.forEach(node => node.dispose()); speechSynthesis?.cancel();};
  }, []);
  useEffect(() => want(v.year), [v.year]);
  // La historia visita 2021: se descarga antes de llegar a esa escena.
  useEffect(() => {if (sets[2026]) want(2021);}, [sets]);

  // La escena activa es la última tarjeta que cruzó la línea de lectura.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = innerHeight * (matchMedia('(max-width: 900px)').matches ? 0.8 : 0.55);
      let active = 0;
      [...cards.current, exploreNode.current].forEach((node, i) => {if (node && node.getBoundingClientRect().top < line) active = i;});
      setStep(active);
    };
    const onScroll = () => {if (!frame) frame = requestAnimationFrame(update);};
    update();
    addEventListener('scroll', onScroll, {passive: true});
    addEventListener('resize', onScroll);
    return () => {removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(frame);};
  }, []);

  const zoneById = useMemo(() => new Map((geo?.features ?? []).map(f => [Number(f.id), f.properties as Zone])), [geo]);
  const zoneNames = useMemo(() => [...zoneById.entries()].sort((a, b) => a[1].zone.localeCompare(b[1].zone)), [zoneById]);
  const nameOf = (id: number) => zoneById.get(id)?.zone ?? String(id);
  const total = useMemo(() => data && aggregate(data, v.movement, v.lens === 'diff' ? 'all' : v.lens), [data, v.movement, v.lens]);
  const week = useMemo(() => data && aggregate(data, v.movement, 'weekday'), [data, v.movement]);
  const end = useMemo(() => data && aggregate(data, v.movement, 'weekend'), [data, v.movement]);
  const curves = useMemo(() => data && {weekday: aggregate(data, v.movement, 'weekday', v.selected).hours, weekend: aggregate(data, v.movement, 'weekend', v.selected).hours}, [data, v.movement, v.selected]);
  const zoneSpeed = v.selected === undefined ? undefined : data?.speed.zones[v.movement][String(v.selected)];
  // Zonas con menos de 10 viajes en esa hora del mes usan la velocidad de la ciudad.
  const speedAt = (d: DayType, h: number) => zoneSpeed?.[d][h] ?? data?.speed.city[d][h] ?? null;
  const flows = useMemo(() => data ? topFlows(data, day, v.hour, v.movement, v.selected) : [], [data, day, v.hour, v.movement, v.selected]);
  const stays = useMemo(() => data ? topStays(data, day, v.hour, v.selected) : [], [data, day, v.hour, v.selected]);
  const flowMax = Math.max(...flows.map(f => f.perDay), ...stays.map(s => s.perDay), 1);
  const trips = curves?.[day][v.hour] ?? 0;
  const ratio = (curves?.weekend[v.hour] ?? 0) / Math.max(curves?.weekday[v.hour] ?? 0, 0.05);
  const kmh = speedAt(day, v.hour);
  const totalRows = summary ? Object.values(summary.years).reduce((s, y) => s + y.rawRows, 0) : 0;

  function act(patch: Partial<View>) {
    setExplore(prev => ({...(inStory ? v : prev), ...patch, camera: undefined}));
    // Tocar el mapa o un gráfico durante la historia lleva a explorar desde esa misma vista.
    if (inStory) exploreNode.current?.scrollIntoView({behavior: 'auto', block: 'start'});
  }
  onZone.current = id => act({selected: id});
  useEffect(() => setQuery(v.selected === undefined ? '' : nameOf(v.selected)), [v.selected, zoneById]);
  useEffect(() => {if (inStory) setPlaying(false);}, [inStory]);

  useEffect(() => {
    if (!geo || !mapNode.current) return;
    const m = new maplibregl.Map({container: mapNode.current, style: {version: 8, sources: {}, transition: {duration: 700, delay: 0}, layers: [{id: 'water', type: 'background', paint: {'background-color': WATER}}]}, center: CITY.center, zoom: CITY.zoom, maxZoom: 15, minZoom: 8, attributionControl: false, canvasContextAttributes: {antialias: true},
      // Rueda con Ctrl o ⌘ para acercar: la rueda sola sigue moviendo la página y la historia.
      cooperativeGestures: true, locale: {'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + rueda para acercar el mapa', 'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + rueda para acercar el mapa', 'CooperativeGesturesHandler.MobileHelpText': 'Usa dos dedos para mover el mapa'}});
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({visualizePitch: true}), 'top-right');
    m.addControl(new maplibregl.AttributionControl({compact: true, customAttribution: 'Zonas y viajes: NYC TLC'}), 'bottom-right');
    for (const [name, lng, lat] of [['Manhattan', -73.975, 40.783], ['Brooklyn', -73.95, 40.65], ['Queens', -73.82, 40.733], ['Bronx', -73.86, 40.85], ['Staten Island', -74.15, 40.58]] as const) {
      const label = document.createElement('span'); label.className = 'borough-label'; label.textContent = name;
      new maplibregl.Marker({element: label}).setLngLat([lng, lat]).addTo(m);
    }
    m.on('error', () => setError('El mapa no pudo cargar un recurso. Recarga la página; los gráficos y el sonido siguen disponibles.'));
    m.on('load', () => {
      m.addSource('zones', {type: 'geojson', data: geo});
      m.addLayer({id: 'fill', type: 'fill', source: 'zones', paint: {'fill-color': LAND}});
      m.addLayer({id: 'borders', type: 'line', source: 'zones', paint: {'line-color': '#ffffff', 'line-width': 0.6, 'line-opacity': 0.8}});
      m.addLayer({id: 'extrusion', type: 'fill-extrusion', source: 'zones', layout: {visibility: 'none'}, paint: {'fill-extrusion-color': LAND, 'fill-extrusion-opacity': 0.94}});
      m.addLayer({id: 'selected', type: 'line', source: 'zones', filter: ['==', ['id'], -1], paint: {'line-color': '#173c50', 'line-width': 3}});
      m.addSource('flows', {type: 'geojson', lineMetrics: true, data: EMPTY});
      m.addLayer({id: 'flow-casing', type: 'line', source: 'flows', layout: {'line-cap': 'round'}, paint: {'line-color': '#ffffff', 'line-width': ['+', ['get', 'w'], 3], 'line-opacity': 0.7}});
      // El trazo se oscurece hacia el destino: la dirección se lee sin flechas.
      m.addLayer({id: 'flow-lines', type: 'line', source: 'flows', layout: {'line-cap': 'round'}, paint: {'line-width': ['get', 'w'], 'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(23,60,80,0.12)', 1, 'rgba(23,60,80,0.95)']}});
      // Viajes que no salen de su zona: un anillo cuya área crece con los viajes.
      m.addSource('stays', {type: 'geojson', data: EMPTY});
      m.addLayer({id: 'stays', type: 'circle', source: 'stays', paint: {'circle-radius': ['get', 'r'], 'circle-color': 'rgba(23,60,80,0.08)', 'circle-stroke-color': '#173c50', 'circle-stroke-width': 2}});
      m.addSource('particles', {type: 'geojson', data: EMPTY});
      m.addLayer({id: 'particles', type: 'circle', source: 'particles', paint: {'circle-radius': 3.5, 'circle-color': '#f6bd16', 'circle-stroke-color': '#173c50', 'circle-stroke-width': 1}});
      setReady(true);
    });
    m.on('click', ['fill', 'extrusion'], e => {const id = e.features?.[0]?.id; if (id !== undefined) onZone.current(Number(id));});
    m.on('mousemove', ['fill', 'extrusion'], e => {const id = e.features?.[0]?.id; m.getCanvas().style.cursor = 'pointer'; if (id !== undefined) setHover({id: Number(id), x: e.point.x, y: e.point.y});});
    m.on('mouseleave', ['fill', 'extrusion'], () => {m.getCanvas().style.cursor = ''; setHover(undefined);});
    const observer = new ResizeObserver(() => m.resize()); observer.observe(mapNode.current);
    return () => {observer.disconnect(); m.remove(); map.current = null;};
  }, [geo]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !geo || !total || !week || !end || !summary) return;
    for (const feature of geo.features) {
      const id = Number(feature.id), w = week.zones[id]?.[v.hour] ?? 0, e = end.zones[id]?.[v.hour] ?? 0;
      // Densidad (viajes por km²): las zonas grandes, como JFK, no ganan peso visual solo por su superficie.
      m.setFeatureState({source: 'zones', id}, {value: (total.zones[id]?.[v.hour] ?? 0) / (zoneById.get(id)?.km2 ?? 1), low: Math.max(w, e) < 1, ratio: Math.log2(Math.max(e, 0.25) / Math.max(w, 0.25))});
    }
    const value: maplibregl.ExpressionSpecification = ['coalesce', ['feature-state', 'value'], 0];
    // Escala logarítmica común a los ocho años: la zona mediana tiene <1 % del máximo, una escala lineal la deja casi en blanco.
    const color: maplibregl.DataDrivenPropertyValueSpecification<string> = v.flows ? LAND : v.lens === 'diff'
      ? ['case', ['coalesce', ['feature-state', 'low'], true], LAND, ['interpolate', ['linear'], ['coalesce', ['feature-state', 'ratio'], 0], -2, DIVERGING[0], -1, DIVERGING[1], 0, DIVERGING[2], 1, DIVERGING[3], 2, DIVERGING[4]]]
      : ['case', ['==', value, 0], LAND, ['interpolate', ['linear'], value, ...DENSITY_STOPS.flatMap((stop, i) => [stop, COLORS[i]])]];
    m.setPaintProperty('fill', 'fill-color', color);
    m.setPaintProperty('extrusion', 'fill-extrusion-color', color);
    m.setPaintProperty('extrusion', 'fill-extrusion-height', ['*', value, TOWER_METERS / summary.densityMax]);
    m.setLayoutProperty('extrusion', 'visibility', relief ? 'visible' : 'none');
    m.setLayoutProperty('fill', 'visibility', relief ? 'none' : 'visible');
    m.setFilter('selected', ['==', ['id'], v.selected ?? -1]);
  }, [ready, geo, total, week, end, summary, v.hour, v.lens, v.flows, v.selected, relief, zoneById]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    // Grosor, radio y cantidad de taxis crecen con los viajes, con la misma escala para arcos y anillos.
    arcs.current = v.flows ? flows.flatMap(f => {
      const a = zoneById.get(f.from), b = zoneById.get(f.to);
      return a && b ? [{coords: arc([a.cx, a.cy], [b.cx, b.cy]), w: 1.2 + 7 * Math.sqrt(f.perDay / flowMax), taxis: 1 + Math.round(3 * f.perDay / flowMax)}] : [];
    }) : [];
    (m.getSource('flows') as maplibregl.GeoJSONSource).setData({type: 'FeatureCollection', features: arcs.current.map(a => ({type: 'Feature', properties: {w: a.w}, geometry: {type: 'LineString', coordinates: a.coords} satisfies LineString}))});
    (m.getSource('stays') as maplibregl.GeoJSONSource).setData({type: 'FeatureCollection', features: v.flows ? stays.flatMap(s => {
      const z = zoneById.get(s.zone);
      return z ? [{type: 'Feature' as const, properties: {r: 4 + 16 * Math.sqrt(s.perDay / flowMax)}, geometry: {type: 'Point', coordinates: [z.cx, z.cy]} satisfies Point}] : [];
    }) : []});
  }, [ready, flows, stays, flowMax, v.flows, zoneById]);

  // De 1 a 4 taxis por arco según sus viajes: el movimiento no iguala flujos chicos y grandes. Sin animación si se pidió reducir el movimiento.
  useEffect(() => {
    const source = ready ? map.current?.getSource('particles') as maplibregl.GeoJSONSource | undefined : undefined;
    if (!source) return;
    if (!v.flows || reduced()) {source.setData(EMPTY); return;}
    let raf = 0, last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 33) return;
      last = t;
      source.setData({type: 'FeatureCollection', features: arcs.current.flatMap((a, i) => Array.from({length: a.taxis}, (_, n) => n / a.taxis).map(phase => {
        const k = ((t / 2800 + phase + i * 0.137) % 1) * (a.coords.length - 1), j = Math.floor(k), r = k - j;
        const [x0, y0] = a.coords[j], [x1, y1] = a.coords[Math.min(j + 1, a.coords.length - 1)];
        return {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [x0 + (x1 - x0) * r, y0 + (y1 - y0) * r]} satisfies Point};
      }))});
    };
    raf = requestAnimationFrame(tick);
    return () => {cancelAnimationFrame(raf); source.setData(EMPTY);};
  }, [ready, v.flows]);

  // Nombres sobre el mapa: los que cita la escena o, al explorar, la zona elegida y sus tres flujos principales.
  const labelKey = (inStory ? v.labels ?? [] : v.selected === undefined ? [] : [v.selected, ...(v.flows ? flows.slice(0, 3).map(f => v.movement === 'pickup' ? f.to : f.from) : [])]).join(',');
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !labelKey) return;
    const markers = labelKey.split(',').map(Number).flatMap(id => {
      const z = zoneById.get(id);
      if (!z) return [];
      const el = document.createElement('span'); el.className = 'zone-label'; el.textContent = z.zone;
      return [new maplibregl.Marker({element: el, anchor: 'bottom', offset: [0, -6]}).setLngLat([z.cx, z.cy]).addTo(m)];
    });
    return () => markers.forEach(marker => marker.remove());
  }, [ready, labelKey, zoneById]);

  // Al elegir una zona para explorar, la cámara se acerca a ella (zoom antes del detalle), sin alejarse si ya está cerca.
  useEffect(() => {
    const m = map.current, z = v.selected === undefined ? undefined : zoneById.get(v.selected);
    if (!ready || !m || inStory || !z) return;
    const small = matchMedia('(max-width: 900px)').matches;
    m.easeTo({center: [z.cx, z.cy], zoom: Math.max(m.getZoom(), small ? 11 : 11.8), padding: small ? {top: 110, bottom: 20, left: 10, right: 10} : {top: 10, bottom: 210, left: 300, right: 20}, duration: reduced() ? 0 : 900});
  }, [ready, v.selected, zoneById]);

  const cameraKey = inStory ? `story-${step}` : `explore-${relief}`;
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const duration = reduced() ? 0 : 1400;
    // El taxímetro (arriba a la izquierda) y el gráfico (abajo) tapan parte del mapa: la cámara centra en el resto.
    const small = matchMedia('(max-width: 900px)').matches;
    const padding = small ? {top: 110, bottom: 20, left: 10, right: 10} : {top: 10, bottom: 210, left: 300, right: 20};
    const camera = STEPS[step]?.view.camera;
    // En pantallas chicas el mapa mide la mitad: se aleja un nivel para mostrar lo mismo.
    if (inStory && camera) m.easeTo({...camera, zoom: camera.zoom - (small ? 0.9 : 0), padding, duration});
    else m.easeTo({pitch: relief ? 55 : 0, bearing: relief ? -25 : 0, padding, duration});
  }, [ready, cameraKey]);

  useEffect(() => {
    const el = chartNode.current;
    if (!el || !curves || !summary || !data) return;
    const font = {family: 'DM Sans, Arial, sans-serif', color: '#47606b', size: 11};
    const common = {margin: {t: 18, r: 12, b: 28, l: 38}, height: 178, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font, showlegend: false};
    // En viajes se atenúa el tipo de día que no se ve en el mapa; en velocidad se comparan ambos.
    const opacity = (d: DayType) => v.chart === 'speed' || v.lens === 'diff' || v.lens === d ? 1 : 0.3;
    let plot: Promise<Plotly.PlotlyHTMLElement>;
    if (v.chart === 'years') {
      const ratios = YEARS.map(y => windowRatio(summary.years[y].city[v.movement].weekend, summary.years[y].city[v.movement].weekday, NIGHT));
      plot = Plotly.react(el, [{type: 'bar', x: YEARS.map(String), y: ratios, marker: {color: YEARS.map(y => y === v.year ? '#f6bd16' : '#b9c9d1')}, hovertemplate: 'Enero de %{x}: %{y:.1f} veces<extra></extra>'}], {...common, xaxis: {type: 'category', fixedrange: true}, yaxis: {rangemode: 'tozero', fixedrange: true, gridcolor: '#e5e9e9', ticksuffix: '×'}, bargap: 0.35, shapes: [{type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 1, y1: 1, line: {color: '#47606b', width: 1, dash: 'dot'}}], annotations: [{x: YEARS.indexOf(2021), y: ratios[YEARS.indexOf(2021)], yanchor: 'bottom', text: 'Pandemia', showarrow: false, font: {...font, color: '#173c50'}}, {xref: 'paper', x: 1, y: 1, xanchor: 'right', yanchor: 'bottom', text: 'igual', showarrow: false, font: {...font, size: 10}}]}, {displayModeBar: false, responsive: true});
    } else {
      // Eje de mediodía a mediodía (el tiempo es cíclico): la madrugada queda entera en el centro.
      const raw = v.chart === 'day' ? curves : {weekday: DAY_ORDER.map(h => speedAt('weekday', h)), weekend: DAY_ORDER.map(h => speedAt('weekend', h))};
      const series = v.chart === 'day' ? {weekday: DAY_ORDER.map(h => raw.weekday[h]), weekend: DAY_ORDER.map(h => raw.weekend[h])} : raw;
      const unit = v.chart === 'day' ? 'viajes' : 'km/h';
      const x = DAY_ORDER.map((_, i) => i), text = DAY_ORDER.map(clock);
      // Etiqueta directa sobre cada curva, en la hora donde más supera a la otra (en vez de una leyenda aparte).
      const gap = (a: (number | null)[], b: (number | null)[]) => x.reduce((best, i) => ((a[i] ?? 0) - (b[i] ?? 0) > (a[best] ?? 0) - (b[best] ?? 0) ? i : best), 0);
      const iw = gap(series.weekday, series.weekend), ie = gap(series.weekend, series.weekday);
      plot = Plotly.react(el, [
        {x, y: series.weekday, text, type: 'scatter', mode: 'lines', opacity: opacity('weekday'), line: {color: WEEK_COLOR, width: 3}, hovertemplate: `%{text}: %{y:.1f} ${unit}<extra>Lunes a viernes</extra>`},
        {x, y: series.weekend, text, type: 'scatter', mode: 'lines', opacity: opacity('weekend'), line: {color: END_COLOR, width: 3, dash: 'dot'}, hovertemplate: `%{text}: %{y:.1f} ${unit}<extra>Sábado y domingo</extra>`},
      ], {...common, hovermode: 'x unified', xaxis: {range: [0, 23], tickvals: [0, 6, 12, 18, 23], ticktext: ['12:00', '18:00', '00:00', '06:00', '11:00'], fixedrange: true}, yaxis: {rangemode: 'tozero', fixedrange: true, gridcolor: '#e5e9e9'},
        shapes: [{type: 'rect', xref: 'x', yref: 'paper', x0: dayPosition(0), x1: dayPosition(5), y0: 0, y1: 1, fillcolor: '#152433', opacity: 0.06, line: {width: 0}, layer: 'below'}, {type: 'line', xref: 'x', yref: 'paper', x0: dayPosition(v.hour), x1: dayPosition(v.hour), y0: 0, y1: 1, line: {color: '#bc911a', width: 2, dash: 'dot'}}],
        annotations: [
          {x: dayPosition(2.5), xref: 'x', y: 1, yref: 'paper', yanchor: 'bottom', text: 'madrugada', showarrow: false, font: {...font, size: 10}},
          {x: iw, y: series.weekday[iw] ?? 0, yanchor: 'bottom', text: 'lunes a viernes', showarrow: false, font: {...font, color: WEEK_COLOR}, opacity: opacity('weekday')},
          {x: ie, y: series.weekend[ie] ?? 0, yanchor: 'bottom', text: 'sábado y domingo', showarrow: false, font: {...font, color: END_COLOR}, opacity: opacity('weekend')},
        ]}, {displayModeBar: false, responsive: true});
    }
    void plot.then(p => {p.removeAllListeners('plotly_click'); p.on('plotly_click', e => act(v.chart === 'years' ? {year: Number(e.points[0].x)} : {hour: DAY_ORDER[Number(e.points[0].x)]}));});
  }, [curves, summary, data, v.chart, v.hour, v.year, v.lens, v.movement, zoneSpeed, step]);
  useEffect(() => {
    const el = chartNode.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {if (el.querySelector('.plot-container')) void Plotly.Plots.resize(el);}); observer.observe(el);
    return () => {observer.disconnect(); Plotly.purge(el);};
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setExplore(e => ({...e, hour: (e.hour + 1) % 24})), 1400);
    return () => clearInterval(id);
  }, [playing]);
  // Iconos auditivos: cada sonido es un auto que pasa. Más viajes = pasan más autos (0,5 a 5 por segundo, relativo al máximo
  // de ambas curvas). Más velocidad = motor más agudo y paso más corto. Bajo 15 km/h aparecen bocinas (atasco).
  // Izquierda: lunes a viernes. Derecha: fin de semana. El volumen no codifica nada.
  useEffect(() => {
    if (!sound || !curves || !audio.current) return;
    const top = Math.max(...curves.weekday, ...curves.weekend);
    const heard: DayType[] = v.lens === 'diff' ? ['weekday', 'weekend'] : [v.lens];
    const ids = heard.flatMap(d => {
      const n = curves[d][v.hour];
      if (!n || !top) return [];
      const out = audio.current![d === 'weekday' ? 0 : 1], kmh = speedAt(d, v.hour) ?? 15;
      const pass = () => {passCar(out, kmh); if (Math.random() < honkChance(kmh) * 0.35) honk(out);};
      pass();
      return [window.setInterval(pass, 1000 / (0.5 + 4.5 * n / top))];
    });
    return () => ids.forEach(clearInterval);
  }, [sound, curves, v.hour, v.lens, zoneSpeed, data]);
  // Voz: al llegar a cada escena, con sonido activado, se lee la hora y el título (combina icono auditivo y voz, como en T4).
  useEffect(() => {
    if (!sound || !inStory || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(STEPS[step].say);
    u.lang = 'es-ES';
    u.voice = speechSynthesis.getVoices().find(voice => voice.lang.startsWith('es')) ?? null;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }, [sound, step, inStory]);
  useEffect(() => {if (!sound && 'speechSynthesis' in window) speechSynthesis.cancel();}, [sound]);
  useEffect(() => {
    const stop = () => {if (document.hidden) {setPlaying(false); setSound(false);}};
    document.addEventListener('visibilitychange', stop);
    return () => document.removeEventListener('visibilitychange', stop);
  }, []);
  async function toggleSound() {
    if (sound) {setSound(false); return;}
    try {
      await Tone.start();
      audio.current ??= [-0.8, 0.8].map(pan => new Tone.Panner(pan).toDestination());
      setSound(true);
    } catch {setError('No se pudo activar el audio. Puedes seguir la historia sin sonido.');}
  }
  async function start(withSound: boolean) {
    if (withSound && !sound) await toggleSound();
    cards.current[0]?.scrollIntoView({behavior: reduced() ? 'auto' : 'smooth', block: 'center'});
  }

  const list = useMemo(() => {
    if (!total || !week || !end) return {title: '', items: [] as {id: number; label: string; value: string}[]};
    if (v.selected !== undefined) return {
      title: v.movement === 'pickup' ? `A dónde van a las ${clock(v.hour)}` : `De dónde vienen a las ${clock(v.hour)}`,
      items: [...stays.map(s => ({id: s.zone, label: 'Dentro de la misma zona', value: `${fmt1(s.perDay)} al día`})), ...flows.map(f => {const id = v.movement === 'pickup' ? f.to : f.from; return {id, label: nameOf(id), value: `${fmt1(f.perDay)} al día`};})],
    };
    if (v.flows) return {title: `Flujos más grandes a las ${clock(v.hour)}`, items: flows.slice(0, 6).map(f => ({id: f.from, label: `${nameOf(f.from)} a ${nameOf(f.to)}`, value: `${fmt1(f.perDay)} al día`}))};
    if (v.lens === 'diff') return {
      title: `Donde más pesa el fin de semana a las ${clock(v.hour)}`,
      // Umbral de 10 viajes al día: evita razones ruidosas en zonas casi vacías.
      items: Object.keys(week.zones).map(Number).map(id => ({id, w: week.zones[id]?.[v.hour] ?? 0, e: end.zones[id]?.[v.hour] ?? 0})).filter(z => Math.max(z.w, z.e) >= 10).sort((a, b) => b.e / Math.max(b.w, 0.25) - a.e / Math.max(a.w, 0.25)).slice(0, 6).map(z => ({id: z.id, label: nameOf(z.id), value: `${fmt1(z.e / Math.max(z.w, 0.05))}×`})),
    };
    return {title: `Zonas con más ${v.movement === 'pickup' ? 'salidas' : 'llegadas'} a las ${clock(v.hour)}`, items: Object.entries(total.zones).map(([id, h]) => ({id: Number(id), n: h[v.hour]})).sort((a, b) => b.n - a.n).slice(0, 6).map(z => ({id: z.id, label: nameOf(z.id), value: fmt(z.n)}))};
  }, [total, week, end, flows, stays, v.selected, v.flows, v.lens, v.hour, v.movement, zoneById]);

  const place = v.selected === undefined ? 'toda la ciudad' : nameOf(v.selected);
  // En la historia el gráfico lleva un titular que afirma; al explorar, uno descriptivo con la selección.
  const chartTitle = inStory ? STEPS[step].chartTitle : v.chart === 'years' ? 'La madrugada del fin de semana, en ocho eneros' : v.chart === 'day' ? `Viajes por hora, ${place}` : `Velocidad mediana en km/h, ${place}`;
  const chartNote = v.chart === 'years' ? 'Viajes de 00:00 a 05:00: sábado y domingo dividido por lunes a viernes.' : `${v.chart === 'day' ? 'Viajes por hora, promedio por día' : 'Velocidad mediana en km/h'}, ${place}, de mediodía a mediodía.${inStory ? '' : ' Haz clic para cambiar la hora.'}`;
  const hovered = hover && (() => {
    const w = week?.zones[hover.id]?.[v.hour] ?? 0, e = end?.zones[hover.id]?.[v.hour] ?? 0;
    const n = total?.zones[hover.id]?.[v.hour] ?? 0, km2 = zoneById.get(hover.id)?.km2 ?? 1;
    const text = v.lens === 'diff' ? (Math.max(w, e) < 1 ? 'Menos de 1 viaje al día' : `${fmt1(e / Math.max(w, 0.05))} veces los viajes de lunes a viernes`) : `${fmt(n)} viajes, ${fmt1(n / km2)} por km²`;
    return <div className="tooltip" style={{left: hover.x, top: hover.y}}><strong>{nameOf(hover.id)}</strong><span>{text}</span>{inStory && <em>Haz clic para explorar esta zona</em>}</div>;
  })();

  return <>
    <header className="hero">
      <div className="hero-top"><span className="brand"><span className="roof">NY</span>El pulso de Nueva York</span><span>InfoVis, Grupo 16, V1</span></div>
      <div className="hero-copy">
        <h1>El fin de semana, Nueva York no madruga: trasnocha.</h1>
        <p>Ocho eneros de taxis amarillos, de 2019 a 2026{totalRows ? `: ${fmt(totalRows / 1e6)} millones de viajes` : ''} contados hora a hora. Recorre un día y una noche de la ciudad.</p>
        <div className="hero-actions">
          <button className="primary" onClick={() => void start(true)}>Empezar con sonido</button>
          <button className="ghost" onClick={() => void start(false)}>Empezar sin sonido</button>
          <a href="#explorar">Ir directo a explorar</a>
        </div>
      </div>
      {summary && <Horizon summary={summary}/>}
    </header>
    {error && <p role="alert" className="notice">{error}</p>}
    <main className="scrolly" style={{'--n': nightness(v.hour)} as React.CSSProperties}>
      <div className="rail">
        {STEPS.map((s, i) => <section className="step" key={i}>
          <article ref={el => {cards.current[i] = el;}} className={`card${i === step ? ' active' : ''}`}>
            <p className="when">{s.when}</p>
            <h2>{s.title}</h2>
            <p>{s.text}</p>
          </article>
        </section>)}
        <section className="explore" id="explorar" ref={exploreNode}>
          <div className={`card panel${inStory ? '' : ' active'}`}>
            <h2>Explora tú</h2>
            <p className="lede">Elige un año, una hora y una zona. Haz clic en una zona para ver a dónde van sus viajes.</p>
            <fieldset><legend>Enero de</legend><div className="chips">{YEARS.map(y => <button key={y} aria-pressed={v.year === y} onClick={() => act({year: y})}>{y}</button>)}</div></fieldset>
            <fieldset><legend>Días</legend><div className="segmented">{(['weekday', 'weekend', 'diff'] as const).map(l => <button key={l} aria-pressed={v.lens === l} onClick={() => act({lens: l})}>{l === 'weekday' ? 'Lunes a viernes' : l === 'weekend' ? 'Fin de semana' : 'Comparar'}</button>)}</div></fieldset>
            <fieldset><legend>Viajes</legend><div className="segmented">{(['pickup', 'dropoff'] as const).map(m => <button key={m} aria-pressed={v.movement === m} onClick={() => act({movement: m})}>{m === 'pickup' ? 'Salidas' : 'Llegadas'}</button>)}</div></fieldset>
            <div className="hour"><label htmlFor="hour">Hora de Nueva York</label><output htmlFor="hour">{clock(v.hour)}</output></div>
            <input id="hour" type="range" min="0" max="23" value={v.hour} onChange={e => act({hour: Number(e.target.value)})}/>
            <button className="primary wide" aria-pressed={playing} onClick={() => setPlaying(!playing)}>{playing ? 'Pausar' : 'Reproducir el día'}</button>
            <fieldset><legend>Capas del mapa</legend><div className="segmented">
              <button aria-pressed={v.flows} onClick={() => act({flows: !v.flows, three: false})}>Flujos</button>
              <button aria-pressed={relief} onClick={() => act({three: !relief, flows: false})}>Relieve 3D</button>
            </div></fieldset>
            <label htmlFor="zone">Zona</label>
            <div className="search">
              <input id="zone" list="zones" placeholder="Busca una zona, por ejemplo East Village" value={query} onChange={e => {
                setQuery(e.target.value);
                const hit = zoneNames.find(([, z]) => z.zone.toLowerCase() === e.target.value.trim().toLowerCase());
                if (hit) act({selected: hit[0]});
              }}/>
              {v.selected !== undefined && <button onClick={() => act({selected: undefined})}>Ver toda la ciudad</button>}
            </div>
            <datalist id="zones">{zoneNames.map(([id, z]) => <option key={id} value={z.zone}/>)}</datalist>
            <div className="list">
              <h3>{list.title}</h3>
              {list.items.length ? <ol>{list.items.map(r => <li key={`${r.id}-${r.label}`}><button onClick={() => act({selected: r.id})}><span>{r.label}</span><strong>{r.value}</strong></button></li>)}</ol>
                : <p className="empty">No hay flujos de más de medio viaje al día a esta hora. Prueba otra hora o toda la ciudad.</p>}
            </div>
          </div>
        </section>
      </div>
      <div className={`stage${relief ? ' is-relief' : ''}`}>
        <div className="map" ref={mapNode} aria-label="Mapa de las zonas de taxi de Nueva York"/>
        {hovered}
        <div className="meter">
          <div className="meter-clock">{clock(v.hour)}</div>
          <p className="meter-when">{LENS[v.lens]}, enero de {v.year}</p>
          <p className="meter-place">{v.selected === undefined ? 'Toda la ciudad' : nameOf(v.selected)}{v.movement === 'dropoff' ? ', llegadas' : ''}</p>
          {data ? <dl>
            <div><dt>{v.lens === 'diff' ? `veces los viajes de lunes a viernes, entre ${clock(v.hour)} y ${clock((v.hour + 1) % 24)}` : `viajes entre ${clock(v.hour)} y ${clock((v.hour + 1) % 24)}`}</dt><dd>{v.lens === 'diff' ? fmt1(ratio) : fmt(trips)}</dd></div>
            <div><dt>km/h, velocidad mediana {day === 'weekday' ? 'de lunes a viernes' : 'del fin de semana'}</dt><dd>{kmh === null ? 'sin datos' : fmt1(kmh)}</dd></div>
          </dl> : <p className="meter-when" role="status">Cargando enero de {v.year}…</p>}
          <button className="sound" aria-pressed={sound} onClick={() => void toggleSound()}>{sound ? 'Silenciar' : 'Activar sonido'}</button>
          {sound && <p className="meter-hint">Cada sonido es un auto que pasa: más autos, más viajes; más agudos, más rápidos; bocinas, atasco. Izquierda: lunes a viernes. Derecha: fin de semana.</p>}
        </div>
        <div className="legend">
          {v.flows ? <><svg viewBox="0 0 160 30" aria-hidden="true"><defs><linearGradient id="flow"><stop offset="0" stopColor="#173c50" stopOpacity="0.12"/><stop offset="1" stopColor="#173c50"/></linearGradient></defs><path d="M4 22 Q60 4 116 16" stroke="url(#flow)" strokeWidth="5" fill="none" strokeLinecap="round"/><circle cx="142" cy="15" r="9" fill="rgba(23,60,80,0.08)" stroke="#173c50" strokeWidth="2"/></svg>
            <small>{v.selected === undefined ? 'Los 40 flujos mayores entre zonas distintas' : 'Los 6 flujos principales de la zona'}, con al menos medio viaje al día. Van de la zona de origen (claro) a la de destino (oscuro). Grosor y taxis: viajes al día; el mayor tiene {fmt1(flowMax)}. Anillo: viajes que empiezan y terminan en la misma zona.</small></>
            : v.lens === 'diff' ? <><div className="ramp diverging"/><div className="ticks"><span>4× lun–vie</span><span>igual</span><span>4× sáb–dom</span></div><small>Viajes del fin de semana dividido por los de lunes a viernes, a la misma hora (promedio por día){relief ? '. Altura: viajes por km²' : ''}. Gris: menos de 1 viaje al día.</small></>
            : <><div className="ramp"/><div className="ticks">{DENSITY_STOPS.map(n => <span key={n}>{fmt1(n)}</span>)}</div><small>Viajes por km² en esta hora (promedio por día). Cada marca multiplica por 10; la escala es la misma para los ocho años{relief ? '; altura lineal' : ''}. Gris: sin viajes.</small></>}
          {relief && <small className="caveat">La perspectiva deforma las alturas: usa el relieve para ubicar, no para comparar.</small>}
        </div>
        <div className="chart-card">
          <div className="chart-head">
            <h3>{chartTitle}</h3>
            {!inStory && <div className="segmented small">{(['day', 'speed', 'years'] as ChartMode[]).map(c => <button key={c} aria-pressed={v.chart === c} onClick={() => act({chart: c})}>{c === 'day' ? 'Viajes' : c === 'speed' ? 'Velocidad' : 'Años'}</button>)}</div>}
          </div>
          <p>{chartNote}</p>
          <div ref={chartNode}/>
        </div>
      </div>
    </main>
    <section className="method">
      <h2>Datos y método</h2>
      <p>Fuente: registros de viajes de taxis amarillos de la <a href="https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page" target="_blank" rel="noreferrer">NYC Taxi & Limousine Commission</a>, enero de 2019 a 2026. Enero de {v.year} tiene {fmt(data?.metadata.rawRows ?? 0)} filas. No incluye Uber, Lyft ni transporte público, y cuenta viajes, no personas.</p>
      <p>Contamos salidas y llegadas con su propia fecha y hora local, dentro de enero y con una zona reconocida. Cada valor es un promedio por día: dividimos por los {data?.days.weekday} días de lunes a viernes o los {data?.days.weekend} de sábado y domingo de {v.year}. Lunes a viernes incluye feriados. En {v.movement === 'pickup' ? 'salidas' : 'llegadas'} quedaron fuera {fmt(data?.metadata.coverage[v.movement].unknownZone ?? 0)} viajes sin zona y {fmt(data?.metadata.coverage[v.movement].outsideMonth ?? 0)} fuera de enero.</p>
      <p>Velocidad: distancia del viaje dividida por su duración, en viajes de 1 minuto a 3 horas, de 0,16 a 80 km y de 1,6 a 113 km/h. Mostramos la mediana por hora de salida; una zona necesita al menos 10 viajes en esa hora del mes, si no, usamos la de la ciudad. Tarifa: mediana del total pagado en esos mismos viajes, llevada a dólares de enero de 2026 con el índice de precios al consumidor del área de Nueva York (BLS, serie CUURS12ASA0).</p>
      <p>Flujos: pares de zonas distintas por hora de salida, con al menos medio viaje al día. Se dibujan los 40 pares más grandes de la ciudad o, con una zona elegida, sus 6 destinos u orígenes principales. Los viajes que empiezan y terminan en la misma zona se muestran aparte, como anillos. «Termina cerca» describe destinos; los datos no dicen si la persona vuelve a su casa.</p>
      <p>Color: densidad en viajes por km², en escala logarítmica común a todas las horas y años (de 0,1 a 1.000; cada marca multiplica por 10). Comparar: viajes del fin de semana divididos por los de lunes a viernes a la misma hora. Relieve 3D, solo al explorar: altura lineal a la densidad. Los ejes de los gráficos van de mediodía a mediodía para no cortar la noche.</p>
      <p>Sonido: cada sonido es un auto que pasa, sintetizado para poder variar su velocidad de forma continua. Pasan más autos cuando hay más viajes (0,5 a 5 por segundo); el motor suena más agudo y el paso es más corto cuando la velocidad mediana es mayor; bajo 15 km/h aparecen bocinas, más seguidas cuanto más lento va el tráfico. Lunes a viernes suena a la izquierda y el fin de semana a la derecha. El volumen no cambia. En la historia, una voz lee la hora y el título de cada escena.</p>
    </section>
    <footer><span>Grupo 16: Vicente Reñasco, David Parra y Mariano De Sarratea</span><span>V1, visualización interactiva y sonora</span></footer>
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);
