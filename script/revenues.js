// revenues.js

const revenueSheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1YaxCko649QeAXcYP83nDoDk7n_9FPX7vL7QwzcyDR9DMHBKsep5S-7tphpwlzQ-yZY5s-KOhYEPO/pub?gid=0&single=true&output=csv";

let chartInstances = {};

function formatCurrency(value) {
  return "$" + parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function calculateChange(fy25, fy26) {
  const change = fy26 - fy25;
  const percent = fy25 === 0 ? 0 : (change / fy25) * 100;
  return [change, percent];
}

function drawCharts(ctxPie, ctxBar, labels, valuesByYear) {
  const colors = labels.map((_, i) => `hsl(${i * 360 / labels.length}, 70%, 60%)`);
  const total = valuesByYear.fy26.reduce((sum, v) => sum + v, 0);

  if (chartInstances[ctxPie]) chartInstances[ctxPie].destroy();
  chartInstances[ctxPie] = new Chart(document.getElementById(ctxPie), {
    type: "pie",
    data: {
      labels,
      datasets: [{ data: valuesByYear.fy26, backgroundColor: colors }]
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.raw;
              const pct = ((val / total) * 100).toFixed(1);
              return `${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  if (chartInstances[ctxBar]) chartInstances[ctxBar].destroy();
  chartInstances[ctxBar] = new Chart(document.getElementById(ctxBar), {
    type: "bar",
    data: {
      labels: ["FY23", "FY24", "FY25", "FY26"],
      datasets: labels.map((label, i) => ({
        label,
        backgroundColor: colors[i],
        data: [valuesByYear.fy23[i], valuesByYear.fy24[i], valuesByYear.fy25[i], valuesByYear.fy26[i]]
      }))
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });
}

function renderTable(rows, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  rows.forEach(row => {
    const fy23 = parseFloat(row["2023 ACTUAL"].replace(/,/g, "")) || 0;
    const fy24 = parseFloat(row["2024 ACTUAL"].replace(/,/g, "")) || 0;
    const fy25 = parseFloat(row["2025 ACTUAL"].replace(/,/g, "")) || 0;
    const fy26 = parseFloat(row["2026 BUDGET"].replace(/,/g, "")) || 0;
    const [chg, pct] = calculateChange(fy25, fy26);
    container.innerHTML += `
      <tr>
        <td class="p-2">${row.Description}</td>
        <td class="p-2 text-right">${formatCurrency(fy23)}</td>
        <td class="p-2 text-right">${formatCurrency(fy24)}</td>
        <td class="p-2 text-right">${formatCurrency(fy25)}</td>
        <td class="p-2 text-right">${formatCurrency(fy26)}</td>
        <td class="p-2 text-right">${formatCurrency(chg)}</td>
        <td class="p-2 text-right">${pct.toFixed(1)}%</td>
      </tr>`;
  });
}

Papa.parse(revenueSheetUrl, {
  header: true,
  download: true,
  complete: results => {
    const rows = results.data.filter(row => row.Description);

    const categories = [...new Set(rows.map(row => row.REV_CATEGORY_1))];

    categories.forEach(category => {
      const sectionRows = rows.filter(r => r.REV_CATEGORY_1 === category);
      const labels = [];
      const valuesByYear = { fy23: [], fy24: [], fy25: [], fy26: [] };

      sectionRows.forEach(row => {
        const label = row.REV_CATEGORY_2 || row.Description;
        labels.push(label);
        valuesByYear.fy23.push(parseFloat(row["2023 ACTUAL"].replace(/,/g, "")) || 0);
        valuesByYear.fy24.push(parseFloat(row["2024 ACTUAL"].replace(/,/g, "")) || 0);
        valuesByYear.fy25.push(parseFloat(row["2025 ACTUAL"].replace(/,/g, "")) || 0);
        valuesByYear.fy26.push(parseFloat(row["2026 BUDGET"].replace(/,/g, "")) || 0);
      });

      drawCharts(`${category}-pie`, `${category}-bar`, labels, valuesByYear);
      renderTable(sectionRows, `${category}-table`);
    });
  }
});
