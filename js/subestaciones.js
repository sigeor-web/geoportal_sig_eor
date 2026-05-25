/* ============================================================
   SIG-EOR  |  subestaciones.js
   Mapa de subestaciones, tramos y postes 69 kV
   ============================================================ */

// ── Catálogo de conductores (CODIGOESTRUCTURA → descripción corta) ──
const CONDUCTORES = {
  COO0036: 'ACSR #266.8 MCM',
  COO0037: 'ACSR #336.4 MCM',
  COO0234: 'ACAR #500 MCM',
  COO0235: 'ACAR #600 MCM'
};

// ── Icono personalizado para subestaciones ───────────────────
const subIcon = L.divIcon({
  html: `<div style="
    width:28px;height:28px;
    background:#2980b9;
    border:2.5px solid #1a2744;
    border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    color:white;font-size:13px;
    box-shadow:0 2px 6px rgba(0,0,0,.35);
  ">⚡</div>`,
  className: '',
  iconSize:    [28, 28],
  iconAnchor:  [14, 14],
  popupAnchor: [0, -16]
});

// ── Inicializar mapa ─────────────────────────────────────────
const map = L.map('map', {
  center:      [-3.4, -79.85],
  zoom:        9,
  zoomControl: true
});

// ── Capas base ───────────────────────────────────────────────
const baseLayers = {
  osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }),
  satellite: L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: '© Esri World Imagery', maxZoom: 18 }
  ),
  topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenTopoMap',
    maxZoom: 17
  })
};

let currentBase = baseLayers.osm;
currentBase.addTo(map);

// ── Referencias a capas temáticas ───────────────────────────
let areaLayer, tramoLayer, postesLayer, subestacionLayer;
const subMarkers = {};

// ── Carga paralela de todos los GeoJSON ──────────────────────
Promise.all([
  fetch('data/AreaServicio.geojson').then(r => r.json()),
  fetch('data/TramoSubstransmision.geojson').then(r => r.json()),
  fetch('data/Postes69kv.geojson').then(r => r.json()),
  fetch('data/SubestacionEOR.geojson').then(r => r.json())
])
.then(([areaData, tramoData, postesData, subData]) => {

  // 1. Área de servicio
  areaLayer = L.geoJSON(areaData, {
    style: { color: '#1a2744', weight: 2, fillColor: '#4a9e6e', fillOpacity: 0.25 },
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

  // 2. Tramos 69 kV
  tramoLayer = L.geoJSON(tramoData, {
    style: { color: '#c0392b', weight: 2.5, opacity: 0.85 },
    onEachFeature(feature, layer) {
      const p = feature.properties;
      const km = p.LONGITUDSISTEMA ? (p.LONGITUDSISTEMA / 1000).toFixed(2) : '-';
      layer.bindPopup(`
        <div class="custom-popup">
          <h4>⚡ ${p.TEXTOETIQUETA || 'Tramo'}</h4>
          <p><b>Voltaje:</b> ${p.VOLTAJE ? p.VOLTAJE / 1000 + ' kV' : '-'}</p>
          <p><b>Longitud:</b> ${km} km</p>
          <p><b>Ramal:</b> ${p.RAMAL || '-'}</p>
          <p><b>Conductor:</b> ${CONDUCTORES[p.CODIGOCONDUCTORFASE] || p.CODIGOCONDUCTORFASE || '-'}</p>
        </div>`);
    }
  }).addTo(map);

  // 3. Postes 69 kV  (círculos pequeños para buen rendimiento)
  postesLayer = L.geoJSON(postesData, {
    pointToLayer(feature, latlng) {
      return L.circleMarker(latlng, {
        radius:      3,
        fillColor:   '#e67e22',
        color:       '#c0392b',
        weight:      1,
        opacity:     1,
        fillOpacity: 0.85
      });
    }
  }).addTo(map);

  // 4. Subestaciones
  subestacionLayer = L.geoJSON(subData, {
    pointToLayer(feature, latlng) {
      return L.marker(latlng, { icon: subIcon });
    },
    onEachFeature(feature, layer) {
      const p = feature.properties;
      if (!p.NUMEROSUBESTACION) return;
      const vp = p.VPRIMARIO  ? p.VPRIMARIO  / 1000 + ' kV' : '-';
      const vs = p.VSECUNDARIO ? p.VSECUNDARIO / 1000 + ' kV' : '-';
      layer.bindPopup(`
        <div class="custom-popup">
          <h4>⚡ S/E ${p.COMENTARIOS || p.NOMBRE}</h4>
          ${p.TEXTOETIQUETA ? `<p style="margin:2px 0 6px;font-size:11px;color:#555;">${p.TEXTOETIQUETA}</p>` : ''}
          <p><b>Código:</b> ${p.NUMEROSUBESTACION}<span class="badge">69kV</span></p>
          <p><b>Dirección:</b> ${p.DIRECCION || '-'}</p>
          <p><b>V. Primario:</b> ${vp} &nbsp; <b>V. Secundario:</b> ${vs}</p>
          <p><b>Observaciones:</b> ${p.OBSERVACIONES || '-'}</p>
        </div>`);
      subMarkers[p.NUMEROSUBESTACION] = layer;
    }
  }).addTo(map);

  map.fitBounds(areaLayer.getBounds(), { padding: [30, 30] });
})
.catch(err => console.error('Error cargando GeoJSON:', err));

// ── Control de capas ─────────────────────────────────────────
function toggleLayer(name, visible) {
  const ref = { area: () => areaLayer, tramos: () => tramoLayer,
                postes: () => postesLayer, subestaciones: () => subestacionLayer };
  const layer = ref[name]?.();
  if (!layer) return;
  visible ? map.addLayer(layer) : map.removeLayer(layer);
}

function changeBasemap(value) {
  map.removeLayer(currentBase);
  currentBase = baseLayers[value] || baseLayers.osm;
  map.addLayer(currentBase);
  currentBase.bringToBack();
}

// ── Vuelo al hacer clic en tabla ─────────────────────────────
function flyTo(lat, lon, name, codigo) {
  map.flyTo([lat, lon], 14, { animate: true, duration: 1.2 });
  if (subMarkers[codigo]) {
    setTimeout(() => subMarkers[codigo].openPopup(), 1300);
  }
  // Resaltar fila
  document.querySelectorAll('#tableBody tr').forEach(row => {
    row.classList.remove('selected');
    if (Math.abs(parseFloat(row.dataset.lat) - lat) < 0.0001) {
      row.classList.add('selected');
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
}

// ── Filtro de búsqueda ───────────────────────────────────────
function filterTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  document.querySelectorAll('#tableBody tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}
