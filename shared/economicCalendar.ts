export type EconomicImportance = "high" | "medium";

export type OfficialEconomicEvent = {
  id: string;
  title: string;
  country: "United States";
  startsAt: string;
  source: "BLS" | "Federal Reserve";
  sourceUrl: string;
  importance: EconomicImportance;
  timeKnown: boolean;
};

const HIGH_IMPACT_BLS = /employment situation|consumer price index|producer price index|job openings|employment cost index/i;
const MONTHS: Record<string, number> = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };

function unescapeIcs(value: string) { return value.replace(/\\,/g, ",").replace(/\\n/gi, " ").replace(/\\\\/g, "\\"); }

/** يحول وقتًا محليًا في منطقة محددة إلى UTC باستخدام قواعد التوقيت الفعلية في المحرك. */
export function zonedDateTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const offsetLabel = formatter.formatToParts(new Date(guess)).find(part => part.type === "timeZoneName")?.value ?? "GMT";
  const offset = offsetLabel.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!offset) return guess;
  const minutes = Number(offset[2]) * 60 + Number(offset[3]);
  return guess - (offset[1] === "+" ? minutes : -minutes) * 60_000;
}

export function parseBlsIcs(ics: string): OfficialEconomicEvent[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  return unfolded.split("BEGIN:VEVENT").slice(1).flatMap(block => {
    const uid = block.match(/(?:^|\n)UID:([^\r\n]+)/)?.[1]?.trim();
    const summary = block.match(/(?:^|\n)SUMMARY:([^\r\n]+)/)?.[1]?.trim();
    const start = block.match(/(?:^|\n)DTSTART(?:;TZID=US-Eastern)?:([0-9]{8}T[0-9]{6})/)?.[1];
    if (!uid || !summary || !start) return [];
    const match = start.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
    if (!match) return [];
    const startsAt = new Date(zonedDateTimeToUtc(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]), Number(match[5]), "America/New_York")).toISOString();
    return [{ id: `bls:${uid}`, title: unescapeIcs(summary), country: "United States", startsAt, source: "BLS", sourceUrl: "https://www.bls.gov/schedule/news_release/bls.ics", importance: HIGH_IMPACT_BLS.test(summary) ? "high" : "medium", timeKnown: true }];
  });
}

export function parseFomcMeetings(html: string): OfficialEconomicEvent[] {
  const yearMatch = html.match(/id="[^"]+">\s*(20\d{2}) FOMC Meetings/i);
  if (!yearMatch) return [];
  const year = Number(yearMatch[1]);
  const section = html.slice(yearMatch.index, html.indexOf("2025 FOMC Meetings", yearMatch.index));
  const events: OfficialEconomicEvent[] = [];
  const matcher = /<strong>(January|February|March|April|May|June|July|August|September|October|November|December)<\/strong>[\s\S]{0,500}?>(\d{1,2})-(\d{1,2})\*?</g;
  for (const match of Array.from(section.matchAll(matcher))) {
    const month = MONTHS[match[1]];
    const date = new Date(Date.UTC(year, month, Number(match[3]), 12));
    events.push({ id: `fomc:${year}-${String(month + 1).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`, title: "اجتماع اللجنة الفيدرالية للسوق المفتوحة (FOMC)", country: "United States", startsAt: date.toISOString(), source: "Federal Reserve", sourceUrl: "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", importance: "high", timeKnown: false });
  }
  return events;
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; AMIC-Market-Calendar/1.0; +https://amic.duckdns.org)" }, signal: controller.signal });
    if (!response.ok) throw new Error(`المصدر الرسمي أعاد HTTP ${response.status}`);
    return response.text();
  } finally { clearTimeout(timeout); }
}

export async function fetchOfficialEconomicCalendar(now = new Date()) {
  const [bls, fomc] = await Promise.allSettled([
    fetchText("https://www.bls.gov/schedule/news_release/bls.ics").then(parseBlsIcs),
    fetchText("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm").then(parseFomcMeetings),
  ]);
  const events = [...(bls.status === "fulfilled" ? bls.value : []), ...(fomc.status === "fulfilled" ? fomc.value : [])]
    .filter(event => new Date(event.startsAt).getTime() >= now.getTime() - 60 * 60_000)
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  if (!events.length && bls.status === "rejected" && fomc.status === "rejected") throw new Error("تعذّر الوصول إلى مصادر التقويم الرسمية.");
  return { events, fetchedAt: new Date().toISOString(), coverage: "إصدارات BLS واجتماعات FOMC الرسمية في الولايات المتحدة" };
}
