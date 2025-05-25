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

function groupByCategory2(rows) {
  const grouped = {};
  rows.forEach(row => {
    const cat2 = row["REV_CATEGORY_2"] || "Uncategorized";
    if (!grouped[cat2]) grouped[cat2] = [];
    grouped[cat2].push(row);
  });
  return grouped;
}

function renderTopCharts(data) {
  const pieData = {};
  const barData = {};

  data.forEach(row => {
    const cat1 = row["REV_CATEGORY_1"] || "Unknown";
    const fy24 = parseFloat(row["2024 ACTUAL"].replace(/,/g, "")) || 0;
    const fy25 = parseFloat(row["2025 ACTUAL"].replace(/,/g, "")) || 0;
    const fy26 = parseFloat(row["2026 BUDGET"].replace(/,/g, "")) || 0;

    pieData[cat1] = (pieData[cat1] || 0) + fy26;

    if (!barData[cat1]) barData[cat1] = [0, fy24, fy25, fy26];
    else {
      barData[cat1][1] += fy24;
      barData[cat1][2] += fy25;
      barData[cat1][3] += fy26;
    }
  });

  const pieCtx = document.getElementById("revenueTotalPie").getContext("2d");
  const barCtx = document.getElementById("revenueTotalBar").getContext("2d");

  if (topChartInstance) topChartInstance.destroy();
  if (topBarInstance) topBarInstance.destroy();

  const pieLabels = Object.keys(pieData);
  const pieValues = Object.values(pieData);
  const pieTotal = pieValues.reduce((sum, v) => sum + v, 0);

  topChartInstance = new Chart(pieCtx, {
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
  const barDatasets = Object.entries(barData).map(([label, values], i) => ({
    label,
    data: [values[1], values[2], values[3]],
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

function renderDetailSection(containerId, title, rows) {
  const container = document.createElement("section");
  container.className = "mb-16";
  container.id = containerId;

  const chartIdPie = `${containerId}-pie`;
  const chartIdBar = `${containerId}-bar`;
  const tableId = `${containerId}-table`;

  container.innerHTML = `
    <h2 class="text-2xl font-bold mb-4">${title}</h2>
    <div class="chart-row">
      <div class="chart-tile">
        <h3 class="text-lg font-semibold text-center mb-2">FY26 Breakdown</h3>
        <canvas id="${chartIdPie}" height="240"></canvas>
      </div>
      <div class="chart-tile">
        <h3 class="text-lg font-semibold text-center mb-2">3-Year Trend</h3>
        <canvas id="${chartIdBar}" height="240"></canvas>
      </div>
    </div>
    <div class="overflow-x-auto border rounded-lg shadow-md mt-4">
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
  `;

  document.getElementById("revenueSections").appendChild(container);

  const pieMap = {};
  const barMap = {};
  let grandTotals = [0, 0, 0];

  const grouped = groupByCategory2(rows);
  const tbody = container.querySelector(`#${tableId}`);

  Object.entries(grouped).forEach(([subcat, items]) => {
    let subtotal = [0, 0, 0];

    items.forEach(row => {
      const desc = row["Description"];
      const fy24 = parseFloat(row["2024 ACTUAL"].replace(/,/g, "")) || 0;
      const fy25 = parseFloat(row["2025 ACTUAL"].replace(/,/g, "")) || 0;
      const fy26 = parseFloat(row["2026 BUDGET"].replace(/,/g, "")) || 0;
      const [chg, pct] = calculateChange(fy25, fy26);

      tbody.innerHTML += `
        <tr>
          <td class="p-3">${desc}</td>
          <td class="p-3 text-right">${formatCurrency(fy24)}</td>
          <td class="p-3 text-right">${formatCurrency(fy25)}</td>
          <td class="p-3 text-right">${formatCurrency(fy26)}</td>
          <td class="p-3 text-right">${formatCurrency(chg)}</td>
          <td class="p-3 text-right">${pct.toFixed(1)}%</td>
        </tr>
      `;

      subtotal[0] += fy24;
      subtotal[1] += fy25;
      subtotal[2] += fy26;

      pieMap[desc] = (pieMap[desc] || 0) + fy26;
      if (!barMap[desc]) barMap[desc] = [0, 0, 0];
      barMap[desc][0] += fy24;
      barMap[desc][1] += fy25;
      barMap[desc][2] += fy26;
    });

    const [chg, pct] = calculateChange(subtotal[1], subtotal[2]);
    tbody.innerHTML += `
      <tr class="bg-gray-100 font-semibold">
        <td class="p-3 text-right">Subtotal - ${subcat}</td>
        <td class="p-3 text-right">${formatCurrency(subtotal[0])}</td>
        <td class="p-3 text-right">${formatCurrency(subtotal[1])}</td>
        <td class="p-3 text-right">${formatCurrency(subtotal[2])}</td>
        <td class="p-3 text-right">${formatCurrency(chg)}</td>
        <td class="p-3 text-right">${pct.toFixed(1)}%</td>
      </tr>
    `;

    grandTotals[0] += subtotal[0];
    grandTotals[1] += subtotal[1];
    grandTotals[2] += subtotal[2];
  });

  const [totalChg, totalPct] = calculateChange(grandTotals[1], grandTotals[2]);
  tbody.innerHTML += `
    <tr class="bg-gray-300 font-extrabold">
      <td class="p-3 text-right">Grand Total</td>
      <td class="p-3 text-right">${formatCurrency(grandTotals[0])}</td>
      <td class="p-3 text-right">${formatCurrency(grandTotals[1])}</td>
      <td class="p-3 text-right">${formatCurrency(grandTotals[2])}</td>
      <td class="p-3 text-right">${formatCurrency(totalChg)}</td>
      <td class="p-3 text-right">${totalPct.toFixed(1)}%</td>
    </tr>
  `;

  // Render Pie + Bar Charts
  new Chart(document.getElementById(chartIdPie).getContext("2d"), {
    type: "pie",
    data: {
      labels: Object.keys(pieMap),
      datasets: [{ data: Object.values(pieMap), backgroundColor: colors }]
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.raw;
              const pct = ((val / Object.values(pieMap).reduce((a,b)=>a+b,0)) * 100).toFixed(1);
              return `${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  new Chart(document.getElementById(chartIdBar).getContext("2d"), {
    type: "bar",
    data: {
      labels: ["FY24", "FY25", "FY26"],
      datasets: Object.entries(barMap).map(([label, values], i) => ({
        label,
        data: values,
        backgroundColor: colors[i % colors.length]
      }))
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });
}

function renderDetailSections(data) {
  const container = document.getElementById("revenueSections");
  const groups = groupDataByCategory1(data);
  container.innerHTML = ""; // clear existing content if any

  Object.entries(groups).forEach(([cat, rows], idx) => {
    const id = `revenue-category-${idx}`;
    renderDetailSection(id, cat, rows);
  });
}

// Load and render everything
Papa.parse(revenueDataUrl, {
  header: true,
  download: true,
  complete: results => {
    revenueData = results.data;
    const filtered = revenueData.filter(r => (r["2026 BUDGET"] || "").trim() !== "");
    renderTopCharts(filtered);
    renderDetailSections(filtered);
  }
});
