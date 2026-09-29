import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as maplibregl from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { FeatureCollection } from 'geojson';
import Plotly from 'plotly.js-basic-dist-min';
import * as Tone from 'tone';
import { aggregate, MORNING, NIGHT, windowRatio, type Dataset, type Day, type Movement, type Summary } from './data';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';

const fmt = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 0 });
const clock = (h: number) => `${String(h).padStart(2, '0')}:00`;
const colors = ['#fff3bd', '#f5cc52', '#e89b27', '#bc5c21', '#762e1d'];
const diverging = ['#245978', '#8fb3c9', '#f1f1ec', '#e8a36b', '#b65d23'];
const fmt1 = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 1 });
// Media por día de cada tipo; por eso la razón no depende de que haya 22 y 9 días.
const ratioText = (w: number, e: number) => w < 0.05 ? 'solo fin de semana' : e < 0.05 ? 'solo lunes–viernes' : e >= w ? `${fmt1(e/w)}× más el fin de semana` : `${fmt1(w/e)}× más de lunes a viernes`;
type View = 'volume' | 'diff';
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
// Altura 3D lineal: la longitud se lee como cantidad; el color sigue siendo logarítmico.
const TOWER_METERS = 4000;
const load = async (file: string) => {
  const r = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!r.ok) throw new Error('No se pudieron cargar los datos. Recarga la página.');
  return r.json();
};
maplibregl.setWorkerUrl(mapWorkerUrl);

