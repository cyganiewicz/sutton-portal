// expenses.js — full restore with fund filtering and subtotals

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

function renderTable(data) {
  const tableBody = document.getElementById("expenseTable");
  const tableFooter = document.getElementById("expenseTotal");
  tableBody.innerHTML = "";
  tableFooter.innerHTML = "";

  let grandTotals = { fy23: 0, fy24: 0, fy25: 0, fy26: 0 };
  const grouped = {};

  data.forEach(row => {
    const acct = row["Account Number"] || "";
    if (!acct.startsWith(currentFund)) return;
    const deptCode = acct.split("-")[1];
    const func = functionMap[deptCode] || "Unknown";
    const dept = departmentMap[deptCode] || deptCode;

    if (!grouped[func]) grouped[func] = {};
    if (!grouped[func][dept]) grouped[func][dept] = [];
    grouped[func][dept].push(row);
  });

  Object.entries(grouped).forEach(([func, departments]) => {
    let funcTotals = { fy23: 0, fy24: 0, fy25: 0, fy26: 0 };

    Object.entries(departments).forEach(([dept, rows]) => {
      let deptTotals = { fy23: 0, fy24: 0, fy25: 0, fy26: 0 };

      rows.forEach(row => {
        const acct = row["Account Number"];
        const desc = row["Description"] || "";
        const fy23 = parseFloat(row["2023 ACTUAL"].replace(/,/g, "")) || 0;
        const fy24 = parseFloat(row["2024 ACTUAL"].replace(/,/g, "")) || 0;
        const fy25 = parseFloat(row["2025 BUDGET"].replace(/,/g, "")) || 0;
        const fy26 = parseFloat(row["2026 BUDGET"].replace(/,/g, "")) || 0;
        const [diff, pct] = calculateChange(fy25, fy26);

        deptTotals.fy23 += fy23;
        deptTotals.fy24 += fy24;
        deptTotals.fy25 += fy25;
        deptTotals.fy26 += fy26;

        const tr = document.createElement("tr");
        tr.className = "border-b";
        tr.innerHTML = `
          <td class="p-3">${acct}</td>
          <td class="p-3">${desc}</td>
          <td class="p-3 text-right">${formatCurrency(fy23)}</td>
          <td class="p-3 text-right">${formatCurrency(fy24)}</td>
          <td class="p-3 text-right">${formatCurrency(fy25)}</td>
          <td class="p-3 text-right">${formatCurrency(fy26)}</td>
          <td class="p-3 text-right">${formatCurrency(diff)}</td>
          <td class="p-3 text-right">${pct.toFixed(1)}%</td>
        `;
        tableBody.appendChild(tr);
      });

      const [deptDiff, deptPct] = calculateChange(deptTotals.fy25, deptTotals.fy26);
      const subtotalTr = document.createElement("tr");
      subtotalTr.className = "bg-gray-100 font-semibold";
      subtotalTr.innerHTML = `
        <td colspan="2" class="p-3 text-right">Subtotal - ${dept}</td>
        <td class="p-3 text-right">${formatCurrency(deptTotals.fy23)}</td>
        <td class="p-3 text-right">${formatCurrency(deptTotals.fy24)}</td>
        <td class="p-3 text-right">${formatCurrency(deptTotals.fy25)}</td>
        <td class="p-3 text-right">${formatCurrency(deptTotals.fy26)}</td>
        <td class="p-3 text-right">${formatCurrency(deptDiff)}</td>
        <td class="p-3 text-right">${deptPct.toFixed(1)}%</td>
      `;
      tableBody.appendChild(subtotalTr);

      funcTotals.fy23 += deptTotals.fy23;
      funcTotals.fy24 += deptTotals.fy24;
      funcTotals.fy25 += deptTotals.fy25;
      funcTotals.fy26 += deptTotals.fy26;
    });

    const [funcDiff, funcPct] = calculateChange(funcTotals.fy25, funcTotals.fy26);
    const funcTr = document.createElement("tr");
    funcTr.className = "bg-gray-200 font-bold";
    funcTr.innerHTML = `
      <td colspan="2" class="p-3 text-right">Subtotal - ${func}</td>
      <td class="p-3 text-right">${formatCurrency(funcTotals.fy23)}</td>
      <td class="p-3 text-right">${formatCurrency(funcTotals.fy24)}</td>
      <td class="p-3 text-right">${formatCurrency(funcTotals.fy25)}</td>
      <td class="p-3 text-right">${formatCurrency(funcTotals.fy26)}</td>
      <td class="p-3 text-right">${formatCurrency(funcDiff)}</td>
      <td class="p-3 text-right">${funcPct.toFixed(1)}%</td>
    `;
    tableBody.appendChild(funcTr);

    grandTotals.fy23 += funcTotals.fy23;
    grandTotals.fy24 += funcTotals.fy24;
    grandTotals.fy25 += funcTotals.fy25;
    grandTotals.fy26 += funcTotals.fy26;
  });

  const [grandDiff, grandPct] = calculateChange(grandTotals.fy25, grandTotals.fy26);
  const footerRow = document.createElement("tr");
  footerRow.className = "bg-gray-300 font-extrabold";
  footerRow.innerHTML = `
    <td colspan="2" class="p-3 text-right">Grand Total</td>
    <td class="p-3 text-right">${formatCurrency(grandTotals.fy23)}</td>
    <td class="p-3 text-right">${formatCurrency(grandTotals.fy24)}</td>
    <td class="p-3 text-right">${formatCurrency(grandTotals.fy25)}</td>
    <td class="p-3 text-right">${formatCurrency(grandTotals.fy26)}</td>
    <td class="p-3 text-right">${formatCurrency(grandDiff)}</td>
    <td class="p-3 text-right">${grandPct.toFixed(1)}%</td>
  `;
  tableFooter.appendChild(footerRow);
}

document.getElementById("fundSelector").addEventListener("change", e => {
  currentFund = e.target.value;
  renderTable(expenseData);
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
        renderTable(expenseData);
      }
    });
  }
});
