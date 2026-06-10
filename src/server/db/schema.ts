import type { Db } from "./connection.js";

export function runMigrations(db: Db): void {
	db.exec(`
		create table if not exists skill_invocations (
			id integer primary key autoincrement,
			skill_name text not null,
			working_directory text not null,
			tech_stack_json text not null,
			started_at text not null,
			finished_at text,
			status text not null check (status in ('success', 'failed', 'unknown'))
		);

		create table if not exists feedback_events (
			id integer primary key autoincrement,
			skill_name text not null,
			working_directory text not null,
			tech_stack_json text not null,
			ai_output text not null,
			user_correction_input text not null,
			classification_confidence real not null check (
				classification_confidence >= 0 and classification_confidence <= 1
			),
			needs_batch_review integer not null check (needs_batch_review in (0, 1)),
			created_at text not null
		);

		create table if not exists merge_requests (
			id integer primary key autoincrement,
			mr_url text not null unique,
			title text not null,
			head_commit_hash text not null,
			iteration_type text not null check (iteration_type in ('minor', 'major')),
			feedback_id_start integer not null,
			feedback_id_end integer not null,
			status text not null check (status in ('open', 'merged', 'closed')),
			opened_at text not null,
			merged_at text,
			purged_at text,
			check (feedback_id_start <= feedback_id_end)
		);

		create table if not exists purge_audit_logs (
			id integer primary key autoincrement,
			merge_request_id integer not null references merge_requests(id),
			feedback_id_start integer not null,
			feedback_id_end integer not null,
			deleted_count integer not null,
			purged_at text not null
		);
	`);
}
