import { useEffect, useMemo, useState } from 'react';
import { Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, PublicSans_400Regular, PublicSans_600SemiBold } from '@expo-google-fonts/public-sans';
import NetInfo, { useNetInfo } from '@react-native-community/netinfo';
import * as Battery from 'expo-battery';
import { BatteryState } from 'expo-battery';
import { EventSubscription } from 'expo-modules-core';
import Svg, { Path } from 'react-native-svg';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';

// Type definitions for Open Meteo API response
interface HourlyWeather {
  time: string[];
  temperature_2m: number[];
  weathercode: number[];
  precipitation_probability: number[];
}

interface DailyWeather {
  time: string[];
  weathercode: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
}

interface WeatherApiResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    weathercode: number;
    precipitation_probability: number;
  };
  hourly: HourlyWeather;
  daily: DailyWeather;
}

// Default location (can be made user-specified later)
const DEFAULT_LOCATION = {
  latitude: 37.8044,
  longitude: -122.2711,
  name: 'Oakland, CA'
};

// Weather icon mapping function based on WMO Weather interpretation codes
const getWeatherIcon = (code: number): keyof typeof Ionicons.glyphMap => {
  switch (code) {
    case 0: return 'sunny-outline'; // Clear sky
    case 1: return 'partly-sunny-outline'; // Mainly clear
    case 2: return 'partly-sunny-outline'; // Partly cloudy
    case 3: return 'cloudy-outline'; // Overcast
    case 45: return 'cloudy-outline'; // Fog
    case 48: return 'cloudy-outline'; // Depositing rime fog
    case 51: return 'rainy-outline'; // Light drizzle
    case 53: return 'rainy-outline'; // Moderate drizzle
    case 55: return 'rainy-outline'; // Dense drizzle
    case 56: return 'rainy-outline'; // Light freezing drizzle
    case 57: return 'rainy-outline'; // Dense freezing drizzle
    case 61: return 'rainy-outline'; // Slight rain
    case 63: return 'rainy-outline'; // Moderate rain
    case 65: return 'rainy-outline'; // Heavy rain
    case 66: return 'rainy-outline'; // Light freezing rain
    case 67: return 'rainy-outline'; // Heavy freezing rain
    case 71: return 'snow-outline'; // Slight snow fall
    case 73: return 'snow-outline'; // Moderate snow fall
    case 75: return 'snow-outline'; // Heavy snow fall
    case 77: return 'snow-outline'; // Snow grains
    case 80: return 'rainy-outline'; // Slight rain showers
    case 81: return 'rainy-outline'; // Moderate rain showers
    case 82: return 'rainy-outline'; // Violent rain showers
    case 85: return 'snow-outline'; // Slight snow showers
    case 86: return 'snow-outline'; // Heavy snow showers
    case 95: return 'thunderstorm-outline'; // Thunderstorm
    case 96: return 'thunderstorm-outline'; // Thunderstorm with slight hail
    case 99: return 'thunderstorm-outline'; // Thunderstorm with heavy hail
    default: return 'cloudy-outline'; // Default to cloudy
  }
};

function getTime(date: Date): { hours: number, minutes: number, ampm: number } {
  // Convert to 12-hour format
	const hours24 = date.getHours();
	const hours:number = hours24 % 12 || 12;
	const minutes:number = date.getMinutes() < 10 ? 0 + date.getMinutes() : date.getMinutes();
  const ampm = hours24 >= 12 ? 1 : 0;

	return {
    hours,
    minutes,
    ampm
  };
}

