export type WeatherPresentation = {
  label: string;
  icon: "sun" | "cloud" | "fog" | "rain" | "snow" | "storm";
};

export function weatherPresentation(code: number, isDay: boolean): WeatherPresentation {
  if (code === 0) return { label: isDay ? "Sunny" : "Clear", icon: "sun" };
  if (code === 1) return { label: isDay ? "Mostly sunny" : "Mostly clear", icon: "sun" };
  if (code === 2) return { label: "Partly cloudy", icon: "cloud" };
  if (code === 3) return { label: "Cloudy", icon: "cloud" };
  if (code === 45 || code === 48) return { label: "Foggy", icon: "fog" };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return { label: code <= 57 ? "Drizzly" : code >= 80 ? "Rain showers" : "Rainy", icon: "rain" };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { label: code >= 85 ? "Snow showers" : "Snowy", icon: "snow" };
  }
  if (code >= 95) return { label: "Thunderstorms", icon: "storm" };
  return { label: "Mixed conditions", icon: "cloud" };
}

export function openMeteoUrl(
  center: [number, number],
  timeZone: string,
  temperatureUnit: "celsius" | "fahrenheit",
) {
  const [longitude, latitude] = center;
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,weather_code,is_day",
    temperature_unit: temperatureUnit,
    timezone: timeZone,
    forecast_days: "1",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}
