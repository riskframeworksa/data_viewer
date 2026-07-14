import {
  MUNICIPAL_CLASS_LABELS,
  buildDynamicMunicipalClasses,
  buildPriorityRows,
  markerRadius,
  priorityScore,
} from "./priority.js";
import { downloadCityReport, downloadPixelReport } from "./reporting.js";
import { sampleRasterCatalog } from "./raster-sampler.js";
import {
  $,
  $$,
  clearChildren,
  createOption,
  cssGradient,
  downloadTextFile,
  fetchJson,
  fmtCompact,
  fmtInteger,
  fmtNumber,
  fmtPercent,
  slugify,
  toCsv,
  uniqueSorted,
} from "./utils.js";

const MUNICIPAL_COLORS = {
  "High Socio / Low Hazard": "#1f9d55",
  "High Socio / High Hazard": "#f08c1a",
  "Low Socio / Low Hazard": "#2b6cb0",
  "Low Socio / High Hazard": "#d62828",
};

const GROUP_TITLE_PT = {
  hazard_susceptibility: "Valores de perigo",
  hazard_exposure: "Pessoas em risco",
  flood_predictors: "Entradas de inundação",
  drought_predictors: "Entradas de seca",
  wildfire_predictors: "Entradas de incêndio",
  socioeconomic_context: "Pessoas, economia e uso da terra",
  urban_classification: "Classes urbanas",
};

const LAYER_TEXT_PT = {
  xgb_fsi: {
    title: "Valor de Perigo de Inundação (XGBoost)",
    description: "Valor de perigo de inundação do modelo XGBoost. Valores maiores indicam condições mais propensas à inundação.",
  },
  xgb_dsi: {
    title: "Valor de Perigo de Seca (XGBoost)",
    description: "Valor de perigo de seca do modelo XGBoost. Valores maiores indicam condições mais propensas à seca.",
  },
  xgb_fisi: {
    title: "Valor de Perigo de Incêndio (XGBoost)",
    description: "Valor de perigo de incêndio do modelo XGBoost. Valores maiores indicam condições mais propensas a incêndios.",
  },
  xgb_frei: {
    title: "Pessoas em Risco por Inundação (XGBoost)",
    description: "Valor de pessoas em risco por inundação. Combina áreas propensas à inundação com população e área construída.",
  },
  xgb_drei: {
    title: "Pessoas em Risco por Seca (XGBoost)",
    description: "Valor de pessoas em risco por seca. Combina áreas propensas à seca com população e área construída.",
  },
  xgb_firei: {
    title: "Pessoas em Risco por Incêndio (XGBoost)",
    description: "Valor de pessoas em risco por incêndio. Combina áreas propensas a incêndio com população e área construída.",
  },
  ahp_fsi: {
    title: "Modelo Simples de Inundação",
    description: "Modelo ponderado simples de inundação usado para comparar com o mapa XGBoost.",
  },
  ahp_dsi: {
    title: "Modelo Simples de Seca",
    description: "Modelo ponderado simples de seca usado para comparar com o mapa XGBoost.",
  },
  ahp_fisi: {
    title: "Modelo Simples de Incêndio",
    description: "Modelo ponderado simples de incêndio usado para comparar com o mapa XGBoost.",
  },
  rx1day: {
    title: "Chuva Diária Extrema",
    description: "Valor médio anual do evento de chuva mais intenso em 1 dia. Usado como entrada do modelo de inundação.",
  },
  slope: {
    title: "Declividade",
    description: "Inclinação da superfície do terreno calculada a partir do mapa de elevação.",
  },
  dem: {
    title: "Elevação",
    description: "Altura do terreno acima do nível do mar.",
  },
  dtb: {
    title: "Profundidade até a Rocha",
    description: "Profundidade estimada entre a superfície do terreno e a rocha.",
  },
  distance_to_river: {
    title: "Distância até o Rio Mais Próximo",
    description: "Distância de cada célula do mapa até o rio mapeado mais próximo.",
  },
  soil: {
    title: "Classe de Textura do Solo",
    description: "Classe principal de textura do solo usada como entrada do modelo de inundação.",
  },
  impervious: {
    title: "Fração de Superfície Impermeável",
    description: "Fração do terreno coberta por superfícies rígidas, como ruas e edifícios.",
  },
  twi: {
    title: "Índice Topográfico de Umidade",
    description: "Valor de umidade potencial do terreno calculado a partir do mapa de elevação.",
  },
  avg_rain: {
    title: "Chuva Média Anual",
    description: "Chuva média anual usada como entrada do modelo de inundação.",
  },
  avg_sm: {
    title: "Umidade Média do Solo",
    description: "Umidade média do solo usada pelos modelos de perigo.",
  },
  pet_balance: {
    title: "Balanço de Evapotranspiração Potencial",
    description: "Balanço de demanda hídrica usado como entrada do modelo de seca.",
  },
  vci: {
    title: "Índice de Condição da Vegetação",
    description: "Valor de saúde da vegetação. Valores menores podem indicar estresse da vegetação.",
  },
  lst_day: {
    title: "Temperatura Diurna da Superfície",
    description: "Temperatura média diurna da superfície usada nos modelos de seca e incêndio.",
  },
  fire_probability: {
    title: "Probabilidade Média Anual de Incêndio",
    description: "Probabilidade média anual de incêndio usada no modelo de incêndio.",
  },
  population: {
    title: "Densidade Populacional",
    description: "Número de pessoas por área, usado nos mapas de pessoas em risco e nos valores urbanos.",
  },
  hmi: {
    title: "Índice de Modificação Humana",
    description: "Valor que indica quanto as atividades humanas modificaram a superfície do terreno.",
  },
  gdp: {
    title: "Intensidade do PIB",
    description: "Valor de atividade econômica usado no componente de capacidade urbana.",
  },
  hdi: {
    title: "Índice de Desenvolvimento Humano",
    description: "Valor de desenvolvimento humano usado no componente de capacidade urbana.",
  },
  permanent_water: {
    title: "Ocorrência de Água Permanente",
    description: "Máscara de áreas com água permanente. Usada para evitar tratar água permanente como perigo em terra.",
  },
  municipal_classes: {
    title: "Áreas de Classes Urbanas",
    description: "Áreas urbanas coloridas pelas quatro classes de perigo e capacidade usadas na ferramenta urbana.",
  },
  city_points: {
    title: "Pontos do Ranking de Cidades",
    description: "Pontos urbanos com valores de perigo, capacidade e prioridade usados no ranking de cidades.",
  },
};

const UNIT_TEXT_PT = {
  Probability: "Probabilidade",
  "Normalized index": "Índice normalizado",
  "Weighted score": "Valor ponderado",
  "mm day-1": "mm dia-1",
  Degrees: "Graus",
  Category: "Categoria",
  Fraction: "Fração",
  Index: "Índice",
  "mm year-1": "mm ano-1",
};

const LEGEND_LABEL_PT = {
  Sand: "Areia",
  "Loamy Sand": "Areia franca",
  "Sandy Loam": "Franco arenoso",
  Loam: "Franco",
  Silt: "Silte",
  "Silt Loam": "Franco siltoso",
  "Sandy Clay Loam": "Franco argiloarenoso",
  "Clay Loam": "Franco argiloso",
  "Silty Clay Loam": "Franco argilossiltoso",
  "Sandy Clay": "Argila arenosa",
  "Silty Clay": "Argila siltosa",
  Clay: "Argila",
};

const LANGUAGE_STORAGE_KEY = "riskAtlasLanguage";

const TEXT = {
  en: {
    htmlLang: "en",
    locale: "en-US",
    documentTitle: "MIRA | Multi-hazard Index for Risk Assessment",
    skip: "Skip to map and details",
    brandTitle: "MIRA",
    brandSubtitle: "Multi-hazard Index for Risk Assessment",
    nav: { atlas: "Atlas", urban: "City Priorities", methods: "Data & Methods" },
    topbar: {
      help: "How to use",
      controls: "Controls",
      details: "Details",
      hideControls: "Hide controls",
      hideDetails: "Hide details",
    },
    views: {
      atlas: {
        title: "Atlas",
        intro: "Choose one map, read the legend, and click a place to export pixel values.",
      },
      urban: {
        title: "City Priorities",
        intro: "Change weights, click a city, and export a city report.",
      },
      methods: {
        title: "Data & Methods",
        intro: "See data sources, model checks, and downloadable files.",
      },
    },
    welcome: {
      kicker: "Start here",
      back: "← Back",
      next: "Next →",
      enter: "Enter tool →",
      dots: ["Guide step 1", "Guide step 2", "Guide step 3", "Guide step 4"],
      steps: [
        {
          title: "MIRA",
          body: "MIRA links Earth data, hazard maps, socioeconomic context, and city priorities. This short guide shows the path before you use the full interface.",
          logo: "assets/brand/mira-logo-wide.png",
          logoAlt: "MIRA: Multi-hazard Index for Risk Assessment",
          sketch: ["Hazard maps", "People at risk", "City priorities"],
        },
        {
          title: "1. Start with Atlas",
          body: "Use the left panel to choose one map at a time. You can view hazard scores, people at risk, model inputs, socioeconomic layers, and city classes.",
          items: [
            "Use Country focus to zoom to a country.",
            "Use Choose layer to pick a map.",
            "Click the map to export values for that pixel.",
          ],
        },
        {
          title: "2. Read one map at a time",
          body: "The Atlas shows one layer at a time. Choose a map, read the legend, then click a place if you need a pixel report.",
        },
        {
          title: "3. Move to City Priorities",
          body: "Open City Priorities after exploring the map. Adjust the weights, click a city, and export a Word report if needed.",
          note: "Begin with the left panel. It controls the filters, weights, and map layers.",
        },
      ],
    },
    pills: {
      bundle: "Static atlas bundle",
      layers: "{count} atlas layers",
      cities: "{count} city points",
    },
    status: {
      loading: "Loading atlas",
      initializing: "Initializing layers...",
      layerLoaded: "{layer} loaded.",
      vectorLoaded: "{layer} loaded as vector overlay.",
      sampling: "Reading raster values at {lat}, {lon}...",
      sampled: "Read {count} raster layers at {lat}, {lon}.",
      pixelFailed: "Pixel sampling failed: {error}",
      urban: "{shown} priority cities shown from {total} filtered cities with {classes}.",
      liveClasses: "live city-area classes",
      noClasses: "no city-area classes",
      cityPriorities: "City priorities",
    },
    common: {
      allSouthAmerica: "All South America",
      allStates: "All states",
      na: "NA",
      download: "download",
      layer: "Layer",
      value: "Value",
      units: "Units",
      note: "Note",
      mean: "Mean",
      std: "Std.",
      pixels: "Pixels",
      generated: "Generated",
      latitude: "Latitude",
      longitude: "Longitude",
      sampledRasters: "Sampled rasters",
      priority: "Priority",
      hazard: "Hazard",
      capacityNeed: "Capacity need",
      population: "Population",
      populationClass: "Population class",
      cityDetail: "City detail",
      noCitySelected: "No city selected",
      selectCity: "Adjust the filters or select a city from the priority list.",
    },
    atlas: {
      controls: "Atlas controls",
      rasterLayers: "{count} raster layers",
      countryFocus: "Country focus",
      backgroundMap: "Background map",
      light: "Light",
      street: "Street",
      chooseLayer: "Choose layer",
      opacity: "Active layer opacity",
      note: "Choose one layer at a time. Use opacity and overlays only to make the map easier to read.",
      countryBorders: "Country borders",
      cityPoints: "City points overlay",
      hazardVulnerability: "Hazard-Vulnerability Layer",
      reset: "Reset South America view",
      send: "Send to city priorities",
      walkthrough: "Need the guide again? Use the How to use button in the top bar.",
      activeLayer: "Active layer",
      legend: "Legend",
      downloadLayer: "Download layer",
      metadata: "Metadata",
      layerId: "Layer id",
      publishedSource: "Published source",
      displayRange: "Display range",
      median: "Median",
      nextStep: "Next step",
      nextStepBody: "Use this map as context, then open City Priorities with the same country selected.",
      openUrban: "Open City Priorities",
      pixelInspection: "Pixel inspection",
      pixelVector: "Choose a raster map to click a cell and get values.",
      pixelLoading: "Reading all raster maps at the clicked cell. This may take a few seconds the first time.",
      pixelReady: "Click any raster cell on the map to get values from all raster maps at that place. Then you can save a Word report.",
      exportPixelWord: "Export pixel Word report",
    },
    urban: {
      introTitle: "Explore city priorities",
      intro: "Move the weights to update city priorities and the colored city-area classes. Click a city to inspect it and export a Word report.",
      enteredFrom: "Entered from {hazard}{country}.",
      atlasContext: "atlas context",
      filters: "Filters and weights",
      visibleCount: "Top {shown} of {total}",
      defaultView: "Default view: top 1,000 cities by priority. Weight changes update the map and priority list immediately.",
      country: "Country",
      state: "State or province",
      populationClass: "Population class",
      cityLimit: "Cities shown",
      searchCity: "Search city",
      searchPlaceholder: "Type a city, state, or country, then press Enter...",
      balance: "Priority balance: hazard versus capacity need",
      advanced: "Hazard and capacity weights",
      weightsNote: "These weights update the priority score and the colored city-area classes.",
      flood: "Flood weight (priority + classes)",
      drought: "Drought weight (priority + classes)",
      wildfire: "Wildfire weight (priority + classes)",
      gdp: "GDP weight (priority + classes)",
      hdi: "HDI weight (priority + classes)",
      reset: "Reset paper defaults",
      showClasses: "Show city-area classes",
      classesNote: "Classes are recalculated from the current flood, drought, wildfire, GDP, and HDI weights.",
      zoomCountry: "Zoom to country",
      exportCsv: "Export filtered CSV",
      topCities: "Top priority cities",
      clickTooltip: "Click to select this city",
      why: "Why this city scores this way",
      sourceLayers: "Show source layers",
      rasterValues: "City raster values",
      exportCityCsv: "Export city CSV",
      exportCityWord: "Export city Word report",
      cityDetails: "City details",
      priorityChart: "Selected Cities Prioritization Chart",
      priorityChartSubtitle: "Live k-means regions",
      priorityChartNote: "Dots show all cities in the current list. City names appear only when fewer than 50 cities are selected. Click any dot to select that city.",
      priorityChartEmpty: "No cities are available for the current filters.",
      priorityChartXAxis: "Composite hazard score",
      priorityChartYAxis: "Socioeconomic score",
      mainHazard: "Main hazard",
      paperClass: "Paper class",
      liveClass: "Live class",
      liveHazard: "Live hazard score",
      liveSocio: "Live social and economic score",
      builtUp: "Built-up land share",
      gdpClass: "GDP class",
      hdiClass: "HDI class",
      normalizedValue: "Normalized value",
    },
    classLabels: {
      "High Socio / Low Hazard": "High Socio / Low Hazard",
      "High Socio / High Hazard": "High Socio / High Hazard",
      "Low Socio / Low Hazard": "Low Socio / Low Hazard",
      "Low Socio / High Hazard": "Low Socio / High Hazard",
    },
  },
  pt: {
    htmlLang: "pt-BR",
    locale: "pt-BR",
    documentTitle: "MIRA | Multi-hazard Index for Risk Assessment",
    skip: "Pular para mapa e detalhes",
    brandTitle: "MIRA",
    brandSubtitle: "Multi-hazard Index for Risk Assessment",
    nav: { atlas: "Atlas", urban: "Prioridades Urbanas", methods: "Dados e Métodos" },
    topbar: {
      help: "Como usar",
      controls: "Controles",
      details: "Detalhes",
      hideControls: "Ocultar controles",
      hideDetails: "Ocultar detalhes",
    },
    views: {
      atlas: {
        title: "Atlas",
        intro: "Escolha um mapa, leia a legenda e clique em um ponto para exportar os valores do pixel.",
      },
      urban: {
        title: "Prioridades Urbanas",
        intro: "Ajuste os pesos, clique em uma cidade e exporte um relatório.",
      },
      methods: {
        title: "Dados e Métodos",
        intro: "Veja fontes de dados, testes do modelo e arquivos disponíveis para download.",
      },
    },
    welcome: {
      kicker: "Comece aqui",
      back: "← Voltar",
      next: "Próximo →",
      enter: "Entrar na ferramenta →",
      dots: ["Etapa 1 do guia", "Etapa 2 do guia", "Etapa 3 do guia", "Etapa 4 do guia"],
      steps: [
        {
          title: "MIRA",
          body: "O MIRA conecta dados da Terra, mapas de perigo, contexto socioeconômico e prioridades urbanas. Este guia curto mostra o caminho antes da interface completa.",
          logo: "assets/brand/mira-logo-wide.png",
          logoAlt: "MIRA: Multi-hazard Index for Risk Assessment",
          sketch: ["Mapas de perigo", "Pessoas em risco", "Prioridades urbanas"],
        },
        {
          title: "1. Comece pelo Atlas",
          body: "Use o painel esquerdo para escolher um mapa por vez. Você pode ver perigos, pessoas em risco, entradas do modelo, camadas socioeconômicas e classes urbanas.",
          items: [
            "Use Foco no país para aproximar um país.",
            "Use Escolher camada para selecionar um mapa.",
            "Clique no mapa para exportar os valores daquele pixel.",
          ],
        },
        {
          title: "2. Leia um mapa por vez",
          body: "O Atlas mostra uma camada por vez. Escolha um mapa, leia a legenda e clique em um ponto se precisar de um relatório do pixel.",
        },
        {
          title: "3. Vá para Prioridades Urbanas",
          body: "Abra Prioridades Urbanas depois de explorar o mapa. Ajuste os pesos, clique em uma cidade e exporte um relatório Word se precisar.",
          note: "Comece pelo painel esquerdo. Ele controla filtros, pesos e camadas do mapa.",
        },
      ],
    },
    pills: {
      bundle: "Pacote estático do atlas",
      layers: "{count} camadas do atlas",
      cities: "{count} pontos urbanos",
    },
    status: {
      loading: "Carregando atlas",
      initializing: "Inicializando camadas...",
      layerLoaded: "{layer} carregada.",
      vectorLoaded: "{layer} carregada como camada vetorial.",
      sampling: "Lendo valores dos rasters em {lat}, {lon}...",
      sampled: "{count} camadas raster lidas em {lat}, {lon}.",
      pixelFailed: "Falha ao amostrar o pixel: {error}",
      urban: "{shown} cidades prioritárias mostradas entre {total} cidades filtradas com {classes}.",
      liveClasses: "classes urbanas dinâmicas",
      noClasses: "sem classes urbanas",
      cityPriorities: "Prioridades urbanas",
    },
    common: {
      allSouthAmerica: "Toda a América do Sul",
      allStates: "Todos os estados",
      na: "NA",
      download: "download",
      layer: "Camada",
      value: "Valor",
      units: "Unidades",
      note: "Nota",
      mean: "Média",
      std: "Desv.",
      pixels: "Pixels",
      generated: "Gerado",
      latitude: "Latitude",
      longitude: "Longitude",
      sampledRasters: "Rasters amostrados",
      priority: "Prioridade",
      hazard: "Perigo",
      capacityNeed: "Necessidade de capacidade",
      population: "População",
      populationClass: "Classe populacional",
      cityDetail: "Detalhe da cidade",
      noCitySelected: "Nenhuma cidade selecionada",
      selectCity: "Ajuste os filtros ou selecione uma cidade na lista de prioridades.",
    },
    atlas: {
      controls: "Controles do Atlas",
      rasterLayers: "{count} camadas raster",
      countryFocus: "Foco no país",
      backgroundMap: "Mapa de fundo",
      light: "Claro",
      street: "Ruas",
      chooseLayer: "Escolher camada",
      opacity: "Opacidade da camada ativa",
      note: "Escolha uma camada por vez. Use opacidade e sobreposições apenas para facilitar a leitura do mapa.",
      countryBorders: "Fronteiras dos países",
      cityPoints: "Pontos das cidades",
      hazardVulnerability: "Camada Perigo-Vulnerabilidade",
      reset: "Voltar para América do Sul",
      send: "Enviar para prioridades urbanas",
      walkthrough: "Precisa ver o guia de novo? Use o botão Como usar na barra superior.",
      activeLayer: "Camada ativa",
      legend: "Legenda",
      downloadLayer: "Baixar camada",
      metadata: "Metadados",
      layerId: "ID da camada",
      publishedSource: "Fonte publicada",
      displayRange: "Intervalo exibido",
      median: "Mediana",
      nextStep: "Próximo passo",
      nextStepBody: "Use este mapa como contexto e abra Prioridades Urbanas com o mesmo país selecionado.",
      openUrban: "Abrir Prioridades Urbanas",
      pixelInspection: "Inspeção do pixel",
      pixelVector: "Escolha um mapa raster para clicar em uma célula e obter valores.",
      pixelLoading: "Lendo todos os rasters no pixel clicado. Na primeira vez, isso pode levar alguns segundos.",
      pixelReady: "Clique em qualquer célula raster do mapa para obter os valores de todos os rasters naquele ponto. Depois você pode salvar um relatório Word.",
      exportPixelWord: "Exportar relatório Word do pixel",
    },
    urban: {
      introTitle: "Explore prioridades urbanas",
      intro: "Mova os pesos para atualizar as prioridades das cidades e as classes urbanas coloridas. Clique em uma cidade para ver detalhes e exportar um relatório Word.",
      enteredFrom: "Entrada a partir de {hazard}{country}.",
      atlasContext: "contexto do atlas",
      filters: "Filtros e pesos",
      visibleCount: "Top {shown} de {total}",
      defaultView: "Visualização padrão: 1.000 cidades com maior prioridade. Mudanças nos pesos atualizam o mapa e a lista imediatamente.",
      country: "País",
      state: "Estado ou província",
      populationClass: "Classe populacional",
      cityLimit: "Cidades mostradas",
      searchCity: "Buscar cidade",
      searchPlaceholder: "Digite uma cidade, estado ou país e pressione Enter...",
      balance: "Peso da prioridade: perigo versus necessidade de capacidade",
      advanced: "Pesos de perigo e capacidade",
      weightsNote: "Estes pesos atualizam a prioridade e as classes urbanas coloridas.",
      flood: "Peso de inundação (prioridade + classes)",
      drought: "Peso de seca (prioridade + classes)",
      wildfire: "Peso de incêndio (prioridade + classes)",
      gdp: "Peso do PIB (prioridade + classes)",
      hdi: "Peso do IDH (prioridade + classes)",
      reset: "Restaurar pesos do artigo",
      showClasses: "Mostrar classes urbanas",
      classesNote: "As classes são recalculadas com os pesos atuais de inundação, seca, incêndio, PIB e IDH.",
      zoomCountry: "Aproximar país",
      exportCsv: "Exportar CSV filtrado",
      topCities: "Cidades com maior prioridade",
      clickTooltip: "Clique para selecionar esta cidade",
      why: "Por que esta cidade tem este valor",
      sourceLayers: "Mostrar camadas de origem",
      rasterValues: "Valores raster da cidade",
      exportCityCsv: "Exportar CSV da cidade",
      exportCityWord: "Exportar relatório Word da cidade",
      cityDetails: "Detalhes da cidade",
      priorityChart: "Gráfico de priorização das cidades selecionadas",
      priorityChartSubtitle: "Regiões k-means dinâmicas",
      priorityChartNote: "Os pontos mostram todas as cidades da lista atual. Os nomes aparecem somente quando menos de 50 cidades estão selecionadas. Clique em qualquer ponto para selecionar a cidade.",
      priorityChartEmpty: "Nenhuma cidade está disponível para os filtros atuais.",
      priorityChartXAxis: "Valor composto de perigo",
      priorityChartYAxis: "Valor socioeconômico",
      mainHazard: "Perigo principal",
      paperClass: "Classe do artigo",
      liveClass: "Classe dinâmica",
      liveHazard: "Valor dinâmico de perigo",
      liveSocio: "Valor socioeconômico dinâmico",
      builtUp: "Fração de área construída",
      gdpClass: "Classe de PIB",
      hdiClass: "Classe de IDH",
      normalizedValue: "Valor normalizado",
    },
    classLabels: {
      "High Socio / Low Hazard": "Alta condição socioeconômica / baixo perigo",
      "High Socio / High Hazard": "Alta condição socioeconômica / alto perigo",
      "Low Socio / Low Hazard": "Baixa condição socioeconômica / baixo perigo",
      "Low Socio / High Hazard": "Baixa condição socioeconômica / alto perigo",
    },
  },
};

