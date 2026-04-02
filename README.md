# IPL Fantasy Auction

A real-time fantasy cricket auction platform. Create or join a tournament, bid on IPL players, and track your team's fantasy points as the season progresses.

## Features

- Real-time auction with live bidding
- Fantasy scoring based on match performances
- Match scorecard import from ESPN Cricinfo
- Email-based password reset

## Tech Stack

- [Next.js](https://nextjs.org) (App Router)
- [Supabase](https://supabase.com) (Postgres + auth storage)
- Custom HMAC-signed session cookies

## Running locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in your Supabase and session secret values.

Thanks to Claude
