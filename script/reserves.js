const reservesDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTJcnqu3eiVpo6TWbbCtptfBwAgM5XXM1hP4t94MuhxvDW2Hb2tOhG-Cxei4WGDJ9G66DgfnLttzlwO/pub?gid=0&single=true&output=csv";

function formatCurrency(val) {
  return "$" + parseFloat(val).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPercent(val) {
  return (val * 100).toFixed(1) + "%";
}

function drawComboChart(ctx, labels, amounts, percents, labelName) {
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
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
      interaction: { mode: "index", intersect: false },
      stacked: false,
      plugins: {
        legend: { position: "bottom" },
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

function createSection(field, rows, container) {
  const label = field.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

  const section = document.createElement("section");
  section.className = "mb-12";
  section.innerHTML = `
    <h3 class="text-2xl font-semibold mb-4">${label}</h3>
    <div class="grid md:grid-cols-2 gap-6 items-start">
      <div class="chart-tile">
        <canvas id="${field}-chart" height="320"></canvas>
      </div>
      <div>
        <table class="reserves-table w-full mb-4">
          <thead>
            <tr>
              <th>Fiscal Year</th>
              <th class="text-right">$ Amount</th>
              <th class="text-right">% of Prior Budget</th>
            </tr>
          </thead>
          <tbody id="${field}-table-body"></tbody>
        </table>
        <div class="text-center">
          <button id="${field}-toggle" class="text-sm text-blue-600 hover:underline">Show More</button>
        </div>
      </div>
    </div>
  `;
  container.appendChild(section);

  // Populate chart
  const last10 = rows.slice(-10);
  const ctx = document.getElementById(`${field}-chart`).getContext("2d");
  drawComboChart(ctx, last10.map(r => r.fy), last10.map(r => r.amount), last10.map(r => r.percent * 100), label);

  // Populate table
  const tbody = document.getElementById(`${field}-table-body`);
  const toggleBtn = document.getElementById(`${field}-toggle`);
  const tableRows = rows.map(r => `
    <tr>
      <td class="text-center">${r.fy}</td>
      <td class="text-right">${formatCurrency(r.amount)}</td>
      <td class="text-right">${formatPercent(r.percent)}</td>
    </tr>
  `);

  let expanded = false;
  const renderRows = () => {
    tbody.innerHTML = expanded ? tableRows.join("") : tableRows.slice(-10).join("");
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
    const baseFields = ["FISCAL YEAR", "PRIOR YEAR OPERATING BUDGET"];
    const allFields = Object.keys(results.data[0]);
    const reserveFields = allFields.filter(f => !baseFields.includes(f));

    const container = document.querySelector("main");

    reserveFields.forEach(field => {
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

      if (rows.length > 0) {
        createSection(field.replace(/\s/g, "_").toLowerCase(), rows, container);
      }
    });
  }
});
