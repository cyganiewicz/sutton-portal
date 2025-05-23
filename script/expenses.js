
// expenses.js — full restore with sticky header, fund filtering, sidebar, charts, and summary tiles

let currentFund = "010";
const chartOfAccountsUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRezgn-Gen4lhkuO13Jm_y1QhYP4UovUyDKuLvGGrKqo1JwqnzSVdsSOr26epUKCkNuWdIQd-mu46sW/pub?output=csv";
const expenseSheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTQI0lHBLQexriYO48j0pv5wbmy0e3osDh1m9QPZB9xBkq5KRqqxFrZFroAK5Gg0_NIaTht7c7RPcWQ/pub?output=csv";

let expenseData = [];
let departmentMap = {};
let functionMap = {};
let chartInstance = null;
let stackedInstance = null;

function formatCurrency(value) {
  return "$" + parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function calculateChange(fy25, fy26) {
  const change = fy26 - fy25;
  const percent = fy25 === 0 ? 0 : (change / fy25) * 100;
  return [change, percent];
}

function renderSidebar() {
  const sidebar = document.getElementById("sidebarMenu");
  sidebar.innerHTML = "";
  const grouped = {};

  Object.keys(departmentMap).forEach(code => {
    const func = functionMap[code] || "Other";
    if (!grouped[func]) grouped[func] = [];
    grouped[func].push({ code, name: departmentMap[code] });
  });

  Object.entries(grouped).forEach(([func, depts]) => {
    const html = depts.map(d => {
      const anchor = `${d.name.replace(/\s+/g, '_')}-${func.replace(/\s+/g, '_')}`;
      return `<li><a href="#${anchor}" class="text-blue-600 hover:underline">${d.name}</a></li>`;
    }).join("");

    sidebar.innerHTML += `<strong>${func}</strong><ul class="ml-2 space-y-1">${html}</ul>`;
  });
}

function renderSummary(grandTotals, largestFunction, change, percent) {
  document.getElementById("statTotalBudget").textContent = formatCurrency(grandTotals.fy26).replace(".00", "M");
  document.getElementById("statTopFunction").textContent = largestFunction;
  document.getElementById("statDollarChange").textContent = formatCurrency(change);
  document.getElementById("statPercentChange").textContent = percent.toFixed(1) + "%";
}

function renderCharts(data) {
  const pieData = {};
  const barData = {};

  data.forEach(row => {
    const acct = row["Account Number"];
    if (!acct.trim().startsWith(currentFund)) return;
    const deptCode = acct.split("-")[1];
    const func = functionMap[deptCode] || "Unknown";
    const fy26 = parseFloat(row["2026 BUDGET"].replace(/,/g, "")) || 0;
    const fy25 = parseFloat(row["2025 BUDGET"].replace(/,/g, "")) || 0;
    const fy24 = parseFloat(row["2024 ACTUAL"].replace(/,/g, "")) || 0;
    const fy23 = parseFloat(row["2023 ACTUAL"].replace(/,/g, "")) || 0;

    pieData[func] = (pieData[func] || 0) + fy26;
    if (!barData[func]) barData[func] = [0, 0, 0, 0];
    barData[func][0] += fy23;
    barData[func][1] += fy24;
    barData[func][2] += fy25;
    barData[func][3] += fy26;
  });

  const pieCtx = document.getElementById("expenseChart").getContext("2d");
  const barCtx = document.getElementById("stackedChart").getContext("2d");

  const pieLabels = Object.keys(pieData);
  const pieValues = Object.values(pieData);
  const colors = pieLabels.map((_, i) => `hsl(${i * 360 / pieLabels.length}, 70%, 60%)`);
  const totalPie = pieValues.reduce((a, b) => a + b, 0);

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: pieLabels,
      datasets: [{ data: pieValues, backgroundColor: colors }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.raw;
              const pct = ((val / totalPie) * 100).toFixed(1);
              return `${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });

  if (stackedInstance) stackedInstance.destroy();
  stackedInstance = new Chart(barCtx, {
    type: "bar",
    data: {
      labels: ["FY23", "FY24", "FY25", "FY26"],
      datasets: Object.entries(barData).map(([label, values], i) => ({
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

function renderTable(filteredData) {
  const container = document.getElementById("expenseTable");
  const footer = document.getElementById("expenseTotal");
  container.innerHTML = "";
  footer.innerHTML = "";

  const grouped = {};
  let grandTotals = { fy23: 0, fy24: 0, fy25: 0, fy26: 0 };
  let largestFunction = "N/A";
  let largestValue = 0;

  filteredData.forEach(row => {
    const acct = row["Account Number"].trim();
    const deptCode = acct.split("-")[1];
    const func = functionMap[deptCode] || "Unknown";
    const dept = departmentMap[deptCode] || deptCode;

    if (!grouped[func]) grouped[func] = {};
    if (!grouped[func][dept]) grouped[func][dept] = [];
    grouped[func][dept].push(row);
  });

  Object.entries(grouped).forEach(([func, departments]) => {
    let funcTotal = 0;
    Object.entries(departments).forEach(([dept, rows]) => {
      let deptTotals = { fy23: 0, fy24: 0, fy25: 0, fy26: 0 };
      const anchorId = `${dept.replace(/\s+/g, '_')}-${func.replace(/\s+/g, '_')}`;

      rows.forEach(row => {
        const fy23 = parseFloat(row["2023 ACTUAL"].replace(/,/g, "")) || 0;
        const fy24 = parseFloat(row["2024 ACTUAL"].replace(/,/g, "")) || 0;
        const fy25 = parseFloat(row["2025 BUDGET"].replace(/,/g, "")) || 0;
        const fy26 = parseFloat(row["2026 BUDGET"].replace(/,/g, "")) || 0;
        const [change, pct] = calculateChange(fy25, fy26);

        deptTotals.fy23 += fy23;
        deptTotals.fy24 += fy24;
        deptTotals.fy25 += fy25;
        deptTotals.fy26 += fy26;

        container.innerHTML += `
          <div class="grid grid-cols-8 px-2 py-2">
            <div>${row["Account Number"]}</div>
            <div>${row["Description"]}</div>
            <div class="text-right">${formatCurrency(fy23)}</div>
            <div class="text-right">${formatCurrency(fy24)}</div>
            <div class="text-right">${formatCurrency(fy25)}</div>
            <div class="text-right">${formatCurrency(fy26)}</div>
            <div class="text-right">${formatCurrency(change)}</div>
            <div class="text-right">${pct.toFixed(1)}%</div>
          </div>`;
      });

      const [change, pct] = calculateChange(deptTotals.fy25, deptTotals.fy26);
      container.innerHTML += `
        <div id="${anchorId}" class="grid grid-cols-8 px-2 py-2 bg-gray-100 font-semibold">
          <div colspan="2" class="col-span-2 text-right">Subtotal - ${dept}</div>
          <div class="text-right">${formatCurrency(deptTotals.fy23)}</div>
          <div class="text-right">${formatCurrency(deptTotals.fy24)}</div>
          <div class="text-right">${formatCurrency(deptTotals.fy25)}</div>
          <div class="text-right">${formatCurrency(deptTotals.fy26)}</div>
          <div class="text-right">${formatCurrency(change)}</div>
          <div class="text-right">${pct.toFixed(1)}%</div>
        </div>`;

      funcTotal += deptTotals.fy26;
      grandTotals.fy23 += deptTotals.fy23;
      grandTotals.fy24 += deptTotals.fy24;
      grandTotals.fy25 += deptTotals.fy25;
      grandTotals.fy26 += deptTotals.fy26;
    });

    if (funcTotal > largestValue) {
      largestValue = funcTotal;
      largestFunction = func;
    }
  });

  const [change, pct] = calculateChange(grandTotals.fy25, grandTotals.fy26);
  footer.innerHTML = `
    <div class="grid grid-cols-8 px-2 py-2 bg-gray-300 font-extrabold">
      <div colspan="2" class="col-span-2 text-right">Grand Total</div>
      <div class="text-right">${formatCurrency(grandTotals.fy23)}</div>
      <div class="text-right">${formatCurrency(grandTotals.fy24)}</div>
      <div class="text-right">${formatCurrency(grandTotals.fy25)}</div>
      <div class="text-right">${formatCurrency(grandTotals.fy26)}</div>
      <div class="text-right">${formatCurrency(change)}</div>
      <div class="text-right">${pct.toFixed(1)}%</div>
    </div>`;

  renderSummary(grandTotals, largestFunction, change, pct);
}

function renderAll() {
  const filtered = expenseData.filter(row => row["Account Number"]?.trim().startsWith(currentFund));
  renderSidebar();
  renderTable(filtered);
  renderCharts(filtered);
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
      functionMap[code] = row["FUNCTION_1"] || row["FUNCTION_2"] || "Unknown";
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
