export default {
  getHTML: async () => {
    await insights_stat.run();
    const data = insights_stat.data || [];

    const formatMonth = (m) => {
      const s = String(m);
      if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
      const d = new Date(s);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    };

    const allMonths = [
      ...new Set(data.map(row => formatMonth(row.txnmonth)))
    ].sort();

    const metricKeys = data.length > 0
      ? Object.keys(data[0]).filter(k => k !== "txnmonth")
      : [];

    const lookup = {};
    allMonths.forEach(month => {
      lookup[month] = {};
      metricKeys.forEach(k => { lookup[month][k] = 0; });
    });

    data.forEach(row => {
      const month = formatMonth(row.txnmonth);
      if (!lookup[month]) return;
      metricKeys.forEach(k => { lookup[month][k] += row[k] || 0; });
    });

    const rows = metricKeys.map(key => ({
      metric: key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      key
    }));

    const headers =
      `<th class="sticky-col">Metric</th>` +
      allMonths.map(m => `<th>${m}</th>`).join("");

    const body = rows.map(r =>
      `<tr>
        <td class="metric-col sticky-col">${r.metric}</td>
        ${allMonths.map(m => `<td>${(lookup[m][r.key] || 0).toFixed(2)}</td>`).join("")}
      </tr>`
    ).join("");

    const tableDataJSON = JSON.stringify({
      months: allMonths,
      rows: rows.map(r => ({
        metric: r.metric,
        values: allMonths.map(m => (lookup[m][r.key] || 0).toFixed(2))
      }))
    });

    return `
      <html>
      <head>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 13px; }
        .toolbar {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          padding: 10px 12px;
          border-bottom: 1px solid #e0e0e0;
          background: #fff;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 13px;
          font-size: 12px;
          font-family: Arial, sans-serif;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn.csv { background: #2b62c0; color: #fff; border: 1px solid #2b62c0; }
        .btn.csv:hover { background: #1e4ea0; }
        .btn.xl  { background: #1a7a4a; color: #fff; border: 1px solid #1a7a4a; }
        .btn.xl:hover  { background: #155f3a; }
        .table-wrapper { overflow-x: auto; width: 100%; }
        table { border-collapse: collapse; width: 100%; }
        th {
          background: #2b62c0;
          color: white;
          padding: 8px 12px;
          text-align: center;
          white-space: nowrap;
        }
        td {
          padding: 8px 12px;
          text-align: center;
          border-bottom: 1px solid #eee;
          white-space: nowrap;
        }
        .metric-col { text-align: left; font-weight: bold; }
        .sticky-col { position: sticky; left: 0; z-index: 2; }
        thead .sticky-col { background: #2b62c0; z-index: 3; }
        tbody tr:nth-child(even) .sticky-col { background: #f9f9f9; }
        tbody tr:nth-child(odd)  .sticky-col { background: #ffffff; }
        tbody tr:hover .sticky-col { background: #f0eeff; }
        tr:nth-child(even) td:not(.metric-col) { background: #f9f9f9; }
        tr:hover td:not(.metric-col) { background: #f0eeff; }
        .sticky-col::after {
          content: '';
          position: absolute;
          top: 0; right: -4px; bottom: 0;
          width: 4px;
          background: linear-gradient(to right, rgba(0,0,0,0.08), transparent);
          pointer-events: none;
        }
      </style>
      </head>
      <body>

        <div class="toolbar">
          <button class="btn csv" onclick="downloadCSV()">&#8595; CSV</button>
          <button class="btn xl"  onclick="downloadXLSX()">&#8615; XLSX</button>
        </div>

        <div class="table-wrapper">
          <table>
            <thead><tr>${headers}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>

        <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"><\/script>
        <script>
          const TABLE_DATA = ${tableDataJSON};

          function downloadCSV() {
            const { months, rows } = TABLE_DATA;
            const head = ["Metric", ...months].join(",");
            const lines = rows.map(r =>
              ['"' + r.metric + '"', ...r.values].join(",")
            );
            const csv = [head, ...lines].join("\\n");
            trigger("pivot_table.csv", "data:text/csv;charset=utf-8," + encodeURIComponent(csv));
          }

          function downloadXLSX() {
            const { months, rows } = TABLE_DATA;
            const sheetData = [
              ["Metric", ...months],
              ...rows.map(r => [r.metric, ...r.values.map(Number)])
            ];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            ws["!cols"] = [{ wch: 22 }, ...months.map(() => ({ wch: 12 }))];
            XLSX.utils.book_append_sheet(wb, ws, "Pivot Table");
            XLSX.writeFile(wb, "pivot_table.xlsx");
          }

          function trigger(filename, href) {
            const a = document.createElement("a");
            a.href = href;
            a.download = filename;
            a.click();
          }
        <\/script>
      </body>
      </html>
    `;
  }
};