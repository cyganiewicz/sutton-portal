const capitalDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTdidCA9TjVUF9UrGHvavut7QMw0hXaRBNgN9J1FnPhB26XtOnsJ4Mupmr7KLKrq1d5aJDPobCXKvZX/pub?output=csv";

const formatCurrency = (val) => "$" + parseFloat(val).toLocaleString(undefined, { maximumFractionDigits: 0 });
const formatAbbrCurrency = (val) => "$" + (parseFloat(val) / 1e6).toFixed(1) + "M";
const titleCase = str => str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

let pieChartInstance = null;
let barChartInstance = null;

Papa.parse(capitalDataUrl, {
  download: true,
  header: true,
  complete: (results) => {
    const rows = results.data.filter(r => r["FISCAL YEAR"] && r["AMOUNT"]);
    if (!rows.length) return;

    const totalsByYear = {};
    const totalsByDept = {};
    const totalsByFunding = {};

    let mostRecentYear = Math.max(...rows.map(r => +r["FISCAL YEAR"]));
    let recentTotal = 0;
    let allTotal = 0;

    rows.forEach(row => {
      const year = +row["FISCAL YEAR"];
      const dept = titleCase(row["DEPARTMENT"]);
      const source = row["FUNDING SOURCE"] || "Unknown";
      const amount = parseFloat(row["AMOUNT"].replace(/,/g, "")) || 0;

      if (!totalsByYear[year]) totalsByYear[year] = [];
      totalsByYear[year].push({ ...row, DEPARTMENT: dept, AMOUNT: amount });

      totalsByDept[dept] = (totalsByDept[dept] || 0) + amount;
      totalsByFunding[source] = (totalsByFunding[source] || 0) + amount;

      if (year === mostRecentYear) recentTotal += amount;
      allTotal += amount;
    });

    const topDept = Object.entries(totalsByDept).sort((a,b) => b[1] - a[1])[0];
    const topFunding = Object.entries(totalsByFunding).sort((a,b) => b[1] - a[1])[0];

    document.getElementById("capRecentTotal").textContent = `Fiscal Year ${mostRecentYear} Capital Budget`;
    document.getElementById("capRecentTotalTile").querySelector(".tile-value").textContent = formatAbbrCurrency(recentTotal);
    document.getElementById("capTotalSpend").textContent = "Total Capital to Date";
    document.getElementById("capAllYearsTotalTile").querySelector(".tile-value").textContent = formatAbbrCurrency(allTotal);
    document.getElementById("capTopDept").textContent = `${topDept[0]} (${formatCurrency(topDept[1])})`;
    document.getElementById("capTopFunding").textContent = `${topFunding[0]}`;

    renderCharts(totalsByYear[mostRecentYear], totalsByYear);
    renderYearTiles(totalsByYear);
  }
});

function renderCharts(recentData, allData) {
  const pieCtx = document.getElementById("capitalPieChart").getContext("2d");
  const barCtx = document.getElementById("capitalStackedBar").getContext("2d");

  const deptMap = {};
  recentData.forEach(row => {
    deptMap[row.DEPARTMENT] = (deptMap[row.DEPARTMENT] || 0) + row.AMOUNT;
  });

  const labels = Object.keys(deptMap);
  const data = Object.values(deptMap);

  if (pieChartInstance) pieChartInstance.destroy();
  pieChartInstance = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels,
      datasets: [{ data, backgroundColor: labels.map((_, i) => `hsl(${i * 50 % 360}, 70%, 60%)`) }]
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${formatCurrency(ctx.raw)}`
          }
        }
      }
    }
  });

  const barLabels = Array.from(new Set(Object.keys(allData))).sort();
  const depts = Array.from(new Set([].concat(...Object.values(allData)).map(r => r.DEPARTMENT)));
  const datasets = depts.map((dept, i) => {
    return {
      label: dept,
      data: barLabels.map(y => {
        const rows = allData[y] || [];
        return rows.filter(r => r.DEPARTMENT === dept).reduce((sum, r) => sum + r.AMOUNT, 0);
      }),
      backgroundColor: `hsl(${i * 50 % 360}, 70%, 60%)`
    };
  });

  if (barChartInstance) barChartInstance.destroy();
  barChartInstance = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: barLabels,
      datasets
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });
}

function renderYearTiles(dataByYear) {
  const container = document.getElementById("capitalYearTiles");
  const tableContainer = document.getElementById("capitalYearTables");

  Object.entries(dataByYear).sort(([a], [b]) => b - a).forEach(([year, rows]) => {
    const total = rows.reduce((sum, r) => sum + r.AMOUNT, 0);
    const tile = document.createElement("div");
    tile.className = "year-tile";
    tile.innerHTML = `<div class="icon">📅</div><div>FY ${year}</div><div>${formatAbbrCurrency(total)}</div>`;
    container.appendChild(tile);

    const tableId = `table-${year}`;
    const tableWrapper = document.createElement("div");
    tableWrapper.id = tableId;
    tableWrapper.className = "hidden";

    const table = document.createElement("table");
    table.className = "min-w-full text-sm mt-4";
    table.innerHTML = `
      <thead><tr>
        <th class="text-left p-3">Department</th>
        <th class="text-left p-3">Purpose</th>
        <th class="text-right p-3">Amount</th>
        <th class="text-left p-3">Funding Source</th>
      </tr></thead>
      <tbody class="bg-white divide-y divide-gray-200">
        ${rows.map(r => `
          <tr>
            <td class="p-3">${r.DEPARTMENT}</td>
            <td class="p-3">${r.PURPOSE}</td>
            <td class="p-3 text-right">${formatCurrency(r.AMOUNT)}</td>
            <td class="p-3">${r["FUNDING SOURCE"]}</td>
          </tr>`).join("")}
      </tbody>
    `;
    tableWrapper.appendChild(table);
    tableContainer.appendChild(tableWrapper);

    tile.addEventListener("click", () => {
      document.querySelectorAll("#capitalYearTables > div").forEach(div => div.classList.add("hidden"));
      tableWrapper.classList.remove("hidden");
      tableWrapper.scrollIntoView({ behavior: "smooth" });
    });
  });
}
