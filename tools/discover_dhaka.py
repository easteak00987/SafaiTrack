import urllib.request, urllib.parse, json
from pathlib import Path
query='''[out:json][timeout:60];(nwr["name"~"Ward|City Corporation",i](23.55,90.2,24.05,90.65);nwr["name:en"~"Ward|City Corporation",i](23.55,90.2,24.05,90.65););out tags center;'''
request=urllib.request.Request('https://overpass-api.de/api/interpreter?'+urllib.parse.urlencode({'data':query}),headers={'User-Agent':'SafaiTrack-StudentProject/1.0 (+https://github.com/easteak00987/SafaiTrack)'})
with urllib.request.urlopen(request,timeout=90) as response: data=json.load(response)
Path('artifacts/dhaka-corporations.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(data,ensure_ascii=True))
