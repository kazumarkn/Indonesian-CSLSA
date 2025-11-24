// -----------------------------
// CONFIG
// -----------------------------
const FILES = [
    { start: 1950, end: 1968, url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part1.nc" },
    { start: 1969, end: 1987, url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part2.nc" },
    { start: 1988, end: 2006, url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part3.nc" },
    { start: 2007, end: 2025, url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part4.nc" }
];

// Global state
let map, rasterLayer;
let ncCache = {}; // cache loaded files
let times = [];
let lat = [];
let lon = [];
let variables = [];


// -----------------------------
// INIT MAP
// -----------------------------
function initMap() {
    map = L.map("map").setView([0, 118], 5);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 10
    }).addTo(map);
}


// -----------------------------
// LOAD NETCDF FILE
// -----------------------------
async function loadNetCDF(url) {
    console.log("Loading NC:", url);

    if (ncCache[url]) {
        console.log("Using cached:", url);
        return ncCache[url];
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error("Fetch failed: " + response.status);

    const arrayBuffer = await response.arrayBuffer();
    const reader = new netcdfjs.NetCDFReader(arrayBuffer);

    ncCache[url] = reader;
    return reader;
}


// -----------------------------
// FIND FILE FOR YEAR
// -----------------------------
function chooseFile(year) {
    return FILES.find(f => year >= f.start && year <= f.end).url;
}


// -----------------------------
// FILL DROPDOWNS
// -----------------------------
async function initDropdowns() {
    // Load first file only to read info
    const reader = await loadNetCDF(FILES[0].url);

    variables = reader.variables
        .map(v => v.name)
        .filter(v => !["latitude", "longitude", "valid_time"].includes(v));

    lat = reader.getDataVariable("latitude");
    lon = reader.getDataVariable("longitude");

    const t_raw = reader.getDataVariable("valid_time");

    // Convert NetCDF time → JS datetime
    times = t_raw.map(t => new Date(t));

    // Fill variable dropdown
    const varSel = document.getElementById("variableSelect");
    variables.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        varSel.appendChild(opt);
    });

    // Generate year & month list 1950–2025
    const years = [];
    for (let y = 1950; y <= 2025; y++) years.push(y);

    const yearSel = document.getElementById("yearSelect");
    years.forEach(y => {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSel.appendChild(opt);
    });

    const monthSel = document.getElementById("monthSelect");
    for (let m = 1; m <= 12; m++) {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m.toString().padStart(2, "0");
        monthSel.appendChild(opt);
    }
}


// -----------------------------
// UPDATE MAP
// -----------------------------
async function updateMap() {
    const variable = document.getElementById("variableSelect").value;
    const year = parseInt(document.getElementById("yearSelect").value);
    const month = parseInt(document.getElementById("monthSelect").value);

    const url = chooseFile(year);

    console.log("Selected →", variable, year, month);
    console.log("File →", url);

    try {
        const reader = await loadNetCDF(url);

        const t_raw = reader.getDataVariable("valid_time");
        const t_dates = t_raw.map(t => new Date(t));

        const idx = t_dates.findIndex(d =>
            d.getUTCFullYear() === year &&
            d.getUTCMonth() + 1 === month
        );

        if (idx === -1) {
            console.warn("No matching timestep!");
            return;
        }

        const data3d = reader.getDataVariable(variable);
        const slice = data3d.slice(idx * lat.length * lon.length,
                                  (idx + 1) * lat.length * lon.length);

        // Convert 1D into 2D
        let grid = [];
        for (let i = 0; i < lat.length; i++) {
            grid.push(slice.slice(i * lon.length, (i + 1) * lon.length));
        }

        showRaster(grid);
    }
    catch (err) {
        console.error("Error updating map:", err);
    }
}


// -----------------------------
// DRAW RASTER USING Leaflet canvas
// -----------------------------
function showRaster(grid) {

    if (rasterLayer) map.removeLayer(rasterLayer);

    const latMin = Math.min(...lat);
    const latMax = Math.max(...lat);
    const lonMin = Math.min(...lon);
    const lonMax = Math.max(...lon);

    const bounds = [[latMin, lonMin], [latMax, lonMax]];

    rasterLayer = L.imageOverlay.canvas(bounds, {
        opacity: 0.8
    });

    rasterLayer.drawCanvas = (canvas, map) => {
        let ctx = canvas.getContext("2d");
        let w = canvas.width;
        let h = canvas.height;
        let imgData = ctx.createImageData(w, h);
        let d = imgData.data;

        for (let y = 0; y < h; y++) {
            let iy = Math.floor((y / h) * grid.length);
            for (let x = 0; x < w; x++) {
                let ix = Math.floor((x / w) * grid[0].length);
                let v = grid[iy][ix];

                let c = v ? 255 - (v % 255) : 0;

                const idx = (y * w + x) * 4;
                d[idx] = c;
                d[idx + 1] = 0;
                d[idx + 2] = 255 - c;
                d[idx + 3] = 200;
            }
        }

        ctx.putImageData(imgData, 0, 0);
    };

    rasterLayer.addTo(map);
    map.fitBounds(bounds);
}


// -----------------------------
// MAIN
// -----------------------------
initMap();
initDropdowns().then(() => {
    document.getElementById("variableSelect").onchange = updateMap;
    document.getElementById("yearSelect").onchange = updateMap;
    document.getElementById("monthSelect").onchange = updateMap;

    // First draw
    updateMap();
});
