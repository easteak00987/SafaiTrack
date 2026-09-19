import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapStop {
  binId: number;
  name: string;
  latitude: number;
  longitude: number;
  currentFillPercent: number;
  stopSequence?: number;
  collectedAt?: string | null;
}
export default function CollectionMap({
  stops,
  route = false,
}: {
  stops: MapStop[];
  route?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!host.current) return;
    const map = L.map(host.current, {
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
    }).setView([23.75, 90.37], 14);
    const controller = new AbortController();
    let active = true;
    const tile = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }
    ).addTo(map);
    tile.on("tileerror", () => {
      if (active)
        setMessage(
          "Map tiles unavailable. Bin coordinates and stop order remain available below."
        );
    });
    const points: L.LatLngTuple[] = stops.map(s => [s.latitude, s.longitude]);
    if (route && stops.length) points.unshift([23.738, 90.3725]);
    stops.forEach((stop, index) => {
      const popup = document.createElement("div");
      popup.textContent = `${stop.name} - ${stop.currentFillPercent}% full${stop.collectedAt ? " - Collected" : ""}`;
      L.marker([stop.latitude, stop.longitude], {
        icon: L.divIcon({
          className: `collection-marker ${stop.collectedAt ? "collected" : ""}`,
          html: String(route ? index + 1 : stop.currentFillPercent + "%"),
          iconSize: [38, 30],
          iconAnchor: [19, 15],
        }),
      })
        .addTo(map)
        .bindPopup(popup);
    });
    if (points.length)
      map.fitBounds(L.latLngBounds(points), {
        padding: [35, 35],
        maxZoom: 16,
        animate: false,
      });
    if (route && points.length > 1) {
      L.marker(points[0], {
        icon: L.divIcon({
          className: "collection-marker depot",
          html: "D",
          iconSize: [30, 30],
        }),
      })
        .addTo(map)
        .bindPopup("Ward 08 Operations Depot");
      const line = L.polyline(points, {
        color: "#176b91",
        weight: 4,
        dashArray: "7 7",
      }).addTo(map);
      setMessage("Loading road directions...");
      const timeout = setTimeout(() => controller.abort(), 12000);
      fetch(
        `https://router.project-osrm.org/route/v1/driving/${points.map(p => `${p[1]},${p[0]}`).join(";")}?overview=full&geometries=geojson`,
        { signal: controller.signal }
      )
        .then(r => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then(data => {
          if (!active) return;
          if (data.code !== "Ok" || !data.routes?.[0]) throw new Error();
          line.setLatLngs(
            data.routes[0].geometry.coordinates.map((p: number[]) => [
              p[1],
              p[0],
            ])
          );
          line.setStyle({ dashArray: undefined });
          setMessage(
            `Road route: ${(data.routes[0].distance / 1000).toFixed(1)} km. Follow numbered stops; check road restrictions for your truck.`
          );
        })
        .catch(() => {
          if (active)
            setMessage(
              "Road directions unavailable. Dashed line shows stop order only, not a drivable road route."
            );
        })
        .finally(() => clearTimeout(timeout));
    } else
      setMessage(
        stops.length ? "Current bin fill levels" : "No bins to display."
      );
    const resize = new ResizeObserver(() => {
      if (active) map.invalidateSize({ animate: false });
    });
    resize.observe(host.current);
    return () => {
      active = false;
      controller.abort();
      resize.disconnect();
      map.remove();
    };
  }, [stops, route]);
  return (
    <div>
      <div
        ref={host}
        className="collection-map"
        aria-label={route ? "Collection route map" : "Ward bin map"}
      />
      <p className="map-caption" role="status">
        {message}
      </p>
    </div>
  );
}
