const reservesDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTJcnqu3eiVpo6TWbbCtptfBwAgM5XXM1hP4t94MuhxvDW2Hb2tOhG-Cxei4WGDJ9G66DgfnLttzlwO/pub?gid=0&single=true&output=csv";

function formatCurrency(val) {
  return "$" + parseFloat(val).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPercent(val) {
  return (val * 100).toFixed(1) + "%";
}

function toTitleCase(str) {
  return str
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function drawComboChart(ctx, labels, amounts, percents, labelName) {
  return new Chart(ctx, {
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

function createReserveSection(label, chartId, tableId) {
  const section = document.createElement("section");
  section.className = "mb-12 animate-fadein";

  const header = document.createElement("h3");
  header.className = "text-2xl font-semibold mb-4";
  header.textContent = toTitleCase(label);
  section.appendChild(header);

  const container = document.createElement("div");
  container.className = "grid grid-cols-1 md:grid-cols-2 gap-6";

  const chartTile = document.createElement("div");
  chartTile.className = "chart-tile";
  const canvas = document.createElement("canvas");
  canvas.id = chartId;
  canvas.height = 360;
  chartTile.appendChild(canvas);

  const tableWrap = document.createElement("div");
  tableWrap.className = "overflow-x-auto";

  const table = document.createElement("table");
  table.className = "reserves-table w-full";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Fiscal Year</th>
        <th>Amount</th>
        <th>% of Prior Budget</th>
      </tr>
    </thead>
    <tbody id="${tableId}"></tbody>
  `;

  const toggleBtn = document.createElement("button");
  toggleBtn.className = "show-toggle";
  toggleBtn.id = `${tableId}-toggle`;
  toggleBtn.textContent = "Show More";

  tableWrap.appendChild(table);
  tableWrap.appendChild(toggleBtn);
  container.appendChild(chartTile);
  container.appendChild(tableWrap);
  section.appendChild(container);

  document.querySelector("main").appendChild(section);
}

function populateTable(tableId, data, maxRows = 10) {
  const tbody = document.getElementById(tableId);
  const toggleBtn = document.getElementById(`${tableId}-toggle`);
  let expanded = false;

  const sorted = data.sort((a, b) => b.fy - a.fy);
  const rows = sorted.map(row => `
    <tr>
      <td class="text-center">${row.fy}</td>
      <td class="text-right">${formatCurrency(row.amount)}</td>
      <td class="text-right">${formatPercent(row.percent)}</td>
    </tr>
  `);

  const render = () => {
    tbody.innerHTML = expanded ? rows.join("") : rows.slice(0, maxRows).join("");
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
  complete: function(results) {
    const raw = results.data.filter(r => r["FISCAL YEAR"]);
    const priorMap = {};
    raw.forEach(r => {
      const fy = r["FISCAL YEAR"];
      const prior = parseFloat(r["PRIOR YEAR OPERATING BUDGET"]) || 0;
      if (fy && prior) priorMap[fy] = prior;
    });

    Object.keys(raw[0])
      .filter(col => col !== "FISCAL YEAR" && col !== "PRIOR YEAR OPERATING BUDGET")
      .forEach(col => {
        const rows = raw.map(r => {
          const fy = r["FISCAL YEAR"];
          const amount = parseFloat(r[col]) || 0;
          const prior = priorMap[fy] || 0;
          return { fy, amount, percent: prior ? amount / prior : 0 };
        }).filter(r => r.amount > 0 && r.percent > 0);

        if (rows.length > 0) {
          const slug = col.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          const chartId = `${slug}-chart`;
          const tableId = `${slug}-table`;

          createReserveSection(col, chartId, tableId);

          // Wait until DOM has rendered the canvas
          setTimeout(() => {
            const ctx = document.getElementById(chartId).getContext("2d");
            const last10 = rows.slice(-10);
            drawComboChart(ctx, last10.map(r => r.fy), last10.map(r => r.amount), last10.map(r => r.percent * 100), toTitleCase(col));
          }, 50);

          populateTable(tableId, rows);
        }
      });
  }
});
