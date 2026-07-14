# MIRA

This repository is the publishable static website bundle for MIRA, the Multi-hazard Index for Risk Assessment.

It merges two workflows into one interface:

- an `Atlas` view for browsing raster and polygon layers from the paper;
- an `Urban Prioritization` view for city-level screening based on the published hazard and socioeconomic indicators.

The site is static and GitHub Pages compatible. It does not require a backend.

## What the website contains

- `index.html`: static app shell
- `app.js`: browser bootstrap
- `js/`: client-side atlas and prioritization logic
- `styles.css`: site styling
- `assets/`: shared branding and benchmark figures
- `vendor/`: bundled third-party browser libraries
- `data/`: generated browser-ready tiles, GeoJSON overlays, metadata, and downloads

## What the website lets you do

- browse the published XGBoost susceptibility and exposure layers
- inspect flood, drought, wildfire, and socioeconomic input layers
- explore municipal risk classes and city points in the same map workflow
- rank cities with adjustable hazard and adaptive-capacity weights
- export the currently filtered city ranking as CSV
- jump from atlas layers to the city tool and back to source layers

## Important interpretation note

This product is for screening, comparison, communication, and hypothesis generation. It is not an operational warning platform and does not replace local validation or forecasting systems.

## Source of truth

This repository stores the publishable website bundle only. The analysis workspace remains the source of truth for the raw rasters, model outputs, and preprocessing scripts.

The browser-ready assets in `data/` were derived from the research rasters, benchmark outputs, and municipal products used in the manuscript.

## Rebuild workflow

1. Regenerate browser-ready data from the analysis workspace.

2. Serve the site locally from this folder:

   `python3 -m http.server 8000`

3. Open:

   `http://localhost:8000`

## Deployment note

The website can be deployed as a static GitHub Pages site. No server-side routes or database are required.
