// -----------------------------
// CONFIG
// -----------------------------
// Set this to where your .tif files are hosted.
// Recommended (production): GitHub Releases base URL
// e.g. "https://github.com/<user>/<repo>/releases/download/v1/"
//
// For quick trial you can use GitHub Pages if files are small:
// e.g. "https://kazumarkn.github.io/Indonesian-CSLSA/cogs/"
const COG_BASE_URL = "https://kazumarkn.github.io/Indonesian-CSLSA/cogs/";

// variable list (must match your COG filenames prefix)
const VARIABLES = ["suitability_index", "suitability_class"];

// time range info
const START_YEAR = 1950;
const TOTAL_MONTHS = 909; // keep correct total months if needed

// convenience to build YYYY_MM from index (0-based)
function monthLabelFromIndex(i){
  const y = START_YEAR + Math.floor(i/12);
  const m = 1 + (i % 12);
  return `${y}_${String(m).padStart(2,"0")}`;
}

// -----------------------------
// UI + map init
// -----------------------------
const map = L.map("map", {center:[-2.0,118], zoom:5});

// Satellite basemap (ESRI)
const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  maxZoom: 18, attribution: "ESRI World Imagery"
}).addTo(map);

// Optional OSM base for toggle later
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19, attribution: "OSM"
});

let geoLayer = null;    // current GeoRasterLayer
let currentFilename = "";

// populate year & month dropdowns
const yearSelect = document.getElementById("yearSelect");
const monthSelect = document.getElementById("monthSelect");
const varSelect = document.getElementById("variableSelect");
const loadBtn = document.getElementById("loadBtn");
const opacityRange = document.getElementById("opacityRange");

// years: 1950 to 2025
for(let y=START_YEAR; y<= 2025; y++){
  const o = document.createElement("option"); o.value = y; o.text = y; yearSelect.appendChild(o);
}
// months 01..12
for(let m=1; m<=12; m++){
  const mm = String(m).padStart(2,"0");
  const o = document.createElement("option"); o.value = mm; o.text = mm; monthSelect.appendChild(o);
}

// -----------------------------
// Helper: build filename and URL
// -----------------------------
function buildFilename(variable, year, month){
  // variable_YYYY_MM.tif
  return `${variable}_${year}_${String(month).padStart(2,"0")}.tif`;
}
function buildURL(filename){
  return COG_BASE_URL + filename;
}

// -----------------------------
// Helper: test HEAD & range support
// -----------------------------
async function testURL(url){
  try{
    const head = await fetch(url, { method:"HEAD" });
    if(head.ok){
      // check Accept-Ranges header (may not be strictly required now)
      const ar = head.headers.get("accept-ranges");
      return { ok:true, acceptRanges: ar !== null && ar !== "none" };
    }
    // fallback small range
    const r = await fetch(url, { method:"GET", headers: { Range: "bytes=0-1" }});
    return { ok: r.ok, acceptRanges: r.status === 206 };
  } catch(err){
    console.warn("testURL error:", err);
    return { ok:false, acceptRanges:false, err };
  }
}


// -----------------------------
// Load chosen COG and display
// -----------------------------
async function loadAndDisplay(variable, year, month){
  const filename = buildFilename(variable, year, month);
  const url = buildURL(filename);
  currentFilename = filename;

  console.log("Loading COG:", url);

  const t = await testURL(url);
  if(!t.ok){
    alert("COG not accessible at: " + url + "\nCheck COG_BASE_URL and filename.");
    return;
  }
  // For trial we fetch full file (works for small files). For production with large COGs
  // we will later switch to streaming (geotiff.fromUrl with range requests).
  try{
    // show small loading indicator
    loadBtn.innerText = "Loading…";
    loadBtn.disabled = true;

    const resp = await fetch(url);
    if(!resp.ok) throw new Error("Download failed: " + resp.status);

    const arrayBuffer = await resp.arrayBuffer();
    const georaster = await parseGeoraster(arrayBuffer);

    // remove previous
    if(geoLayer){ map.removeLayer(geoLayer); geoLayer = null; }

    geoLayer = new GeoRasterLayer({
      georaster,
      opacity: parseFloat(opacityRange.value),
      resolution: 256,
      // color function — simple linear ramp (customize for your variable)
      pixelValuesToColorFn: values => {
        const v = values[0];
        if (v === null || v === undefined || isNaN(v)) return null; // transparent
        // Example: map value range to colors (tweak for your data)
        // If your suitability is categorical, you should make a categorical palette.
        const min = georaster.mins ? georaster.mins[0] : 0;
        const max = georaster.maxs ? georaster.maxs[0] : 1;
        const t = (v - min) / (max - min);
        const c = Math.max(0, Math.min(1, t));
        // simple blue→yellow→red ramp
        const r = Math.floor(255 * c);
        const g = Math.floor(255 * (1 - Math.abs(c - 0.5) * 2));
        const b = Math.floor(255 * (1 - c));
        return `rgb(${r},${g},${b})`;
      }
    });

    geoLayer.addTo(map);
    // zoom to raster bounds
    try{ map.fitBounds(geoLayer.getBounds()); } catch(e){ console.warn(e); }

    // attach click to show pixel values using GeoRasterLayer API
    map.off('click', onMapClick);
    map.on('click', onMapClick);

  } catch(err){
    console.error("Failed to load or parse COG:", err);
    alert("Failed to load COG. See console.");
  } finally {
    loadBtn.innerText = "Load / Refresh";
    loadBtn.disabled = false;
  }
}

// -----------------------------
// Click handler: read pixel value
// -----------------------------
async function onMapClick(evt){
  if(!geoLayer || !geoLayer.getValueAtLatLng) {
    L.popup().setLatLng(evt.latlng).setContent("No raster loaded").openOn(map);
    return;
  }
  try{
    const val = await geoLayer.getValueAtLatLng(evt.latlng.lat, evt.latlng.lng);
    const txt = Array.isArray(val) ? val.map((v,i)=>`B${i+1}: ${v}`).join("<br>") : `Value: ${val}`;
    L.popup().setLatLng(evt.latlng).setContent(txt + `<br><small>${currentFilename}</small>`).openOn(map);
  } catch(err){
    console.warn("Pixel read failed:", err);
  }
}

// -----------------------------
// Bind UI
// -----------------------------
loadBtn.addEventListener('click', ()=> {
  const variable = varSelect.value;
  const year = yearSelect.value;
  const month = monthSelect.value;
  loadAndDisplay(variable, year, month);
});

opacityRange.addEventListener('input', ()=> {
  const v = parseFloat(opacityRange.value);
  if(geoLayer && typeof geoLayer.setOpacity === 'function') geoLayer.setOpacity(v);
});

// load default initial
(function init(){
  // default: suitability_index, 1950-01
  yearSelect.value = "1950";
  monthSelect.value = "01";
  varSelect.value = "suitability_index";
  loadBtn.click();
})();
