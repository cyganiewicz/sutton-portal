const chartOfAccountsUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRezgn-Gen4lhkuO13Jm_y1QhYP4UovUyDKuLvGGrKqo1JwqnzSVdsSOr26epUKCkNuWdIQd-mu46sW/pub?output=csv";
const expenseSheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTQI0lHBLQexriYO48j0pv5wbmy0e3osDh1m9QPZB9xBkq5KRqqxFrZFroAK5Gg0_NIaTht7c7RPcWQ/pub?output=csv";
const revenueSheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ1YaxCko649QeAXcYP83nDoDk7n_9FPX7vL7QwzcyDR9DMHBKsep5S-7tphpwlzQ-yZY5s-KOhYEPO/pub?output=csv";

let functionMap = {};
let expenseChart = null;
let revenueChart = null;

function formatCurrency(value) {
  return "$" + parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function calculateChange(fy25, fy26) {
  const change = fy26 - fy25;
  const percent = fy25 === 0 ? 0 : (change / fy25) * 100;
  return [change, percent];
}

function drawPieChart(ctxId, dataMap) {
  const ctx = document.getElementById(ctxId).getContext("2d");
  const labels = Object.keys(dataMap);
  const values = Object.values(dataMap);
  const total = values.reduce((sum, val) => sum + val, 0);
  const colors = labels.map((_, i) => `hsl(${i * 360 / labels.length}, 70%, 60%)`);

  return new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors }]
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

function populateSummaryTable(tbodyId, tfootId, summaryMap) {
  const tbody = document.getElementById(tbodyId);
  const tfootRow = document.getElementById(tfootId);
  tbody.innerHTML = "";
  tfootRow.innerHTML = "";

  let totalFY25 = 0;
  let totalFY26 = 0;

  Object.entries(summaryMap).forEach(([label, [fy25, fy26]]) => {
    const [change, pct] = calculateChange(fy25, fy26);
    totalFY25 += fy25;
    totalFY26 += fy26;

    const row = `
      <tr>
        <td class="p-2">${label}</td>
        <td class="p-2 text-right whitespace-nowrap">${formatCurrency(fy25)}</td>
        <td class="p-2 text-right whitespace-nowrap">${formatCurrency(fy26)}</td>
        <td class="p-2 text-right whitespace-nowrap">${formatCurrency(change)}</td>
        <td class="p-2 text-right whitespace-nowrap">${pct.toFixed(1)}%</td>
      </tr>`;
    tbody.insertAdjacentHTML("beforeend", row);
  });

  const [totalChange, totalPct] = calculateChange(totalFY25, totalFY26);
  tfootRow.innerHTML = `
    <td class="p-2 text-right font-semibold">Total</td>
    <td class="p-2 text-right whitespace-nowrap">${formatCurrency(totalFY25)}</td>
    <td class="p-2 text-right whitespace-nowrap">${formatCurrency(totalFY26)}</td>
    <td class="p-2 text-right whitespace-nowrap">${formatCurrency(totalChange)}</td>
    <td class="p-2 text-right whitespace-nowrap">${totalPct.toFixed(1)}%</td>
  `;
}

function getSafeValue(str) {
  return parseFloat((str || "").replace(/,/g, "")) || 0;
}

// Load Expense Data
Papa.parse(chartOfAccountsUrl, {
  header: true,
  download: true,
  complete: results => {
    results.data.forEach(row => {
      const code = row["DEPT CODE"];
      functionMap[code] = row["FUNCTION_2"] || "Unknown";
    });

    Papa.parse(expenseSheetUrl, {
      header: true,
      download: true,
      complete: results => {
        const data = results.data.filter(row => (row["Account Number"] || "").startsWith("010")); // General Fund
        const summaryMap = {};
        const chartMap = {};

        data.forEach(row => {
          const acct = row["Account Number"];
          const deptCode = acct.split("-")[1];
          const func = functionMap[deptCode] || "Unknown";
          const fy25 = getSafeValue(row["2025 BUDGET"]);
          const fy26 = getSafeValue(row["2026 BUDGET"]);

          if (!summaryMap[func]) summaryMap[func] = [0, 0];
          summaryMap[func][0] += fy25;
          summaryMap[func][1] += fy26;

          chartMap[func] = (chartMap[func] || 0) + fy26;
        });

        if (expenseChart) expenseChart.destroy();
        expenseChart = drawPieChart("homeExpenseChart", chartMap);
        populateSummaryTable("homeSummaryTable", "homeSummaryTotalRow", summaryMap);
      }
    });
  }
});

