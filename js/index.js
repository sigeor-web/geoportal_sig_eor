/* ============================================================
   SIG-EOR  |  index.js
   Lógica del mapa principal (Geoportal)
   ============================================================ */

// ── Inicializar mapa ─────────────────────────────────────────
const map = L.map('map', {
  center: [-3.3, -79.85],
  zoom: 9,
  zoomControl: true
});

// Capa base OSM
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19
}).addTo(map);

// ── Cargar Área de Servicio ──────────────────────────────────
fetch('data/AreaServicio.geojson')
  .then(r => r.json())
  .then(data => {
    const areaLayer = L.geoJSON(data, {
      style: {
        color:       '#1a2744',
        weight:      2.5,
        fillColor:   '#4a9e6e',
        fillOpacity: 0.25
      },
      onEachFeature(feature, layer) {
        const p = feature.properties;
        layer.bindPopup(`
          <div class="custom-popup">
            <h4>🗺️ ${p.nombre || 'Área de Servicio'}</h4>
            <p><b>Área:</b> ${p.area?.toLocaleString() || ''} km²</p>
            <p><b>Límites:</b> ${p.limites || ''}</p>
          </div>`);
      }
    }).addTo(map);

    map.fitBounds(areaLayer.getBounds(), { padding: [20, 20] });
  })
  .catch(err => console.error('Error cargando AreaServicio.geojson:', err));
