# Deployment — Hostinger VPS, git-pull deploys

NEW SZN is a Next.js (App Router) app. It runs as a long-lived Node process on a
VPS, kept alive by **PM2**, fronted by **Nginx** with HTTPS. Code ships from
GitHub via `git pull`. **Supabase (Postgres + Auth) stays in the cloud** — the
VPS only runs the web app and connects to Supabase over the network, so there is
no database to host on the VPS.

```
Browser ──HTTPS──> Nginx (:443) ──proxy──> Next.js (PM2, :3000) ──> Supabase Cloud
```

## 0. Provision the VPS
- Hostinger → **VPS** plan with **Ubuntu 22.04/24.04**. Pick **≥ 2 GB RAM**
  (`next build` is memory-hungry; on 1 GB add swap — see Appendix).
- Note the server's **public IP**.

## 1. First SSH in + create a deploy user
```bash
ssh root@SERVER_IP
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy   # copy your SSH key
# log back in as the deploy user from now on:
ssh deploy@SERVER_IP
```

## 2. Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # opens 80 + 443
sudo ufw enable
```

## 3. Install Node 22, git, Nginx, PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx
sudo npm install -g pm2
node -v   # expect v22.x
```

## 4. Get the code
```bash
sudo mkdir -p /var/www && sudo chown deploy:deploy /var/www
cd /var/www
git clone https://github.com/menahilfatimakhan/ai_automation_training.git newszn
cd newszn
```
(Public repo → HTTPS clone works. For a private repo, add a read-only **deploy
key**: `ssh-keygen -t ed25519`, add the `.pub` to GitHub → repo → Settings →
Deploy keys, and clone the `git@github.com:...` URL.)

## 5. Production environment
Create `/var/www/newszn/.env.local` (NEVER committed) with your real values:
```bash
nano .env.local
```
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
DATABASE_URL=postgresql://postgres.<ref>:<pwd>@<pooler-host>:5432/postgres?sslmode=require
ANTHROPIC_API_KEY=<key or sk-ant-placeholder>
AD_PROVIDER=mock          # or meta once configured
FX_PROVIDER=live
NOTIFIER=db               # or slack once SLACK_BOT_TOKEN is set
AI_PROVIDER=mock          # or anthropic
# META_TOKEN_ACME=<token>  # only if AD_PROVIDER=meta
# SLACK_BOT_TOKEN=xoxb-...       # only if NOTIFIER=slack
# EMAIL_PROVIDER=resend          # only for real invite/reset emails
# RESEND_API_KEY=re_...
```
> The schema + RLS are already applied to your Supabase project. If this is a
> brand-new/separate Supabase, run `npm run db:migrate` (and `npm run db:seed`
> for demo data) once before starting.

## 6. Build + start under PM2
```bash
npm ci
npm run build
pm2 start ecosystem.config.cjs   # starts BOTH processes: newszn (web) + newszn-scheduler
pm2 save                       # remember the process list
pm2 startup                    # prints a command — run it (sudo) to start on boot
```
The app is now live on `127.0.0.1:3000` (not yet public).

### The scheduler (`newszn-scheduler`)
`ecosystem.config.cjs` also starts `src/scheduler/index.ts` as a second PM2
process (`npx tsx src/scheduler/index.ts`) — a standalone long-running Node
process, separate from the Next.js web server, since it has no HTTP request
to run inside. It runs (all times in each **client's own configured
timezone**, Admin Settings → Slack & notification settings):

| Job | Cadence |
|---|---|
| Ad sync (every connected client) | Hourly (respects the existing 15-min cooldown) |
| Anomaly scan (revenue/spend/close-rate/show-up-rate vs. 28-day avg) | Every 4 hours |
| Daily target DM | Once daily, at each client's configured `dailyTargetHour` |
| EOD report | Once daily, at a fixed local hour (19:00) |
| Weekly report | Mondays, same hour |
| Monthly report | 1st of the month, same hour |

Every job is also reachable as a manual "dry run" without waiting on cron:
ad sync via the Ads dashboard's "Sync now", anomaly scan via Admin Settings'
"Check anomalies now", and reports via the Reports page's "Generate Now" —
all three call the exact same code the scheduler calls, so a manual run is a
faithful test of what cron will do. Verify these before trusting the live
schedule on a new deployment.

If you'd rather not run a second long-lived Node process, `npm run scheduler`
also works directly under a **systemd timer** instead of PM2 — the script
itself just needs to stay running (it schedules its own cron internally via
`node-cron`), so a systemd `Type=simple` service with `Restart=always` is an
equally valid alternative to the PM2 entry above.

## 7. Nginx reverse proxy
```bash
sudo cp docs/nginx.conf.sample /etc/nginx/sites-available/newszn
sudo nano /etc/nginx/sites-available/newszn      # replace your-domain.com
sudo ln -s /etc/nginx/sites-available/newszn /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Domain + HTTPS
- Point your domain's **A record** (and `www`) to the **server IP** (Hostinger
  hPanel → Domains → DNS, or your registrar).
- Once DNS resolves:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```
Certbot installs the certificate, rewrites the Nginx config for 443, and
auto-renews.

## 9. Tell Supabase about the domain (important)
Supabase Dashboard → **Authentication → URL Configuration**:
- **Site URL**: `https://your-domain.com`
- **Redirect URLs**: add `https://your-domain.com/**`

Otherwise login/session cookies won't work on the production domain.

## 10. Deploying updates (the git-pull workflow)
After pushing to `master`, on the server:
```bash
cd /var/www/newszn
chmod +x deploy.sh   # first time only
./deploy.sh          # git pull → npm ci → npm run build → pm2 reload
```
That's the whole loop. (Optional: a `git` `post-receive` hook or GitHub Action
can run this automatically — but manual `./deploy.sh` matches the requirement.)

## Operations cheat-sheet
| Task | Command |
|------|---------|
| View web logs | `pm2 logs newszn` |
| View scheduler logs | `pm2 logs newszn-scheduler` |
| Restart web | `pm2 restart newszn` |
| Restart scheduler | `pm2 restart newszn-scheduler` |
| Status (both) | `pm2 status` |
| Nginx reload | `sudo systemctl reload nginx` |
| Renew cert (dry run) | `sudo certbot renew --dry-run` |

## Appendix — add swap (needed on 1 GB VPS so `next build` doesn't OOM)
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
