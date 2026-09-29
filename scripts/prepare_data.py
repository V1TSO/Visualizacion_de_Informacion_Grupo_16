"""Reproduce la V1 (enero 2019–2026) con datos oficiales TLC. Ejecutar: npm run data."""
from pathlib import Path
import calendar
import hashlib
import json
import urllib.request
import duckdb
import geopandas as gpd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw'
OUT = ROOT / 'public/data'
RAW.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'https://d37ci6vzurychx.cloudfront.net/'
YEARS = range(2019, 2027)
MPH_TO_KMH = 1.609344
FLOW_TOP, FLOW_CITY_TOP, FLOW_MIN_PER_DAY = 6, 40, 0.5
SPEED_MIN_TRIPS = 10
# IPC de enero, área Nueva York–Newark–Jersey City (BLS, serie CUURS12ASA0). Lleva las tarifas a dólares de enero de 2026.
CPI_NY = {2019: 275.144, 2020: 282.020, 2021: 285.525, 2022: 300.164, 2023: 318.151, 2024: 328.006, 2025: 341.144, 2026: 350.947}
downloads = [('misc/taxi_zones.zip', 'zones.zip')] + [(f'trip-data/yellow_tripdata_{y}-01.parquet', f'yellow_{y}-01.parquet') for y in YEARS]
for remote, name in downloads:
    target = RAW / name
    if not target.exists():
        print(f'Descargando {remote}', flush=True)
        urllib.request.urlretrieve(BASE + remote, target)

zones = gpd.read_file(f'zip://{RAW / "zones.zip"}!taxi_zones/taxi_zones.shp').to_crs(4326)
zones = zones.dissolve(by='LocationID', as_index=False)
# Punto interior (no centroide geométrico) para que los flujos nazcan dentro de cada zona.
inside = zones.to_crs(2263).representative_point().to_crs(4326)
zones['cx'], zones['cy'] = inside.x.round(5), inside.y.round(5)
# Superficie en km² (EPSG:2263 mide en pies cuadrados) para mostrar densidad en vez de conteos por zona.
zones['km2'] = (zones.to_crs(2263).area * 0.09290304 / 1e6).round(4)
zones.geometry = zones.geometry.simplify(0.00008, preserve_topology=True)
features = json.loads(zones[['LocationID', 'zone', 'borough', 'cx', 'cy', 'km2', 'geometry']].to_json())
for feature in features['features']:
    feature['id'] = int(feature['properties']['LocationID'])
(OUT / 'zones.geojson').write_text(json.dumps(features, separators=(',', ':')))

