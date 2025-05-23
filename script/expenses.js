// expenses.js

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
  const tableContainer = document.getElementById("expenseTable");
  const totalContainer = document.getElementById("expenseTotal");
  tableContainer.innerHTML = "";
  totalContainer.innerHTML = "";

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

    const rowDiv = document.createElement("div");
    rowDiv.className = "grid grid-cols-8 p-3 hover:bg-gray-50";
    rowDiv.innerHTML = `
      <div>${acct}</div>
      <div>${desc}</div>
      <div>${formatCurrency(fy23)}</div>
      <div>${formatCurrency(fy24)}</div>
      <div>${formatCurrency(fy25)}</div>
      <div>${formatCurrency(fy26)}</div>
      <div>${formatCurrency(diff)}</div>
      <div>${pct.toFixed(1)}%</div>
    `;
    tableContainer.appendChild(rowDiv);
  });

  const [totalDiff, totalPct] = calculateChange(totalFY25, totalFY26);
  const footerDiv = document.createElement("div");
  footerDiv.className = "grid grid-cols-8 font-bold p-3 bg-gray-100 border-t border-gray-300";
  footerDiv.innerHTML = `
    <div colspan="2" class="col-span-2 text-right">Grand Total</div>
    <div>${formatCurrency(totalFY23)}</div>
    <div>${formatCurrency(totalFY24)}</div>
    <div>${formatCurrency(totalFY25)}</div>
    <div>${formatCurrency(totalFY26)}</div>
    <div>${formatCurrency(totalDiff)}</div>
    <div>${totalPct.toFixed(1)}%</div>
  `;
  totalContainer.appendChild(footerDiv);
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
