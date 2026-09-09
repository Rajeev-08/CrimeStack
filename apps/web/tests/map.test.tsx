import { vi, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
const state = vi.hoisted(() => ({ instances: [] as any[] }));
vi.mock("maplibre-gl", () => {
  class Map {
    options: any;
    sources: any = {};
    layers: any = [];
    events: any = {};
    visibility: any = {};
    fitBounds = vi.fn();
    jumpTo = vi.fn();
    remove = vi.fn();
    constructor(options: any) {
      this.options = options;
      state.instances.push(this);
    }
    addControl() {}
    on(event: string, first: any, second?: any) {
      if (event === "load") first();
      else this.events[event] = first;
      return this;
    }
    addSource(id: string, source: any) {
      this.sources[id] = { ...source, setData: vi.fn() };
    }
    getSource(id: string) {
      return this.sources[id];
    }
    addLayer(layer: any) {
      this.layers.push(layer);
    }
    setLayoutProperty(layer: string, key: string, value: string) {
      this.visibility[layer] = value;
    }
  }
  class Bounds {
    extend() {
      return this;
    }
  }
  return {
    default: {
      Map,
      LngLatBounds: Bounds,
      NavigationControl: class {},
      Popup: class {},
    },
  };
});
import MapPanel from "../src/components/MapPanel";
const point = (lon: number, lat: number) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties: { incident_id: "I1", severity: "high", category: "Theft" },
});
beforeEach(() => {
  state.instances.length = 0;
});
it("initializes embedded style before adding independent basemap and evidence", async () => {
  render(<MapPanel points={[point(77, 12)]} hotspots={{ groups: [] }} />);
  const map = state.instances[0];
  expect(map.options.style.sources).toEqual({});
  await waitFor(() => expect(map.sources.incidents.setData).toHaveBeenCalled());
  expect(map.sources.basemap.type).toBe("raster");
  expect(map.jumpTo).toHaveBeenCalledWith({ center: [77, 12], zoom: 12 });
});
it("fits multiple uploaded points and changes actual layer visibility", async () => {
  render(
    <MapPanel
      points={[point(77, 12), point(76, 13)]}
      hotspots={{ groups: [] }}
    />,
  );
  const map = state.instances[0];
  await waitFor(() => expect(map.fitBounds).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("Map mode"), {
    target: { value: "clusters" },
  });
  expect(map.visibility.clusters).toBe("visible");
  expect(map.visibility.points).toBe("none");
  fireEvent.change(screen.getByLabelText("Map mode"), {
    target: { value: "heatmap" },
  });
  expect(map.visibility.heatmap).toBe("visible");
});
it("shows coordinate warning for empty map", () => {
  render(<MapPanel points={[]} hotspots={{ groups: [] }} />);
  expect(
    screen.getByText(/No usable coordinates in this view/),
  ).toBeInTheDocument();
});
it("creates deterministic hotspot polygons without changing incident sources", async () => {
  render(
    <MapPanel
      points={[point(77, 12)]}
      hotspots={{
        groups: [
          {
            count: 3,
            cells: [{ west: 77, south: 12, east: 77.02, north: 12.02 }],
          },
        ],
      }}
    />,
  );
  const map = state.instances[0];
  await waitFor(() => expect(map.sources.hotspots.setData).toHaveBeenCalled());
  expect(
    map.sources.hotspots.setData.mock.calls[0][0].features[0].geometry.type,
  ).toBe("Polygon");
});
