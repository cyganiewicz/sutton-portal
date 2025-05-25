const chartOfAccountsUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRezgn-Gen4lhkuO13Jm_y1QhYP4UovUyDKuLvGGrKqo1JwqnzSVdsSOr26epUKCkNuWdIQd-mu46sW/pub?output=csv";
const expenseSheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTQI0lHBLQexriYO48j0pv5wbmy0e3osDh1m9QPZB9xBkq5KRqqxFrZFroAK5Gg0_NIaTht7c7RPcWQ/pub?output=csv";

let functionMap = {};
let chartInstance = null;

function formatCurrency(value) {
  return "$" + parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function calculateChange(fy25, fy26) {
  const change = fy26 - fy25;
  const percent = fy25 === 0 ? 0 : (change / fy25) * 100;
  return [change, percent];
}

function drawPieChart(dataMap) {
  const ctx = document.getElementById("homeExpenseChart").getContext("2d");
  const labels = Object.keys(dataMap);
  const values = Object.values(dataMap);
  const total = values.reduce((sum, val) => sum + val, 0);
  const colors = labels.map((_, i) => `hsl(${i * 360 / labels.length}, 70%, 60%)`);

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
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

function populateSummaryTable(summaryMap) {
  const tbody = document.getElementById("homeSummaryTable");
  const tfootRow = document.getElementById("homeSummaryTotalRow");
  tbody.innerHTML = "";
  tfootRow.innerHTML = "";

  let totalFY25 = 0;
  let totalFY26 = 0;

  Object.entries(summaryMap).forEach(([func, [fy25, fy26]]) => {
    const [change, pct] = calculateChange(fy25, fy26);
    totalFY25 += fy25;
    totalFY26 += fy26;

    const row = `
  <tr>
    <td class="p-2">${func}</td>
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
        const data = results.data.filter(row => (row["Account Number"] || "").startsWith("010")); // General Fund only
        const summaryMap = {};
        const chartMap = {};

        data.forEach(row => {
          const acct = row["Account Number"];
          const deptCode = acct.split("-")[1];
          const func = functionMap[deptCode] || "Unknown";
          const fy25 = parseFloat(row["2025 BUDGET"].replace(/,/g, "")) || 0;
          const fy26 = parseFloat(row["2026 BUDGET"].replace(/,/g, "")) || 0;

          if (!summaryMap[func]) summaryMap[func] = [0, 0];
          summaryMap[func][0] += fy25;
          summaryMap[func][1] += fy26;

          chartMap[func] = (chartMap[func] || 0) + fy26;
        });

        drawPieChart(chartMap);
        populateSummaryTable(summaryMap);
      }
    });
  }
});
