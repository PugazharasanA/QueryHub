export default {
	descriptions: {
		"ASK-NOT-CLARIFIED": "Analyst had scope for doubt on the ask but proceeded without clarifying",
		"ASK-MISUNDERSTOOD": "Analyst misunderstood the ask despite no perceived ambiguity",
		"PROMPT-UNCLEAR": "Prompt given to Claude didn't clearly/fully capture the ask",
		"AI-MISINTERPRET": "Claude misunderstood the prompt or generated incorrect logic/output",
		"DATA-STALE": "Source data was outdated at time of processing",
		"DATA-QUALITY": "Source data had nulls, duplicates, wrong types, or other quality issues",
		"COPY-PASTE/TYPO-ERROR": "Manual error while copying, typing, or transcribing values"
	},
	getDescription(tag) {
		return this.descriptions[tag] || "";
	}
}
