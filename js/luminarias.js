/* ============================================================
   SIG-EOR  |  luminarias.js
   ============================================================ */

// ── Map initialization (independent of data fetch) ───────────
// Initializing on window.load guarantees the #lumMap container
// already has its CSS dimensions when Leaflet measures it.
let lumMap = null;
let pendingCantonData = null;

window.addEventListener('load', function () {
  lumMap = L.map('lumMap', {
    center: [-3.35, -79.85],
    zoom: 9,
    zoomControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(lumMap);

  lumMap.invalidateSize();

  // If data arrived before map was ready, draw the canton layer now
  if (pendingCantonData) loadCantonLayer(pendingCantonData);
});

// ── Data fetch ────────────────────────────────────────────────
fetch('data/luminarias_data.json')
  .then(r => r.json())
  .then(data => {
    renderKPIs(data.kpis);
    renderChartTipo(data.subtipo1);
    renderChartClasif(data.clasif);
    renderChartCanton(data.canton);
    renderTableSub(data.subestacion);
    renderTableAlim(data.alimentador);

    if (lumMap) {
      loadCantonLayer(data.canton);
    } else {
      pendingCantonData = data.canton;
    }
  })
  .catch(err => console.error('Error cargando datos:', err));

// ── Helpers ──────────────────────────────────────────────────
function fmt(n) { return n.toLocaleString('es-EC'); }

const PALETTE = [
  '#4db8ff','#2ecc71','#f39c12','#e74c3c','#9b59b6',
  '#1abc9c','#e67e22','#3498db','#e91e63','#00bcd4',
  '#8bc34a','#ff5722','#607d8b','#795548','#ffc107'
];

// ── KPIs ─────────────────────────────────────────────────────
function renderKPIs(k) {
  const items = [
    { icon: '💡', value: k.luminarias,   label: 'Luminarias' },
    { icon: '🚦', value: k.semaforos,    label: 'Semáforos' },
    { icon: '📷', value: k.camaras,      label: 'Cámaras' },
    { icon: '🔢', value: k.total,        label: 'Total registros' },
    { icon: '📡', value: k.con_medicion, label: 'Con medición' },
    { icon: '🔌', value: k.sin_medicion, label: 'Sin medición' },
  ];
  document.getElementById('kpiGrid').innerHTML = items.map(i => `
    <div class="kpi-card">
      <div class="kpi-icon">${i.icon}</div>
      <div class="kpi-value">${fmt(i.value)}</div>
      <div class="kpi-label">${i.label}</div>
    </div>`).join('');
}

// ── Chart: Tipo — barras verticales ──────────────────────────
function renderChartTipo(data) {
  const labels = Object.keys(data);
  const values = Object.values(data);
  new Chart(document.getElementById('chartTipo'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: PALETTE,
        borderWidth: 0,
        borderRadius: 5
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)}` } }
      },
      scales: {
        x: {
          ticks: { color: '#c8d6e5', font: { size: 10 }, maxRotation: 35 },
          grid: { display: false }
        },
        y: {
          ticks: { color: '#8a9bb5', font: { size: 9 } },
          grid: { color: 'rgba(255,255,255,.06)' }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

// ── Chart: Clasificación — doughnut ──────────────────────────
function renderChartClasif(data) {
  const labels = Object.keys(data);
  const values = Object.values(data);
  new Chart(document.getElementById('chartClasif'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: PALETTE, borderWidth: 2, borderColor: '#1e2d50' }]
    },
    options: {
      cutout: '58%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#c8d6e5', font: { size: 10 }, boxWidth: 11, padding: 8 }
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}` } }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

// ── Chart: Cantón — barras verticales ────────────────────────
function renderChartCanton(data) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const labels  = entries.map(e => e[0]);
  const values  = entries.map(e => e[1]);
  new Chart(document.getElementById('chartCanton'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Luminarias',
        data: values,
        backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)}` } }
      },
      scales: {
        x: {
          ticks: { color: '#8a9bb5', font: { size: 10 }, maxRotation: 35 },
          grid: { color: 'rgba(255,255,255,.06)' }
        },
        y: {
          ticks: { color: '#8a9bb5', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,.06)' }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

// ── Table: Subestaciones ──────────────────────────────────────
function renderTableSub(data) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  document.getElementById('subTbody').innerHTML = rows.map(([name, cnt], i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${name}</td>
      <td class="cnt">${fmt(cnt)}</td>
    </tr>`).join('');
}

