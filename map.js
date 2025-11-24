// -----------------------------------------------------------
// CONFIG
// -----------------------------------------------------------
const COG_BASE_URL =
  "https://huggingface.co/datasets/rkazuma/CSLSA/resolve/main/cogs/";

const variables = ["suitability_class"];
const years = Array.from({ length: 71 }, (_, i) => 1950 + i);

// -----------------------------------------------------------
// Initialize map
// -----------------------------------------------------------
let map = L.map("map").setView([0, 118], 5);

let base = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
});
base.addTo(map);

let currentLayer = null;

// -----------------------------------------------------------
// Populate dropdowns
// -----------------------------------------------------------
const varSelect = document.getElementById("varSelect");
variables.forEach((v) => {
  let opt = document.createElement("option");
  opt.value = v;
  opt.textContent = v;
  varSelect.appendChild(opt);
});

const yearSelect = document.getElementById("yearSelect");
years.forEach((y) => {
  let opt = document.createElement("option");
  opt.value = y;
  opt.textContent = y;
  yearSelect.appendChild(opt);
});

// -----------------------------------------------------------
// Load COG function
// -----------------------------------------------------------
async function loadRaster() {
  const variable = varSelect.value;
  const year = yearSelect.value;

  const filename = `${variable}_${year}_01.tif`;
  const url = COG_BASE_URL + filename;

  console.log("Trying to load:", url);

  try {
    let response = await fetch(url);

    if (!response.ok) {
      alert("⚠️ Failed to download: " + url);
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const georaster = await parseGeoraster(arrayBuffer);

    if (currentLayer) map.removeLayer(currentLayer);

    currentLayer = new GeoRasterLayer({
      georaster,
      opacity: 0.75,
      resolution: 256,
    });

    currentLayer.addTo(map);
    map.fitBounds(currentLayer.getBounds());
  } catch (err) {
    console.error(err);
    alert("❌ Could not load COG. Check console.");
  }
}

// -----------------------------------------------------------
// Events
// -----------------------------------------------------------
varSelect.onchange = loadRaster;
yearSelect.onchange = loadRaster;

// Auto-load first layer
loadRaster();
