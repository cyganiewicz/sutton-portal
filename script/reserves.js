const reservesDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTJcnqu3eiVpo6TWbbCtptfBwAgM5XXM1hP4t94MuhxvDW2Hb2tOhG-Cxei4WGDJ9G66DgfnLttzlwO/pub?gid=0&single=true&output=csv";

function formatCurrency(val) {
  return "$" + parseFloat(val).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPercent(val) {
  return val.toFixed(1) + "%";
}

function titleCase(str) {
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function drawComboChart(canvasId, labels, amounts, percents, reserveLabel) {
  const ctx = document.getElementById(canvasId)?.getContext("2d");
  if (!ctx) return;

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: `${reserveLabel} ($)`,
          data: amounts,
          backgroundColor: "#3f6522",
          yAxisID: "y",
        },
        {
          type: "line",
          label: `${reserveLabel} (% of Prior Budget)`,
          data: percents,
          borderColor: "#9ca3af",
          backgroundColor: "#9ca3af",
          yAxisID: "y1",
          tension: 0.4,
        }
      ]
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
                ? formatPercent(ctx.raw)
                : formatCurrency(ctx.raw);
            }
          }
        }
      },
      scales: {
        y: {
          title: { display: true, text: "Amount ($)" },
          ticks: { callback: v => "$" + v.toLocaleString() }
        },
        y1: {
          position: "right",
          grid: { drawOnChartArea: false },
          title: { display: true, text: "% of Prior Budget" },
          ticks: { callback: v => v + "%" }
        }
      }
    }
  });
}

function renderReserveSection(key, entries) {
  const container = document.querySelector("main");
  const canvasId = `chart-${key}`;
  const tableId = `table-${key}`;
  const toggleId = `toggle-${key}`;

  // Create Section
  const section = document.createElement("section");
  section.className = "mb-16 animate-fade-in";
  section.innerHTML = `
    <h3 class="text-2xl font-semibold mb-4">${titleCase(key)}</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      <div class="chart-tile"><canvas id="${canvasId}" height="300"></canvas></div>
      <div class="overflow-x-auto shadow bg-white rounded-lg">
        <table class="reserves-table">
          <thead>
            <tr>
              <th>Fiscal Year</th>
              <th>Amount</th>
              <th>% of Prior Budget</th>
            </tr>
          </thead>
          <tbody id="${tableId}"></tbody>
        </table>
        <div class="text-center p-4">
          <button id="${toggleId}" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded text-sm transition">Show More</button>
        </div>
      </div>
    </div>
  `;
  container.appendChild(section);

  const sorted = entries.sort((a, b) => b.fy - a.fy);
  const latest10 = sorted.slice(0, 10);

  // Chart
  drawComboChart(
    canvasId,
    latest10.map(r => r.fy),
    latest10.map(r => r.amount),
    latest10.map(r => r.percent * 100),
    titleCase(key)
  );

  // Table
  const tbody = section.querySelector(`#${tableId}`);
  let expanded = false;

  const renderTable = () => {
    const display = expanded ? sorted : latest10;
    tbody.innerHTML = display.map(r => `
      <tr>
        <td class="text-center">${r.fy}</td>
        <td class="text-right">${formatCurrency(r.amount)}</td>
        <td class="text-right">${formatPercent(r.percent * 100)}</td>
      </tr>
    `).join("");
    section.querySelector(`#${toggleId}`).textContent = expanded ? "Show Fewer" : "Show More";
  };

  renderTable();
  section.querySelector(`#${toggleId}`).onclick = () => {
    expanded = !expanded;
    renderTable();
  };
}

// Load and process data
Papa.parse(reservesDataUrl, {
  header: true,
  download: true,
  complete: function(results) {
    const rows = results.data.filter(r => r["FISCAL YEAR"] && r["PRIOR YEAR OPERATING BUDGET"]);
    const reserves = {};

    rows.forEach(r => {
      const fy = r["FISCAL YEAR"];
      const prior = parseFloat(r["PRIOR YEAR OPERATING BUDGET"].replace(/,/g, "")) || 0;

      Object.keys(r).forEach(key => {
        if (["FISCAL YEAR", "PRIOR YEAR OPERATING BUDGET"].includes(key)) return;
        const val = parseFloat(r[key].replace(/,/g, "")) || 0;
        if (val && prior) {
          if (!reserves[key]) reserves[key] = [];
          reserves[key].push({
            fy,
            amount: val,
            percent: val / prior
          });
        }
      });
    });

    // Render each reserve section
    Object.entries(reserves).forEach(([key, values]) => {
      if (values.length) renderReserveSection(key, values);
    });
  }
});
