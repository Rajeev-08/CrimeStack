import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
export default function MapPanel({
  points,
  hotspots,
}: {
  points: any[];
  hotspots: any;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null);
  const [mode, setMode] = useState("points"),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState(""),
    [showHotspots, setShowHotspots] = useState(true);
  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#101e2e" },
            },
          ],
        },
        center: [76.6, 13.7],
        zoom: 5,
        attributionControl: { compact: true },
      });
    } catch (e) {
      setMessage(`Map could not initialize: ${String(e)}`);
      return;
    }
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl());
    instance.on("load", () => {
      instance.addSource("basemap", {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      });
      instance.addLayer({
        id: "basemap",
        type: "raster",
        source: "basemap",
        paint: { "raster-opacity": 0.35, "raster-saturation": -0.8 },
      });
      instance.addSource("incidents", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      instance.addSource("clusters", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterRadius: 45,
      });
      instance.addSource("hotspots", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      instance.addLayer({
        id: "hotspots",
        type: "fill",
        source: "hotspots",
        paint: {
          "fill-color": "#ffb74d",
          "fill-opacity": 0.2,
          "fill-outline-color": "#ffb74d",
        },
      });
      instance.addLayer({
        id: "heatmap",
        type: "heatmap",
        source: "incidents",
        paint: { "heatmap-radius": 30, "heatmap-opacity": 0.8 },
      });
      instance.addLayer({
        id: "clusters",
        type: "circle",
        source: "clusters",
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": [
            "step",
            ["get", "point_count"],
            15,
            20,
            22,
            100,
            30,
          ],
          "circle-color": "#49d9c1",
          "circle-opacity": 0.8,
        },
      });
      instance.addLayer({
        id: "cluster-points",
        type: "circle",
        source: "clusters",
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-radius": 6, "circle-color": "#49d9c1" },
      });
      instance.addLayer({
        id: "points",
        type: "circle",
        source: "incidents",
        paint: {
          "circle-radius": 6,
          "circle-color": [
            "match",
            ["get", "severity"],
            "critical",
            "#ff7b7b",
            "high",
            "#ffbc5a",
            "medium",
            "#4dd9c0",
            "#9daef4",
          ],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ecf9ff",
        },
      });
      for (const layer of ["points", "cluster-points"])
        instance.on("click", layer, (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          const p = feature.properties;
          const content = document.createElement("div");
          content.textContent = `${p?.category} · ${p?.severity}\n${p?.district_code}\n${p?.occurred_at}\n${p?.incident_id}`;
          new maplibregl.Popup()
            .setLngLat(event.lngLat)
            .setDOMContent(content)
            .addTo(instance);
        });
      instance.on("click", "clusters", (event) => {
        if (event.features?.[0])
          new maplibregl.Popup()
            .setLngLat(event.lngLat)
            .setText(
              `${event.features[0].properties?.point_count} incidents in this cluster`,
            )
            .addTo(instance);
      });
      setReady(true);
      // Approved style is an optional basemap overlay; it never replaces incident sources.
      const approvedStyle = import.meta.env.VITE_MAP_STYLE_URL;
      if (approvedStyle) {
        fetch(approvedStyle)
          .then((response) => {
            if (!response.ok) throw Error("Approved style unavailable");
            return response.json();
          })
          .then((style) => {
            if (style.version !== 8)
              throw Error("Expected MapLibre style version 8");
            for (const [id, source] of Object.entries(style.sources || {})) {
              if ((source as any).type === "raster")
                instance.addSource(`approved-${id}`, source as any);
            }
            for (const layer of style.layers || []) {
              if (
                layer.type === "raster" &&
                instance.getSource(`approved-${layer.source}`)
              ) {
                instance.addLayer(
                  {
                    ...layer,
                    id: `approved-${layer.id}`,
                    source: `approved-${layer.source}`,
                  },
                  "hotspots",
                );
              }
            }
          })
          .catch(() =>
            setMessage(
              "Approved raster basemap unavailable. Local incident layers remain available.",
            ),
          );
      }
    });
    instance.on("error", () =>
      setMessage(
        "External map resources are unavailable. Uploaded points remain on the local dark canvas.",
      ),
    );
    return () => {
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    const m = map.current;
    for (const source of ["incidents", "clusters"])
      (m.getSource(source) as maplibregl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: points,
      });
    if (points.length === 1)
      m.jumpTo({ center: points[0].geometry.coordinates, zoom: 12 });
    else if (points.length) {
      const bounds = new maplibregl.LngLatBounds();
      points.forEach((p) => bounds.extend(p.geometry.coordinates));
      m.fitBounds(bounds, { padding: 55, maxZoom: 13, duration: 0 });
    }
    const features = (hotspots?.groups || []).flatMap((group: any) =>
      group.cells.map((c: any) => ({
        type: "Feature",
        properties: { count: group.count },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [c.west, c.south],
              [c.east, c.south],
              [c.east, c.north],
              [c.west, c.north],
              [c.west, c.south],
            ],
          ],
        },
      })),
    );
    (m.getSource("hotspots") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
  }, [points, hotspots, ready]);
  useEffect(() => {
    if (!ready || !map.current) return;
    for (const layer of ["heatmap", "clusters", "cluster-points", "points"])
      map.current.setLayoutProperty(
        layer,
        "visibility",
        (
          mode === "clusters"
            ? ["clusters", "cluster-points"].includes(layer)
            : layer === mode
        )
          ? "visible"
          : "none",
      );
    map.current.setLayoutProperty(
      "hotspots",
      "visibility",
      showHotspots ? "visible" : "none",
    );
  }, [mode, ready, showHotspots]);
  async function boundaries(file: File) {
    try {
      const geo = JSON.parse(await file.text());
      if (
        geo.type !== "FeatureCollection" ||
        geo.features.some(
          (f: any) => !["Polygon", "MultiPolygon"].includes(f.geometry?.type),
        )
      )
        throw Error("Expected polygon FeatureCollection");
      const m = map.current;
      if (!m || !ready) throw Error("Map is not ready");
      if (m.getSource("boundaries"))
        (m.getSource("boundaries") as maplibregl.GeoJSONSource).setData(geo);
      else {
        m.addSource("boundaries", { type: "geojson", data: geo });
        m.addLayer({
          id: "boundaries",
          type: "line",
          source: "boundaries",
          paint: { "line-color": "#c0a6ff", "line-width": 2 },
        });
      }
      setMessage("User-supplied district boundaries displayed.");
    } catch (e) {
      setMessage(String(e));
    }
  }
  return (
    <section className="panel map-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">GEOSPATIAL INTELLIGENCE</span>
          <h2>Incident geography</h2>
        </div>
        <select
          aria-label="Map mode"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="points">Individual points</option>
          <option value="clusters">Clusters</option>
          <option value="heatmap">Heatmap</option>
        </select>
      </div>
      <div
        ref={container}
        className="map"
        data-testid="incident-map"
        data-point-count={points.length}
      />
      {!points.length && (
        <p className="notice">
          No usable coordinates in this view. The CSV needs numeric latitude/lat
          and longitude/lon/lng columns. District names are not silently
          geocoded.
        </p>
      )}
      <div className="map-footer">
        <span>
          ● Low/unknown · <b className="teal">● Medium</b> ·{" "}
          <b className="amber">● High</b> · <b className="coral">● Critical</b>
        </span>
        <label>
          <input
            type="checkbox"
            checked={showHotspots}
            onChange={(e) => setShowHotspots(e.target.checked)}
          />{" "}
          Historical hotspots
        </label>
        <label className="file-button">
          District GeoJSON
          <input
            type="file"
            accept=".json,.geojson"
            onChange={(e) =>
              e.target.files?.[0] && boundaries(e.target.files[0])
            }
          />
        </label>
      </div>
      {message && <p className="notice">{message}</p>}
      <p className="muted">
        Real basemap context · uploaded incident coordinates · optional uploaded
        boundaries. Hotspots describe historical density.
      </p>
    </section>
  );
}
