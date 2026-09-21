export type Coordinate = [number, number]; // latitude, longitude
export function meters(a: Coordinate, b: Coordinate): number {
  const rad = Math.PI / 180;
  const h = Math.sin((b[0]-a[0])*rad/2)**2 + Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin((b[1]-a[1])*rad/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0,1-h)));
}
export function cumulativeDistances(points: Coordinate[]): number[] {
  const distances=[0];
  for(let i=1;i<points.length;i++) distances.push(distances[i-1]+meters(points[i-1],points[i]));
  return distances;
}
export function positionAt(points: Coordinate[], distances: number[], traveled: number): Coordinate {
  if(points.length===0) throw new Error('Empty road geometry');
  let i=1;
  while(i<distances.length && distances[i]<traveled)i++;
  if(i>=points.length)return points[points.length-1];
  const length=distances[i]-distances[i-1];
  const ratio=length ? Math.max(0,Math.min(1,(traveled-distances[i-1])/length)) : 1;
  return [points[i-1][0]+(points[i][0]-points[i-1][0])*ratio,points[i-1][1]+(points[i][1]-points[i-1][1])*ratio];
}
export function roadGeometry(data: any) {
  const points: Coordinate[]=[], stopIndices: number[]=[];
  for(const leg of data.routes[0].legs){
    for(const step of leg.steps || [])for(const p of step.geometry.coordinates){
      const next: Coordinate=[p[1],p[0]];
      if(!points.length || meters(points[points.length-1],next)>0.01)points.push(next);
    }
    stopIndices.push(points.length-1);
  }
  if(points.length<2 || stopIndices.some(i=>i<0))throw new Error('Road legs unavailable');
  const distances=cumulativeDistances(points);
  return {points,distances,stopDistances:stopIndices.map(i=>distances[i])};
}
