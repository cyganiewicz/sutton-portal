// expenses.js (Full Refreshed Version with Mobile Dropdown Support)

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

function renderMobileSidebar() {
  const dropdown = document.getElementById("mobileSidebar");
  if (!dropdown) return;

  dropdown.innerHTML = '<option disabled selected>Jump to Department</option>';

  const grouped = {};
  Object.keys(departmentMap).forEach(code => {
    const func = functionMap[code] || "Other";
    if (!grouped[func]) grouped[func] = [];
    grouped[func].push({ code, name: departmentMap[code] });
  });

  Object.entries(grouped).forEach(([func, depts]) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = func;
    depts.forEach(({ name }) => {
      const option = document.createElement("option");
      const anchor = `${name.replace(/\s+/g, '_')}-${func.replace(/\s+/g, '_')}`;
      option.value = anchor;
      option.textContent = name;
      optgroup.appendChild(option);
    });
    dropdown.appendChild(optgroup);
  });

  dropdown.addEventListener("change", (e) => {
    const anchorId = e.target.value;
    const target = document.getElementById(anchorId);
    if (target) {
      const yOffset = -100;
      const y = target.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  });
}

function renderSummary(grandTotals, largestFunction, change, percent) {
  document.getElementById("statTotalBudget").textContent = formatCurrency(grandTotals.fy26).replace(".00", "M");
  document.getElementById("statTopFunction").textContent = largestFunction;
  document.getElementById("statDollarChange").textContent = formatCurrency(change);
  document.getElementById("statPercentChange").textContent = percent.toFixed(1) + "%";
}

function resizeCanvasForDPI(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return ctx;
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

  const pieCtx = resizeCanvasForDPI(document.getElementById("expenseChart"));
  const barCtx = resizeCanvasForDPI(document.getElementById("stackedChart"));

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

        const tr = document.createElement("tr");
        tr.className = "border-b";
        tr.innerHTML = `
          <td class="p-3">${row["Account Number"]}</td>
          <td class="p-3">${row["Description"]}</td>
          <td class="p-3 text-right">${formatCurrency(fy23)}</td>
          <td class="p-3 text-right">${formatCurrency(fy24)}</td>
          <td class="p-3 text-right">${formatCurrency(fy25)}</td>
          <td class="p-3 text-right">${formatCurrency(fy26)}</td>
          <td class="p-3 text-right">${formatCurrency(change)}</td>
          <td class="p-3 text-right">${pct.toFixed(1)}%</td>
        `;
        container.appendChild(tr);

        deptTotals.fy23 += fy23;
        deptTotals.fy24 += fy24;
        deptTotals.fy25 += fy25;
        deptTotals.fy26 += fy26;
      });

      const [change, pct] = calculateChange(deptTotals.fy25, deptTotals.fy26);
      const subtotalTr = document.createElement("tr");
      subtotalTr.id = anchorId;
      subtotalTr.className = "bg-gray-100 font-semibold";
      subtotalTr.innerHTML = `
        <td colspan="2" class="p-3 text-right">Subtotal - ${dept}</td>
        <td class="p-3 text-right">${formatCurrency(deptTotals.fy23)}</td>
        <td class="p-3 text-right">${formatCurrency(deptTotals.fy24)}</td>
        <td class="p-3 text-right">${formatCurrency(deptTotals.fy25)}</td>
        <td class="p-3 text-right">${formatCurrency(deptTotals.fy26)}</td>
        <td class="p-3 text-right">${formatCurrency(change)}</td>
        <td class="p-3 text-right">${pct.toFixed(1)}%</td>
      `;
      container.appendChild(subtotalTr);

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

  const [grandDiff, grandPct] = calculateChange(grandTotals.fy25, grandTotals.fy26);
  const footerTr = document.createElement("tr");
  footerTr.className = "bg-gray-300 font-extrabold";
  footerTr.innerHTML = `
    <td colspan="2" class="p-3 text-right">Grand Total</td>
    <td class="p-3 text-right">${formatCurrency(grandTotals.fy23)}</td>
    <td class="p-3 text-right">${formatCurrency(grandTotals.fy24)}</td>
    <td class="p-3 text-right">${formatCurrency(grandTotals.fy25)}</td>
    <td class="p-3 text-right">${formatCurrency(grandTotals.fy26)}</td>
    <td class="p-3 text-right">${formatCurrency(grandDiff)}</td>
    <td class="p-3 text-right">${grandPct.toFixed(1)}%</td>
  `;
  footer.appendChild(footerTr);

  renderSummary(grandTotals, largestFunction, grandDiff, grandPct);
}

function renderAll() {
  const filtered = expenseData.filter(row => row["Account Number"]?.trim().startsWith(currentFund));
  renderSidebar();
  renderMobileSidebar();  // ✅ now included
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
