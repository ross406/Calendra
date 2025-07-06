import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


// Converts a time string like "09:15" into a decimal number like 9.25
// This is mainly for display purposes (not for precise time calculations)
export function timeToFloat(time: string): number {
  // Split the time string by ":" into [hours, minutes] and convert both to numbers
  const [hours, minutes] = time.split(":").map(Number)
  // Note: .map(Number) is a shorthand way to convert an array of strings to numbers.

  // Convert minutes into a fraction of an hour and add it to the hour
  return hours + minutes / 60
}

export function getSortedTimezones(): { name: string; offset: number }[] {
  const now = new Date();
  return Intl.supportedValuesOf("timeZone")
    .map(timezone => {
      // Use Intl.DateTimeFormat to get GMT offset
      const offsetParts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "shortOffset",
      })
        .formatToParts(now)
        .find(part => part.type === "timeZoneName")?.value
        ?.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/) || [];

      const hours = parseInt(offsetParts[1] || "0", 10);
      const minutes = parseInt(offsetParts[2] || "0", 10);
      const totalOffset = hours * 60 + (hours >= 0 ? minutes : -minutes);

      return { name: timezone, offset: totalOffset };
    })
    .sort((a, b) => a.offset - b.offset);
}

