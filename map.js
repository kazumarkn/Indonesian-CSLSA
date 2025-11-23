// =========================
// CONFIGURATION
// =========================

// List of variables you generated as COGs
const variables = [
  "suitability_class",
  "mem_temp",
  "mem_precip",
  "mem_soiln",
  "mem_sw",
  "mem_elev",
  "mem_slope"
];

// Years from 1950 → 2025 (909 months)
const years = [];
for (let y = 1950; y <= 2025; y++) years.push(y);

// =========================
// LEAFLET MAP INIT
// =========================
let map = L.map("map").setView([-2, 117], 5); // center of Indonesia

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
}).addTo(map);

let currentLayer = null;

// =========================
// UI POPULATION
// =========================
let varSelect = document.getElementById("varSelect");
let yearSelect = document.getElementById("yearSelect");

// populate variable list
variables.forEach(v => {
  let opt = document.createElement("option");
  opt.value = v;
  opt.textContent = v;
  varSelect.appendChild(opt);
});

// populate years
years.forEach(y => {
  let opt = document.createElement("option");
  opt.value = y;
  opt.textContent = y;
  yearSelect.appendChild(opt);
});

// =========================
// FUNCTION: LOAD COG TILE
// =========================
function loadCOG() {

  let variable = varSelect.value;
  let year = parseInt(yearSelect.value);

  // Default to JANUARY for now
  let date_label = `${year}_01`;

  let url = `https://kazumarkn.github.io/Indonesian-CSLSA/cogs/${variable}_${date_label}.tif`;

  console.log("Loading:", url);

  fetch(url)
    .then(res => res.arrayBuffer())
    .then(buffer => parseGeoraster(buffer))
    .then(georaster => {

      if (currentLayer) map.removeLayer(currentLayer);

      currentLayer = new GeoRasterLayer({
        georaster: georaster,
        opacity: 0.75,
        resolution: 256
      });

      currentLayer.addTo(map);
      map.fitBounds(currentLayer.getBounds());
    })
    .catch(err => console.error("Failed loading COG:", err));
}

// =========================
// EVENT LISTENERS
// =========================
varSelect.onchange = loadCOG;
yearSelect.onchange = loadCOG;

// Auto-load defaults
window.onload = loadCOG;
