import { downloadBlob, fmtInteger, fmtNumber, slugify } from "./utils.js";

function cleanXml(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const REPORT_THEME = {
  accent: "1F5E7A",
  accent2: "2E8B8B",
  dark: "1D2B31",
  muted: "5B6A71",
  line: "D4C8B6",
  soft: "F7F1E6",
  softAccent: "E7F0F1",
  white: "FFFFFF",
};

function paragraph(text, style = null, options = {}) {
  const props = [
    style ? `<w:pStyle w:val="${style}"/>` : "",
    options.before || options.after || options.line
      ? `<w:spacing ${options.before ? `w:before="${options.before}"` : ""} ${options.after ? `w:after="${options.after}"` : ""} ${options.line ? `w:line="${options.line}" w:lineRule="auto"` : ""}/>`
      : "",
    options.align ? `<w:jc w:val="${options.align}"/>` : "",
  ].join("");
  const runProps = [
    options.bold ? "<w:b/>" : "",
    options.italics ? "<w:i/>" : "",
    options.color ? `<w:color w:val="${options.color}"/>` : "",
    options.size ? `<w:sz w:val="${options.size}"/>` : "",
  ].join("");
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}<w:r>${runProps ? `<w:rPr>${runProps}</w:rPr>` : ""}<w:t xml:space="preserve">${cleanXml(text)}</w:t></w:r></w:p>`;
}

function tableCell(value, options = {}) {
  const width = options.width || 2400;
  const shading = options.fill ? `<w:shd w:fill="${options.fill}"/>` : "";
  const borders = options.noBorders
    ? '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>'
    : "";
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shading}${borders}<w:tcMar><w:top w:w="90" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="90" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>${paragraph(value, null, {
    bold: options.bold,
    color: options.color || REPORT_THEME.dark,
    size: options.size || 21,
    after: 0,
    line: 280,
  })}</w:tc>`;
}