const POP_GROUP_OPTIONS = [
  { value: "all", label: "All population classes" },
  { value: "Pop > 1M", label: "Pop > 1M" },
  { value: "Pop 500k-1M", label: "Pop 500k-1M" },
  { value: "Pop 250k-500k", label: "Pop 250k-500k" },
  { value: "Pop 100k-250k", label: "Pop 100k-250k" },
  { value: "Pop < 100k", label: "Pop < 100k" },
];

const TOP_N_OPTIONS = [100, 250, 500, 1000, 2000, 3000, "all"];

function normalizeLanguage(value) {
  return value === "pt" ? "pt" : "en";
}

function loadSavedLanguage() {
  try {
    return normalizeLanguage(window.localStorage?.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return "en";
  }
}

function t(path, params = {}, fallback = "") {
  const lang = TEXT[state?.language || "en"] || TEXT.en;
  const value = path.split(".").reduce((current, key) => current?.[key], lang);
  const template = typeof value === "string" ? value : fallback || path;
  return template.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");
}

function currentLocale() {
  return t("locale", {}, "en-US");
}

function classLabel(label) {
  return TEXT[state.language]?.classLabels?.[label] || label;
}

function groupTitle(group) {
  if (!group) return "";
  return state.language === "pt" ? GROUP_TITLE_PT[group.id] || group.title : group.title;
}

function layerTitle(layer) {
  return state.language === "pt" ? LAYER_TEXT_PT[layer.id]?.title || layer.title : layer.title;
}

function layerDescription(layer) {
  return state.language === "pt" ? LAYER_TEXT_PT[layer.id]?.description || layer.description : layer.description;
}

function layerUnits(layer) {
  if (state.language !== "pt") return layer.units;
  return UNIT_TEXT_PT[layer.units] || layer.units;
}

function legendItemLabel(label) {
  if (!label) return "";
  if (TEXT[state.language]?.classLabels?.[label]) return classLabel(label);
  return state.language === "pt" ? LEGEND_LABEL_PT[label] || label : label;
}

function pixelLegendLabel(layer, value) {
  if (!layer?.legend_items?.length || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return layer.legend_items.find((item) => Number(item.value) === rounded)?.label || null;
}

function pixelDisplayValue(row) {
  if (row?.value === null || row?.value === undefined || Number.isNaN(row.value)) return t("common.na");
  const layer = state.layerById.get(row.id);
  const label = pixelLegendLabel(layer, Number(row.value));
  if (label) return `${Math.round(Number(row.value))} (${legendItemLabel(label)})`;
  if (Number.isInteger(Number(row.value))) return Number(row.value).toLocaleString(currentLocale());
  return Number(row.value).toLocaleString(currentLocale(), {
    maximumFractionDigits: Math.abs(Number(row.value)) >= 1000 ? 2 : 4,
    minimumFractionDigits: 0,
  });
}

function pixelPositionLabel(row) {
  if (row?.row == null || row?.col == null) return t("common.na");
  return state.language === "pt" ? `linha ${row.row}, coluna ${row.col}` : `row ${row.row}, col ${row.col}`;
}

function translatePixelNote(note) {
  if (!note) return "";
  if (state.language !== "pt") return note;
  if (note === "Coordinate outside raster extent") return "Coordenada fora da extensão do raster";
  if (note === "No data at clicked pixel") return "Sem dado no pixel clicado";
  if (note.startsWith("Sampling error:")) {
    const detail = note.replace(/^Sampling error:\s*/, "");
    if (/Failed to fetch|URL scheme|GeoTIFF reader/i.test(detail)) {
      return "Erro de amostragem: não foi possível ler o arquivo raster. Recarregue o site pelo servidor local ou pela versão publicada.";
    }
    return `Erro de amostragem: ${detail}`;
  }
  return note;
}

function localizedPixelRows(report) {
  return (report?.values || []).map((row) => {
    const layer = state.layerById.get(row.id);
    return {
      layer: layer ? layerTitle(layer) : row.title || row.id || t("common.na"),
      value: pixelDisplayValue(row),
      units: layer ? layerUnits(layer) || t("common.na") : row.units || t("common.na"),
      pixel: pixelPositionLabel(row),
      description: layer ? layerDescription(layer) : row.description || t("common.na"),
      note: translatePixelNote(row.note),
      raw: row,
    };
  });
}

function localizedPixelReport(report) {
  return {
    ...report,
    values: (report?.values || []).map((row) => {
      const localized = localizedPixelRows({ values: [row] })[0];
      return {
        ...row,
        title: localized.layer,
        displayValue: localized.value,
        units: localized.units,
        description: localized.description,
        note: localized.note,
        pixelLabel: localized.pixel,
      };
    }),
  };
}

function hazardName(label) {
  if (state.language !== "pt") return label || "";
  return {
    Flood: "inundação",
    Drought: "seca",
    Wildfire: "incêndio",
  }[label] || label || "";
}

function populationOptionLabel(option) {
  if (state.language !== "pt") return option.label;
  if (option.value === "all") return "Todas as classes populacionais";
  return option.label.replace(/^Pop/, "Pop.");
}

function topNOptionLabel(option) {
  if (option === "all") return state.language === "pt" ? "Todas" : "All";
  return fmtInteger(option);
}

function normalizeTopN(value, fallback = 1000) {
  const stringValue = String(value ?? fallback);
  if (!TOP_N_OPTIONS.map(String).includes(stringValue)) return fallback;
  return stringValue === "all" ? "all" : Number(stringValue);
}

const state = {
  config: null,
  catalog: [],
  layerById: new Map(),
  benchmarkSummary: null,
  language: loadSavedLanguage(),
  activeView: "atlas",
  activePresetId: null,
  share: {
    restored: false,
    status: "",
  },
  atlas: {
    activeLayerId: "xgb_fsi",
    opacity: 0.92,
    country: "all",
    showCountries: true,
    showCities: false,
    showMunicipal: false,
    baseMap: "light",
    pixelError: "",
    pixelLoading: false,
    pixelReport: null,
  },
  urban: {
    country: "all",
    state: "all",
    popGroup: "all",
    rankBy: "priority",
    topN: 1000,
    search: "",
    showMunicipal: true,
    municipalMode: "dynamic",
    selectedCityId: null,
    weights: {
      hazardWeight: 0.6,
      hazardComponents: { flood: 0.55, drought: 0.35, wildfire: 0.1 },
      adaptiveCapacity: { gdp: 0.4, hdi: 0.6 },
    },
    atlasContext: null,
  },
  datasets: {
    countries: null,
    cityPoints: null,
    municipalClasses: null,
    cityRasterValues: null,
  },
  urbanResults: {
    ranked: [],
    filteredCount: 0,
    thresholds: null,
  },
  urbanDynamic: {
    byId: new Map(),
    counts: {},
    centroids: [],
  },
  map: {
    instance: null,
    baseLayers: {},
    primaryLayer: null,
    countriesLayer: null,
    atlasCityLayer: null,
    atlasMunicipalLayer: null,
    urbanCityLayer: null,
    urbanMunicipalLayer: null,
    selectedCityHighlight: null,
    pixelMarker: null,
  },
  welcome: {
    step: 0,
    totalSteps: 4,
  },
};

const dom = {};

export async function createApp() {
  bindDom();
  initWelcomeGuide();
  await loadData();
  initMap();
  await render();
}

function bindDom() {
  dom.body = document.body;
  dom.skipLink = $(".skip-link");
  dom.brandTitle = $(".brand-copy strong");
  dom.brandSubtitle = $(".brand-copy small");
  dom.viewTitle = $("#viewTitle");
  dom.viewIntro = $("#viewIntro");
  dom.viewPills = $("#viewPills");
  dom.heroCard = $(".hero-card");
  dom.mainShell = $("#mainShell");
  dom.sidebarBody = $("#sidebarBody");
  dom.detailBody = $("#detailBody");
  dom.methodsView = $("#methodsView");
  dom.methodsBody = $("#methodsBody");
  dom.methodsHeroEyebrow = $(".methods-hero .eyebrow");
  dom.methodsHeroTitle = $(".methods-hero h2");
  dom.methodsHeroIntro = $(".methods-hero p");
  dom.navButtons = $$("[data-view]");
  dom.languageButtons = $$("[data-language]");
  dom.map = $("#map");
  dom.mapStatus = $("#mapStatus");
  dom.legendChip = $("#legendChip");
  dom.helpButton = $("#helpButton");
  dom.welcomeKicker = $(".welcome-kicker");
  dom.welcomeModal = $("#welcomeModal");
  dom.welcomeBack = $("#welcomeBack");
  dom.welcomeNext = $("#welcomeNext");
  dom.welcomeDots = $$("[data-welcome-step]");
  dom.welcomeSteps = $$(".welcome-step");
  dom.mobileSidebarButton = $("#mobileSidebarButton");
  dom.mobileDetailButton = $("#mobileDetailButton");
  dom.sidebar = $("#leftSidebar");
  dom.detail = $("#detailPanel");

  dom.navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.activeView = button.dataset.view;
      void render();
    });
  });

  dom.languageButtons.forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.language));
  });

  dom.helpButton.addEventListener("click", openWelcomeGuide);

  dom.mobileSidebarButton.addEventListener("click", () => {
    toggleMobilePanel("sidebar");
  });
  dom.mobileDetailButton.addEventListener("click", () => {
    toggleMobilePanel("detail");
  });
  window.addEventListener("resize", updateMobilePanelButtons);
  applyStaticTranslations();
}

