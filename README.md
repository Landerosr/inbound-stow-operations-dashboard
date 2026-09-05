# Inbound Stow Performance Dashboard

**Live dashboard:** https://landerosr.github.io/inbound-stow-operations-dashboard/

An operations analytics portfolio project based on my experience leading inbound stow. The dashboard connects a daily volume goal with headcount, labor hours, stow rate, throughput, backlog, quality, and cost.

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
