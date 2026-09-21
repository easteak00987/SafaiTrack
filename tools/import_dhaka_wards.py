"""One-time, cached Dhaka ward importer. Never runs as part of an API request.
OSM data: ODbL, https://www.openstreetmap.org/copyright
Nominatim: single worker, >=1.1 seconds between requests; stop on throttling.
"""
import argparse, hashlib, json, math, random, re, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'artifacts' / 'dhaka-import-cache'
UA = 'SafaiTrack-StudentProject/1.0 (+https://github.com/easteak00987/SafaiTrack)'
OVERPASS = 'https://overpass-api.de/api/interpreter'
NOMINATIM = 'https://nominatim.openstreetmap.org/reverse'
last_request = 0.0

def request(url, params, delay=1.1):
    global last_request
    CACHE.mkdir(parents=True, exist_ok=True)
    uri = url + '?' + urllib.parse.urlencode(params)
    cache = CACHE / (hashlib.sha256(uri.encode()).hexdigest() + '.json')
    if cache.exists(): return json.loads(cache.read_text(encoding='utf-8'))
    time.sleep(max(0, delay - (time.monotonic() - last_request)))
    last_request = time.monotonic()
    req = urllib.request.Request(uri, headers={'User-Agent': UA, 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=100) as response: data = json.load(response)
    if data.get('remark') or data.get('error'): raise RuntimeError(str(data))
    cache.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    return data

def polygon(element):
    from shapely.geometry import Polygon, LineString
    from shapely.ops import polygonize, unary_union
    if element['type'] == 'way':
        points = [(p['lon'], p['lat']) for p in element.get('geometry', [])]
        return Polygon(points) if len(points) > 3 and points[0] == points[-1] else None
    outer, inner = [], []
    for member in element.get('members', []):
        points = [(p['lon'], p['lat']) for p in member.get('geometry', [])]
        if len(points) > 1: (inner if member.get('role') == 'inner' else outer).append(LineString(points))
    if not outer: return None
    shape = unary_union(list(polygonize(outer)))
    if inner: shape = shape.difference(unary_union(list(polygonize(inner))))
    return shape if not shape.is_empty and shape.is_valid else None

def discover():
    # Bengali spellings are explicit Unicode escapes to avoid shell encoding dependence.
    ward_pattern = 'ward|\u0993\u09df\u09be\u09b0\u09cd\u09a1|\u0993\u09af\u09bc\u09be\u09b0\u09cd\u09a1|\u0993\u09af\u09bc\u09be\u09b0\u09cd\u09a1|\u0993\u09df\u09be\u09b0\u09cd\u09a1'
    q = '[out:json][timeout:70];nwr["boundary"="administrative"]["admin_level"~"^(7|8|9|10|11)$"](23.55,90.2,24.05,90.65);out geom;'
    data = request(OVERPASS, {'data':q})
    candidates=[]
    for element in data['elements']:
        tags=element.get('tags', {})
        name=tags.get('name:en') or tags.get('name','')
        if not re.search(ward_pattern, ' '.join([name,tags.get('name','')]), re.I): continue
        shape=polygon(element)
        if shape is None: continue
        candidates.append({'sourceKey':f"osm:{element['type']}:{element['id']}", 'name':name, 'shape':shape})
    return candidates, len(data['elements'])

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    wards, candidates=discover()
    report={'source':'OpenStreetMap / Overpass', 'administrativeAreasReturned':candidates,'wardsFound':len(wards),'wardsSeeded':0,'binsSeeded':0,'samples':[]}
    if not wards:
        report['limitation']='No identifiable municipal ward polygons returned. No neighborhoods or office points were substituted for wards.'
    if args.apply and wards:
        import pyodbc
        from shapely.geometry import Point
        db=pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost\\SQLEXPRESS;DATABASE=SafaiTrackDb;Trusted_Connection=yes;')
        try:
            for ward in wards:
                source=ward['sourceKey']; shape=ward['shape']; centroid=shape.centroid
                metadata=json.dumps({'sourceKey':source,'centroid':[centroid.y,centroid.x],'attribution':'OpenStreetMap contributors / ODbL'})
                cur=db.cursor();existing=cur.execute('SELECT WardId FROM Wards WHERE Description=?',metadata).fetchone()
                if existing: ward_id=existing[0]
                else:
                    ward_id=cur.execute('INSERT Wards(Name,Description) OUTPUT inserted.WardId VALUES (?,?)',ward['name'],metadata).fetchone()[0]
                    db.commit();report['wardsSeeded']+=1
                rng=random.Random(source)
                center=centroid if shape.contains(centroid) else shape.representative_point()
                for index in range(5):
                    for attempt in range(2000):
                        radius=200*math.sqrt(rng.random());angle=rng.random()*2*math.pi
                        lat=center.y+radius*math.sin(angle)/111320;lon=center.x+radius*math.cos(angle)/(111320*math.cos(math.radians(center.y)))
                        if shape.contains(Point(lon,lat)):break
                    else: raise RuntimeError('Unable to choose a point inside '+ward['name'])
                    if cur.execute('SELECT BinId FROM Bins WHERE WardId=? AND Latitude=? AND Longitude=?',ward_id,lat,lon).fetchone():continue
                    geo=request(NOMINATIM,{'format':'jsonv2','lat':f'{lat:.7f}','lon':f'{lon:.7f}','zoom':18,'addressdetails':1,'accept-language':'en'})
                    address=geo.get('address',{});place=geo.get('name') or address.get('road') or address.get('pedestrian') or geo.get('display_name','').split(',')[0]
                    if not place:raise RuntimeError('No real place name returned')
                    name=f'{place} - sample bin {index+1}'[:150]
                    cur.execute('INSERT Bins(WardId,Name,Latitude,Longitude,CurrentFillPercent,LastUpdated) VALUES (?,?,?,?,?,SYSUTCDATETIME())',ward_id,name,lat,lon,20+rng.randrange(60));db.commit()
                    report['binsSeeded']+=1
                    if len(report['samples'])<10:report['samples'].append({'ward':ward['name'],'name':name,'latitude':lat,'longitude':lon})
                    print(f'Seeded {source} bin {index+1}',flush=True)
        finally:db.close()
    (ROOT/'artifacts'/'dhaka-import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True,indent=2))
if __name__=='__main__':main()
