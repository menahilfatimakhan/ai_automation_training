CREATE INDEX "ad_metrics_client_date_idx" ON "ad_daily_metrics" USING btree ("client_id","date");--> statement-breakpoint
CREATE INDEX "audit_log_client_created_idx" ON "audit_log" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "calls_client_date_idx" ON "calls" USING btree ("client_id","date");--> statement-breakpoint
CREATE INDEX "notifications_client_created_idx" ON "notifications" USING btree ("client_id","created_at");