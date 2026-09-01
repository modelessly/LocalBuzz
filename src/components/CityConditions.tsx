import { useEffect, useMemo, useState } from "react";
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Clock3, Sun } from "lucide-react";
import { openMeteoUrl, weatherPresentation, type WeatherPresentation } from "../lib/weather";

type CityConditionsProps = {
  cityName: string;
  center: [number, number];
  locale: string;
  timeZone: string;
  temperatureUnit: "celsius" | "fahrenheit";
};

type CurrentWeather = {
  temperature: number;
  unit: string;
  presentation: WeatherPresentation;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
  };
  current_units?: {
    temperature_2m?: string;
  };
};

const weatherIcons = {
  sun: Sun,
  cloud: Cloud,
  fog: CloudFog,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

export function CityConditions({
  cityName,
  center,
  locale,
  timeZone,
  temperatureUnit,
}: CityConditionsProps) {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<CurrentWeather>();
  const [weatherStatus, setWeatherStatus] = useState<"loading" | "ready" | "error">("loading");

  const localTime = useMemo(
    () => new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
    }).format(now),
    [locale, now, timeZone],
  );

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, [timeZone]);

  useEffect(() => {
    const controller = new AbortController();
    const loadWeather = async () => {
      setWeatherStatus("loading");
      try {
        const response = await fetch(openMeteoUrl(center, timeZone, temperatureUnit), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
        const data = await response.json() as OpenMeteoResponse;
        const temperature = data.current?.temperature_2m;
        const code = data.current?.weather_code;
        if (typeof temperature !== "number" || typeof code !== "number") {
          throw new Error("Weather response was incomplete");
        }
        setWeather({
          temperature: Math.round(temperature),
          unit: data.current_units?.temperature_2m ?? (temperatureUnit === "fahrenheit" ? "°F" : "°C"),
          presentation: weatherPresentation(code, data.current?.is_day !== 0),
        });
        setWeatherStatus("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setWeather(undefined);
          setWeatherStatus("error");
        }
      }
    };

    void loadWeather();
    const interval = window.setInterval(loadWeather, 15 * 60_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [center, temperatureUnit, timeZone]);

  const WeatherIcon = weather ? weatherIcons[weather.presentation.icon] : Cloud;

  return (
    <div className="city-conditions" aria-label={`Current conditions in ${cityName}`}>
      <span className="city-conditions__time" title={`${cityName} local time`}>
        <Clock3 aria-hidden="true" size={15} />
        <time>{localTime}</time>
      </span>
      <a
        className={`city-conditions__weather is-${weatherStatus}`}
        href="https://open-meteo.com/"
        target="_blank"
        rel="noreferrer"
        title="Weather data by Open-Meteo"
        aria-label={weather ? `${weather.temperature}${weather.unit}, ${weather.presentation.label}. Weather data by Open-Meteo` : "Weather data by Open-Meteo"}
      >
        <WeatherIcon aria-hidden="true" size={16} />
        {weatherStatus === "ready" && weather ? (
          <span><strong>{weather.temperature}{weather.unit}</strong> {weather.presentation.label}</span>
        ) : weatherStatus === "error" ? (
          <span>Weather unavailable</span>
        ) : (
          <span>Weather…</span>
        )}
        <small>Open-Meteo</small>
      </a>
    </div>
  );
}
