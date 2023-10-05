#!/usr/bin/env bun
import { resolve } from 'path'
import { getPosition as calcSunPosition } from 'suncalc'

const MIN_BRIGHTNESS = 10
const MAX_BRIGTNESS = 85

const position = Bun.argv[2].split(',').map(s => parseFloat(s))

// It was calculated by finding the yearly maximum altitude for my geo position
const altitudeMultiplier = 1.42 * 2

const clamp = (min, value, max) => Math.min(Math.max(min, value), max)

const brightness = (timeAndDate = new Date()) => {
	const { altitude } = calcSunPosition(timeAndDate, ...position)
	const shift = clamp(0, altitude * altitudeMultiplier / (Math.PI / 2), 1)
	return MIN_BRIGHTNESS + Math.round(shift * (MAX_BRIGTNESS - MIN_BRIGHTNESS))
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

	Bun.write(cacheFile, targetBrigtness.toString())
}
