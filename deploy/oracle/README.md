# Oracle VM Review Deploy

This repo's reviewer-facing deploy shape is:

1. API on an Oracle Cloud Always Free VM
2. React web app on Vercel
3. Google OAuth callback pointed at the Oracle-hosted API

## VM bootstrap

Install Node 20, nginx, and git.

```bash
sudo apt update
sudo apt install -y curl git nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Clone the repo and install:

```bash
git clone https://github.com/SeaverDahlgren/OpenCal.git
cd OpenCal
git checkout feat/web-review-demo
npm install
```

Copy and fill env:

```bash
cp .env.example .env
```

Use staging-style values:

```env
APP_ENV=staging
BETA_ACCESS_MODE=allowlist
BETA_USER_EMAILS=demo@example.com
STATE_ENCRYPTION_KEY=replace-me
ADMIN_API_KEY=replace-me
LLM_PROVIDER=groq
GROQ_API_KEY=replace-me
GOOGLE_OAUTH_CLIENT_ID=replace-me
GOOGLE_OAUTH_CLIENT_SECRET=replace-me
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:42813/oauth/callback
GOOGLE_OAUTH_API_REDIRECT_URI=https://api.example.com/api/v1/auth/google/callback
ALLOWED_RETURN_TO_PREFIXES=https://opencal-demo.vercel.app
ALLOWED_WEB_ORIGINS=https://opencal-demo.vercel.app
API_PORT=8787
```

Preflight:

```bash
npm run deploy:check
```

## systemd

Copy the sample unit:

```bash
sudo cp deploy/oracle/opencal-api.service /etc/systemd/system/opencal-api.service
```

Edit `WorkingDirectory`, `EnvironmentFile`, and `User` as needed, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable opencal-api
sudo systemctl start opencal-api
sudo systemctl status opencal-api
```

## nginx

Copy the sample config:

```bash
sudo cp deploy/oracle/opencal-api.nginx.conf /etc/nginx/sites-available/opencal-api
sudo ln -s /etc/nginx/sites-available/opencal-api /etc/nginx/sites-enabled/opencal-api
sudo nginx -t
sudo systemctl reload nginx
```

Terminate TLS however you prefer for the review window:

- Certbot on the VM
- Cloudflare proxy + origin cert

The important part is that reviewers hit:

- `https://api.example.com/api/v1/...`

## Vercel

In Vercel:

1. import `apps/web`
2. set:
   - `VITE_API_BASE_URL=https://api.example.com/api/v1`
   - `VITE_APP_VERSION=1.0.0`
   - `VITE_SUPPORT_EMAIL=you@example.com`
3. deploy

Then add the final Vercel URL to:

- `ALLOWED_RETURN_TO_PREFIXES`
- `ALLOWED_WEB_ORIGINS`

and restart the API.
