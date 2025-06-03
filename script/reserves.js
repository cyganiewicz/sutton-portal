const reservesDataUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTJcnqu3eiVpo6TWbbCtptfBwAgM5XXM1hP4t94MuhxvDW2Hb2tOhG-Cxei4WGDJ9G66DgfnLttzlwO/pub?gid=0&single=true&output=csv";

function formatCurrency(val) {
  return "$" + parseFloat(val).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPercent(val) {
  return (val * 100).toFixed(1) + "%";
}

function titleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function drawComboChart(ctxId, labels, amounts, percents, labelName) {
  const ctx = document.getElementById(ctxId).getContext("2d");
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
            label: function (ctx) {
              return ctx.dataset.label.includes('%')
                ? formatPercent(ctx.raw / 100)
                : formatCurrency(ctx.raw);
            },
          },
        },
      },
      scales: {
        y: {
          type: "linear",
          position: "left",
          title: { display: true, text: "$ Amount" },
          ticks: { callback: value => "$" + value.toLocaleString() },
        },
        y1: {
          type: "linear",
          position: "right",
          title: { display: true, text: "% of Prior Budget" },
          grid: { drawOnChartArea: false },
          ticks: { callback: value => value + "%" },
        },
      },
    },
  });
}

function createTable(id, rows) {
  const table = document.createElement("table");
  table.className = "reserves-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Fiscal Year</th>
        <th>Amount</th>
        <th>% of Prior Budget</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="text-center">${r.fy}</td>
      <td class="text-right">${formatCurrency(r.amount)}</td>
      <td class="text-right">${formatPercent(r.percent)}</td>
    `;
    tbody.appendChild(tr);
  });

  return table;
}

function createSection(label, rows) {
  const section = document.createElement("section");
  section.className = "reserve-section";

  const title = document.createElement("h3");
  title.className = "text-2xl font-semibold mb-4";
  title.textContent = titleCase(label);

  const chartContainer = document.createElement("div");
  chartContainer.className = "chart-container";
  const canvas = document.createElement("canvas");
  canvas.id = `${label.toLowerCase().replace(/\s+/g, "-")}-chart`;
  canvas.height = 300;
  chartContainer.appendChild(canvas);

  const tableContainer = document.createElement("div");
  tableContainer.className = "table-container";

  const showMoreBtn = document.createElement("button");
  showMoreBtn.className = "show-more-btn";
  showMoreBtn.textContent = "Show More";

  let expanded = false;
  let fullTable = createTable(label, rows);
  let shortTable = createTable(label, rows.slice(0, 10));

  tableContainer.appendChild(shortTable);
  tableContainer.appendChild(showMoreBtn);

  showMoreBtn.addEventListener("click", () => {
    tableContainer.replaceChild(expanded ? shortTable : fullTable, tableContainer.firstChild);
    showMoreBtn.textContent = expanded ? "Show More" : "Show Fewer";
    expanded = !expanded;
  });

  const container = document.createElement("div");
  container.className = "flex flex-col lg:flex-row gap-8 items-start mb-12";
  container.appendChild(chartContainer);
  container.appendChild(tableContainer);

  section.appendChild(title);
  section.appendChild(container);
  document.querySelector("main").appendChild(section);

  // Draw chart
  const last10 = rows.slice(0, 10).reverse(); // Reverse for recent fiscal years on the right
  drawComboChart(canvas.id, last10.map(r => r.fy), last10.map(r => r.amount), last10.map(r => r.percent * 100), titleCase(label));
}

Papa.parse(reservesDataUrl, {
  header: true,
  download: true,
  complete: function (results) {
    const data = results.data.filter(row => row["FISCAL YEAR"] && row["PRIOR YEAR OPERATING BUDGET"]);

    const reserves = {};
    data.forEach(row => {
      const fy = row["FISCAL YEAR"];
      const prior = parseFloat(row["PRIOR YEAR OPERATING BUDGET"].replace(/,/g, "")) || 0;

      if (!prior || isNaN(prior)) return;

      Object.keys(row).forEach(key => {
        if (["FISCAL YEAR", "PRIOR YEAR OPERATING BUDGET"].includes(key)) return;

        const val = parseFloat((row[key] || "").replace(/,/g, ""));
        if (!val || isNaN(val)) return;

        if (!reserves[key]) reserves[key] = [];
        reserves[key].push({ fy, amount: val, percent: val / prior });
      });
    });

    // Sort and display each section
    Object.entries(reserves).forEach(([label, entries]) => {
      const sorted = entries.sort((a, b) => parseInt(b.fy) - parseInt(a.fy));
      if (sorted.length > 0) createSection(label, sorted);
    });
  }
});
