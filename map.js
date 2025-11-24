// ----------------------------
//  CONFIG: FILE LIST
// ----------------------------
const ncFiles = [
    {
        start: 1950,
        end: 1968,
        url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part1.nc"
    },
    {
        start: 1969,
        end: 1987,
        url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part2.nc"
    },
    {
        start: 1988,
        end: 2006,
        url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part3.nc"
    },
    {
        start: 2007,
        end: 2025,
        url: "https://kazumarkn.github.io/Indonesian-CSLSA/arabica_suitability_part4.nc"
    }
];

// ----------------------------
//  LEAFLET MAP INITIALIZATION
// ----------------------------
const map = L.map("map").setView([-2, 118], 5);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18
}).addTo(map);

let rasterLayer = null;

// ----------------------------
//  HELPER FUNCTIONS
// ----------------------------
function getFileForYear(year) {
    return ncFiles.find(f => year >= f.start && year <= f.end).url;
}

async function loadNetCDF(url) {
    console.log("Loading:", url);

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    return new NetCDFReader(arrayBuffer);
}

function extractYearMonthIndices(reader, year, month) {
    const timeVar = reader.variables.find(v => v.name === "valid_time");
    const times = reader.getDataVariable("valid_time");

    const dates = times.map(t => new Date(t));

    const index = dates.findIndex(d =>
        d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month
    );

    if (index === -1) return null;

    return index;
}

function createRaster(reader, variable, tIndex) {
    const lat = reader.getDataVariable("latitude");
    const lon = reader.getDataVariable("longitude");

    const raw = reader.getDataVariable(variable);

    const height = lat.length;
    const width = lon.length;

    // raw is [time, lat, lon]
    const slice = raw.slice(
        tIndex * width * height,
        (tIndex + 1) * width * height
    );

    const grid = [];
    for (let i = 0; i < height; i++) {
        grid.push(slice.slice(i * width, (i + 1) * width));
    }

    return {
        lat,
        lon,
        grid
    };
}

function drawRaster(data) {
    if (rasterLayer) {
        map.removeLayer(rasterLayer);
    }

    rasterLayer = L.imageOverlay.canvas(
        [[Math.min(...data.lat), Math.min(...data.lon)],
         [Math.max(...data.lat), Math.max(...data.lon)]],
        function(canvas) {
            const ctx = canvas.getContext("2d");

            const h = data.grid.length;
            const w = data.grid[0].length;

            canvas.width = w;
            canvas.height = h;

            const img = ctx.createImageData(w, h);
            let k = 0;

            for (let i = 0; i < h; i++) {
                for (let j = 0; j < w; j++) {
                    const value = data.grid[i][j];
                    const color = valueToColor(value);

                    img.data[k++] = color.r;
                    img.data[k++] = color.g;
                    img.data[k++] = color.b;
                    img.data[k++] = 200; // alpha
                }
            }

            ctx.putImageData(img, 0, 0);
        }
    );

    rasterLayer.addTo(map);
}

function valueToColor(v) {
    if (v === null || isNaN(v)) return { r: 0, g: 0, b: 0 };

    const c = Math.max(0, Math.min(255, Math.floor(v * 25)));

    return { r: c, g: 255 - c, b: 100 };
}

// ----------------------------
//  MAIN UPDATE FUNCTION
// ----------------------------
async function updateMap() {
    const variable = document.getElementById("variableSelect").value;
    const year = parseInt(document.getElementById("yearSelect").value);
    const month = parseInt(document.getElementById("monthSelect").value);

    const url = getFileForYear(year);
    const reader = await loadNetCDF(url);

    const tIndex = extractYearMonthIndices(reader, year, month);
    if (tIndex === null) {
        console.error("No matching date inside this file.");
        return;
    }

    const raster = createRaster(reader, variable, tIndex);

    drawRaster(raster);
}

// ----------------------------
//  POPULATE DROPDOWNS
// ----------------------------
document.getElementById("variableSelect").innerHTML = `
    <option value="suitability_index">suitability_index</option>
    <option value="suitability_class">suitability_class</option>
`;

function populateYears() {
    let html = "";
    for (let y = 1950; y <= 2025; y++) {
        html += `<option value="${y}">${y}</option>`;
    }
    document.getElementById("yearSelect").innerHTML = html;
}

function populateMonths() {
    let html = "";
    for (let m = 1; m <= 12; m++) {
        html += `<option value="${m}">${m}</option>`;
    }
    document.getElementById("monthSelect").innerHTML = html;
}

populateYears();
populateMonths();

// ----------------------------
//  EVENT LISTENERS
// ----------------------------
document.getElementById("variableSelect").onchange = updateMap;
document.getElementById("yearSelect").onchange = updateMap;
document.getElementById("monthSelect").onchange = updateMap;

// Initial draw
updateMap();
