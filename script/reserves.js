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
      maintainAspectRatio: false,
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

function createTable(label, rows) {
  const table = document.createElement("table");
  table.className = "reserves-table w-full text-sm";
  table.innerHTML = `
    <thead>
      <tr>
        <th class="text-left">Fiscal Year</th>
        <th class="text-right">Amount</th>
        <th class="text-right">% of Prior Budget</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="text-left">${r.fy}</td>
      <td class="text-right">${formatCurrency(r.amount)}</td>
      <td class="text-right">${formatPercent(r.percent)}</td>
    `;
    tbody.appendChild(tr);
  });

  return table;
}

function createSection(label, rows) {
  const section = document.createElement("section");
  section.className = "reserve-section mb-16";

  const title = document.createElement("h3");
  title.className = "text-2xl font-semibold mb-4 text-center";
  title.textContent = titleCase(label);

  const chartContainer = document.createElement("div");
  chartContainer.className = "w-full lg:w-1/2 mx-auto mb-6";
  const canvas = document.createElement("canvas");
  canvas.id = `${label.toLowerCase().replace(/\s+/g, "-")}-chart`;
  canvas.style.height = "400px";
  chartContainer.appendChild(canvas);

  const tableContainer = document.createElement("div");
  tableContainer.className = "w-full lg:w-2/3 mx-auto";

  const showMoreBtn = document.createElement("button");
  showMoreBtn.className = "mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition";
  showMoreBtn.textContent = "Show More";

  let expanded = false;
  const sortedRows = [...rows].sort((a, b) => parseInt(b.fy) - parseInt(a.fy));
  const last10 = sortedRows.slice(0, 10);
  const fullTable = createTable(label, sortedRows);
  const shortTable = createTable(label, last10);

  tableContainer.appendChild(shortTable);
  tableContainer.appendChild(showMoreBtn);

  showMoreBtn.addEventListener("click", () => {
    tableContainer.replaceChild(expanded ? shortTable : fullTable, tableContainer.firstChild);
    showMoreBtn.textContent = expanded ? "Show More" : "Show Fewer";
    expanded = !expanded;
  });

  section.appendChild(title);
  section.appendChild(chartContainer);
  section.appendChild(tableContainer);
  document.querySelector("main").appendChild(section);

  // Draw chart (reverse to get most recent year on right)
  const reversedForChart = last10.slice().reverse();
  drawComboChart(
    canvas.id,
    reversedForChart.map(r => r.fy),
    reversedForChart.map(r => r.amount),
    reversedForChart.map(r => r.percent * 100),
    titleCase(label)
  );
}

// Load and process data
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

    Object.entries(reserves).forEach(([label, entries]) => {
      if (entries.length > 0) createSection(label, entries);
    });
  }
});
