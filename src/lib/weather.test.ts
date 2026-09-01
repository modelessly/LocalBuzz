import { describe, expect, it } from "vitest";
import { openMeteoUrl, weatherPresentation } from "./weather";

describe("city weather presentation", () => {
  it("turns WMO weather codes into concise consumer labels", () => {
    expect(weatherPresentation(0, true)).toEqual({ label: "Sunny", icon: "sun" });
    expect(weatherPresentation(3, true)).toEqual({ label: "Cloudy", icon: "cloud" });
    expect(weatherPresentation(63, true)).toEqual({ label: "Rainy", icon: "rain" });
    expect(weatherPresentation(95, false)).toEqual({ label: "Thunderstorms", icon: "storm" });
  });

  it("builds a city-local current-conditions request", () => {
    const url = new URL(openMeteoUrl([18.071, 59.325], "Europe/Stockholm", "celsius"));
    expect(url.origin).toBe("https://api.open-meteo.com");
    expect(url.searchParams.get("latitude")).toBe("59.325");
    expect(url.searchParams.get("longitude")).toBe("18.071");
    expect(url.searchParams.get("current")).toBe("temperature_2m,weather_code,is_day");
    expect(url.searchParams.get("timezone")).toBe("Europe/Stockholm");
  });
});
