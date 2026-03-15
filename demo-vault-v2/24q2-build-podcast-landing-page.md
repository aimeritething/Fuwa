---
aliases: ["Build Podcast Landing Page"]
Is A: Project
Belongs to: "[[24q2]]"
Advances: "[[responsibility-podcast]]"
Status: Done
Owner: "[[person-luca-rossi]]"
---
# Build Podcast Landing Page

## Overview

After launching the podcast in [[24q1-podcast-season-1]], it became clear that there was no proper home for the show on the web. Episodes were scattered across Apple Podcasts, Spotify, and YouTube, but there was no single page where listeners could browse the archive, read show notes, and subscribe. This project created a dedicated landing page on the Refactoring website to serve as the podcast's canonical home.

The page needed to work both as a discovery tool for new listeners and as a reference for existing ones. It also needed to support sponsor visibility, since podcast sponsorships were part of the package tiers defined in [[24q1-launch-sponsorship-packages]]. The page was built using the existing site's tech stack (Next.js) and went live in early May.

## Goals

- Design and build a podcast landing page with episode archive, show notes, and embedded audio player
- Include subscribe CTAs for Apple Podcasts, Spotify, YouTube, and RSS
- Add a "Featured Guest" section to highlight notable episodes and drive social proof
- Integrate sponsor logos and links for current podcast sponsors
- Ensure the page is mobile-responsive and loads quickly (target: <2s LCP)

## Key decisions

- **Static generation, not dynamic.** Each episode page is statically generated at build time from a markdown file with frontmatter metadata. This keeps hosting costs zero (Vercel free tier) and ensures fast page loads. New episodes trigger a rebuild via a GitHub webhook.
- **Embedded player, not custom.** Used the native Spotify/Apple embed widgets rather than building a custom audio player. The maintenance cost of a custom player was not justified given that most listeners use their preferred podcast app anyway.
- **Show notes as full articles.** Rather than just listing bullet points, each episode's show notes page is a full article with key takeaways, timestamps, and links. This gives the pages SEO value and provides genuine utility for listeners who prefer reading to listening.

## Notes

- The page design went through two iterations. The first version was too sparse — just a list of episodes with play buttons. [[person-giulia-conti]] suggested adding guest photos and pull quotes, which made the page significantly more engaging.
- Getting the embedded players to render correctly across browsers was more annoying than expected. Spotify's embed widget has inconsistent height behavior on Safari. Ended up using a fixed-height iframe with a fallback link.
- The landing page became the default link shared in the newsletter for podcast promotion, replacing direct Spotify/Apple links. This centralized analytics tracking through [[measure-podcast-downloads]] and gave better visibility into listener behavior.
- Page traffic is modest (~500 unique visitors/month) but steady, and it ranks for several long-tail podcast-related keywords. The SEO investment in show notes is paying off gradually.
