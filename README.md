# Quantitative Operations Analysis: Capacity, Backlog and Labor Planning

**[Open the dashboard](https://landerosr.github.io/inbound-stow-operations-dashboard/)** · [Planning model](lib/planning.ts) · [Synthetic-data generator](analytics/generate_data.py)

An operations-research case study connecting staffing capacity, incoming work,
backlog, productive utilization, quality and unit labor cost. The project uses
a reproducible synthetic dataset and a separate interactive planning model.

**Research question:** How do labor availability, processing rates and inbound
volume constrain the achievable daily plan while preserving a work reserve?

## Quantitative methods and theory

- **Flow conservation:** ending backlog equals starting backlog plus inbound
  units minus processed units.
- **Capacity analysis:** shift capacity equals headcount × shift hours ×
  productive utilization × units processed per productive labor hour.
- **Constrained planning:** the live planner caps processing at the smallest of
  the daily goal, staffing capacity and work available above the protected
  reserve. Required headcount is rounded up for the feasible work target.
- **Scenario analysis:** editable assumptions expose the effect of staffing,
  productivity, shift length and trailer volume on throughput and cost.
- **Reproducible stochastic data generation:** seeded synthetic variation in
  staffing, demand, quality and processing rates creates a 365-day case study.
- **Descriptive statistics and SQL aggregation:** compare monthly and seasonal
  operating metrics and summarize rule-based staffing actions.

The live planner is a deterministic capacity model with decision heuristics.
It does not solve a mathematical optimization problem, fit a statistical demand
forecast, or estimate waiting times from a queueing model. The synthetic case
study does not establish causal effects or realized operational savings.

## Model evidence and checks

- [Planning formulas](lib/planning.ts) and [boundary-condition tests](tests/planning.test.mjs).
- [Synthetic generation](analytics/generate_data.py), [SQL queries](analytics/queries.sql)
  and [data-integrity checks](analytics/test_analysis.py).
- The synthetic historical generator and live planner are distinct models:
  the live planner protects a one-day reserve, while the historical simulation
  processes available work subject to capacity. Historical charts do not
  recompute when the live planning inputs change.

The project uses synthetic data only. It does not contain confidential Amazon information or internal company benchmarks.

## Business question

How should an inbound team adjust labor when forecasted volume, backlog, stow performance, and quality change during peak and non-peak periods?

## What the dashboard tracks

- Daily volume goal
- Starting and ending backlog in units and hours of work
- Actual versus required headcount
- Labor hours, stow rate (UPH), and throughput per hour (TPH)
- Units per face (UPF), quality defects, and count errors
- Estimated labor cost per processed unit

## Decisions modeled

The simplified planner recommends adding overtime, offering voluntary time off, labor sharing, using flex-trained associates, or maintaining the plan. The historical case-study data also tracks UPF coaching and quality-audit decisions.

## Live planning tool

The daily planner uses headcount, volume goal, estimated stow rate, shift length, starting backlog, and incoming trailers. Units per trailer can be edited under the expandable assumptions section.

One day of reserve equals the daily volume goal. Available work is starting backlog plus incoming trailers multiplied by estimated units per trailer. Planned processing is the lowest of the daily goal, staffing capacity, and work available above the reserve. If there is not enough incoming work, the planner identifies the shortfall instead of recommending extra labor to process the reserve. Required headcount refers to this achievable processing plan.

The planner assumes incoming volume becomes available during the shift; it does not model trailer arrival times. Cost uses $22 per scheduled labor hour and excludes overtime premiums. Historical synthetic charts remain a separate case study and do not change with planner inputs.

## Tools

- Python generates one year of reproducible synthetic shift data.
- SQL and SQLite store and summarize the operating metrics.
- React and Recharts provide the interactive dashboard.

## Run the analysis

```bash
python3 analytics/generate_data.py
python3 -m unittest analytics/test_analysis.py
```

## Run the dashboard

```bash
pnpm install
pnpm dev
```

## Sample assumptions

- 10-hour shifts
- 260 UPH stow-rate target
- 13 UPF target
- Approximately 170 associates during four peak months
- Approximately 80 associates during non-peak months
- 85% productive utilization
- Illustrative labor rates of $22 regular and $33 overtime
- Illustrative quality threshold of no more than five combined defects and count errors per 1,000 units

### Next 24 hours production projection

The live planner includes a cumulative production line and volume-goal comparison from hour 0 through hour 24. It recalculates with the planning inputs. One shift begins at hour 0; all planned inbound is assumed available at the start, staffing and rate are constant, and productive utilization is 85%. Production stops at shift end, the volume goal, or available volume after retaining the one-day reserve. No additional shifts or arrivals are assumed. This is a scenario-based planning estimate, not a statistically fitted forecast. Historical charts show the full sample without season or month filters.

Validate the projection with `node --experimental-strip-types --test tests/planning.test.mjs` (Node 22.13+).
