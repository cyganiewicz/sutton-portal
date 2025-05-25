const revenueDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1YaxCko649QeAXcYP83nDoDk7n_9FPX7vL7QwzcyDR9DMHBKsep5S-7tphpwlzQ-yZY5s-KOhYEPO/pub?output=csv";
const categoryNames = ["Real and Personal Property Taxes", "State Aid and Assessments", "Local Receipts"];

let totalChart, totalBarCharts = [];

function formatCurrency(val) {
  return "$" + parseFloat(val).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function createPieChart(ctx, labels, values) {
  const total = values.reduce((sum, v) => sum + v, 0);
  return new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_, i) => `hsl(${i * 360 / labels.length}, 70%, 60%)`)
      }]
    },
    options: {
      responsive: true,
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
}

function createBarChart(ctx, labels, valuesByYear) {
  const colors = labels.map((_, i) => `hsl(${i * 360 / labels.length}, 70%, 60%)`);
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["2023", "2024", "2025", "2026"],
      datasets: labels.map((label, i) => ({
        label,
        data: valuesByYear[label],
        backgroundColor: colors[i]
      }))
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" }
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true }
      }
    }
  });
}

function populateTable(id, rows) {
  const tbody = document.getElementById(id);
  tbody.innerHTML = "";
  rows.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="p-2">${row.Description}</td>
      <td class="p-2 text-right">${formatCurrency(row["2023 ACTUAL"])}</td>
      <td class="p-2 text-right">${formatCurrency(row["2024 ACTUAL"])}</td>
      <td class="p-2 text-right">${formatCurrency(row["2025 ACTUAL"])}</td>
      <td class="p-2 text-right">${formatCurrency(row["2026 BUDGET"])}</td>
    `;
    tbody.appendChild(tr);
  });
}

function parseNumber(val) {
  return parseFloat(val.replace(/,/g, "")) || 0;
}

Papa.parse(revenueDataUrl, {
  header: true,
  download: true,
  complete: results => {
    const data = results.data.filter(row => row["REV_CATEGORY_1"]);
    const grouped = [[], [], []]; // For three major revenue categories

    data.forEach(row => {
      const categoryIndex = categoryNames.indexOf(row["REV_CATEGORY_1"]);
      if (categoryIndex !== -1) {
        grouped[categoryIndex].push(row);
      }
    });

    // Section-level charts & tables
    let overallMapPie = {};
    let overallMapBar = {};

    grouped.forEach((rows, index) => {
      const pieMap = {};
      const barMap = {};

      rows.forEach(row => {
        const key = row["REV_CATEGORY_2"] || row["Description"];
        const fy23 = parseNumber(row["2023 ACTUAL"]);
        const fy24 = parseNumber(row["2024 ACTUAL"]);
        const fy25 = parseNumber(row["2025 ACTUAL"]);
        const fy26 = parseNumber(row["2026 BUDGET"]);

        pieMap[key] = (pieMap[key] || 0) + fy26;
        if (!barMap[key]) barMap[key] = [0, 0, 0, 0];
        barMap[key][0] += fy23;
        barMap[key][1] += fy24;
        barMap[key][2] += fy25;
        barMap[key][3] += fy26;

        // Add to overall maps
        overallMapPie[key] = (overallMapPie[key] || 0) + fy26;
        if (!overallMapBar[key]) overallMapBar[key] = [0, 0, 0, 0];
        overallMapBar[key][0] += fy23;
        overallMapBar[key][1] += fy24;
        overallMapBar[key][2] += fy25;
        overallMapBar[key][3] += fy26;
      });

      // Charts per section
      createPieChart(document.getElementById(`revenuePie${index}`), Object.keys(pieMap), Object.values(pieMap));
      createBarChart(document.getElementById(`revenueBar${index}`), Object.keys(barMap), barMap);
      populateTable(`revenueTable${index}`, rows);
    });

    // Total-level charts
    createPieChart(document.getElementById("revenuePieTotal"), Object.keys(overallMapPie), Object.values(overallMapPie));
    createBarChart(document.getElementById("revenueBarTotal"), Object.keys(overallMapBar), overallMapBar);
  }
});