function setLanguage(language) {
  const next = normalizeLanguage(language);
  if (state.language === next) return;
  state.language = next;
  try {
    window.localStorage?.setItem(LANGUAGE_STORAGE_KEY, next);
  } catch {
    // Local storage can be unavailable in strict browser settings.
  }
  applyStaticTranslations();
  void render();
}

function applyStaticTranslations() {
  document.documentElement.lang = t("htmlLang", {}, "en");
  document.title = t("documentTitle");
  if (dom.skipLink) dom.skipLink.textContent = t("skip");
  if (dom.brandTitle) dom.brandTitle.textContent = t("brandTitle");
  if (dom.brandSubtitle) dom.brandSubtitle.textContent = t("brandSubtitle");
  dom.navButtons?.forEach((button) => {
    button.textContent = t(`nav.${button.dataset.view}`);
  });
  dom.languageButtons?.forEach((button) => {
    const active = button.dataset.language === state.language;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (dom.helpButton) dom.helpButton.textContent = t("topbar.help");
  if (dom.methodsHeroEyebrow) dom.methodsHeroEyebrow.textContent = state.language === "pt" ? "Notas de dados" : "Data notes";
  if (dom.methodsHeroTitle) dom.methodsHeroTitle.textContent = t("nav.methods");
  if (dom.methodsHeroIntro) {
    dom.methodsHeroIntro.textContent =
      state.language === "pt"
        ? "Esta página explica os dados, os testes do modelo e os arquivos que você pode baixar."
        : "This page explains the data, model checks, and files you can download from the site.";
  }
  if (!state.config) {
    if (dom.legendChip) dom.legendChip.textContent = t("status.loading");
    if (dom.mapStatus) dom.mapStatus.textContent = t("status.initializing");
  }
  renderWelcomeCopy();
  updateMobilePanelButtons();
}

function renderWelcomeCopy() {
  if (!dom.welcomeSteps?.length) return;
  const welcome = TEXT[state.language].welcome;
  dom.welcomeKicker.textContent = welcome.kicker;
  dom.welcomeSteps.forEach((panel, index) => {
    const step = welcome.steps[index];
    if (!step) return;
    const sketch = step.sketch
      ? `<div class="welcome-map-sketch" aria-hidden="true">${step.sketch.map((label) => `<span>${label}</span>`).join("")}</div>`
      : "";
    const logo = step.logo ? `<img class="welcome-logo" src="${step.logo}" alt="${step.logoAlt || step.title}" />` : "";
    const items = step.items
      ? `<ul>${step.items.map((item) => `<li>${item}</li>`).join("")}</ul>`
      : "";
    const note = step.note ? `<p>${step.note}</p>` : "";
    panel.innerHTML = `${logo}<h2${index === 0 ? ' id="welcomeTitle"' : ""}>${step.title}</h2><p>${step.body}</p>${items}${note}${sketch}`;
  });
  dom.welcomeDots.forEach((dot, index) => {
    dot.setAttribute("aria-label", welcome.dots[index] || `Guide step ${index + 1}`);
  });
  if (dom.welcomeBack) dom.welcomeBack.textContent = welcome.back;
  setWelcomeStep(state.welcome.step);
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function toggleMobilePanel(panel) {
  const target = panel === "sidebar" ? dom.sidebar : dom.detail;
  const other = panel === "sidebar" ? dom.detail : dom.sidebar;
  const willOpen = !target.classList.contains("panel-open");

  target.classList.toggle("panel-open", willOpen);
  if (isMobileLayout() && willOpen) other.classList.remove("panel-open");
  updateMobilePanelButtons();

  if (isMobileLayout() && willOpen) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => state.map.instance?.invalidateSize(), 180);
  }
}

function openMobilePanel(panel) {
  const target = panel === "sidebar" ? dom.sidebar : dom.detail;
  const other = panel === "sidebar" ? dom.detail : dom.sidebar;
  target.classList.add("panel-open");
  if (isMobileLayout()) other.classList.remove("panel-open");
  updateMobilePanelButtons();
}

function updateMobilePanelButtons() {
  const panelsAvailable = state.activeView !== "methods";
  const controlsOpen = dom.sidebar.classList.contains("panel-open");
  const detailsOpen = dom.detail.classList.contains("panel-open");
  dom.mobileSidebarButton.disabled = !panelsAvailable;
  dom.mobileDetailButton.disabled = !panelsAvailable;
  dom.mobileSidebarButton.classList.toggle("active", controlsOpen);
  dom.mobileDetailButton.classList.toggle("active", detailsOpen);
  dom.mobileSidebarButton.setAttribute("aria-expanded", String(controlsOpen));
  dom.mobileDetailButton.setAttribute("aria-expanded", String(detailsOpen));
  dom.mobileSidebarButton.textContent =
    controlsOpen && isMobileLayout() ? t("topbar.hideControls") : t("topbar.controls");
  dom.mobileDetailButton.textContent =
    detailsOpen && isMobileLayout() ? t("topbar.hideDetails") : t("topbar.details");
}

function initWelcomeGuide() {
  dom.welcomeBack.addEventListener("click", () => setWelcomeStep(state.welcome.step - 1));
  dom.welcomeNext.addEventListener("click", () => {
    if (state.welcome.step === state.welcome.totalSteps - 1) closeWelcomeGuide();
    else setWelcomeStep(state.welcome.step + 1);
  });
  dom.welcomeDots.forEach((dot) => {
    dot.addEventListener("click", () => setWelcomeStep(Number(dot.dataset.welcomeStep)));
  });
  document.addEventListener("keydown", (event) => {
    if (dom.welcomeModal.classList.contains("is-hidden")) return;
    if (event.key === "ArrowLeft") setWelcomeStep(state.welcome.step - 1);
    if (event.key === "ArrowRight") {
      if (state.welcome.step === state.welcome.totalSteps - 1) closeWelcomeGuide();
      else setWelcomeStep(state.welcome.step + 1);
    }
  });
  openWelcomeGuide();
}

function setWelcomeStep(step) {
  state.welcome.step = Math.max(0, Math.min(state.welcome.totalSteps - 1, step));
  dom.welcomeSteps.forEach((panel, index) => {
    panel.hidden = index !== state.welcome.step;
  });
  dom.welcomeDots.forEach((dot, index) => {
    dot.classList.toggle("active", index === state.welcome.step);
  });
  dom.welcomeBack.disabled = state.welcome.step === 0;
  dom.welcomeBack.textContent = t("welcome.back");
  dom.welcomeNext.textContent =
    state.welcome.step === state.welcome.totalSteps - 1 ? t("welcome.enter") : t("welcome.next");
}

function openWelcomeGuide() {
  dom.welcomeModal.classList.remove("is-hidden");
  document.body.classList.add("welcome-open");
  setWelcomeStep(0);
}

function closeWelcomeGuide() {
  dom.welcomeModal.classList.add("is-hidden");
  document.body.classList.remove("welcome-open");
  openMobilePanel("sidebar");
  dom.sidebar?.focus?.();
}

async function loadData() {
  const [config, catalog, benchmarkSummary] = await Promise.all([
    fetchJson("./data/app-config.json"),
    fetchJson("./data/catalog.json"),
    fetchJson("./data/benchmarks/summary.json"),
  ]);
  state.config = config;
  state.catalog = catalog;
  state.layerById = new Map(catalog.map((layer) => [layer.id, layer]));
  state.benchmarkSummary = benchmarkSummary;
  state.activeView = config.default_view;
  state.atlas.activeLayerId = config.default_layer;
  state.urban.weights = {
    hazardWeight: config.weights.hazard_weight,
    hazardComponents: { ...config.weights.hazard_components },
    adaptiveCapacity: { ...config.weights.adaptive_capacity },
  };
  restoreScenarioFromUrl();
}

function initMap() {
  const map = L.map(dom.map, {
    zoomControl: true,
    minZoom: 3,
    worldCopyJump: false,
    preferCanvas: true,
  }).setView([-18, -60], 4);

  map.createPane("primaryPane");
  map.createPane("countriesPane");
  map.createPane("atlasMunicipalPane");
  map.createPane("atlasCitiesPane");
  map.createPane("urbanMunicipalPane");
  map.createPane("urbanCitiesPane");
  map.createPane("highlightPane");
  map.createPane("pixelPane");

  map.getPane("primaryPane").style.zIndex = 420;
  map.getPane("countriesPane").style.zIndex = 500;
  map.getPane("atlasMunicipalPane").style.zIndex = 520;
  map.getPane("atlasCitiesPane").style.zIndex = 530;
  map.getPane("urbanMunicipalPane").style.zIndex = 540;
  map.getPane("urbanCitiesPane").style.zIndex = 550;
  map.getPane("highlightPane").style.zIndex = 600;
  map.getPane("pixelPane").style.zIndex = 610;

  state.map.baseLayers = {
    light: L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 19,
    }),
    street: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }),
  };
  state.map.baseLayers.light.addTo(map);
  state.map.instance = map;
  map.on("click", handleMapClick);
}

async function handleMapClick(event) {
  if (state.activeView === "urban") {
    await handleUrbanCityMapClick(event);
    return;
  }
  await handleAtlasPixelClick(event);
}

async function render() {
  dom.viewTitle.textContent = t(`views.${state.activeView}.title`);
  dom.viewIntro.textContent = t(`views.${state.activeView}.intro`);
  renderViewPills();

  dom.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.activeView);
  });
  dom.heroCard.hidden = state.activeView === "atlas";

  if (state.activeView === "methods") {
    dom.sidebar.hidden = true;
    dom.mainShell.hidden = true;
    dom.methodsView.hidden = false;
    renderMethodsView();
    updateMobilePanelButtons();
    return;
  }

  dom.sidebar.hidden = false;
  dom.mainShell.hidden = false;
  dom.methodsView.hidden = true;

  if (state.activeView === "atlas") {
    renderAtlasSidebar();
    renderAtlasDetail();
    await renderAtlasMap();
  } else {
    await computeUrbanResults();
    await renderUrbanSidebar();
    await renderUrbanMap();
    await renderUrbanDetail();
  }

  setTimeout(() => state.map.instance.invalidateSize(), 30);
  updateMobilePanelButtons();
}

async function runWordExport(button, buildReport) {
  const originalText = button.dataset.originalText || button.textContent;
  button.dataset.originalText = originalText;
  button.disabled = true;
  button.textContent = state.language === "pt" ? "Preparando relatório Word..." : "Preparing Word report...";

  try {
    await buildReport();
    button.textContent = state.language === "pt" ? "Relatório Word exportado" : "Word report exported";
    setTimeout(() => {
      button.textContent = originalText;
    }, 1800);
  } catch (error) {
    button.textContent = state.language === "pt" ? "Falha no relatório. Tente de novo." : "Report failed. Try again.";
    console.error(error);
    throw error;
  } finally {
    button.disabled = false;
  }
}

function renderViewPills() {
  clearChildren(dom.viewPills);
  [
    t("pills.bundle"),
    t("pills.layers", { count: atlasVisibleLayers().length }),
    t("pills.cities", { count: state.config.city_meta.city_count.toLocaleString(currentLocale()) }),
  ].forEach((label) => {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = label;
    dom.viewPills.appendChild(pill);
  });
}

function groupLayers() {
  return state.config.groups.map((group) => ({
    ...group,
    layers: atlasVisibleLayers().filter((layer) => layer.groups.includes(group.id)),
  }));
}

function isBenchmarkLayer(layer) {
  return (layer.groups || []).includes("benchmark_comparison") || /^ahp_/.test(layer.id);
}

function atlasVisibleLayers() {
  return state.catalog.filter((layer) => !isBenchmarkLayer(layer));
}

function activeLayer() {
  return state.layerById.get(state.atlas.activeLayerId);
}

function guideStep(number, title, body, status = "next") {
  const statusLabel =
    status === "done"
      ? state.language === "pt" ? "Feito" : "Done"
      : status === "active"
        ? state.language === "pt" ? "Agora" : "Now"
        : state.language === "pt" ? "Depois" : "Next";
  return `
    <li class="guide-step ${status}">
      <span class="guide-number">${number}</span>
      <div>
        <strong>${title}</strong>
        <p>${body}</p>
      </div>
      <em>${statusLabel}</em>
    </li>
  `;
}

function guideAction(id, label, variant = "secondary") {
  return `<button class="${variant === "primary" ? "download-button" : "toolbar-button"} guide-action" id="${id}">${label}</button>`;
}

function renderMethodsGuideCard() {
  const copy = state.language === "pt"
    ? {
        eyebrow: "Como usar o atlas",
        title: "Como ler o site",
        steps: [
          ["Comece pelos testes do modelo", "Use os cartões de teste para ver como o XGBoost se compara ao modelo ponderado simples.", "active"],
          ["Abra o mapa", "Use o Atlas para ver mapas de perigo, pessoas em risco, entradas e contexto para o mesmo lugar.", "next"],
          ["Vá para cidades", "Use Prioridades Urbanas para ajustar pesos, examinar prioridades e exportar relatórios.", "next"],
          ["Salve o que precisar", "Baixe mapas, tabelas de cidades, relatórios de pixel ou relatórios Word.", "next"],
        ],
        atlas: "Abrir Atlas",
        urban: "Abrir prioridades urbanas",
      }
    : {
        eyebrow: "How to use the atlas",
        title: "How to read the site",
        steps: [
          ["Start with model checks", "Use the model check cards to see how XGBoost compares with the simple weighted model.", "active"],
          ["Open the map", "Use Atlas to inspect hazard maps, people-at-risk maps, input maps, and context maps for the same place.", "next"],
          ["Move to cities", "Use City Priorities to adjust weights, inspect priorities, and export city reports.", "next"],
          ["Save what you need", "Download map files, city tables, pixel reports, or city Word reports.", "next"],
        ],
        atlas: "Open Atlas",
        urban: "Open city priorities",
      };
  return `
    <section class="guide-card methods-guide">
      <div class="guide-head">
        <span class="eyebrow">${copy.eyebrow}</span>
        <strong>${copy.title}</strong>
      </div>
      <ol class="guide-list">
        ${copy.steps.map((step, index) => guideStep(index + 1, step[0], step[1], step[2])).join("")}
      </ol>
      <div class="guide-actions">
        ${guideAction("guideMethodsAtlas", copy.atlas, "primary")}
        ${guideAction("guideMethodsUrban", copy.urban)}
      </div>
    </section>
  `;
}

function explainRow(title, body) {
  return `
    <div>
      <span>${title}</span>
      <p>${body}</p>
    </div>
  `;
}

