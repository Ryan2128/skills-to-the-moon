import type { Db } from "../db/connection.js";
import { getSkillStats, getTotals } from "../domain/stats.js";
import { escapeHtml, renderLayout } from "./layout.js";

function formatRate(rate: number): string {
	return `${(rate * 100).toFixed(1)}%`;
}

export function renderDashboardPage(db: Db): string {
	const totals = getTotals(db);
	const stats = getSkillStats(db);
	const rows =
		stats.length === 0
			? `<tr><td colspan="4" class="muted">暂无 skill 调用或纠错反馈</td></tr>`
			: stats
					.map(
						(stat) => `<tr>
				<td>${escapeHtml(stat.skill_name)}</td>
				<td>${escapeHtml(stat.invocation_count)}</td>
				<td>${escapeHtml(stat.correction_count)}</td>
				<td>${escapeHtml(formatRate(stat.correction_rate))}</td>
			</tr>`
					)
					.join("");

	return renderLayout({
		title: "Skill 调用监控",
		currentPath: "/",
		body: `			<section>
				<h1>Skill 调用监控</h1>
				<p class="muted">按调用与纠错反馈观察 skill 使用质量。</p>
			</section>
			<section class="metrics" aria-label="总体统计">
				<div class="metric">
					<div class="metric-label">总调用</div>
					<div class="metric-value">${escapeHtml(totals.invocation_count)}</div>
				</div>
				<div class="metric">
					<div class="metric-label">纠错反馈数</div>
					<div class="metric-value">${escapeHtml(totals.correction_count)}</div>
				</div>
			</section>
			<section class="panel">
				<h2>按 skill 聚合</h2>
				<table>
					<thead>
						<tr>
							<th>Skill</th>
							<th>调用次数</th>
							<th>纠错反馈</th>
							<th>纠错率</th>
						</tr>
					</thead>
					<tbody>
			${rows}
					</tbody>
				</table>
			</section>`
	});
}