function App() {
  const [data, setData] = useState<Dataset>();
  const [summary, setSummary] = useState<Summary>();
  const [year, setYear] = useState(2026);
  const [three, setThree] = useState(false);
  const cache = useRef(new Map<number, Dataset>());
  const yearsNode = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<FeatureCollection>();
  const [error, setError] = useState('');
  const [day, setDay] = useState<Day>('all');
  const [movement, setMovement] = useState<Movement>('pickup');
  const [view, setView] = useState<View>('volume');
  const [hover, setHover] = useState<{id: number; x: number; y: number}>();
  const [hour, setHour] = useState(18);
  const [selected, setSelected] = useState<number>();
  const [playing, setPlaying] = useState(false);
  const [sound, setSound] = useState(false);
  const [ready, setReady] = useState(false);
  const mapNode = useRef<HTMLDivElement>(null);
  const chartNode = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const voices = useRef<[Tone.Synth, string][] | null>(null);

  useEffect(() => {
    Promise.all(['years.json', 'zones.geojson'].map(load)).then(([s, g]) => {setSummary(s); setGeo(g);}).catch(e => setError(String(e.message)));
    return () => {voices.current?.forEach(([v]) => v.dispose());};
  }, []);
  useEffect(() => {
    const hit = cache.current.get(year);
    if (hit) {setData(hit); return;}
    let live = true;
    load(`trips-${year}.json`).then(d => {cache.current.set(year, d); if (live) setData(d);}).catch(e => setError(String(e.message)));
    return () => {live = false;};
  }, [year]);
  // En comparación, la altura 3D usa todos los días: el filtro de día está desactivado.
  const total = useMemo(() => data ? aggregate(data, movement, view==='diff' ? 'all' : day) : null, [data, movement, day, view]);
  const local = useMemo(() => data ? aggregate(data, movement, day, selected) : null, [data, movement, day, selected]);
  const week = useMemo(() => data ? aggregate(data, movement, 'weekday') : null, [data, movement]);
  const end = useMemo(() => data ? aggregate(data, movement, 'weekend') : null, [data, movement]);
  const curves = useMemo(() => data ? {week: aggregate(data, movement, 'weekday', selected).hours, end: aggregate(data, movement, 'weekend', selected).hours} : null, [data, movement, selected]);
  const zoneMax = summary?.zoneMax ?? 0;
  const facts = useMemo(() => {
    const y = summary?.years[year];
    if (!y) return null;
    const {weekday: w, weekend: e} = y.city[movement];
    const sum = (a: number[]) => a.reduce((s, n) => s + n, 0);
    return {night: windowRatio(e, w, NIGHT), morning: windowRatio(e, w, MORNING), perDayWeek: sum(w), perDayEnd: sum(e)};
  }, [summary, year, movement]);  const zoneFeatures = useMemo(() => [...(geo?.features ?? [])].sort((a,b) => String(a.properties?.zone).localeCompare(String(b.properties?.zone))), [geo]);
  const zoneName = zoneFeatures.find(f => f.id === selected)?.properties?.zone;
  const nameOf = (id: number) => zoneFeatures.find(f => f.id === id)?.properties?.zone ?? String(id);
  const ranking = useMemo(() => {
    if (view === 'volume') return Object.entries(total?.zones ?? {}).map(([id, hours]) => ({id: Number(id), sort: hours[hour], label: fmt(hours[hour])})).sort((a,b) => b.sort-a.sort).slice(0,5);
    // ponytail: umbral fijo de 10 viajes/día para evitar razones ruidosas en zonas casi vacías.
    return Object.keys(week?.zones ?? {}).map(Number).map(id => ({id, w: week!.zones[id]?.[hour] ?? 0, e: end!.zones[id]?.[hour] ?? 0})).filter(z => Math.max(z.w, z.e) >= 10).map(z => ({id: z.id, sort: Math.log2(Math.max(z.e,0.25)/Math.max(z.w,0.25)), label: `${fmt1(z.e/Math.max(z.w,0.05))}×`})).sort((a,b) => b.sort-a.sort).slice(0,5);
  }, [view, total, week, end, hour]);
  const value = local?.hours[hour] ?? 0;
  const cityValue = total?.hours[hour] ?? 0;
  const peak = total ? total.hours.indexOf(Math.max(...total.hours)) : 0;

  useEffect(() => {
    if (!geo || !mapNode.current) return;
    const m = new maplibregl.Map({container: mapNode.current, style: {version:8, sources:{}, layers:[{id:'water', type:'background', paint:{'background-color':'#dfeaf0'}}]}, center:[-73.96,40.74], zoom:10.25, maxZoom:15, minZoom:8, attributionControl:false, canvasContextAttributes:{antialias:true}});
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({showCompass:false}), 'top-right');
    m.addControl(new maplibregl.AttributionControl({compact:true, customAttribution:'Zonas: NYC TLC'}));
    for (const [name, lng, lat] of [['Manhattan',-73.975,40.783],['Brooklyn',-73.96,40.65],['Queens',-73.82,40.733],['Bronx',-73.86,40.85],['Staten Island',-74.15,40.58]] as const) {
      const label=document.createElement('span');label.className='borough-label';label.textContent=name;
      new maplibregl.Marker({element:label}).setLngLat([lng,lat]).addTo(m);
    }
    m.on('error',()=>setError('El mapa no pudo cargar un recurso. Recarga la página; los filtros, gráficos y datos siguen disponibles.'));
    m.on('load', () => {
      m.addSource('zones', {type:'geojson', data:geo});
      m.addLayer({id:'fill', type:'fill', source:'zones', paint:{'fill-color':'#eff0ec','fill-opacity':0.96}});
      m.addLayer({id:'borders', type:'line', source:'zones', paint:{'line-color':'#ffffff','line-width':0.7}});
      m.addLayer({id:'extrusion', type:'fill-extrusion', source:'zones', layout:{visibility:'none'}, paint:{'fill-extrusion-color':'#eff0ec','fill-extrusion-opacity':0.94}});
      m.addLayer({id:'selected', type:'line', source:'zones', filter:['==','LocationID',-1], paint:{'line-color':'#143c52','line-width':3}});
      setReady(true);
    });
    m.on('click',['fill','extrusion'],e => {const id=e.features?.[0]?.properties?.LocationID; if(id) setSelected(Number(id));});
    m.on('mousemove',['fill','extrusion'],e => {const id=e.features?.[0]?.id; m.getCanvas().style.cursor='pointer'; if(id!==undefined) setHover({id:Number(id),x:e.point.x,y:e.point.y});});
    m.on('mouseleave',['fill','extrusion'],()=>{m.getCanvas().style.cursor='';setHover(undefined);});
    const observer = new ResizeObserver(()=>m.resize()); observer.observe(mapNode.current);
    return () => {observer.disconnect();m.remove();map.current=null;};
  }, [geo]);

  useEffect(() => {
    if (!ready || !map.current || !total || !week || !end || !zoneMax || !geo) return;
    for (const feature of geo.features) {
      const id=Number(feature.id), w=week.zones[id]?.[hour] ?? 0, e=end.zones[id]?.[hour] ?? 0;
      map.current.setFeatureState({source:'zones',id},{value:total.zones[id]?.[hour] ?? 0, low:Math.max(w,e)<1, ratio:Math.log2(Math.max(e,0.25)/Math.max(w,0.25))});
    }
    const value: maplibregl.ExpressionSpecification=['coalesce',['feature-state','value'],0];
    // Escala logarítmica por tramos: la zona mediana tiene <1 % del máximo, una escala lineal la deja casi blanca.
    const color: maplibregl.ExpressionSpecification = view==='volume'
      ? ['case',['==',value,0],'#eff0ec',['interpolate',['linear'],value,1,colors[0],5,colors[1],25,colors[2],125,colors[3],zoneMax,colors[4]]]
      : ['case',['coalesce',['feature-state','low'],true],'#eff0ec',['interpolate',['linear'],['coalesce',['feature-state','ratio'],0],-2,diverging[0],-1,diverging[1],0,diverging[2],1,diverging[3],2,diverging[4]]];
    map.current.setPaintProperty('fill','fill-color',color);
    map.current.setPaintProperty('extrusion','fill-extrusion-color',color);
    map.current.setPaintProperty('extrusion','fill-extrusion-height',['*',value,TOWER_METERS/zoneMax]);
    map.current.setFilter('selected',['==','LocationID',selected ?? -1]);
  }, [ready,total,week,end,zoneMax,hour,selected,geo,view]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setLayoutProperty('extrusion','visibility',three?'visible':'none');
    m.setLayoutProperty('fill','visibility',three?'none':'visible');
    m.easeTo({pitch:three?55:0, bearing:three?-25:0, duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:900});
  }, [ready,three]);

  useEffect(() => {
    if (!curves || !chartNode.current) return;
    const el=chartNode.current;
    const a=curves.week, b=curves.end;
    const x=Array.from({length:24},(_,i)=>i);
    void Plotly.react(el,[{x,y:a,name:'Lunes–viernes',type:'scatter',mode:'lines',line:{color:'#245978',width:3},hovertemplate:'%{y:.0f} viajes/día<extra>Lunes–viernes</extra>'},{x,y:b,name:'Sábado–domingo',type:'scatter',mode:'lines',line:{color:'#b65d23',width:3,dash:'dot'},hovertemplate:'%{y:.0f} viajes/día<extra>Sábado–domingo</extra>'}],{margin:{t:12,r:15,b:35,l:55},height:215,paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{family:'Arial',color:'#47606b',size:11},xaxis:{range:[0,23],tickvals:[0,6,12,18,23],ticktext:['00 h','06 h','12 h','18 h','23 h'],fixedrange:true},yaxis:{rangemode:'tozero',fixedrange:true,gridcolor:'#e5e9e9'},legend:{orientation:'h',y:1.22,x:0},hovermode:'x unified',shapes:[{type:'rect',xref:'x',yref:'paper',x0:0,x1:5,y0:0,y1:1,fillcolor:'#b65d23',opacity:0.07,line:{width:0},layer:'below'},{type:'line',xref:'x',yref:'paper',x0:hour,x1:hour,y0:0,y1:1,line:{color:'#bc911a',width:2,dash:'dot'}}],annotations:[{x:2.5,xref:'x',y:1,yref:'paper',yanchor:'top',text:'Noche',showarrow:false,font:{color:'#b65d23',size:11}}]},{displayModeBar:false,responsive:true}).then(p=>{p.removeAllListeners('plotly_click');p.on('plotly_click',e=>setHour(Number(e.points[0].x)));});
    const observer=new ResizeObserver(()=>{void Plotly.Plots.resize(el);});observer.observe(el);
    return()=>{observer.disconnect();};
  }, [curves,hour]);
  useEffect(()=>()=>{if(chartNode.current)Plotly.purge(chartNode.current);},[]);
  useEffect(() => {
    if (!summary || !yearsNode.current) return;
    const el=yearsNode.current;
    const rows=YEARS.map(y=>{const {weekday:w,weekend:e}=summary.years[y].city[movement];const d=summary.years[y].days;return {ratio:windowRatio(e,w,NIGHT),perDay:(w.reduce((s,n)=>s+n,0)*d.weekday+e.reduce((s,n)=>s+n,0)*d.weekend)/31};});
    void Plotly.react(el,[{type:'bar',x:YEARS.map(String),y:rows.map(r=>r.ratio),customdata:rows.map(r=>fmt(r.perDay)),marker:{color:YEARS.map(y=>y===year?'#f6bd16':'#b9c9d1')},hovertemplate:'Enero %{x}<br>%{y:.1f}× de noche el fin de semana<br>%{customdata} viajes / día<extra></extra>'}],{margin:{t:10,r:15,b:30,l:40},height:200,paper_bgcolor:'transparent',plot_bgcolor:'transparent',font:{family:'Arial',color:'#47606b',size:11},xaxis:{type:'category',fixedrange:true},yaxis:{rangemode:'tozero',fixedrange:true,gridcolor:'#e5e9e9',ticksuffix:'×'},bargap:0.35,shapes:[{type:'line',xref:'paper',x0:0,x1:1,y0:1,y1:1,line:{color:'#47606b',width:1,dash:'dot'}}],annotations:[{x:YEARS.indexOf(2021),y:rows[YEARS.indexOf(2021)].ratio,yanchor:'bottom',text:'Pandemia',showarrow:false,font:{size:11,color:'#173c50'}},{xref:'paper',x:1,y:1,xanchor:'right',yanchor:'bottom',text:'igual',showarrow:false,font:{size:10,color:'#74858d'}}]},{displayModeBar:false,responsive:true}).then(p=>{p.removeAllListeners('plotly_click');p.on('plotly_click',e=>setYear(Number(e.points[0].x)));});
    const observer=new ResizeObserver(()=>{void Plotly.Plots.resize(el);});observer.observe(el);
    return()=>{observer.disconnect();};
  }, [summary,movement,year]);
  useEffect(()=>()=>{if(yearsNode.current)Plotly.purge(yearsNode.current);},[]);
  useEffect(()=>{if(!playing)return;const id=window.setInterval(()=>setHour(h=>(h+1)%24),1800);return()=>clearInterval(id);},[playing]);
  useEffect(()=>{
    if (!sound || !curves || !voices.current) return;
    // Dos voces fijas: izquierda lunes–viernes, derecha sábado–domingo. Solo cambia el ritmo; la escala es el máximo de ambas curvas.
    const top=Math.max(...curves.week,...curves.end);
    const ids=[curves.week[hour],curves.end[hour]].flatMap((v,i)=>{
      if(!v||!top) return [];
      const [voice,note]=voices.current![i];
      const pulse=()=>voice.triggerAttackRelease(note,'32n',Tone.now(),0.25);
      pulse(); return [window.setInterval(pulse,1000/(0.5+4.5*v/top))];
    });
    return()=>ids.forEach(clearInterval);
  },[sound,curves,hour]);
  useEffect(()=>{const stop=()=>{if(document.hidden){setPlaying(false);setSound(false);}};document.addEventListener('visibilitychange',stop);return()=>document.removeEventListener('visibilitychange',stop);},[]);
  async function toggleSound(){if(sound){setSound(false);return;}try{await Tone.start();voices.current ??= ([['sine','G4',-0.8],['triangle','D5',0.8]] as const).map(([type,note,pan])=>[new Tone.Synth({oscillator:{type},envelope:{attack:0.005,decay:0.05,sustain:0,release:0.08},volume:-14}).connect(new Tone.Panner(pan).toDestination()),note]);setSound(true);}catch{setError('No se pudo activar el audio. Puedes continuar explorando el mapa.');}}

  return <><header><a className="brand" href="./"><span className="taxi-mark">NY</span> El pulso de Nueva York</a><span className="edition">InfoVis · Grupo 67 · V1</span></header>
    <main><section className="intro"><div><p className="context">Taxis amarillos / Enero de {year}</p><h1>El fin de semana,<br/>Nueva York no madruga: trasnocha.</h1><p>{facts && <>En enero de {year}, entre 00 y 05 h el fin de semana hubo <strong>{fmt1(facts.night)} veces más</strong> {movement==='pickup'?'salidas':'llegadas'} que de lunes a viernes; entre 06 y 10 h, <strong>{fmt((1-facts.morning)*100)} % menos</strong>. Ocho eneros repiten el patrón: solo la pandemia apagó la noche. </>}Cambia la hora para ver y escuchar dónde ocurre.</p></div><div className="intro-note"><span>La pregunta</span><p>¿Se mueve igual Nueva York<br/>entre semana y el fin de semana?</p><small>Viajes registrados, no toda la movilidad urbana.</small></div></section>
    {error && <p role="alert" className="notice">{error}</p>}
    {!data && !error && <p role="status">Cargando registros de NYC TLC…</p>}
    <section className="workspace"><div className="map-panel"><div className="map-toolbar"><div><strong>El mapa de una hora</strong><span>{clock(hour)}–{clock((hour+1)%24)} · {view==='volume'?'Promedio de viajes por día':'Fin de semana comparado con lunes–viernes'}</span></div><div className="toolbar-actions"><button aria-pressed={three} onClick={()=>setThree(!three)}>{three?'Vista 2D':'Vista 3D'}</button><button onClick={()=>map.current?.jumpTo({center:[-73.96,40.74],zoom:10.25})}>Centrar mapa</button></div></div><div className="map" ref={mapNode} aria-label="Mapa interactivo de las zonas de taxis de Nueva York"/>{hover && (()=>{const w=week?.zones[hover.id]?.[hour] ?? 0, e=end?.zones[hover.id]?.[hour] ?? 0;return <div className="tooltip" style={{left:hover.x,top:hover.y}}><strong>{nameOf(hover.id)}</strong><span>{view==='volume'?`${fmt(total?.zones[hover.id]?.[hour] ?? 0)} viajes / día`:Math.max(w,e)<1?'Menos de 1 viaje / día':ratioText(w,e)}</span></div>;})()}<div className="map-caption"><span>Selecciona una zona para ver su detalle</span>{view==='volume'
      ? <div className="legend"><div className="ramp"/><div><span>1</span><span>5</span><span>25</span><span>125</span><span>{fmt(zoneMax)}</span></div><small>Viajes / zona / hora / día · escala logarítmica fija 2019–2026{three?' · altura lineal':''}</small><small>Gris: 0 viajes registrados</small></div>
      : <div className="legend"><div className="ramp diverging"/><div><span>4× lun–vie</span><span>igual</span><span>4× sáb–dom</span></div><small>Razón entre promedios diarios de la misma hora{three?' · altura: viajes':''}</small><small>Gris: menos de 1 viaje / día</small></div>}</div></div>
    <aside><section className="controls"><h2>Explora el ritmo</h2><label htmlFor="year">Enero de</label><select id="year" value={year} onChange={e=>setYear(Number(e.target.value))}>{YEARS.map(y=><option key={y} value={y}>{y}</option>)}</select><label>Mapa</label><div className="segmented">{(['volume','diff'] as const).map(v=><button key={v} aria-pressed={view===v} onClick={()=>setView(v)}>{v==='volume'?'Cantidad':'Fin de semana vs semana'}</button>)}</div><label htmlFor="day">Tipo de día</label><select id="day" disabled={view==='diff'} title={view==='diff'?'La comparación usa ambos tipos de día':undefined} value={day} onChange={e=>setDay(e.target.value as Day)}><option value="all">Todos los días · 31 días</option><option value="weekday">Lunes–viernes · {data?.days.weekday} días</option><option value="weekend">Sábado–domingo · {data?.days.weekend} días</option></select><label>Movimiento</label><div className="segmented">{(['pickup','dropoff'] as const).map(m=><button key={m} aria-pressed={movement===m} onClick={()=>setMovement(m)}>{m==='pickup'?'Salidas':'Llegadas'}</button>)}</div><div className="hour-label"><label htmlFor="hour">Hora de Nueva York</label><output>{clock(hour)}</output></div><input id="hour" type="range" min="0" max="23" value={hour} onChange={e=>setHour(Number(e.target.value))}/><div className="range-labels"><span>00 h</span><span>12 h</span><span>23 h</span></div><div className="playback"><button className="primary" aria-pressed={playing} onClick={()=>setPlaying(!playing)}>{playing?'Pausar':'Reproducir día'}</button><button aria-pressed={sound} onClick={()=>void toggleSound()}>{sound?'Silenciar':'Activar sonido'}</button></div><p className="hint">Usa audífonos. Izquierda, grave: lunes–viernes. Derecha, aguda: sábado–domingo. Más viajes, pulsos más rápidos. Suena la zona seleccionada o toda la ciudad.</p></section>
    <section className="detail"><label htmlFor="zone">Detalle por zona</label><select id="zone" value={selected ?? ''} onChange={e=>setSelected(e.target.value?Number(e.target.value):undefined)}><option value="">Todas las zonas</option>{zoneFeatures.map(f=><option key={f.id} value={f.id}>{f.properties?.zone}</option>)}</select><h2>{zoneName ?? 'Toda la ciudad'}</h2>{view==='volume'
      ? <><div className="big-number">{fmt(value)}<span>viajes / día a las {clock(hour)}</span></div><p>{selected===undefined?`La hora con más actividad es ${clock(peak)}.`:`${(cityValue?value/cityValue*100:0).toFixed(1)} % de los viajes de esta hora.`}</p></>
      : <><div className="big-number">{fmt1((curves?.end[hour] ?? 0)/Math.max(curves?.week[hour] ?? 0,0.05))}×<span>sábado–domingo / lunes–viernes a las {clock(hour)}</span></div><p>{fmt(curves?.week[hour] ?? 0)} viajes / día de lunes a viernes · {fmt(curves?.end[hour] ?? 0)} el fin de semana.</p></>}</section></aside></section>
    <section className="below"><div className="hour-chart"><h2>Dos formas de vivir el día</h2><p>Promedio por hora · {zoneName ?? 'Toda la ciudad'} · {movement==='pickup'?'Salidas':'Llegadas'} · Haz clic para cambiar la hora</p><div ref={chartNode}/></div><div className="ranking"><h2>{view==='volume'?`Donde más ${movement==='pickup'?'empiezan':'terminan'} los viajes`:'Donde más pesa el fin de semana'}</h2><p>{clock(hour)} · {view==='volume'?'Promedio diario':'Sábado–domingo / lunes–viernes · zonas con 10+ viajes / día'}</p>{ranking.map((r,i)=><button key={r.id} onClick={()=>setSelected(r.id)}><span className="rank">{i+1}</span><span>{nameOf(r.id)}</span><strong>{r.label}</strong></button>)}</div></section>
    <section className="history"><h2>Ocho eneros: la noche del fin de semana</h2><p>Viajes entre 00 y 05 h, sábado–domingo ÷ lunes–viernes (promedios diarios) · {movement==='pickup'?'Salidas':'Llegadas'} · Toda la ciudad · Haz clic en un año para explorarlo</p><div ref={yearsNode}/></section>
    <details className="method"><summary>Datos, método y límites</summary><p>Fuente: <a href="https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page" target="_blank" rel="noreferrer">NYC Taxi & Limousine Commission</a>. {fmt(data?.metadata.rawRows ?? 0)} filas en el archivo original de taxis amarillos de enero de {year}. La página incluye enero de 2019 a 2026, con el mismo método para cada año. No representa viajes de Uber, transporte público ni personas únicas.</p><p>Contamos eventos de salida o llegada con fecha local dentro de enero y una zona cartografiable. Para cada hora dividimos por los 31 días del mes, los {data?.days.weekday} lunes–viernes o los {data?.days.weekend} sábados–domingos de {year}, incluyendo días sin viajes. Lunes–viernes incluye feriados. Las llegadas se asignan a su propia hora y fecha.</p><p>En {movement==='pickup'?'salidas':'llegadas'}: {fmt(data?.metadata.coverage[movement].mapped ?? 0)} eventos representados; {fmt(data?.metadata.coverage[movement].unknownZone ?? 0)} sin zona cartografiable; {fmt(data?.metadata.coverage[movement].outsideMonth ?? 0)} fuera de enero. No filtramos por tarifa o distancia. Los datos pueden contener errores del proveedor. Los polígonos se simplificaron para reducir su tamaño.</p><p>En modo cantidad, el color usa una escala logarítmica común para todas las horas, filtros y años (1, 5, 25, 125 y el máximo de 2019–2026). En la vista 3D, la altura es lineal a la cantidad de viajes, con la misma escala para todos los años. En modo comparación, el color muestra la razón entre promedios diarios de sábado–domingo y lunes–viernes a la misma hora; las zonas con menos de 1 viaje por día quedan en gris. El audio tiene dos voces: lunes–viernes a la izquierda con tono grave y sábado–domingo a la derecha con tono agudo. Cada voz va de 0,5 a 5 pulsos por segundo, relativo al máximo de ambas curvas de la zona seleccionada o de la ciudad; cero viajes produce silencio. No representa sonidos reales de taxis.</p></details></main><footer><span>Grupo 67 · Vicente Reñasco, David Parra y Mariano De Sarratea</span><span>V1 · Visualización interactiva y sonora</span></footer></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
