/* ═══════════════════════════════════════════════════════
   Hatta Smart Farm – IoT Dashboard & Yield Predictor
   Main Application Script
═══════════════════════════════════════════════════════ */

// ── Global state ──
let GH_DATA = [], OF_DATA = [], LR_MODELS = {};
let currentFarm = 'Greenhouse';
let currentPeriod = 'daily';
let charts = {};
let contribChart = null, avpChart = null;

const FARM_META = {
  Greenhouse: { label: '🏠 Greenhouse · Hydroponic · 11,200 Plants · 2,000 m²', density: 56000, icon: '🏠' },
  OpenField:  { label: '🌿 Open Field · Sandy Soil · 7,000 Plants · 2,000 m²',   density: 35000, icon: '🌿' },
};

const PERIOD_LABELS = { daily: 'Date', weekly: 'Week', monthly: 'Month', yearly: 'Year' };

// ── Colour palette ──
const C = {
  green:  '#4ade80', greenFill: 'rgba(74,222,128,0.15)',
  blue:   '#60a5fa', blueFill:  'rgba(96,165,250,0.15)',
  yellow: '#fbbf24', yellowFill:'rgba(251,191,36,0.15)',
  red:    '#f87171', orange: '#fb923c', purple: '#a78bfa',
  cyan:   '#22d3ee', pink:   '#f472b6', teal:   '#2dd4bf',
  grid:   'rgba(255,255,255,0.06)', tick: '#6b7280',
};

// ── Utility ──
function avg(arr) { return arr.length ? arr.reduce((s,v)=>s+v,0)/arr.length : 0; }
function sum(arr) { return arr.reduce((s,v)=>s+v,0); }
function fmtNum(n, dec=1) { return isNaN(n) ? '—' : n.toFixed(dec); }

function groupBy(data, period) {
  const map = {};
  data.forEach(r => {
    const d = new Date(r.Date);
    let key;
    if      (period === 'daily')   key = r.Date;
    else if (period === 'weekly') {
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const wk   = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
      key = `${d.getFullYear()}-W${String(wk).padStart(2,'0')}`;
    }
    else if (period === 'monthly') key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    else                            key = String(d.getFullYear());
    if (!map[key]) map[key] = [];
    map[key].push(r);
  });
  return map;
}

function aggregate(grouped) {
  return Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([key, rows]) => ({
    key,
    yield:     sum(rows.map(r => r.Total_Yield_kg  || 0)),
    cumYield:  rows[rows.length-1]?.Cumulative_Yield_kg || 0,
    tempAvg:   avg(rows.map(r => r.Temp_Avg_C)),
    tempMax:   Math.max(...rows.map(r => r.Temp_Max_C)),
    tempMin:   Math.min(...rows.map(r => r.Temp_Min_C)),
    water:     avg(rows.map(r => r.Water_Usage_L_per_day)),
    rain:      sum(rows.map(r => r.Rainfall_mm || 0)),
    solar:     avg(rows.map(r => r.Solar_Radiation_MJm2)),
    moisture:  avg(rows.map(r => r.Soil_Moisture_pct)),
    ec:        avg(rows.map(r => r.EC_dSm)),
    wind:      avg(rows.map(r => r.Wind_Speed_ms)),
    humidity:  avg(rows.map(r => r.Humidity_pct)),
    par:       avg(rows.map(r => r.PAR_Wm2)),
    stage:     rows[0]?.Growth_Stage || '',
    harvested: rows.some(r => r.Harvest_Event === 1) ? 1 : 0,
  }));
}

// ── Default chart options ──
function baseOptions(yLabel='', xLabel='') {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: C.tick, font: { size: 11 } } }, tooltip: { mode:'index', intersect:false } },
    scales: {
      x: { ticks: { color: C.tick, maxTicksLimit: 12, font:{size:10} }, grid: { color: C.grid }, title: { display:!!xLabel, text:xLabel, color:C.tick } },
      y: { ticks: { color: C.tick, font:{size:10} }, grid: { color: C.grid }, title: { display:!!yLabel, text:yLabel, color:C.tick } },
    }
  };
}

