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
  const canvas = document.getElementById(ctxId);
  const ctx = canvas.getContext("2d");

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

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
          order: 1
        },
        {
          type: "line",
          label: `${labelName} (% of Prior Budget)`,
          data: percents,
          borderColor: "#1f2937",
          backgroundColor: "#1f2937",
          borderWidth: 3,
          pointRadius: 4,
          pointBackgroundColor: "#1f2937",
          yAxisID: "y1",
          tension: 0.3,
          order: 0
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
            label: function (ctx) {
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
  title.innerHTML = `
  ${titleCase(label)}
  <span class="tooltip">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block text-gray-500 ml-2 cursor-pointer" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-4.5a.75.75 0 01-1.5 0v-1a.75.75 0 011.5 0v1zm-1.5-6.25a.75.75 0 011.5 0v.25a.75.75 0 01-.75.75h-.25v2.25a.75.75 0 01-1.5 0v-3a.75.75 0 01.75-.75z" clip-rule="evenodd" />
    </svg>
    <span class="tooltip-text">${getTooltipText(label)}</span>
  </span>
`;

  const chartContainer = document.createElement("div");
  chartContainer.className = "reserves-chart-container";
  const canvas = document.createElement("canvas");
  canvas.id = `${label.toLowerCase().replace(/\s+/g, "-")}-chart`;
  chartContainer.appendChild(canvas);

  const tableContainer = document.createElement("div");
  tableContainer.className = "reserves-table-container";

  const showMoreBtn = document.createElement("button");
  showMoreBtn.className = "show-toggle-btn";
  showMoreBtn.textContent = "Show More";

  const descriptions = {
  "Certified Free Cash": "Unrestricted surplus funds certified annually by the Department of Revenue.",
  "General Stabilization": "Rainy-day fund to stabilize the operating budget during economic downturns.",
  "Capital Stabilization": "Funds set aside specifically for capital improvements and large purchases."
};

const labelTitle = titleCase(label); // Keep this consistent
title.textContent = labelTitle;

const tooltip = document.createElement("span");
tooltip.className = "tooltip";
tooltip.innerHTML = `
  <span class="material-symbols-outlined">help</span>
  <span class="tooltip-text">${descriptions[labelTitle] || "No description available."}</span>
`;
title.appendChild(tooltip);

  // Sort rows by fiscal year (descending)
  const sortedDesc = [...rows].sort((a, b) => parseInt(b.fy) - parseInt(a.fy));

  let expanded = false;
  const shortTable = createTable(label, sortedDesc.slice(0, 10));
  const fullTable = createTable(label, sortedDesc);

  tableContainer.appendChild(shortTable);
  tableContainer.appendChild(showMoreBtn);

  showMoreBtn.addEventListener("click", () => {
    tableContainer.replaceChild(expanded ? shortTable : fullTable, tableContainer.firstChild);
    showMoreBtn.textContent = expanded ? "Show More" : "Show Fewer";
    expanded = !expanded;
  });

  const wrapper = document.createElement("div");
  wrapper.className = "reserves-chart-table-wrapper";
  wrapper.appendChild(chartContainer);
  wrapper.appendChild(tableContainer);

  section.appendChild(title);
  section.appendChild(wrapper);
  document.querySelector("main").appendChild(section);

  // Prepare chart data: 10 most recent (sorted ascending for proper chart order)
  const chartData = [...sortedDesc].slice(0, 10).sort((a, b) => parseInt(a.fy) - parseInt(b.fy));
  drawComboChart(
    canvas.id,
    chartData.map(r => r.fy),
    chartData.map(r => r.amount),
    chartData.map(r => r.percent * 100),
    titleCase(label)
  );
}

// Load and parse data
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
