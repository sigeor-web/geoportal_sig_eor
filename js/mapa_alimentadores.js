/* ============================================================
   SIG-EOR  |  mapa_alimentadores.js
   Mapa de red de distribución — Alimentadores
   ============================================================ */

// ── Paleta de 20 colores distintos para alimentadores ────────
const PALETTE = [
  '#e6194b','#3cb44b','#4363d8','#f58231','#911eb4',
  '#42d4f4','#f032e6','#bfef45','#fabed4','#469990',
  '#dcbeff','#9A6324','#fffac8','#800000','#aaffc3',
  '#808000','#ffd8b1','#000075','#a9a9a9','#e6beff'
];

// Mapa alimentadorID → color
const alimColors = {};
let colorIdx = 0;

function getAlimColor(id) {
  if (!alimColors[id]) {
    alimColors[id] = PALETTE[colorIdx % PALETTE.length];
    colorIdx++;
  }
  return alimColors[id];
}

// ── Mapa ─────────────────────────────────────────────────────
const map = L.map('map', {
  center: [-3.4, -79.85],
  zoom: 9,
  zoomControl: true
});

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

// ── Icono subestaciones ───────────────────────────────────────
const subIcon = L.divIcon({
  html: `<div style="
    width:24px;height:24px;background:#1a2744;
    border:2.5px solid #4db8ff;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    color:#4db8ff;font-size:12px;
    box-shadow:0 2px 6px rgba(0,0,0,.4);">⚡</div>`,
  className: '', iconSize: [24,24], iconAnchor: [12,12], popupAnchor: [0,-14]
});

// ── Estado ───────────────────────────────────────────────────
let alimentadoresLayer = null;   // grupo global de todos
let subLayer = null;
const alimLayers = {};           // id → LayerGroup
let activeAlimId = null;

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

// ── Carga de datos ────────────────────────────────────────────
Promise.all([
  fetch('data/Alimentadores.geojson').then(r => r.json()),
  fetch('data/SubestacionEOR.geojson').then(r => r.json()),
  fetch('data/CodigoAlimentadores.json').then(r => r.json())
])
.then(([alimGeo, subGeo, codData]) => {

  // Preparar lookup de nombre completo por ALIMENTADORID
  const registros = Array.isArray(codData) ? codData : Object.values(codData)[0];
  const alimInfo = {};
  registros.forEach(r => {
    alimInfo[r.cod_alim] = {
      nombre: r.alimentador || r.cod_alim,
      sub: r.codi_sub,
      calibre: r.calibreconductor || '-'
    };
  });

  // ── 1. Agrupar features por ALIMENTADORID ─────────────────
  const grupos = {};
  alimGeo.features.forEach(feat => {
    const id = feat.properties.ALIMENTADORID || 'SIN_ID';
    if (!grupos[id]) grupos[id] = [];
    grupos[id].push(feat);
  });

  // ── 2. Crear LayerGroup por alimentador ───────────────────
  alimentadoresLayer = L.layerGroup().addTo(map);

  const alimIds = Object.keys(grupos).sort();

  alimIds.forEach(id => {
    const color = getAlimColor(id);
    const info  = alimInfo[id] || {};
    const fc    = { type: 'FeatureCollection', features: grupos[id] };

    const lg = L.geoJSON(fc, {
      style: {
        color,
        weight: 1.8,
        opacity: 0.85
      },
      onEachFeature(feature, layer) {
        const p = feat => feat.properties;
        layer.bindPopup(`
          <div class="custom-popup">
            <h4 style="border-bottom-color:${color};">⚡ ${info.nombre || id}</h4>
            <p><b>Código:</b> ${id}</p>
            <p><b>Subestación:</b> ${info.sub || '-'}</p>
            <p><b>Calibre:</b> ${info.calibre || '-'}</p>
            <p><b>Voltaje:</b> ${feature.properties.VOLTAJE ? feature.properties.VOLTAJE/1000 + ' kV' : '-'}</p>
          </div>`, { maxWidth: 240 });
      }
    });

    alimLayers[id] = lg;
    alimentadoresLayer.addLayer(lg);
  });

  // ── 3. Subestaciones ──────────────────────────────────────
  subLayer = L.geoJSON(subGeo, {
    pointToLayer: (f, ll) => L.marker(ll, { icon: subIcon }),
    onEachFeature(feature, layer) {
      const p = feature.properties;
      layer.bindPopup(`
        <div class="custom-popup">
          <h4>⚡ S/E ${p.COMENTARIOS || p.NOMBRE || ''}</h4>
          <p><b>Código:</b> ${p.NUMEROSUBESTACION || '-'}</p>
        </div>`);
    }
  }).addTo(map);

  // ── 4. Centrar mapa ───────────────────────────────────────
  if (subLayer.getBounds().isValid()) {
    map.fitBounds(subLayer.getBounds(), { padding: [40, 40] });
  }

  // ── 5. Construir lista lateral ────────────────────────────
  buildAlimList(alimIds, alimInfo);
})
.catch(err => {
  console.error('Error cargando datos:', err);
  document.getElementById('alimCount').textContent = 'Error al cargar';
});

