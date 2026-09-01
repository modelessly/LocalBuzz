import { refreshCityEvents } from "../server/ingestion/refresh";
import type { CityId } from "../src/domain/types";

const city = process.argv[2] as CityId | undefined;
if (city !== "stockholm" && city !== "san-francisco") {
  console.error("Usage: npm run events:refresh -- stockholm|san-francisco");
  process.exitCode = 1;
} else {
  const snapshot = await refreshCityEvents({ cityId: city, ticketmasterApiKey: process.env.TICKETMASTER_API_KEY });
  console.log(JSON.stringify(snapshot, null, 2));
  if (!snapshot.happenings.length) process.exitCode = 2;
}
