export default {
	async mergeData() {
		await Promise.all([workflows.run(), appsmith_workflow_filter.run()]);

		const workflowDatas     = workflows.data                || [];
		const workflowDataowner = appsmith_workflow_filter.data || [];

		const workflowAssets = workflowDataowner.filter(
			item => item.asset_type?.trim().toLowerCase() === 'workflow automation'
		);

		const result = workflowDatas.map(workflow => {
			const workflowName = workflow.n8n_workflow_name?.trim().toLowerCase();
			const matchedAsset = workflowAssets.find(
				a => a.asset_name?.trim().toLowerCase() === workflowName
			);
			return {
				...workflow,
				ownership: matchedAsset?.ownership || null,
			};
		})
		.filter(item => item.ownership !== null)
		.sort((a, b) => (b.total_runs ?? 0) - (a.total_runs ?? 0));

		return result;
	},

	async getHTML() {
		const data = await this.mergeData();

		if (!data.length) return `<html><body style="font-family:Arial,sans-serif;padding:20px;color:#888">No data found.</body></html>`;

		const allColumns = Object.keys(data[0]);

		const orderedColumns = [
			"n8n_workflow_name",
			"today_total_runs",
			"today_failure_count",
			"today_success_rate_pct",
			"today_median_duration_seconds",
			"today_p90_duration_seconds",
			"total_runs",
			"failure_count",
			"success_rate_pct",
			"median_duration_seconds",
			"p90_duration_seconds",
		];

		const remainingColumns = allColumns.filter(c => !orderedColumns.includes(c));
		const columns = [
			...orderedColumns.filter(c => allColumns.includes(c)),
			...remainingColumns
		];

		const columnLabels = {
			n8n_workflow_name:             "Workflow Name",
			today_total_runs:              "Today Runs",
			today_failure_count:           "Today Failures",
			today_success_rate_pct:        "Today Success %",
			today_median_duration_seconds: "Today Median (sec)",
			today_p90_duration_seconds:    "Today P90 (sec)",
			total_runs:                    "Monthly Runs",
			failure_count:                 "Monthly Failures",
			success_rate_pct:              "Monthly Success %",
			median_duration_seconds:       "Monthly Median (sec)",
			p90_duration_seconds:          "Monthly P90 (sec)",
		};

		const todayCols   = orderedColumns.slice(1, 6);
		const monthlyCols = orderedColumns.slice(6, 11);
		const metaCols    = orderedColumns.slice(11, 14);

		const todayCount   = todayCols.filter(c   => allColumns.includes(c)).length;
		const monthlyCount = monthlyCols.filter(c => allColumns.includes(c)).length;
		const metaCount    = metaCols.filter(c    => allColumns.includes(c)).length;

		// Sticky column is sortable too — data-col="0"
		const groupHeader = `
      <tr>
        <th class="sticky-col sortable" rowspan="2" style="vertical-align:middle;cursor:pointer;user-select:none;"
            onclick="sortTable(0)" data-col="0" data-dir="asc">
          Workflow Name <span class="sort-icon">⇅</span>
        </th>
        ${todayCount   > 0 ? `<th colspan="${todayCount}"   style="background:#1a5fa8;border-left:2px solid #fff;">Today</th>`   : ""}
        ${monthlyCount > 0 ? `<th colspan="${monthlyCount}" style="background:#1a5fa8;border-left:2px solid #fff;">Monthly</th>` : ""}
        ${metaCount    > 0 ? `<th colspan="${metaCount}"    style="background:#1a5fa8;border-left:2px solid #fff;">Info</th>`    : ""}
        ${remainingColumns.length > 0 ? `<th colspan="${remainingColumns.length}" style="background:#1a5fa8;border-left:2px solid #fff;">Other</th>` : ""}
      </tr>
    `;

		// Sub-headers: colIndex = i + 1 (because col 0 is the sticky name above)
		const subHeaders = columns.slice(1).map((c, i) => {
			const colIndex   = i + 1;
			const label      = columnLabels[c] || c.replace(/_/g, " ").replace(/\b\w/g, x => x.toUpperCase());
			const isTodayFirst   = c === todayCols.find(t   => allColumns.includes(t));
			const isMonthlyFirst = c === monthlyCols.find(t => allColumns.includes(t));
			const isMetaFirst    = c === metaCols.find(t    => allColumns.includes(t));
			const borderStyle    = (isTodayFirst || isMonthlyFirst || isMetaFirst) ? "border-left:2px solid #4a90d9;" : "";
			return `<th class="sortable" style="${borderStyle}cursor:pointer;user-select:none;"
                    onclick="sortTable(${colIndex})" data-col="${colIndex}" data-dir="asc">
				${label} <span class="sort-icon">⇅</span>
			</th>`;
		}).join("");

		const headers = groupHeader + `<tr>${subHeaders}</tr>`;

		const body = data.map(row =>
			`<tr>${columns.map((c, i) => {
				const val = row[c] ?? "";
				const isTodayFirst   = c === todayCols.find(t   => allColumns.includes(t));
				const isMonthlyFirst = c === monthlyCols.find(t => allColumns.includes(t));
				const isMetaFirst    = c === metaCols.find(t    => allColumns.includes(t));
				const borderStyle    = (isTodayFirst || isMonthlyFirst || isMetaFirst) ? "border-left:2px solid #d0d8f0;" : "";
				const display = (c === "today_success_rate_pct" || c === "success_rate_pct")
					? (val !== "" ? val + "%" : "0%")
					: val;
				return i === 0
					? `<td class="sticky-col workflow-col">${display}</td>`
					: `<td style="${borderStyle}">${display}</td>`;
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
        }
        th.sortable:hover { background: #1e4ea0; }
        th.sorted-asc  .sort-icon::after { content: " ▲"; }
        th.sorted-desc .sort-icon::after { content: " ▼"; }
        .sort-icon { font-size: 10px; opacity: 0.7; }
        th.sorted-asc  .sort-icon,
        th.sorted-desc .sort-icon { opacity: 1; }
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
        thead .sticky-col { background: #2b62c0; z-index: 3; }
        .workflow-col { text-align: left; font-weight: bold; }
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

        <div class="toolbar">
          <button class="btn csv" onclick="downloadCSV()">&#8595; CSV</button>
          <button class="btn xl"  onclick="downloadXLSX()">&#8615; XLSX</button>
        </div>

        <div class="table-wrapper">
          <table id="mainTable">
            <thead>${headers}</thead>
            <tbody>${body}</tbody>
          </table>
        </div>

        <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"><\/script>
        <script>
          const TABLE_DATA = ${tableDataJSON};

          function sortTable(colIndex, dir) {
            const table = document.getElementById("mainTable");
            const tbody = table.querySelector("tbody");

            // Select by data-col to safely handle the two-row grouped header
            const allSortableThs = table.querySelectorAll("th[data-col]");
            const th = Array.from(allSortableThs).find(h => parseInt(h.dataset.col) === colIndex);
            if (!th) return;

            const currentDir = th.dataset.dir || "asc";
            const newDir = dir || (currentDir === "asc" ? "desc" : "asc");

            // Reset all sortable headers
            allSortableThs.forEach(h => {
              h.dataset.dir = "asc";
              h.classList.remove("sorted-asc", "sorted-desc");
              const icon = h.querySelector(".sort-icon");
              if (icon) icon.textContent = "⇅";
            });

            // Set active header
            th.dataset.dir = newDir;
            th.classList.add(newDir === "asc" ? "sorted-asc" : "sorted-desc");
            const icon = th.querySelector(".sort-icon");
            if (icon) icon.textContent = newDir === "asc" ? "▲" : "▼";

            const rows = Array.from(tbody.querySelectorAll("tr"));
            rows.sort((a, b) => {
              const aText = a.cells[colIndex].textContent.replace("%", "").trim();
              const bText = b.cells[colIndex].textContent.replace("%", "").trim();
              const aNum  = parseFloat(aText);
              const bNum  = parseFloat(bText);
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
            trigger("workflow_data.csv", "data:text/csv;charset=utf-8," + encodeURIComponent(csv));
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
            XLSX.utils.book_append_sheet(wb, ws, "Workflow Data");
            XLSX.writeFile(wb, "workflow_data.xlsx");
          }

          function trigger(filename, href) {
            const a = document.createElement("a");
            a.href = href;
            a.download = filename;
            a.click();
          }

          // Default sort: Monthly Runs (total_runs) descending
          const _initCol = TABLE_DATA.columns.indexOf("total_runs");
          if (_initCol !== -1) sortTable(_initCol, "desc");
        <\/script>
      </body>
      </html>
    `;
	}
};

// export default {
	// async mergeData() {
		// await workflows.run();
		// await appsmith_workflow_filter.run();
// 
		// const workflowDatas     = workflows.data                || [];
		// const workflowDataowner = appsmith_workflow_filter.data || [];
// 
		// const workflowAssets = workflowDataowner.filter(
			// item => item.asset_type?.trim().toLowerCase() === 'workflow automation'
		// );
// 
		// const result = workflowDatas.map(workflow => {
			// const workflowName = workflow.n8n_workflow_name?.trim().toLowerCase();
// 
			// const matchedAsset = workflowAssets.find(
				// a => a.asset_name?.trim().toLowerCase() === workflowName
			// );
// 
			// return {
				// ...workflow,
				// ownership:  matchedAsset?.ownership  || null,
// 
			// };
		// })
		// .filter(item => item.ownership !== null)
		// .sort((a, b) => (b.total_runs ?? 0) - (a.total_runs ?? 0));
// 
		// return result;
	// },
// 
	// async getHTML() {
		// const data = await this.mergeData();
// 
		// if (!data.length) return `<html><body style="font-family:Arial,sans-serif;padding:20px;color:#888">No data found.</body></html>`;
// 
		// const allColumns = Object.keys(data[0]);
// 
		// // Today columns first, then monthly totals, then metadata
		// const orderedColumns = [
			// // Frozen
			// "n8n_workflow_name",
			// // Today
			// "today_total_runs",
			// "today_failure_count",
			// "today_success_rate_pct",
			// "today_median_duration_seconds",
			// "today_p90_duration_seconds",
			// // Monthly total
			// "total_runs",
			// "failure_count",
			// "success_rate_pct",
			// "median_duration_seconds",
			// "p90_duration_seconds",
			// // Metadata
// 
		// ];
// 
		// const remainingColumns = allColumns.filter(c => !orderedColumns.includes(c));
		// const columns = [
			// ...orderedColumns.filter(c => allColumns.includes(c)),
			// ...remainingColumns
		// ];
// 
		// const columnLabels = {
			// n8n_workflow_name:            "Workflow Name",
			// // Today
			// today_total_runs:             "Today Runs",
			// today_failure_count:          "Today Failures",
			// today_success_rate_pct:       "Today Success %",
			// today_median_duration_seconds:"Today Median (sec)",
			// today_p90_duration_seconds:   "Today P90 (sec)",
			// // Monthly
			// total_runs:                   "Monthly Runs",
			// failure_count:                "Monthly Failures",
			// success_rate_pct:             "Monthly Success %",
			// median_duration_seconds:      "Monthly Median (sec)",
			// p90_duration_seconds:         "Monthly P90 (sec)",
			// // Metadata
// 
		// };
// 
		// // Group columns for header spanning
		// const todayCols   = orderedColumns.slice(1, 6);
		// const monthlyCols = orderedColumns.slice(6, 11);
		// const metaCols    = orderedColumns.slice(11, 14);
// 
		// const todayCount   = todayCols.filter(c   => allColumns.includes(c)).length;
		// const monthlyCount = monthlyCols.filter(c => allColumns.includes(c)).length;
		// const metaCount    = metaCols.filter(c    => allColumns.includes(c)).length;
// 
		// const groupHeader = `
      // <tr>
        // <th class="sticky-col" rowspan="2" style="vertical-align:middle;">Workflow Name</th>
        // ${todayCount   > 0 ? `<th colspan="${todayCount}"   style="background:#1a5fa8;border-left:2px solid #fff;">Today</th>`          : ""}
        // ${monthlyCount > 0 ? `<th colspan="${monthlyCount}" style="background:#1a5fa8;border-left:2px solid #fff;">Monthly</th>`        : ""}
        // ${metaCount    > 0 ? `<th colspan="${metaCount}"    style="background:#1a5fa8;border-left:2px solid #fff;">Info</th>`           : ""}
        // ${remainingColumns.length > 0 ? `<th colspan="${remainingColumns.length}" style="background:#1a5fa8;border-left:2px solid #fff;">Other</th>` : ""}
      // </tr>
    // `;
// 
		// const subHeaders = columns.slice(1).map((c, i) => {
			// const label = columnLabels[c] || c.replace(/_/g, " ").replace(/\b\w/g, x => x.toUpperCase());
			// const isTodayFirst   = c === todayCols.find(t => allColumns.includes(t));
			// const isMonthlyFirst = c === monthlyCols.find(t => allColumns.includes(t));
			// const isMetaFirst    = c === metaCols.find(t => allColumns.includes(t));
			// const borderStyle    = (isTodayFirst || isMonthlyFirst || isMetaFirst) ? "border-left:2px solid #4a90d9;" : "";
			// return `<th style="${borderStyle}">${label}</th>`;
		// }).join("");
// 
		// const headers = groupHeader + `<tr>${subHeaders}</tr>`;
// 
		// const body = data.map(row =>
													// `<tr>${columns.map((c, i) => {
			// const val = row[c] ?? "";
			// const isTodayFirst   = c === todayCols.find(t => allColumns.includes(t));
			// const isMonthlyFirst = c === monthlyCols.find(t => allColumns.includes(t));
			// const isMetaFirst    = c === metaCols.find(t => allColumns.includes(t));
			// const borderStyle    = (isTodayFirst || isMonthlyFirst || isMetaFirst) ? "border-left:2px solid #d0d8f0;" : "";
			// const display = (c === "today_success_rate_pct" || c === "success_rate_pct")
			// ? (val !== "" ? val + "%" : "0%")
			// : val;
			// return i === 0
				// ? `<td class="sticky-col workflow-col">${display}</td>`
			// : `<td style="${borderStyle}">${display}</td>`;
		// }).join("")}</tr>`
												 // ).join("");
// 
		// const tableDataJSON = JSON.stringify({ columns, columnLabels, rows: data });
// 
		// return `
      // <html>
      // <head>
      // <style>
        // * { box-sizing: border-box; margin: 0; padding: 0; }
        // body { font-family: Arial, sans-serif; font-size: 13px; }
        // .toolbar {
          // display: flex;
          // align-items: center;
          // justify-content: flex-end;
          // gap: 8px;
          // padding: 10px 12px;
          // border-bottom: 1px solid #e0e0e0;
          // background: #fff;
        // }
        // .btn {
          // display: inline-flex;
          // align-items: center;
          // gap: 5px;
          // padding: 6px 13px;
          // font-size: 12px;
          // font-family: Arial, sans-serif;
          // border-radius: 6px;
          // cursor: pointer;
        // }
        // .btn.csv { background: #2b62c0; color: #fff; border: 1px solid #2b62c0; }
        // .btn.csv:hover { background: #1e4ea0; }
        // .btn.xl  { background: #1a7a4a; color: #fff; border: 1px solid #1a7a4a; }
        // .btn.xl:hover  { background: #155f3a; }
        // .table-wrapper { overflow-x: auto; width: 100%; }
        // table { border-collapse: collapse; width: 100%; }
        // th {
          // background: #2b62c0;
          // color: white;
          // padding: 8px 12px;
          // text-align: center;
          // white-space: nowrap;
        // }
        // td {
          // padding: 8px 12px;
          // text-align: center;
          // border-bottom: 1px solid #eee;
          // white-space: nowrap;
        // }
        // .sticky-col {
          // position: sticky;
          // left: 0;
          // z-index: 2;
        // }
        // thead .sticky-col {
          // background: #2b62c0;
          // z-index: 3;
        // }
        // .workflow-col {
          // text-align: left;
          // font-weight: bold;
        // }
        // tbody tr:nth-child(odd)  .sticky-col { background: #ffffff; }
        // tbody tr:nth-child(even) .sticky-col { background: #f9f9f9; }
        // tbody tr:hover           .sticky-col { background: #f0eeff; }
        // tr:nth-child(even) td:not(.sticky-col) { background: #f9f9f9; }
        // tr:hover           td:not(.sticky-col) { background: #f0eeff; }
        // .sticky-col::after {
          // content: '';
          // position: absolute;
          // top: 0; right: -4px; bottom: 0;
          // width: 4px;
          // background: linear-gradient(to right, rgba(0,0,0,0.08), transparent);
          // pointer-events: none;
        // }
      // </style>
      // </head>
      // <body>
// 
        // <div class="toolbar">
          // <button class="btn csv" onclick="downloadCSV()">&#8595; CSV</button>
          // <button class="btn xl"  onclick="downloadXLSX()">&#8615; XLSX</button>
        // </div>
// 
        // <div class="table-wrapper">
          // <table>
            // <thead>${headers}</thead>
            // <tbody>${body}</tbody>
          // </table>
        // </div>
// 
        // <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"><\/script>
        // <script>
          // const TABLE_DATA = ${tableDataJSON};
// 
          // function downloadCSV() {
            // const { columns, columnLabels, rows } = TABLE_DATA;
            // const head = columns.map(c => columnLabels[c] || c).join(",");
            // const lines = rows.map(r =>
              // columns.map(c => '"' + (r[c] ?? "") + '"').join(",")
            // );
            // const csv = [head, ...lines].join("\\n");
            // trigger("workflow_data.csv", "data:text/csv;charset=utf-8," + encodeURIComponent(csv));
          // }
// 
          // function downloadXLSX() {
            // const { columns, columnLabels, rows } = TABLE_DATA;
            // const sheetData = [
              // columns.map(c => columnLabels[c] || c.replace(/_/g," ").replace(/\\b\\w/g, x => x.toUpperCase())),
              // ...rows.map(r => columns.map(c => r[c] ?? ""))
            // ];
            // const wb = XLSX.utils.book_new();
            // const ws = XLSX.utils.aoa_to_sheet(sheetData);
            // ws["!cols"] = columns.map(() => ({ wch: 22 }));
            // XLSX.utils.book_append_sheet(wb, ws, "Workflow Data");
            // XLSX.writeFile(wb, "workflow_data.xlsx");
          // }
// 
          // function trigger(filename, href) {
            // const a = document.createElement("a");
            // a.href = href;
            // a.download = filename;
            // a.click();
          // }
        // <\/script>
      // </body>
      // </html>
    // `;
	// }
// };