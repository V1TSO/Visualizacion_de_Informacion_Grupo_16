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
downloads = [('misc/taxi_zones.zip', 'zones.zip')] + [(f'trip-data/yellow_tripdata_{y}-01.parquet', f'yellow_{y}-01.parquet') for y in YEARS]
for remote, name in downloads:
    target = RAW / name
    if not target.exists():
        print(f'Descargando {remote}', flush=True)
        urllib.request.urlretrieve(BASE + remote, target)

zones = gpd.read_file(f'zip://{RAW / "zones.zip"}!taxi_zones/taxi_zones.shp').to_crs(4326)
zones = zones.dissolve(by='LocationID', as_index=False)
zones.geometry = zones.geometry.simplify(0.00008, preserve_topology=True)
features = json.loads(zones[['LocationID', 'zone', 'borough', 'geometry']].to_json())
for feature in features['features']:
    feature['id'] = int(feature['properties']['LocationID'])
(OUT / 'zones.geojson').write_text(json.dumps(features, separators=(',', ':')))

db = duckdb.connect()
valid_ids = ','.join(str(f['id']) for f in features['features'])
summary = {'years': {}, 'zoneMax': 0}
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
        rows = db.execute(f"SELECT {zone}, CASE WHEN dayofweek({time}) IN (0,6) THEN 'weekend' ELSE 'weekday' END, hour({time}), count(*) FROM trips WHERE {where} AND {zone} IN ({valid_ids}) GROUP BY 1,2,3").fetchall()
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
        summary['zoneMax'] = max(summary['zoneMax'], max(all_days.values()) / 31)
        print(year, movement, data['metadata']['coverage'][movement], flush=True)
    (OUT / f'trips-{year}.json').write_text(json.dumps(data, separators=(',', ':')))
    summary['years'][year] = {'rawRows': raw_count, 'days': days, 'city': city}
summary['zoneMax'] = -(-summary['zoneMax'] // 100) * 100
(OUT / 'years.json').write_text(json.dumps(summary, separators=(',', ':')))
print(f'Datos guardados en {OUT}')
