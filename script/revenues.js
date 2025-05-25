// revenues.js (updated to dynamically create per-category sections)

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

function renderDetailSection(parentEl, category, rows) {
  const sectionId = category.replace(/\s+/g, '-').toLowerCase();
  const chartIdPie = `${sectionId}-pie`;
  const chartIdBar = `${sectionId}-bar`;
  const tableId = `${sectionId}-table`;

  const section = document.createElement("section");
  section.innerHTML = `
    <h2 class="text-2xl font-bold mb-4 mt-12">${category}</h2>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div class="chart-tile">
        <h3 class="text-lg font-semibold text-center mb-2">FY26 Breakdown</h3>
        <canvas id="${chartIdPie}"></canvas>
      </div>
      <div class="chart-tile">
        <h3 class="text-lg font-semibold text-center mb-2">3-Year Trend</h3>
        <canvas id="${chartIdBar}"></canvas>
      </div>
    </div>
    <div class="overflow-x-auto border rounded-lg shadow-md">
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
  parentEl.appendChild(section);

  const pieMap = {};
  const barMap = {};
  const table = section.querySelector(`#${tableId}`);
  let grandTotals = [0, 0, 0];

  const grouped = groupByCategory2(rows);

  Object.entries(grouped).forEach(([subcat, items]) => {
    let subtotal = [0, 0, 0];

    items.forEach(row => {
      const desc = row["Description"];
      const fy24 = parseFloat(row["2024 ACTUAL"].replace(/,/g, "")) || 0;
      const fy25 = parseFloat(row["2025 ACTUAL"].replace(/,/g, "")) || 0;
      const fy26 = parseFloat(row["2026 BUDGET"].replace(/,/g, "")) || 0;
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

      pieMap[desc] = (pieMap[desc] || 0) + fy26;
      if (!barMap[desc]) barMap[desc] = [0, 0, 0];
      barMap[desc][0] += fy24;
      barMap[desc][1] += fy25;
      barMap[desc][2] += fy26;
    });

    const [chg, pct] = calculateChange(subtotal[1], subtotal[2]);
    const subtr = document.createElement("tr");
    subtr.className = "bg-gray-100 font-semibold";
    subtr.innerHTML = `
      <td class="p-3 text-right">Subtotal - ${subcat}</td>
      <td class="p-3 text-right">${formatCurrency(subtotal[0])}</td>
      <td class="p-3 text-right">${formatCurrency(subtotal[1])}</td>
      <td class="p-3 text-right">${formatCurrency(subtotal[2])}</td>
      <td class="p-3 text-right">${formatCurrency(chg)}</td>
      <td class="p-3 text-right">${pct.toFixed(1)}%</td>
    `;
    table.appendChild(subtr);

    grandTotals[0] += subtotal[0];
    grandTotals[1] += subtotal[1];
    grandTotals[2] += subtotal[2];
  });

  const [totalChg, totalPct] = calculateChange(grandTotals[1], grandTotals[2]);
  const totalRow = document.createElement("tr");
  totalRow.className = "bg-gray-300 font-extrabold";
  totalRow.innerHTML = `
    <td class="p-3 text-right">Grand Total</td>
    <td class="p-3 text-right">${formatCurrency(grandTotals[0])}</td>
    <td class="p-3 text-right">${formatCurrency(grandTotals[1])}</td>
    <td class="p-3 text-right">${formatCurrency(grandTotals[2])}</td>
    <td class="p-3 text-right">${formatCurrency(totalChg)}</td>
    <td class="p-3 text-right">${totalPct.toFixed(1)}%</td>
  `;
  table.appendChild(totalRow);

  new Chart(section.querySelector(`#${chartIdPie}`).getContext("2d"), {
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
              const total = Object.values(pieMap).reduce((a, b) => a + b, 0);
              const pct = ((val / total) * 100).toFixed(1);
              return `${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  new Chart(section.querySelector(`#${chartIdBar}`).getContext("2d"), {
    type: "bar",
    data: {
      labels: ["FY24", "FY25", "FY26"],
      datasets: Object.entries(barMap).map(([label, vals], i) => ({
        label,
        data: vals,
        backgroundColor: colors[i % colors.length]
      }))
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });
}

Papa.parse(revenueDataUrl, {
  header: true,
  download: true,
  complete: results => {
    revenueData = results.data;
    const filtered = revenueData.filter(r => (r["2026 BUDGET"] || "").trim() !== "");
    renderTopCharts(filtered);

    const container = document.getElementById("revenueSections");
    const groups = groupDataByCategory1(filtered);
    Object.entries(groups).forEach(([cat, rows]) => {
      renderDetailSection(container, cat, rows);
    });
  }
});
