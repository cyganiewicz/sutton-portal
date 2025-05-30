// scripts/capital.js
const capitalDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTdidCA9TjVUF9UrGHvavut7QMw0hXaRBNgN9J1FnPhB26XtOnsJ4Mupmr7KLKrq1d5aJDPobCXKvZX/pub?gid=0&single=true&output=csv";

let chartPie = null;
let chartBar = null;

function formatCurrencyShort(num) {
  if (num >= 1_000_000) return "$" + (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return "$" + (num / 1_000).toFixed(1) + "K";
  return "$" + num.toFixed(0);
}

function groupBy(arr, key) {
  return arr.reduce((acc, obj) => {
    const val = obj[key] || "Unknown";
    acc[val] = acc[val] || [];
    acc[val].push(obj);
    return acc;
  }, {});
}

function updateSummary(data) {
  const latestYear = Math.max(...data.map(r => parseInt(r["FISCAL YEAR"] || 0)));
  const byDept = groupBy(data, "DEPARTMENT");
  const byFund = groupBy(data, "FUNDING SOURCE");

  let totalAll = 0;
  let totalRecent = 0;
  const deptTotals = {};

  data.forEach(row => {
    const amt = parseFloat(row["AMOUNT"].replace(/,/g, "")) || 0;
    const year = parseInt(row["FISCAL YEAR"]);
    const dept = row["DEPARTMENT"];
    totalAll += amt;
    if (year === latestYear) totalRecent += amt;
    deptTotals[dept] = (deptTotals[dept] || 0) + amt;
  });

  const topDept = Object.entries(deptTotals).sort((a, b) => b[1] - a[1])[0];
  const topFund = Object.entries(byFund).sort((a, b) => b[1].length - a[1].length)[0];

  document.getElementById("capRecentTotal").textContent = formatCurrencyShort(totalRecent);
  document.getElementById("capTotalSpend").textContent = formatCurrencyShort(totalAll);
  document.getElementById("capTopDept").textContent = `${topDept[0]} (${formatCurrencyShort(topDept[1])})`;
  document.getElementById("capTopFunding").textContent = topFund[0];
}

function renderPieChart(data, latestYear) {
  const ctx = document.getElementById("capitalPieChart").getContext("2d");
  const pieMap = {};

  data.forEach(row => {
    if (parseInt(row["FISCAL YEAR"]) !== latestYear) return;
    const dept = row["DEPARTMENT"];
    const amt = parseFloat(row["AMOUNT"].replace(/,/g, "")) || 0;
    pieMap[dept] = (pieMap[dept] || 0) + amt;
  });

  const labels = Object.keys(pieMap);
  const values = Object.values(pieMap);
  const colors = labels.map((_, i) => `hsl(${i * 360 / labels.length}, 70%, 60%)`);

  if (chartPie) chartPie.destroy();
  chartPie = new Chart(ctx, {
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
            label: ctx => `${ctx.label}: ${formatCurrencyShort(ctx.raw)}`
          }
        }
      }
    }
  });
}

function renderStackedBar(data) {
  const ctx = document.getElementById("capitalStackedBar").getContext("2d");
  const byYear = groupBy(data, "FISCAL YEAR");
  const allDepts = Array.from(new Set(data.map(r => r["DEPARTMENT"])));
  const years = Object.keys(byYear).sort();

  const datasets = allDepts.map((dept, i) => {
    const values = years.map(year => {
      return byYear[year].filter(r => r["DEPARTMENT"] === dept)
        .reduce((sum, r) => sum + (parseFloat(r["AMOUNT"].replace(/,/g, "")) || 0), 0);
    });
    return {
      label: dept,
      data: values,
      backgroundColor: `hsl(${i * 360 / allDepts.length}, 70%, 60%)`
    };
  });

  if (chartBar) chartBar.destroy();
  chartBar = new Chart(ctx, {
    type: "bar",
    data: {
      labels: years,
      datasets
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      responsive: true,
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });
}

function createYearTiles(data) {
  const years = [...new Set(data.map(row => row["FISCAL YEAR"]))].sort();
  const container = document.getElementById("capitalYearTiles");
  const tablesContainer = document.getElementById("capitalYearTables");

  years.forEach(year => {
    const yearData = data.filter(r => r["FISCAL YEAR"] === year);
    const total = yearData.reduce((sum, r) => sum + (parseFloat(r["AMOUNT"].replace(/,/g, "")) || 0), 0);

    const tile = document.createElement("button");
    tile.className = "px-4 py-3 bg-white rounded shadow hover:bg-green-100 transition";
    tile.innerHTML = `<strong>FY${year}</strong><br>${formatCurrencyShort(total)}`;
    tile.addEventListener("click", () => {
      const table = document.getElementById(`table-${year}`);
      table.classList.toggle("hidden");
    });
    container.appendChild(tile);

    const table = document.createElement("div");
    table.id = `table-${year}`;
    table.className = "hidden overflow-auto border rounded bg-white shadow-md p-4";
    table.innerHTML = `
      <h4 class="text-xl font-semibold mb-4">FY${year} Capital Projects</h4>
      <table class="min-w-full text-sm">
        <thead>
          <tr class="bg-gray-100">
            <th class="text-left p-2">Department</th>
            <th class="text-left p-2">Purpose</th>
            <th class="text-right p-2">Amount</th>
            <th class="text-left p-2">Funding Source</th>
          </tr>
        </thead>
        <tbody>
          ${yearData.map(r => `
            <tr>
              <td class="p-2">${r["DEPARTMENT"]}</td>
              <td class="p-2">${r["PURPOSE"]}</td>
              <td class="p-2 text-right">${formatCurrencyShort(parseFloat(r["AMOUNT"].replace(/,/g, "")) || 0)}</td>
              <td class="p-2">${r["FUNDING SOURCE"]}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    tablesContainer.appendChild(table);
  });
}

// Load and render
Papa.parse(capitalDataUrl, {
  header: true,
  download: true,
  complete: results => {
    const data = results.data.filter(r => r["FISCAL YEAR"] && r["AMOUNT"]);
    const latestYear = Math.max(...data.map(r => parseInt(r["FISCAL YEAR"] || 0)));
    updateSummary(data);
    renderPieChart(data, latestYear);
    renderStackedBar(data);
    createYearTiles(data);
  }
});
