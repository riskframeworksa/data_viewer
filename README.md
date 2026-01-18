South America City Priority Explorer (Static GitHub Pages)

Files
- index.html          : single-page app (Leaflet + Plotly)
- cities.json         : city points + metrics (generated from shapefile)
- fig5.png (optional) : if you want to show Figure 5 image in the Methods section

How to run locally (simple)
1) Put index.html and cities.json in the same folder
2) Start a tiny server from that folder:
   python -m http.server 8000
3) Open: http://localhost:8000

How to deploy on GitHub Pages
1) Create a repo (or use an existing one)
2) Commit index.html and cities.json to the root (or /docs)
3) In Settings -> Pages, select the branch + folder

Notes
- The app computes:
  - Hazard H = 0.55*FloodSus + 0.35*DrouSus + 0.10*FireSus
  - Socio (Adaptive capacity) S = 0.40*norm(GDPpc) + 0.60*norm(HDI)
  - Vulnerability V = 1 - S
  - Priority = 100 * ( wH*H + (1-wH)*V )
- Tiering is percentile-based within the currently filtered set.