function layerInterpretation(layer) {
  const groups = new Set(layer.groups || []);
  const hazard = atlasHazardLabel(layer.id);
  const hazardText = hazard ? hazardName(hazard).toLowerCase() : state.language === "pt" ? "este perigo" : "this hazard";

  if (groups.has("hazard_susceptibility")) {
    return state.language === "pt"
      ? {
          label: "Saída do modelo",
          meaning: `Valores maiores indicam lugares que o modelo classificou como mais propensos a condições de ${hazardText}.`,
          use: "Use para encontrar áreas amplas que precisam de uma análise mais próxima.",
          caution: "Isto não é previsão, mapa de profundidade de inundação, previsão de queimada ou regra local de projeto.",
          next: "Abra a camada correspondente de pessoas em risco e depois veja Prioridades Urbanas.",
        }
      : {
          label: "Model output",
          meaning: `Higher values mean the model rated this place as more likely to face ${hazardText} conditions.`,
          use: "Use it to find broad hot spots and places that may need a closer look.",
          caution: "This is not a forecast, flood depth map, burn forecast, or local design rule.",
          next: "Open the matching people-at-risk layer next, then check city priorities.",
        };
  }

  if (groups.has("hazard_exposure")) {
    return state.language === "pt"
      ? {
          label: "Mapa de pessoas em risco",
          meaning: `Valores maiores indicam maior sobreposição entre áreas propensas a ${hazardText}, população e área construída.`,
          use: "Use para ver onde os perigos podem afetar mais pessoas e infraestrutura.",
          caution: "Isto não estima danos, perda de serviços, necessidades emergenciais ou impactos observados.",
          next: "Use Prioridades Urbanas para ver cidades com alto perigo e maior necessidade de capacidade.",
        }
      : {
          label: "People-at-risk map",
          meaning: `Higher values mean ${hazardText}-prone areas overlap more with people and built-up land.`,
          use: "Use it to see where hazards may matter more for people and infrastructure.",
          caution: "This does not estimate damage, service loss, emergency needs, or observed impacts.",
          next: "Use City Priorities to see which cities combine high hazard with higher capacity need.",
        };
  }

  if (groups.has("urban_classification")) {
    return state.language === "pt"
      ? {
          label: "Mapa de classes urbanas",
          meaning: "O mapa agrupa lugares por perigo e contexto social ou econômico.",
          use: "Use para encontrar lugares com padrões parecidos antes de avaliar cidades individuais.",
          caution: "As classes são grupos amplos. Elas não são rótulos oficiais de risco nem decisões de política pública.",
          next: "Abra Prioridades Urbanas para ajustar pesos e examinar as classes.",
        }
      : {
          label: "City class map",
          meaning: "The map groups places by hazard score and social or economic context.",
          use: "Use it to find places with similar risk patterns before checking single cities.",
          caution: "Classes are broad groups. They are not official risk labels or policy decisions.",
          next: "Switch to City Priorities to adjust weights and inspect city classes.",
        };
  }

  if (groups.has("socioeconomic_context")) {
    return state.language === "pt"
      ? {
          label: "Camada de contexto",
          meaning: "Valores maiores seguem as unidades da legenda e descrevem população, economia ou condições do território.",
          use: "Use para entender por que cidades com perigo parecido podem ter prioridades diferentes.",
          caution: "Camadas de contexto são entradas ou modificadores. Elas não devem ser lidas como perigo isolado.",
          next: "Abra uma camada de perigo ou de pessoas em risco se quiser o resultado modelado.",
        }
      : {
          label: "Context layer",
          meaning: "Higher values follow the units shown in the legend and describe people, economy, or land conditions.",
          use: "Use it to understand why city scores differ across places with similar hazard levels.",
          caution: "Context layers are inputs or modifiers. They should not be interpreted as hazards by themselves.",
          next: "Open a hazard or people-at-risk layer next if you want the modeled outcome.",
        };
  }

  if (groups.has("flood_predictors") || groups.has("drought_predictors") || groups.has("wildfire_predictors")) {
    return state.language === "pt"
      ? {
          label: "Camada preditora",
          meaning: "Este é um dos mapas de entrada usados pelo modelo de perigo.",
          use: "Use para ver quais feições do terreno ou do clima ajudam a explicar o modelo.",
          caution: "Um valor alto de entrada nem sempre significa alto perigo. O modelo combina várias entradas.",
          next: "Abra a camada XGBoost de suscetibilidade correspondente para ver o resultado modelado.",
        }
      : {
          label: "Predictor layer",
          meaning: "This is one input map used by the hazard model.",
          use: "Use it to see which land or climate features may help explain the model.",
          caution: "A high input value does not always mean high hazard. The model combines many inputs.",
          next: "Open the corresponding XGBoost susceptibility layer to see the modeled outcome.",
        };
  }

  return state.language === "pt"
    ? {
        label: "Camada publicada",
        meaning: "Esta camada faz parte do pacote estático publicado no atlas.",
        use: "Use a legenda, as notas de dados e o link de download para ler o mapa.",
        caution: "A interpretação depende das unidades e da fonte da camada.",
        next: "Use a lista de camadas, amostre um pixel ou vá para Prioridades Urbanas.",
      }
    : {
        label: "Published layer",
        meaning: "This layer is part of the published static atlas bundle.",
        use: "Use the legend, data notes, and download link to read the map.",
        caution: "Meaning depends on the layer units and source data.",
        next: "Use the layer list, sample a pixel, or move to city priorities.",
      };
}

function renderLayerInterpretation(layer) {
  const info = layerInterpretation(layer);
  return `
    <section class="detail-card interpretation-card">
      <div class="section-head">
        <h3>${state.language === "pt" ? "Como ler esta camada" : "How to read this layer"}</h3>
        <span>${info.label}</span>
      </div>
      <div class="interpretation-grid">
        ${explainRow(state.language === "pt" ? "O que valores altos indicam" : "What high values mean", info.meaning)}
        ${explainRow(state.language === "pt" ? "Melhor uso" : "Best use", info.use)}
        ${explainRow(state.language === "pt" ? "Não extrapole" : "Do not over-read", info.caution)}
        ${explainRow(state.language === "pt" ? "Próximo passo" : "Good next step", info.next)}
      </div>
    </section>
  `;
}

function renderCityInterpretation(city, metrics) {
  return `
    <section class="detail-card interpretation-card">
      <div class="section-head">
        <h3>${state.language === "pt" ? "Como ler esta cidade" : "How to read this city"}</h3>
        <span>${city.label}</span>
      </div>
      <div class="interpretation-grid">
        ${explainRow(t("common.priority"), state.language === "pt" ? `O valor ${fmtNumber(city.priority, 1)} posiciona esta cidade dentro da lista filtrada e dos pesos atuais.` : `The score of ${fmtNumber(city.priority, 1)} places this city within the current filtered list and weights.`)}
        ${explainRow(state.language === "pt" ? "Valor de perigo" : "Hazard score", state.language === "pt" ? `O valor atual de perigo é ${fmtNumber(metrics.hazard, 3)} em uma escala de 0 a 1.` : `The current hazard score is ${fmtNumber(metrics.hazard, 3)} on a 0 to 1 scale.`)}
        ${explainRow(t("common.capacityNeed"), state.language === "pt" ? `A necessidade de capacidade é ${fmtNumber(metrics.vulnerability, 3)}. Ela é igual a 1 menos a capacidade baseada em PIB/IDH. Valores maiores indicam menor capacidade neste conjunto de dados.` : `The capacity-need score is ${fmtNumber(metrics.vulnerability, 3)}. It equals 1 minus the GDP/HDI capacity score, so higher values mean lower capacity in this dataset.`)}
        ${explainRow(state.language === "pt" ? "Use com cuidado" : "Use with care", state.language === "pt" ? "Este é um valor de triagem. Não é estudo local de risco, valor de projeto ou alerta." : "This is a screening score. It is not a local risk study, design value, or warning.")}
      </div>
    </section>
  `;
}

function renderMethodsInterpretationCard() {
  const rows = state.language === "pt"
    ? [
        ["Valor de perigo", "Valor do modelo para lugares mais propensos a inundação, seca ou incêndio. Não é previsão."],
        ["Pessoas em risco", "Locais onde áreas propensas a perigo se sobrepõem a população e área construída. Não é estimativa de dano."],
        ["Modelo simples", "Modelo ponderado usado para checar o XGBoost. Não é o modelo principal."],
        ["Classes urbanas", "Mapa de quatro classes que muda no navegador quando os pesos de inundação, seca, incêndio, PIB ou IDH mudam."],
        ["Prioridade", "Valor de 0 a 100 que combina perigo e necessidade de capacidade para a lista filtrada de cidades."],
      ]
    : [
        ["Hazard score", "A model score for places that look more prone to flood, drought, or wildfire. It is not a forecast."],
        ["People at risk", "Where hazard-prone areas overlap with people and built-up land. It is not a damage estimate."],
        ["Simple model", "A weighted model used to check XGBoost. It is not the main model."],
        ["City-area classes", "A four-class map that changes in the browser when flood, drought, wildfire, GDP, or HDI weights change."],
        ["Priority score", "A 0 to 100 city score that combines hazard and capacity need for the current filtered city list."],
      ];
  return `
    <section class="methods-card interpretation-card">
      <span class="eyebrow">${state.language === "pt" ? "Glossário simples" : "Simple glossary"}</span>
      <h2>${state.language === "pt" ? "Palavras usadas na ferramenta" : "Key words used in the tool"}</h2>
      <div class="interpretation-grid glossary-grid">
        ${rows.map((row) => explainRow(row[0], row[1])).join("")}
      </div>
      <div class="safe-use-box">
        <strong>${state.language === "pt" ? "Regra de uso seguro" : "Safe-use rule"}</strong>
        <p>${state.language === "pt" ? "Use o atlas para triagem, leitura de mapas e relatórios. Não use sozinho para projeto local, alertas, seguros ou regras sem verificações locais." : "Use the atlas to screen places, inspect maps, and make reports. Do not use it alone for local design, warnings, insurance, or rules without local checks."}</p>
      </div>
    </section>
  `;
}

function exportStatus(label, value, helper = "") {
  return `
    <div class="export-status-item">
      <span>${label}</span>
      <strong>${value}</strong>
      ${helper ? `<small>${helper}</small>` : ""}
    </div>
  `;
}

function exportButton(id, label, variant = "secondary", disabled = false) {
  const className = variant === "primary" ? "download-button" : "toolbar-button";
  return `<button class="${className} export-action" id="${id}" ${disabled ? "disabled" : ""}>${label}</button>`;
}

function exportLink(href, label, disabled = false) {
  if (disabled) return `<button class="download-button export-action" disabled>${label}</button>`;
  return `<a class="download-button export-action" href="./${href}" download>${label}</a>`;
}

function renderMethodsExportHubCard() {
  const copy = state.language === "pt"
    ? {
        eyebrow: "Exportações",
        title: "Lista de dados e notas",
        layers: "Camadas publicadas",
        catalogEntries: "entradas no catálogo",
        layerHelper: "Arquivos raster e vetoriais para web.",
        checks: "Testes do modelo",
        comparisons: "comparações",
        checkHelper: "XGBoost versus modelo ponderado simples.",
        cityData: "Dados urbanos",
        cityPoints: "pontos urbanos",
        cityAreas: "áreas urbanas.",
        catalog: "Exportar catálogo CSV",
        atlas: "Abrir Atlas",
        urban: "Abrir prioridades urbanas",
      }
    : {
        eyebrow: "Export hub",
        title: "Data list and notes",
        layers: "Published layers",
        catalogEntries: "catalog entries",
        layerHelper: "Raster and vector web assets.",
        checks: "Model checks",
        comparisons: "comparisons",
        checkHelper: "XGBoost versus simple weighted model.",
        cityData: "City data",
        cityPoints: "city points",
        cityAreas: "city areas.",
        catalog: "Export layer catalog CSV",
        atlas: "Open Atlas",
        urban: "Open city priorities",
      };
  return `
    <section class="export-card methods-export">
      <div class="export-head">
        <span class="eyebrow">${copy.eyebrow}</span>
        <strong>${copy.title}</strong>
      </div>
      <div class="export-status-grid">
        ${exportStatus(copy.layers, `${fmtInteger(state.catalog.length)} ${copy.catalogEntries}`, copy.layerHelper)}
        ${exportStatus(copy.checks, `${fmtInteger(state.benchmarkSummary.hazards.length)} ${copy.comparisons}`, copy.checkHelper)}
        ${exportStatus(copy.cityData, `${fmtInteger(state.config.city_meta.city_count)} ${copy.cityPoints}`, `${fmtInteger(state.config.city_meta.municipal_count)} ${copy.cityAreas}`)}
      </div>
      <div class="export-actions">
        ${exportButton("hubMethodsCatalogCsv", copy.catalog, "primary")}
        ${exportButton("hubMethodsAtlas", copy.atlas)}
        ${exportButton("hubMethodsUrban", copy.urban)}
      </div>
    </section>
  `;
}

function scenarioPayload() {
  return {
    v: 1,
    view: state.activeView,
    preset: state.activePresetId,
    atlas: {
      activeLayerId: state.atlas.activeLayerId,
      opacity: state.atlas.opacity,
      country: state.atlas.country,
      showCountries: state.atlas.showCountries,
      showCities: state.atlas.showCities,
      showMunicipal: state.atlas.showMunicipal,
      baseMap: state.atlas.baseMap,
    },
    urban: {
      country: state.urban.country,
      state: state.urban.state,
      popGroup: state.urban.popGroup,
      rankBy: "priority",
      topN: state.urban.topN,
      search: state.urban.search,
      showMunicipal: state.urban.showMunicipal,
      municipalMode: state.urban.municipalMode,
      selectedCityId: state.urban.selectedCityId,
      weights: state.urban.weights,
    },
  };
}

function encodeScenarioPayload(payload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeScenarioPayload(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function scenarioUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("scenario", encodeScenarioPayload(scenarioPayload()));
  return url.toString();
}

function validChoice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function safeNumber(value, fallback, min = -Infinity, max = Infinity) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(max, Math.max(min, next));
}

function safeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function restoreScenarioFromUrl() {
  const encoded = new URL(window.location.href).searchParams.get("scenario");
  if (!encoded) return;
  try {
    applyScenarioPayload(decodeScenarioPayload(encoded));
    state.share.restored = true;
    state.share.status = state.language === "pt" ? "Cenário compartilhado restaurado pela URL." : "Shared scenario restored from URL.";
  } catch (error) {
    console.warn("Could not restore shared scenario", error);
    state.share.status = state.language === "pt" ? "Não foi possível restaurar o cenário compartilhado." : "Shared scenario link could not be restored.";
  }
}

function applyScenarioPayload(payload) {
  if (!payload || payload.v !== 1) throw new Error("Unsupported scenario version");

  state.activeView = validChoice(payload.view, ["atlas", "urban", "methods"], state.activeView);
  state.activePresetId = null;

  const atlas = payload.atlas || {};
  const sharedLayer = state.layerById.get(atlas.activeLayerId);
  if (sharedLayer && !isBenchmarkLayer(sharedLayer)) state.atlas.activeLayerId = atlas.activeLayerId;
  state.atlas.opacity = safeNumber(atlas.opacity, state.atlas.opacity, 0.25, 1);
  state.atlas.country = atlas.country || state.atlas.country;
  state.atlas.showCountries = safeBoolean(atlas.showCountries, state.atlas.showCountries);
  state.atlas.showCities = safeBoolean(atlas.showCities, state.atlas.showCities);
  state.atlas.showMunicipal = safeBoolean(atlas.showMunicipal, state.atlas.showMunicipal);
  state.atlas.baseMap = validChoice(atlas.baseMap, ["light", "street"], state.atlas.baseMap);
  state.atlas.pixelError = "";
  state.atlas.pixelLoading = false;
  state.atlas.pixelReport = null;

  const urban = payload.urban || {};
  state.urban.country = urban.country || state.urban.country;
  state.urban.state = urban.state || "all";
  state.urban.popGroup = validChoice(
    urban.popGroup,
    POP_GROUP_OPTIONS.map((option) => option.value),
    state.urban.popGroup,
  );
  state.urban.rankBy = "priority";
  state.urban.topN = normalizeTopN(urban.topN, 1000);
  state.urban.search = typeof urban.search === "string" ? urban.search : "";
  state.urban.showMunicipal = safeBoolean(urban.showMunicipal, state.urban.showMunicipal);
  state.urban.municipalMode = "dynamic";
  state.urban.selectedCityId = urban.selectedCityId || null;

  if (urban.weights) {
    state.urban.weights = {
      hazardWeight: safeNumber(urban.weights.hazardWeight, state.urban.weights.hazardWeight, 0, 1),
      hazardComponents: {
        flood: safeNumber(urban.weights.hazardComponents?.flood, state.urban.weights.hazardComponents.flood, 0, 1),
        drought: safeNumber(urban.weights.hazardComponents?.drought, state.urban.weights.hazardComponents.drought, 0, 1),
        wildfire: safeNumber(urban.weights.hazardComponents?.wildfire, state.urban.weights.hazardComponents.wildfire, 0, 1),
      },
      adaptiveCapacity: {
        gdp: safeNumber(urban.weights.adaptiveCapacity?.gdp, state.urban.weights.adaptiveCapacity.gdp, 0, 1),
        hdi: safeNumber(urban.weights.adaptiveCapacity?.hdi, state.urban.weights.adaptiveCapacity.hdi, 0, 1),
      },
    };
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function renderScenarioShareCard() {
  const restored = state.share.restored
    ? state.language === "pt" ? "Restaurado de link compartilhado" : "Restored from shared link"
    : state.language === "pt" ? "Sessão local" : "Local session";
  return `
    <section class="share-card">
      <div class="share-head">
        <span class="eyebrow">${state.language === "pt" ? "Compartilhar esta visão" : "Share this view"}</span>
        <strong>${restored}</strong>
      </div>
      <p class="share-note">${state.language === "pt" ? "Copie um link que abre a mesma tela, mapa, filtros, pesos e classes." : "Copy a link that opens this same view, map, filters, weights, and class map."}</p>
      ${state.share.status ? `<p class="share-status">${state.share.status}</p>` : ""}
      <div class="share-actions">
        <button class="download-button share-action" id="copyScenarioLink">${state.language === "pt" ? "Copiar link" : "Copy scenario link"}</button>
        <button class="toolbar-button share-action" id="updateScenarioUrl">${state.language === "pt" ? "Colocar link na barra" : "Put share link in address bar"}</button>
      </div>
      <p class="share-note small">${state.language === "pt" ? "Use \"Colocar link na barra\" se a cópia não funcionar. O endereço muda para esta visão, mas a página não recarrega." : "Use \"Put share link in address bar\" if copying does not work. It changes the browser URL to this exact view, but it does not reload the page."}</p>
    </section>
  `;
}

function bindScenarioShareCard() {
  $("#copyScenarioLink").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const original = button.textContent;
    try {
      await copyText(scenarioUrl());
      button.textContent = state.language === "pt" ? "Link copiado" : "Scenario link copied";
      state.share.status = state.language === "pt" ? "Link copiado para a área de transferência." : "Scenario link copied to clipboard.";
    } catch (error) {
      console.error(error);
      button.textContent = state.language === "pt" ? "Falha ao copiar" : "Copy failed";
      state.share.status = state.language === "pt" ? "Não foi possível copiar. Coloque o link na barra de endereço e copie de lá." : "Could not copy the link. Put it in the address bar and copy it from there.";
    } finally {
      setTimeout(() => {
        button.textContent = original;
      }, 1800);
    }
  });
  $("#updateScenarioUrl").addEventListener("click", () => {
    window.history.replaceState(null, "", scenarioUrl());
    state.share.status = state.language === "pt" ? "A barra de endereço agora contém um link para esta visão." : "The address bar now contains a link to this exact view.";
    void render();
  });
}

