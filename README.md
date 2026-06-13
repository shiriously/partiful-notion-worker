# Partiful Notion Worker

This worker exposes custom-agent tools that fetch a Partiful calendar ICS feed and return event objects with Partiful links ready for the agent to sync into a Notion database, Google Calendar, or another destination.

## Tool

Capability keys:

```bash
listPartifulEvents
queryPartifulEvents
```

`listPartifulEvents` takes no input and reads the calendar URL from `PARTIFUL_CALENDAR_URL`.

`queryPartifulEvents` accepts explicit filters:

```json
{
	"timeMin": "2026-07-01T00:00:00Z",
	"timeMax": "2026-08-01T00:00:00Z",
	"maxEvents": 50,
	"query": "launch"
}
```

Set `PARTIFUL_CALENDAR_URL` on the worker. `timeMin` defaults to now, `timeMax` defaults to 180 days after `timeMin`, and `maxEvents` defaults to 50.

## Getting Your Partiful Calendar URL

1. Open Partiful and go to your profile settings.
2. Select **Calendar Sync** in the settings sidebar.
3. In the **Calendar Sync** section, choose **Use Gcal** and click **Copy Link**.
4. Use the copied `webcal://calendars.partiful.com/getCalendar?id=...` link as `PARTIFUL_CALENDAR_URL`.

The toggles under **Manage Synced Calendar** control which Partiful event categories are included in that feed, such as waitlist events, pending approval events, and invited events. Preferences are saved automatically by Partiful.

Output:

```json
{
	"calendarUrl": "https://calendars.partiful.com/getCalendar?id=YOUR_CALENDAR_ID",
	"events": [
		{
			"id": "event uid",
			"title": "Event title",
			"start": "2026-07-04T02:00:00Z",
			"end": "2026-07-04T05:00:00Z",
			"allDay": false,
			"timezone": null,
			"location": "Venue",
			"description": "RSVP at https://partiful.com/e/example",
			"url": "https://partiful.com/e/example",
			"links": ["https://partiful.com/e/example"]
		}
	]
}
```

## Local Development

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm run check
npm test
```

Execute locally:

```bash
PARTIFUL_CALENDAR_URL="webcal://calendars.partiful.com/getCalendar?id=YOUR_CALENDAR_ID" ntn workers exec listPartifulEvents --local -d '{}'
```

Or query with explicit filters:

```bash
PARTIFUL_CALENDAR_URL="webcal://calendars.partiful.com/getCalendar?id=YOUR_CALENDAR_ID" ntn workers exec queryPartifulEvents --local -d '{"timeMin":"2026-07-01T00:00:00Z","timeMax":"2026-08-01T00:00:00Z","maxEvents":50,"query":null}'
```

Deploy:

```bash
ntn workers deploy --name partiful-calendar-worker
ntn workers env set PARTIFUL_CALENDAR_URL="webcal://calendars.partiful.com/getCalendar?id=..."
```

## Notes

- `webcal://` URLs are converted to `https://` before fetching.
- The tool filters locally with `timeMin`, `timeMax`, `maxEvents`, and `query`.
- The parser handles normal single-instance ICS events. It does not expand recurring `RRULE` masters; if Partiful emits recurrence rules instead of event instances, that is the moment to consider the Google Calendar API path.
