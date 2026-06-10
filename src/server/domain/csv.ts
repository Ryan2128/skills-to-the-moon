type CsvValue = string | number | boolean | null | undefined;

function escapeCsvValue(value: CsvValue): string {
	if (value === null || value === undefined) {
		return "";
	}

	const raw = String(value);
	const escaped = raw.replaceAll('"', '""');
	const mustQuote = raw.includes(",") || raw.includes('"') || raw.includes("\n") || raw.includes("\r");

	return mustQuote ? `"${escaped}"` : escaped;
}

export function toCsv<T extends Record<string, CsvValue>>(headers: Array<keyof T & string>, rows: T[]): string {
	const lines = [headers.join(",")];

	for (const row of rows) {
		lines.push(headers.map((header) => escapeCsvValue(row[header])).join(","));
	}

	return lines.join("\n");
}
