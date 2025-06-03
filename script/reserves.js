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

function drawComboChart(canvasId, labels, amounts, percents, labelName) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
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
            label: ctx => ctx.dataset.label.includes("%")
              ? formatPercent(ctx.raw / 100)
              : formatCurrency(ctx.raw)
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

function createReserveSection(label, canvasId, tableId) {
  const section = document.createElement("section");
  section.className = "mb-12 animate-fadein";

  const title = document.createElement("h3");
  title.className = "text-2xl font-semibold mb-4";
  title.textContent = toTitleCase(label);
  section.appendChild(title);

  const container = document.createElement("div");
  container.className = "grid grid-cols-1 md:grid-cols-2 gap-6";

  // Chart
  const chartTile = document.createElement("div");
  chartTile.className = "chart-tile";
  const canvas = document.createElement("canvas");
  canvas.id = canvasId;
  canvas.height = 360;
  chartTile.appendChild(canvas);

  // Table
  const tableWrap = document.createElement("div");
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
  toggleBtn.id = `${tableId}-toggle`;
  toggleBtn.className = "show-toggle";
  toggleBtn.textContent = "Show More";

  tableWrap.appendChild(table);
  tableWrap.appendChild(toggleBtn);

  container.appendChild(chartTile);
  container.appendChild(tableWrap);
  section.appendChild(container);

  document.querySelector("main").appendChild(section);
}

function populateTable(tableId, rows, maxRows = 10) {
  const tbody = document.getElementById(tableId);
  const toggleBtn = document.getElementById(`${tableId}-toggle`);
  let expanded = false;

  const sorted = [...rows].sort((a, b) => b.fy - a.fy).reverse();
  const htmlRows = sorted.map(r => `
    <tr>
      <td class="text-center">${r.fy}</td>
      <td class="text-right">${formatCurrency(r.amount)}</td>
      <td class="text-right">${formatPercent(r.percent)}</td>
    </tr>
  `);

  const render = () => {
    tbody.innerHTML = expanded ? htmlRows.join("") : htmlRows.slice(0, maxRows).join("");
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
      const val = parseFloat(r["PRIOR YEAR OPERATING BUDGET"]) || 0;
      if (fy && val) priorMap[fy] = val;
    });

    const allReserves = Object.keys(raw[0]).filter(
      col => col !== "FISCAL YEAR" && col !== "PRIOR YEAR OPERATING BUDGET"
    );

    allReserves.forEach(label => {
      const rows = raw.map(r => {
        const fy = r["FISCAL YEAR"];
        const amount = parseFloat(r[label]) || 0;
        const prior = priorMap[fy] || 0;
        return {
          fy,
          amount,
          percent: prior ? amount / prior : 0
        };
      }).filter(r => r.amount > 0 && r.percent > 0);

      if (rows.length > 0) {
        const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const canvasId = `${slug}-chart`;
        const tableId = `${slug}-table`;

        createReserveSection(label, canvasId, tableId);

        // Delay rendering of chart until canvas is in DOM
        setTimeout(() => {
          const last10 = rows.sort((a, b) => a.fy - b.fy).slice(-10);
          drawComboChart(canvasId, last10.map(r => r.fy), last10.map(r => r.amount), last10.map(r => r.percent * 100), toTitleCase(label));
        }, 100);

        populateTable(tableId, rows);
      }
    });
  }
});
