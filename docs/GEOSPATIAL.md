# Geospatial behavior

MapLibre initializes with an embedded style containing only a dark background. OSM raster tiles are added independently. Incident, heatmap, cluster and hotspot sources do not depend on a third-party style endpoint. Tile errors show a fallback notice; incident layers remain available if WebGL itself is supported. If WebGL is unavailable, the UI shows an initialization error rather than claiming successful rendering.

All valid points are fitted after import/filter changes. One point uses a fixed zoom of 12. No points shows the exact coordinate-help message. Severity colors distinguish critical (coral), high (amber), medium (teal) and low/unknown (violet). Popups use DOM textContent, not HTML from uploads. Clusters expose counts through click popups.

`VITE_MAP_STYLE_URL` is optional build-time configuration for an administrator-approved MapLibre v8 raster style. Supported raster sources/layers are prefixed and inserted below evidence; vectors, sprites and glyphs are intentionally not imported. The original local style is never replaced. A deployment should approve the style's referenced tile hosts and review map-provider usage terms. OSM attribution is retained.

User-provided GeoJSON boundaries must be Polygon/MultiPolygon FeatureCollections. They are optional geographic context, not inferred incident data or authenticated administrative boundaries.

Hotspots: divide longitude/latitude into fixed 0.02-degree cells aligned to zero; retain cells with at least three records; merge orthogonally adjacent dense cells with deterministic connected-component traversal. Display every retained cell polygon. Angular cell areas vary with latitude and these summaries are not distance-corrected density estimates. The method summarizes historical uploads, not future crime likelihood.
