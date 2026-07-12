export function formatInteger(value: number, locale: string): string {
  const useFaDigits = locale.startsWith("fa")
  return new Intl.NumberFormat(useFaDigits ? "fa-IR" : "en-US", {
    maximumFractionDigits: 0,
    numberingSystem: useFaDigits ? "arabext" : "latn",
  }).format(value)
}

export function formatLocalizedDate(
  locale: string,
  date: Date,
  timeZone = "UTC",
): string {
  if (locale.startsWith("fa")) {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      dateStyle: "medium",
      numberingSystem: "arabext",
      timeZone,
    }).format(date)
  }
  if (locale.startsWith("ar")) {
    return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeZone }).format(
      date,
    )
  }
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone }).format(
    date,
  )
}

export function formatNowDate(locale: string, timeZone = "UTC"): string {
  return formatLocalizedDate(locale, new Date(), timeZone)
}
