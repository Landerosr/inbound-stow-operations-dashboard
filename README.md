# Inbound capacity and labor planning

**Research question:** How can a shift planner tell whether staffing or incoming work is the binding constraint while protecting one day of work as a reserve?

This case study draws on fulfillment-center operations experience. All volumes, rates, quality measures and labor costs are synthetic or illustrative. No confidential Amazon data or internal benchmarks are used.

## Worked scenario

Consider a 183,000-unit goal, 183,000 units of starting backlog and 15 incoming trailers of 12,200 units each. A ten-hour shift at 85% productive utilization and 260 units per productive labor hour gives:

| Scheduled associates | Labor capacity | Planned units | Ending backlog |
| ---: | ---: | ---: | ---: |
| 80 | 176,800 | 176,800 | 189,200 |
| 100 | 221,000 | 183,000 | 183,000 |

At 80 associates the shift is 6,200 units short because labor capacity is binding. At 100, throughput is capped by the goal and by the amount of work above the reserve; adding capacity past that point does not release more work. If no trailers arrive and the initial backlog just equals the reserve, adding staff does not increase planned throughput. These are model outcomes, not observed savings or a staffing recommendation. The [boundary tests](tests/planning.test.mjs) cover these cases and the production curve flattening at shift end.

## Model and data

The project deliberately separates two models.

1. **Daily scenario planner.** Incoming units equal trailer count times units per trailer. Available work is starting backlog plus incoming units. Staff capacity is headcount × shift hours × productive utilization × processing rate. Planned throughput is the minimum of the goal, capacity and available units above the reserve, floored at zero for releasable work. Ending backlog is available work less throughput. Required headcount is rounded up for the *achievable* work target, not for work missing from the inbound plan. [Planning model](lib/planning.ts)
2. **Synthetic historical case study.** A seeded Python generator produces 365 daily records with seasonal staffing, volume, quality and processing-rate variation. Backlog rolls from one day into the next. The generator processes available work subject to capacity and does not use the planner's reserve. SQLite queries summarize monthly throughput, backlog, units per face, defects, count errors, cost per unit and the frequency of rule-based staffing actions. Changing planner inputs does not recalculate this historical sample. [Generator](analytics/generate_data.py) · [SQL summaries](analytics/queries.sql) · [Data-integrity checks](analytics/test_analysis.py)

The planner's action rules cover overtime, labor sharing, voluntary time off and flex-trained staffing; the synthetic case adds quality audits and units-per-face coaching. Example assumptions are ten-hour shifts, 85% utilization, a 260-unit stow rate, a target of 13 units per face, approximately 170 peak and 80 off-peak associates, and a combined error threshold of five per 1,000 units. The historical sample uses illustrative rates of $22 for regular labor and $33 for overtime; the planner uses $22 per scheduled hour without an overtime premium.

## Limitations

The planner is a deterministic capacity calculation with action thresholds. It does not solve an optimization problem, fit a demand forecast, estimate queueing delays or establish causal effects. Its 24-hour chart assumes one shift, all incoming work available at its start, and a constant processing rate and utilization. It stops accumulating production at shift end, the goal, or the releasable-work limit. A delayed trailer or changing productivity would require a model with time-varying inputs. Likewise, relationships between quality and throughput in the synthetic sample reflect assumptions in the generator rather than evidence from observed shifts.

## Reproduce the analysis

```sh
python3 analytics/generate_data.py
python3 -m unittest analytics/test_analysis.py
node --experimental-strip-types --test tests/planning.test.mjs
```

The Node test command requires Node 22.13+. Python generates the data and SQLite stores the records. To run the optional local React/Recharts interface:

```sh
pnpm install
pnpm dev
```