function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

function makeChart(id, type, labels, datasets, extraOptions={}) {
  destroyChart(id);
  const ctx = document.getElementById(id)?.getContext('2d');
  if (!ctx) return;
  charts[id] = new Chart(ctx, {
    type, data: { labels, datasets },
    options: { ...baseOptions(), ...extraOptions }
  });
}

// ══════════════ DASHBOARD RENDER ══════════════
function renderDashboard() {
  const data = currentFarm === 'Greenhouse' ? GH_DATA : OF_DATA;
  const grouped = groupBy(data, currentPeriod);
  const agg = aggregate(grouped);
  const labels = agg.map(r => r.key);

  // ── KPIs ──
  const totalYield = sum(data.map(r=>r.Total_Yield_kg||0));
  const totalWater = (sum(data.map(r=>r.Water_Usage_L_per_day||0))/1000).toFixed(1);
  const avgTemp    = avg(data.map(r=>r.Temp_Avg_C)).toFixed(1);
  const avgSolar   = avg(data.map(r=>r.Solar_Radiation_MJm2)).toFixed(1);
  const totalRain  = sum(data.map(r=>r.Rainfall_mm||0)).toFixed(1);
  const events     = data.filter(r=>r.Harvest_Event===1).length;

  document.getElementById('kpi-yield').textContent  = totalYield.toFixed(1)+' kg';
  document.getElementById('kpi-temp').textContent   = avgTemp+' °C';
  document.getElementById('kpi-water').textContent  = totalWater+' m³';
  document.getElementById('kpi-solar').textContent  = avgSolar;
  document.getElementById('kpi-rain').textContent   = totalRain+' mm';
  document.getElementById('kpi-events').textContent = events;

  // ── Farm badge ──
  const meta = FARM_META[currentFarm];
  document.getElementById('farm-label').textContent = meta.label.replace(/^../,'').trim();
  document.getElementById('farm-badge').className =
    currentFarm === 'Greenhouse'
      ? 'flex items-center gap-2 px-4 py-2 rounded-xl bg-green-900/40 border border-green-700/50 text-green-300 text-sm font-medium'
      : 'flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-900/40 border border-orange-700/50 text-orange-300 text-sm font-medium';

  // ── Yield chart ──
  makeChart('chart-yield', 'bar', labels, [
    { label:'Yield (kg)', data: agg.map(r=>r.yield), backgroundColor: currentFarm==='Greenhouse'?'rgba(74,222,128,0.7)':'rgba(251,146,60,0.7)', borderRadius:4, yAxisID:'y' },
    { label:'Cumulative (kg)', data: agg.map(r=>r.cumYield), type:'line', borderColor:C.blue, backgroundColor:C.blueFill, borderWidth:2, pointRadius:2, fill:true, yAxisID:'y1', tension:0.3 },
  ], { ...baseOptions('Yield (kg)'), scales:{
    x:{ticks:{color:C.tick,maxTicksLimit:14,font:{size:10}},grid:{color:C.grid}},
    y:{ticks:{color:C.tick,font:{size:10}},grid:{color:C.grid},title:{display:true,text:'Per Event (kg)',color:C.tick}},
    y1:{position:'right',ticks:{color:C.blue,font:{size:10}},grid:{display:false},title:{display:true,text:'Cumulative (kg)',color:C.blue}},
  }});

  // ── Temperature chart ──
  makeChart('chart-temp', 'line', labels, [
    { label:'Avg °C', data:agg.map(r=>fmtNum(r.tempAvg,1)), borderColor:C.orange, backgroundColor:'rgba(251,146,60,0.1)', borderWidth:2, fill:true, tension:0.3, pointRadius:1 },
    { label:'Max °C', data:agg.map(r=>fmtNum(r.tempMax,1)), borderColor:C.red,    borderDash:[4,4], borderWidth:1.5, tension:0.3, pointRadius:0 },
    { label:'Min °C', data:agg.map(r=>fmtNum(r.tempMin,1)), borderColor:C.blue,   borderDash:[4,4], borderWidth:1.5, tension:0.3, pointRadius:0 },
  ], baseOptions('°C'));

  // ── Water usage ──
  makeChart('chart-water', 'bar', labels, [
    { label:'Water (L/day)', data:agg.map(r=>r.water.toFixed(0)), backgroundColor:'rgba(96,165,250,0.65)', borderRadius:3 },
  ], baseOptions('L/day'));

  // ── Rainfall ──
  makeChart('chart-rain', 'bar', labels, [
    { label:'Rainfall (mm)', data:agg.map(r=>r.rain.toFixed(2)), backgroundColor:'rgba(167,139,250,0.65)', borderRadius:3 },
  ], baseOptions('mm'));

  // ── Solar radiation ──
  makeChart('chart-solar', 'line', labels, [
    { label:'Solar (MJ/m²)', data:agg.map(r=>r.solar.toFixed(2)), borderColor:C.yellow, backgroundColor:C.yellowFill, borderWidth:2, fill:true, tension:0.3, pointRadius:1 },
  ], baseOptions('MJ/m²'));

  // ── Soil moisture ──
  makeChart('chart-moisture', 'line', labels, [
    { label:'Moisture (%)', data:agg.map(r=>r.moisture.toFixed(1)), borderColor:C.teal, backgroundColor:'rgba(45,212,191,0.1)', borderWidth:2, fill:true, tension:0.3, pointRadius:1 },
  ], baseOptions('%'));

  // ── EC Level ──
  makeChart('chart-ec', 'line', labels, [
    { label:'EC (dS/m)', data:agg.map(r=>r.ec.toFixed(2)), borderColor:C.purple, backgroundColor:'rgba(167,139,250,0.1)', borderWidth:2, fill:true, tension:0.3, pointRadius:1 },
  ], baseOptions('dS/m'));

  // ── Wind + Humidity ──
  makeChart('chart-wind', 'line', labels, [
    { label:'Wind (m/s)', data:agg.map(r=>r.wind.toFixed(2)), borderColor:C.cyan, borderWidth:2, tension:0.3, pointRadius:1, yAxisID:'y' },
    { label:'Humidity (%)', data:agg.map(r=>r.humidity.toFixed(1)), borderColor:C.pink, borderWidth:2, tension:0.3, pointRadius:1, yAxisID:'y1' },
  ], { ...baseOptions(), scales:{
    x:{ticks:{color:C.tick,maxTicksLimit:12,font:{size:10}},grid:{color:C.grid}},
    y:{ticks:{color:C.cyan,font:{size:10}},grid:{color:C.grid},title:{display:true,text:'m/s',color:C.cyan}},
    y1:{position:'right',ticks:{color:C.pink,font:{size:10}},grid:{display:false},title:{display:true,text:'%',color:C.pink}},
  }});

  // ── PAR ──
  makeChart('chart-par', 'line', labels, [
    { label:'PAR (W/m²)', data:agg.map(r=>r.par.toFixed(2)), borderColor:'#fb7185', backgroundColor:'rgba(251,113,133,0.1)', borderWidth:2, fill:true, tension:0.3, pointRadius:1 },
  ], baseOptions('W/m²'));

  // ── Yield by growth stage (doughnut) ──
  const stages = ['Early','Vegetative','Flowering','Fruiting','End_Season'];
  const stageColors = ['#3b82f6','#22c55e','#eab308','#ef4444','#a855f7'];
  const stageYields = stages.map(s => sum(data.filter(r=>r.Growth_Stage===s).map(r=>r.Total_Yield_kg||0)));
  destroyChart('chart-stage');
  const ctxS = document.getElementById('chart-stage')?.getContext('2d');
  if (ctxS) {
    charts['chart-stage'] = new Chart(ctxS, {
      type: 'doughnut',
      data: { labels: stages, datasets: [{ data: stageYields.map(v=>v.toFixed(1)), backgroundColor: stageColors, borderWidth:2, borderColor:'#111827' }] },
      options: { responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'right', labels:{ color:C.tick, font:{size:11}, padding:10 } } }
      }
    });
  }
}

