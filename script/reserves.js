const reservesDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTJcnqu3eiVpo6TWbbCtptfBwAgM5XXM1hP4t94MuhxvDW2Hb2tOhG-Cxei4WGDJ9G66DgfnLttzlwO/pub?gid=0&single=true&output=csv";

function formatCurrency(val) {
  return "$" + parseFloat(val).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPercent(val) {
  return (val * 100).toFixed(1) + "%";
}

function drawComboChart(ctxId, labels, amounts, percents, labelName) {
  const ctx = document.getElementById(ctxId).getContext("2d");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          type: "bar",
          label: `${labelName} ($)`,
          data: amounts,
          backgroundColor: "#3f6522",
          yAxisID: "y",
        },
        {
          type: "line",
          label: `${labelName} (% of Prior Budget)`,
          data: percents,
          borderColor: "#9ca3af",
          backgroundColor: "#9ca3af",
          yAxisID: "y1",
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: {
        mode: "index",
        intersect: false
      },
      stacked: false,
      plugins: {
        legend: {
          position: "bottom",
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return ctx.dataset.label.includes('%') ? formatPercent(ctx.raw / 100) : formatCurrency(ctx.raw);
            }
          }
        }
      },
      scales: {
        y: {
          type: "linear",
          position: "left",
          title: { display: true, text: "$ Amount" },
          ticks: { callback: value => "$" + value.toLocaleString() }
        },
        y1: {
          type: "linear",
          position: "right",
          title: { display: true, text: "% of Prior Budget" },
          grid: { drawOnChartArea: false },
          ticks: { callback: value => value + "%" }
        }
      }
    }
  });
}

function populateTable(tableId, data, labelName) {
  const tbody = document.getElementById(tableId);
  const toggleBtn = document.getElementById(`${tableId}-toggle`);
  let expanded = false;

  const rows = data.map(row => `
    <tr>
      <td class="text-center">${row.fy}</td>
      <td class="text-right">${formatCurrency(row.priorBudget)}</td>
      <td class="text-right">${formatCurrency(row.amount)}</td>
      <td class="text-right">${formatPercent(row.percent)}</td>
    </tr>
  `);

  const renderRows = () => {
    tbody.innerHTML = expanded ? rows.join("") : rows.slice(-10).join("");
    toggleBtn.textContent = expanded ? "Show Fewer" : "Show More";
  };

  toggleBtn.onclick = () => {
    expanded = !expanded;
    renderRows();
  };

  renderRows();
}

Papa.parse(reservesDataUrl, {
  header: true,
  download: true,
  complete: function(results) {
    const raw = results.data.filter(r => r["FISCAL YEAR"]);

    const processSection = (field, chartId, tableId, label) => {
      const rows = raw
        .map(r => ({
          fy: r["FISCAL YEAR"],
          amount: parseFloat(r[field]) || 0,
          priorBudget: parseFloat(r["PRIOR YEAR OPERATING BUDGET"]) || 0
        }))
        .filter(r => r.amount && r.priorBudget)
        .map(r => ({
          ...r,
          percent: r.amount / r.priorBudget
        }));

      const last10 = rows.slice(-10);
      drawComboChart(chartId, last10.map(r => r.fy), last10.map(r => r.amount), last10.map(r => r.percent * 100), label);
      populateTable(tableId, rows, label);
    };

    processSection("CERTIFIED FREE CASH", "freeCashChart", "freeCashTableBody", "Free Cash");
    processSection("GENERAL STABILIZATION", "stabilizationChart", "stabilizationTableBody", "General Stabilization");
  }
});
