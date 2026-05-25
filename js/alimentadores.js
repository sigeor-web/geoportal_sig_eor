/* ============================================================
   SIG-EOR  |  alimentadores.js
   ============================================================ */

Promise.all([
  fetch('data/SubestacionEOR.geojson').then(r => r.json()),
  fetch('data/CodigoAlimentadores.json').then(r => r.json())
])
.then(([geoData, alimentData]) => {

  // Construir mapa: codi_sub → { nombre, alimentadores[] }
  const subMap = {};
  geoData.features.forEach(feat => {
    const p = feat.properties;
    const cod = p.NUMEROSUBESTACION;
    if (cod) subMap[cod] = { nombre: p.COMENTARIOS || p.NOMBRE || cod, code: cod };
  });

  // Agrupar alimentadores por subestación
  const registros = Array.isArray(alimentData)
    ? alimentData
    : Object.values(alimentData)[0];
  const grupos = {};
  registros.forEach(a => {
    if (!grupos[a.codi_sub]) grupos[a.codi_sub] = [];
    grupos[a.codi_sub].push(a);
  });
  // Ordenar cada grupo por cod_alim
  Object.values(grupos).forEach(arr => arr.sort((a, b) => a.cod_alim.localeCompare(b.cod_alim)));

  // Subestaciones que tienen alimentadores, ordenadas por nombre
  const subs = Object.keys(grupos)
    .filter(cod => subMap[cod])
    .sort((a, b) => parseInt(a.slice(-2), 10) - parseInt(b.slice(-2), 10))
    .map(cod => ({ cod, nombre: subMap[cod].nombre, alimentadores: grupos[cod] }));

  renderCards(subs);
  setupSearch(subs);
})
.catch(err => console.error('Error cargando datos:', err));

// ── Renderizar tarjetas ──────────────────────────────────────
function renderCards(subs) {
  const grid = document.getElementById('cardsGrid');
  grid.innerHTML = '';

  subs.forEach(sub => {
    const card = document.createElement('div');
    card.className = 'sub-card';
    card.dataset.cod = sub.cod;
    card.innerHTML = `
      <span class="card-icon">⚡</span>
      <div class="card-name">S/E ${capitalize(sub.nombre)}</div>
      <div class="card-code">${sub.cod}</div>
      <span class="card-badge">${sub.alimentadores.length} alimentador${sub.alimentadores.length !== 1 ? 'es' : ''}</span>`;
    card.addEventListener('click', () => selectCard(card, sub));
    grid.appendChild(card);
  });
}

// ── Seleccionar tarjeta y mostrar tabla ──────────────────────
let activeCard = null;

function selectCard(card, sub) {
  if (activeCard === card) {
    // segundo clic → colapsar
    card.classList.remove('active');
    document.getElementById('detailPanel').classList.remove('visible');
    activeCard = null;
    return;
  }
  document.querySelectorAll('.sub-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  activeCard = card;
  showDetail(sub);
  document.getElementById('detailPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showDetail(sub) {
  const panel = document.getElementById('detailPanel');
  document.getElementById('detailTitle').textContent =
    `Alimentadores — S/E ${capitalize(sub.nombre)} (${sub.cod})`;

  const tbody = document.getElementById('detailTbody');
  tbody.innerHTML = '';
  sub.alimentadores.forEach((a, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-num">${i + 1}</td>
      <td class="td-code">${a.codi_sub}</td>
      <td class="td-code">${a.cod_alim}</td>
      <td>${a.alimentador}</td>
      <td class="td-code">${a.calibreconductor || '-'}</td>`;
    tbody.appendChild(tr);
  });

  panel.classList.add('visible');
}

function closeDetail() {
  document.getElementById('detailPanel').classList.remove('visible');
  if (activeCard) { activeCard.classList.remove('active'); activeCard = null; }
}

// ── Búsqueda de subestaciones ────────────────────────────────
function setupSearch(subs) {
  document.getElementById('searchInput').addEventListener('input', function () {
    const q = this.value.toLowerCase();
    document.querySelectorAll('.sub-card').forEach(card => {
      const match = card.textContent.toLowerCase().includes(q);
      card.style.display = match ? '' : 'none';
    });
  });
}

// ── Utilidades ───────────────────────────────────────────────
function capitalize(str) {
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
