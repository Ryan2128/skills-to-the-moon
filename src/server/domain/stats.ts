import type { Db } from "../db/connection.js";

export type SkillStats = {
	skill_name: string;
	invocation_count: number;
	correction_count: number;
	correction_rate: number;
};

export type Totals = {
	invocation_count: number;
	correction_count: number;
};

export function getTotals(db: Db): Totals {
	const row = db
		.prepare(
			`
				select
					(select count(*) from skill_invocations) as invocation_count,
					(select count(*) from feedback_events) as correction_count
			`
		)
		.get() as Totals;

	return row;
}

export function getSkillStats(db: Db): SkillStats[] {
	return db
		.prepare(
			`
				with skills as (
					select skill_name from skill_invocations
					union
					select skill_name from feedback_events
				),
				invocations as (
					select skill_name, count(*) as invocation_count
					from skill_invocations
					group by skill_name
				),
				corrections as (
					select skill_name, count(*) as correction_count
					from feedback_events
					group by skill_name
				)
				select
					skills.skill_name,
					coalesce(invocations.invocation_count, 0) as invocation_count,
					coalesce(corrections.correction_count, 0) as correction_count,
					case
						when coalesce(invocations.invocation_count, 0) = 0 then 0
						else cast(coalesce(corrections.correction_count, 0) as real) / invocations.invocation_count
					end as correction_rate
				from skills
				left join invocations on invocations.skill_name = skills.skill_name
				left join corrections on corrections.skill_name = skills.skill_name
				order by skills.skill_name asc
			`
		)
		.all() as SkillStats[];
}
