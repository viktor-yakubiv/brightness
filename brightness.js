#!/usr/bin/env bun
import { resolve } from 'path'
import { getPosition as calcSunPosition } from 'suncalc'

const weatherConditions = new Map([
	[1.0, 'Clear'],
	[0.8, 'Mostly clear'],
	[0.6, 'Partly cloudy'],
	[0.6, 'Haze'],
	[0.5, 'Fog'],
	[1.0, 'Windy'],
	[0.7, 'Breezy'],
	[0.5, 'Cloudy'],
	[0.4, 'Mostly cloudy'],
	[0.4, 'Rain'],
	[0.4, 'Thunderstorm'],
	[0.4, 'Heavy rain'],
	[0.5, 'Drizzle'],
	[0.5, 'Freezing drizzle'],
	[0.4, 'Snow'],
	[0.4, 'Heavy snow'],
	[0.4, 'Blizzard'],
	[0.4, 'Freezing rain'],
	[0.4, 'Sleet'],
	[0.4, 'Wintry mix'],
].map(entry => entry.reverse()))

const MIN_BRIGHTNESS = 0
const MAX_BRIGTNESS = 80

const position = Bun.argv[2].split(',').map(s => parseFloat(s))
const condition = Bun.argv[3]

// It was calculated by finding the yearly maximum altitude for my geo position
const altitudeMultiplier = 1.42 * 2

const clamp = (min, value, max) => Math.min(Math.max(min, value), max)
const scale = (value, min, max) => min + value * (max - min)
const round = Math.round

const brightness = (timeAndDate = new Date()) => {
	const { altitude } = calcSunPosition(timeAndDate, ...position)
	const shift = clamp(0, altitude * altitudeMultiplier / (Math.PI / 2), 1)

	const baseSolarValue = round(scale(shift, MIN_BRIGHTNESS, MAX_BRIGTNESS))

	const conditionCoefficient = weatherConditions.get(condition) ?? 1.0
	const cloudCorrectedValue = baseSolarValue * conditionCoefficient
	return cloudCorrectedValue
}


// Debug
// const timestamp = (timeStr) => {
// 	const [h, m = 0, s = 0] = timeStr.split(':')
// 	const date = new Date()
// 	date.setHours(h)
// 	date.setMinutes(m)
// 	date.setSeconds(s)
// 	date.setMilliseconds(0)
// 	return date.getTime()
// }
//
// for (let h = 0; h < 24; ++h) {
// 	for (let m = 0; m < 60; m += 5) {
// 		const time = [h, m.toString().padStart(2, '0')].join(':')
// 		const altitude = calcSunPosition(timestamp(time), ...position).altitude
// 		console.log(time, brightness(timestamp(time)), altitude)
// 	}
// }


// Not every display brightness can be read using `ddcctl -b '?'`,
// therefore we cache brightness value
const CACHE_FILE_PATH = '/var/tmp/com.yakubiv.brightness.cache'
const cacheFile = Bun.file(resolve(CACHE_FILE_PATH))

const currentBrighness = await cacheFile.exists()
	? parseInt(await cacheFile.text(), 10)
	: -1
const targetBrigtness = brightness(Date.now())
const tollerance = 3

if (isNaN(currentBrighness) || Math.abs(targetBrigtness - currentBrighness) > tollerance) {
	const ddcctl = Bun.spawn(['ddcctl', '-d', '1', '-b', targetBrigtness])
	await ddcctl.exited

	// Write cache only when brightness change was successful.
	// This prevents stale brightness when laptop is not connected to the display
	// but the process executes constantly failing.
	if (ddcctl.exitCode === 0) {
		Bun.write(cacheFile, targetBrigtness.toString())
	}
}
