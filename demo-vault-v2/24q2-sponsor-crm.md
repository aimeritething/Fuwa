---
aliases: ["Set Up Sponsor CRM"]
Is A: Project
Belongs to: "[[24q2]]"
Advances: "[[responsibility-sponsorships]]"
Status: Done
Owner: "[[person-luca-rossi]]"
---
# Set Up Sponsor CRM

## Overview

With sponsorship deals increasing after [[24q1-launch-sponsorship-packages]], tracking outreach, deal status, invoicing, and renewals in a spreadsheet was no longer viable. This project built a proper CRM system in Airtable to manage the full sponsor lifecycle — from initial outreach through booking, fulfillment, reporting, and renewal.

The CRM needed to support [[procedure-quarterly-sponsor-outreach]] and [[procedure-sponsor-onboarding]] while being lightweight enough for a one-person sales operation (with occasional help from [[person-matteo-cellini]] on outreach). The system went live in April 2024 and has been the backbone of sponsor management since, directly supporting [[2024-double-revenue]].

## Goals

- Design an Airtable base with tables for Companies, Contacts, Deals, Invoices, and Placements
- Build views for pipeline management (kanban), upcoming renewals, and revenue tracking
- Set up automations for deal stage notifications and renewal reminders (30 days before expiry)
- Import existing sponsor data from the old spreadsheet (~15 companies, ~25 deals)
- Document the CRM workflow and train [[person-matteo-cellini]] on outreach tracking

## Key decisions

- **Airtable, not a dedicated CRM tool.** Evaluated HubSpot, Pipedrive, and Notion. HubSpot was overkill (and expensive) for ~50 deals/year. Pipedrive was close but lacked the flexibility for tracking placement fulfillment. Airtable's combination of structured data, views, and automations hit the sweet spot for this scale.
- **Deal-centric model, not contact-centric.** The primary entity is the Deal (a specific sponsorship booking), not the Contact or Company. This reflects the actual workflow — most actions are about advancing a specific deal, not managing a relationship in the abstract.
- **Automated renewal reminders at 30 and 7 days.** Renewal is the highest-leverage moment in the sponsor lifecycle. Automating reminders ensures no renewal slips through the cracks, which was happening with the spreadsheet system.

## Notes

- Migrating from the spreadsheet exposed several data quality issues — duplicate companies, inconsistent naming, missing invoice dates. Cleaning this up took a full day but was worth it for a clean foundation.
- The kanban view for pipeline management became the default "daily check" for sponsor operations. Being able to see all deals by stage (Prospect, Outreach, Negotiation, Booked, Fulfilled, Renewed) at a glance changed how proactive the outreach process feels.
- Airtable's automation limits on the free plan were a constraint. Upgraded to the Team plan ($20/month) to get enough automation runs. The cost is trivial relative to the revenue it manages.
- [[measure-sponsorship-mrr]] is now calculated directly from the CRM data, which eliminated the manual reconciliation that was happening before. Revenue reporting went from a quarterly headache to an always-current dashboard.
