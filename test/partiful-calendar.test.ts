import assert from "node:assert/strict";
import test from "node:test";
import {
	listPartifulEvents,
	toFetchableCalendarUrl,
	parseIcs,
} from "../src/partiful-calendar.js";

const sampleIcs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-1
SUMMARY:Launch Party
DTSTART:20260704T020000Z
DTEND:20260704T050000Z
LOCATION:Warehouse
DESCRIPTION:RSVP at https://partiful.com/e/launch and bring friends
END:VEVENT
BEGIN:VEVENT
UID:event-2
SUMMARY:Picnic
DTSTART;VALUE=DATE:20260710
DTEND;VALUE=DATE:20260711
URL:https://partiful.com/e/picnic
END:VEVENT
END:VCALENDAR`;

test("turns Partiful webcal URLs into fetchable HTTPS URLs", () => {
	assert.equal(
		toFetchableCalendarUrl(
			"webcal://calendars.partiful.com/getCalendar?id=00000000-0000-4000-8000-000000000000",
		),
		"https://calendars.partiful.com/getCalendar?id=00000000-0000-4000-8000-000000000000",
	);
	assert.equal(
		toFetchableCalendarUrl(
			"https://calendars.partiful.com/getCalendar?id=already-https",
		),
		"https://calendars.partiful.com/getCalendar?id=already-https",
	);
});

test("parses timed and all-day ICS events", () => {
	const events = parseIcs(sampleIcs);
	assert.equal(events.length, 2);
	assert.equal(events[0]?.summary, "Launch Party");
	assert.equal(events[0]?.dtstart?.display, "2026-07-04T02:00:00Z");
	assert.equal(events[0]?.dtstart?.allDay, false);
	assert.equal(events[1]?.dtstart?.display, "2026-07-10");
	assert.equal(events[1]?.dtstart?.allDay, true);
});

test("fetches, filters, sorts, and returns Partiful links", async () => {
	const fetchImpl = async () =>
		new Response(sampleIcs, {
			status: 200,
			headers: { "content-type": "text/calendar" },
		});

	const result = await listPartifulEvents(
		{
			calendarUrl: "https://calendars.partiful.com/getCalendar?id=test-calendar",
			timeMin: "2026-07-01T00:00:00Z",
			timeMax: "2026-07-08T00:00:00Z",
			query: "launch",
		},
		fetchImpl as typeof fetch,
	);

	assert.equal(result.events.length, 1);
	assert.deepEqual(result.events[0]?.links, ["https://partiful.com/e/launch"]);
	assert.equal(result.events[0]?.url, "https://partiful.com/e/launch");
});

test("uses PARTIFUL_CALENDAR_URL when calendarUrl is null", async () => {
	const previousUrl = process.env.PARTIFUL_CALENDAR_URL;
	process.env.PARTIFUL_CALENDAR_URL =
		"webcal://calendars.partiful.com/getCalendar?id=env-calendar";

	try {
		const fetchImpl = async (url: string | URL | Request) => {
			assert.equal(
				String(url),
				"https://calendars.partiful.com/getCalendar?id=env-calendar",
			);
			return new Response(sampleIcs, { status: 200 });
		};

		const result = await listPartifulEvents(
			{
				calendarUrl: null,
				timeMin: "2026-07-01T00:00:00Z",
				timeMax: "2026-08-01T00:00:00Z",
			},
			fetchImpl as typeof fetch,
		);

		assert.equal(result.events.length, 2);
	} finally {
		if (previousUrl === undefined) {
			delete process.env.PARTIFUL_CALENDAR_URL;
		} else {
			process.env.PARTIFUL_CALENDAR_URL = previousUrl;
		}
	}
});
