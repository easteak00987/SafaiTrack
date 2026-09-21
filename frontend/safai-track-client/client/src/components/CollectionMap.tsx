import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiClient } from "../lib/api-client";
import { meters, positionAt, roadGeometry, type Coordinate } from "../lib/routeMotion";

export interface MapStop {
  binId: number; name: string; latitude: number; longitude: number;
  currentFillPercent: number; stopSequence?: number; collectedAt?: string | null;
}
interface Motion {
  routeId: number; active: boolean;
  collect: (index: number) => Promise<boolean>;
  complete: () => Promise<boolean>;
}
export default function CollectionMap({ stops, route=false, routeId, motion }: {
  stops: MapStop[]; route?: boolean; routeId?: number; motion?: Motion;
}) {
  const host=useRef<HTMLDivElement>(null);
  const latest=useRef({stops,motion}); latest.current={stops,motion};
  const markers=useRef<L.Marker[]>([]);
  const [message,setMessage]=useState("");
  const [motionMessage,setMotionMessage]=useState("");
  const signature=stops.map(s=>`${s.binId}:${s.latitude}:${s.longitude}`).join(';');
  useEffect(()=>{
    if(!host.current)return;
    const map=L.map(host.current,{zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView([23.75,90.37],14);
    const controller=new AbortController();let active=true,frame=0;
    const tile=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Routing: <a href="https://project-osrm.org">OSRM</a>',maxZoom:19,
    }).addTo(map);
    tile.on('tileerror',()=>{if(active)setMessage('Map tiles unavailable. Bin coordinates and stop order remain available below.');});
    const points: Coordinate[]=stops.map(s=>[s.latitude,s.longitude]);
    if(route&&stops.length)points.unshift([23.738,90.3725]);
    markers.current=stops.map((stop,index)=>{
      const popup=document.createElement('div');popup.textContent=`${stop.name} - ${stop.currentFillPercent}% full${stop.collectedAt?' - Collected':''}`;
      return L.marker([stop.latitude,stop.longitude],{icon:L.divIcon({className:`collection-marker ${stop.collectedAt?'collected':''}`,html:String(route?index+1:stop.currentFillPercent+'%'),iconSize:[38,30],iconAnchor:[19,15]})}).addTo(map).bindPopup(popup);
    });
    if(points.length)map.fitBounds(L.latLngBounds(points),{padding:[35,35],maxZoom:16,animate:false});
    if(route&&points.length>1){
      L.marker(points[0],{icon:L.divIcon({className:'collection-marker depot',html:'D',iconSize:[30,30]})}).addTo(map).bindPopup('Ward 08 Operations Depot');
      const line=L.polyline(points,{color:'#176b91',weight:4,dashArray:'7 7'}).addTo(map);
      setMessage('Loading road directions...');setMotionMessage('');
      if(routeId) apiClient.get(`/api/routes/${routeId}/road`,{signal:controller.signal})
        .then(({data})=>{
          if(!active)return;
          line.setLatLngs(data.routes[0].geometry.coordinates.map((p:number[])=>[p[1],p[0]]));line.setStyle({dashArray:undefined});
          setMessage(`Road route: ${(data.routes[0].distance/1000).toFixed(1)} km. Follow numbered stops; check road restrictions for your truck.`);
          if(!latest.current.motion)return;
          const geometry=roadGeometry(data);
          const key=`safaitrack_motion_${routeId}`;
          let traveled=0,lastTime=0,lastSave=0,pending=false,paused=false,completed=false,lastNext=-2,lastRequested=-2;
          try {const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved?.signature===signature&&Number.isFinite(saved.distance))traveled=Math.max(0,saved.distance);}catch{}
          const truck=L.marker(geometry.points[0],{icon:L.divIcon({className:'collection-truck',html:'<span role="img" aria-label="Simulated truck" style="font-size:28px">&#128667;</span>',iconSize:[34,34],iconAnchor:[17,17]}),zIndexOffset:1000}).addTo(map);
          const save=()=>{try{localStorage.setItem(key,JSON.stringify({signature,distance:traveled}));}catch{}};
          const animate=(now:number)=>{
            if(!active)return;
            const state=latest.current;
            const elapsed=lastTime ? Math.min((now-lastTime)/1000,0.25) : 0;lastTime=now;
            const next=state.stops.findIndex(s=>!s.collectedAt);
            if(next!==lastNext){paused=false;lastRequested=-2;lastNext=next;}
            if(next>0)traveled=Math.max(traveled,geometry.stopDistances[next-1]);
            if(state.motion?.active&&!pending&&!paused&&!completed&&next!==lastRequested){
              if(next===-1){
                pending=true;
                void state.motion.complete().then(ok=>{if(!active)return;completed=ok;paused=!ok;pending=false;if(ok){localStorage.removeItem(key);setMotionMessage('Simulated collection completed.');}else setMotionMessage('Automatic completion paused. Use Complete route to retry.');});
              }else{
                const target=geometry.stopDistances[next];
                traveled=Math.min(target,traveled+10*elapsed); // constant 10 metres/second (36 km/h)
                const position=positionAt(geometry.points,geometry.distances,traveled);
                truck.setLatLng(position);
                truck.getElement()?.setAttribute('data-traveled-meters',traveled.toFixed(2));
                if(traveled>=target-0.05){
                  if(meters(position,[state.stops[next].latitude,state.stops[next].longitude])>50){
                    paused=true;setMotionMessage('The next bin is more than 50 m from the routed road. Use manual collection.');
                  }else{
                    pending=true;lastRequested=next;save();
                    void state.motion.collect(next).then(ok=>{if(!active)return;pending=false;paused=!ok;if(!ok)setMotionMessage('Automatic collection paused. Use manual collection to retry.');});
                  }
                }
              }
            }
            truck.setLatLng(positionAt(geometry.points,geometry.distances,traveled));
            if(now-lastSave>1000&&!completed){save();lastSave=now;}
            frame=requestAnimationFrame(animate);
          };
          setMotionMessage('Simulated truck: 36 km/h along the road route; automatic collection within 50 m.');
          frame=requestAnimationFrame(animate);
        }).catch(()=>{if(active){setMessage('Road directions unavailable. Dashed line shows stop order only, not a drivable road route.');setMotionMessage('Automatic movement unavailable; manual collection remains available.');}});
      else setMessage('Road directions unavailable. Dashed line shows stop order only, not a drivable road route.');
    }else setMessage(stops.length?'Current bin fill levels':'No bins to display.');
    const resize=new ResizeObserver(()=>{if(active)map.invalidateSize({animate:false});});resize.observe(host.current);
    return ()=>{active=false;controller.abort();cancelAnimationFrame(frame);resize.disconnect();map.remove();markers.current=[];};
  },[signature,route,routeId]);
  useEffect(()=>{
    stops.forEach((stop,index)=>{
      const marker=markers.current[index];if(!marker)return;
      marker.setIcon(L.divIcon({className:`collection-marker ${stop.collectedAt?'collected':''}`,html:String(route?index+1:stop.currentFillPercent+'%'),iconSize:[38,30],iconAnchor:[19,15]}));
      const popup=document.createElement('div');popup.textContent=`${stop.name} - ${stop.currentFillPercent}% full${stop.collectedAt?' - Collected':''}`;marker.setPopupContent(popup);
    });
  },[stops,route]);
  return <div><div ref={host} className="collection-map" aria-label={route?'Collection route map':'Ward bin map'}/>
    <p className="map-caption" role="status">{message}</p>
    {motion&&motionMessage&&<p className="map-caption" role="status">{motionMessage}</p>}
  </div>;
}
