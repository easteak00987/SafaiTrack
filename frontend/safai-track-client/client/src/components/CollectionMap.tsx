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

const SPEEDS = [1, 2, 5, 10] as const;

function fillClass(pct: number) {
  if (pct >= 80) return "urgent";
  if (pct >= 50) return "moderate";
  return "low";
}

export default function CollectionMap({ stops, route = false, routeId, motion, focusedIndex }: {
  stops: MapStop[]; route?: boolean; routeId?: number; motion?: Motion; focusedIndex?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const latest = useRef({ stops, motion }); latest.current = { stops, motion };
  const markers = useRef<L.Marker[]>([]);

  const [roadMsg, setRoadMsg] = useState("");
  const [simMsg, setSimMsg] = useState("");
  const [simState, setSimState] = useState<"idle" | "running" | "paused" | "done">("idle");
  const [speedIdx, setSpeedIdx] = useState(0);

  const speedRef = useRef<(typeof SPEEDS)[number]>(SPEEDS[0]);
  const pausedRef = useRef(false);

  const signature = stops.map(s => `${s.binId}:${s.latitude}:${s.longitude}:${s.currentFillPercent}:${s.collectedAt || ""}`).join(";");

  const createPinHtml = (label: string, statusClass: string) => `
    <div class="collection-pin ${statusClass}">
      <div class="collection-pin-head">${label}</div>
      <div class="collection-pin-tip"></div>
    </div>
  `;

  const createPopupHtml = (stop: MapStop, index: number) => `
    <div class="map-popup-card">
      <div class="map-popup-badge">${route ? `Stop #${index + 1}` : "Waste Bin"}</div>
      <div><strong>${stop.name}</strong></div>
      <div style="margin-top:4px;">
        Fill: <strong>${stop.currentFillPercent}%</strong> ${stop.collectedAt ? "✅ (Collected)" : ""}
      </div>
      <div class="map-popup-coords">📍 ${stop.latitude.toFixed(5)}, ${stop.longitude.toFixed(5)}</div>
    </div>
  `;

  useEffect(() => {
    if (!host.current) return;
    pausedRef.current = false;

    const map = L.map(host.current, {
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
    }).setView([23.75, 90.37], 14);
    mapRef.current = map;
    const controller = new AbortController();
    let active = true, frame = 0;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap | OSRM",
      maxZoom: 19,
    }).addTo(map).on("tileerror", () => {
      if (active) setRoadMsg("Map tiles unavailable. Stop order available below.");
    });

    const points: Coordinate[] = stops.map(s => [s.latitude, s.longitude]);
    if (route && stops.length) points.unshift([23.738, 90.3725]);

    markers.current = stops.map((stop, index) => {
      const isCollected = Boolean(stop.collectedAt);
      const statusClass = isCollected ? "collected" : fillClass(stop.currentFillPercent);
      const label = route ? String(index + 1) : `${stop.currentFillPercent}%`;
      return L.marker([stop.latitude, stop.longitude], {
        icon: L.divIcon({
          className: "leaflet-pin-wrapper",
          html: createPinHtml(label, statusClass),
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -32],
        }),
      }).addTo(map).bindPopup(createPopupHtml(stop, index));
    });

    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16, animate: false });

    if (route && points.length > 1) {
      L.marker(points[0], {
        icon: L.divIcon({
          className: "leaflet-pin-wrapper",
          html: `
            <div class="collection-pin depot">
              <div class="collection-pin-head">Depot</div>
              <div class="collection-pin-tip"></div>
            </div>
          `,
          iconSize: [46, 34],
          iconAnchor: [23, 34],
          popupAnchor: [0, -32],
        }),
      }).addTo(map).bindPopup("Ward Operations Depot (Dhaka South)");

      const line = L.polyline(points, { color: "#176b91", weight: 4, dashArray: "7 7" }).addTo(map);
      setRoadMsg("Loading road directions..."); setSimMsg("");

      if (routeId) {
        apiClient.get(`/api/routes/${routeId}/road`, { signal: controller.signal })
          .then(({ data }) => {
            if (!active) return;
            const coords = data?.routes?.[0]?.geometry?.coordinates;
            if (Array.isArray(coords) && coords.length > 0) {
              line.setLatLngs(coords.map((p: number[]) => [p[1], p[0]]));
              line.setStyle({ dashArray: undefined });
              const km = (data.routes[0].distance / 1000).toFixed(1);
              setRoadMsg(`Road route: ${km} km total. Truck auto-animates to each stop.`);
            }

            if (!latest.current.motion) return;

            const geometry = roadGeometry(data);
            if (!geometry?.points?.length) return;
            const key = `safaitrack_motion_${routeId}`;
            let traveled = 0, lastTime = 0, lastSave = 0;
            let pending = false, completed = false, lastNext = -2, lastRequested = -2;

            try {
              const saved = JSON.parse(localStorage.getItem(key) || "null");
              if (saved?.signature === signature && Number.isFinite(saved.distance))
                traveled = Math.max(0, saved.distance);
            } catch { /* ignore */ }

            const truck = L.marker(geometry.points[0], {
              icon: L.divIcon({
                className: "collection-truck",
                html: "<span style=\"font-size:26px\">&#128667;</span>",
                iconSize: [34, 34], iconAnchor: [17, 17]
              }), zIndexOffset: 1000
            }).addTo(map);

            const save = () => {
              try { localStorage.setItem(key, JSON.stringify({ signature, distance: traveled })); } catch { /* ignore */ }
            };

            const animate = (now: number) => {
              if (!active) return;
              const state = latest.current;
              const elapsed = lastTime ? Math.min((now - lastTime) / 1000, 0.25) : 0;
              lastTime = now;
              const speed = speedRef.current;
              const paused = pausedRef.current;
              const next = state.stops.findIndex(s => !s.collectedAt);
              if (next !== lastNext) { lastRequested = -2; lastNext = next; }
              if (next > 0) traveled = Math.max(traveled, geometry.stopDistances[next - 1]);

              if (state.motion?.active && !paused && !pending && !completed && next !== lastRequested) {
                if (next === -1) {
                  pending = true;
                  void state.motion.complete().then(ok => {
                    if (!active) return;
                    completed = ok; pending = false;
                    if (ok) {
                      localStorage.removeItem(key);
                      setSimMsg("All bins collected! Route marked as complete.");
                      setSimState("done");
                    } else {
                      setSimMsg("Could not auto-complete. Use Complete route button.");
                      setSimState("paused");
                    }
                  });
                } else {
                  const target = geometry.stopDistances[next];
                  traveled = Math.min(target, traveled + 10 * speed * elapsed);
                  const position = positionAt(geometry.points, geometry.distances, traveled);
                  truck.setLatLng(position);
                  truck.getElement()?.setAttribute("data-traveled-meters", traveled.toFixed(2));
                  if (traveled >= target - 0.05) {
                    const binPos: Coordinate = [state.stops[next].latitude, state.stops[next].longitude];
                    if (meters(position, binPos) > 50) {
                      setSimMsg(`Stop ${next + 1} is far from the road. Use manual Collect button below.`);
                      setSimState("paused");
                      pausedRef.current = true;
                    } else {
                      pending = true; lastRequested = next; save();
                      setSimMsg(`Collecting Stop ${next + 1}: ${state.stops[next].name}...`);
                      void state.motion.collect(next).then(ok => {
                        if (!active) return;
                        pending = false;
                        if (ok) {
                          setSimMsg(`Stop ${next + 1} collected! Moving to next stop...`);
                          setSimState("running");
                        } else {
                          setSimMsg("Collection failed. Resume or collect manually.");
                          setSimState("paused");
                          pausedRef.current = true;
                        }
                      });
                    }
                  }
                }
              }

              truck.setLatLng(positionAt(geometry.points, geometry.distances, traveled));
              if (now - lastSave > 1000 && !completed) { save(); lastSave = now; }
              frame = requestAnimationFrame(animate);
            };

            if (latest.current.motion?.active) {
              setSimState("running");
              setSimMsg("Truck is moving — auto-collecting at each stop. Use controls below.");
            } else {
              setSimState("idle");
              setSimMsg("Accept the route to start the live truck simulation.");
            }
            frame = requestAnimationFrame(animate);
          })
          .catch(() => {
            if (active) {
              setRoadMsg("Road directions unavailable. Dashed line shows stop order only.");
              setSimMsg("Live animation unavailable. Manual collection still works.");
            }
          });
      } else {
        setRoadMsg("Road directions unavailable (no route ID).");
      }
    } else {
      setRoadMsg(stops.length ? "Current bin fill levels." : "No bins to display.");
    }

    const resize = new ResizeObserver(() => { if (active) map.invalidateSize({ animate: false }); });
    resize.observe(host.current);
    return () => {
      active = false; controller.abort(); cancelAnimationFrame(frame);
      resize.disconnect(); map.remove(); markers.current = [];
    };
  }, [signature, route, routeId]);

  useEffect(() => {
    stops.forEach((stop, index) => {
      const marker = markers.current[index]; if (!marker) return;
      const isCollected = Boolean(stop.collectedAt);
      const statusClass = isCollected ? "collected" : fillClass(stop.currentFillPercent);
      const label = route ? String(index + 1) : `${stop.currentFillPercent}%`;
      marker.setIcon(L.divIcon({
        className: "leaflet-pin-wrapper",
        html: createPinHtml(label, statusClass),
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -32],
      }));
      marker.setPopupContent(createPopupHtml(stop, index));
    });
  }, [stops, route]);

  useEffect(() => {
    if (focusedIndex !== undefined && markers.current[focusedIndex] && mapRef.current) {
      const stop = stops[focusedIndex];
      if (stop) {
        mapRef.current.flyTo([stop.latitude, stop.longitude], 17, { duration: 0.8 });
        markers.current[focusedIndex].openPopup();
      }
    }
  }, [focusedIndex, stops]);

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    speedRef.current = SPEEDS[next];
  };

  const togglePause = () => {
    if (simState === "running") {
      pausedRef.current = true;
      setSimState("paused");
      setSimMsg("Simulation paused.");
    } else if (simState === "paused") {
      pausedRef.current = false;
      setSimState("running");
      setSimMsg("Simulation resumed — truck moving.");
    }
  };

  const showControls = motion && (simState === "running" || simState === "paused");

  return (
    <div>
      <div ref={host} className="collection-map" aria-label={route ? "Collection route map" : "Ward bin map"} />
      {roadMsg && <p className="map-caption" role="status">{roadMsg}</p>}
      {motion && (
        <div className="sim-panel">
          {simMsg && <p className="sim-status" role="status">{simMsg}</p>}
          {showControls && (
            <div className="sim-controls">
              <button type="button" className="sim-btn" onClick={togglePause}>
                {simState === "running" ? "Pause" : "Resume"}
              </button>
              <button type="button" className="sim-btn speed" onClick={cycleSpeed}>
                Speed: {SPEEDS[speedIdx]}x
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
