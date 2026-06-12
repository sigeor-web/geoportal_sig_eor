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

// ── Mapeo de SUBTIPO de poste ────────────────────────────────
const SUBTIPO_POSTE = {
  1: 'Tangente',
  2: 'Angular Leve',
  3: 'Angular Fuerte',
  4: 'Muerto / Anclaje',
  5: 'Terminal',
  6: 'Retención'
};

// ── Mapeo de TIPOCIMIENTO ────────────────────────────────────
const TIPO_CIMIENTO = {
  DT: 'Directo en Tierra',
  CH: 'Cimentación de Hormigón',
  FH: 'Fundición de Hormigón'
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

// ── Control de etiquetas por CSS (sin iterar layers) ────────
const mapEl = document.getElementById('map');

function applyLabelVisibility() {
  const z = map.getZoom();
  // labels-off  → checkbox desactivado
  // labels-zoom → zoom insuficiente (< 15)
  if (z < 15) {
    mapEl.classList.add('labels-zoom');
  } else {
    mapEl.classList.remove('labels-zoom');
  }
}

function togglePosteLabels(enabled) {
  if (enabled) {
    mapEl.classList.remove('labels-off');
  } else {
    mapEl.classList.add('labels-off');
  }
}

// Iniciar con etiquetas ocultas
mapEl.classList.add('labels-off');

// ── Helpers ──────────────────────────────────────────────────
function fmtFecha(iso) {
  if (!iso) return '-';
  return iso.split('T')[0];
}

function badgeHtml(texto, color) {
  return `<span style="
    display:inline-block;padding:1px 6px;margin-left:4px;
    background:${color};color:#fff;border-radius:3px;
    font-size:10px;font-weight:700;vertical-align:middle;
  ">${texto}</span>`;
}

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

  // 3. Postes 69 kV
  postesLayer = L.geoJSON(postesData, {
    pointToLayer(feature, latlng) {
      return L.circleMarker(latlng, {
        radius:      4,
        fillColor:   '#e67e22',
        color:       '#c0392b',
        weight:      1.2,
        opacity:     1,
        fillOpacity: 0.9
      });
    },
    onEachFeature(feature, layer) {
      const p   = feature.properties;
      const lng = feature.geometry.coordinates[0].toFixed(6);
      const lat = feature.geometry.coordinates[1].toFixed(6);

      const subtipo    = SUBTIPO_POSTE[p.SUBTIPO] || p.SUBTIPO || '-';
      const estructura = p.ESTRUCTURAENPOSTE || '-';
      const codElem    = p.CODIGOELEMENTO    || '-';
      const obs        = p.OBSERVACIONES     || '-';

      layer.bindPopup(`
        <div class="custom-popup">
          <h4>🔩 Poste 69 kV ${badgeHtml('69 kV', '#c0392b')}</h4>
          <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <tr>
              <td style="padding:3px 6px 3px 0;color:#aaa;white-space:nowrap;">Código elemento</td>
              <td style="padding:3px 0;font-weight:600;">${codElem}</td>
            </tr>
            <tr>
              <td style="padding:3px 6px 3px 0;color:#aaa;white-space:nowrap;">Estructura en poste</td>
              <td style="padding:3px 0;font-weight:600;">${estructura}</td>
            </tr>
            <tr>
              <td style="padding:3px 6px 3px 0;color:#aaa;white-space:nowrap;">Tipo de poste</td>
              <td style="padding:3px 0;">${subtipo}</td>
            </tr>
            <tr>
              <td style="padding:3px 6px 3px 0;color:#aaa;white-space:nowrap;">Observaciones</td>
              <td style="padding:3px 0;">${obs}</td>
            </tr>
            <tr>
              <td style="padding:3px 6px 3px 0;color:#aaa;white-space:nowrap;">Latitud</td>
              <td style="padding:3px 0;font-family:monospace;">${lat}</td>
            </tr>
            <tr>
              <td style="padding:3px 6px 3px 0;color:#aaa;white-space:nowrap;">Longitud</td>
              <td style="padding:3px 0;font-family:monospace;">${lng}</td>
            </tr>
          </table>
        </div>`, { maxWidth: 260 });

      // Tooltip permanente para etiquetas por zoom
      layer.bindTooltip('', {
        permanent:  true,
        direction:  'right',
        offset:     [6, 0],
        className:  'poste-label'
      });
    }
  }).addTo(map);

  // Fijar contenido de cada tooltip una sola vez al cargar
  postesLayer.eachLayer(lyr => {
    const p  = lyr.feature.properties;
    const tt = lyr.getTooltip();
    if (tt) tt.setContent(
      `<span class="label-code">${p.CODIGOELEMENTO || ''}</span>` +
      `<span class="label-struct">${p.ESTRUCTURAENPOSTE || ''}</span>`
    );
  });

  // Control de zoom vía CSS
  map.on('zoomend', applyLabelVisibility);
  applyLabelVisibility();

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

  // ── Botón de impresión nativo ─────────────────────────────
  const PrintControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control');
      btn.title     = 'Imprimir mapa';
      btn.innerHTML = '🖨️';
      btn.style.cssText = 'width:34px;height:34px;font-size:18px;cursor:pointer;background:#fff;border:none;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 5px rgba(0,0,0,.4);border-radius:4px;';
      L.DomEvent.disableClickPropagation(btn);
      btn.onclick = () => window.print();
      return btn;
    }
  });
  new PrintControl().addTo(map);

  // ── Control: ir a coordenadas (Geográficas o UTM) ─────────
  const GoToControl = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      const box = L.DomUtil.create('div', 'coord-control');
      box.innerHTML = `
        <label>📍 Ir a coordenadas</label>
        <select id="coordType">
          <option value="geo">Geográficas (Lat, Lon)</option>
          <option value="utm">UTM (Zona 17S)</option>
        </select>
        <div class="coord-row">
          <input id="coordX" type="text" placeholder="Lat / Norte (Y)">
          <input id="coordY" type="text" placeholder="Lon / Este (X)">
        </div>
      `;
      L.DomEvent.disableClickPropagation(box);

      const inputX = box.querySelector('#coordX');
      const inputY = box.querySelector('#coordY');
      const select = box.querySelector('#coordType');

      function goTo() {
        const type = select.value;
        const a = parseFloat(inputX.value);
        const b = parseFloat(inputY.value);
        if (isNaN(a) || isNaN(b)) return;

        let lat, lng;
        if (type === 'geo') {
          lat = a; lng = b;
        } else {
          const r = utmToLatLng(b, a, 17, false); // UTM 17S (hemisferio sur)
          lat = r.lat; lng = r.lng;
        }
        if (isNaN(lat) || isNaN(lng)) return;
        map.setView([lat, lng], 17);
        L.popup({ closeButton: true })
          .setLatLng([lat, lng])
          .setContent(`📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}`)
          .openOn(map);
      }

      // Placeholders dinámicos según tipo
      select.addEventListener('change', () => {
        if (select.value === 'utm') {
          inputX.placeholder = 'Norte (Y)';
          inputY.placeholder = 'Este (X)';
        } else {
          inputX.placeholder = 'Lat / Norte (Y)';
          inputY.placeholder = 'Lon / Este (X)';
        }
      });

      [inputX, inputY].forEach(inp => {
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter') goTo();
        });
      });

      return box;
    }
  });
  new GoToControl().addTo(map);
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

