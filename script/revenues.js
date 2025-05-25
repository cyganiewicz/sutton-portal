const revenueDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1YaxCko649QeAXcYP83nDoDk7n_9FPX7vL7QwzcyDR9DMHBKsep5S-7tphpwlzQ-yZY5s-KOhYEPO/pub?output=csv";

let revenueData = [];
let topChartInstance = null;
let topBarInstance = null;
const colors = [
  "#4ade80", "#60a5fa", "#facc15", "#f87171",
  "#a78bfa", "#f472b6", "#34d399", "#fb923c"
];

function formatCurrency(value) {
  return "$" + parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function calculateChange(fy25, fy26) {
  const diff = fy26 - fy25;
  const pct = fy25 === 0 ? 0 : (diff / fy25) * 100;
  return [diff, pct];
}

function groupDataByCategory1(data) {
  const grouped = {};
  data.forEach(row => {
    const cat1 = row["REV_CATEGORY_1"] || "Unknown";
    if (!grouped[cat1]) grouped[cat1] = [];
    grouped[cat1].push(row);
  });
  return grouped;
}

function getSafeValue(str) {
  return parseFloat((str || "").replace(/,/g, "")) || 0;
}

function renderTopCharts(data) {
  const pieData = {};
  const barData = {};

  data.forEach(row => {
    const cat1 = row["REV_CATEGORY_1"] || "Unknown";
    const fy24 = getSafeValue(row["2024 ACTUAL"]);
    const fy25 = getSafeValue(row["2025 ACTUAL"]);
    const fy26 = getSafeValue(row["2026 BUDGET"]);

    pieData[cat1] = (pieData[cat1] || 0) + fy26;

    if (!barData[cat1]) barData[cat1] = [0, fy24, fy25, fy26];
    else {
      barData[cat1][1] += fy24;
      barData[cat1][2] += fy25;
      barData[cat1][3] += fy26;
    }
  });

  const labels = Object.keys(pieData);
  const values = Object.values(pieData);
  const pieTotal = values.reduce((sum, v) => sum + v, 0);

  const pieCtx = document.getElementById("revenueTotalPie").getContext("2d");
  const barCtx = document.getElementById("revenueTotalBar").getContext("2d");

  if (topChartInstance) topChartInstance.destroy();
  if (topBarInstance) topBarInstance.destroy();

  topChartInstance = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors }]
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.raw;
              const pct = ((val / pieTotal) * 100).toFixed(1);
              return `${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  const barLabels = ["FY24", "FY25", "FY26"];
  const barDatasets = Object.entries(barData).map(([label, vals], i) => ({
    label,
    data: [vals[1], vals[2], vals[3]],
    backgroundColor: colors[i % colors.length]
  }));

  topBarInstance = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: barLabels,
      datasets: barDatasets
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });
}

function renderCategorySection(cat1Name, rows) {
  const sectionId = `section-${cat1Name.replace(/\s+/g, "-").toLowerCase()}`;
  const container = document.getElementById("revenueSections");

  const chartIdPie = `${sectionId}-pie`;
  const chartIdBar = `${sectionId}-bar`;
  const tableId = `${sectionId}-table`;

  container.insertAdjacentHTML("beforeend", `
    <section>
      <h2 class="text-2xl font-bold mb-4 mt-10">${cat1Name}</h2>
      <div class="chart-row">
        <div class="chart-tile">
          <h3 class="text-lg font-semibold text-center mb-2">FY26 Breakdown</h3>
          <canvas id="${chartIdPie}" width="400" height="260"></canvas>
        </div>
        <div class="chart-tile">
          <h3 class="text-lg font-semibold text-center mb-2">3-Year Trend</h3>
          <canvas id="${chartIdBar}" width="400" height="260"></canvas>
        </div>
      </div>
      <div class="overflow-x-auto border rounded-lg shadow-md mt-6">
        <table class="min-w-full table-fixed text-sm text-gray-700">
          <thead>
            <tr>
              <th class="text-left p-3">Description</th>
              <th class="text-right p-3">2024 Actual</th>
              <th class="text-right p-3">2025 Actual</th>
              <th class="text-right p-3">2026 Budget</th>
              <th class="text-right p-3">$ Change</th>
              <th class="text-right p-3">% Change</th>
            </tr>
          </thead>
          <tbody id="${tableId}" class="bg-white divide-y divide-gray-200"></tbody>
        </table>
      </div>
    </section>
  `);

  const table = document.getElementById(tableId);
  const pieCtx = document.getElementById(chartIdPie).getContext("2d");
  const barCtx = document.getElementById(chartIdBar).getContext("2d");

  const groupKey = row => row["REV_CATEGORY_2"] || row["REV_CATEGORY_1"];
  const grouped = {};

  rows.forEach(row => {
    const key = groupKey(row);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  });

  const pieMap = {};
  const barMap = {};
  let grand = [0, 0, 0];

  Object.entries(grouped).forEach(([label, items]) => {
    let subtotal = [0, 0, 0];

    items.forEach(row => {
      const desc = row["Description"];
      const fy24 = getSafeValue(row["2024 ACTUAL"]);
      const fy25 = getSafeValue(row["2025 ACTUAL"]);
      const fy26 = getSafeValue(row["2026 BUDGET"]);
      const [chg, pct] = calculateChange(fy25, fy26);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="p-3">${desc}</td>
        <td class="p-3 text-right">${formatCurrency(fy24)}</td>
        <td class="p-3 text-right">${formatCurrency(fy25)}</td>
        <td class="p-3 text-right">${formatCurrency(fy26)}</td>
        <td class="p-3 text-right">${formatCurrency(chg)}</td>
        <td class="p-3 text-right">${pct.toFixed(1)}%</td>
      `;
      table.appendChild(tr);

      subtotal[0] += fy24;
      subtotal[1] += fy25;
      subtotal[2] += fy26;

      // Only include positive values in charts
      if (fy26 > 0) pieMap[label] = (pieMap[label] || 0) + fy26;
      if (!barMap[label]) barMap[label] = [0, 0, 0];
      if (fy24 > 0) barMap[label][0] += fy24;
      if (fy25 > 0) barMap[label][1] += fy25;
      if (fy26 > 0) barMap[label][2] += fy26;
    });

    const [subChg, subPct] = calculateChange(subtotal[1], subtotal[2]);
    const subtr = document.createElement("tr");
    subtr.className = "bg-gray-100 font-semibold";
    subtr.innerHTML = `
      <td class="p-3 text-right">Subtotal - ${label}</td>
      <td class="p-3 text-right">${formatCurrency(subtotal[0])}</td>
      <td class="p-3 text-right">${formatCurrency(subtotal[1])}</td>
      <td class="p-3 text-right">${formatCurrency(subtotal[2])}</td>
      <td class="p-3 text-right">${formatCurrency(subChg)}</td>
      <td class="p-3 text-right">${subPct.toFixed(1)}%</td>
    `;
    table.appendChild(subtr);

    grand[0] += subtotal[0];
    grand[1] += subtotal[1];
    grand[2] += subtotal[2];
  });

  const [totalChg, totalPct] = calculateChange(grand[1], grand[2]);
  const grandRow = document.createElement("tr");
  grandRow.className = "bg-gray-300 font-extrabold";
  grandRow.innerHTML = `
    <td class="p-3 text-right">Grand Total</td>
    <td class="p-3 text-right">${formatCurrency(grand[0])}</td>
    <td class="p-3 text-right">${formatCurrency(grand[1])}</td>
    <td class="p-3 text-right">${formatCurrency(grand[2])}</td>
    <td class="p-3 text-right">${formatCurrency(totalChg)}</td>
    <td class="p-3 text-right">${totalPct.toFixed(1)}%</td>
  `;
  table.appendChild(grandRow);

  // Charts
  const pieLabels = Object.keys(pieMap);
  const pieValues = Object.values(pieMap);
  const pieTotal = pieValues.reduce((a, b) => a + b, 0);

  new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: pieLabels,
      datasets: [{ data: pieValues, backgroundColor: colors }]
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.raw;
              const pct = ((val / pieTotal) * 100).toFixed(1);
              return `${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  const barLabels = ["FY24", "FY25", "FY26"];
  const barDatasets = Object.entries(barMap).map(([label, vals], i) => ({
    label,
    data: vals,
    backgroundColor: colors[i % colors.length]
  }));

  new Chart(barCtx, {
    type: "bar",
    data: {
      labels: barLabels,
      datasets: barDatasets
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });
}

// Load and render
Papa.parse(revenueDataUrl, {
  header: true,
  download: true,
  complete: results => {
    revenueData = results.data.filter(r => r["2026 BUDGET"]?.trim());
    renderTopCharts(revenueData);

    const byCat1 = groupDataByCategory1(revenueData);
    Object.entries(byCat1).forEach(([catName, rows]) => {
      renderCategorySection(catName, rows);
    });
  }
});
