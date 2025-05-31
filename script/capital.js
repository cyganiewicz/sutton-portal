const capitalDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTdidCA9TjVUF9UrGHvavut7QMw0hXaRBNgN9J1FnPhB26XtOnsJ4Mupmr7KLKrq1d5aJDPobCXKvZX/pub?gid=0&single=true&output=csv";

const formatCurrency = val => "$" + parseFloat(val).toLocaleString(undefined, { maximumFractionDigits: 0 });

const abbreviateCurrency = val => {
  const num = parseFloat(val);
  if (num >= 1e9) return "$" + (num / 1e9).toFixed(1) + "B";
  if (num >= 1e6) return "$" + (num / 1e6).toFixed(1) + "M";
  if (num >= 1e3) return "$" + (num / 1e3).toFixed(1) + "K";
  return "$" + num.toFixed(0);
};

const titleCase = str => str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

function updateSummaryTiles(data, latestFY) {
  let total = 0;
  let fyTotals = {}, deptTotals = {}, fundingCounts = {};

  data.forEach(r => {
    const amt = parseFloat(r["AMOUNT"]) || 0;
    const fy = r["FISCAL YEAR"];
    const dept = r["DEPARTMENT"];
    const fund = r["FUNDING SOURCE"];

    total += amt;
    fyTotals[fy] = (fyTotals[fy] || 0) + amt;
    deptTotals[dept] = (deptTotals[dept] || 0) + amt;
    fundingCounts[fund] = (fundingCounts[fund] || 0) + 1;
  });

  const recentTotal = fyTotals[latestFY];
  const topDept = Object.entries(deptTotals).sort((a, b) => b[1] - a[1])[0];
  const topFunding = Object.entries(fundingCounts).sort((a, b) => b[1] - a[1])[0];

  document.getElementById("capRecentTotal").innerHTML = `<strong>${abbreviateCurrency(recentTotal)}</strong>`;
  document.getElementById("capRecentTotalTile").querySelector(".tile-label").textContent = `Fiscal Year ${latestFY} Capital Budget`;

  document.getElementById("capTotalSpend").innerHTML = `<strong>${abbreviateCurrency(total)}</strong>`;
  document.getElementById("capAllYearsTotalTile").querySelector(".tile-label").textContent = "Total Capital to Date";

  document.getElementById("capTopDept").innerHTML = `<strong>${titleCase(topDept[0])} (${abbreviateCurrency(topDept[1])})</strong>`;
  document.getElementById("capTopFunding").innerHTML = `<strong>${titleCase(topFunding[0])}</strong>`;
}

function drawCapitalCharts(data, latestFY) {
  const pieCtx = document.getElementById("capitalPieChart").getContext("2d");
  const barCtx = document.getElementById("capitalStackedBar").getContext("2d");

  const pieMap = {}, barMap = {};
  data.forEach(row => {
    const amt = parseFloat(row["AMOUNT"]) || 0;
    const fy = row["FISCAL YEAR"];
    const dept = titleCase(row["DEPARTMENT"]);

    if (fy === latestFY) pieMap[dept] = (pieMap[dept] || 0) + amt;
    if (!barMap[dept]) barMap[dept] = {};
    barMap[dept][fy] = (barMap[dept][fy] || 0) + amt;
  });

  const pieLabels = Object.keys(pieMap);
  const pieValues = Object.values(pieMap);
  const pieColors = pieLabels.map((_, i) => `hsl(${i * 360 / pieLabels.length}, 70%, 60%)`);

  new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: pieLabels,
      datasets: [{ data: pieValues, backgroundColor: pieColors }]
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

  document.querySelector(".chart-tile h3").textContent = `Fiscal Year ${latestFY} Capital Plan by Department`;

  const fiscalYears = [...new Set(data.map(r => r["FISCAL YEAR"]))].sort();
  const barDatasets = Object.entries(barMap).map(([dept, vals], i) => ({
    label: dept,
    data: fiscalYears.map(fy => vals[fy] || 0),
    backgroundColor: pieColors[i % pieColors.length]
  }));

  new Chart(barCtx, {
    type: "bar",
    data: {
      labels: fiscalYears,
      datasets: barDatasets
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } },
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });
}

function createYearTiles(data) {
  const yearContainer = document.getElementById("capitalYearTiles");
  const tableContainer = document.getElementById("capitalYearTables");
  let currentlyOpen = null;

  const grouped = {};
  data.forEach(row => {
    const fy = row["FISCAL YEAR"];
    if (!grouped[fy]) grouped[fy] = [];
    grouped[fy].push(row);
  });

  Object.entries(grouped)
    .sort((a, b) => b[0] < a[0] ? 1 : -1)
    .forEach(([fy, items]) => {
      const total = items.reduce((sum, r) => sum + parseFloat(r["AMOUNT"] || 0), 0);

      // Tile
      const card = document.createElement("button");
      card.className = "fy-card";
      card.textContent = `FY ${fy} – ${abbreviateCurrency(total)}`;
      card.setAttribute("data-fy", fy);
      yearContainer.appendChild(card);

      // Table
      const wrapper = document.createElement("div");
      wrapper.className = "capital-fy-table";
      wrapper.id = `table-${fy}`;
      wrapper.style.display = "none";

      const table = document.createElement("table");
      table.className = "capital-table";
      const rows = items.map(r => `
        <tr>
          <td>${titleCase(r["DEPARTMENT"])}</td>
          <td>${r["PURPOSE"]}</td>
          <td class="text-right">${formatCurrency(r["AMOUNT"])}</td>
          <td>${titleCase(r["FUNDING SOURCE"])}</td>
        </tr>
      `).join("");

      const totalRow = `
        <tr class="font-semibold bg-gray-100">
          <td class="text-right" colspan="2">Total</td>
          <td class="text-right">${formatCurrency(total)}</td>
          <td></td>
        </tr>
      `;

      table.innerHTML = `
        <thead>
          <tr>
            <th>Department</th>
            <th>Purpose</th>
            <th>Amount</th>
            <th>Funding Source</th>
          </tr>
        </thead>
        <tbody>${rows + totalRow}</tbody>
      `;
      wrapper.appendChild(table);
      tableContainer.appendChild(wrapper);

      // Toggle logic
      card.addEventListener("click", () => {
        document.querySelectorAll(".fy-card").forEach(btn => btn.classList.remove("active"));
        document.querySelectorAll(".capital-fy-table").forEach(div => div.style.display = "none");

        if (currentlyOpen !== fy) {
          card.classList.add("active");
          wrapper.style.display = "block";
          currentlyOpen = fy;
        } else {
          currentlyOpen = null;
        }
      });
    });
}

// Load and render
Papa.parse(capitalDataUrl, {
  header: true,
  download: true,
  complete: results => {
    const data = results.data.filter(r => r["FISCAL YEAR"] && r["AMOUNT"]);
    const fiscalYears = [...new Set(data.map(r => r["FISCAL YEAR"]))].sort();
    const latestFY = fiscalYears[fiscalYears.length - 1];

    updateSummaryTiles(data, latestFY);
    drawCapitalCharts(data, latestFY);
    createYearTiles(data);
  }
});
