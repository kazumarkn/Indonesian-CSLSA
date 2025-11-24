/********************************************************************
 *  CONFIG: 4 PART FILES (GitHub Pages – CORS SAFE)
 ********************************************************************/
const ncFiles = [
    { start: 1950, end: 1968, url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part1.nc" },
    { start: 1969, end: 1987, url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part2.nc" },
    { start: 1988, end: 2006, url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part3.nc" },
    { start: 2007, end: 2025, url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part4.nc" }
];

const availableVariables = [
    "suitability_index",
    "suitability_class"
];

/********************************************************************
 *  LEAFLET MAP
 ********************************************************************/
let map = L.map("map").setView([-2, 118], 5); // Indonesia center

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 13
}).addTo(map);

let rasterLayer = null;

/********************************************************************
 *  HELPERS
 ********************************************************************/
function pickFileForYear(year) {
    return ncFiles.find(f => year >= f.start && year <= f.end);
}

/********************************************************************
 *  LOAD NETCDF FILE
 ********************************************************************/
async function loadNetCDF(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to load NetCDF");
    const arrayBuffer = await response.arrayBuffer();
    return new NetCDFReader(arrayBuffer);
}

/********************************************************************
 *  PARSE DATE INDEX
 ********************************************************************/
function parseDates(validTimeVar) {
    let dates = [];
    for (let i = 0; i < validTimeVar.length; i++) {
        dates.push(new Date(validTimeVar[i]));  // Already datetime
    }
    return dates;
}

/********************************************************************
 *  RENDER RASTER TO CANVAS
 ********************************************************************/
function drawRaster(lat, lon, data2D) {
    if (rasterLayer) {
        map.removeLayer(rasterLayer);
        rasterLayer = null;
    }

    const latMin = Math.min(...lat);
    const latMax = Math.max(...lat);
    const lonMin = Math.min(...lon);
    const lonMax = Math.max(...lon);

    const bounds = [[latMin, lonMin], [latMax, lonMax]];

    rasterLayer = L.imageOverlay.canvas(bounds, {
        opacity: 0.85
    });

    rasterLayer.onAdd = function () {
        const canvas = this._image;
        const ctx = canvas.getContext("2d");

        const rows = data2D.length;
        const cols = data2D[0].length;

        canvas.width = cols;
        canvas.height = rows;

        const imgData = ctx.createImageData(cols, rows);

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const value = data2D[y][x];

                let r = 0, g = 0, b = 0;

                if (!isNaN(value)) {
                    if (value < 0.3) { r = 0; g = 0; b = 200; }
                    else if (value < 0.6) { r = 0; g = 200; b = 0; }
                    else { r = 200; g = 0; b = 0; }
                }

                let i = (y * cols + x) * 4;
                imgData.data[i] = r;
                imgData.data[i + 1] = g;
                imgData.data[i + 2] = b;
                imgData.data[i + 3] = 255;
            }
        }

        ctx.putImageData(imgData, 0, 0);
    };

    rasterLayer.addTo(map);
    map.fitBounds(bounds);
}

/********************************************************************
 *  UPDATE MAP WHEN USER CHANGES SETTINGS
 ********************************************************************/
async function updateMap() {
    const variable = document.getElementById("variableSelect").value;
    const year = parseInt(document.getElementById("yearSelect").value);
    const month = parseInt(document.getElementById("monthSelect").value);

    const file = pickFileForYear(year);
    if (!file) {
        console.error("Year not in dataset.");
        return;
    }

    console.log("Loading:", file.url);

    const nc = await loadNetCDF(file.url);

    const lat = nc.getDataVariable("latitude");
    const lon = nc.getDataVariable("longitude");
    const vt = nc.getDataVariable("valid_time");

    const dates = parseDates(vt);

    let index = dates.findIndex(d => d.getUTCFullYear() === year && (d.getUTCMonth() + 1) === month);
    if (index === -1) {
        console.error("Date not found in NetCDF");
        return;
    }

    const raw = nc.getDataVariable(variable);
    let slice = [];

    for (let i = 0; i < lat.length; i++) {
        let row = [];
        for (let j = 0; j < lon.length; j++) {
            row.push(raw[index][i][j]);
        }
        slice.push(row);
    }

    drawRaster(lat, lon, slice);
}

/********************************************************************
 *  INITIALIZE UI
 ********************************************************************/
async function initialize() {
    // Fill variable dropdown
    const varSel = document.getElementById("variableSelect");
    availableVariables.forEach(v => {
        let opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        varSel.appendChild(opt);
    });

    // Extract year range from part files
    let allYears = [];
    ncFiles.forEach(f => {
        for (let y = f.start; y <= f.end; y++) allYears.push(y);
    });

    const yearSel = document.getElementById("yearSelect");
    allYears.forEach(y => {
        let opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y;
        yearSel.appendChild(opt);
    });

    // Month dropdown
    const monthSel = document.getElementById("monthSelect");
    for (let m = 1; m <= 12; m++) {
        let opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        monthSel.appendChild(opt);
    }

    // Attach change events
    varSel.onchange = updateMap;
    yearSel.onchange = updateMap;
    monthSel.onchange = updateMap;

    // Load initial
    updateMap();
}

initialize();