// ── Conversión UTM → WGS84 (geográficas) ─────────────────────
// Implementación nativa basada en fórmulas de Karney/Snyder (sin librerías externas)
function utmToLatLng(easting, northing, zone, isNorthern) {
  const a = 6378137.0;          // semieje mayor WGS84
  const f = 1 / 298.257223563;  // achatamiento
  const k0 = 0.9996;
  const e = Math.sqrt(f * (2 - f));
  const e1sq = e * e / (1 - e * e);

  let x = easting - 500000.0;
  let y = northing;
  if (!isNorthern) y -= 10000000.0; // hemisferio sur

  const m = y / k0;
  const mu = m / (a * (1 - e * e / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256));

  const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));

  const j1 = 3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32;
  const j2 = 21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32;
  const j3 = 151 * Math.pow(e1, 3) / 96;
  const j4 = 1097 * Math.pow(e1, 4) / 512;

  const fp = mu + j1 * Math.sin(2 * mu) + j2 * Math.sin(4 * mu)
           + j3 * Math.sin(6 * mu) + j4 * Math.sin(8 * mu);

  const sinFp = Math.sin(fp), cosFp = Math.cos(fp), tanFp = Math.tan(fp);

  const c1 = e1sq * cosFp * cosFp;
  const t1 = tanFp * tanFp;
  const r1 = a * (1 - e * e) / Math.pow(1 - e * e * sinFp * sinFp, 1.5);
  const n1 = a / Math.sqrt(1 - e * e * sinFp * sinFp);
  const d  = x / (n1 * k0);

  const q1 = n1 * tanFp / r1;
  const q2 = d * d / 2;
  const q3 = (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * e1sq) * Math.pow(d, 4) / 24;
  const q4 = (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 3 * c1 * c1 - 252 * e1sq) * Math.pow(d, 6) / 720;

  const lat = fp - q1 * (q2 - q3 + q4);

  const q5 = d;
  const q6 = (1 + 2 * t1 + c1) * Math.pow(d, 3) / 6;
  const q7 = (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * e1sq + 24 * t1 * t1) * Math.pow(d, 5) / 120;

  const lonOriginRad = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  const lon = lonOriginRad + (q5 - q6 + q7) / cosFp;

  return {
    lat: lat * 180 / Math.PI,
    lng: lon * 180 / Math.PI
  };
}
