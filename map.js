// URL from your GitHub release
const netcdfUrl = "https://github.com/kazumarkn/Indonesian-CSLSA/releases/download/v1/arabica_suitability_all_times.nc";

// Initialize map centered on Indonesia
const map = L.map("map").setView([-2, 118], 5);

// Basemap
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 12,
    attribution: "© OpenStreetMap contributors"
}).addTo(map);

// Load NetCDF → GeoRaster → Leaflet layer
fetch(netcdfUrl)
    .then(res => res.arrayBuffer())
    .then(async buffer => {
        const georaster = await parseGeoraster(buffer);

        // If there are multiple bands / time slices:
        // console.log("Bands:", georaster.bands.length);

        const layer = new GeoRasterLayer({
            georaster: georaster,
            opacity: 0.85,
            resolution: 256,
            pixelValuesToColorFn: values => {
                const v = values[0];

                if (v === null || isNaN(v)) return null;

                // Simple color scale (blue → yellow → red)
                const min = georaster.mins[0];
                const max = georaster.maxs[0];
                const t = (v - min) / (max - min);

                const r = Math.floor(255 * t);
                const g = Math.floor(255 * (1 - Math.abs(t - 0.5) * 2));
                const b = Math.floor(255 * (1 - t));

                return `rgb(${r},${g},${b})`;
            }
        });

        layer.addTo(map);

        // Fit the map to raster bounds
        map.fitBounds(layer.getBounds());
    })
    .catch(err => console.error("Error loading NetCDF:", err));