// Load Revenue Data
Papa.parse(revenueSheetUrl, {
  header: true,
  download: true,
  complete: results => {
    const data = results.data.filter(row => row["2026 BUDGET"]?.trim());

    // Pie: REV_CATEGORY_1
    const chartMap = {};
    // Table: REV_CATEGORY_2
    const summaryMap = {};

    data.forEach(row => {
      const cat1 = row["REV_CATEGORY_1"] || "Unknown";
      const cat2 = row["REV_CATEGORY_1"] || cat1;
      const fy25 = getSafeValue(row["2025 ACTUAL"]);
      const fy26 = getSafeValue(row["2026 BUDGET"]);

      chartMap[cat1] = (chartMap[cat1] || 0) + fy26;

      if (!summaryMap[cat2]) summaryMap[cat2] = [0, 0];
      summaryMap[cat2][0] += fy25;
      summaryMap[cat2][1] += fy26;
    });

    if (revenueChart) revenueChart.destroy();
    revenueChart = drawPieChart("homeRevenueChart", chartMap);
    populateSummaryTable("homeRevenueSummaryTable", "homeRevenueTotalRow", summaryMap);
  }
});

const capitalDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTdidCA9TjVUF9UrGHvavut7QMw0hXaRBNgN9J1FnPhB26XtOnsJ4Mupmr7KLKrq1d5aJDPobCXKvZX/pub?gid=0&single=true&output=csv";

function abbreviateCurrency(val) {
  const num = parseFloat(val);
  if (num >= 1e9) return "$" + (num / 1e9).toFixed(1) + "B";
  if (num >= 1e6) return "$" + (num / 1e6).toFixed(1) + "M";
  if (num >= 1e3) return "$" + (num / 1e3).toFixed(1) + "K";
  return "$" + num.toFixed(0);
}

const capitalDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTdidCA9TjVUF9UrGHvavut7QMw0hXaRBNgN9J1FnPhB26XtOnsJ4Mupmr7KLKrq1d5aJDPobCXKvZX/pub?gid=0&single=true&output=csv";

function abbreviateCurrency(val) {
  const num = parseFloat(val);
  if (num >= 1e9) return "$" + (num / 1e9).toFixed(1) + "B";
  if (num >= 1e6) return "$" + (num / 1e6).toFixed(1) + "M";
  if (num >= 1e3) return "$" + (num / 1e3).toFixed(1) + "K";
  return "$" + num.toFixed(0);
}

// Load Capital Data for Homepage Tile
Papa.parse(capitalDataUrl, {
  header: true,
  download: true,
  complete: (results) => {
    const rows = results.data.filter(r => r["FISCAL YEAR"] && r["AMOUNT"]);
    const yearMap = {};

    rows.forEach(r => {
      const year = r["FISCAL YEAR"].trim();
      const amt = parseFloat(r["AMOUNT"]) || 0;
      yearMap[year] = (yearMap[year] || 0) + amt;
    });

    const sortedYears = Object.keys(yearMap).sort((a, b) => parseInt(a) - parseInt(b));
    const latestFY = sortedYears[sortedYears.length - 1];
    const latestTotal = yearMap[latestFY];

    if (document.getElementById("capitalFYLabel")) {
      document.getElementById("capitalFYLabel").textContent = latestFY;
    }
    if (document.getElementById("capitalTotal")) {
      document.getElementById("capitalTotal").textContent = abbreviateCurrency(latestTotal);
    }
  }
});
