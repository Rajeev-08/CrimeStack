"""Reproducible fictional fixtures. No real crime/entity/indicator claims."""
import csv
import json
import random
from datetime import datetime,timedelta
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'data/examples'
ROOT.mkdir(parents=True,exist_ok=True)
rng=random.Random(707)
places=[('Bengaluru',12.9716,77.5946),('Mysuru',12.2958,76.6394),('Mangaluru',12.9141,74.8560),('Hubballi',15.3647,75.1240),('Belagavi',15.8497,74.4977),('Ballari',15.1394,76.9214)]
fields=['incident_id','occurred_at','reported_at','category','subcategory','description','severity','status','latitude','longitude','state_code','district_code','station_code','source_dataset_id']
rows=[]
for w in range(110):
 for di,(district,lat,lon) in enumerate(places):
  for ci,category in enumerate(['Theft','Fraud','Burglary']):
   count=rng.randint(1,4)+(rng.randint(5,12) if w%7==0 or w==109 else 0)
   for j in range(count):
    date=datetime(2024,1,1)+timedelta(weeks=w,days=rng.randrange(7),hours=rng.randrange(24))
    rows.append([f'DEMO-{len(rows)+1:06}',date.isoformat(),(date+timedelta(hours=2)).isoformat(),category,'Fictional','SYNTHETIC: no real incident',rng.choice(['low','medium','high','critical']),'demo',round(lat+rng.uniform(-.005,.005),6),round(lon+rng.uniform(-.005,.005),6),'KA',district,f'DEMO-STATION-{di+1}','synthetic-generator-v1'])
for name,data in [('synthetic-long-duration.csv',rows),('synthetic-karnataka.csv',[r for r in rows if r[1]>='2026-01-01'])]:
 with (ROOT/name).open('w',newline='') as f:
  writer=csv.writer(f);writer.writerow(fields);writer.writerows(data)
edges=[]
for i in range(8):
 edges.append({'source':f'fictional-id-{i%5}','target':f'fictional-id-{(i+1)%5}','source_alias':f'Entity {i%5+1}','target_alias':f'Entity {(i+1)%5+1}','source_type':'declared_entity','target_type':'declared_entity','relationship_type':'appears_in_same_case','case_reference':f'FICTIONAL-CASE-{i//2+1}','confidence':.7,'date':(datetime(2026,1,1)+timedelta(days=i*4)).date().isoformat()})
(ROOT/'synthetic-network.json').write_text(json.dumps({'confirmed':True,'authorization_basis':'Fictional demonstration only','provenance':'synthetic_demo','edges':edges},indent=2))
indicators=[]
for i,(district,_,_) in enumerate(places):
 for code,name,value,unit in [('population','Fictional population',500000+i*150000,'people'),('employment','Fictional employment rate',45+i*4,'percent')]:
  indicators.append({'district_code':district,'period':'2026','indicator_code':code,'indicator_name':name,'value':value,'unit':unit})
(ROOT/'synthetic-context.json').write_text(json.dumps({'source_name':'CrimeStack fictional generator','source_url':'https://example.com/fictional-data','licence':'CC0 fictional demonstration values','provenance':'synthetic_demo','indicator_code':'employment','period':'2026','indicators':indicators},indent=2))
print(f'Generated {len(rows)} fictional long-duration records')
