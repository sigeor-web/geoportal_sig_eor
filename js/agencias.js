/* ============================================================
   SIG-EOR  |  agencias.js
   Mapa de agencias CNEL-EOR + Área de Servicio
   ============================================================ */

// ── Mapa ─────────────────────────────────────────────────────
const map = L.map('map', { center: [-3.4, -79.85], zoom: 9 });

const baseLayers = {
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors', maxZoom: 19
  }),
  satellite: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: '© Esri World Imagery', maxZoom: 18 }
  ),
  topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenTopoMap', maxZoom: 17
  })
};

let currentBase = baseLayers.osm;
currentBase.addTo(map);

// ── Icono agencia ─────────────────────────────────────────────
function agenciaIcon(nombre) {
  const letra = (nombre || '?')[0].toUpperCase();
  return L.divIcon({
    html: `<div style="
      width:34px;height:34px;
      background:#e67e22;
      border:3px solid #c0392b;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:15px;font-weight:700;
      font-family:'Rajdhani',sans-serif;
      box-shadow:0 3px 8px rgba(0,0,0,.35);
    ">${letra}</div>`,
    className: '',
    iconSize:    [34, 34],
    iconAnchor:  [17, 17],
    popupAnchor: [0, -20]
  });
}

// ── Botón de impresión ────────────────────────────────────────
const PrintControl = L.Control.extend({
  options: { position: 'topleft' },
  onAdd() {
    const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control');
    btn.title = 'Imprimir mapa';
    btn.innerHTML = '🖨️';
    btn.style.cssText = 'width:34px;height:34px;font-size:18px;cursor:pointer;background:#fff;border:none;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 5px rgba(0,0,0,.4);border-radius:4px;';
    L.DomEvent.disableClickPropagation(btn);
    btn.onclick = () => window.print();
    return btn;
  }
});
new PrintControl().addTo(map);

// ── Capas ─────────────────────────────────────────────────────
let areaLayer     = null;
let agenciasLayer = null;
const markers     = {};   // nombre → marker (para flyTo desde tabla)

// ── Carga de datos ────────────────────────────────────────────
Promise.all([
  fetch('data/AreaServicio.geojson').then(r => r.json()),
  fetch('data/Agencias.geojson').then(r => r.json())
])
.then(([areaData, agenciaData]) => {

  // 1. Área de servicio
  areaLayer = L.geoJSON(areaData, {
    style: {
      color:       '#1a2744',
      weight:      2,
      fillColor:   '#4a9e6e',
      fillOpacity: 0.18
    },
    onEachFeature(feature, layer) {
      const p = feature.properties;
      layer.bindPopup(`
        <div class="custom-popup">
          <h4>🗺️ Área de Servicio CNEL-EOR</h4>
          ${p.nombre ? `<p><b>Nombre:</b> ${p.nombre}</p>` : ''}
          ${p.area   ? `<p><b>Área:</b> ${p.area.toLocaleString()} km²</p>` : ''}
        </div>`);
    }
  }).addTo(map);

  // 2. Agencias
  const features = agenciaData.features;

  agenciasLayer = L.geoJSON(agenciaData, {
    pointToLayer(feature, latlng) {
      const nombre = (feature.properties.AGENCIA || '').trim();
      return L.marker(latlng, { icon: agenciaIcon(nombre) });
    },
    onEachFeature(feature, layer) {
      const p        = feature.properties;
      const nombre   = (p.AGENCIA    || '').trim();
      const encargado= (p.ENCARGADO  || '').trim();
      const coords   = feature.geometry.coordinates;

      layer.bindPopup(`
        <div class="custom-popup">
          <h4>🏢 Agencia ${nombre}</h4>
          <p><b>Encargado:</b> ${encargado || '-'}</p>
          <p><b>Latitud:</b>  <span style="font-family:monospace;">${coords[1].toFixed(6)}</span></p>
          <p><b>Longitud:</b> <span style="font-family:monospace;">${coords[0].toFixed(6)}</span></p>
        </div>`, { maxWidth: 260 });

      markers[nombre] = layer;
    }
  }).addTo(map);

  // Centrar sobre área de servicio si está disponible, si no sobre agencias
  if (areaLayer.getBounds().isValid()) {
    map.fitBounds(areaLayer.getBounds(), { padding: [30, 30] });
  } else if (agenciasLayer.getBounds().isValid()) {
    map.fitBounds(agenciasLayer.getBounds(), { padding: [60, 60] });
  }

  // Tooltips permanentes con nombre de la agencia
  agenciasLayer.eachLayer(layer => {
    const nombre = (layer.feature.properties.AGENCIA || '').trim();
    layer.bindTooltip(nombre, {
      permanent:  true,
      direction:  'right',
      offset:     [10, 0],
      className:  'agencia-label'
    });
  });

  // Construir tabla lateral
  buildTable(features);
})
.catch(err => console.error('Error cargando datos:', err));

// ── Tabla lateral ─────────────────────────────────────────────
function buildTable(features) {
  const tbody = document.getElementById('tableBody');

  features.forEach((feat, idx) => {
    const p       = feat.properties;
    const nombre  = (p.AGENCIA   || '').trim();
    const encarg  = (p.ENCARGADO || '').trim();
    const coords  = feat.geometry.coordinates;

    const tr = document.createElement('tr');
    tr.dataset.lat  = coords[1];
    tr.dataset.lng  = coords[0];
    tr.dataset.name = nombre.toLowerCase();
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td style="font-weight:600;">${nombre}</td>
      <td style="color:var(--text-light);font-size:11px;">${encarg}</td>`;

    tr.addEventListener('click', () => flyToAgencia(coords[1], coords[0], nombre, tr));
    tbody.appendChild(tr);
  });
}

// ── Navegar desde tabla ───────────────────────────────────────
function flyToAgencia(lat, lng, nombre, rowEl) {
  map.flyTo([lat, lng], 15, { animate: true, duration: 1.2 });
  setTimeout(() => {
    if (markers[nombre]) markers[nombre].openPopup();
  }, 1300);

  document.querySelectorAll('#tableBody tr').forEach(r => r.classList.remove('selected'));
  rowEl.classList.add('selected');
  rowEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ── Filtro de búsqueda ────────────────────────────────────────
function filterTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  document.querySelectorAll('#tableBody tr').forEach(tr => {
    tr.style.display = tr.dataset.name.includes(q) || tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ── Control de capas ──────────────────────────────────────────
function toggleLayer(name, visible) {
  const ref = { area: areaLayer, agencias: agenciasLayer };
  const layer = ref[name];
  if (!layer) return;
  visible ? map.addLayer(layer) : map.removeLayer(layer);
}

function changeBasemap(value) {
  map.removeLayer(currentBase);
  currentBase = baseLayers[value] || baseLayers.osm;
  map.addLayer(currentBase);
  currentBase.bringToBack();
}
