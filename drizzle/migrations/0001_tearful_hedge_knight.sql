ALTER TABLE "events" RENAME COLUMN "clertUserId" TO "clerkUserId";--> statement-breakpoint
DROP INDEX "clearUserIdIndex";--> statement-breakpoint
CREATE INDEX "clearUserIdIndex" ON "events" USING btree ("clerkUserId");