// ══════════════ PREDICTOR ══════════════
function buildCoefTable() {
  const model = LR_MODELS[currentFarm];
  if (!model) return;
  const NAMES = {
    Days_After_Transplanting: '📅 Days After Transplanting',
    Water_Usage_L_per_day:    '💧 Water Usage (L/day)',
    Soil_Moisture_pct:        '💦 Soil Moisture (%)',
    Temp_Avg_C:               '🌡️ Temperature (°C)',
    Solar_Radiation_MJm2:     '☀️ Solar Radiation (MJ/m²)',
    EC_dSm:                   '⚡ EC Level (dS/m)',
    Rainfall_mm:              '🌧️ Rainfall (mm)',
    Humidity_pct:             '💨 Humidity (%)',
    Growth_Stage_Num:         '🌱 Growth Stage',
    Plant_Density_per_ha:     '🌿 Plant Density (plants/ha)',
  };
  let html = '<div class="space-y-1">';
  html += `<div class="flex justify-between text-xs py-1 border-b border-gray-700 text-gray-400 font-semibold"><span>Feature</span><span>Coefficient (β)</span></div>`;
  html += `<div class="flex justify-between text-xs py-1 text-gray-400"><span>Intercept (β₀)</span><span class="font-mono text-yellow-400">${model.intercept.toFixed(4)}</span></div>`;
  Object.entries(model.coefficients).forEach(([k,v]) => {
    const col = v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-gray-400';
    html += `<div class="flex justify-between text-xs py-0.5"><span class="text-gray-400 truncate pr-2">${NAMES[k]||k}</span><span class="font-mono ${col} shrink-0">${v >= 0 ? '+':''}${v.toFixed(4)}</span></div>`;
  });
  html += `<div class="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-500">R² = <strong class="text-violet-400">${model.r2}</strong>  ·  MAE = <strong class="text-violet-400">${model.mae} kg</strong></div>`;
  html += '</div>';
  document.getElementById('coef-table').innerHTML = html;

  document.getElementById('badge-r2').textContent  = `R²: ${model.r2}`;
  document.getElementById('badge-mae').textContent = `MAE: ${model.mae} kg`;
}