db = duckdb.connect()
valid_ids = ','.join(str(f['id']) for f in features['features'])
km2 = {f['id']: f['properties']['km2'] for f in features['features']}
DAY = "CASE WHEN dayofweek({t}) IN (0,6) THEN 'weekend' ELSE 'weekday' END"
summary = {'years': {}, 'zoneMax': 0, 'densityMax': 0, 'cpiBase': 2026}
for year in YEARS:
    raw = RAW / f'yellow_{year}-01.parquet'
    db.execute(f"CREATE OR REPLACE VIEW trips AS SELECT * FROM read_parquet('{raw}')")
    raw_count = db.execute('SELECT count(*) FROM trips').fetchone()[0]
    days = {'all': 31, 'weekday': sum(calendar.weekday(year, 1, d) < 5 for d in range(1, 32)), 'weekend': sum(calendar.weekday(year, 1, d) >= 5 for d in range(1, 32))}
    data = {'days': days, 'rows': [], 'metadata': {'month': f'{year}-01', 'rawRows': raw_count, 'source': BASE + f'trip-data/yellow_tripdata_{year}-01.parquet', 'sha256': hashlib.sha256(raw.read_bytes()).hexdigest(), 'coverage': {}}}
    city = {}
    for movement, time, zone in [('pickup', 'tpep_pickup_datetime', 'PULocationID'), ('dropoff', 'tpep_dropoff_datetime', 'DOLocationID')]:
        # Each event uses its own local timestamp, including its weekday and hour.
        where = f"{time} >= TIMESTAMP '{year}-01-01' AND {time} < TIMESTAMP '{year}-02-01'"
        in_month = db.execute(f'SELECT count(*) FROM trips WHERE {where}').fetchone()[0]
        rows = db.execute(f"SELECT {zone}, {DAY.format(t=time)}, hour({time}), count(*) FROM trips WHERE {where} AND {zone} IN ({valid_ids}) GROUP BY 1,2,3").fetchall()
        mapped = sum(r[3] for r in rows)
        data['metadata']['coverage'][movement] = {'inMonth': in_month, 'mapped': mapped, 'unknownZone': in_month - mapped, 'outsideMonth': raw_count - in_month}
        data['rows'].extend([movement, int(z), day, int(hour), int(count)] for z, day, hour, count in rows)
        # City curve per day type (daily mean), plus the zone maximum for a scale shared by all years.
        city[movement] = {d: [0.0] * 24 for d in ('weekday', 'weekend')}
        for z, day, hour, count in rows:
            city[movement][day][hour] += count / days[day]
        all_days = {}
        for z, day, hour, count in rows:
            all_days[(z, hour)] = all_days.get((z, hour), 0) + count
            summary['zoneMax'] = max(summary['zoneMax'], count / days[day])
            summary['densityMax'] = max(summary['densityMax'], count / days[day] / km2[z])
        summary['zoneMax'] = max(summary['zoneMax'], max(all_days.values()) / 31)
        summary['densityMax'] = max(summary['densityMax'], max(n / 31 / km2[z] for (z, _), n in all_days.items()))
        print(year, movement, data['metadata']['coverage'][movement], flush=True)

    # Viajes válidos para velocidad y tarifa: hora de salida en el mes, 1 min–3 h, 0,1–50 millas, 1–70 mph.
    db.execute(f"""CREATE OR REPLACE TEMP TABLE clean AS
        SELECT PULocationID pu, DOLocationID dl, {DAY.format(t='tpep_pickup_datetime')} d, hour(tpep_pickup_datetime) h,
               trip_distance / (date_diff('second', tpep_pickup_datetime, tpep_dropoff_datetime) / 3600.0) * {MPH_TO_KMH} kmh, total_amount
        FROM trips
        WHERE tpep_pickup_datetime >= TIMESTAMP '{year}-01-01' AND tpep_pickup_datetime < TIMESTAMP '{year}-02-01'
          AND date_diff('second', tpep_pickup_datetime, tpep_dropoff_datetime) BETWEEN 60 AND 10800
          AND trip_distance BETWEEN 0.1 AND 50""")
    db.execute(f'DELETE FROM clean WHERE kmh < {MPH_TO_KMH} OR kmh > {70 * MPH_TO_KMH}')
    speed = {'city': {d: [None] * 24 for d in ('weekday', 'weekend')}, 'zones': {'pickup': {}, 'dropoff': {}}}
    for d, h, v in db.execute('SELECT d, h, median(kmh) FROM clean GROUP BY 1, 2').fetchall():
        speed['city'][d][h] = round(v, 1)
    for movement, col in [('pickup', 'pu'), ('dropoff', 'dl')]:
        for z, d, h, v in db.execute(f'SELECT {col}, d, h, median(kmh) FROM clean WHERE {col} IN ({valid_ids}) GROUP BY 1, 2, 3 HAVING count(*) >= {SPEED_MIN_TRIPS}').fetchall():
            speed['zones'][movement].setdefault(str(z), {'weekday': [None] * 24, 'weekend': [None] * 24})[d][h] = round(v, 1)
    data['speed'] = speed
    fare = db.execute('SELECT median(total_amount) FROM clean WHERE total_amount > 0').fetchone()[0]

    # Flujos origen→destino por hora de salida: top por origen, top por destino y top de la ciudad (sin viajes dentro de la misma zona).
    # Los empates se ordenan por zona para que el resultado sea igual en cada corrida.
    flows = db.execute(f"""
        WITH a AS (SELECT PULocationID pu, DOLocationID dl, {DAY.format(t='tpep_pickup_datetime')} d, hour(tpep_pickup_datetime) h, count(*) n
                   FROM trips WHERE tpep_pickup_datetime >= TIMESTAMP '{year}-01-01' AND tpep_pickup_datetime < TIMESTAMP '{year}-02-01'
                     AND PULocationID IN ({valid_ids}) AND DOLocationID IN ({valid_ids}) AND PULocationID <> DOLocationID GROUP BY ALL),
             b AS (SELECT * FROM a WHERE n >= {FLOW_MIN_PER_DAY} * CASE d WHEN 'weekend' THEN {days['weekend']} ELSE {days['weekday']} END)
        SELECT * FROM b QUALIFY row_number() OVER (PARTITION BY pu, d, h ORDER BY n DESC, dl) <= {FLOW_TOP}
        UNION SELECT * FROM b QUALIFY row_number() OVER (PARTITION BY dl, d, h ORDER BY n DESC, pu) <= {FLOW_TOP}
        UNION SELECT * FROM b QUALIFY row_number() OVER (PARTITION BY d, h ORDER BY n DESC, pu, dl) <= {FLOW_CITY_TOP}""").fetchall()
    data['flows'] = {'weekday': [], 'weekend': []}
    for pu, dl, d, h, n in sorted(flows):
        data['flows'][d].append([int(pu), int(dl), int(h), int(n)])
    # Viajes que empiezan y terminan en la misma zona: no caben en un arco y se dibujan como anillos.
    stays = db.execute(f"""SELECT * FROM (
        SELECT PULocationID z, {DAY.format(t='tpep_pickup_datetime')} d, hour(tpep_pickup_datetime) h, count(*) n FROM trips
        WHERE tpep_pickup_datetime >= TIMESTAMP '{year}-01-01' AND tpep_pickup_datetime < TIMESTAMP '{year}-02-01'
          AND PULocationID IN ({valid_ids}) AND PULocationID = DOLocationID GROUP BY ALL)
        WHERE n >= {FLOW_MIN_PER_DAY} * CASE d WHEN 'weekend' THEN {days['weekend']} ELSE {days['weekday']} END""").fetchall()
    data['stays'] = {'weekday': [], 'weekend': []}
    for z, d, h, n in sorted(stays):
        data['stays'][d].append([int(z), int(h), int(n)])

    (OUT / f'trips-{year}.json').write_text(json.dumps(data, separators=(',', ':')))
    summary['years'][year] = {'rawRows': raw_count, 'days': days, 'city': city, 'speed': speed['city'], 'fare': round(fare, 2), 'fareReal': round(fare * CPI_NY[2026] / CPI_NY[year], 2)}
    print(year, f'{len(flows):,} flujos, tarifa mediana {fare:.2f}', flush=True)
summary['zoneMax'] = -(-summary['zoneMax'] // 100) * 100
summary['densityMax'] = -(-summary['densityMax'] // 100) * 100
(OUT / 'years.json').write_text(json.dumps(summary, separators=(',', ':')))
print(f'Datos guardados en {OUT}')
