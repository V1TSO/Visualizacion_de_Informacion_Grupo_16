import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as maplibregl from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { FeatureCollection, LineString, Point } from 'geojson';
import Plotly from 'plotly.js-basic-dist-min';
import * as Tone from 'tone';
import { aggregate, arc, nightness, noteFor, topFlows, windowRatio, NIGHT, type Dataset, type DayType, type Summary } from './data';
import { CITY, STEPS, type ChartMode, type Lens, type View } from './story';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

maplibregl.setWorkerUrl(mapWorkerUrl);
const fmt = (n: number) => n.toLocaleString('es-CL', {maximumFractionDigits: 0});
const fmt1 = (n: number) => n.toLocaleString('es-CL', {maximumFractionDigits: 1});
const clock = (h: number) => `${String(h).padStart(2, '0')}:00`;
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const HOURS = Array.from({length: 24}, (_, h) => h);
const COLORS = ['#fff3bd', '#f5cc52', '#e89b27', '#bc5c21', '#762e1d'];
const DIVERGING = ['#245978', '#8fb3c9', '#f1f1ec', '#e8a36b', '#b65d23'];
const LAND = '#e3e7e5';
// Altura 3D lineal: la longitud se lee como cantidad; el color sigue siendo logarítmico.
const TOWER_METERS = 6000;
const WATER_DAY = [223, 234, 240], WATER_NIGHT = [21, 36, 51];
const water = (t: number) => `rgb(${WATER_DAY.map((d, i) => Math.round(d + (WATER_NIGHT[i] - d) * t)).join(',')})`;
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
type Zone = {zone: string; borough: string; cx: number; cy: number};
type Arc = {coords: [number, number][]; w: number};