function table(headers, rows, options = {}) {
  const borderColor = options.borderColor || REPORT_THEME.line;
  const border = `<w:top w:val="single" w:sz="5" w:color="${borderColor}"/><w:left w:val="single" w:sz="5" w:color="${borderColor}"/><w:bottom w:val="single" w:sz="5" w:color="${borderColor}"/><w:right w:val="single" w:sz="5" w:color="${borderColor}"/><w:insideH w:val="single" w:sz="4" w:color="${borderColor}"/><w:insideV w:val="single" w:sz="4" w:color="${borderColor}"/>`;
  const widths = options.widths || headers.map(() => Math.floor(9360 / Math.max(headers.length, 1)));
  const headerRow = `<w:tr>${headers.map((header, index) => tableCell(header, {
    width: widths[index],
    fill: REPORT_THEME.accent,
    color: REPORT_THEME.white,
    bold: true,
    size: 20,
  })).join("")}</w:tr>`;
  const bodyRows = rows.map((row, rowIndex) => `<w:tr>${headers.map((header, index) => tableCell(row[header], {
    width: widths[index],
    fill: rowIndex % 2 === 0 ? REPORT_THEME.white : "FBF8F0",
  })).join("")}</w:tr>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders>${border}</w:tblBorders><w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr>${headerRow}${bodyRows}</w:tbl>`;
}

function keyValueTable(rows, labels = { field: "Field", value: "Value" }) {
  const pairs = [];
  for (let index = 0; index < rows.length; index += 2) {
    pairs.push({
      Field1: rows[index]?.Field || "",
      Value1: rows[index]?.Value || "",
      Field2: rows[index + 1]?.Field || "",
      Value2: rows[index + 1]?.Value || "",
    });
  }
  return table(["Field1", "Value1", "Field2", "Value2"], pairs, {
    widths: [2200, 2500, 2200, 2460],
  }).replace(/Field1/g, labels.field).replace(/Value1/g, labels.value).replace(/Field2/g, labels.field).replace(/Value2/g, labels.value);
}

function section(title, rows, headers = ["Field", "Value"], options = {}) {
  if (!rows.length) return "";
  return `${paragraph(title, "Heading1")}${options.keyValue ? keyValueTable(rows, {
    field: options.fieldHeader || "Field",
    value: options.valueHeader || "Value",
  }) : table(headers, rows, options)}`;
}

function callout(text) {
  return `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="5" w:color="${REPORT_THEME.line}"/><w:left w:val="single" w:sz="5" w:color="${REPORT_THEME.line}"/><w:bottom w:val="single" w:sz="5" w:color="${REPORT_THEME.line}"/><w:right w:val="single" w:sz="5" w:color="${REPORT_THEME.line}"/></w:tblBorders></w:tblPr><w:tr>${tableCell(text, {
    width: 9360,
    fill: REPORT_THEME.softAccent,
    color: REPORT_THEME.dark,
  })}</w:tr></w:tbl>`;
}

function documentXml({
  title,
  subtitle,
  generated,
  paragraphs = [],
  methods = [],
  sections = [],
  generatedLabel = "Generated",
  reportEyebrow = "MIRA: Multi-hazard Index for Risk Assessment",
  calloutText = "These reports help summarize map values and city scores. They are not forecasts or official warnings. Use them with local knowledge and local checks.",
  methodsTitle = "How to read this report",
}) {
  const body = [
    paragraph(reportEyebrow, "Eyebrow"),
    paragraph(title, "Title"),
    subtitle ? paragraph(subtitle, "Subtitle") : "",
    generated ? paragraph(`${generatedLabel} ${generated}`, "Meta") : "",
    callout(calloutText),
    ...paragraphs.map((text) => paragraph(text, null, { after: 120, line: 300 })),
    methods.length ? paragraph(methodsTitle, "Heading1") : "",
    ...methods.map((text) => paragraph(text, null, { after: 120, line: 300 })),
    ...sections.map((item) => section(item.title, item.rows, item.headers, item)),
    '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>',
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${body}</w:document>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:color w:val="${REPORT_THEME.dark}"/><w:sz w:val="21"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Eyebrow"><w:name w:val="Eyebrow"/><w:pPr><w:spacing w:after="60"/></w:pPr><w:rPr><w:b/><w:caps/><w:color w:val="${REPORT_THEME.accent2}"/><w:sz w:val="18"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:after="80"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:color w:val="${REPORT_THEME.accent}"/><w:sz w:val="42"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:pPr><w:spacing w:after="60"/></w:pPr><w:rPr><w:i/><w:color w:val="${REPORT_THEME.muted}"/><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Meta"/><w:pPr><w:spacing w:after="180"/></w:pPr><w:rPr><w:color w:val="${REPORT_THEME.muted}"/><w:sz w:val="19"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:pPr><w:spacing w:before="300" w:after="120"/></w:pPr><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:color w:val="${REPORT_THEME.accent}"/><w:sz w:val="28"/></w:rPr></w:style>
</w:styles>`;
}

async function createDocxBlob(payload) {
  if (!window.JSZip) throw new Error("Word report generator is not available. Reload the page and try again.");
  const zip = new window.JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.folder("word").file("document.xml", documentXml(payload));
  zip.folder("word").file("styles.xml", stylesXml());
  zip.folder("word").folder("_rels").file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);
  return zip.generateAsync({
    compression: "DEFLATE",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    type: "blob",
  });
}

async function downloadDocx(filename, payload) {
  const blob = await createDocxBlob(payload);
  downloadBlob(filename, blob);
}

function rasterValueRows(values, language = "en") {
  return values.map((row) => ({
    Layer: row.title,
    Value: row.displayValue,
    Units: row.units || "NA",
    Pixel: row.pixelLabel || (row.row == null || row.col == null ? "NA" : language === "pt" ? `linha ${row.row}, coluna ${row.col}` : `row ${row.row}, col ${row.col}`),
    Description: row.description || "NA",
    Note: row.note || "",
  }));
}

export function pixelReportRows(report, options = {}) {
  return rasterValueRows(report?.values || [], options.language || "en");
}

export async function createPixelReportDownload(report, activeLayerTitle, options = {}) {
  const language = options.language === "pt" ? "pt" : "en";
  const generated = new Date(report.generatedAt).toLocaleString(language === "pt" ? "pt-BR" : "en-US");
  const copy = language === "pt"
    ? {
        activeLayer: "Camada ativa no clique",
        generated: "Gerado",
        title: "Relatório de Extração do Pixel no Atlas",
        subtitle: "Valores na célula clicada nas camadas do MIRA",
        paragraph: "Este relatório armazena os valores raster no local selecionado na visão Atlas. Ele registra a localização, a camada ativa, a linha e a coluna da célula, os valores das camadas, as unidades e as notas de ausência de dados.",
        method1: "Cada valor é lido do arquivo GeoTIFF usado pelo site. O local clicado é associado a uma linha e uma coluna do raster. O valor é o valor da célula naquele ponto, sem interpolação.",
        method2: "As unidades são listadas para cada camada. Camadas de probabilidade e índice não possuem unidade física. Células sem dados aparecem como NA. Mapas de classes mostram o código e o rótulo armazenados quando disponíveis.",
        summary: "Resumo do pixel clicado",
        values: "Valores raster no pixel clicado",
        headers: ["Camada", "Valor", "Unidades", "Pixel", "Descrição", "Nota"],
        fieldHeader: "Campo",
        valueHeader: "Valor",
        generatedLabel: "Gerado em",
        callout: "Estes relatórios ajudam a resumir valores de mapas e resultados urbanos. Eles não são previsões nem alertas oficiais. Use-os junto com conhecimento local e verificações locais.",
        methodsTitle: "Como ler este relatório",
      }
    : {
        activeLayer: "Active layer when clicked",
        generated: "Generated",
        title: "Atlas Pixel Extraction Report",
        subtitle: "Values at the clicked map cell across the MIRA layers",
        paragraph: "This report stores the raster values at the map location selected in the Atlas view. It records the location, active layer, cell row and column, layer values, units, and no-data notes.",
        method1: "Each value is read from the GeoTIFF file used by the website. The clicked location is matched to a raster row and column. The value is the cell value at that place, not an interpolated value.",
        method2: "Units are listed for each layer. Probability and index layers have no physical unit. No-data cells are shown as NA. Class maps show the stored class code and label when available.",
        summary: "Clicked pixel summary",
        values: "Raster values at clicked pixel",
        headers: ["Layer", "Value", "Units", "Pixel", "Description", "Note"],
        fieldHeader: "Field",
        valueHeader: "Value",
        generatedLabel: "Generated",
        callout: "These reports help summarize map values and city scores. They are not forecasts or official warnings. Use them with local knowledge and local checks.",
        methodsTitle: "How to read this report",
      };
  const coordinateRows = [
    { Field: "Latitude", Value: fmtNumber(report.lat, 6) },
    { Field: "Longitude", Value: fmtNumber(report.lon, 6) },
    { Field: copy.activeLayer, Value: activeLayerTitle || "NA" },
    { Field: copy.generated, Value: generated },
  ];
  const filename = `atlas_pixel_${report.lat.toFixed(4)}_${report.lon.toFixed(4)}.docx`;
  const rowKeys = ["Layer", "Value", "Units", "Pixel", "Description", "Note"];
  const rows = pixelReportRows(report, { language }).map((row) =>
    Object.fromEntries(copy.headers.map((header, index) => [header, row[rowKeys[index]]])),
  );
  const payload = {
    title: copy.title,
    subtitle: copy.subtitle,
    generated,
    generatedLabel: copy.generatedLabel,
    calloutText: copy.callout,
    methodsTitle: copy.methodsTitle,
    paragraphs: [
      copy.paragraph,
    ],
    methods: [
      copy.method1,
      copy.method2,
    ],
    sections: [
      { title: copy.summary, rows: coordinateRows, keyValue: true, fieldHeader: copy.fieldHeader, valueHeader: copy.valueHeader },
      {
        title: copy.values,
        headers: copy.headers,
        rows,
        widths: [2100, 1000, 1100, 1200, 3000, 960],
      },
    ],
  };
  return { blob: await createDocxBlob(payload), filename };
}

export async function downloadPixelReport(report, activeLayerTitle, options = {}) {
  const { blob, filename } = await createPixelReportDownload(report, activeLayerTitle, options);
  downloadBlob(filename, blob);
}

export function cityRasterRows(rasterRecord) {
  return (rasterRecord?.values || []).map((row) => ({
    Raster: row.label,
    Mean: row.value == null ? "NA" : fmtNumber(row.value, 4),
    "Std.": row.std == null ? "NA" : fmtNumber(row.std, 4),
    Pixels: row.count == null ? "NA" : fmtInteger(row.count),
    Units: row.units || "NA",
  }));
}

export async function createCityReportDownload(city, metrics, rasterRecord) {
  const filename = `${slugify(city.ADM0_NAME)}_${slugify(city.ADM2_NAME)}_city_report.docx`;
  const cityRows = [
    { Field: "City area", Value: city.ADM2_NAME },
    { Field: "State or province", Value: city.ADM1_NAME || "NA" },
    { Field: "Country", Value: city.ADM0_NAME },
    { Field: "Population", Value: fmtInteger(city.TotPop) },
    { Field: "Population class", Value: city.PopGroup || "NA" },
    { Field: "Dominant hazard", Value: city.dominant_hazard || "NA" },
    { Field: "Paper class", Value: city.city_cluster || "NA" },
    { Field: "Live class", Value: city.dynamic_cluster || "NA" },
    { Field: "Latitude", Value: fmtNumber(city.point_lat, 6) },
    { Field: "Longitude", Value: fmtNumber(city.point_lon, 6) },
  ];
  const weightRows = [
    { Field: "Flood weight, unitless", Value: fmtNumber(city.report_weights?.hazardComponents?.flood, 2) },
    { Field: "Drought weight, unitless", Value: fmtNumber(city.report_weights?.hazardComponents?.drought, 2) },
    { Field: "Wildfire weight, unitless", Value: fmtNumber(city.report_weights?.hazardComponents?.wildfire, 2) },
    { Field: "GDP capacity weight, unitless", Value: fmtNumber(city.report_weights?.adaptiveCapacity?.gdp, 2) },
    { Field: "HDI capacity weight, unitless", Value: fmtNumber(city.report_weights?.adaptiveCapacity?.hdi, 2) },
    { Field: "Hazard-lower-capacity weight, unitless", Value: fmtNumber(city.report_weights?.hazardWeight, 2) },
  ];
  const scoreRows = [
    { Field: "Priority score, 0-100", Value: fmtNumber(city.priority, 3) },
    { Field: "Hazard component, unitless 0-1", Value: fmtNumber(metrics.hazard, 4) },
    { Field: "Lower-capacity score, unitless 0-1", Value: fmtNumber(metrics.vulnerability, 4) },
    { Field: "Live hazard score, unitless 0-1", Value: fmtNumber(city.dynamic_hazard, 4) },
    { Field: "Live social and economic score, unitless 0-1", Value: fmtNumber(city.dynamic_socio, 4) },
    { Field: "Flood score, unitless 0-1", Value: fmtNumber(city.FSI_n, 4) },
    { Field: "Drought score, unitless 0-1", Value: fmtNumber(city.DSI_n, 4) },
    { Field: "Wildfire score, unitless 0-1", Value: fmtNumber(city.FRI_n, 4) },
    { Field: "GDP class, unitless 0-1", Value: fmtNumber(city.GDP_Class_n, 4) },
    { Field: "HDI class, unitless 0-1", Value: fmtNumber(city.HDI_n, 4) },
    { Field: "Impervious intensity, fraction", Value: fmtNumber(city.ImpRate, 4) },
  ];
  const payload = {
    title: "City Ranking Report",
    subtitle: `${city.ADM2_NAME}, ${city.ADM0_NAME}`,
    generated: new Date().toLocaleString("en-US"),
    paragraphs: [
      "This report summarizes the selected city area in the City Ranking tool. It includes the city scores, current weights, fixed paper class, live class from current weights, and raster summaries from the web atlas.",
    ],
    methods: [
      "The priority score combines hazard and lower capacity. Hazard is a weighted mix of flood, drought, and wildfire scores. Capacity is a weighted mix of GDP and HDI. Lower capacity is one minus capacity. The final priority score is 100 times the weighted mix of hazard and lower capacity.",
      "The fixed paper class uses the map from the paper. The live class updates the hazard and capacity scores from the current flood, drought, wildfire, GDP, and HDI weights, then groups all city areas into four classes. The hazard-versus-lower-capacity slider changes the city rank, but not the live class map.",
      "Raster values are reported with units. Probability and index fields have no physical unit. Pixel counts show how many raster cells were summarized inside the city area when available.",
    ],
    sections: [
      { title: "City identity", rows: cityRows, keyValue: true },
      { title: "Weights used for this export", rows: weightRows, keyValue: true },
      { title: "Priority and driver scores", rows: scoreRows, keyValue: true },
      {
        title: "Raster values for the city area",
        headers: ["Raster", "Mean", "Std.", "Pixels", "Units"],
        rows: cityRasterRows(rasterRecord),
        widths: [3300, 1350, 1350, 1350, 2010],
      },
    ],
  };
  return { blob: await createDocxBlob(payload), filename };
}

export async function downloadCityReport(city, metrics, rasterRecord) {
  const { blob, filename } = await createCityReportDownload(city, metrics, rasterRecord);
  downloadBlob(filename, blob);
}
