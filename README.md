# Matchday Pulse

**From a vague anomaly signal to a traceable fraud recommendation.**

[Demo video](https://youtu.be/bHMeXVGPu5s)

Matchday Pulse is an autonomous investigation workflow built for Google’s **Building Agents for Real-World Challenges** Hackathon, MongoDB Track. It turns a vague signal—“something looks wrong tonight”—into a structured investigation across synthetic transaction data, with every analytical step and aggregation query exposed for review.

## Portfolio snapshot

| | |
| --- | --- |
| **Problem** | Fraud teams often see an anomaly before they understand its source, scope, timing, or operational implication. Dashboards surface metrics; they do not necessarily investigate. |
| **Mechanism** | An agent establishes a baseline, narrows the anomaly, attributes behavior to device fingerprints, reconstructs the attack window, estimates attempted volume, and produces a recommendation. |
| **Proof** | One demo run moved from a single vague signal to a 7-step investigation across **5,000 synthetic transactions**, with each aggregation visible in the UI. |
| **My role** | Product definition · investigation workflow architecture · final architecture decisions · integration · testing · deployment/submission. |
| **Stack** | Google ADK · Gemini on Vertex AI · MongoDB MCP Server · MongoDB Atlas · React · Cloud Run. |

## Why this project matters

The useful capability is not “an LLM that talks about fraud.” It is a workflow that can **form the next analytical question from the evidence it just found**, while keeping the resulting queries visible enough for a human to inspect.

That makes Matchday Pulse a decision-support experiment in autonomous investigation rather than a chatbot wrapped around a dashboard.

## What Matchday Pulse does

You give the agent a single vague signal:

> “Something looks wrong tonight.”

The agent takes it from there. It decides what to query, interprets the result, and uses that to determine the next query.

In the demonstrated run, the agent:

1. Established a baseline across **5,000 synthetic transactions**.
2. Spotted Zone 3 declining at **48.6%**, against an **11.8%** venue average.
3. Narrowed the anomaly to ticket resale transactions.
4. Identified three device fingerprints behind **214 of 222 declines**.
5. Reconstructed the attack window: **17:30–17:59 UTC**.
6. Calculated **$37,159** in attempted fraudulent volume.
7. Generated a blocklist recommendation.

Each step followed from the previous finding rather than from a fixed, visible investigation script.

## What I owned

- defined the product concept and multi-step investigation workflow;
- made the final architecture decisions for the agent system;
- integrated Google ADK, Gemini on Vertex AI, MongoDB MCP Server, and Atlas;
- structured the visible evidence/query path so findings could be inspected;
- tested the workflow against the synthetic transaction scenario;
- deployed the project to Cloud Run and prepared the hackathon submission.

AI assistance was used during development; the product definition, workflow design, final architecture decisions, integration, validation, deployment, and submission decisions remained human-owned.

## Architecture

```text
React Frontend (Cloud Run)
        ↓
Google ADK Agent + Gemini on Vertex AI
        ↓
MongoDB MCP Server (Cloud Run)
        ↓
MongoDB Atlas
```

## MongoDB Atlas usage

The agent composes aggregation pipelines at runtime based on what it finds.

Examples from the demonstrated run:

- `$match` / `$group` to establish the baseline decline rate;
- `$match` on zone, then `$group` to surface the Zone 3 outlier;
- `$match` on zone and merchant category combined;
- `$match` with `$in` on device fingerprint arrays;
- `$project` with `$hour` to bucket transactions by time;
- `$sum` on transaction amounts for financial impact.

Every pipeline is visible in the UI through a **View Atlas Query** control.

## Demonstration dataset

The project uses **synthetic data only**: 5,000 fabricated transactions across six Toronto zones in a match-day traffic window from 15:00 to 21:00 UTC, with a hidden coordinated bot-attack pattern.

The scenario contains:

- Zone 3 at 48.6% of all declines;
- ticket resale as the anomalous category;
- three device fingerprints behind 300 of 457 Zone 3 ticket-resale transactions;
- an attack window of 17:30–17:59 UTC;
- $37,159 in attempted fraudulent volume across the three devices.

## Evidence boundary

- All transaction records, device fingerprints, monetary values, and fraud events are synthetic.
- The project is **not connected to a live payment system**.
- The blocklist output is a recommendation; production enforcement would require separate review and authorization.
- The project demonstrates investigation flow and traceability, not production fraud-detection performance.
- No award, judge endorsement, or production deployment claim is implied by this README.

## Demo

Video: https://youtu.be/bHMeXVGPu5s

A live demonstration was also prepared as part of the hackathon submission materials.

## License

MIT
