type LayoutOptions = {
	title: string;
	currentPath: "/" | "/admin";
	body: string;
};

export function escapeHtml(value: string | number | null | undefined): string {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function renderLayout(options: LayoutOptions): string {
	return `<!doctype html>
<html lang="zh-CN">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>${escapeHtml(options.title)}</title>
	<style>
		:root {
			color-scheme: light;
			--bg: #f6f8fb;
			--surface: #ffffff;
			--border: #d7dee8;
			--text: #172033;
			--muted: #617089;
			--primary: #1677ff;
			--primary-soft: #e8f2ff;
			--danger: #c2410c;
		}

		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			background: var(--bg);
			color: var(--text);
			font-family:
				-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			line-height: 1.5;
		}

		a {
			color: var(--primary);
			text-decoration: none;
		}

		a:hover {
			text-decoration: underline;
		}

		.shell {
			width: min(1120px, calc(100% - 32px));
			margin: 0 auto;
			padding: 24px 0 40px;
		}

		.topbar {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 16px;
			margin-bottom: 24px;
		}

		.brand {
			font-size: 18px;
			font-weight: 700;
		}

		.nav {
			display: flex;
			gap: 8px;
		}

		.nav a {
			border-radius: 6px;
			color: var(--muted);
			padding: 8px 10px;
			font-size: 14px;
		}

		.nav a[aria-current="page"] {
			background: var(--primary-soft);
			color: var(--primary);
			font-weight: 600;
		}

		main {
			display: grid;
			gap: 18px;
		}

		h1,
		h2,
		p {
			margin-top: 0;
		}

		h1 {
			margin-bottom: 4px;
			font-size: 28px;
			line-height: 1.2;
		}

		h2 {
			margin-bottom: 14px;
			font-size: 18px;
		}

		.muted {
			color: var(--muted);
		}

		.panel,
		.metric,
		.empty {
			border: 1px solid var(--border);
			border-radius: 8px;
			background: var(--surface);
		}

		.panel {
			padding: 18px;
			overflow-x: auto;
		}

		.metrics {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
			gap: 12px;
		}

		.metric {
			padding: 16px;
		}

		.metric-label {
			margin-bottom: 6px;
			color: var(--muted);
			font-size: 13px;
		}

		.metric-value {
			font-size: 30px;
			font-weight: 700;
			line-height: 1;
		}

		table {
			width: 100%;
			min-width: 640px;
			border-collapse: collapse;
		}

		th,
		td {
			border-bottom: 1px solid var(--border);
			padding: 11px 10px;
			text-align: left;
			vertical-align: top;
		}

		th {
			color: var(--muted);
			font-size: 13px;
			font-weight: 600;
		}

		tr:last-child td {
			border-bottom: 0;
		}

		.kv {
			display: grid;
			grid-template-columns: 140px minmax(0, 1fr);
			gap: 10px 14px;
			margin: 0;
		}

		.kv dt {
			color: var(--muted);
			font-weight: 600;
		}

		.kv dd {
			margin: 0;
			overflow-wrap: anywhere;
		}

		.actions {
			display: flex;
			align-items: center;
			gap: 12px;
			margin-top: 16px;
		}

		button {
			border: 0;
			border-radius: 6px;
			background: var(--primary);
			color: #fff;
			cursor: pointer;
			font: inherit;
			font-weight: 600;
			padding: 9px 14px;
		}

		button:disabled {
			background: #aeb8c7;
			cursor: not-allowed;
		}

		.empty {
			margin: 0;
			padding: 18px;
			color: var(--muted);
		}

		.warning {
			color: var(--danger);
			font-weight: 600;
		}

		@media (max-width: 640px) {
			.shell {
				width: min(100% - 24px, 1120px);
				padding-top: 16px;
			}

			.topbar {
				align-items: flex-start;
				flex-direction: column;
			}

			.kv {
				grid-template-columns: 1fr;
				gap: 4px;
			}
		}
	</style>
</head>
<body>
	<div class="shell">
		<header class="topbar">
			<div class="brand">Skill 反馈系统</div>
			<nav class="nav" aria-label="主导航">
				<a href="/"${options.currentPath === "/" ? ' aria-current="page"' : ""}>监控</a>
				<a href="/admin"${options.currentPath === "/admin" ? ' aria-current="page"' : ""}>管理</a>
			</nav>
		</header>
		<main>
${options.body}
		</main>
	</div>
</body>
</html>`;
}