function exportPixelCsv() {
  const report = state.atlas.pixelReport;
  if (!report) return;
  const rows = localizedPixelRows(report).map((row) => ({
    latitude: report.lat,
    longitude: report.lon,
    active_layer_id: report.activeLayerId,
    generated_at: report.generatedAt,
    layer: row.layer,
    value: row.value,
    units: row.units,
    pixel: row.pixel,
    description: row.description,
    note: row.note,
  }));
  const filename = `atlas_pixel_${report.lat.toFixed(4)}_${report.lon.toFixed(4)}.csv`;
  downloadTextFile(filename, toCsv(rows), "text/csv;charset=utf-8");
}

function exportLayerCatalogCsv() {
  const rows = state.catalog.map((layer) => ({
    id: layer.id,
    title: layerTitle(layer),
    kind: layer.kind,
    groups: (layer.groups || []).join("; "),
    units: layerUnits(layer) || "",
    description: layerDescription(layer) || "",
    source_file: layer.source_file || "",
    download_url: layer.download_url || "",
  }));
  downloadTextFile("south_america_risk_atlas_layer_catalog.csv", toCsv(rows), "text/csv;charset=utf-8");
}

function showSelectedCitySourceLayers() {
  const city = selectedCity();
  if (!city) return;
  state.atlas.activeLayerId = state.config.urban_handoffs[city.dominant_hazard] || "xgb_fsi";
  state.atlas.country = city.ADM0_NAME;
  state.activeView = "atlas";
}

function bindAtlasExportHub() {
  const pixelWord = $("#hubAtlasPixelWord");
  if (pixelWord && state.atlas.pixelReport) {
    pixelWord.addEventListener("click", () => {
      void runWordExport(pixelWord, () =>
        downloadPixelReport(localizedPixelReport(state.atlas.pixelReport), layerTitle(activeLayer()), { language: state.language }),
      );
    });
  }
  const pixelCsv = $("#hubAtlasPixelCsv");
  if (pixelCsv && state.atlas.pixelReport) {
    pixelCsv.addEventListener("click", exportPixelCsv);
  }
  $("#hubAtlasSendUrban").addEventListener("click", () => {
    sendAtlasContextToUrban();
    void render();
  });
}

function bindMethodsExportHub() {
  $("#hubMethodsCatalogCsv").addEventListener("click", exportLayerCatalogCsv);
  $("#hubMethodsAtlas").addEventListener("click", () => {
    state.activeView = "atlas";
    void render();
  });
  $("#hubMethodsUrban").addEventListener("click", () => {
    state.activeView = "urban";
    void render();
  });
}

function sendAtlasContextToUrban(layerId = state.atlas.activeLayerId) {
  state.urban.atlasContext = {
    country: state.atlas.country,
    sourceLayerId: layerId,
    hazard: atlasHazardLabel(layerId),
  };
  if (urbanSupportsCountry(state.atlas.country) && state.atlas.country !== "all") {
    state.urban.country = state.atlas.country;
    state.urban.state = "all";
  } else {
    state.urban.country = "all";
    state.urban.state = "all";
  }
  state.urban.topN = 1000;
  state.urban.rankBy = "priority";
  state.urban.municipalMode = "dynamic";
  state.activeView = "urban";
}

function urbanSupportsCountry(country) {
  if (!country || country === "all") return true;
  return (state.config.city_meta.urban_country_options || []).includes(country);
}

function renderAtlasSidebar() {
  const groups = groupLayers();
  dom.sidebarBody.innerHTML = `
    <section class="control-card">
      <div class="control-head">
        <h2>${t("atlas.controls")}</h2>
        <span>${t("atlas.rasterLayers", { count: atlasVisibleLayers().filter((layer) => layer.kind === "raster").length })}</span>
      </div>
      <div class="control-grid">
        <label>
          <span>${t("atlas.countryFocus")}</span>
          <select id="atlasCountry"></select>
        </label>
        <label>
          <span>${t("atlas.backgroundMap")}</span>
          <select id="baseMapSelect">
            <option value="light">${t("atlas.light")}</option>
            <option value="street">${t("atlas.street")}</option>
          </select>
        </label>
        <label class="control-span-2">
          <span>${t("atlas.chooseLayer")}</span>
          <select id="atlasLayerSelect"></select>
        </label>
        <label>
          <span>${t("atlas.opacity")}</span>
          <input id="opacitySlider" type="range" min="0.25" max="1" step="0.01" value="${state.atlas.opacity}" />
        </label>
      </div>
      <p class="legend-note">${t("atlas.note")}</p>
      <div class="toggle-grid">
        <label class="toggle">
          <input id="toggleCountries" type="checkbox" ${state.atlas.showCountries ? "checked" : ""} />
          <span>${t("atlas.countryBorders")}</span>
        </label>
        <label class="toggle">
          <input id="toggleAtlasCities" type="checkbox" ${state.atlas.showCities ? "checked" : ""} />
          <span>${t("atlas.cityPoints")}</span>
        </label>
        <label class="toggle">
          <input id="toggleAtlasMunicipal" type="checkbox" ${state.atlas.showMunicipal ? "checked" : ""} />
          <span>${t("atlas.hazardVulnerability")}</span>
        </label>
      </div>
      <div class="action-row">
        <button class="toolbar-button" id="zoomSouthAmerica">${t("atlas.reset")}</button>
        <button class="download-button" id="sendToUrban">${t("atlas.send")}</button>
      </div>
      <p class="legend-note">${t("atlas.walkthrough")}</p>
    </section>
  `;

  const countrySelect = $("#atlasCountry");
  countrySelect.appendChild(createOption("all", t("common.allSouthAmerica")));
  const atlasCountryOptions = state.config.city_meta.atlas_country_options || state.config.city_meta.urban_country_options || [];
  atlasCountryOptions.forEach((country) => {
    countrySelect.appendChild(createOption(country, country));
  });
  countrySelect.value = state.atlas.country;
  $("#baseMapSelect").value = state.atlas.baseMap;
  const layerSelect = $("#atlasLayerSelect");
  groups.forEach((group) => {
    if (!group.layers.length) return;
    const optgroup = document.createElement("optgroup");
    optgroup.label = groupTitle(group);
    group.layers.forEach((layer) => {
      optgroup.appendChild(createOption(layer.id, layerTitle(layer)));
    });
    layerSelect.appendChild(optgroup);
  });
  layerSelect.value = state.atlas.activeLayerId;

  $("#atlasCountry").addEventListener("change", (event) => {
    state.atlas.country = event.target.value;
    if (state.atlas.country !== "all") zoomToCountry(state.atlas.country);
    void renderAtlasMap();
  });
  $("#baseMapSelect").addEventListener("change", (event) => {
    switchBaseMap(event.target.value);
  });
  $("#atlasLayerSelect").addEventListener("change", (event) => {
    state.atlas.activeLayerId = event.target.value;
    state.atlas.pixelError = "";
    state.atlas.pixelReport = null;
    clearLayer(state.map.pixelMarker);
    void render();
  });
  $("#opacitySlider").addEventListener("input", (event) => {
    state.atlas.opacity = Number(event.target.value);
    if (state.map.primaryLayer) state.map.primaryLayer.setOpacity(state.atlas.opacity);
  });
  $("#toggleCountries").addEventListener("change", (event) => {
    state.atlas.showCountries = event.target.checked;
    void renderAtlasMap();
  });
  $("#toggleAtlasCities").addEventListener("change", (event) => {
    state.atlas.showCities = event.target.checked;
    void renderAtlasMap();
  });
  $("#toggleAtlasMunicipal").addEventListener("change", (event) => {
    state.atlas.showMunicipal = event.target.checked;
    void renderAtlasMap();
  });
  $("#zoomSouthAmerica").addEventListener("click", () => {
    state.map.instance.setView([-18, -60], 4);
  });
  $("#sendToUrban").addEventListener("click", () => {
    sendAtlasContextToUrban();
    void render();
  });
}

function renderAtlasDetail() {
  const layer = activeLayer();
  const stats = layer.stats || null;
  const sourceTags = layer.groups
    .map((groupId) => groupTitle(state.config.groups.find((group) => group.id === groupId)) || groupId)
    .map((label) => `<span class="pill">${label}</span>`)
    .join("");

  dom.detailBody.innerHTML = `
    <section class="detail-head">
      <span class="eyebrow">${t("atlas.activeLayer")}</span>
      <h2>${layerTitle(layer)}</h2>
      <p>${layerDescription(layer)}</p>
      <div class="pill-row">${sourceTags}</div>
    </section>
    <section class="detail-card">
      <div class="section-head">
        <h3>${t("atlas.legend")}</h3>
        <a class="download-link" href="./${layer.download_url}" download>${t("atlas.downloadLayer")}</a>
      </div>
      ${renderLegend(layer)}
    </section>
    ${renderLayerInterpretation(layer)}
    <section class="detail-card">
      <div class="section-head">
        <h3>${t("atlas.metadata")}</h3>
      </div>
      <dl class="metadata-grid">
        <div><dt>${t("common.units")}</dt><dd>${layerUnits(layer) || t("common.na")}</dd></div>
        <div><dt>${t("atlas.layerId")}</dt><dd>${layer.id}</dd></div>
        <div><dt>${t("atlas.publishedSource")}</dt><dd class="mono">${layer.source_file || layer.data_url}</dd></div>
        ${stats ? `<div><dt>${t("atlas.displayRange")}</dt><dd>${fmtNumber(stats.display_min, 3)} ${state.language === "pt" ? "a" : "to"} ${fmtNumber(stats.display_max, 3)}</dd></div>` : ""}
        ${stats ? `<div><dt>${t("atlas.median")}</dt><dd>${fmtNumber(stats.p50, 3)}</dd></div>` : ""}
      </dl>
    </section>
    ${renderPixelInspection(layer)}
    <section class="detail-card">
      <div class="section-head">
        <h3>${t("atlas.nextStep")}</h3>
      </div>
      <p>${t("atlas.nextStepBody")}</p>
      <button class="download-button" id="detailSendUrban">${t("atlas.openUrban")}</button>
    </section>
  `;

  $("#detailSendUrban").addEventListener("click", () => {
    sendAtlasContextToUrban(layer.id);
    void render();
  });

  const pixelExport = $("#exportPixelWord");
  if (pixelExport && state.atlas.pixelReport) {
    pixelExport.addEventListener("click", () => {
      void runWordExport(pixelExport, () =>
        downloadPixelReport(localizedPixelReport(state.atlas.pixelReport), layerTitle(activeLayer()), { language: state.language }),
      );
    });
  }
}

function renderPixelInspection(layer) {
  if (layer.kind !== "raster") {
    return `
      <section class="detail-card">
        <div class="section-head">
          <h3>${t("atlas.pixelInspection")}</h3>
        </div>
        <p class="legend-note">${t("atlas.pixelVector")}</p>
      </section>
    `;
  }

  if (state.atlas.pixelLoading) {
    return `
      <section class="detail-card">
        <div class="section-head">
          <h3>${t("atlas.pixelInspection")}</h3>
        </div>
        <p class="legend-note">${t("atlas.pixelLoading")}</p>
      </section>
    `;
  }

  if (state.atlas.pixelError) {
    return `
      <section class="detail-card">
        <div class="section-head">
          <h3>${t("atlas.pixelInspection")}</h3>
        </div>
        <p class="legend-note">${t("status.pixelFailed", { error: state.atlas.pixelError })}</p>
      </section>
    `;
  }

  const report = state.atlas.pixelReport;
  if (!report) {
    return `
      <section class="detail-card">
        <div class="section-head">
          <h3>${t("atlas.pixelInspection")}</h3>
        </div>
        <p>${t("atlas.pixelReady")}</p>
      </section>
    `;
  }

  return `
    <section class="detail-card">
      <div class="section-head">
        <h3>${t("atlas.pixelInspection")}</h3>
        <button class="download-button" id="exportPixelWord">${t("atlas.exportPixelWord")}</button>
      </div>
      <dl class="metadata-grid">
        <div><dt>${t("common.latitude")}</dt><dd>${fmtNumber(report.lat, 6)}</dd></div>
        <div><dt>${t("common.longitude")}</dt><dd>${fmtNumber(report.lon, 6)}</dd></div>
        <div><dt>${t("common.sampledRasters")}</dt><dd>${fmtInteger(report.values.length)}</dd></div>
        <div><dt>${t("common.generated")}</dt><dd>${new Date(report.generatedAt).toLocaleString(currentLocale())}</dd></div>
      </dl>
      ${renderPixelRasterTable(report)}
    </section>
  `;
}

