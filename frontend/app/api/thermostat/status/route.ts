import { getAuth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  fetchConvexState,
  listConvexUserDevices,
  getWeatherBySerial,
} from '@/lib/server/convex';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8081';

type StateResponse = {
  devices: string[];
  deviceState: Record<string, Record<string, any>>;
};

// Weather cache with 30 minute TTL
const weatherCache = new Map<string, { data: any; timestamp: number }>();
const WEATHER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function emptyState(): StateResponse {
  return { devices: [], deviceState: {} };
}

function sanitizeSerial(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return /^[A-Za-z0-9]+$/.test(trimmed) ? trimmed : undefined;
}

function filterStateBySerials(data: any, serials: string[]): StateResponse {
  if (!data) return emptyState();
  if (!Array.isArray(serials) || serials.length === 0) {
    return emptyState();
  }

  const filteredState: Record<string, Record<string, any>> = {};
  const filteredDevices: string[] = [];

  const allowedPrefixes = ['user.', 'device.', 'shared.', 'schedule.', 'structure.'];

  for (const serial of serials) {
    if (data.deviceState && data.deviceState[serial]) {
      const serialState: Record<string, any> = {};

      for (const [key, value] of Object.entries(data.deviceState[serial])) {
        if (allowedPrefixes.some(prefix => key.startsWith(prefix))) {
          serialState[key] = value;
        }
      }

      if (Object.keys(serialState).length > 0) {
        filteredState[serial] = serialState;
        filteredDevices.push(serial);
      }
    }
  }

  return {
    devices: filteredDevices,
    deviceState: filteredState,
  };
}

async function fetchBackendState(serials: string[]): Promise<StateResponse> {
  if (serials.length === 0) return emptyState();

  const lookup = serials.length === 1 ? `?serial=${encodeURIComponent(serials[0])}` : '';

  const response = await fetch(`${BACKEND_URL}/status${lookup}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }

  const data = await response.json();
  return filterStateBySerials(data, serials);
}

async function injectWeatherData(stateResponse: StateResponse): Promise<StateResponse> {
  for (const serial of stateResponse.devices) {
    try {
      const now = Date.now();
      const cached = weatherCache.get(serial);

      let weatherData;
      if (cached && cached.data?.fetchedAt && (now - cached.data.fetchedAt) < WEATHER_CACHE_TTL) {
        weatherData = cached.data;
      } else {
        weatherData = await getWeatherBySerial(serial);
        if (weatherData?.fetchedAt) {
          weatherCache.set(serial, { data: weatherData, timestamp: weatherData.fetchedAt });
        }
      }

      if (weatherData?.data) {
        const postalCode = weatherData.postalCode || '';
        const country = weatherData.country || '';

        const possibleKeys = [
          `${postalCode},${country}`,
          postalCode,
          `${postalCode}, ${country}`,
        ];

        let locationWeather = null;
        for (const key of possibleKeys) {
          if (weatherData.data[key]) {
            locationWeather = weatherData.data[key];
            break;
          }
        }

        if (locationWeather?.current) {
          if (!stateResponse.deviceState[serial]) {
            stateResponse.deviceState[serial] = {};
          }

          const weatherStateKey = `weather.${serial}`;
          stateResponse.deviceState[serial][weatherStateKey] = {
            object_revision: 0,
            object_timestamp: weatherData.fetchedAt || Date.now(),
            value: {
              current: {
                temperature: locationWeather.current.temp_c,
                temp_c: locationWeather.current.temp_c,
                temp_f: locationWeather.current.temp_f,
              }
            }
          };
        }
      }
    } catch (error) {
      console.error(`[API] Failed to fetch weather for ${serial}:`, error);
    }
  }

  return stateResponse;
}

export async function GET(request: NextRequest) {
  const serializedParam = sanitizeSerial(request.nextUrl.searchParams.get('serial'));

  try {
    const { userId } = getAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch device state from Convex (includes owned + shared devices + state)
    const convexData = await fetchConvexState(userId);

    if (!convexData || !convexData.devices || convexData.devices.length === 0) {
      // Fallback to backend if Convex has no data
      const ownedDevices = await listConvexUserDevices(userId);
      const serials = ownedDevices
        .map((record) => record?.serial)
        .filter((serial): serial is string => Boolean(serial));

      if (serials.length === 0) {
        return NextResponse.json(emptyState());
      }

      const fallback = await fetchBackendState(serials);
      const fallbackWithWeather = await injectWeatherData(fallback);
      return NextResponse.json(fallbackWithWeather);
    }

    // If specific serial requested, filter for it
    let serials = convexData.devices;
    if (serializedParam) {
      serials = serials.filter((serial: string) => serial === serializedParam);
      if (serials.length === 0) {
        return NextResponse.json(emptyState(), { status: 403 });
      }
    }

    const filteredData = filterStateBySerials(convexData, serials);
    const withWeather = await injectWeatherData(filteredData);
    return NextResponse.json(withWeather);
  } catch (error) {
    console.error('[API] Failed to fetch status:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch thermostat status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
