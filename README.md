# AutoAds

**A multi-tenant platform for car dealerships: managers create ready-to-run Meta (Facebook/Instagram) ad campaigns with the audience already targeted, and each salesperson just chooses which one to publish. Leads go straight to the salesperson's own WhatsApp.**

I work as a car salesperson at a multi-brand dealership group. Salespeople know that ads bring customers, but building a Meta campaign is not their job and most of them don't know how. The ones who try end up with the wrong audience, the wrong budget and no way for the manager to see what's happening. I built AutoAds so that salespeople never have to create an ad: the store manager or the group's master admin builds the campaign once, already targeted, and each salesperson picks the one they want to run and starts receiving customers on their WhatsApp.

It runs in production with a pilot group of salespeople at the dealership.

> This repository is a sanitized public copy for portfolio purposes. Company names, people, contact details and project identifiers were removed, and it does not include the original commit history.

---

## How it works

There are three roles, and each one sees a different app:

| Role | What they do |
| --- | --- |
| **Master** (group level) | Manages brands, stores and users. Builds the campaign library (vehicle, offer, photos, copy, validity dates). Sees results across all stores. |
| **Manager** (store level) | Creates campaigns for their own store, sets budget defaults, follows each salesperson's readiness and ranking, and verifies reported sales. |
| **Salesperson** | Connects their own Meta ad account, picks which ready-made campaign to publish, decides how much of their own money to invest in it and follows results. Registers sales that came from ads. |

The flow:

```
Master / Manager creates campaign  ──►  Salesperson picks it and publishes
                                              │
                                              ▼
                              Meta Ads (Click-to-WhatsApp, local audience)
                                              │
                                              ▼
                              Customer talks to the salesperson on WhatsApp
                                              │
                                              ▼
                 Metrics synced every 30 min ──► dashboards for salesperson,
                                                  manager and master
```

## Key decisions

- **Leads go straight to the salesperson's WhatsApp; the platform does not store them.** Ads use Meta's Click-to-WhatsApp destination. This removes a form, removes friction for the customer, and avoids keeping personal data the business doesn't need. The main success metric is *conversations started*, not clicks.
- **Managers create, salespeople publish.** Salespeople shouldn't need to understand targeting or ad copy. They choose from a library of approved campaigns, so every ad follows the brand's standards.
- **Each salesperson runs ads from their own Meta ad account and pays for them** (OAuth connection). They choose how much to invest in each campaign, so spending and results belong to them, while the manager still sees everything in one place.
- **Audience decisions came from real results.** Ads target people who *live* within 10 km of the store, aged 35+. I turned off Meta's Advantage+ audience after it performed worse than the segmented audience, and went back to single-image ads after carousels underperformed.
- **Editing an offer updates the existing Meta campaign** (new photos and copy, same audience) instead of creating a new one, so the campaign keeps its learning and history.
- **Campaigns expire automatically.** A scheduled job pauses campaigns whose offer is no longer valid, so nobody keeps paying for an expired promotion.
- **Sales are confirmed with the proposal number.** Salespeople register sales manually; managers and the master can verify them against the dealership's proposal number. Simple on purpose, and it links ad spend to actual sales.
- **Numbers must match across dashboards.** Salesperson, manager and master views read from the same consolidated data, because one mismatch is enough to make people stop trusting the platform.

## Security

Security was handled as an ongoing audit, documented step by step in [`docs/AUDITORIA_SEGURANCA_AUTOADS.md`](docs/AUDITORIA_SEGURANCA_AUTOADS.md) (in Portuguese). Highlights:

- Multi-tenant isolation with **Row Level Security** on every exposed table: a salesperson only sees their own data, a manager only their store, the master only their group.
- `SECURITY DEFINER` functions with a fixed `search_path` and explicit schemas.
- Least privilege for `anon` and `authenticated`, and sensitive operations moved to secure RPCs.
- Meta app secret and service keys live only as server-side secrets; scheduled jobs authenticate with a secret stored in the database, not in code.

## Tech stack

- **Frontend:** React, TypeScript, TanStack Start / Router, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (Postgres, Auth, RLS, Edge Functions, pg_cron)
- **Integrations:** Meta Marketing API (OAuth, campaigns, ad sets, creatives, insights, targeting search)
- **Built with:** AI-assisted development (Lovable + Claude). The product, the data model and the decisions above are mine.

## Project structure

```
src/
  components/              # master, manager and salesperson screens
    manager/  seller/  sales/
  lib/                     # sales, metrics and readiness logic
  routes/                  # app, admin and legal pages (privacy, terms, data deletion)
supabase/
  functions/               # Meta integration: OAuth, create/update campaigns,
                           # status, insights, metrics sync, auto-expiry
  migrations/              # schema, RLS policies, scheduled jobs (47 migrations)
docs/                      # security audit log
```

## Running locally

```bash
bun install            # or: npm install --legacy-peer-deps
cp .env.example .env   # fill in your own Supabase project values
bun run dev
```

You need your own Supabase project (apply `supabase/migrations/`, deploy `supabase/functions/`) and a Meta developer app. Meta credentials and the Supabase service key are set as Edge Function secrets, never in the frontend. The scheduled jobs in the migrations point to `your-project-ref`; replace it with your project reference.

---

Built by **Mário Mazete** · [github.com/mariomazete](https://github.com/mariomazete)
