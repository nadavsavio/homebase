import { useEffect, useMemo, useState } from 'react';
import { Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts, PublicSans_400Regular, PublicSans_600SemiBold } from '@expo-google-fonts/public-sans';
import NetInfo, { useNetInfo } from '@react-native-community/netinfo';
import { usePowerState, BatteryState } from 'expo-battery';
import Svg, { Path } from 'react-native-svg';

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

export default function App() {
	const [fontsLoaded] = useFonts({ PublicSans_400Regular, PublicSans_600SemiBold });
	const [now, setNow] = useState<Date>(new Date());
	const netInfo = useNetInfo();
	const power = usePowerState();

	useEffect(() => {
		const intervalId = setInterval(() => setNow(new Date()), 1000);
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

	// Derive Cellular level (0-4) from generation if available
	const gen = (net?.details as any)?.cellularGeneration as string | undefined; // '2g'|'3g'|'4g'|'5g'
	let cellLevel = 0;
	if (gen === '2g') cellLevel = 1; else if (gen === '3g') cellLevel = 2; else if (gen === '4g') cellLevel = 3; else if (gen === '5g') cellLevel = 4;

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

function formatBatteryPercent(power: ReturnType<typeof usePowerState>): string {
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
	spacerBottom: {
		flex: 2,
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
		fontSize: 18,
		color: '#9aa0a6',
		marginTop: 12,
	},
});

 
