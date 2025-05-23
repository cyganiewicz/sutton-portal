// expenses.js — rewritten to use native <table> elements

function formatCurrency(value) {
  if (isNaN(value)) return "$0";
  return "$" + parseFloat(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function calculateChange(fy25, fy26) {
  const change = fy26 - fy25;
  const percent = fy25 === 0 ? 0 : (change / fy25) * 100;
  return [change, percent];
}

function renderTable(data) {
  const tableBody = document.getElementById("expenseTable");
  const tableFooter = document.getElementById("expenseTotal");
  tableBody.innerHTML = "";
  tableFooter.innerHTML = "";

  let totalFY23 = 0, totalFY24 = 0, totalFY25 = 0, totalFY26 = 0;

  data.forEach(row => {
    const acct = row["Account Number"] || "";
    const desc = row["Description"] || "";
    const fy23 = parseFloat(row["2023 ACTUAL"].replace(/,/g, "")) || 0;
    const fy24 = parseFloat(row["2024 ACTUAL"].replace(/,/g, "")) || 0;
    const fy25 = parseFloat(row["2025 BUDGET"].replace(/,/g, "")) || 0;
    const fy26 = parseFloat(row["2026 BUDGET"].replace(/,/g, "")) || 0;
    const [diff, pct] = calculateChange(fy25, fy26);

    totalFY23 += fy23;
    totalFY24 += fy24;
    totalFY25 += fy25;
    totalFY26 += fy26;

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

  const [totalDiff, totalPct] = calculateChange(totalFY25, totalFY26);
  const footerRow = document.createElement("tr");
  footerRow.className = "bg-gray-100 font-bold";
  footerRow.innerHTML = `
    <td colspan="2" class="p-3 text-right">Grand Total</td>
    <td class="p-3 text-right">${formatCurrency(totalFY23)}</td>
    <td class="p-3 text-right">${formatCurrency(totalFY24)}</td>
    <td class="p-3 text-right">${formatCurrency(totalFY25)}</td>
    <td class="p-3 text-right">${formatCurrency(totalFY26)}</td>
    <td class="p-3 text-right">${formatCurrency(totalDiff)}</td>
    <td class="p-3 text-right">${totalPct.toFixed(1)}%</td>
  `;
  tableFooter.appendChild(footerRow);
}

function loadData() {
  Papa.parse("https://docs.google.com/spreadsheets/d/e/2PACX-1vTQI0lHBLQexriYO48j0pv5wbmy0e3osDh1m9QPZB9xBkq5KRqqxFrZFroAK5Gg0_NIaTht7c7RPcWQ/pub?output=csv", {
    header: true,
    download: true,
    complete: function(results) {
      renderTable(results.data);
    }
  });
}

document.addEventListener("DOMContentLoaded", loadData);
