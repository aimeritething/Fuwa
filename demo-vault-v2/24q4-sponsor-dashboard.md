---
aliases: ["Build Sponsor Dashboard"]
Is A: Project
Belongs to: "[[24q4]]"
Advances: "[[responsibility-sponsorships]]"
Status: Done
Owner: "[[person-luca-rossi]]"
---
# Build Sponsor Dashboard

## Overview

As the sponsor base grew through 2024, reporting became a bottleneck. After each newsletter issue, sponsors would ask for performance data — click counts, open rates, and placement impressions. This data was being compiled manually from ConvertKit analytics and sent via email, which was time-consuming and error-prone. This project built an Airtable-based dashboard that gives sponsors self-serve access to real-time performance data for their placements.

The dashboard connects to the CRM built in [[24q2-sponsor-crm]] and pulls performance data from ConvertKit's API via a Zapier integration. Each sponsor gets a unique link to a filtered Airtable view showing only their placements, metrics, and invoice history. This project was a significant step toward professionalizing the sponsor experience and supporting [[2024-double-revenue]] through improved retention and upsell conversations.

## Goals

- Build an Airtable dashboard with per-sponsor performance data (clicks, CTR, impressions)
- Set up a Zapier integration to pull click and open data from ConvertKit after each newsletter send
- Create unique, filtered dashboard links for each sponsor (no login required, link-based access)
- Include historical performance trends (week-over-week, month-over-month)
- Reduce sponsor reporting time from ~2 hours/week to near-zero

## Key decisions

- **Airtable interface, not a custom web app.** Considered building a custom dashboard with Next.js and a database, but the engineering effort was not justified for ~20 active sponsors. Airtable's Interface Designer provides 80% of the functionality at 5% of the development cost. Can always migrate to a custom solution if the sponsor base grows significantly.
- **Self-serve access via unique links.** Rather than requiring sponsors to log into a portal, each sponsor gets a unique Airtable shared view URL. This is simpler for both parties — no password management, no onboarding friction. The trade-off is that anyone with the link can see the data, but the risk is low for non-sensitive marketing metrics.
- **Automated data ingestion, manual quality checks.** The Zapier integration pulls data automatically after each send, but [[person-matteo-cellini]] reviews the numbers weekly before they appear on sponsor dashboards. This catches any data anomalies (e.g., bot clicks, tracking issues) before sponsors see them.

## Notes

- The dashboard launch received very positive feedback from sponsors. Several mentioned it was the most transparent reporting they had seen from any newsletter sponsorship. This transparency became a competitive advantage in renewal conversations.
- The Zapier integration was the most fragile part of the system. ConvertKit's API rate limits and occasional data delays caused the integration to fail about once a month. Building retry logic and error notifications helped, but this remains a maintenance burden.
- Sponsor self-serve reporting reduced [[person-matteo-cellini]]'s weekly reporting workload from approximately 2 hours to about 15 minutes (just the quality review). This freed significant time for outreach and relationship management.
- The dashboard data also proved valuable for internal analysis. Being able to see click-through rates across all sponsors and placements revealed which types of copy and positioning perform best, informing both editorial decisions and sponsor pitch strategy.
- One unexpected benefit: sponsors who could see their own performance data were more likely to experiment with different ad copy and CTAs. This improved their results and, by extension, their satisfaction and renewal rates. The dashboard supported [[measure-sponsorship-mrr]] growth indirectly through improved retention.
