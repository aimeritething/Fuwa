---
aliases: ["Redesign Newsletter Template"]
Is A: Project
Belongs to: "[[24q1]]"
Advances: "[[responsibility-content-production]]"
Status: Done
Owner: "[[person-luca-rossi]]"
---
# Redesign Newsletter Template

## Overview

The Refactoring newsletter template had been largely unchanged since launch — a plain text-heavy layout that worked at small scale but felt increasingly dated as the subscriber base grew. This project redesigned the email template for better readability, visual hierarchy, and sponsor placement. The redesign needed to improve the reading experience while also making sponsorship placements more visually distinct and valuable, supporting [[2024-double-revenue]].

The new template introduced a cleaner header, better typography spacing, a dedicated sponsor block with clear visual boundaries, and a structured footer with social links and podcast promotion. It was tested across major email clients (Gmail, Apple Mail, Outlook) and went through three iterations based on feedback from a small group of beta readers.

## Goals

- Redesign the email template with improved visual hierarchy and readability
- Create a dedicated, visually distinct sponsor placement section
- Ensure compatibility across Gmail, Apple Mail, Outlook, and mobile clients
- Improve click-through rate on inline links by at least 15%
- Establish the new template as the standard for [[procedure-weekly-newsletter]]

## Key decisions

- **Single-column layout.** Evaluated two-column layouts with sidebar content, but testing showed that single-column performs significantly better on mobile (where 65%+ of opens happen). Simplicity won.
- **Sponsor block above the fold.** Moved the sponsor placement from mid-article to just below the header intro. This increased sponsor visibility without feeling intrusive, since the block is clearly labeled and visually separated. Sponsors noticed and appreciated the change.
- **No images in the main body.** Kept the template text-focused with minimal imagery. Images in email are unreliable (blocked by many clients), increase load time, and distract from the content. The only image is the sponsor logo.

## Notes

- The biggest surprise was how much email client rendering varies. A layout that looked perfect in Gmail was broken in Outlook. Ended up using a very conservative CSS approach with inline styles and table-based layout for maximum compatibility.
- [[person-sara-ricci]] helped with copy feedback on the new footer and CTA sections. Her editorial eye caught several awkward phrasings in the template boilerplate.
- A/B tested the new template against the old one over two issues. The new template showed a 22% increase in click-through rate, primarily driven by better link placement and the structured "further reading" section at the bottom.
- [[measure-open-rate]] remained stable through the transition, confirming that the redesign did not trigger spam filters or cause deliverability issues. This was a real concern given how sensitive email infrastructure is to template changes.
