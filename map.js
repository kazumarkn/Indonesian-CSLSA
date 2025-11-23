// =====================================================
// Configuration
// =====================================================

// Your GitHub Pages COG folder
const COG_BASE_URL = "https://kazumarkn.github.io/Indonesian-CSLSA/cogs/";

// Variables you generated from Python
const VARIABLES = [
  "suitability_class",
  "mem_temp",
  "mem_precip",
  "mem_soiln",
  "mem_sw",
  "mem_elev",
  "mem_slope"
];

// Generate list of YYYY_MM (1950-01 → 2025-09)
let YEARS = [];
let startYear = 1950;
let totalMonths = 100;
for (let i = 0; i < totalMonths; i++) {
    let y = startYear + Math.floor(i / 12);
    let m = 1 + (i % 12);
    YEARS.push(`${y}_${String(m).padStart(2, '0')}`);
}


// =====================================================
// Initialize Map
// =====================================================

let map = L.map("map").setView([ -2.5, 118 ], 5);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap"
}).addTo(map);


// =====================================================
// TIFF Layer handling
// =====================================================

let currentLayer = null;

async function loadCOG(variable, dateLabel) {
    const url = `${COG_BASE_URL}${variable}_${dateLabel}.tif`;
    console.log("Loading:", url);

    if (currentLayer) {
        map.removeLayer(currentLayer);
    }

    try {
        const tiff = await GeoTIFF.fromUrl(url);
        const image = await tiff.getImage();
        const rasters = await image.readRasters();
        const values = rasters[0];

        const [minX, minY, maxX, maxY] = image.getBoundingBox();

        currentLayer = L.imageOverlay(
            url,
            [[minY, minX], [maxY, maxX]],
            { opacity: 0.75 }
        );

        currentLayer.addTo(map);

        console.log("COG loaded successfully.");
    }
    catch (err) {
        console.error("Failed loading:", url);
        alert("❌ Failed to load COG. Check filename:\n" + url);
    }
}


// =====================================================
// Populate UI menus
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    const varSelect = document.getElementById("variableSelect");
    const yearSelect = document.getElementById("yearSelect");

    VARIABLES.forEach(v => {
        let opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        varSelect.appendChild(opt);
    });

    YEARS.forEach(t => {
        let opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        yearSelect.appendChild(opt);
    });

    // Default load
    loadCOG(VARIABLES[0], YEARS[0]);

    document.getElementById("loadBtn").addEventListener("click", () => {
        const v = varSelect.value;
        const d = yearSelect.value;
        loadCOG(v, d);
    });
});
