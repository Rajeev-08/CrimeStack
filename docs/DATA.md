# Data contracts, provenance and examples

| Classification | Meaning |
|---|---|
| uploaded_unverified | Structurally validated upload, not independently authenticated |
| official_declared | Importer declares an official source; platform has not authenticated that claim |
| synthetic_demo | Fictional incidents/entities/cases/indicator values |
| managed_source | Output of a controlled configured source profile; not proof of authenticity |

The selected dataset badge appears throughout the workspace. Geographic basemaps are external real-world context, separate from incident provenance. Ordinary imports cannot claim `managed_source`; only a successful source-profile execution assigns it.

Incident canonical fields: `incident_id, occurred_at, reported_at, category, subcategory, description, severity, status, latitude, longitude, state_code, district_code, station_code, source_dataset_id`.

Required: recognizable ISO occurrence date/datetime and nonempty category. Dates without timezone are interpreted as UTC. Aliases: `id`/`case_number` → incident_id; `date`/`datetime_occ` → occurred_at; `primary_type` → category; `lat` → latitude; `lon`/`lng` → longitude; `district` → district_code; `police_station`/`beat` → station_code. Ambiguous duplicate canonical columns are rejected.

Valid latitude range is [-90,90], longitude [-180,180], both finite numeric values. A missing/invalid member invalidates the entire map pair while retaining the otherwise valid incident row. Coordinates are never invented and districts are not geocoded. Missing incident IDs get deterministic content hashes; repeated source IDs/content hashes within an upload count as duplicates. Imported source datasets remain independent: matching IDs in two datasets are not automatically merged.

Preview contains totals, accepted/rejected/duplicates, map-ready rows, mappings, missing counts, first 20 errors, date window, distributions, fingerprint, source-ID coverage and other coverages. Quality is `100*(accepted/total*0.5 + mean(source-ID,timestamp,coordinate,district,station coverage)*0.5)`, rounded to one decimal. It is a structural completeness measure only. Schema drift reports fingerprints/mapping differences; distribution changes are shown side-by-side, not as statistical significance claims.

Limits: UTF-8 CSV up to 10 MB, 100,000 rows, 80 columns. The current analytical endpoint returns all selected map features; practical interactive performance can decline before those limits on low-memory devices.

## Bundled examples

`python scripts/generate_examples.py` deterministically regenerates all fixtures with seed 707. Long-duration fixture: 7,471 fictional incidents; Karnataka fixture: its January/February 2026 subset. Coordinates cluster near six real Karnataka cities. **No incident, case, person, relationship or socio-economic value is real.** Filenames, descriptions, publisher declarations and UI provenance must retain this distinction.

Network JSON wraps an `edges` array with `confirmed`, `authorization_basis`, and `provenance`. Each edge requires source/target IDs, unique stable source/target aliases, source/target entity types, relationship type and case reference. Confidence is optional in [0,1]. Ordinary incident imports do not create network records.

Context JSON wraps `indicators` with `source_name`, `source_url`, `licence`, `provenance`, selected `indicator_code` and `period`. Each indicator has district_code, period, indicator_code, indicator_name, numeric value and unit. Population rows use `indicator_code=population` for the same period. Codes match exactly and unmatched codes are reported. At least five matched districts and nonconstant axes are needed for Spearman correlation. Incident rates reflect the full selected incident dataset period and are not automatically annualized. No causal or person-level inference is permitted.

## Real data

No real public dataset has been bundled or certified. Upload data you are authorized to use, record its publisher and licence where applicable, and choose honest provenance. An official-declared label does not validate the declaration. The platform does not download arbitrary external data.