function renderPixelRasterTable(report) {
  const rows = localizedPixelRows(report);
  return `
    <div class="raster-table-wrap compact">
      <table class="raster-table">
        <thead>
          <tr>
            <th>${t("common.layer")}</th>
            <th>${t("common.value")}</th>
            <th>${t("common.units")}</th>
            <th>${state.language === "pt" ? "Pixel" : "Pixel"}</th>
            <th>${t("common.note")}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
              <tr>
                <td><strong>${row.layer}</strong><small>${row.description}</small></td>
                <td>${row.value}</td>
                <td>${row.units}</td>
                <td>${row.pixel}</td>
                <td>${row.note || ""}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderLegend(layer) {
  if (layer.kind === "vector" && (!layer.legend_items || !layer.legend_items.length)) {
    return `<p class="legend-note">${state.language === "pt" ? "Esta camada vetorial publicada é estilizada diretamente no mapa." : "This published vector layer is styled directly on the map."}</p>`;
  }
  if (layer.render_mode === "continuous") {
    return `
      <div class="legend-gradient" style="background:${cssGradient(layer.legend_gradient)}"></div>
      <div class="legend-ticks">
        ${layer.legend_ticks.map((tick) => `<span>${fmtLegendTick(tick, layer.units)}</span>`).join("")}
      </div>
    `;
  }
  return `
    <div class="legend-list">
      ${layer.legend_items
        .map(
          (item) => `
          <div class="legend-item">
            <span class="legend-swatch" style="background:${item.color}"></span>
            <span>${legendItemLabel(item.label)}</span>
          </div>`,
        )
        .join("")}
    </div>
  `;
}

function fmtLegendTick(value, units) {
  if (/USD|Population|inh/.test(units || "")) return fmtCompact(Number(value), 1);
  if (/Probability|Fraction|Index/.test(units || "")) return fmtNumber(Number(value), 2);
  return fmtNumber(Number(value), 1);
}

function atlasHazardLabel(layerId) {
  if (["xgb_fsi", "xgb_frei"].includes(layerId)) return "Flood";
  if (["xgb_dsi", "xgb_drei"].includes(layerId)) return "Drought";
  if (["xgb_fisi", "xgb_firei"].includes(layerId)) return "Wildfire";
  return null;
}

function switchBaseMap(baseMapId) {
  const next = state.map.baseLayers[baseMapId];
  if (!next) return;
  Object.values(state.map.baseLayers).forEach((layer) => {
    if (state.map.instance.hasLayer(layer)) state.map.instance.removeLayer(layer);
  });
  next.addTo(state.map.instance);
  state.atlas.baseMap = baseMapId;
}

function ensureRasterLayer(layerId) {
  const layer = state.layerById.get(layerId);
  if (!layer || layer.kind !== "raster") return null;
  if (state.map.primaryLayer) state.map.instance.removeLayer(state.map.primaryLayer);
  const leafletLayer = L.tileLayer(`./${layer.tile_url}`, {
    pane: "primaryPane",
    opacity: state.atlas.opacity,
    maxNativeZoom: 7,
    maxZoom: 19,
    minZoom: 0,
    minNativeZoom: 0,
    tms: false,
    noWrap: true,
    bounds: layer.bounds_4326 || undefined,
  });
  leafletLayer.addTo(state.map.instance);
  state.map.primaryLayer = leafletLayer;
  return leafletLayer;
}

function clearLayer(layerRef) {
  if (layerRef && state.map.instance.hasLayer(layerRef)) {
    state.map.instance.removeLayer(layerRef);
  }
}

async function ensureCountriesLayer() {
  if (!state.datasets.countries) {
    state.datasets.countries = await fetchJson(`./${state.config.reference_layers.countries_url}`);
  }
  return state.datasets.countries;
}

async function ensureCityPoints() {
  if (!state.datasets.cityPoints) {
    const geojson = await fetchJson("./data/cities/city_points.geojson");
    state.datasets.cityPoints = geojson.features.map((feature) => ({
      ...feature.properties,
      geometry: feature.geometry,
      point_lon: feature.geometry.coordinates[0],
      point_lat: feature.geometry.coordinates[1],
      uid: feature.properties.ADM2_CODE ?? `${slugify(feature.properties.ADM0_NAME)}-${slugify(feature.properties.ADM2_NAME)}`,
    }));
  }
  return state.datasets.cityPoints;
}

async function ensureMunicipalClasses() {
  if (!state.datasets.municipalClasses) {
    state.datasets.municipalClasses = await fetchJson("./data/cities/municipal_classes.geojson");
  }
  return state.datasets.municipalClasses;
}

function municipalStyle(feature, { emphasized = false } = {}) {
  return {
    color: "#ffffff",
    weight: emphasized ? 0.45 : 0.35,
    fillColor: MUNICIPAL_COLORS[feature.properties.city_cluster] || "#cccccc",
    fillOpacity: emphasized ? 0.72 : 0.35,
  };
}

function dynamicClassFor(entity) {
  const id = entity?.ADM2_CODE ?? entity?.uid;
  return state.urbanDynamic.byId.get(String(id)) || null;
}

function municipalClassForFeature(feature) {
  if (state.urban.municipalMode === "dynamic") {
    return dynamicClassFor(feature.properties)?.dynamic_cluster || feature.properties.city_cluster;
  }
  return feature.properties.city_cluster;
}

function classLegendHtml() {
  return `
    <div class="class-legend">
      ${MUNICIPAL_CLASS_LABELS.map(
        (label) => `
          <span><i style="background:${MUNICIPAL_COLORS[label]}"></i>${classLabel(label)}</span>
        `,
      ).join("")}
    </div>
  `;
}

function makeAtlasCityMarker(city) {
  return L.circleMarker([city.point_lat, city.point_lon], {
    pane: "atlasCitiesPane",
    radius: 2.7,
    color: "#ffffff",
    weight: 0.7,
    fillColor: "#2b2b2b",
    fillOpacity: 0.8,
  }).on("click", () => {
    state.urban.country = city.ADM0_NAME;
    state.urban.state = city.ADM1_NAME || "all";
    state.urban.selectedCityId = city.uid;
    state.activeView = "urban";
    void render();
  });
}

function atlasFeatureMatchesCountry(countryName) {
  return countryName === "all"
    ? () => true
    : (featureOrCity) => {
        const properties = featureOrCity?.properties || featureOrCity;
        return properties?.ADM0_NAME === countryName;
      };
}

async function renderAtlasMap() {
  const layer = activeLayer();
  const countryMatcher = atlasFeatureMatchesCountry(state.atlas.country);
  dom.legendChip.textContent = layerTitle(layer);

  clearLayer(state.map.primaryLayer);
  clearLayer(state.map.atlasCityLayer);
  clearLayer(state.map.atlasMunicipalLayer);
  clearLayer(state.map.countriesLayer);
  clearLayer(state.map.urbanCityLayer);
  clearLayer(state.map.urbanMunicipalLayer);
  clearLayer(state.map.selectedCityHighlight);

  if (layer.kind === "raster") {
    ensureRasterLayer(layer.id);
  }

  if (state.atlas.showCountries) {
    const countries = await ensureCountriesLayer();
    state.map.countriesLayer = L.geoJSON(countries, {
      pane: "countriesPane",
      style: () => ({ color: "#4d5b63", weight: 1.1, fillOpacity: 0 }),
    }).addTo(state.map.instance);
  }

  if (state.atlas.showMunicipal) {
    const municipal = await ensureMunicipalClasses();
    state.map.atlasMunicipalLayer = L.geoJSON(municipal, {
      pane: "atlasMunicipalPane",
      filter: countryMatcher,
      style: (feature) => municipalStyle(feature),
    }).addTo(state.map.instance);
  }

  if (state.atlas.showCities) {
    const cities = await ensureCityPoints();
    state.map.atlasCityLayer = L.layerGroup(
      cities.filter(countryMatcher).map((city) => makeAtlasCityMarker(city)),
    ).addTo(state.map.instance);
  }

  if (layer.kind === "vector" && layer.id === "municipal_classes" && !state.atlas.showMunicipal) {
    const municipal = await ensureMunicipalClasses();
    state.map.atlasMunicipalLayer = L.geoJSON(municipal, {
      pane: "atlasMunicipalPane",
      filter: countryMatcher,
      style: (feature) => municipalStyle(feature, { emphasized: true }),
    }).addTo(state.map.instance);
  }

  if (layer.kind === "vector" && layer.id === "city_points" && !state.atlas.showCities) {
    const cities = await ensureCityPoints();
    state.map.atlasCityLayer = L.layerGroup(
      cities.filter(countryMatcher).map((city) => makeAtlasCityMarker(city)),
    ).addTo(state.map.instance);
  }

  if (state.atlas.country !== "all") zoomToCountry(state.atlas.country);
  dom.mapStatus.textContent = layer.kind === "raster"
    ? t("status.layerLoaded", { layer: layerTitle(layer) })
    : t("status.vectorLoaded", { layer: layerTitle(layer) });
}

async function handleAtlasPixelClick(event) {
  if (state.activeView !== "atlas") return;
  const layer = activeLayer();
  if (!layer || layer.kind !== "raster") return;

  const coordinates = {
    lat: event.latlng.lat,
    lon: event.latlng.lng,
  };
  state.atlas.pixelLoading = true;
  state.atlas.pixelError = "";
  state.atlas.pixelReport = null;
  clearLayer(state.map.pixelMarker);
  state.map.pixelMarker = L.circleMarker([coordinates.lat, coordinates.lon], {
    pane: "pixelPane",
    radius: 5,
    color: "#111111",
    fillColor: "#f6bd60",
    fillOpacity: 0.95,
    weight: 1.4,
  }).addTo(state.map.instance);
  dom.mapStatus.textContent = t("status.sampling", {
    lat: fmtNumber(coordinates.lat, 4),
    lon: fmtNumber(coordinates.lon, 4),
  });
  renderAtlasDetail();

  try {
    const values = await sampleRasterCatalog(atlasVisibleLayers(), coordinates);
    state.atlas.pixelReport = {
      ...coordinates,
      activeLayerId: layer.id,
      generatedAt: new Date().toISOString(),
      values,
    };
    dom.mapStatus.textContent = t("status.sampled", {
      count: values.length,
      lat: fmtNumber(coordinates.lat, 4),
      lon: fmtNumber(coordinates.lon, 4),
    });
  } catch (error) {
    state.atlas.pixelError = error.message || String(error);
    dom.mapStatus.textContent = t("status.pixelFailed", { error: state.atlas.pixelError });
  } finally {
    state.atlas.pixelLoading = false;
    renderAtlasDetail();
  }
}

async function handleUrbanCityMapClick(event) {
  if (state.activeView !== "urban" || !state.urbanResults.ranked.length) return;

  const clickPoint = state.map.instance.latLngToContainerPoint(event.latlng);
  let nearest = null;
  let nearestDistance = Infinity;

  state.urbanResults.ranked.forEach((city) => {
    const cityPoint = state.map.instance.latLngToContainerPoint([city.point_lat, city.point_lon]);
    const distance = clickPoint.distanceTo(cityPoint);
    const hitRadius = Math.max(markerRadius(city.TotPop) + 7, 11);
    if (distance <= hitRadius && distance < nearestDistance) {
      nearest = city;
      nearestDistance = distance;
    }
  });

  if (!nearest || nearest.uid === state.urban.selectedCityId) return;
  await selectUrbanCity(nearest.uid, { preserveMapView: true });
}

async function renderUrbanSidebar() {
  const cities = await ensureCityPoints();
  const countryOptions = state.config.city_meta.urban_country_options || uniqueSorted(cities.map((city) => city.ADM0_NAME));
  const stateOptions =
    state.urban.country === "all"
      ? []
      : uniqueSorted(
          cities.filter((city) => city.ADM0_NAME === state.urban.country).map((city) => city.ADM1_NAME),
        );

  dom.sidebarBody.innerHTML = `
    <section class="disclaimer-card">
      <strong>${t("urban.introTitle")}</strong>
      <p>${t("urban.intro")}</p>
      ${
        state.urban.atlasContext
          ? `<p class="context-note">${t("urban.enteredFrom", {
            hazard: hazardName(state.urban.atlasContext.hazard) || t("urban.atlasContext"),
              country: state.urban.atlasContext.country && state.urban.atlasContext.country !== "all" ? `${state.language === "pt" ? " para" : " for"} ${state.urban.atlasContext.country}` : "",
            })}</p>`
          : ""
      }
    </section>
    <section class="control-card">
      <div class="control-head">
        <h2>${t("urban.filters")}</h2>
        <span id="urbanVisibleCount">${t("urban.visibleCount", { shown: fmtInteger(state.urbanResults.ranked.length), total: fmtInteger(state.urbanResults.filteredCount || 0) })}</span>
      </div>
      <p class="legend-note">${t("urban.defaultView")}</p>
      <div class="control-grid">
        <label>
          <span>${t("urban.country")}</span>
          <select id="urbanCountry"></select>
        </label>
        <label>
          <span>${t("urban.state")}</span>
          <select id="urbanState"></select>
        </label>
        <label>
          <span>${t("urban.populationClass")}</span>
          <select id="urbanPopGroup"></select>
        </label>
        <label>
          <span>${t("urban.cityLimit")}</span>
          <select id="urbanTopN"></select>
        </label>
        <label class="control-span-2">
          <span>${t("urban.searchCity")}</span>
          <input id="urbanSearch" type="search" value="${state.urban.search}" placeholder="${t("urban.searchPlaceholder")}" />
        </label>
      </div>
      <label class="slider-label">
        <span>${t("urban.balance")}</span>
        <div class="slider-row">
          <input id="hazardWeight" type="range" min="0" max="1" step="0.05" value="${state.urban.weights.hazardWeight}" />
          <strong>${fmtNumber(state.urban.weights.hazardWeight, 2)}</strong>
        </div>
      </label>
      <details class="advanced-panel" open>
        <summary>${t("urban.advanced")}</summary>
        <p class="legend-note">${t("urban.weightsNote")}</p>
        <label class="slider-label">
          <span>${t("urban.flood")}</span>
          <div class="slider-row">
            <input id="weightFlood" type="range" min="0" max="1" step="0.01" value="${state.urban.weights.hazardComponents.flood}" />
            <strong>${fmtNumber(state.urban.weights.hazardComponents.flood, 2)}</strong>
          </div>
        </label>
        <label class="slider-label">
          <span>${t("urban.drought")}</span>
          <div class="slider-row">
            <input id="weightDrought" type="range" min="0" max="1" step="0.01" value="${state.urban.weights.hazardComponents.drought}" />
            <strong>${fmtNumber(state.urban.weights.hazardComponents.drought, 2)}</strong>
          </div>
        </label>
        <label class="slider-label">
          <span>${t("urban.wildfire")}</span>
          <div class="slider-row">
            <input id="weightWildfire" type="range" min="0" max="1" step="0.01" value="${state.urban.weights.hazardComponents.wildfire}" />
            <strong>${fmtNumber(state.urban.weights.hazardComponents.wildfire, 2)}</strong>
          </div>
        </label>
        <label class="slider-label">
          <span>${t("urban.gdp")}</span>
          <div class="slider-row">
            <input id="weightGDP" type="range" min="0" max="1" step="0.01" value="${state.urban.weights.adaptiveCapacity.gdp}" />
            <strong>${fmtNumber(state.urban.weights.adaptiveCapacity.gdp, 2)}</strong>
          </div>
        </label>
        <label class="slider-label">
          <span>${t("urban.hdi")}</span>
          <div class="slider-row">
            <input id="weightHDI" type="range" min="0" max="1" step="0.01" value="${state.urban.weights.adaptiveCapacity.hdi}" />
            <strong>${fmtNumber(state.urban.weights.adaptiveCapacity.hdi, 2)}</strong>
          </div>
        </label>
        <div class="action-row">
          <button class="toolbar-button" id="resetWeights">${t("urban.reset")}</button>
        </div>
      </details>
      <div class="toggle-grid">
        <label class="toggle">
          <input id="toggleUrbanMunicipal" type="checkbox" ${state.urban.showMunicipal ? "checked" : ""} />
          <span>${t("urban.showClasses")}</span>
        </label>
      </div>
      <p class="legend-note">${t("urban.classesNote")}</p>
      ${classLegendHtml()}
      <div class="action-row">
        <button class="toolbar-button" id="zoomCountry">${t("urban.zoomCountry")}</button>
        <button class="download-button" id="exportFilteredCsv">${t("urban.exportCsv")}</button>
      </div>
    </section>
    <section class="control-card">
      <div class="control-head">
        <h2>${t("urban.topCities")}</h2>
        <span>${fmtInteger(state.urbanResults.ranked.length)}</span>
      </div>
      <div class="rank-list" id="rankList"></div>
    </section>
  `;

  const countrySelect = $("#urbanCountry");
  countrySelect.appendChild(createOption("all", t("common.allSouthAmerica")));
  countryOptions.forEach((country) => countrySelect.appendChild(createOption(country, country)));
  countrySelect.value = state.urban.country;

  const stateSelect = $("#urbanState");
  stateSelect.appendChild(createOption("all", t("common.allStates")));
  stateOptions.forEach((entry) => stateSelect.appendChild(createOption(entry, entry)));
  stateSelect.value = state.urban.state;
  stateSelect.disabled = state.urban.country === "all";

  const popSelect = $("#urbanPopGroup");
  POP_GROUP_OPTIONS.forEach((option) => popSelect.appendChild(createOption(option.value, populationOptionLabel(option))));
  popSelect.value = state.urban.popGroup;

  const topNSelect = $("#urbanTopN");
  TOP_N_OPTIONS.forEach((option) => topNSelect.appendChild(createOption(String(option), topNOptionLabel(option))));
  topNSelect.value = String(state.urban.topN);

  renderRankList();

  $("#urbanCountry").addEventListener("change", (event) => {
    state.urban.country = event.target.value;
    state.urban.state = "all";
    void render();
  });
  $("#urbanState").addEventListener("change", (event) => {
    state.urban.state = event.target.value;
    void render();
  });
  $("#urbanPopGroup").addEventListener("change", (event) => {
    state.urban.popGroup = event.target.value;
    void render();
  });
  $("#urbanTopN").addEventListener("change", (event) => {
    state.urban.topN = normalizeTopN(event.target.value);
    void render();
  });
  $("#urbanSearch").addEventListener("change", (event) => {
    state.urban.search = event.target.value;
    void render();
  });
  $("#hazardWeight").addEventListener("input", (event) => {
    state.urban.weights.hazardWeight = Number(event.target.value);
    void render();
  });
  bindWeightSlider("weightFlood", "hazardComponents", "flood");
  bindWeightSlider("weightDrought", "hazardComponents", "drought");
  bindWeightSlider("weightWildfire", "hazardComponents", "wildfire");
  bindWeightSlider("weightGDP", "adaptiveCapacity", "gdp");
  bindWeightSlider("weightHDI", "adaptiveCapacity", "hdi");
  $("#toggleUrbanMunicipal").addEventListener("change", (event) => {
    state.urban.showMunicipal = event.target.checked;
    void render();
  });
  $("#zoomCountry").addEventListener("click", () => {
    if (state.urban.country !== "all") zoomToCountry(state.urban.country);
  });
  $("#exportFilteredCsv").addEventListener("click", exportFilteredCities);
  $("#resetWeights").addEventListener("click", () => {
    state.urban.weights = {
      hazardWeight: state.config.weights.hazard_weight,
      hazardComponents: { ...state.config.weights.hazard_components },
      adaptiveCapacity: { ...state.config.weights.adaptive_capacity },
    };
    void render();
  });
}

function bindWeightSlider(id, bucket, key) {
  const el = $(`#${id}`);
  if (!el) return;
  el.addEventListener("input", (event) => {
    state.urban.weights[bucket][key] = Number(event.target.value);
    void render();
  });
}

