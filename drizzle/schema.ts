// Define the "events" table with fields like name, description, and duration


import { DAYS_OF_WEEK_IN_ORDER } from "@/constants";
import { relations } from "drizzle-orm";
import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Define a reusable `createdAt` timestamp column with default value set to now
const createdAt = timestamp("createdAt").notNull().defaultNow()

// Define a reusable `updatedAt` timestamp column with automatic update on modification
const updatedAt = timestamp("updatedAt")
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date()) // automatically updates to current time on update


export const EventTable = pgTable(
    "events",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        name: text("name").notNull(),
        description: text("description"),
        durationInMinutes: integer("durationInMinutes").notNull(),
        clerkUserId: text("clerkUserId").notNull(),
        isActive: boolean("isActive").notNull().default(true),
        createdAt,
        updatedAt,
    },
    table => ([
        index("clearUserIdIndex").on(table.clerkUserId),
        
    ])
)

// Define the "schedules" table, one per user, with timezone and timestamps
export const ScheduleTable = pgTable("schedules",{
    id: uuid("id").primaryKey().defaultRandom(),
    timezone: text("timezone").notNull(),
    clerkUserId: text("clerkUserId").notNull().unique(),
    createdAt,
    updatedAt,
})

// Define relationships for the ScheduleTable: a schedule has many availabilities
export const scheduleRelations = relations(ScheduleTable, ({ many }) => ({
    availabilities: many(ScheduleAvailabilityTable), // one-to-many relationship
}))

// Define a PostgreSQL ENUM for the days of the week
export const scheduleDayOfWeekEnum = pgEnum("day", DAYS_OF_WEEK_IN_ORDER)

// Define the "scheduleAvailabilities" table, which stores available time slots per day
export const ScheduleAvailabilityTable = pgTable(
    "scheduleAvailabilities",
    {
      id: uuid("id").primaryKey().defaultRandom(),// unique ID
      scheduleId: uuid("scheduleId") // foreign key to the Schedule table
        .notNull()
        .references(() => ScheduleTable.id, { onDelete: "cascade" }), // cascade delete when schedule is deleted
      startTime: text("startTime").notNull(), // start time of availability (e.g. "09:00")
      endTime: text("endTime").notNull(), // end time of availability (e.g. "17:00")
      dayOfWeek: scheduleDayOfWeekEnum("dayOfWeek").notNull(), // day of the week (ENUM)
    },
    table => ([
      index("scheduleIdIndex").on(table.scheduleId),           // index on foreign key for faster lookups
    ])
  )

  // Define the reverse relation: each availability belongs to a schedule
export const ScheduleAvailabilityRelations = relations(
    ScheduleAvailabilityTable,
    ({ one }) => ({
      schedule: one(ScheduleTable, {
        fields: [ScheduleAvailabilityTable.scheduleId], // local key
        references: [ScheduleTable.id], // foreign key
      }),
    })
  )

export const TaskTable = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  base64Image: text("base64Image").notNull(),
  clerkUserId: text("clerkUserId").notNull(),
  calendarEventId: text("calendarEventId"), // Optional: link to Google Calendar
  completed: boolean("completed").notNull().default(false),
  createdAt,
  updatedAt,
});