# Matchday Pulse

Autonomous fraud investigation agent built for Google's "Building Agents for Real-World Challenges" Hackathon, MongoDB Track.

## The Problem

On a busy match day, payment systems process thousands of transactions per hour. Fraud teams can see that something is wrong. They cannot always tell where it's coming from, who's behind it, or what to do about it before more damage is done.

Traditional dashboards surface metrics. They don't investigate.

## What Matchday Pulse Does

You give the agent a single vague signal:

> "Something looks wrong tonight."

The agent takes it from there. It decides what to query, interprets the result, and uses that to determine the next query. No fixed script. No predefined path.

In the demo run, starting from that one sentence, the agent:

1. Established a baseline across 5,000 transactions
2. Spotted Zone 3 declining at 48.6%, against an 11.8% venue average
3. Narrowed the anomaly to ticket resale transactions specifically
4. Identified three device fingerprints behind 214 of 222 declines
5. Reconstructed the attack window: 17:30 to 17:59 UTC
6. Calculated $37,159 in attempted fraudulent volume
7. Generated a blocklist recommendation

Each step followed from the previous one. The agent chose every query based on what it just found.

## Architecture

```
React Frontend (Cloud Run)
        ↓
Google ADK Agent, Gemini 3.5 Flash on Vertex AI
        ↓
MongoDB MCP Server (Cloud Run)
        ↓
MongoDB Atlas
```

## MongoDB Atlas Usage

The agent composes aggregation pipelines at runtime based on what it finds. It is not working from a predefined list of queries.

Examples from a live run:

- `$match` / `$group` to establish the baseline decline rate
- `$match` on zone, then `$group` to surface the Zone 3 outlier
- `$match` on zone and merchant category combined
- `$match` with `$in` on device fingerprint arrays
- `$project` with `$hour` to bucket transactions by time
- `$sum` on transaction amounts for financial impact

Every pipeline is visible in the UI. Each step has a "View Atlas Query" toggle that shows the exact aggregation used to produce that finding.

## Demonstration Dataset

5,000 synthetic transactions across 6 Toronto zones, match-day traffic window 15:00 to 21:00 UTC, with a hidden coordinated bot attack:

- Zone 3 accounts for 48.6% of all declines
- The attack runs through ticket resale exclusively
- Three device fingerprints are responsible for 300 of 457 Zone 3 ticket resale transactions
- The attack window is exactly 17:30 to 17:59 UTC
- $37,159 in attempted fraudulent volume across the three devices

## Live Demo

Available in the Devpost submission.

## Demo Video

https://youtu.be/bHMeXVGPu5s

## License

MIT
