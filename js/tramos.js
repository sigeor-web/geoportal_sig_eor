/* ============================================================
   SIG-EOR  |  tramos.js
   Mapa de tramos de subtransmisión 69 kV
   ============================================================ */

// ── Catálogo de conductores (CODIGOESTRUCTURA → descripción corta) ──
const CONDUCTORES = {
  COO0036: 'ACSR #266.8 MCM',
  COO0037: 'ACSR #336.4 MCM',
  COO0234: 'ACAR #500 MCM',
  COO0235: 'ACAR #600 MCM'
};

// ── Mapa ─────────────────────────────────────────────────────
const map = L.map('map', { center: [-3.4, -79.85], zoom: 9, zoomControl: true });

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

// ── Referencias ───────────────────────────────────────────────
let areaLayer, tramoLayer;
const tramoGroups = {}; // { nombre: { longitud, segmentos, bounds } }
const tramoLayers = {}; // { nombre: [layer, ...] }
const tramoColors = {}; // { nombre: color original }
let activeTramoName = null;
let blinkInterval   = null;

// ── Paleta de color por longitud ──────────────────────────────
function tramoColor(km) {
  if (km > 50) return '#7b241c';
  if (km > 30) return '#c0392b';
  if (km > 15) return '#e67e22';
  if (km >  5) return '#2980b9';
  return '#27ae60';
}

// ── Carga de datos ────────────────────────────────────────────
Promise.all([
  fetch('data/AreaServicio.geojson').then(r => r.json()),
  fetch('data/TramoSubstransmision.geojson').then(r => r.json())
])
.then(([areaData, tramoData]) => {

  // Área de servicio (fondo)
  areaLayer = L.geoJSON(areaData, {
    style: { color: '#1a2744', weight: 1.5, fillColor: '#4a9e6e', fillOpacity: 0.18 }
  }).addTo(map);

  // Pre-agrupar features por TEXTOETIQUETA (excluye registros NO APLICA)
  const esValido = p => (p.OBSERVACIONES || '').trim().toUpperCase() !== 'NO APLICA';

  const grupos = {};
  tramoData.features.forEach(feat => {
    if (!esValido(feat.properties)) return;
    const nom = feat.properties.TEXTOETIQUETA || 'SIN NOMBRE';
    const lon = feat.properties.LONGITUDSISTEMA || 0;
    if (!grupos[nom]) grupos[nom] = { longitud: 0, segmentos: 0, features: [] };
    grupos[nom].longitud   += lon;
    grupos[nom].segmentos  += 1;
    grupos[nom].features.push(feat);
  });

  // Construir capa única con todos los tramos (filtrando NO APLICA)
  tramoLayer = L.geoJSON(tramoData, {
    filter: feature => esValido(feature.properties),
    style(feature) {
      const nom = feature.properties.TEXTOETIQUETA || '';
      const km  = (grupos[nom]?.longitud || 0) / 1000;
      return { color: tramoColor(km), weight: 2.5, opacity: 0.85 };
    },
    onEachFeature(feature, layer) {
      const p   = feature.properties;
      const nom = p.TEXTOETIQUETA || 'SIN NOMBRE';
      const km  = ((grupos[nom]?.longitud || 0) / 1000).toFixed(3);
      const seg = grupos[nom]?.segmentos || 1;
      if (!tramoLayers[nom]) tramoLayers[nom] = [];
      tramoLayers[nom].push(layer);
      layer.bindPopup(`
        <div class="custom-popup">
          <h4>⚡ ${nom}</h4>
          <p><b>Longitud total:</b> ${km} km</p>
          <p><b>Segmentos:</b> ${seg}</p>
          <p><b>Voltaje:</b> ${p.VOLTAJE ? p.VOLTAJE / 1000 + ' kV' : '69 kV'}</p>
          <p><b>Conductor:</b> ${CONDUCTORES[p.CODIGOCONDUCTORFASE] || p.CODIGOCONDUCTORFASE || '-'}</p>
        </div>`);
    }
  }).addTo(map);

  // Guardar bounds y color original por grupo
  Object.entries(grupos).forEach(([nom, g]) => {
    const tempLayer = L.geoJSON({ type: 'FeatureCollection', features: g.features });
    tramoGroups[nom] = {
      longitud:  g.longitud,
      segmentos: g.segmentos,
      bounds:    tempLayer.getBounds()
    };
    tramoColors[nom] = tramoColor(g.longitud / 1000);
  });

  map.fitBounds(areaLayer.getBounds(), { padding: [30, 30] });
})
.catch(err => console.error('Error cargando GeoJSON:', err));

// ── Resaltar tramo al clic en tabla ──────────────────────────
function highlightTramo(nombre) {
  const g = tramoGroups[nombre];
  if (!g) return;

  // Detener parpadeo previo y restaurar color original
  if (blinkInterval) {
    clearInterval(blinkInterval);
    blinkInterval = null;
  }
  if (activeTramoName && tramoLayers[activeTramoName]) {
    const orig = tramoColors[activeTramoName] || '#c0392b';
    tramoLayers[activeTramoName].forEach(l =>
      l.setStyle({ color: orig, weight: 2.5, opacity: 0.85 })
    );
  }
  activeTramoName = nombre;

  // Zoom al tramo
  if (g.bounds && g.bounds.isValid()) {
    map.flyToBounds(g.bounds, { padding: [60, 60], maxZoom: 13, duration: 1.2 });
  }

  // Panel inferior de info
  const km  = (g.longitud / 1000).toFixed(3);
  const panel = document.getElementById('tramoInfo');
  document.getElementById('tiNombre').textContent = nombre;
  document.getElementById('tiKm').textContent     = km + ' km';
  document.getElementById('tiSeg').textContent    = g.segmentos;
  document.getElementById('tiVolt').textContent   = '69 kV';
  panel.classList.add('visible');

  // Resaltar fila
  document.querySelectorAll('#tableBody tr').forEach(row => {
    row.classList.toggle('selected', row.dataset.nombre === nombre);
  });

  // Parpadeo rojo → popup
  const layers = tramoLayers[nombre] || [];
  let blink = true;
  let count = 0;
  const CYCLES = 8; // 4 destellos completos a 250 ms c/u = 2 s

  blinkInterval = setInterval(() => {
    layers.forEach(l =>
      l.setStyle(blink
        ? { color: '#e74c3c', weight: 6,   opacity: 1    }
        : { color: '#e74c3c', weight: 1.5, opacity: 0.15 }
      )
    );
    blink = !blink;
    count++;

    if (count >= CYCLES) {
      clearInterval(blinkInterval);
      blinkInterval = null;
      // Color rojo fijo al terminar
      layers.forEach(l => l.setStyle({ color: '#e74c3c', weight: 4.5, opacity: 1 }));
      // Abrir popup en el segmento central del tramo
      const mid = layers[Math.floor(layers.length / 2)];
      if (mid) mid.openPopup();
    }
  }, 250);
}

// ── Filtro de búsqueda ────────────────────────────────────────
function filterTable() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  document.querySelectorAll('#tableBody tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ── Control de capas ─────────────────────────────────────────
function toggleLayer(name, visible) {
  const ref = { area: () => areaLayer, tramos: () => tramoLayer };
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
