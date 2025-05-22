// JavaScript for Sutton Budget Portal - Expenses Page

const expenseSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTQI0lHBLQexriYO48j0pv5wbmy0e3osDh1m9QPZB9xBkq5KRqqxFrZFroAK5Gg0_NIaTht7c7RPcWQ/pub?output=csv';
const chartOfAccountsUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRezgn-Gen4lhkuO13Jm_y1QhYP4UovUyDKuLvGGrKqo1JwqnzSVdsSOr26epUKCkNuWdIQd-mu46sW/pub?output=csv';

let currentFund = "010";
let expenseData = [], departmentMap = {}, functionMap = {}, function2Map = {};
let chartInstance = null, stackedInstance = null;

function formatCurrency(num) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(num);
}

function calculateChange(prev, curr) {
  const diff = curr - prev;
  const pct = prev !== 0 ? (diff / prev) * 100 : 0;
  return [diff, pct];
}

function formatShortCurrency(num) {
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(0)}K`;
  return formatCurrency(num);
}

function updateSummaryTiles(summary, totalFY26, totalFY25) {
  const topFunc = Object.entries(summary).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  const [diff, pct] = calculateChange(totalFY25, totalFY26);

  document.getElementById("statTotalBudget").textContent = formatShortCurrency(totalFY26);
  document.getElementById("statTopFunction").textContent = topFunc;
  document.getElementById("statDollarChange").textContent = formatCurrency(diff);
  document.getElementById("statPercentChange").textContent = `${pct.toFixed(1)}%`;
}

function buildSidebar(groups) {
  const sidebar = document.getElementById("sidebarMenu");
  sidebar.innerHTML = "";
  Object.entries(groups).forEach(([func, depts]) => {
    const section = document.createElement("li");
    const links = depts.map(dept => {
      const anchor = `${dept.replace(/\s+/g, '_')}-${func.replace(/\s+/g, '_')}`;
      return `<li><a href="#${anchor}" class="text-blue-600 hover:underline">${dept}</a></li>`;
    }).join('');
    section.innerHTML = `<strong>${func}</strong><ul class="ml-4 space-y-1">${links}</ul>`;
    sidebar.appendChild(section);
  });
}

function renderPieChart(summary) {
  const ctx = document.getElementById("expenseChart").getContext("2d");
  const labels = Object.keys(summary);
  const data = Object.values(summary);
  const colors = labels.map((_, i) => `hsl(${i * 47 % 360}, 70%, 60%)`);

  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function renderBarChart(summaryMap) {
  const ctx = document.getElementById("stackedChart").getContext("2d");
  const labels = ["FY23", "FY24", "FY25", "FY26"];
  const datasets = Object.entries(summaryMap).map(([label, values], i) => ({
    label,
    data: values,
    backgroundColor: `hsl(${i * 37 % 360}, 60%, 55%)`
  }));

  if (stackedInstance) stackedInstance.destroy();
  stackedInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: true }, y: { stacked: true } }
    }
  });
}

function populateTable(data) {
  const tbody = document.getElementById("expenseTable");
  const tfoot = document.getElementById("expenseTotal");
  tbody.innerHTML = "";
  tfoot.innerHTML = "";

  const groups = {}, summary = {}, barData = {}, totals = [0, 0, 0, 0];

  data.forEach(row => {
    const account = row["Account Number"];
    const desc = row["Description"] || "";
    const deptCode = account?.split("-")[1];
    const dept = departmentMap[deptCode] || "Unknown";
    const func = functionMap[deptCode] || "Unknown";
    const func2 = function2Map[deptCode] || "Unknown";

    const fy = ["2023 ACTUAL", "2024 ACTUAL", "2025 BUDGET", "2026 BUDGET"].map(f => parseFloat(row[f]?.replace(/,/g, '')) || 0);
    fy.forEach((val, i) => totals[i] += val);

    if (!groups[func]) groups[func] = {};
    if (!groups[func][dept]) groups[func][dept] = [];
    groups[func][dept].push({ account, desc, fy });

    summary[func2] = (summary[func2] || 0) + fy[3];
    if (!barData[func2]) barData[func2] = [0, 0, 0, 0];
    fy.forEach((val, i) => barData[func2][i] += val);
  });

  Object.entries(groups).forEach(([func, depts]) => {
    let funcTotals = [0, 0, 0, 0];
    Object.entries(depts).forEach(([dept, rows]) => {
      let deptTotals = [0, 0, 0, 0];
      rows.forEach(r => {
        const [chg, pct] = calculateChange(r.fy[2], r.fy[3]);
        tbody.insertAdjacentHTML("beforeend", `
          <tr>
            <td class="p-2">${r.account}</td>
            <td class="p-2">${r.desc}</td>
            <td class="p-2">${formatCurrency(r.fy[0])}</td>
            <td class="p-2">${formatCurrency(r.fy[1])}</td>
            <td class="p-2">${formatCurrency(r.fy[2])}</td>
            <td class="p-2">${formatCurrency(r.fy[3])}</td>
            <td class="p-2">${formatCurrency(chg)}</td>
            <td class="p-2">${pct.toFixed(1)}%</td>
          </tr>`);
        r.fy.forEach((val, i) => deptTotals[i] += val);
      });
      const [chg, pct] = calculateChange(deptTotals[2], deptTotals[3]);
      tbody.insertAdjacentHTML("beforeend", `
        <tr class="bg-gray-100 font-semibold" id="${dept.replace(/\s+/g, '_')}-${func.replace(/\s+/g, '_')}">
          <td colspan="2" class="p-2 text-right">Subtotal - ${dept}</td>
          <td class="p-2">${formatCurrency(deptTotals[0])}</td>
          <td class="p-2">${formatCurrency(deptTotals[1])}</td>
          <td class="p-2">${formatCurrency(deptTotals[2])}</td>
          <td class="p-2">${formatCurrency(deptTotals[3])}</td>
          <td class="p-2">${formatCurrency(chg)}</td>
          <td class="p-2">${pct.toFixed(1)}%</td>
        </tr>`);
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
      </tr>`);
  });

  const [chg, pct] = calculateChange(totals[2], totals[3]);
  tfoot.innerHTML = `
    <tr class="bg-gray-300 font-extrabold">
      <td colspan="2" class="p-3 text-right">Grand Total</td>
      <td class="p-3">${formatCurrency(totals[0])}</td>
      <td class="p-3">${formatCurrency(totals[1])}</td>
      <td class="p-3">${formatCurrency(totals[2])}</td>
      <td class="p-3">${formatCurrency(totals[3])}</td>
      <td class="p-3">${formatCurrency(chg)}</td>
      <td class="p-3">${pct.toFixed(1)}%</td>
    </tr>`;

  updateSummaryTiles(summary, totals[3], totals[2]);
  renderPieChart(summary);
  renderBarChart(barData);
  buildSidebar(Object.fromEntries(Object.entries(groups).map(([f, d]) => [f, Object.keys(d)])));
}

document.getElementById("fundSelector").addEventListener("change", e => {
  currentFund = e.target.value;
  const filtered = expenseData.filter(row => row["Account Number"]?.startsWith(currentFund));
  populateTable(filtered);
});

window.addEventListener("DOMContentLoaded", () => {
  Papa.parse(chartOfAccountsUrl, {
    header: true,
    download: true,
    complete: results => {
      results.data.forEach(row => {
        const code = row["DEPT CODE"];
        departmentMap[code] = row["DEPARTMENT"];
        functionMap[code] = row["FUNCTION_1"] || row["FUNCTION_2"] || "Other";
        function2Map[code] = row["FUNCTION_2"] || row["FUNCTION_1"] || "Other";
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
});
