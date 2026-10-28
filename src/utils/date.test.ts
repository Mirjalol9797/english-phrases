import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, formatDay, isDayKey, toDayKey, weekdayOf } from './date'

describe('toDayKey', () => {
  it('берёт местную дату, а не UTC', () => {
    // 23:30 по местному времени — это ещё тот же день, даже если в UTC уже следующий.
    expect(toDayKey(new Date(2026, 9, 15, 23, 30))).toBe('2026-10-15')
    expect(toDayKey(new Date(2026, 9, 16, 0, 30))).toBe('2026-10-16')
  })

  it('дополняет месяц и день нулём', () => {
    expect(toDayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('addDays', () => {
  it('переходит через конец месяца', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
  })

  it('переходит через конец года', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
  })

  it('считает назад', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('знает про високосный год', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-28', 2)).toBe('2028-03-01')
  })
})

describe('daysBetween', () => {
  it('считает разницу в днях', () => {
    expect(daysBetween('2026-10-15', '2026-10-18')).toBe(3)
    expect(daysBetween('2026-10-18', '2026-10-15')).toBe(-3)
    expect(daysBetween('2026-10-15', '2026-10-15')).toBe(0)
  })

  it('не сбивается на переходе летнего времени', () => {
    // В такие сутки 23 или 25 часов, но дней между датами всё равно целое число.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2)
  })
})

describe('weekdayOf', () => {
  it('считает понедельник нулём', () => {
    expect(weekdayOf('2026-10-12')).toBe(0) // понедельник
    expect(weekdayOf('2026-10-15')).toBe(3) // четверг
    expect(weekdayOf('2026-10-18')).toBe(6) // воскресенье
  })
})

describe('isDayKey', () => {
  it('принимает только формат ГГГГ-ММ-ДД', () => {
    expect(isDayKey('2026-10-15')).toBe(true)
    expect(isDayKey('2026-1-5')).toBe(false)
    expect(isDayKey('15.10.2026')).toBe(false)
    expect(isDayKey(20261015)).toBe(false)
    expect(isDayKey(null)).toBe(false)
  })
})

describe('formatDay', () => {
  it('пишет день и месяц по-русски', () => {
    expect(formatDay('2026-10-15')).toBe('15 октября')
  })
})

describe('formatDay на двух языках', () => {
  it('по-русски — числом и месяцем в родительном', () => {
    expect(formatDay('2026-10-20')).toBe('20 октября')
  })

  it('по-узбекски — числом и месяцем через дефис', () => {
    expect(formatDay('2026-10-20', 'uz')).toBe('20-oktabr')
  })

  it('узбекские месяцы не зависят от локали браузера', () => {
    // Локали uz есть не везде, поэтому список свой.
    expect(formatDay('2026-01-01', 'uz')).toBe('1-yanvar')
    expect(formatDay('2026-12-31', 'uz')).toBe('31-dekabr')
  })
})