function renderRankList() {
  const rankList = $("#rankList");
  clearChildren(rankList);
  state.urbanResults.ranked.forEach((row, index) => {
    const button = document.createElement("button");
    button.className = `rank-item ${row.uid === state.urban.selectedCityId ? "active" : ""}`;
    button.innerHTML = `
      <span class="rank-order">${index + 1}</span>
      <span class="rank-copy">
        <strong>${row.ADM2_NAME}</strong>
        <small>${row.ADM1_NAME}, ${row.ADM0_NAME}</small>
      </span>
      <span class="rank-metric">${fmtNumber(row.priority, 1)}</span>
    `;
    button.addEventListener("click", () => {
      void selectUrbanCity(row.uid);
    });
    rankList.appendChild(button);
  });
}

async function selectUrbanCity(uid, { preserveMapView = false } = {}) {
  state.urban.selectedCityId = uid;
  openMobilePanel("detail");
  renderRankList();
  await renderUrbanDetail();
  await renderUrbanMap({ preserveView: preserveMapView });
  dom.detail.scrollTop = 0;
  if (isMobileLayout()) {
    dom.detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function computeUrbanResults() {
  const cities = await ensureCityPoints();
  state.urbanDynamic = buildDynamicMunicipalClasses(cities, state.urban.weights);
  state.urbanResults = buildPriorityRows(
    cities,
    {
      country: state.urban.country,
      state: state.urban.state,
      popGroup: state.urban.popGroup,
      rankBy: state.urban.rankBy,
      topN: state.urban.topN,
      search: state.urban.search,
    },
    state.urban.weights,
  );
  state.urbanResults.ranked = state.urbanResults.ranked.map((row) => ({
    ...row,
    ...(dynamicClassFor(row) || {}),
  }));
  if (!state.urbanResults.ranked.find((row) => row.uid === state.urban.selectedCityId)) {
    state.urban.selectedCityId = state.urbanResults.ranked[0]?.uid || null;
  }
}

async function renderUrbanMap({ preserveView = false } = {}) {
  clearLayer(state.map.primaryLayer);
  clearLayer(state.map.countriesLayer);
  clearLayer(state.map.atlasCityLayer);
  clearLayer(state.map.atlasMunicipalLayer);
  clearLayer(state.map.urbanCityLayer);
  clearLayer(state.map.urbanMunicipalLayer);
  clearLayer(state.map.selectedCityHighlight);
  clearLayer(state.map.pixelMarker);
  dom.legendChip.textContent = t("status.cityPriorities");

  const countries = await ensureCountriesLayer();
  state.map.countriesLayer = L.geoJSON(countries, {
    pane: "countriesPane",
    style: () => ({ color: "#4d5b63", weight: 1.1, fillOpacity: 0 }),
  }).addTo(state.map.instance);

  if (state.urban.showMunicipal) {
    const municipal = await ensureMunicipalClasses();
    const activeCityIds = new Set(state.urbanResults.ranked.map((row) => row.ADM2_CODE));
    state.map.urbanMunicipalLayer = L.geoJSON(municipal, {
      pane: "urbanMunicipalPane",
      filter: (feature) =>
        state.urban.country === "all" || feature.properties.ADM0_NAME === state.urban.country,
      style: (feature) => ({
        color: "#ffffff",
        weight: activeCityIds.has(feature.properties.ADM2_CODE) ? 0.55 : 0.28,
        fillColor: MUNICIPAL_COLORS[municipalClassForFeature(feature)] || "#cccccc",
        fillOpacity: activeCityIds.has(feature.properties.ADM2_CODE) ? 0.52 : 0.22,
      }),
    }).addTo(state.map.instance);
  }

  state.map.urbanCityLayer = L.layerGroup(
    state.urbanResults.ranked.map((row) =>
      L.circleMarker([row.point_lat, row.point_lon], {
        pane: "urbanCitiesPane",
        radius: markerRadius(row.TotPop),
        color: row.uid === state.urban.selectedCityId ? "#111111" : "#3b3b3b",
        weight: row.uid === state.urban.selectedCityId ? 1.4 : 0.8,
        fillColor: row.tier === 1 ? "#d62828" : row.tier === 2 ? "#f08c1a" : row.tier === 3 ? "#f6bd60" : "#b7b7b7",
        fillOpacity: 0.82,
      })
        .bindTooltip(`${row.ADM2_NAME}, ${row.ADM0_NAME}<br>${t("urban.clickTooltip")}`, {
          direction: "top",
          sticky: true,
          opacity: 0.92,
        })
        .on("mouseover", (event) => {
          event.target.setStyle({ weight: 1.8, color: "#111111" });
        })
        .on("mouseout", (event) => {
          event.target.setStyle({
            weight: row.uid === state.urban.selectedCityId ? 1.4 : 0.8,
            color: row.uid === state.urban.selectedCityId ? "#111111" : "#3b3b3b",
          });
        })
        .on("click", (event) => {
          if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
          void selectUrbanCity(row.uid, { preserveMapView: true });
        }),
    ),
  ).addTo(state.map.instance);

  const selected = selectedCity();
  if (selected) {
    state.map.selectedCityHighlight = L.circleMarker([selected.point_lat, selected.point_lon], {
      pane: "highlightPane",
      radius: markerRadius(selected.TotPop) + 4,
      color: "#ffffff",
      weight: 2,
      fillOpacity: 0,
      dashArray: "4 3",
    }).addTo(state.map.instance);
  }

  if (!preserveView) {
    if (state.urban.country !== "all") zoomToCountry(state.urban.country);
    else if (selected) state.map.instance.setView([selected.point_lat, selected.point_lon], 5);
  }

  const municipalLabel = state.urban.showMunicipal ? t("status.liveClasses") : t("status.noClasses");
  dom.mapStatus.textContent = t("status.urban", {
    shown: fmtInteger(state.urbanResults.ranked.length),
    total: fmtInteger(state.urbanResults.filteredCount),
    classes: municipalLabel,
  });
}

function selectedCity() {
  return state.urbanResults.ranked.find((row) => row.uid === state.urban.selectedCityId) || null;
}

function chartPointForCity(city) {
  const metrics = priorityScore(city, state.urban.weights);
  const dynamicClass = dynamicClassFor(city);
  return {
    ...city,
    chart_hazard: Number(city.dynamic_hazard ?? dynamicClass?.dynamic_hazard ?? metrics.hazard),
    chart_socio: Number(city.dynamic_socio ?? dynamicClass?.dynamic_socio ?? metrics.capacity),
    chart_class: city.dynamic_cluster ?? dynamicClass?.dynamic_cluster ?? city.city_cluster,
  };
}

function priorityChartRows() {
  return state.urbanResults.ranked
    .filter((city) => Number.isFinite(Number(city.point_lon)) && Number.isFinite(Number(city.point_lat)))
    .map(chartPointForCity)
    .filter((city) => Number.isFinite(city.chart_hazard) && Number.isFinite(city.chart_socio));
}

function nearestCentroidIndex(point, centroids) {
  return centroids.reduce(
    (best, centroid, index) => {
      const distance = ((point.hazard - centroid.hazard) ** 2) + ((point.socio - centroid.socio) ** 2);
      return distance < best.distance ? { index, distance } : best;
    },
    { index: 0, distance: Infinity },
  ).index;
}

function discreteColorscale(colors) {
  if (colors.length === 1) return [[0, colors[0]], [1, colors[0]]];
  const step = 1 / (colors.length - 1);
  return colors.flatMap((color, index) => {
    if (index === 0) return [[0, color], [step / 2, color]];
    if (index === colors.length - 1) return [[1 - (step / 2), color], [1, color]];
    return [[(index * step) - (step / 2), color], [(index * step) + (step / 2), color]];
  });
}

function kmeansRegionHeatmap(centroids) {
  const size = 42;
  const x = Array.from({ length: size }, (_, index) => index / (size - 1));
  const y = Array.from({ length: size }, (_, index) => index / (size - 1));
  const labelIndex = new Map(MUNICIPAL_CLASS_LABELS.map((label, index) => [label, index]));
  const z = y.map((socio) =>
    x.map((hazard) => {
      const centroid = centroids[nearestCentroidIndex({ hazard, socio }, centroids)];
      return labelIndex.get(centroid.label) ?? 0;
    }),
  );
  return {
    type: "heatmap",
    x,
    y,
    z,
    zmin: 0,
    zmax: MUNICIPAL_CLASS_LABELS.length - 1,
    colorscale: discreteColorscale(MUNICIPAL_CLASS_LABELS.map((label) => MUNICIPAL_COLORS[label])),
    opacity: 0.17,
    showscale: false,
    hoverinfo: "skip",
  };
}

function kmeansBoundaryTrace(centroids) {
  const size = 90;
  const labels = Array.from({ length: size }, (_, yIndex) =>
    Array.from({ length: size }, (_, xIndex) =>
      nearestCentroidIndex({ hazard: xIndex / (size - 1), socio: yIndex / (size - 1) }, centroids),
    ),
  );
  const x = [];
  const y = [];
  const addSegment = (x1, y1, x2, y2) => {
    x.push(x1, x2, null);
    y.push(y1, y2, null);
  };

  for (let yIndex = 0; yIndex < size - 1; yIndex += 1) {
    for (let xIndex = 0; xIndex < size - 1; xIndex += 1) {
      const x0 = xIndex / (size - 1);
      const x1 = (xIndex + 1) / (size - 1);
      const y0 = yIndex / (size - 1);
      const y1 = (yIndex + 1) / (size - 1);
      if (labels[yIndex][xIndex] !== labels[yIndex][xIndex + 1]) addSegment((x0 + x1) / 2, y0, (x0 + x1) / 2, y1);
      if (labels[yIndex][xIndex] !== labels[yIndex + 1][xIndex]) addSegment(x0, (y0 + y1) / 2, x1, (y0 + y1) / 2);
    }
  }

  return {
    type: "scatter",
    mode: "lines",
    x,
    y,
    line: { color: "#1d2b31", width: 1.5, dash: "dash" },
    hoverinfo: "skip",
    showlegend: false,
  };
}

async function ensureCityRasterValues() {
  if (!state.datasets.cityRasterValues) {
    const url = state.config.city_meta.city_raster_values_url || "data/cities/city_raster_values.json";
    state.datasets.cityRasterValues = await fetchJson(`./${url}`);
  }
  return state.datasets.cityRasterValues;
}

function selectedCityRasterValues(city, rasterPayload) {
  const key = String(city.ADM2_CODE ?? city.uid);
  return rasterPayload?.cities?.[key] || null;
}

function fmtRasterValue(value, digits = 3) {
  if (value === null || value === undefined || value === "") return t("common.na");
  if (typeof value === "number") return fmtNumber(value, digits);
  return String(value);
}

function rasterRowsForCsv(city, rasterRecord) {
  return (rasterRecord?.values || []).map((row) => ({
    country: city.ADM0_NAME,
    state: city.ADM1_NAME,
    city: city.ADM2_NAME,
    adm2_code: city.ADM2_CODE,
    raster_id: row.id,
    raster_name: row.label,
    value: row.value,
    standard_deviation: row.std,
    pixel_count: row.count,
    units: row.units,
  }));
}

function renderCityRasterTable(rasterRecord) {
  if (!rasterRecord) {
    return `<p class="legend-note">${state.language === "pt" ? "Os resumos raster não estão disponíveis para esta cidade." : "Raster summaries are unavailable for this city."}</p>`;
  }
  return `
    <div class="raster-table-wrap">
      <table class="raster-table">
        <thead>
          <tr>
            <th>Raster</th>
            <th>${t("common.mean")}</th>
            <th>${t("common.std")}</th>
            <th>${t("common.pixels")}</th>
            <th>${t("common.units")}</th>
          </tr>
        </thead>
        <tbody>
          ${rasterRecord.values
            .map(
              (row) => `
              <tr>
                <td>${row.label}</td>
                <td>${fmtRasterValue(row.value)}</td>
                <td>${fmtRasterValue(row.std)}</td>
                <td>${row.count == null ? t("common.na") : fmtInteger(Number(row.count))}</td>
                <td>${row.units}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function renderUrbanDetail() {
  const city = selectedCity();
  if (!city) {
    dom.detailBody.innerHTML = `
      <section class="detail-head">
        <span class="eyebrow">${t("common.cityDetail")}</span>
        <h2>${t("common.noCitySelected")}</h2>
        <p>${t("common.selectCity")}</p>
      </section>
    `;
    return;
  }

  const metrics = priorityScore(city, state.urban.weights);
  const rasterPayload = await ensureCityRasterValues();
  const rasterRecord = selectedCityRasterValues(city, rasterPayload);
  const tierColor = city.tier === 1 ? "#d62828" : city.tier === 2 ? "#f08c1a" : city.tier === 3 ? "#f6bd60" : "#8aa4bd";
  dom.detailBody.innerHTML = `
    <section class="detail-head">
      <span class="eyebrow">${t("common.cityDetail")}</span>
      <div class="title-row">
        <div>
          <h2>${city.ADM2_NAME}</h2>
          <p>${city.ADM1_NAME}, ${city.ADM0_NAME}</p>
        </div>
        <span class="tier-badge" style="background:${tierColor}">${city.label}</span>
      </div>
    </section>
    <section class="metric-strip detail-metrics">
      <div><span>${t("common.priority")}</span><strong>${fmtNumber(city.priority, 1)}</strong></div>
      <div><span>${t("common.hazard")}</span><strong>${fmtNumber(metrics.hazard, 3)}</strong></div>
      <div><span>${t("common.capacityNeed")}</span><strong>${fmtNumber(metrics.vulnerability, 3)}</strong></div>
    </section>
    ${renderCityInterpretation(city, metrics)}
    <section class="detail-card">
      <div class="section-head">
        <h3>${t("urban.why")}</h3>
        <button class="toolbar-button" id="showSourceLayers">${t("urban.sourceLayers")}</button>
      </div>
      <div id="driverChart" class="plotly-chart"></div>
    </section>
    <section class="detail-card">
      <div class="section-head">
        <h3>${t("urban.rasterValues")}</h3>
        <div class="button-row">
          <button class="download-button" id="exportCityRasterCsv">${t("urban.exportCityCsv")}</button>
          <button class="download-button" id="exportCityWord">${t("urban.exportCityWord")}</button>
        </div>
      </div>
      ${renderCityRasterTable(rasterRecord)}
    </section>
    <section class="detail-card">
      <div class="section-head">
        <h3>${t("urban.cityDetails")}</h3>
      </div>
      <dl class="metadata-grid">
        <div><dt>${t("urban.mainHazard")}</dt><dd>${hazardName(city.dominant_hazard)}</dd></div>
        <div><dt>${t("urban.paperClass")}</dt><dd>${classLabel(city.city_cluster)}</dd></div>
        <div><dt>${t("urban.liveClass")}</dt><dd>${city.dynamic_cluster ? classLabel(city.dynamic_cluster) : t("common.na")}</dd></div>
        <div><dt>${t("urban.liveHazard")}</dt><dd>${fmtNumber(city.dynamic_hazard, 3)} ${state.language === "pt" ? "de 0 a 1" : "from 0 to 1"}</dd></div>
        <div><dt>${t("urban.liveSocio")}</dt><dd>${fmtNumber(city.dynamic_socio, 3)} ${state.language === "pt" ? "de 0 a 1" : "from 0 to 1"}</dd></div>
        <div><dt>${t("common.population")}</dt><dd>${fmtInteger(city.TotPop)}</dd></div>
        <div><dt>${t("common.populationClass")}</dt><dd>${city.PopGroup}</dd></div>
        <div><dt>${t("urban.builtUp")}</dt><dd>${fmtNumber(city.ImpRate, 3)}</dd></div>
        <div><dt>${t("urban.gdpClass")}</dt><dd>${fmtNumber(city.GDP_Class_n, 3)}</dd></div>
        <div><dt>${t("urban.hdiClass")}</dt><dd>${fmtNumber(city.HDI_n, 3)}</dd></div>
      </dl>
    </section>
    <section class="detail-card priority-chart-card">
      <div class="section-head">
        <h3>${t("urban.priorityChart")}</h3>
        <span>${t("urban.priorityChartSubtitle")}</span>
      </div>
      <p class="legend-note">${t("urban.priorityChartNote")}</p>
      <div id="priorityScatterChart" class="plotly-chart priority-scatter-chart"></div>
    </section>
  `;

  $("#showSourceLayers").addEventListener("click", () => {
    showSelectedCitySourceLayers();
    void render();
  });

  $("#exportCityRasterCsv").addEventListener("click", () => {
    const rows = rasterRowsForCsv(city, rasterRecord);
    const filename = `${slugify(city.ADM0_NAME)}_${slugify(city.ADM2_NAME)}_raster_values.csv`;
    downloadTextFile(filename, toCsv(rows), "text/csv;charset=utf-8");
  });
  $("#exportCityWord").addEventListener("click", () => {
    void runWordExport($("#exportCityWord"), () =>
      downloadCityReport({ ...city, report_weights: state.urban.weights }, metrics, rasterRecord),
    );
  });

  renderDriverChart(city, metrics);
  renderPriorityScatterChart(city);
}

function renderDriverChart(city, metrics) {
  const driverLabels =
    state.language === "pt"
      ? ["Inundação", "Seca", "Incêndio", "Capacidade PIB", "Capacidade IDH"]
      : ["Flood", "Drought", "Wildfire", "GDP capacity", "HDI capacity"];
  window.Plotly.newPlot(
    "driverChart",
    [
      {
        type: "bar",
        x: driverLabels,
        y: [
          Number(city.FSI_n || 0),
          Number(city.DSI_n || 0),
          Number(city.FRI_n || 0),
          Number(city.GDP_Class_n || 0),
          Number(city.HDI_n || 0),
        ],
        marker: {
          color: ["#2b59c3", "#c97b00", "#b22222", "#4c956c", "#5e60ce"],
        },
      },
    ],
    {
      margin: { t: 24, r: 10, b: 60, l: 40 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "#fffaf1",
      font: { family: "Source Sans 3, sans-serif", color: "#1d2b31" },
      yaxis: { range: [0, 1], title: t("urban.normalizedValue"), gridcolor: "rgba(93, 104, 112, 0.14)" },
      xaxis: { tickangle: -20 },
      annotations: [
        {
          x: 0.5,
          y: 1.12,
          xref: "paper",
          yref: "paper",
          showarrow: false,
          text: `${t("common.priority")} = ${fmtNumber(city.priority, 1)} | ${t("common.hazard")} = ${fmtNumber(metrics.hazard, 3)} | ${t("common.capacityNeed")} = ${fmtNumber(metrics.vulnerability, 3)}`,
          font: { size: 12 },
        },
      ],
    },
    { displayModeBar: false, responsive: true },
  );
}

function renderPriorityScatterChart(selected) {
  const chart = $("#priorityScatterChart");
  if (!chart) return;
  const rows = priorityChartRows();
  const centroids = state.urbanDynamic.centroids || [];
  if (!window.Plotly || !rows.length || centroids.length < 2) {
    chart.innerHTML = `<p class="legend-note">${t("urban.priorityChartEmpty")}</p>`;
    return;
  }

  const showCityLabels = rows.length < 50;
  const traces = [kmeansRegionHeatmap(centroids), kmeansBoundaryTrace(centroids)];
  MUNICIPAL_CLASS_LABELS.forEach((label) => {
    const classRows = rows.filter((row) => row.chart_class === label);
    if (!classRows.length) return;
    traces.push({
      type: "scatter",
      mode: showCityLabels ? "markers+text" : "markers",
      name: classLabel(label),
      x: classRows.map((row) => row.chart_hazard),
      y: classRows.map((row) => row.chart_socio),
      text: showCityLabels ? classRows.map((row) => row.ADM2_NAME) : undefined,
      textposition: "top center",
      textfont: { size: 10, color: "#1d2b31" },
      customdata: classRows.map((row) => [
        row.uid,
        row.ADM2_NAME,
        row.ADM1_NAME,
        row.ADM0_NAME,
        fmtNumber(row.priority, 1),
      ]),
      marker: {
        color: MUNICIPAL_COLORS[label],
        size: classRows.map((row) => (row.uid === selected?.uid ? 13 : 8)),
        symbol: classRows.map((row) => (row.uid === selected?.uid ? "diamond" : "circle")),
        opacity: 0.92,
        line: {
          color: classRows.map((row) => (row.uid === selected?.uid ? "#111111" : "#ffffff")),
          width: classRows.map((row) => (row.uid === selected?.uid ? 2.2 : 0.8)),
        },
      },
      hovertemplate:
        "<b>%{customdata[1]}</b><br>%{customdata[2]}, %{customdata[3]}<br>" +
        `${t("common.hazard")}: %{x:.3f}<br>` +
        `${t("urban.liveSocio")}: %{y:.3f}<br>` +
        `${t("common.priority")}: %{customdata[4]}<extra></extra>`,
    });
  });

  window.Plotly.newPlot(
    chart,
    traces,
    {
      margin: { t: 18, r: 10, b: 56, l: 58 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "#fffaf1",
      font: { family: "Source Sans 3, sans-serif", color: "#1d2b31", size: 11 },
      xaxis: {
        title: t("urban.priorityChartXAxis"),
        range: [-0.02, 1.02],
        zeroline: false,
        gridcolor: "rgba(93, 104, 112, 0.14)",
      },
      yaxis: {
        title: t("urban.priorityChartYAxis"),
        range: [-0.02, 1.02],
        zeroline: false,
        gridcolor: "rgba(93, 104, 112, 0.14)",
      },
      legend: {
        orientation: "h",
        x: 0,
        y: -0.22,
        bgcolor: "rgba(255,250,241,0)",
        font: { size: 10 },
      },
      hovermode: "closest",
    },
    { displayModeBar: false, responsive: true },
  );

  if (typeof chart.removeAllListeners === "function") chart.removeAllListeners("plotly_click");
  chart.on("plotly_click", (event) => {
    const uid = event.points?.find((point) => point.customdata)?.customdata?.[0];
    if (uid) void selectUrbanCity(uid, { preserveMapView: true });
  });
}

function exportFilteredCities() {
  const rows = state.urbanResults.ranked.map((row) => ({
    country: row.ADM0_NAME,
    state: row.ADM1_NAME,
    city: row.ADM2_NAME,
    priority: Number(row.priority).toFixed(3),
    hazard: Number(row.hazard).toFixed(3),
    vulnerability: Number(row.vulnerability).toFixed(3),
    paper_municipal_class: row.city_cluster,
    dynamic_municipal_class: row.dynamic_cluster,
    dynamic_hazard_index: Number(row.dynamic_hazard).toFixed(3),
    dynamic_socioeconomic_index: Number(row.dynamic_socio).toFixed(3),
    dominant_hazard: row.dominant_hazard,
    total_population: Math.round(Number(row.TotPop || 0)),
    impervious_intensity: Number(row.ImpRate || 0).toFixed(4),
  }));
  downloadTextFile("south_america_risk_atlas_filtered_cities.csv", toCsv(rows), "text/csv;charset=utf-8");
}

function renderMethodsView() {
  const grouped = groupLayers();
  const methodsCopy = state.language === "pt"
    ? {
        built: "Como o site é construído",
        staticBuild: "Pacote estático do atlas",
        staticBody: "O site é estático. Mapas, dados urbanos, testes do modelo e arquivos de download são preparados na pasta de pesquisa e copiados para este site.",
        rasterLayers: "camadas raster",
        vectorLayers: "camadas vetoriais",
        cityTool: "A ferramenta urbana inclui",
        cityPoints: "pontos urbanos e",
        cityAreas: "áreas urbanas.",
        lazyLoad: "Os mapas carregam apenas quando necessários, então a primeira tela não baixa tudo de uma vez.",
        formulaEyebrow: "Fórmula de prioridade",
        formulaTitle: "Como o valor urbano é calculado",
        formulaBody: "A ferramenta calcula perigo, capacidade, necessidade de capacidade e prioridade no navegador, usando os dados urbanos publicados no site.",
        formulaWeights: "Os pesos padrão são Inundação 0,55, Seca 0,35, Incêndio 0,10, PIB 0,40, IDH 0,60, e perigo versus necessidade de capacidade 0,60.",
        formulaClasses: "O mapa de classes urbanas atualiza perigo e capacidade com os pesos atuais e agrupa todas as áreas urbanas em quatro classes.",
        layerList: "Lista de camadas",
        mapsIncluded: "Mapas incluídos no site",
        modelChecks: "Testes do modelo",
        testComparison: "Comparação no conjunto de teste",
        modelCheck: "Teste do modelo",
        xgbHigher: "XGBoost teve ROC-AUC",
        thanSimple: "maior que o modelo ponderado simples. O conjunto de teste usou",
        rows: "linhas.",
        xgbAuc: "ROC-AUC XGB",
        simpleAuc: "ROC-AUC simples",
        topPredictors: "Principais preditores",
      }
    : {
        built: "How the site is built",
        staticBuild: "Static atlas build",
        staticBody: "The website is a static site. The maps, city files, model checks, and download files are prepared from the research folder and copied into this site.",
        rasterLayers: "raster layers",
        vectorLayers: "vector overlays",
        cityTool: "The city tool includes",
        cityPoints: "city points and",
        cityAreas: "city areas.",
        lazyLoad: "Maps load only when needed, so the first page does not download everything at once.",
        formulaEyebrow: "Priority formula",
        formulaTitle: "How the city score works",
        formulaBody: "The city tool computes hazard, capacity, capacity need, and priority in your browser using the city data shipped with the site.",
        formulaWeights: "The default weights are Flood 0.55, Drought 0.35, Wildfire 0.10, GDP 0.40, HDI 0.60, and hazard versus capacity need 0.60.",
        formulaClasses: "The city-area class map updates hazard and capacity from the current weights and groups all city areas into four classes.",
        layerList: "Layer list",
        mapsIncluded: "Maps included in the site",
        modelChecks: "Model checks",
        testComparison: "Test-set comparison",
        modelCheck: "model check",
        xgbHigher: "XGBoost scored",
        thanSimple: "higher in ROC-AUC than the simple weighted model. The test set used",
        rows: "rows.",
        xgbAuc: "XGB ROC-AUC",
        simpleAuc: "Simple ROC-AUC",
        topPredictors: "Top predictors",
      };
  const hazardCards = state.benchmarkSummary.hazards
    .map(
      (hazard) => `
      <article class="benchmark-card">
        <div class="benchmark-copy">
          <span class="eyebrow">${hazardName(hazard.hazard)}</span>
          <h3>${state.language === "pt" ? `${methodsCopy.modelCheck}: ${hazardName(hazard.hazard)}` : `${hazardName(hazard.hazard)} ${methodsCopy.modelCheck}`}</h3>
          <p>${methodsCopy.xgbHigher} ${fmtNumber(hazard.delta_roc_auc, 4)} ${methodsCopy.thanSimple} ${fmtInteger(hazard.test_n)} ${methodsCopy.rows}</p>
          <div class="metric-strip">
            <div><span>${methodsCopy.xgbAuc}</span><strong>${fmtNumber(hazard.xgb_roc_auc, 4)}</strong></div>
            <div><span>${methodsCopy.simpleAuc}</span><strong>${fmtNumber(hazard.wlc_roc_auc, 4)}</strong></div>
            <div><span>${methodsCopy.topPredictors}</span><strong>${hazard.top_3_predictors.join(", ")}</strong></div>
          </div>
        </div>
        <div class="benchmark-figures">
          <img src="./${hazard.performance_figure}" alt="${hazard.hazard} performance figure" />
          <img src="./${hazard.map_figure}" alt="${hazard.hazard} map comparison figure" />
        </div>
      </article>`,
    )
    .join("");

  dom.methodsBody.innerHTML = `
    ${renderScenarioShareCard()}
    ${renderMethodsGuideCard()}
    ${renderMethodsExportHubCard()}
    <section class="methods-grid">
      <article class="methods-card">
        <span class="eyebrow">${methodsCopy.built}</span>
        <h2>${methodsCopy.staticBuild}</h2>
        <p>${methodsCopy.staticBody}</p>
        <ul class="methods-list">
          <li>${state.catalog.filter((layer) => layer.kind === "raster").length} ${methodsCopy.rasterLayers}; ${state.catalog.filter((layer) => layer.kind === "vector").length} ${methodsCopy.vectorLayers}.</li>
          <li>${methodsCopy.cityTool} ${fmtInteger(state.config.city_meta.city_count)} ${methodsCopy.cityPoints} ${fmtInteger(state.config.city_meta.municipal_count)} ${methodsCopy.cityAreas}</li>
          <li>${methodsCopy.lazyLoad}</li>
        </ul>
      </article>
      <article class="methods-card">
        <span class="eyebrow">${methodsCopy.formulaEyebrow}</span>
        <h2>${methodsCopy.formulaTitle}</h2>
        <p>${methodsCopy.formulaBody}</p>
        <pre class="formula-block">Hazard = wF*FSI + wD*DSI + wR*FRI
Capacity = wGDP*GDP + wHDI*HDI
Capacity need = 1 - Capacity
Priority = 100 * (wH*Hazard + (1 - wH)*Capacity need)</pre>
        <p>${methodsCopy.formulaWeights}</p>
        <p>${methodsCopy.formulaClasses}</p>
      </article>
    </section>
    ${renderMethodsInterpretationCard()}
    <section class="methods-card">
      <span class="eyebrow">${methodsCopy.layerList}</span>
      <h2>${methodsCopy.mapsIncluded}</h2>
      <div class="group-catalog">
        ${grouped
          .map(
            (group) => `
            <div class="catalog-group">
              <h3>${groupTitle(group)}</h3>
              <ul>
                ${group.layers
                  .map(
                    (layer) =>
                      `<li><strong>${layerTitle(layer)}</strong> <span>${layerUnits(layer) || layer.kind}</span> <a href="./${layer.download_url}" download>${t("common.download")}</a></li>`,
                  )
                  .join("")}
              </ul>
            </div>`,
          )
          .join("")}
      </div>
    </section>
    <section class="methods-card">
      <span class="eyebrow">${methodsCopy.modelChecks}</span>
      <h2>${methodsCopy.testComparison}</h2>
      ${hazardCards}
    </section>
  `;

  $("#guideMethodsAtlas").addEventListener("click", () => {
    state.activeView = "atlas";
    void render();
  });
  $("#guideMethodsUrban").addEventListener("click", () => {
    state.activeView = "urban";
    void render();
  });
  bindScenarioShareCard();
  bindMethodsExportHub();
}

function zoomToCountry(country) {
  const bounds = state.config.city_meta.country_bounds[country];
  if (!bounds) return;
  state.map.instance.fitBounds(
    [
      [bounds[1], bounds[0]],
      [bounds[3], bounds[2]],
    ],
    { padding: [24, 24] },
  );
}