function predictYield() {
  const model = LR_MODELS[currentFarm];
  if (!model) return;

  const vals = {
    Days_After_Transplanting: parseFloat(document.getElementById('f-dat').value)||0,
    Water_Usage_L_per_day:    parseFloat(document.getElementById('f-water').value)||0,
    Soil_Moisture_pct:        parseFloat(document.getElementById('f-moisture').value)||0,
    Temp_Avg_C:               parseFloat(document.getElementById('f-temp').value)||0,
    Solar_Radiation_MJm2:     parseFloat(document.getElementById('f-solar').value)||0,
    EC_dSm:                   parseFloat(document.getElementById('f-ec').value)||0,
    Rainfall_mm:              parseFloat(document.getElementById('f-rain').value)||0,
    Humidity_pct:             parseFloat(document.getElementById('f-humidity').value)||0,
    Growth_Stage_Num:         parseFloat(document.getElementById('f-stage').value)||1,
    Plant_Density_per_ha:     parseFloat(document.getElementById('f-density').value)||0,
  };

  // Standardise and compute prediction
  let pred = model.intercept;
  const contributions = {};
  model.feature_order.forEach(f => {
    const x_std = (vals[f] - model.scaler_mean[f]) / model.scaler_std[f];
    const contrib = model.coefficients[f] * x_std;
    contributions[f] = contrib;
    pred += contrib;
  });
  pred = Math.max(0, pred);

  // ── Display result ──
  const box = document.getElementById('result-box');
  document.getElementById('result-value').textContent = pred.toFixed(2) + ' kg';
  const lo = Math.max(0, pred * 0.85).toFixed(1);
  const hi = (pred * 1.15).toFixed(1);
  document.getElementById('result-range').textContent = `Expected range: ${lo} – ${hi} kg`;
  const stageNames = ['','Early','Vegetative','Flowering','Fruiting','End Season'];
  const si = document.getElementById('result-stage-info');
  si.textContent = `Growth Stage: ${stageNames[vals.Growth_Stage_Num] || ''} · DAT: ${vals.Days_After_Transplanting}`;
  si.classList.remove('hidden');
  box.classList.remove('result-pulse');
  void box.offsetWidth; // reflow
  box.classList.add('result-pulse');

  // ── Feature contribution chart ──
  if (contribChart) { contribChart.destroy(); contribChart = null; }
  const LABELS = {
    Days_After_Transplanting: 'DAT', Water_Usage_L_per_day:'Water',
    Soil_Moisture_pct:'Moisture', Temp_Avg_C:'Temp', Solar_Radiation_MJm2:'Solar',
    EC_dSm:'EC', Rainfall_mm:'Rainfall', Humidity_pct:'Humidity',
    Growth_Stage_Num:'Stage', Plant_Density_per_ha:'Density',
  };
  const contribLabels = model.feature_order.map(f => LABELS[f]||f);
  const contribVals   = model.feature_order.map(f => +contributions[f].toFixed(4));
  const contribColors = contribVals.map(v => v >= 0 ? 'rgba(74,222,128,0.75)' : 'rgba(248,113,113,0.75)');
  const ctxC = document.getElementById('chart-contrib')?.getContext('2d');
  if (ctxC) {
    contribChart = new Chart(ctxC, {
      type: 'bar',
      data: { labels: contribLabels, datasets:[{ label:'Contribution (kg)', data: contribVals, backgroundColor: contribColors, borderRadius:4 }] },
      options: { indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: ctx=>`${ctx.parsed.x>=0?'+':''}${ctx.parsed.x.toFixed(3)} kg` }} },
        scales:{ x:{ticks:{color:C.tick,font:{size:10}},grid:{color:C.grid}}, y:{ticks:{color:C.tick,font:{size:10}},grid:{color:C.grid}} }
      }
    });
  }

  // ── Actual vs Predicted (full season) ──
  const data = currentFarm === 'Greenhouse' ? GH_DATA : OF_DATA;
  const harvestRows = data.filter(r => r.Harvest_Event === 1);
  const actLabels   = harvestRows.map(r => r.Date);
  const actVals     = harvestRows.map(r => r.Total_Yield_kg);
  const predVals    = harvestRows.map(r => {
    let p = model.intercept;
    model.feature_order.forEach(f => {
      const field = f === 'Solar_Radiation_MJm2' ? r['Solar_Radiation_MJm2'] : r[f];
      const xs = ((field||0) - model.scaler_mean[f]) / model.scaler_std[f];
      p += model.coefficients[f] * xs;
    });
    return Math.max(0, p);
  });

  if (avpChart) { avpChart.destroy(); avpChart = null; }
  const ctxAVP = document.getElementById('chart-actual-vs-pred')?.getContext('2d');
  if (ctxAVP) {
    avpChart = new Chart(ctxAVP, {
      type: 'line',
      data: { labels: actLabels, datasets:[
        { label:'Actual Yield (kg)', data: actVals, borderColor: C.green, backgroundColor: C.greenFill, borderWidth:2, fill:true, tension:0.2, pointRadius:4, pointBackgroundColor: C.green },
        { label:'LR Predicted (kg)', data: predVals.map(v=>+v.toFixed(3)), borderColor:'#f59e0b', borderDash:[5,4], borderWidth:2, fill:false, tension:0.2, pointRadius:3, pointBackgroundColor:'#f59e0b' },
      ]},
      options:{ ...baseOptions('Yield (kg)'), plugins:{ legend:{ labels:{ color:C.tick, font:{size:11} } }, tooltip:{mode:'index',intersect:false} } }
    });
  }
}

