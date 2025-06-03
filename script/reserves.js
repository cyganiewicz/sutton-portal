const reservesDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTJcnqu3eiVpo6TWbbCtptfBwAgM5XXM1hP4t94MuhxvDW2Hb2tOhG-Cxei4WGDJ9G66DgfnLttzlwO/pub?gid=0&single=true&output=csv";

function formatCurrency(val) {
  return "$" + parseFloat(val).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPercent(val) {
  return (val * 100).toFixed(1) + "%";
}

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
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
      interaction: { mode: "index", intersect: false },
      stacked: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              return ctx.dataset.label.includes('%')
                ? formatPercent(ctx.raw / 100)
                : formatCurrency(ctx.raw);
            }
          }
        }
      },
      scales: {
        y: {
          title: { display: true, text: "$ Amount" },
          ticks: { callback: value => "$" + value.toLocaleString() }
        },
        y1: {
          position: "right",
          title: { display: true, text: "% of Prior Budget" },
          grid: { drawOnChartArea: false },
          ticks: { callback: value => value + "%" }
        }
      }
    }
  });
}

function renderReserveSection(container, label, rows) {
  const section = document.createElement("section");
  section.className = "reserves-section";

  const sectionId = label.toLowerCase().replace(/\s+/g, "-");

  section.innerHTML = `
    <h3 class="reserves-title">${toTitleCase(label)}</h3>
    <div class="chart-table-grid">
      <div class="chart-container">
        <canvas id="${sectionId}-chart" height="300"></canvas>
      </div>
      <div>
        <table class="reserves-table">
          <thead>
            <tr>
              <th>Fiscal Year</th>
              <th>Amount</th>
              <th>% of Prior Budget</th>
            </tr>
          </thead>
          <tbody id="${sectionId}-table-body"></tbody>
        </table>
        <div class="text-center">
          <button class="toggle-button" id="${sectionId}-toggle">Show More</button>
        </div>
      </div>
    </div>
  `;
  container.appendChild(section);

  const sorted = rows.sort((a, b) => b.fy - a.fy);
  const last10 = sorted.slice(0, 10);
  const labels = last10.map(r => r.fy).reverse();
  const amounts = last10.map(r => r.amount).reverse();
  const percents = last10.map(r => r.percent * 100).reverse();

  drawComboChart(`${sectionId}-chart`, labels, amounts, percents, toTitleCase(label));
  setupTableToggle(`${sectionId}-table-body`, `${sectionId}-toggle`, sorted);
}

function setupTableToggle(tbodyId, toggleBtnId, dataRows) {
  const tbody = document.getElementById(tbodyId);
  const toggleBtn = document.getElementById(toggleBtnId);
  let expanded = false;

  const render = () => {
    const rows = (expanded ? dataRows : dataRows.slice(0, 10)).map(row => `
      <tr>
        <td>${row.fy}</td>
        <td class="text-right">${formatCurrency(row.amount)}</td>
        <td class="text-right">${formatPercent(row.percent)}</td>
      </tr>
    `).join("");
    tbody.innerHTML = rows;
    toggleBtn.textContent = expanded ? "Show Fewer" : "Show More";
  };

  toggleBtn.onclick = () => {
    expanded = !expanded;
    render();
  };

  render();
}

Papa.parse(reservesDataUrl, {
  header: true,
  download: true,
  complete: (results) => {
    const data = results.data.filter(r => r["FISCAL YEAR"] && r["PRIOR YEAR OPERATING BUDGET"]);
    const container = document.querySelector("main");

    const fields = Object.keys(data[0]).filter(key =>
      !["FISCAL YEAR", "PRIOR YEAR OPERATING BUDGET"].includes(key)
    );

    fields.forEach(field => {
      const rows = data.map(r => {
        const amount = parseFloat(r[field]) || 0;
        const prior = parseFloat(r["PRIOR YEAR OPERATING BUDGET"]) || 1;
        return {
          fy: r["FISCAL YEAR"],
          amount,
          percent: amount / prior
        };
      }).filter(r => r.amount > 0 && r.percent > 0);

      if (rows.length > 0) {
        renderReserveSection(container, field, rows);
      }
    });
  }
});
