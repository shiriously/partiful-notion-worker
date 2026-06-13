export type ListPartifulEventsInput = {
	calendarUrl?: string | null;
	timeMin?: string | null;
	timeMax?: string | null;
	maxEvents?: number | null;
	query?: string | null;
};

export type PartifulEvent = {
	id: string;
	title: string;
	start: string;
	end: string | null;
	allDay: boolean;
	timezone: string | null;
	location: string | null;
	description: string | null;
	url: string | null;
	links: string[];
};

type IcsProperty = {
	name: string;
	params: Record<string, string>;
	value: string;
};

type IcsEvent = {
	uid?: string;
	summary?: string;
	description?: string;
	location?: string;
	url?: string;
	dtstart?: IcsDate;
	dtend?: IcsDate;
};

type IcsDate = {
	display: string;
	date: Date;
	allDay: boolean;
	timezone: string | null;
};

const DEFAULT_LIMIT = 50;
const DEFAULT_WINDOW_DAYS = 180;
const PARTIFUL_LINK_PATTERN =
	/https?:\/\/(?:www\.)?partiful\.com\/[^\s<>"')\]]+/gi;
const ANY_LINK_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

export async function listPartifulEvents(
	input: ListPartifulEventsInput,
	fetchImpl: typeof fetch = fetch,
): Promise<{ calendarUrl: string; events: PartifulEvent[] }> {
	const rawCalendarUrl = input.calendarUrl ?? process.env.PARTIFUL_CALENDAR_URL;
	if (!rawCalendarUrl) {
		throw new Error(
			"calendarUrl is required unless PARTIFUL_CALENDAR_URL is configured.",
		);
	}

	const calendarUrl = toFetchableCalendarUrl(rawCalendarUrl);
	const timeMin = input.timeMin ? new Date(input.timeMin) : new Date();
	assertValidDate(timeMin, "timeMin");

	const timeMax = input.timeMax
		? new Date(input.timeMax)
		: addDays(timeMin, DEFAULT_WINDOW_DAYS);
	assertValidDate(timeMax, "timeMax");

	if (timeMax <= timeMin) {
		throw new Error("timeMax must be after timeMin.");
	}

	const maxEvents = input.maxEvents ?? DEFAULT_LIMIT;
	if (!Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 500) {
		throw new Error("maxEvents must be an integer between 1 and 500.");
	}

	const response = await fetchImpl(calendarUrl, {
		headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1" },
	});
	if (!response.ok) {
		throw new Error(
			`Failed to fetch calendar: ${response.status} ${response.statusText}`,
		);
	}

	const ics = await response.text();
	const query = input.query?.trim().toLowerCase();
	const events = parseIcs(ics)
		.filter((event) => event.dtstart)
		.map(toPartifulEvent)
		.filter((event) => isWithinWindow(event, timeMin, timeMax))
		.filter((event) => !query || searchableText(event).includes(query))
		.sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
		.slice(0, maxEvents);

	return { calendarUrl, events };
}

export function toFetchableCalendarUrl(rawUrl: string): string {
	const trimmed = rawUrl.trim();
	if (!trimmed) {
		throw new Error("calendarUrl is required.");
	}

	const url = new URL(trimmed.replace(/^webcal:\/\//i, "https://"));
	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new Error("calendarUrl must be an http, https, or webcal URL.");
	}

	return url.toString();
}

export function parseIcs(input: string): IcsEvent[] {
	const lines = unfoldIcsLines(input);
	const events: IcsEvent[] = [];
	let current: IcsEvent | null = null;

	for (const line of lines) {
		const property = parseProperty(line);
		if (!property) {
			continue;
		}

		if (property.name === "BEGIN" && property.value === "VEVENT") {
			current = {};
			continue;
		}

		if (property.name === "END" && property.value === "VEVENT") {
			if (current) {
				events.push(current);
			}
			current = null;
			continue;
		}

		if (!current) {
			continue;
		}

		switch (property.name) {
			case "UID":
				current.uid = property.value;
				break;
			case "SUMMARY":
				current.summary = decodeIcsText(property.value);
				break;
			case "DESCRIPTION":
				current.description = decodeIcsText(property.value);
				break;
			case "LOCATION":
				current.location = decodeIcsText(property.value);
				break;
			case "URL":
				current.url = decodeIcsText(property.value);
				break;
			case "DTSTART":
				current.dtstart = parseIcsDate(property);
				break;
			case "DTEND":
				current.dtend = parseIcsDate(property);
				break;
		}
	}

	return events;
}

function toPartifulEvent(event: IcsEvent): PartifulEvent {
	if (!event.dtstart) {
		throw new Error("Cannot convert an event without DTSTART.");
	}

	const links = unique([
		...extractLinks(event.url, PARTIFUL_LINK_PATTERN),
		...extractLinks(event.description, PARTIFUL_LINK_PATTERN),
		...extractLinks(event.location, PARTIFUL_LINK_PATTERN),
		...extractLinks(event.url, ANY_LINK_PATTERN),
		...extractLinks(event.description, ANY_LINK_PATTERN),
	]);
	const url = links.find((link) => /partiful\.com/i.test(link)) ?? links[0] ?? null;

	return {
		id: event.uid ?? `${event.summary ?? "event"}-${event.dtstart.display}`,
		title: event.summary ?? "Untitled event",
		start: event.dtstart.display,
		end: event.dtend?.display ?? null,
		allDay: event.dtstart.allDay,
		timezone: event.dtstart.timezone,
		location: event.location ?? null,
		description: event.description ?? null,
		url,
		links,
	};
}

function unfoldIcsLines(input: string): string[] {
	const physicalLines = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
	const logicalLines: string[] = [];

	for (const line of physicalLines) {
		if (/^[ \t]/.test(line) && logicalLines.length > 0) {
			logicalLines[logicalLines.length - 1] += line.slice(1);
		} else {
			logicalLines.push(line);
		}
	}

	return logicalLines;
}

function parseProperty(line: string): IcsProperty | null {
	const separator = line.indexOf(":");
	if (separator === -1) {
		return null;
	}

	const rawName = line.slice(0, separator);
	const value = line.slice(separator + 1);
	const [name = "", ...rawParams] = rawName.split(";");
	const params: Record<string, string> = {};

	for (const rawParam of rawParams) {
		const [key, ...rest] = rawParam.split("=");
		if (!key || rest.length === 0) {
			continue;
		}
		params[key.toUpperCase()] = rest.join("=").replace(/^"|"$/g, "");
	}

	return { name: name.toUpperCase(), params, value };
}

function parseIcsDate(property: IcsProperty): IcsDate {
	const value = property.value;
	const timezone = property.params.TZID ?? null;

	if (property.params.VALUE === "DATE" || /^\d{8}$/.test(value)) {
		const year = Number(value.slice(0, 4));
		const month = Number(value.slice(4, 6));
		const day = Number(value.slice(6, 8));
		return {
			display: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
			date: new Date(Date.UTC(year, month - 1, day)),
			allDay: true,
			timezone,
		};
	}

	const match = value.match(
		/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/,
	);
	if (!match) {
		throw new Error(`Unsupported ICS date value: ${value}`);
	}

	const [, year, month, day, hour, minute, second, zulu] = match;
	const display = `${year}-${month}-${day}T${hour}:${minute}:${second}${
		zulu ? "Z" : ""
	}`;
	const date = zulu
		? new Date(display)
		: new Date(
				Number(year),
				Number(month) - 1,
				Number(day),
				Number(hour),
				Number(minute),
				Number(second),
			);

	return { display, date, allDay: false, timezone };
}

function decodeIcsText(value: string): string {
	return value
		.replace(/\\n/gi, "\n")
		.replace(/\\,/g, ",")
		.replace(/\\;/g, ";")
		.replace(/\\\\/g, "\\")
		.trim();
}

function extractLinks(
	text: string | null | undefined,
	pattern: RegExp,
): string[] {
	if (!text) {
		return [];
	}
	return [...text.matchAll(pattern)].map((match) =>
		match[0].replace(/[.,;!?]+$/g, ""),
	);
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}

function isWithinWindow(
	event: PartifulEvent,
	timeMin: Date,
	timeMax: Date,
): boolean {
	const start = new Date(event.start);
	return start >= timeMin && start < timeMax;
}

function searchableText(event: PartifulEvent): string {
	return [
		event.title,
		event.location,
		event.description,
		event.url,
		...event.links,
	]
		.filter(Boolean)
		.join("\n")
		.toLowerCase();
}

function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}

function assertValidDate(date: Date, name: string): void {
	if (Number.isNaN(date.getTime())) {
		throw new Error(`${name} must be a valid ISO date or datetime.`);
	}
}