// ══════════════ UI STATE MANAGEMENT ══════════════
function setFarm(farm) {
  currentFarm = farm;
  document.getElementById('btn-gh').className = 'farm-btn px-4 py-2 rounded-xl text-sm font-semibold transition-all' + (farm==='Greenhouse'?' active-farm':'');
  document.getElementById('btn-of').className = 'farm-btn px-4 py-2 rounded-xl text-sm font-semibold transition-all' + (farm==='OpenField'?' active-farm':'');
  // Update density in predict form
  document.getElementById('f-density').value = FARM_META[farm].density;
  // Re-render active tab
  const isPredictor = !document.getElementById('page-predictor').classList.contains('hidden');
  if (isPredictor) { buildCoefTable(); predictYield(); }
  else renderDashboard();
}

function setPeriod(p) {
  currentPeriod = p;
  ['daily','weekly','monthly','yearly'].forEach(x => {
    const el = document.getElementById(`p-${x}`);
    el.className = 'period-btn px-3 py-1.5 rounded-lg text-sm font-medium transition-all' + (x===p?' active-period':'');
  });
  renderDashboard();
}

function showTab(tab) {
  document.getElementById('page-dashboard').classList.toggle('hidden', tab !== 'dashboard');
  document.getElementById('page-predictor').classList.toggle('hidden',  tab !== 'predictor');
  document.getElementById('tab-dashboard').className = 'nav-tab px-4 py-1.5 rounded-lg text-sm font-medium transition-all' + (tab==='dashboard'?' active-tab':'');
  document.getElementById('tab-predictor').className  = 'nav-tab px-4 py-1.5 rounded-lg text-sm font-medium transition-all' + (tab==='predictor'?' active-tab':'');
  if (tab === 'predictor') { buildCoefTable(); predictYield(); }
  else renderDashboard();
}

