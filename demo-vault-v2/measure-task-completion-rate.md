---
aliases: ["Task Completion Rate"]
Is A: Measure
Belongs to: "[[responsibility-team-management]]"
Unit: "percent"
---
# Task Completion Rate

Task completion rate measures the percentage of planned tasks that are completed within their committed timeframe. It is the primary throughput metric for [[responsibility-team-management]] and reflects the team's ability to plan realistically and execute reliably. A consistently high completion rate indicates healthy planning, clear priorities, and manageable workload. A low rate signals overcommitment, unclear requirements, or blocked workflows.

This metric applies to the entire team's output, not just individual contributors. It surfaces systemic issues (too many priorities, poor task definition, dependency bottlenecks) rather than individual performance problems.

## How it's tracked

Calculated per sprint or per week, depending on the team's current workflow. Formula: (tasks completed on time) / (tasks committed for the period) x 100. Tasks that are explicitly descoped or deprioritized mid-period are removed from the denominator. Tasks that roll over to the next period count as incomplete. Tracked in the project management tool and summarized monthly in the tracking spreadsheet.

## Targets

- **Minimum**: 65%. Below this suggests chronic overcommitment or unclear task definitions. Requires a planning process review.
- **Target**: 75-85%. This range indicates realistic planning with a healthy margin for unexpected work and interruptions.
- **Stretch**: 90%+. Achievable in well-scoped sprints with low interrupt load. Sustained 90%+ may indicate under-commitment.

## Notes

- A completion rate consistently above 90% is a warning sign, not a success. It likely means the team is sandbagging estimates or not taking on enough ambitious work.
- The most common cause of low completion rate is not underperformance but overcommitment. The fix is usually better planning, not faster execution.
- Track alongside [[measure-team-nps]] to understand whether high completion rates are coming at the cost of team satisfaction (burnout, unsustainable pace).
- Differentiate between "completed" and "completed well." A task rushed to completion with quality shortcuts should not count the same as a properly finished task. Use [[measure-essay-quality-score]] as a proxy for content-related tasks.
- Review monthly trends rather than individual weeks. Single-week dips are normal; sustained trends over 4+ weeks require intervention.
