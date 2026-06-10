import type { Db } from "../db/connection.js";
import { countFeedbackByIdRange, getLatestMergeRequest, type MergeRequestRow } from "../domain/repositories.js";
import { escapeHtml, renderLayout } from "./layout.js";

function formatStatus(status: MergeRequestRow["status"]): string {
	if (status === "merged") {
		return "已合并";
	}

	if (status === "closed") {
		return "已关闭";
	}

	return "打开";
}

function isSafeHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

function renderMergeRequestUrl(value: string): string {
	const escaped = escapeHtml(value);

	if (!isSafeHttpUrl(value)) {
		return `<span class="warning">${escaped}</span>`;
	}

	return `<a href="${escaped}">${escaped}</a>`;
}

function getPurgeReason(mergeRequest: MergeRequestRow, adminToken?: string): string {
	if (mergeRequest.purged_at) {
		return `已在 ${escapeHtml(mergeRequest.purged_at)} 清理`;
	}

	if (!adminToken) {
		return "设置 SKILLS_FEEDBACK_ADMIN_TOKEN 后才能清理反馈。";
	}

	if (mergeRequest.status === "closed") {
		return "已关闭的 MR 不能清理反馈。";
	}

	if (mergeRequest.status !== "merged") {
		return "只有合并后的 MR 可以清理反馈。";
	}

	if (!mergeRequest.merged_at) {
		return "合并后的 MR 必须记录合并时间后才能清理反馈。";
	}

	if (mergeRequest.iteration_type !== "major") {
		return "只有大迭代 MR 合并后才能清理反馈。";
	}

	return "将删除该 MR 覆盖范围内的纠错反馈，并记录审计日志。";
}

function renderPurgeForm(mergeRequest: MergeRequestRow, adminToken?: string): string {
	const canPurge =
		Boolean(adminToken) &&
		mergeRequest.iteration_type === "major" &&
		mergeRequest.status === "merged" &&
		Boolean(mergeRequest.merged_at) &&
		!mergeRequest.purged_at;
	const reason = getPurgeReason(mergeRequest, adminToken);
	const tokenInput = adminToken
		? `<input type="hidden" name="admin_token" value="${escapeHtml(adminToken)}">`
		: "";

	return `<form method="post" action="/api/admin/merge-requests/${escapeHtml(mergeRequest.id)}/purge" class="actions">
					${tokenInput}
					<button type="submit"${canPurge ? "" : " disabled"}>清理反馈</button>
					<span class="${canPurge ? "muted" : "warning"}">${reason}</span>
				</form>`;
}

function renderMergeRequest(db: Db, mergeRequest: MergeRequestRow, adminToken?: string): string {
	const estimatedPurgeCount = countFeedbackByIdRange(
		db,
		mergeRequest.feedback_id_start,
		mergeRequest.feedback_id_end
	);

	return `<section class="panel">
				<h2>最新 MR 元信息</h2>
				<dl class="kv">
					<dt>标题</dt>
					<dd>${escapeHtml(mergeRequest.title)}</dd>
					<dt>地址</dt>
					<dd>${renderMergeRequestUrl(mergeRequest.mr_url)}</dd>
					<dt>Commit</dt>
					<dd>${escapeHtml(mergeRequest.head_commit_hash)}</dd>
					<dt>迭代类型</dt>
					<dd>${escapeHtml(mergeRequest.iteration_type)}</dd>
					<dt>反馈范围</dt>
					<dd>${escapeHtml(mergeRequest.feedback_id_start)} - ${escapeHtml(mergeRequest.feedback_id_end)}</dd>
					<dt>状态</dt>
					<dd>${formatStatus(mergeRequest.status)}</dd>
					<dt>打开时间</dt>
					<dd>${escapeHtml(mergeRequest.opened_at)}</dd>
					<dt>合并时间</dt>
					<dd>${escapeHtml(mergeRequest.merged_at ?? "未合并")}</dd>
					<dt>预计清理记录数</dt>
					<dd>${escapeHtml(estimatedPurgeCount)}</dd>
				</dl>
				${renderPurgeForm(mergeRequest, adminToken)}
			</section>`;
}

export function renderAdminPage(db: Db, adminToken?: string): string {
	const latestMergeRequest = getLatestMergeRequest(db);
	const mergeRequestSection = latestMergeRequest
		? renderMergeRequest(db, latestMergeRequest, adminToken)
		: `<p class="empty">暂无合并请求</p>`;

	return renderLayout({
		title: "系统管理",
		currentPath: "/admin",
		body: `			<section>
				<h1>系统管理</h1>
				<p class="muted">查看最新 MR 状态，并在合并后执行反馈清理。</p>
			</section>
			<section>
				<h2>合并后清理</h2>
				${mergeRequestSection}
			</section>`
	});
}
