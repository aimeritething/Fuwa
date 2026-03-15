---
aliases: ["Vibe-coding a Stock Screener"]
Is A: Experiment
Belongs to: "[[24q2]]"
Status: Done
Owner: "[[person-luca-rossi]]"
---
# Vibe-coding a Stock Screener

Built a stock screener in Python over a weekend to test whether a simple EMA bounce strategy could surface actionable trade setups on US equities. The broader motivation was to explore whether personal tooling for investment analysis could complement the [[procedure-monthly-portfolio-review]] and eventually improve [[measure-net-worth]] trajectory.

## Hypothesis

A lightweight, self-built screener using exponential moving average crossovers would surface 2-3 viable swing trade candidates per week, outperforming manual chart scanning in both speed and consistency.

## Setup

- Wrote a Python script pulling daily OHLCV data from Yahoo Finance for the S&P 500 universe.
- Implemented a 21/50 EMA bounce filter: flag stocks where price touches the 21 EMA from above, with the 50 EMA still trending up.
- Ran the screener nightly via cron for 4 weeks, logging all flagged tickers and tracking outcomes over 10-day windows.
- Compared results against manual chart review done for the same period.

## Results

- The screener flagged an average of 5 candidates per day (higher than expected).
- Roughly 40% of flagged setups produced a positive 10-day return above 2%.
- Manual chart review caught about 60% of the same setups, but took 3x longer.
- False positives were mostly in low-volume mid-caps where the bounce pattern was noise.

## Takeaways

- Vibe-coding a quick tool like this is a high-leverage weekend project. Total effort was about 8 hours.
- The EMA bounce strategy has signal, but needs volume and volatility filters to reduce false positives.
- Automating the screener freed up time previously spent on manual scanning for the [[procedure-monthly-portfolio-review]].
- Worth maintaining as a personal tool. Not worth productizing, but could become a newsletter content piece on [[topic-personal-finance]].
