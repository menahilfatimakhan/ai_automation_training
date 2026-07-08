CREATE TYPE "public"."dashboard_key" AS ENUM('master', 'sales', 'ads', 'setter');--> statement-breakpoint
CREATE TABLE "ai_personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"dashboard" "dashboard_key" NOT NULL,
	"persona" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_personas_client_dashboard_uniq" UNIQUE("client_id","dashboard")
);
--> statement-breakpoint
CREATE TABLE "alert_thresholds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"metric_key" text NOT NULL,
	"warn_below" numeric(18, 4),
	"critical_below" numeric(18, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alert_thresholds_client_metric_uniq" UNIQUE("client_id","metric_key")
);
--> statement-breakpoint
CREATE TABLE "client_settings" (
	"client_id" uuid PRIMARY KEY NOT NULL,
	"slack_channel_id" text,
	"slack_enabled" boolean DEFAULT false NOT NULL,
	"notify_daily_targets" boolean DEFAULT true NOT NULL,
	"notify_eod_report" boolean DEFAULT true NOT NULL,
	"notify_weekly_report" boolean DEFAULT true NOT NULL,
	"notify_monthly_report" boolean DEFAULT true NOT NULL,
	"notify_loss_debrief" boolean DEFAULT true NOT NULL,
	"notify_anomaly_alerts" boolean DEFAULT true NOT NULL,
	"notify_shame_fame" boolean DEFAULT false NOT NULL,
	"notify_streaks" boolean DEFAULT false NOT NULL,
	"notify_big_deals" boolean DEFAULT true NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"daily_target_hour" integer DEFAULT 8 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_personas" ADD CONSTRAINT "ai_personas_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_thresholds" ADD CONSTRAINT "alert_thresholds_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_settings" ADD CONSTRAINT "client_settings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;