function formatDate(date: Date): string {
	const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	const dayName = dayNames[date.getDay()];
	const monthName = monthNames[date.getMonth()];
	const day = date.getDate();
	return `${dayName}, ${monthName} ${day}`;
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
	const [fontsLoaded] = useFonts({ PublicSans_400Regular, PublicSans_600SemiBold });
	const [now, setNow] = useState<Date>(new Date());
	const netInfo = useNetInfo();
	const [power, setPower] = useState<Battery.PowerState | null>(null);
	const [weather, setWeather] = useState<WeatherApiResponse | null>(null);
	const [weatherLoading, setWeatherLoading] = useState(true);
	const [weatherError, setWeatherError] = useState<string | null>(null);

	useEffect(() => {
		if (fontsLoaded) {
			SplashScreen.hideAsync();
		}
	}, [fontsLoaded]);

	// Initialize battery state and set up listeners
	useEffect(() => {
		let batteryLevelListener: EventSubscription | null = null;
		let batteryStateListener: EventSubscription | null = null;

		async function initBattery() {
			try {
				const initialState = await Battery.getPowerStateAsync();
				setPower(initialState);

				// Listen for battery level changes
				batteryLevelListener = Battery.addBatteryLevelListener(async () => {
					const state = await Battery.getPowerStateAsync();
					setPower(state);
				});

				// Listen for battery state changes (charging/unplugged)
				batteryStateListener = Battery.addBatteryStateListener(async () => {
					const state = await Battery.getPowerStateAsync();
					setPower(state);
				});
			} catch (error) {
				console.error('Error initializing battery:', error);
			}
		}

		initBattery();

		return () => {
			batteryLevelListener?.remove();
			batteryStateListener?.remove();
		};
	}, []);

	useEffect(() => {
		const intervalId = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(intervalId);
	}, []);

	// Fetch weather data
	useEffect(() => {
		const fetchWeather = async () => {
			setWeatherError(null);
			try {
				const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${DEFAULT_LOCATION.latitude}&longitude=${DEFAULT_LOCATION.longitude}&current=temperature_2m,apparent_temperature,weathercode,precipitation_probability&hourly=temperature_2m,weathercode,precipitation_probability&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch&timezone=auto`;
				
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 10000);
				
				const response = await fetch(apiUrl, { signal: controller.signal });
				clearTimeout(timeoutId);
				
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				
				const data = await response.json() as WeatherApiResponse;
				setWeather(data);
			} catch (error) {
				console.error('Error fetching weather:', error);
				if (error instanceof Error) {
					console.error('Error details:', error.message);
					setWeatherError(error.message);
				}
			} finally {
				setWeatherLoading(false);
			}
		};
		
		fetchWeather();
		
		// Refresh every 15 minutes
		const intervalId = setInterval(fetchWeather, 15 * 60 * 1000);
		return () => clearInterval(intervalId);
	}, []);

	const timeText = useMemo(() => getTime(now), [now]);
	const dateText = useMemo(() => formatDate(now), [now]);

	if (!fontsLoaded) {
		return null;
	}

	return (
		<SafeAreaProvider>
			<SafeAreaView style={styles.safeArea} edges={['top','bottom']}>
				<StatusBar hidden />
				{/* Status header */}
				<View style={styles.statusHeader}>
					<NetworkIndicator net={netInfo} color={'#ffffff'} />
					<View style={styles.statusRight}>
						<BatteryIcon level={power?.batteryLevel ?? -1} charging={power?.batteryState === BatteryState.CHARGING} />
						<Text style={styles.statusText}>{formatBatteryPercent(power)}</Text>
					</View>
				</View>
				<View style={styles.container}>
					<View style={styles.spacerTop} />
					<View style={styles.timeRow}>
						<Text style={styles.time}>{timeText.hours}:{String(timeText.minutes).padStart(2,'0')}</Text>
						<Text style={[styles.ampm, { marginLeft: 8 }]}>{timeText.ampm ? 'PM' : 'AM'}</Text>
					</View>
					<Text style={styles.date}>{dateText}</Text>
					<View style={styles.spacerMiddle} />
					{!weatherLoading && weather && <WeatherSummary weather={weather} />}
					<View style={styles.spacerBottom} />
				</View>
			</SafeAreaView>
		</SafeAreaProvider>
	);
}

function formatNetInfo(netInfo: ReturnType<typeof useNetInfo>): string {
	const type = netInfo?.type ?? 'unknown';
	const connected = netInfo?.isConnected;
	if (connected === false) return 'Offline';
	if (connected === true) return `${type}`;
	return 'Checking…';
}

function NetworkIndicator({ net, color }: { net: ReturnType<typeof useNetInfo>; color: string }) {
	const type = net?.type;
	const connected = net?.isConnected === true && net?.isInternetReachable !== false;

	// Derive Wi‑Fi level (0-3)
	const wifiStrength = (net?.details as any)?.strength as number | undefined; // 0-100 when available
	const wifiLevel = wifiStrength != null ? Math.max(0, Math.min(3, Math.round(wifiStrength / 34))) : 0;

	// Derive Cellular level (0-4) from signal strength if available
	const cellStrength = (net?.details as any)?.signalStrength as number | undefined;
	let cellLevel = 0;
	if (cellStrength != null) {
		// Signal strength can be in dBm (typically -140 to -44) or percentage (0-100)
		if (cellStrength >= 0 && cellStrength <= 100) {
			// Percentage format (0-100)
			cellLevel = Math.max(0, Math.min(4, Math.round((cellStrength / 100) * 4)));
		} else if (cellStrength >= -140 && cellStrength <= -44) {
			// dBm format: map -140 to -44 dBm to 0-4 bars
			// -44 dBm (excellent) = 4 bars, -140 dBm (very poor) = 0 bars
			const normalized = (cellStrength + 140) / (-44 + 140); // 0 to 1
			cellLevel = Math.max(0, Math.min(4, Math.round(normalized * 4)));
		} else {
			// Unknown format, assume moderate signal
			cellLevel = 2;
		}
	}

	const wifiActive = connected && type === 'wifi';
	const cellActive = connected && type !== 'wifi' && type !== 'unknown' && type !== 'none';

	return (
		<View style={[styles.netRow, { paddingVertical: 4 }]}>
      			{/* Cellular bars */}
			<View style={styles.netRow}>
				{Array.from({ length: 4 }).map((_, i) => {
					const h = 4 + i * 3;
					const on = i < cellLevel;
					return <View key={i} style={[styles.netCellBar, { height: h, opacity: cellActive ? (on ? 1 : 0.45) : 0.45, backgroundColor: color }]} />;
				})}
			</View>

			<View style={{ width: 8 }} />

			{/* Wi‑Fi SVG icon */}
			<WifiIcon
				outerColor={color}
				midColor={color}
				dotColor={color}
				outerOpacity={wifiActive ? (wifiLevel >= 3 ? 1 : 0.45) : 0.45}
				midOpacity={wifiActive ? (wifiLevel >= 2 ? 1 : 0.45) : 0.45}
				dotOpacity={wifiActive ? (wifiLevel >= 1 ? 1 : 0.45) : 0.45}
			/>
		</View>
	);
}

function WifiIcon({
    outerColor,
    midColor,
    dotColor,
    outerOpacity = 1,
    midOpacity = 1,
    dotOpacity = 1,
}: {
    outerColor: string;
    midColor: string;
    dotColor: string;
    outerOpacity?: number;
    midOpacity?: number;
    dotOpacity?: number;
}) {
    return (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M0 0h24v24H0z" fill="none" />
            {/* Outer arc */}
            <Path
                d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9z"
                fill={outerColor}
                opacity={outerOpacity}
            />
            {/* Middle arc */}
            <Path
                d="M5 13l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"
                fill={midColor}
                opacity={midOpacity}
            />
            {/* Center shape */}
            <Path
                d="M9 17l3 3 3-3c-1.65-1.66-4.34-1.66-6 0z"
                fill={dotColor}
                opacity={dotOpacity}
            />
        </Svg>
    );
}

function formatBatteryPercent(power: Battery.PowerState | null): string {
	if (!power || power.batteryLevel == null || power.batteryLevel < 0) return '—%';
	return `${Math.round(power.batteryLevel * 100)}%`;
}

function BatteryIcon({ level, charging }: { level: number; charging: boolean }) {
	const clamped = level != null && level >= 0 ? Math.max(0, Math.min(1, level)) : -1;
	const pct = clamped >= 0 ? Math.round(clamped * 100) : -1;
	// Battery body inner width: bodyWidth(24) - borders(2) - padding(2) = 20
	const innerPx = 20;
	const fillPx = clamped >= 0 ? Math.round(innerPx * clamped) : 0;
	const fillColor = '#ffffff';
	return (
		<View style={styles.batteryRow}>
			<View style={styles.batteryBody}>
				<View style={[styles.batteryFill, { width: fillPx, backgroundColor: fillColor }]} />
			</View>
			<View style={styles.batteryCap} />
		</View>
	);
}

function ClosedUmbrellaIcon({ color }: { color: string }) {
	return (
		<Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
			<Path 
				d="M12 2C12.4 2 12.8 2.2 12.9 2.6L17.5 15H13V19C13 20.7 11.7 22 10 22S7 20.7 7 19V18H9V19C9 19.6 9.4 20 10 20C10.6 20 11 19.6 11 19V15H6.5L11.1 2.6C11.2 2.2 11.6 2 12 2M12 5.9L9.4 13H14.7L12 5.9Z" 
				fill={color}
			/>
		</Svg>
	);
}

function TemperatureTrendArrow({ isRising }: { isRising: boolean }) {
	return (
		<Text style={styles.weatherTrendArrow}>{isRising ? '⇡' : '⇣'}</Text>
	);
}

function WeatherSummary({ weather }: { weather: WeatherApiResponse }) {
	const currentTemp = Math.round(weather.current.temperature_2m);
	const todayLow = Math.round(weather.daily.temperature_2m_min[0]);
	const todayHigh = Math.round(weather.daily.temperature_2m_max[0]);
	const weatherIcon = getWeatherIcon(weather.current.weathercode);
	
	// Determine temperature trend by comparing current temp with next hour's temp
	const currentTime = weather.current.time;
	const currentIndex = weather.hourly.time.findIndex(t => t === currentTime);
	const nextHourIndex = currentIndex !== -1 ? currentIndex + 1 : -1;
	const isRising = nextHourIndex !== -1 && weather.hourly.temperature_2m[nextHourIndex] > weather.current.temperature_2m;
	
	// Calculate max precipitation probability for the rest of today
	const restOfDayProbs = weather.hourly.precipitation_probability.slice(nextHourIndex);
	const maxPrecipitation = restOfDayProbs.length > 0 ? Math.max(...restOfDayProbs) : weather.current.precipitation_probability;
	
	return (
		<View style={styles.weatherContainer}>
			<View style={styles.weatherMainRow}>
				<View style={styles.weatherIcon}>
					<Ionicons name={weatherIcon} size={22} color="#ffffff" />
				</View>
				<Text style={styles.weatherTemp}>{currentTemp}°</Text>
				<TemperatureTrendArrow isRising={isRising} />
				<View style={styles.weatherPrecipSection}>
					{maxPrecipitation < 3 ? (
						<>
							<ClosedUmbrellaIcon color="#9aa0a6" />
							<Text style={[styles.weatherPrecip, styles.weatherPrecipClosedIcon]}> {maxPrecipitation}%</Text>
						</>
					) : (
						<>
							<Ionicons 
								name={maxPrecipitation >= 20 ? "umbrella" : "umbrella-outline"} 
								size={18} 
								color={maxPrecipitation >= 20 ? "#ffffff" : "#9aa0a6"} 
							/>
							<Text style={[styles.weatherPrecip, maxPrecipitation >= 20 && styles.weatherPrecipWhite]}> {maxPrecipitation}%</Text>
						</>
					)}
				</View>
			</View>
			<View style={styles.weatherRow}>
				<Text style={styles.weatherText}>{todayLow}° / {todayHigh}°</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: '#0a0a0a',
	},
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'flex-start',
		backgroundColor: '#0a0a0a',
		paddingHorizontal: 16,
	},
	statusHeader: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		flexDirection: 'row',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingTop: 8,
		paddingBottom: 4,
		zIndex: 10,
	},
	statusRight: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	statusText: {
		fontFamily: 'PublicSans_400Regular',
		fontSize: 12,
		color: '#ffffff',
	},
	netRow: {
		flexDirection: 'row',
		alignItems: 'flex-end',
		gap: 2,
		paddingVertical: 4,
		paddingLeft: 2,
	},
	netCellBar: {
		width: 3,
		backgroundColor: '#ffffff',
		borderRadius: 1,
	},
	netWifi: {
		flexDirection: 'column',
		alignItems: 'flex-start',
		paddingVertical: 2,
		paddingLeft: 2,
	},
	netWifiWave: {
		height: 2,
		width: 10,
		backgroundColor: '#ffffff',
		borderRadius: 2,
		marginVertical: 1,
	},
	batteryRow: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	batteryBody: {
		width: 24,
		height: 12,
		borderWidth: 1,
		borderColor: '#ffffff',
		borderRadius: 2,
		padding: 1,
		justifyContent: 'center',
	},
	batteryFill: {
		height: '100%',
		borderRadius: 1,
	},
	batteryCap: {
		width: 2,
		height: 6,
		marginLeft: 2,
		borderTopRightRadius: 1,
		borderBottomRightRadius: 1,
		backgroundColor: '#ffffff',
	},
	spacerTop: {
		flex: 1,
	},
	spacerMiddle: {
		flex: 1,
	},
	spacerBottom: {
		flex: 1,
	},
	timeRow: {
		flexDirection: 'row',
		alignItems: 'baseline',
	},
	time: {
		fontFamily: 'PublicSans_200',
		fontSize: Platform.select({ ios: 80, android: 80, default: 96 }),
		lineHeight: Platform.select({ ios: 80, android: 80, default: 104 }),
		color: '#ffffff',
		letterSpacing: 1,
	},
	ampm: {
		fontFamily: 'PublicSans_200',
		fontSize: Platform.select({ ios: 40, android: 40, default: 40 }),
		lineHeight: Platform.select({ ios: 40, android: 40, default: 40 }),
		color: '#ffffff',
		letterSpacing: 1,
	},
	date: {
		fontFamily: 'PublicSans_400Regular',
		fontSize: 20,
		color: '#9aa0a6',
		marginTop: 12,
	},
	weatherContainer: {
		marginTop: 24,
		alignItems: 'center',
	},
	weatherMainRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 0,
	},
	weatherIcon: {
		marginRight: 4,
	},
	weatherTemp: {
		fontFamily: 'PublicSans_600SemiBold',
		fontSize: 20,
		color: '#ffffff',
		marginRight: 2,
	},
	weatherTrendArrow: {
		fontFamily: 'PublicSans_600SemiBold',
		fontSize: 20,
		color: '#9aa0a6',
	},
	weatherRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 0,
		marginTop: 4,
	},
	weatherPrecipSection: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 0,
		marginLeft: 16,
	},
	weatherText: {
		fontFamily: 'PublicSans_400Regular',
		fontSize: 20,
		color: '#9aa0a6',
		display: 'none'
	},
	weatherPrecip: {
		fontFamily: 'PublicSans_400Regular',
		fontSize: 20,
		color: '#9aa0a6',
	},
	weatherPrecipWhite: {
		color: '#ffffff',
	},
	weatherPrecipClosedIcon: {
		marginLeft: -2,
		marginBottom: 2,
	},
});

 