function Horizon({summary}: {summary: Summary}) {
  const {weekday, weekend} = summary.years['2026'].city.pickup;
  const W = 1200, H = 170, max = Math.max(...weekday, ...weekend);
  const x = (h: number) => h / 23 * W, y = (n: number) => H - n / max * (H - 24);
  const points = (a: number[]) => a.map((n, h) => `${x(h).toFixed(1)},${y(n).toFixed(1)}`).join(' ');
  return <svg className="horizon" viewBox={`0 -10 ${W} ${H + 40}`} role="img" aria-label="Viajes por hora en enero de 2026. El fin de semana tiene su máximo de madrugada; los días de semana, en la mañana y la tarde.">
    <polyline className="line-week" points={points(weekday)} pathLength={1}/>
    <polyline className="line-end" points={points(weekend)} pathLength={1}/>
    <text className="label-end" x={x(1) + 14} y={y(weekend[1]) - 12}>sábado y domingo</text>
    <text className="label-week" x={x(8) - 10} y={y(weekday[8]) - 14} textAnchor="end">lunes a viernes</text>
    {[0, 6, 12, 18, 23].map(h => <text key={h} className="tick" x={x(h)} y={H + 26} textAnchor={h === 0 ? 'start' : h === 23 ? 'end' : 'middle'}>{clock(h)}</text>)}
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
  const voices = useRef<Tone.Synth[] | null>(null);
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
    return () => voices.current?.forEach(voice => voice.dispose());
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
    const m = new maplibregl.Map({container: mapNode.current, style: {version: 8, sources: {}, transition: {duration: 700, delay: 0}, layers: [{id: 'water', type: 'background', paint: {'background-color': water(0)}}]}, center: CITY.center, zoom: CITY.zoom, maxZoom: 15, minZoom: 8, attributionControl: false, scrollZoom: false, canvasContextAttributes: {antialias: true}});
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
      m.setFeatureState({source: 'zones', id}, {value: total.zones[id]?.[v.hour] ?? 0, low: Math.max(w, e) < 1, ratio: Math.log2(Math.max(e, 0.25) / Math.max(w, 0.25))});
    }
    const value: maplibregl.ExpressionSpecification = ['coalesce', ['feature-state', 'value'], 0];
    // Escala logarítmica común a los ocho años: la zona mediana tiene <1 % del máximo, una escala lineal la deja casi blanca.
    const color: maplibregl.DataDrivenPropertyValueSpecification<string> = v.flows ? LAND : v.lens === 'diff'
      ? ['case', ['coalesce', ['feature-state', 'low'], true], LAND, ['interpolate', ['linear'], ['coalesce', ['feature-state', 'ratio'], 0], -2, DIVERGING[0], -1, DIVERGING[1], 0, DIVERGING[2], 1, DIVERGING[3], 2, DIVERGING[4]]]
      : ['case', ['==', value, 0], LAND, ['interpolate', ['linear'], value, 1, COLORS[0], 5, COLORS[1], 25, COLORS[2], 125, COLORS[3], summary.zoneMax, COLORS[4]]];
    m.setPaintProperty('fill', 'fill-color', color);
    m.setPaintProperty('extrusion', 'fill-extrusion-color', color);
    m.setPaintProperty('extrusion', 'fill-extrusion-height', ['*', value, TOWER_METERS / summary.zoneMax]);
    m.setLayoutProperty('extrusion', 'visibility', relief ? 'visible' : 'none');
    m.setLayoutProperty('fill', 'visibility', relief ? 'none' : 'visible');
    m.setFilter('selected', ['==', ['id'], v.selected ?? -1]);
    m.setPaintProperty('water', 'background-color', water(nightness(v.hour)));
  }, [ready, geo, total, week, end, summary, v.hour, v.lens, v.flows, v.selected, relief]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const max = Math.max(...flows.map(f => f.perDay), 1);
    arcs.current = v.flows ? flows.flatMap(f => {
      const a = zoneById.get(f.from), b = zoneById.get(f.to);
      return a && b ? [{coords: arc([a.cx, a.cy], [b.cx, b.cy]), w: 1.2 + 7 * Math.sqrt(f.perDay / max)}] : [];
    }) : [];
    (m.getSource('flows') as maplibregl.GeoJSONSource).setData({type: 'FeatureCollection', features: arcs.current.map(a => ({type: 'Feature', properties: {w: a.w}, geometry: {type: 'LineString', coordinates: a.coords} satisfies LineString}))});
  }, [ready, flows, v.flows, zoneById]);

  // Dos taxis por flujo recorren cada arco. Sin animación si la persona pidió reducir el movimiento.
  useEffect(() => {
    const source = ready ? map.current?.getSource('particles') as maplibregl.GeoJSONSource | undefined : undefined;
    if (!source) return;
    if (!v.flows || reduced()) {source.setData(EMPTY); return;}
    let raf = 0, last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 33) return;
      last = t;
      source.setData({type: 'FeatureCollection', features: arcs.current.flatMap((a, i) => [0, 0.5].map(phase => {
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
    const common = {margin: {t: 8, r: 12, b: 28, l: 38}, height: 170, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font, showlegend: false};
    // En viajes se atenúa el tipo de día que no se ve en el mapa; en velocidad se comparan ambos.
    const opacity = (d: DayType) => v.chart === 'speed' || v.lens === 'diff' || v.lens === d ? 1 : 0.3;
    let plot: Promise<Plotly.PlotlyHTMLElement>;
    if (v.chart === 'years') {
      const ratios = YEARS.map(y => windowRatio(summary.years[y].city[v.movement].weekend, summary.years[y].city[v.movement].weekday, NIGHT));
      plot = Plotly.react(el, [{type: 'bar', x: YEARS.map(String), y: ratios, marker: {color: YEARS.map(y => y === v.year ? '#f6bd16' : '#b9c9d1')}, hovertemplate: 'Enero de %{x}: %{y:.1f} veces<extra></extra>'}], {...common, xaxis: {type: 'category', fixedrange: true}, yaxis: {rangemode: 'tozero', fixedrange: true, gridcolor: '#e5e9e9', ticksuffix: '×'}, bargap: 0.35, shapes: [{type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 1, y1: 1, line: {color: '#47606b', width: 1, dash: 'dot'}}], annotations: [{x: YEARS.indexOf(2021), y: ratios[YEARS.indexOf(2021)], yanchor: 'bottom', text: 'Pandemia', showarrow: false, font: {...font, color: '#173c50'}}, {xref: 'paper', x: 1, y: 1, xanchor: 'right', yanchor: 'bottom', text: 'igual', showarrow: false, font: {...font, size: 10}}]}, {displayModeBar: false, responsive: true});
    } else {
      const series = v.chart === 'day' ? curves : {weekday: HOURS.map(h => speedAt('weekday', h)), weekend: HOURS.map(h => speedAt('weekend', h))};
      const unit = v.chart === 'day' ? 'viajes' : 'km/h';
      plot = Plotly.react(el, [
        {x: HOURS, y: series.weekday, type: 'scatter', mode: 'lines', opacity: opacity('weekday'), line: {color: '#245978', width: 3}, hovertemplate: `%{y:.1f} ${unit}<extra>Lunes a viernes</extra>`},
        {x: HOURS, y: series.weekend, type: 'scatter', mode: 'lines', opacity: opacity('weekend'), line: {color: '#b65d23', width: 3, dash: 'dot'}, hovertemplate: `%{y:.1f} ${unit}<extra>Sábado y domingo</extra>`},
      ], {...common, hovermode: 'x unified', xaxis: {range: [0, 23], tickvals: [0, 6, 12, 18, 23], ticktext: ['00', '06', '12', '18', '23'], fixedrange: true}, yaxis: {rangemode: 'tozero', fixedrange: true, gridcolor: '#e5e9e9'}, shapes: [{type: 'rect', xref: 'x', yref: 'paper', x0: 0, x1: 5, y0: 0, y1: 1, fillcolor: '#152433', opacity: 0.06, line: {width: 0}, layer: 'below'}, {type: 'line', xref: 'x', yref: 'paper', x0: v.hour, x1: v.hour, y0: 0, y1: 1, line: {color: '#bc911a', width: 2, dash: 'dot'}}], annotations: [{x: 2.5, xref: 'x', y: 1, yref: 'paper', yanchor: 'top', text: 'madrugada', showarrow: false, font: {...font, size: 10}}]}, {displayModeBar: false, responsive: true});
    }
    void plot.then(p => {p.removeAllListeners('plotly_click'); p.on('plotly_click', e => act(v.chart === 'years' ? {year: Number(e.points[0].x)} : {hour: Number(e.points[0].x)}));});
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
  // Izquierda: lunes a viernes. Derecha: fin de semana. Ritmo = viajes (escala: máximo de ambas curvas). Tono = velocidad.
  useEffect(() => {
    if (!sound || !curves || !voices.current) return;
    const top = Math.max(...curves.weekday, ...curves.weekend);
    const heard: DayType[] = v.lens === 'diff' ? ['weekday', 'weekend'] : [v.lens];
    const ids = heard.flatMap(d => {
      const n = curves[d][v.hour];
      if (!n || !top) return [];
      const voice = voices.current![d === 'weekday' ? 0 : 1], note = noteFor(speedAt(d, v.hour) ?? 15);
      const pulse = () => voice.triggerAttackRelease(note, '32n', Tone.now(), 0.25);
      pulse();
      return [window.setInterval(pulse, 1000 / (0.5 + 4.5 * n / top))];
    });
    return () => ids.forEach(clearInterval);
  }, [sound, curves, v.hour, v.lens, zoneSpeed, data]);
  useEffect(() => {
    const stop = () => {if (document.hidden) {setPlaying(false); setSound(false);}};
    document.addEventListener('visibilitychange', stop);
    return () => document.removeEventListener('visibilitychange', stop);
  }, []);
  async function toggleSound() {
    if (sound) {setSound(false); return;}
    try {
      await Tone.start();
      voices.current ??= ([['sine', -0.8], ['triangle', 0.8]] as const).map(([type, pan]) => new Tone.Synth({oscillator: {type}, envelope: {attack: 0.005, decay: 0.06, sustain: 0, release: 0.1}, volume: -14}).connect(new Tone.Panner(pan).toDestination()));
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
      items: flows.map(f => {const id = v.movement === 'pickup' ? f.to : f.from; return {id, label: nameOf(id), value: `${fmt1(f.perDay)} al día`};}),
    };
    if (v.flows) return {title: `Flujos más grandes a las ${clock(v.hour)}`, items: flows.slice(0, 6).map(f => ({id: f.from, label: `${nameOf(f.from)} a ${nameOf(f.to)}`, value: `${fmt1(f.perDay)} al día`}))};
    if (v.lens === 'diff') return {
      title: `Donde más pesa el fin de semana a las ${clock(v.hour)}`,
      // Umbral de 10 viajes al día: evita razones ruidosas en zonas casi vacías.
      items: Object.keys(week.zones).map(Number).map(id => ({id, w: week.zones[id]?.[v.hour] ?? 0, e: end.zones[id]?.[v.hour] ?? 0})).filter(z => Math.max(z.w, z.e) >= 10).sort((a, b) => b.e / Math.max(b.w, 0.25) - a.e / Math.max(a.w, 0.25)).slice(0, 6).map(z => ({id: z.id, label: nameOf(z.id), value: `${fmt1(z.e / Math.max(z.w, 0.05))}×`})),
    };
    return {title: `Zonas con más ${v.movement === 'pickup' ? 'salidas' : 'llegadas'} a las ${clock(v.hour)}`, items: Object.entries(total.zones).map(([id, h]) => ({id: Number(id), n: h[v.hour]})).sort((a, b) => b.n - a.n).slice(0, 6).map(z => ({id: z.id, label: nameOf(z.id), value: fmt(z.n)}))};
  }, [total, week, end, flows, v.selected, v.flows, v.lens, v.hour, v.movement, zoneById]);

  const place = v.selected === undefined ? 'toda la ciudad' : nameOf(v.selected);
  const chartTitle = v.chart === 'years' ? 'La madrugada del fin de semana, en ocho eneros' : v.chart === 'day' ? `Viajes por hora, ${place}` : `Velocidad mediana en km/h, ${place}`;
  const chartNote = v.chart === 'years' ? 'Viajes de 00:00 a 05:00, sábado y domingo dividido por lunes a viernes' : 'Azul: lunes a viernes. Naranjo punteado: sábado y domingo.';
  const hovered = hover && (() => {
    const w = week?.zones[hover.id]?.[v.hour] ?? 0, e = end?.zones[hover.id]?.[v.hour] ?? 0;
    const text = v.lens === 'diff' ? (Math.max(w, e) < 1 ? 'Menos de 1 viaje al día' : `${fmt1(e / Math.max(w, 0.05))} veces los viajes de lunes a viernes`) : `${fmt(total?.zones[hover.id]?.[v.hour] ?? 0)} viajes`;
    return <div className="tooltip" style={{left: hover.x, top: hover.y}}><strong>{nameOf(hover.id)}</strong><span>{text}</span></div>;
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
            <div><dt>{v.lens === 'diff' ? 'veces los viajes de lunes a viernes' : `viajes entre ${clock(v.hour)} y ${clock((v.hour + 1) % 24)}`}</dt><dd>{v.lens === 'diff' ? fmt1(ratio) : fmt(trips)}</dd></div>
            <div><dt>km/h, velocidad mediana {day === 'weekday' ? 'de lunes a viernes' : 'del fin de semana'}</dt><dd>{kmh === null ? 'sin datos' : fmt1(kmh)}</dd></div>
          </dl> : <p className="meter-when" role="status">Cargando enero de {v.year}…</p>}
          <button className="sound" aria-pressed={sound} onClick={() => void toggleSound()}>{sound ? 'Silenciar' : 'Activar sonido'}</button>
          {sound && <p className="meter-hint">Ritmo: cantidad de viajes. Tono: velocidad. Izquierda: lunes a viernes. Derecha: fin de semana.</p>}
        </div>
        <div className="legend">
          {v.flows ? <><svg viewBox="0 0 160 14" aria-hidden="true"><defs><linearGradient id="flow"><stop offset="0" stopColor="#173c50" stopOpacity="0.12"/><stop offset="1" stopColor="#173c50"/></linearGradient></defs><path d="M4 11 Q80 -4 156 7" stroke="url(#flow)" strokeWidth="5" fill="none" strokeLinecap="round"/></svg>
            <small>De la zona de origen (claro) a la de destino (oscuro). Grosor: viajes al día; el mayor tiene {fmt1(Math.max(...flows.map(f => f.perDay), 0))}.</small></>
            : v.lens === 'diff' ? <><div className="ramp diverging"/><div className="ticks"><span>4× lun–vie</span><span>igual</span><span>4× sáb–dom</span></div><small>Razón entre promedios diarios a la misma hora{relief ? '. Altura: cantidad de viajes' : ''}. Gris: menos de 1 viaje al día.</small></>
            : <><div className="ramp"/><div className="ticks"><span>1</span><span>5</span><span>25</span><span>125</span><span>{fmt(summary?.zoneMax ?? 0)}</span></div><small>Viajes por zona en esta hora, promedio por día. Escala logarítmica igual para los ocho años{relief ? '; altura lineal' : ''}.</small></>}
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
      <p>Velocidad: distancia del viaje dividida por su duración, en viajes de 1 minuto a 3 horas, de 0,16 a 80 km y de 1,6 a 113 km/h. Mostramos la mediana por hora de salida; una zona necesita al menos 10 viajes en esa hora del mes, si no, usamos la de la ciudad. Tarifa: mediana del total pagado en esos mismos viajes, en dólares corrientes.</p>
      <p>Flujos: pares de zonas distintas por hora de salida, con al menos medio viaje al día. Guardamos los 6 destinos y los 6 orígenes principales de cada zona y los 40 pares más grandes de la ciudad.</p>
      <p>Color: escala logarítmica común a todas las horas y años (1, 5, 25, 125 y {fmt(summary?.zoneMax ?? 0)} viajes). Comparar: razón entre los promedios de sábado y domingo y de lunes a viernes a la misma hora. Relieve 3D: altura lineal a los viajes. Sonido: una voz por tipo de día, en estéreo; el ritmo va de 0,5 a 5 pulsos por segundo según los viajes, y el tono sigue una escala pentatónica según la velocidad mediana, de 10 a 28 km/h.</p>
    </section>
    <footer><span>Grupo 16: Vicente Reñasco, David Parra y Mariano De Sarratea</span><span>V1, visualización interactiva y sonora</span></footer>
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);
