export default {
	pivotMIS: [],
	pivotAI: [],
	pivotQC: [],

	async getPivotData() {
		await mis_stats.run();
		const data = mis_stats.data;
		if (!data || data.length === 0) {
			this.pivotMIS = [];
			this.pivotAI = [];
			this.pivotQC = [];
			return { mis: [], ai: [], qc: [] };
		}

		const months = [...new Set(data.map(row => row.txnmonth))].sort((a, b) =>
																																		new Date('01-' + a) - new Date('01-' + b)
																																	 );

		const buildRows = (metrics) => metrics.map(({ label, key, derive }) => {
			const row = { Metric: label };
			months.forEach(month => {
				const found = data.find(d => d.txnmonth === month);
				row[month] = found === undefined ? 0 : derive ? derive(found) : found[key] ?? 0;
			});
			return row;
		});

		const misMetrics = [
			{ label: 'No. of MIS Tickets', key: 'no_of_mis' },
			{ label: 'Delivered On Time', key: 'delivered_on_time' },
			{ label: 'Timeliness %', key: 'timeliness %' },
			{ label: 'Request to Complete Median Time (min)', key: 'median_time_taken' }
		];

		const aiMetrics = [
			{ label: 'AI Tickets', key: 'no_of_ai_tickets' },
			{ label: 'AI Failed', key: 'ai_failure' },
			{
				label: 'AI Success Rate %',
				derive: (row) => {
					const total = Number(row.no_of_ai_tickets) || 0;
					if (total === 0) return 0;
					const success = (Number(row.ai_success) || 0) + (Number(row.ai_partial_success) || 0);
					return Number(((success * 100) / total).toFixed(2));
				}
			}
		];

		const qcMetrics = [
			{ label: 'QC Completed', key: 'no_of_qc_tickets' },
			{ label: 'QC Failed', key: 'qc_failed_first_iteration' },
			{ label: 'QC Rejection Rate %', key: 'QC First Iteration Fail Rate %' },
			{ label: 'QC Median Time Taken (min)', key: 'QC Median Time (mins)' }
		];

		this.pivotMIS = buildRows(misMetrics);
		this.pivotAI = buildRows(aiMetrics);
		this.pivotQC = buildRows(qcMetrics);

		return { mis: this.pivotMIS, ai: this.pivotAI, qc: this.pivotQC };
	},

	getQcFailedBreakdown(month) {
		const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		const toTxnMonth = (dateStr) => {
			const d = new Date(dateStr);
			return MONTH_ABBR[d.getMonth()] + '-' + d.getFullYear();
		};

		const doneby = doneCopy.selectedOptionValue;
		const rows = (Normal.data || []).filter(r =>
			r.category === 'MIS' &&
			r.requested_time != null &&
			r.closedat != null &&
			toTxnMonth(r.closedat) === month &&
			(!doneby || r.doneby === doneby)
		);

		const groups = {};
		rows.forEach(r => {
			let logs = r.qc_logs;
			if (typeof logs === 'string') {
				try { logs = JSON.parse(logs); } catch (e) { logs = []; }
			}
			const first = Array.isArray(logs) && logs.length ? logs[0] : null;
			if (!first || first.qc_passed !== 'No') return;

			const tag = first.qc_tag || 'Unspecified';
			const description = first.qc_description || 'Unspecified';
			const key = tag + '||' + description;
			if (!groups[key]) groups[key] = { tag, description, count: 0 };
			groups[key].count++;
		});

		return Object.values(groups).sort((a, b) => b.count - a.count);
	},

	async getHTML() {
		const { mis, ai, qc } = await this.getPivotData();

		if (!mis.length && !ai.length && !qc.length) {
			return `<html><body style="font-family:Arial,sans-serif;padding:20px;color:#888">No data found.</body></html>`;
		}

		const renderTable = (id, title, accent, rows) => {
			if (!rows.length) return '';
			const columns = Object.keys(rows[0]);
			const months = columns.slice(1);

			const headers = columns.map((c, i) =>
				i === 0 ? `<th class="sticky-col">${c}</th>` : `<th>${c}</th>`
			).join("");

			const body = rows.map(row =>
				`<tr>${columns.map((c, i) => {
					const val = row[c] ?? "";
					return i === 0
						? `<td class="sticky-col metric-col">${val}</td>`
						: `<td>${typeof val === 'number' ? val.toFixed(2) : val}</td>`;
				}).join("")}</tr>`
			).join("");

			return { id, title, accent, columns, months, rows, headers, body };
		};

		const tables = [
			renderTable('mis', 'MIS', '#2b62c0', mis),
			renderTable('qc', 'QC', '#d4732c', qc),
			renderTable('ai', 'AI', '#7a5cff', ai)
		].filter(Boolean);

		const tablesJSON = JSON.stringify(
			tables.reduce((acc, t) => {
				acc[t.id] = { columns: t.columns, months: t.months, rows: t.rows, title: t.title };
				return acc;
			}, {})
		);

		const sections = tables.map(t => `
        <section class="section">
          <div class="header" style="border-left:4px solid ${t.accent}">
            <div class="title">${t.title}</div>
            <div class="actions">
              <button class="btn csv" onclick="downloadCSV('${t.id}')">&#8595; CSV</button>
              <button class="btn xl"  onclick="downloadXLSX('${t.id}')">&#8615; XLSX</button>
            </div>
          </div>
          <div class="table-wrapper">
            <table>
              <thead><tr>${t.headers}</tr></thead>
              <tbody>${t.body}</tbody>
            </table>
          </div>
        </section>
    `).join("");

		return `
      <html>
      <head>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 13px; }
        .section { margin-bottom: 22px; }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: #fff;
        }
        .title {
          font-size: 15px;
          font-weight: bold;
          color: #1a1a2e;
          letter-spacing: 0.3px;
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

        ${sections}

        <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"><\/script>
        <script>
          const TABLES = ${tablesJSON};

          function downloadCSV(id) {
            const { columns, rows, title } = TABLES[id];
            const head = columns.join(",");
            const lines = rows.map(r =>
              columns.map(c => '"' + (r[c] ?? "") + '"').join(",")
            );
            const csv = [head, ...lines].join("\\n");
            trigger(title.toLowerCase() + "_stats.csv", "data:text/csv;charset=utf-8," + encodeURIComponent(csv));
          }

          function downloadXLSX(id) {
            const { columns, rows, title } = TABLES[id];
            const sheetData = [
              columns,
              ...rows.map(r => columns.map(c => r[c] ?? ""))
            ];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            ws["!cols"] = [{ wch: 28 }, ...columns.slice(1).map(() => ({ wch: 14 }))];
            XLSX.utils.book_append_sheet(wb, ws, title + " Stats");
            XLSX.writeFile(wb, title.toLowerCase() + "_stats.xlsx");
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
