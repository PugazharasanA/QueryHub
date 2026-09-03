export default {
	async mergeSummary() {
		// Run queries
		await workflows.run();
		await appsmith_workflow_filter.run();

		// Query data
		const workflowDatas = workflows.data || [];
		const workflowDataowner = appsmith_workflow_filter.data || [];

		// Filter only Workflow Automation assets
		const workflowAssets = workflowDataowner.filter(
			item =>
				item.asset_type?.trim().toLowerCase() ===
				'workflow automation'
		);

		// Merge and keep only matched ownership rows
		const matched = workflowDatas
			.map(workflow => {
				const workflowName = workflow.n8n_workflow_name?.trim().toLowerCase();
				const matchedAsset = workflowAssets.find(
					a => a.asset_name?.trim().toLowerCase() === workflowName
				);
				return { ...workflow, ownership: matchedAsset?.ownership || null };
			})
			.filter(item => item.ownership !== null);

		// Aggregate overall summary
		const totalWorkflows = matched.length;
		const totalRuns = matched.reduce((sum, r) => sum + (Number(r.total_runs) || 0), 0);
		const totalFailures = matched.reduce((sum, r) => sum + (Number(r.failure_count) || 0), 0);
		const successRate = totalRuns > 0
			? Math.round(((totalRuns - totalFailures) / totalRuns) * 100 * 100) / 100
			: 0;

		return [{
			total_workflow_count: totalWorkflows,
			total_runs: totalRuns,
			failure_count: totalFailures,
			success_rate_pct: successRate
		}];
	}
}