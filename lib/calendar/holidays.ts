/**
 * UAE public holidays for the admin Calendar's "UAE holidays" layer. The
 * fixed ones are certain; the Islamic ones follow the moon sighting and the
 * government's announcement, so they are marked `expected` and the page says
 * so. Extend the list a year at a time; a year with no rows simply shows
 * nothing.
 */

export type Holiday = { date: string; days: number; name: string; expected: boolean }

const H = (date: string, name: string, days = 1, expected = false): Holiday => ({ date, name, days, expected })

export const UAE_HOLIDAYS: Holiday[] = [
  // 2026
  H("2026-01-01", "New Year's Day"),
  H("2026-03-19", "Eid Al Fitr", 4, true),
  H("2026-05-26", "Arafat Day", 1, true),
  H("2026-05-27", "Eid Al Adha", 3, true),
  H("2026-06-16", "Islamic New Year", 1, true),
  H("2026-08-25", "Prophet Muhammad's Birthday", 1, true),
  H("2026-12-01", "Commemoration Day"),
  H("2026-12-02", "UAE National Day", 2),
  // 2027
  H("2027-01-01", "New Year's Day"),
  H("2027-03-09", "Eid Al Fitr", 3, true),
  H("2027-05-15", "Arafat Day", 1, true),
  H("2027-05-16", "Eid Al Adha", 3, true),
  H("2027-06-06", "Islamic New Year", 1, true),
  H("2027-08-14", "Prophet Muhammad's Birthday", 1, true),
  H("2027-12-01", "Commemoration Day"),
  H("2027-12-02", "UAE National Day", 2),
]
