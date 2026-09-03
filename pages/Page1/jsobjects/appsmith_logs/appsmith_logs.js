export default {
	async mergeData() {
		await Promise.all([roles.run(), monitor.run(), appsmith_workflow_filter.run()]);

		const rolesData    = roles.data    || [];
		const monitorData  = monitor.data  || [];
		const workflowData = appsmith_workflow_filter.data || [];

		const dashboardAssets = workflowData.filter(
			item => item.asset_type?.trim().toLowerCase() === 'dashboard'
		);

		const result = rolesData.map(role => {
			const roleDashboard = role.dashboard?.trim().toLowerCase();

			const matchedMonitor = roleDashboard
			? monitorData.find(m => m.dashboard?.trim().toLowerCase() === roleDashboard)
			: null;

			const matchedAsset = roleDashboard
			? dashboardAssets.find(a => a.asset_name?.trim().toLowerCase() === roleDashboard)
			: null;

			const merged = {
				...role,
				logined_users:       matchedMonitor?.logined_users       ?? role.logined_users       ?? 0,
				total_users:         matchedMonitor?.total_users         ?? role.total_users         ?? 0,
				median_time_seconds: matchedMonitor?.median_time_seconds ?? role.median_time_seconds ?? 0,
				p90_time_seconds:    matchedMonitor?.p90_time_seconds    ?? role.p90_time_seconds    ?? 0,
				ownership:           matchedAsset?.ownership             ?? null,
			};

			const active = merged.logined_users;
			const total  = merged.total_users;
			merged.adoption_pct = total > 0
				? parseFloat(((active / total) * 100).toFixed(2))
			: 0;

			return merged;
		})
		.filter(item => item.ownership !== null)
		.sort((a, b) => (b.total_users ?? 0) - (a.total_users ?? 0));

		return result;
	},
	async getHTML() {
		const data = await this.mergeData();

		if (!data.length) return `<html><body style="font-family:Arial,sans-serif;padding:20px;color:#888">No data found.</body></html>`;

		const allColumns = Object.keys(data[0]);

		const orderedColumns = [
			"dashboard",
			"total_users",
			"logined_users",
			"adoption_pct",
			"median_time_seconds",
			"p90_time_seconds",
		];

		const remainingColumns = allColumns.filter(c => !orderedColumns.includes(c));

		const columns = [
			...orderedColumns.filter(c => allColumns.includes(c)),
			...remainingColumns
		];

		const columnLabels = {
			dashboard:           "Metric",
			total_users:         "Total Users",
			logined_users:       "Active Users",
			adoption_pct:        "Adoption %",
			median_time_seconds: "Median Loading Time (sec)",
			p90_time_seconds:    "Slowest Loading Time P90 (sec)",
		};

		const headers = columns.map((c, i) => {
			const label = columnLabels[c] || c.replace(/_/g, " ").replace(/\b\w/g, x => x.toUpperCase());
			return `<th onclick="sortTable(${i})" data-col="${i}" data-dir="asc">
				${label} <span class="sort-icon">⇅</span>
			</th>`;
		}).join("");

		const body = data.map(row =>
			`<tr>${columns.map(c => {
				const val = row[c] ?? "";
				const display = c === "adoption_pct"
					? (val !== "" ? val + "%" : "0%")
					: val;
				return `<td>${display}</td>`;
			}).join("")}</tr>`
		).join("");

		const tableDataJSON = JSON.stringify({ columns, columnLabels, rows: data });

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
          cursor: pointer;
          user-select: none;
        }
        th:hover { background: #1e4ea0; }
        th.sorted-asc .sort-icon::after  { content: " ▲"; }
        th.sorted-desc .sort-icon::after { content: " ▼"; }
        .sort-icon { font-size: 10px; opacity: 0.7; }
        th.sorted-asc .sort-icon,
        th.sorted-desc .sort-icon { opacity: 1; }
        td {
          padding: 8px 12px;
          text-align: center;
          border-bottom: 1px solid #eee;
          white-space: nowrap;
        }
        td:first-child { text-align: left; font-weight: bold; }
        thead th:first-child { background: #2b62c0; z-index: 3; position: sticky; left: 0; }
        tbody tr:nth-child(even) td:first-child { background: #f9f9f9; }
        tbody tr:nth-child(odd)  td:first-child { background: #ffffff; }
        tbody tr:hover td:first-child { background: #f0eeff; }
        tr:nth-child(even) td:not(:first-child) { background: #f9f9f9; }
        tr:hover td:not(:first-child) { background: #f0eeff; }
        th:first-child::after, td:first-child::after {
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
          <table id="mainTable">
            <thead><tr>${headers}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>

        <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"><\/script>
        <script>
          const TABLE_DATA = ${tableDataJSON};

          function sortTable(colIndex) {
            const table = document.getElementById("mainTable");
            const tbody = table.querySelector("tbody");
            const th = table.querySelectorAll("th")[colIndex];
            const currentDir = th.dataset.dir || "asc";
            const newDir = currentDir === "asc" ? "desc" : "asc";

            // Reset all headers
            table.querySelectorAll("th").forEach(h => {
              h.dataset.dir = "asc";
              h.classList.remove("sorted-asc", "sorted-desc");
              h.querySelector(".sort-icon").textContent = "⇅";
            });

            // Set active header
            th.dataset.dir = newDir;
            th.classList.add(newDir === "asc" ? "sorted-asc" : "sorted-desc");
            th.querySelector(".sort-icon").textContent = newDir === "asc" ? "▲" : "▼";

            const rows = Array.from(tbody.querySelectorAll("tr"));
            rows.sort((a, b) => {
              const aText = a.cells[colIndex].textContent.replace("%", "").trim();
              const bText = b.cells[colIndex].textContent.replace("%", "").trim();
              const aNum = parseFloat(aText);
              const bNum = parseFloat(bText);
              const isNumeric = !isNaN(aNum) && !isNaN(bNum);
              const cmp = isNumeric
                ? aNum - bNum
                : aText.localeCompare(bText, undefined, { sensitivity: "base" });
              return newDir === "asc" ? cmp : -cmp;
            });

            rows.forEach(r => tbody.appendChild(r));
          }

          function downloadCSV() {
            const { columns, columnLabels, rows } = TABLE_DATA;
            const head = columns.map(c => columnLabels[c] || c).join(",");
            const lines = rows.map(r =>
              columns.map(c => '"' + (r[c] ?? "") + '"').join(",")
            );
            const csv = [head, ...lines].join("\\n");
            trigger("merged_data.csv", "data:text/csv;charset=utf-8," + encodeURIComponent(csv));
          }

          function downloadXLSX() {
            const { columns, columnLabels, rows } = TABLE_DATA;
            const sheetData = [
              columns.map(c => columnLabels[c] || c.replace(/_/g," ").replace(/\\b\\w/g, x => x.toUpperCase())),
              ...rows.map(r => columns.map(c => r[c] ?? ""))
            ];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            ws["!cols"] = columns.map(() => ({ wch: 22 }));
            XLSX.utils.book_append_sheet(wb, ws, "Merged Data");
            XLSX.writeFile(wb, "merged_data.xlsx");
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