// ── Table: Alimentadores ──────────────────────────────────────
let allAlim = [];

function renderTableAlim(data) {
  allAlim = Object.entries(data).filter(([k]) => k).sort((a, b) => b[1] - a[1]);
  drawAlimTable(allAlim);
  document.getElementById('alimSearch').addEventListener('input', function () {
    const q = this.value.toLowerCase();
    drawAlimTable(allAlim.filter(([k]) => k.toLowerCase().includes(q)));
  });
}

function drawAlimTable(rows) {
  document.getElementById('alimTbody').innerHTML = rows.map(([name, cnt], i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${name}</td>
      <td class="cnt">${fmt(cnt)}</td>
    </tr>`).join('');
}

// ── Map: Canton layer ─────────────────────────────────────────
function loadCantonLayer(cantonData) {
  fetch('data/Cantones.geojson')
    .then(r => r.json())
    .then(geo => {
      const maxVal = Math.max(...Object.values(cantonData));

      function getColor(n) {
        const t = n / maxVal;
        if (t > .75) return '#0d47a1';
        if (t > .5)  return '#1565c0';
        if (t > .25) return '#1976d2';
        if (t > .1)  return '#42a5f5';
        return '#90caf9';
      }

      L.geoJSON(geo, {
        style: feat => {
          const name = feat.properties.dpa_descan || '';
          const n = cantonData[name] || 0;
          return {
            fillColor: getColor(n),
            fillOpacity: n > 0 ? .72 : .15,
            color: '#0a1628',
            weight: 1.5
          };
        },
        onEachFeature: (feat, layer) => {
          const name = feat.properties.dpa_descan || '—';
          const n = cantonData[name] || 0;
          layer.bindPopup(
            `<strong>${name}</strong><br>` +
            `<span style="color:#4db8ff;font-size:16px;font-weight:700;">${fmt(n)}</span>` +
            `<span style="color:#aaa;font-size:11px;"> luminarias</span>`
          );
          layer.on('mouseover', e => {
            e.target.setStyle({ fillOpacity: .92, weight: 2.5, color: '#4db8ff' });
          });
          layer.on('mouseout', e => {
            e.target.setStyle({ fillOpacity: n > 0 ? .72 : .15, weight: 1.5, color: '#0a1628' });
          });
        }
      }).addTo(lumMap);

      lumMap.invalidateSize();
      addMapLegend(maxVal);
    });
}

function addMapLegend(maxVal) {
  const ctrl = L.control({ position: 'bottomright' });
  ctrl.onAdd = () => {
    const div = L.DomUtil.create('div', '');
    div.style.cssText =
      'background:#1a2744;border:1px solid rgba(255,255,255,.15);' +
      'border-radius:8px;padding:10px 14px;color:#c8d6e5;font-size:11px;line-height:2;';
    const tiers = [
      { color: '#0d47a1', label: `> ${fmt(Math.round(maxVal * .75))}` },
      { color: '#1565c0', label: `> ${fmt(Math.round(maxVal * .5))}` },
      { color: '#1976d2', label: `> ${fmt(Math.round(maxVal * .25))}` },
      { color: '#42a5f5', label: `> ${fmt(Math.round(maxVal * .1))}` },
      { color: '#90caf9', label: 'Resto' },
    ];
    div.innerHTML =
      '<strong style="font-size:10px;letter-spacing:.8px;text-transform:uppercase;' +
      'color:rgba(255,255,255,.5);">Luminarias / cantón</strong><br>' +
      tiers.map(t =>
        `<span style="display:inline-block;width:12px;height:12px;background:${t.color};` +
        `border-radius:2px;margin-right:6px;vertical-align:middle;"></span>${t.label}`
      ).join('<br>');
    return div;
  };
  ctrl.addTo(lumMap);
}