// ── Lista lateral de alimentadores ───────────────────────────
function buildAlimList(ids, alimInfo) {
  const list = document.getElementById('alimList');
  document.getElementById('alimCount').textContent = ids.length + ' alimentadores';

  ids.forEach(id => {
    const color = getAlimColor(id);
    const info  = alimInfo[id] || {};
    const item  = document.createElement('div');
    item.className = 'alim-item';
    item.dataset.id = id;
    item.innerHTML = `
      <div class="alim-dot" style="background:${color};"></div>
      <div class="alim-item-text">
        <div class="alim-item-name">${info.nombre || id}</div>
        <div class="alim-item-id">${id}</div>
      </div>`;
    item.addEventListener('click', () => selectAlim(id, item));
    list.appendChild(item);
  });

  // Búsqueda
  document.getElementById('alimSearch').addEventListener('input', function() {
    const q = this.value.toLowerCase();
    document.querySelectorAll('.alim-item').forEach(el => {
      el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

// ── Seleccionar un alimentador ────────────────────────────────
function selectAlim(id, itemEl) {
  // Si ya está activo, deseleccionar (mostrar todos)
  if (activeAlimId === id) {
    activeAlimId = null;
    itemEl.classList.remove('active');
    showAllAlim();
    return;
  }

  // Desmarcar anterior
  document.querySelectorAll('.alim-item').forEach(el => el.classList.remove('active'));
  itemEl.classList.add('active');
  activeAlimId = id;

  // Opacar todos, resaltar el seleccionado
  Object.entries(alimLayers).forEach(([lid, lg]) => {
    lg.eachLayer(l => {
      if (l.setStyle) l.setStyle(lid === id
        ? { opacity: 1, weight: 3 }
        : { opacity: 0.1, weight: 1 }
      );
    });
  });

  // Zoom al alimentador
  const lg = alimLayers[id];
  if (lg) {
    try {
      const bounds = lg.getBounds ? lg.getBounds() : null;
      if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [30,30] });
    } catch(e) {}
  }
}

function showAllAlim() {
  Object.entries(alimLayers).forEach(([id, lg]) => {
    lg.eachLayer(l => {
      if (l.setStyle) l.setStyle({ opacity: 0.85, weight: 1.8 });
    });
  });
}

// ── Controles de capa ─────────────────────────────────────────
function toggleAllAlim(visible) {
  if (visible) {
    map.addLayer(alimentadoresLayer);
  } else {
    map.removeLayer(alimentadoresLayer);
  }
}

function toggleSubLayer(visible) {
  if (visible) {
    map.addLayer(subLayer);
  } else {
    map.removeLayer(subLayer);
  }
}

function changeBasemap(value) {
  map.removeLayer(currentBase);
  currentBase = baseLayers[value] || baseLayers.osm;
  map.addLayer(currentBase);
  currentBase.bringToBack();
}
