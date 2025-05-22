// JavaScript for Sutton Budget Portal - Expenses Page

const expenseSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTQI0lHBLQexriYO48j0pv5wbmy0e3osDh1m9QPZB9xBkq5KRqqxFrZFroAK5Gg0_NIaTht7c7RPcWQ/pub?output=csv';
const chartOfAccountsUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRezgn-Gen4lhkuO13Jm_y1QhYP4UovUyDKuLvGGrKqo1JwqnzSVdsSOr26epUKCkNuWdIQd-mu46sW/pub?output=csv';

let currentFund = "010";
let expenseData = [], departmentMap = {}, functionMap = {}, function2Map = {};
let chartInstance = null, stackedInstance = null;

const formatCurrency = num => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
}).format(num);

const formatShortCurrency = num => {
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`;
  return formatCurrency(num);
};

const calculateChange = (a, b) => {
  const diff = b - a;
  const pct = a === 0 ? 0 : (diff / a) * 100;
  return [diff, pct];
};

function buildSidebar(groupedData) {
  const sidebar = document.getElementById("sidebarMenu");
  sidebar.innerHTML = "";
  Object.entries(groupedData).forEach(([func, depts]) => {
    const section = document.createElement("li");
    const deptLinks = depts.map(dept => {
      const anchor = `${dept.replace(/\s+/g, '_')}-${func.replace(/\s+/g, '_')}`;
      return `<li><a href="#${anchor}" class="text-blue-600 hover:underline">${dept}</a></li>`;
    }).join('');
    section.innerHTML = `<strong>${func}</strong><ul class="ml-4 space-y-1">${deptLinks}</ul>`;
    sidebar.appendChild(section);
  });
}

function updateStats(summaryByFunction, deptCount, totalFY26) {
  const topFunc = Object.entries(summaryByFunction).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  document.getElementById("statTotalBudget").textContent = formatShortCurrency(totalFY26);
  document.getElementById("statDepartments").textContent = deptCount;
  document.getElementById("statTopFunction").textContent = topFunc;
}

function renderChart(dataByFunc2) {
  const ctx = document.getElementById("expenseChart").getContext("2d");
  const labels = Object.keys(dataByFunc2);
  const values = Object.values(dataByFunc2);
  const colors = labels.map((_, i) => `hsl(${i * 47 % 360}, 70%, 60%)`);

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{ label: "FY26", data: values, backgroundColor: colors }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });
}

function renderStackedChart(datasetMap) {
  const ctx = document.getElementById("stackedChart").getContext("2d");
  const years = ["FY23", "FY24", "FY25", "FY26"];
  const datasets = Object.entries(datasetMap).map(([label, values], i) => ({
    label,
    data: values,
    backgroundColor: `hsl(${i * 37 % 360}, 65%, 55%)`
  }));

  if (stackedInstance) stackedInstance.destroy();
  stackedInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels: years, datasets },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });
}

function populateTable(filteredData) {
  const tbody = document.getElementById("expenseTable");
  const tfoot = document.getElementById("expenseTotal");
  tbody.innerHTML = "";
  tfoot.innerHTML = "";

  const groups = {}, summaryByFunction2 = {};
  let grandTotals = [0, 0, 0, 0];
  let departmentSet = new Set();

  filteredData.forEach(row => {
    const account = row["Account Number"];
    const deptCode = account?.split("-")[1];
    const func = functionMap[deptCode] || "Unknown";
    const func2 = function2Map[deptCode] || "Unknown";
    const dept = departmentMap[deptCode] || "Unknown";
    const fy23 = parseFloat(row["2023 ACTUAL"].replace(/,/g, '')) || 0;
    const fy24 = parseFloat(row["2024 ACTUAL"].replace(/,/g, '')) || 0;
    const fy25 = parseFloat(row["2025 BUDGET"].replace(/,/g, '')) || 0;
    const fy26 = parseFloat(row["2026 BUDGET"].replace(/,/g, '')) || 0;

    if (!groups[func]) groups[func] = {};
    if (!groups[func][dept]) groups[func][dept] = [];
    groups[func][dept].push({ account, desc: row.Description, fy23, fy24, fy25, fy26 });

    summaryByFunction2[func2] = (summaryByFunction2[func2] || 0) + fy26;
    grandTotals[0] += fy23;
    grandTotals[1] += fy24;
    grandTotals[2] += fy25;
    grandTotals[3] += fy26;
    departmentSet.add(dept);
  });

  Object.entries(groups).forEach(([func, depts]) => {
    let funcTotals = [0, 0, 0, 0];
    Object.entries(depts).forEach(([dept, entries]) => {
      let deptTotals = [0, 0, 0, 0];
      entries.forEach(e => {
        const [chg, pct] = calculateChange(e.fy25, e.fy26);
        tbody.insertAdjacentHTML("beforeend", `
          <tr>
            <td class="p-2">${e.account}</td>
            <td class="p-2">${e.desc}</td>
            <td class="p-2">${formatCurrency(e.fy23)}</td>
            <td class="p-2">${formatCurrency(e.fy24)}</td>
            <td class="p-2">${formatCurrency(e.fy25)}</td>
            <td class="p-2">${formatCurrency(e.fy26)}</td>
            <td class="p-2">${formatCurrency(chg)}</td>
            <td class="p-2">${pct.toFixed(1)}%</td>
          </tr>
        `);
        deptTotals[0] += e.fy23;
        deptTotals[1] += e.fy24;
        deptTotals[2] += e.fy25;
        deptTotals[3] += e.fy26;
      });
      const [chg, pct] = calculateChange(deptTotals[2], deptTotals[3]);
      tbody.insertAdjacentHTML("beforeend", `
        <tr class="bg-gray-100 font-semibold">
          <td colspan="2" class="p-2 text-right">Subtotal - ${dept}</td>
          <td class="p-2">${formatCurrency(deptTotals[0])}</td>
          <td class="p-2">${formatCurrency(deptTotals[1])}</td>
          <td class="p-2">${formatCurrency(deptTotals[2])}</td>
          <td class="p-2">${formatCurrency(deptTotals[3])}</td>
          <td class="p-2">${formatCurrency(chg)}</td>
          <td class="p-2">${pct.toFixed(1)}%</td>
        </tr>
      `);
      funcTotals = funcTotals.map((v, i) => v + deptTotals[i]);
    });
    const [chg, pct] = calculateChange(funcTotals[2], funcTotals[3]);
    tbody.insertAdjacentHTML("beforeend", `
      <tr class="bg-gray-200 font-bold">
        <td colspan="2" class="p-2 text-right">Subtotal - ${func}</td>
        <td class="p-2">${formatCurrency(funcTotals[0])}</td>
        <td class="p-2">${formatCurrency(funcTotals[1])}</td>
        <td class="p-2">${formatCurrency(funcTotals[2])}</td>
        <td class="p-2">${formatCurrency(funcTotals[3])}</td>
        <td class="p-2">${formatCurrency(chg)}</td>
        <td class="p-2">${pct.toFixed(1)}%</td>
      </tr>
    `);
  });

  const [chg, pct] = calculateChange(grandTotals[2], grandTotals[3]);
  tfoot.innerHTML = `
    <tr class="bg-gray-300 font-extrabold">
      <td colspan="2" class="p-3 text-right">Grand Total</td>
      <td class="p-3">${formatCurrency(grandTotals[0])}</td>
      <td class="p-3">${formatCurrency(grandTotals[1])}</td>
      <td class="p-3">${formatCurrency(grandTotals[2])}</td>
      <td class="p-3">${formatCurrency(grandTotals[3])}</td>
      <td class="p-3">${formatCurrency(chg)}</td>
      <td class="p-3">${pct.toFixed(1)}%</td>
    </tr>
  `;

  updateStats(summaryByFunction2, departmentSet.size, grandTotals[3]);
  renderChart(summaryByFunction2);

  const stackedMap = {};
  filteredData.forEach(row => {
    const deptCode = row["Account Number"].split("-")[1];
    const func2 = function2Map[deptCode] || "Unknown";
    const values = stackedMap[func2] = stackedMap[func2] || [0, 0, 0, 0];
    values[0] += parseFloat(row["2023 ACTUAL"].replace(/,/g, '')) || 0;
    values[1] += parseFloat(row["2024 ACTUAL"].replace(/,/g, '')) || 0;
    values[2] += parseFloat(row["2025 BUDGET"].replace(/,/g, '')) || 0;
    values[3] += parseFloat(row["2026 BUDGET"].replace(/,/g, '')) || 0;
  });
  renderStackedChart(stackedMap);
  buildSidebar(Object.fromEntries(Object.entries(groups).map(([f, d]) => [f, Object.keys(d)])));
}

document.getElementById("fundSelector").addEventListener("change", e => {
  currentFund = e.target.value;
  const filtered = expenseData.filter(row => row["Account Number"]?.startsWith(currentFund));
  populateTable(filtered);
});

Papa.parse(chartOfAccountsUrl, {
  header: true,
  download: true,
  complete: results => {
    results.data.forEach(r => {
      const dept = r["DEPT CODE"];
      departmentMap[dept] = r["DEPARTMENT"];
      functionMap[dept] = r["FUNCTION_1"] || r["FUNCTION_2"] || "Other";
      function2Map[dept] = r["FUNCTION_2"] || r["FUNCTION_1"] || "Other";
    });
    Papa.parse(expenseSheetUrl, {
      header: true,
      download: true,
      complete: results => {
        expenseData = results.data;
        const filtered = expenseData.filter(row => row["Account Number"]?.startsWith(currentFund));
        populateTable(filtered);
      }
    });
  }
});
