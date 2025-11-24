// ===============================================
// CONFIG
// ===============================================
const NETCDF_URL =
  "https://github.com/kazumarkn/Indonesian-CSLSA/releases/download/v1/arabica_suitability_all_times.nc";

const START_YEAR = 1950;
const TOTAL_MONTHS = 909; // your full time dimension

const variableList = [
  "suitability_index",
  "suitability_class",
  "mem_temp",
  "mem_precip",
  "mem_soilN",
  "mem_sw",
  "mem_elev",
  "mem_slope",
  "elevation",
  "slope_deg",
  "soilN"
];

let nc = null;
let lat = null;
let lon = null;
let map = L.map("map").setView([0, 118], 5);
let currentLayer = null;

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18
}).addTo(map);


// ===============================================
// Load NetCDF file
// ===============================================
async function loadNetCDF() {
  console.log("Downloading NetCDF...");

  const response = await fetch(NETCDF_URL);
  const arrayBuffer = await response.arrayBuffer();
  nc = new netcdfjs(arrayBuffer);

  lat = nc.getDataVariable("latitude");
  lon = nc.getDataVariable("longitude");

  console.log("NetCDF loaded:", nc);

  populateDropdowns();
  showLayer();
}


// ===============================================
// Create dropdown values
// ===============================================
function populateDropdowns() {
  const varSel = document.getElementById("varSelect");
  variableList.forEach(v => {
    let opt = document.createElement("option");
    opt.value = opt.textContent = v;
    varSel.appendChild(opt);
  });

  const yearSel = document.getElementById("yearSelect");
  for (let y = 1950; y <= 2025; y++) {
    let opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSel.appendChild(opt);
  }

  const monthSel = document.getElementById("monthSelect");
  const names = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  names.forEach((m,i) => {
    let opt = document.createElement("option");
    opt.value = i+1;
    opt.textContent = m;
    monthSel.appendChild(opt);
  });
}


// ===============================================
// Compute 0-based time index from year + month
// ===============================================
function computeTimeIndex(year, month) {
  return (year - START_YEAR) * 12 + (month - 1);
}


// ===============================================
// Main function: show layer
// ===============================================
async function showLayer() {
  if (!nc) return;

  const variable = document.getElementById("varSelect").value;
  const year = parseInt(document.getElementById("yearSelect").value);
  const month = parseInt(document.getElementById("monthSelect").value);

  const tIndex = computeTimeIndex(year, month);
  if (tIndex < 0 || tIndex >= TOTAL_MONTHS) {
    alert("Time index out of range");
    return;
  }

  console.log(`Loading ${variable} at T=${tIndex}`);

  const varObj = nc.variables.find(v => v.name === variable);

  let data2D;

  if (varObj.dimensions.length === 3) {
    // time-lat-lon
    const raw = nc.getDataVariable(variable);
    // reshape slice tIndex into 2D [lat,lon]
    const tsize = varObj.dimensions[0].size;
    const ysize = varObj.dimensions[1].size;
    const xsize = varObj.dimensions[2].size;

    data2D = [];
    let base = tIndex * ysize * xsize;
    for (let y = 0; y < ysize; y++) {
      data2D[y] = Array.from(
        raw.slice(base + y * xsize, base + (y+1) * xsize)
      );
    }

  } else {
    // static 2D variable
    data2D = [];
    const raw = nc.getDataVariable(variable);
    const ysize = varObj.dimensions[0].size;
    const xsize = varObj.dimensions[1].size;

    for (let y = 0; y < ysize; y++) {
      data2D[y] = Array.from(
        raw.slice(y * xsize, (y+1) * xsize)
      );
    }
  }

  // remove previous layer
  if (currentLayer) map.removeLayer(currentLayer);

  const georaster = {
    rasterType: "geotiff",
    values: [data2D],
    xmin: Math.min(...lon),
    xmax: Math.max(...lon),
    ymax: Math.max(...lat),
    ymin: Math.min(...lat),
    pixelHeight: Math.abs(lat[1] - lat[0]),
    pixelWidth: Math.abs(lon[1] - lon[0]),
    noDataValue: -9999
  };

  currentLayer = new GeoRasterLayer({
    georaster,
    opacity: 0.8,
    resolution: 256
  });

  currentLayer.addTo(map);
  map.fitBounds(currentLayer.getBounds());
}


// ===============================================
// Events
// ===============================================
document.getElementById("varSelect").onchange = showLayer;
document.getElementById("yearSelect").onchange = showLayer;
document.getElementById("monthSelect").onchange = showLayer;


// ===============================================
// Start
// ===============================================
loadNetCDF();
