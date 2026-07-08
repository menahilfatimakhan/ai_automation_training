CREATE TYPE "public"."objection_type" AS ENUM('think_about_it', 'money', 'time', 'partner', 'fear', 'value');--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD COLUMN "ad_focus" text;--> statement-breakpoint
ALTER TABLE "ad_campaigns" ADD COLUMN "flagged_reason" text;--> statement-breakpoint
ALTER TABLE "ad_daily_metrics" ADD COLUMN "total_followers" integer;--> statement-breakpoint
ALTER TABLE "ad_daily_metrics" ADD COLUMN "new_followers" integer;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "booked_by_setter_id" uuid;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "objection_type" "objection_type";--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "objection_notes" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_booked_by_setter_id_users_id_fk" FOREIGN KEY ("booked_by_setter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN "objection_reason";--> statement-breakpoint
-- The old 4-value outcome enum ('closed'/'lost'/'no_show') has no lossless
-- mapping onto the new 8-literal-outcome model, and this table only ever
-- holds synthetic seed data at this point (re-created by `npm run db:seed`
-- on every run) — clearing it here avoids a failed enum cast on old rows.
DELETE FROM "calls";--> statement-breakpoint
ALTER TABLE "public"."calls" ALTER COLUMN "outcome" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."call_outcome";--> statement-breakpoint
CREATE TYPE "public"."call_outcome" AS ENUM('paid_in_full', 'split_pay', 'offer_declined', 'not_a_fit', 'deposit_only', 'no_show', 'cancelled', 'rescheduled');--> statement-breakpoint
ALTER TABLE "public"."calls" ALTER COLUMN "outcome" SET DATA TYPE "public"."call_outcome" USING "outcome"::"public"."call_outcome";