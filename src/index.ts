import { Worker } from "@notionhq/workers";
import { j } from "@notionhq/workers/schema-builder";
import { listPartifulEvents } from "./partiful-calendar.js";

const worker = new Worker();
export default worker;

worker.tool("listPartifulEvents", {
	title: "List Partiful Events",
	description:
		"Fetch upcoming events from the Partiful calendar configured in PARTIFUL_CALENDAR_URL. Use this when no custom filter is needed.",
	schema: j.object({}),
	outputSchema: j.object({
		calendarUrl: j.string(),
		events: j.array(
			j.object({
				id: j.string(),
				title: j.string(),
				start: j.string(),
				end: j.string().nullable(),
				allDay: j.boolean(),
				timezone: j.string().nullable(),
				location: j.string().nullable(),
				description: j.string().nullable(),
				url: j.string().nullable(),
				links: j.array(j.string()),
			}),
		),
	}),
	hints: { readOnlyHint: true },
	execute: async () => listPartifulEvents({}),
});

worker.tool("queryPartifulEvents", {
	title: "Query Partiful Events",
	description:
		"Fetch events from the configured Partiful calendar with explicit filters. Pass null for fields that should use defaults.",
	schema: j.object({
		timeMin: j
			.datetime()
			.describe(
				"Optional inclusive lower bound for event starts. Defaults to now.",
			)
			.nullable(),
		timeMax: j
			.datetime()
			.describe(
				"Optional exclusive upper bound for event starts. Defaults to 180 days after timeMin.",
			)
			.nullable(),
		maxEvents: j
			.integer()
			.describe("Optional maximum number of events to return. Defaults to 50.")
			.nullable(),
		query: j
			.string()
			.describe(
				"Optional case-insensitive text filter matched against title, location, description, URL, and links.",
			)
			.nullable(),
	}),
	outputSchema: j.object({
		calendarUrl: j.string(),
		events: j.array(
			j.object({
				id: j.string(),
				title: j.string(),
				start: j.string(),
				end: j.string().nullable(),
				allDay: j.boolean(),
				timezone: j.string().nullable(),
				location: j.string().nullable(),
				description: j.string().nullable(),
				url: j.string().nullable(),
				links: j.array(j.string()),
			}),
		),
	}),
	hints: { readOnlyHint: true },
	execute: async (input) => listPartifulEvents(input),
});