// Auto-sync DAT ↔ stage
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('f-dat')?.addEventListener('input', function() {
    const dat = parseInt(this.value)||0;
    let stage = 1;
    if (dat<=30) stage=1; else if(dat<=60) stage=2; else if(dat<=90) stage=3; else if(dat<=150) stage=4; else stage=5;
    document.getElementById('f-stage').value = stage;
  });
  document.getElementById('f-stage')?.addEventListener('change', function() {
    const stageDefaults = {1:15, 2:45, 3:75, 4:120, 5:165};
    document.getElementById('f-dat').value = stageDefaults[this.value]||75;
  });
  // Auto-update water usage defaults by stage + farm
  function updateWaterDefault() {
    const stage = parseInt(document.getElementById('f-stage').value)||3;
    const waterMap = {
      Greenhouse: {1:1792,2:3808,3:5600,4:7280,5:4480},
      OpenField:  {1:2450,2:4200,3:7000,4:9100,5:5600},
    };
    document.getElementById('f-water').value = waterMap[currentFarm][stage];
    const moistureMap = {
      Greenhouse: {1:70,2:72.5,3:75,4:78,5:65},
      OpenField:  {1:55,2:58,3:62,4:65,5:52},
    };
    document.getElementById('f-moisture').value = moistureMap[currentFarm][stage];
    const ecMap = {
      Greenhouse: {1:1.5,2:1.6,3:1.8,4:2.0,5:1.6},
      OpenField:  {1:1.2,2:1.4,3:1.6,4:1.8,5:1.3},
    };
    document.getElementById('f-ec').value = ecMap[currentFarm][stage];
  }
  document.getElementById('f-stage')?.addEventListener('change', updateWaterDefault);
});

// ══════════════ DATA LOADING ══════════════
async function loadData() {
  try {
    const [ghRes, ofRes, lrRes] = await Promise.all([
      fetch('data/greenhouse.json'),
      fetch('data/openfield.json'),
      fetch('data/lr_models.json'),
    ]);
    GH_DATA   = await ghRes.json();
    OF_DATA   = await ofRes.json();
    LR_MODELS = await lrRes.json();

    // Hide loading overlay
    document.getElementById('loading').style.display = 'none';

    // Initial render
    renderDashboard();
  } catch(err) {
    console.error('Data load error:', err);
    document.getElementById('loading').innerHTML =
      '<div class="text-red-400 text-center p-8"><div class="text-4xl mb-3">⚠️</div><div class="font-bold">Failed to load data</div><div class="text-sm text-gray-400 mt-1">'+err.message+'</div></div>';
  }
}

loadData();
