export default {
	pivotData: [],

	async getPivotData() {
		await mis_stats.run();
		const data = mis_stats.data;
		if (!data || data.length === 0) {
			this.pivotData = [];
			return [];
		}
		const months = [...new Set(data.map(row => row.txnmonth))].sort((a, b) =>
																																		new Date('01-' + a) - new Date('01-' + b)
																																	 );
		const metricKeys = Object.keys(data[0]).filter(key => key !== 'txnmonth');
		this.pivotData = metricKeys.map(key => {
			const row = {
				Metric: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
			};
			months.forEach(month => {
				const found = data.find(d => d.txnmonth === month);
				row[month] = found !== undefined ? found[key] ?? 0 : 0;
			});
			return row;
		});
		return this.pivotData;
	},

	async getHTML() {
		const pivotRows = await this.getPivotData();

		if (!pivotRows.length) return `<html><body style="font-family:Arial,sans-serif;padding:20px;color:#888">No data found.</body></html>`;

		const columns = Object.keys(pivotRows[0]);
		const months  = columns.slice(1);

		const headers = columns.map((c, i) =>
																i === 0
																? `<th class="sticky-col">${c}</th>`
																: `<th>${c}</th>`
															 ).join("");

		const body = pivotRows.map(row =>
															 `<tr>${columns.map((c, i) => {
			const val = row[c] ?? "";
			return i === 0
				? `<td class="sticky-col metric-col">${val}</td>`
			: `<td>${typeof val === 'number' ? val.toFixed(2) : val}</td>`;
		}).join("")}</tr>`
															).join("");

		const tableDataJSON = JSON.stringify({ columns, months, rows: pivotRows });

		return `
      <html>
      <head>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 13px; }
        .header {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 12px 14px 10px;
          border-bottom: 1px solid #e0e0e0;
          background: #fff;
        }
        .title {
          font-size: 16px;
          font-weight: bold;
          color: #1a1a2e;
          letter-spacing: 0.3px;
					text-align: center;
        }
        .actions {
          display: flex;
          gap: 8px;
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
        .sticky-col {
          position: sticky;
          left: 0;
          z-index: 2;
        }
        thead .sticky-col {
          background: #2b62c0;
          z-index: 3;
        }
        .metric-col {
          text-align: left;
          font-weight: bold;
          min-width: 200px;
        }
        tbody tr:nth-child(odd)  .sticky-col { background: #ffffff; }
        tbody tr:nth-child(even) .sticky-col { background: #f9f9f9; }
        tbody tr:hover           .sticky-col { background: #f0eeff; }
        tr:nth-child(even) td:not(.sticky-col) { background: #f9f9f9; }
        tr:hover           td:not(.sticky-col) { background: #f0eeff; }
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

        <div class="header">

          <div class="actions">
            <button class="btn csv" onclick="downloadCSV()">&#8595; CSV</button>
            <button class="btn xl"  onclick="downloadXLSX()">&#8615; XLSX</button>
          </div>
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
            const { columns, rows } = TABLE_DATA;
            const head = columns.join(",");
            const lines = rows.map(r =>
              columns.map(c => '"' + (r[c] ?? "") + '"').join(",")
            );
            const csv = [head, ...lines].join("\\n");
            trigger("mis_stats.csv", "data:text/csv;charset=utf-8," + encodeURIComponent(csv));
          }

          function downloadXLSX() {
            const { columns, rows } = TABLE_DATA;
            const sheetData = [
              columns,
              ...rows.map(r => columns.map(c => r[c] ?? ""))
            ];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            ws["!cols"] = [{ wch: 28 }, ...columns.slice(1).map(() => ({ wch: 14 }))];
            XLSX.utils.book_append_sheet(wb, ws, "MIS Stats");
            XLSX.writeFile(wb, "mis_stats.xlsx");
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