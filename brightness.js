#!/usr/bin/env bun
import { resolve } from 'path'
import SunCalc from 'suncalc'

const GEO_POSITION = Bun.argv[2].split(',').map(s => parseFloat(s))
const MIN_BRIGHTNESS = 10
const MAX_BRIGTNESS = 65

const solarTimes = SunCalc.getTimes(new Date(), ...GEO_POSITION)
const morningTransitionStart = solarTimes.dawn.getTime()
const morningTransitionEnd = solarTimes.goldenHourEnd.getTime()
const eveningTransitionStart = solarTimes.goldenHour.getTime()
const eveningTransitionEnd = solarTimes.dusk.getTime()

const brightness = (now = Date.now()) => {
	const EXP = Math.exp(1)

	if (now < morningTransitionStart || now > eveningTransitionEnd) {
		return MIN_BRIGHTNESS
	}

	if (now >= morningTransitionStart && now <= morningTransitionEnd) {
		const range = morningTransitionEnd - morningTransitionStart
		const shift = now - morningTransitionStart
		const x = 2 * EXP / range * shift
		const k = (Math.tanh(x) + 1) / 2
		return Math.round(k * (MAX_BRIGTNESS - MIN_BRIGHTNESS))
	}

	if (now >= eveningTransitionStart && now <= eveningTransitionEnd) {
		const range = eveningTransitionEnd - eveningTransitionStart
		const shift = now - eveningTransitionStart
		const x = 2 * EXP / range * shift
		const k = (Math.tanh(2 * EXP - x) + 1) / 2
		return Math.round(k * (MAX_BRIGTNESS - MIN_BRIGHTNESS))
	}

	return MAX_BRIGTNESS
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
// 		console.log(time, brightness(timestamp(time)))
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

if (isNaN(currentBrighness) || targetBrigtness != currentBrighness) {
	const ddcctl = Bun.spawn(['ddcctl', '-d', '1', '-b', targetBrigtness])
	await ddcctl.exited

	Bun.write(cacheFile, targetBrigtness.toString())
}
