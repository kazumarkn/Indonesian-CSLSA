// ------------------------------------------------------------
// Load netcdfjs
// ------------------------------------------------------------
import * as netcdfjs from "https://cdn.jsdelivr.net/npm/netcdfjs@1.3.1/dist/netcdfjs.esm.js";

// ------------------------------------------------------------
// NetCDF file list (your 4 files)
// ------------------------------------------------------------
const FILES = [
  {
    name: "1950–1968",
    url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part1.nc",
    start: 1950,
    end: 1968
  },
  {
    name: "1969–1987",
    url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part2.nc",
    start: 1969,
    end: 1987
  },
  {
    name: "1988–2006",
    url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part3.nc",
    start: 1988,
    end: 2006
  },
  {
    name: "2007–2025",
    url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part4.nc",
    start: 2007,
    end: 2025
  }
];

// ------------------------------------------------------------
// Leaflet map
// ------------------------------------------------------------
const map = L.map("map").setView([-2, 118], 5);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let rasterLayer = null;

// ------------------------------------------------------------
// UI elements
// ------------------------------------------------------------
const varSel = document.getElementById("variableSelect");
const yearSel = document.getElementById("yearSelect");
const monthSel = document.getElementById("monthSelect");

// ------------------------------------------------------------
// Load and parse NetCDF file
// ------------------------------------------------------------
async function loadNetCDF(url) {
  console.log("Loading NC:", url);

  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch " + url);

  const buf = await res.arrayBuffer();
  return new netcdfjs.NetCDFReader(buf);
}

// ------------------------------------------------------------
// Find file by year
// ------------------------------------------------------------
function findFile(year) {
  return FILES.find(f => year >= f.start && year <= f.end);
}

// ------------------------------------------------------------
// Initialize dropdowns once using part1 file
// ------------------------------------------------------------
async function initDropdowns() {
  const firstFile = FILES[0].url;
  const nc = await loadNetCDF(firstFile);

  // Variables
  varSel.innerHTML = "";
  nc.variables.forEach(v => {
    if (["suitability_index", "suitability_class"].includes(v.name)) {
      const opt = document.createElement("option");
      opt.value = v.name;
      opt.textContent = v.name;
      varSel.appendChild(opt);
    }
  });

  // Years 1950–2025
  yearSel.innerHTML = "";
  for (let y = 1950; y <= 2025; y++) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSel.appendChild(opt);
  }

  // Months
  monthSel.innerHTML = "";
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m.toString().padStart(2, "0");
    monthSel.appendChild(opt);
  }
}

// ------------------------------------------------------------
// Render map layer
// ------------------------------------------------------------
async function updateMap() {
  const variable = varSel.value;
  const year = parseInt(yearSel.value);
  const month = parseInt(monthSel.value);

  const file = findFile(year);
  if (!file) {
    console.error("No file for year:", year);
    return;
  }

  console.log("Using file:", file.url);

  const nc = await loadNetCDF(file.url);

  // read dimensions
  const latVar = nc.variables.find(v => v.name === "latitude");
  const lonVar = nc.variables.find(v => v.name === "longitude");
  const timeVar = nc.variables.find(v => v.name === "valid_time");
  const dataVar = nc.variables.find(v => v.name === variable);

  const lats = nc.getDataVariable(latVar);
  const lons = nc.getDataVariable(lonVar);
  const times = nc.getDataVariable(timeVar);

  // Select correct time index
  const targetStr = `${year}-${String(month).padStart(2, "0")}`;
  const timeIndex = times.findIndex(t => {
    const d = new Date(t);
    return d.getUTCFullYear() === year && (d.getUTCMonth() + 1) === month;
  });

  if (timeIndex < 0) {
    console.warn("Time not found:", targetStr);
    return;
  }

  const values = nc.getDataVariable(dataVar);
  const width = lons.length;
  const height = lats.length;

  // Extract slice
  const slice = values.slice(timeIndex * width * height,
                             (timeIndex + 1) * width * height);

  // Create Canvas manually
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(width, height);

  for (let i = 0; i < slice.length; i++) {
    const v = slice[i];
    const col = Math.floor(255 * (v / 1.0)); // scale 0–1
    img.data[i*4+0] = col;
    img.data[i*4+1] = 0;
    img.data[i*4+2] = 255 - col;
    img.data[i*4+3] = 255;
  }

  ctx.putImageData(img, 0, 0);

  if (rasterLayer) map.removeLayer(rasterLayer);

  rasterLayer = L.imageOverlay(
    canvas.toDataURL(),
    [
      [lats[0],   lons[0]],
      [lats[lats.length - 1], lons[lons.length - 1]]
    ],
    { opacity: 0.7 }
  );

  rasterLayer.addTo(map);
}

// ------------------------------------------------------------
// Attach listeners
// ------------------------------------------------------------
varSel.onchange = updateMap;
yearSel.onchange = updateMap;
monthSel.onchange = updateMap;

// ------------------------------------------------------------
// Start
// ------------------------------------------------------------
initDropdowns().then(updateMap);
