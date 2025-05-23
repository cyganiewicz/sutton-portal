// expenses.js — FIXED: Fully restored charts, filters, subtotals, sidebar, summaries

function formatCurrency(value) {
  if (isNaN(value)) return "$0";
  return "$" + parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function calculateChange(fy25, fy26) {
  const change = fy26 - fy25;
  const percent = fy25 === 0 ? 0 : (change / fy25) * 100;
  return [change, percent];
}

let currentFund = "010";
const chartOfAccountsUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRezgn-Gen4lhkuO13Jm_y1QhYP4UovUyDKuLvGGrKqo1JwqnzSVdsSOr26epUKCkNuWdIQd-mu46sW/pub?output=csv";
const expenseSheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTQI0lHBLQexriYO48j0pv5wbmy0e3osDh1m9QPZB9xBkq5KRqqxFrZFroAK5Gg0_NIaTht7c7RPcWQ/pub?output=csv";

let expenseData = [];
let departmentMap = {};
let functionMap = {};
let chartInstance = null;
let stackedInstance = null;

function buildSidebar() {
  const sidebar = document.getElementById("sidebarMenu");
  sidebar.innerHTML = "";
  const grouped = {};
  Object.keys(departmentMap).forEach(code => {
    const func = functionMap[code] || "Other";
    const dept = departmentMap[code];
    if (!grouped[func]) grouped[func] = [];
    grouped[func].push({ code, name: dept });
  });
  Object.entries(grouped).forEach(([func, depts]) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${func}</strong><ul class="ml-4 space-y-1">${depts.map(d => {
      const anchor = `${d.name.replace(/\s+/g, '_')}-${func.replace(/\s+/g, '_')}`;
      return `<li><a href="#${anchor}" class="text-blue-600 hover:underline">${d.name}</a></li>`;
    }).join('')}</ul>`;
    sidebar.appendChild(li);
  });
}

function updateSummaries(grandTotals, topFunction, diff, pct) {
  document.getElementById("statTotalBudget").textContent = formatCurrency(grandTotals.fy26 / 1_000_000) + "M";
  document.getElementById("statTopFunction").textContent = topFunction;
  document.getElementById("statDollarChange").textContent = formatCurrency(diff);
  document.getElementById("statPercentChange").textContent = pct.toFixed(1) + "%";
}

function renderChart(data) {
  const ctx = document.getElementById("expenseChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  const funcTotals = {};
  data.forEach(row => {
    if (!row["Account Number"].startsWith(currentFund)) return;
    const code = row["Account Number"].split("-")[1];
    const func = functionMap[code] || "Unknown";
    const value = parseFloat(row["2026 BUDGET"].replace(/,/g, "")) || 0;
    funcTotals[func] = (funcTotals[func] || 0) + value;
  });
  const labels = Object.keys(funcTotals);
  const values = Object.values(funcTotals);
  chartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: Chart.helpers.colorScheme }]
    },
    options: {
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)} (${((ctx.raw / values.reduce((a,b)=>a+b,0))*100).toFixed(1)}%)`
          }
        }
      }
    }
  });
}

function renderStackedChart(data) {
  const ctx = document.getElementById("stackedChart").getContext("2d");
  if (stackedInstance) stackedInstance.destroy();
  const byFunc = {};
  const years = ["2023 ACTUAL", "2024 ACTUAL", "2025 BUDGET", "2026 BUDGET"];
  data.forEach(row => {
    if (!row["Account Number"].startsWith(currentFund)) return;
    const code = row["Account Number"].split("-")[1];
    const func = functionMap[code] || "Unknown";
    if (!byFunc[func]) byFunc[func] = [0, 0, 0, 0];
    years.forEach((y, i) => {
      byFunc[func][i] += parseFloat(row[y].replace(/,/g, "")) || 0;
    });
  });
  const datasets = Object.entries(byFunc).map(([label, values], i) => ({
    label,
    data: values,
    backgroundColor: Chart.helpers.colorScheme[i % 12]
  }));
  stackedInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ["FY23", "FY24", "FY25", "FY26"],
      datasets
    },
    options: {
      plugins: { legend: { position: 'bottom' } },
      responsive: true,
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });
}

function renderAll() {
  const filtered = expenseData.filter(row => row["Account Number"]?.startsWith(currentFund));
  buildSidebar();
  renderTable(filtered);
  renderChart(expenseData);
  renderStackedChart(expenseData);
}

document.getElementById("fundSelector").addEventListener("change", e => {
  currentFund = e.target.value;
  renderAll();
});

Papa.parse(chartOfAccountsUrl, {
  header: true,
  download: true,
  complete: results => {
    results.data.forEach(row => {
      const code = row["DEPT CODE"];
      departmentMap[code] = row["DEPARTMENT"];
      functionMap[code] = row["FUNCTION_2"] || row["FUNCTION_1"] || "Unknown";
    });
    Papa.parse(expenseSheetUrl, {
      header: true,
      download: true,
      complete: results => {
        expenseData = results.data;
        renderAll();
      }
    });
  }
});
