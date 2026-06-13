import { Worker } from "@notionhq/workers";
import { j } from "@notionhq/workers/schema-builder";
import { listPartifulEvents } from "./partiful-calendar.js";

const worker = new Worker();
export default worker;

worker.tool("listPartifulEvents", {
	title: "List Partiful Events",
	description:
		"Fetch a user-provided Partiful webcal/ICS calendar URL and return matching event details plus Partiful links for a custom agent to sync elsewhere.",
	schema: j.object({
		calendarUrl: j
			.string()
			.describe(
				"A Partiful calendar URL, usually webcal://calendars.partiful.com/getCalendar?id=.... Pass null to use PARTIFUL_CALENDAR_URL from the worker environment.",
			)
			.nullable(),
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
	execute: async (input) => listPartifulEvents(input),
});
