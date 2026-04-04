---
title: How I Organize My Vault
is_a: Note
related_to: "[[Personal Knowledge Management]]"
author: "[[Luca Rossi]]"
date: 2025-01-15
---

My vault follows a structure loosely inspired by PARA, adapted to how I actually think and work.

## The four types I use

**Projects** — things with a clear outcome and an end date. Building a feature, writing an article, preparing a talk. Projects are active or done, never vague.

**Responsibilities** — areas I own ongoing, with no end date. Newsletter, health, finances, team. A Responsibility never "completes" — it just gets better or worse.

**Topics** — concepts, ideas, and subjects I care about. Personal Knowledge Management, Software Architecture, Cycling Training. Topics are the intellectual threads that run through everything else.

**People** — anyone I interact with meaningfully. Each person has a note with context, how we met, what we've worked on together.

## How they connect

A Project `belongs_to` a Responsibility. A note `related_to` a Topic. A meeting note `related_to` the people who attended. Over time, these connections turn a flat list of files into something closer to how memory actually works.

## Events

I also sync calendar events into my vault as Event notes — one note per meeting or important event, linked to the people present. [[Luca Rossi]]'s AI assistant Brian handles this automatically via a cron job.

## The rule I follow

If I create a note and don't connect it to anything within a day or two, it goes to Inbox and stays there until I organize it. The Inbox is the queue — not a dumping ground.
