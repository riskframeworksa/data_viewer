const rasterCache = new Map();
const rasterAssetVersion = String(Date.now());

function geotiffApi() {
  if (!window.GeoTIFF?.fromUrl) {
    throw new Error("GeoTIFF reader is not available. Reload the page and try again.");
  }
  return window.GeoTIFF;
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function layerNoData(image) {
  const fromMethod = typeof image.getGDALNoData === "function" ? image.getGDALNoData() : null;
  const fromDirectory = image.fileDirectory?.GDAL_NODATA ?? null;
  return toNumber(fromMethod ?? fromDirectory);
}

async function rasterHandle(layer) {
  if (!rasterCache.has(layer.id)) {
    const tiff = await geotiffApi().fromUrl(`./${layer.download_url}?v=${rasterAssetVersion}`);
    const image = await tiff.getImage();
    const bbox = image.getBoundingBox();
    rasterCache.set(layer.id, {
      bbox,
      height: image.getHeight(),
      image,
      noData: layerNoData(image),
      width: image.getWidth(),
    });
  }
  return rasterCache.get(layer.id);
}

function pixelPosition(handle, { lat, lon }) {
  const [west, south, east, north] = handle.bbox;
  if (lon < west || lon > east || lat < south || lat > north) return null;
  const col = Math.floor(((lon - west) / (east - west)) * handle.width);
  const row = Math.floor(((north - lat) / (north - south)) * handle.height);
  if (col < 0 || col >= handle.width || row < 0 || row >= handle.height) return null;
  return { col, row };
}

function legendLabel(layer, value) {
  if (!layer.legend_items?.length || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return layer.legend_items.find((item) => Number(item.value) === rounded)?.label || null;
}

function isNoData(value, noData) {
  if (value == null || Number.isNaN(value)) return true;
  if (noData == null || Number.isNaN(noData)) return false;
  return Object.is(value, noData) || Math.abs(value - noData) < 1e-9;
}

function displayValue(layer, value, noData) {
  if (isNoData(value, noData)) return "NA";
  const label = legendLabel(layer, value);
  if (label) return `${Math.round(value)} (${label})`;
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return Number(value).toLocaleString("en-US", {
    maximumFractionDigits: Math.abs(value) >= 1000 ? 2 : 4,
    minimumFractionDigits: 0,
  });
}

async function sampleRasterLayer(layer, coordinates) {
  const handle = await rasterHandle(layer);
  const position = pixelPosition(handle, coordinates);
  if (!position) {
    return {
      id: layer.id,
      title: layer.title,
      units: layer.units || "",
      description: layer.description || "",
      value: null,
      displayValue: "NA",
      row: null,
      col: null,
      note: "Coordinate outside raster extent",
    };
  }

  const data = await handle.image.readRasters({
    interleave: true,
    samples: [0],
    window: [position.col, position.row, position.col + 1, position.row + 1],
  });
  const value = Number(data[0]);
  const missing = isNoData(value, handle.noData);
  return {
    id: layer.id,
    title: layer.title,
    units: layer.units || "",
    description: layer.description || "",
    value: missing ? null : value,
    displayValue: displayValue(layer, value, handle.noData),
    row: position.row,
    col: position.col,
    note: missing ? "No data at clicked pixel" : "",
  };
}

export async function sampleRasterCatalog(layers, coordinates) {
  const rasterLayers = layers.filter((layer) => layer.kind === "raster" && layer.download_url);
  const values = [];
  for (const layer of rasterLayers) {
    try {
      values.push(await sampleRasterLayer(layer, coordinates));
    } catch (error) {
      values.push({
        id: layer.id,
        title: layer.title,
        units: layer.units || "",
        description: layer.description || "",
        value: null,
        displayValue: "NA",
        row: null,
        col: null,
        note: `Sampling error: ${error.message}`,
      });
    }
  }
  return values;
}
