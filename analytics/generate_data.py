"""Create reproducible synthetic inbound-stow data for the portfolio dashboard.

The operating logic is based on the project author's fulfillment-center
experience. All volume, quality, and cost figures are illustrative and do not
represent confidential company data.
"""

from __future__ import annotations

import csv
import json
import math
import random
import sqlite3
from collections import Counter
from datetime import date, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PUBLIC_DATA_DIR = ROOT / "public" / "data"
SCHEMA_PATH = ROOT / "analytics" / "schema.sql"

RANDOM_SEED = 26013
SHIFT_HOURS = 10.0
PRODUCTIVE_UTILIZATION = 0.85
STOW_RATE_TARGET = 260.0
UPF_TARGET = 13.0
REGULAR_HOURLY_COST = 22.0
OVERTIME_HOURLY_COST = 33.0
QUALITY_DEFECT_LIMIT = 3.0
COUNT_ERROR_LIMIT = 2.0


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


def recommendation(
    staffing_gap: int,
    backlog_hours: float,
    upf: float,
    stow_rate: float,
    quality_defects: float,
    count_errors: float,
) -> str:
    combined_errors = quality_defects + count_errors
    if staffing_gap >= 12 or backlog_hours >= 2.5:
        return "Add OT"
    if staffing_gap >= 5:
        return "Labor share"
    if staffing_gap <= -10 and backlog_hours < 0.7:
        return "Offer VTO"
    if combined_errors > QUALITY_DEFECT_LIMIT + COUNT_ERROR_LIMIT:
        return "Quality audit"
    if upf < UPF_TARGET - 0.6 and stow_rate < STOW_RATE_TARGET:
        return "UPF coaching"
    if staffing_gap >= 2:
        return "Use flex-trained team"
    return "Maintain plan"


def create_rows() -> list[dict[str, object]]:
    rng = random.Random(RANDOM_SEED)
    rows: list[dict[str, object]] = []
    current = date(2026, 1, 1)
    ending_backlog = 10_000

    while current.year == 2026:
        peak = current.month in {1, 10, 11, 12}
        season = "Peak" if peak else "Non-Peak"
        base_headcount = 172 if peak else 82

        # Weekend schedules run slightly leaner in this illustrative model.
        weekend_adjustment = -7 if current.weekday() >= 5 else 0
        actual_headcount = max(
            55,
            round(rng.gauss(base_headcount + weekend_adjustment, 8 if peak else 5)),
        )

        units_per_trailer = round(clamp(rng.gauss(12_200, 1_050), 9_000, 15_000))
        planned_capacity = (
            base_headcount
            * SHIFT_HOURS
            * PRODUCTIVE_UTILIZATION
            * STOW_RATE_TARGET
        )
        # The average plan leaves recovery capacity, while high-variance days
        # create realistic backlog and staffing decisions.
        demand_multiplier = rng.gauss(0.92 if peak else 0.88, 0.16)
        forecasted_trailers = max(
            5, round((planned_capacity * demand_multiplier) / units_per_trailer)
        )
        forecasted_units = forecasted_trailers * units_per_trailer
        starting_backlog = ending_backlog
        available_units = starting_backlog + forecasted_units

        upf = round(clamp(rng.gauss(13.0, 1.1), 9.5, 16.5), 1)
        quality_defects = round(
            clamp(rng.gauss(2.55 + max(0.0, 12.0 - upf) * 0.18, 0.6), 1.0, 5.5),
            2,
        )
        count_errors = round(
            clamp(rng.gauss(1.65 + max(0.0, 12.0 - upf) * 0.10, 0.45), 0.5, 4.0),
            2,
        )
        stow_rate = round(
            clamp(
                STOW_RATE_TARGET
                + (upf - UPF_TARGET) * 4.0
                - (quality_defects - 2.5) * 3.0
                - (count_errors - 1.6) * 2.5
                + rng.gauss(0, 7.5),
                220.0,
                295.0,
            ),
            1,
        )

        labor_hours = round(actual_headcount * SHIFT_HOURS, 1)
        productive_hours = labor_hours * PRODUCTIVE_UTILIZATION
        capacity = productive_hours * stow_rate
        processed_units = round(min(available_units, capacity))
        ending_backlog = max(0, available_units - processed_units)
        tph = round(processed_units / SHIFT_HOURS, 1)
        backlog_hours = round(
            ending_backlog / max(actual_headcount * stow_rate, 1), 2
        )
        required_headcount = math.ceil(
            available_units
            / (SHIFT_HOURS * PRODUCTIVE_UTILIZATION * STOW_RATE_TARGET)
        )
        staffing_gap = required_headcount - actual_headcount

        overtime_heads = max(actual_headcount - base_headcount, 0)
        regular_heads = actual_headcount - overtime_heads
        labor_cost = round(
            regular_heads * SHIFT_HOURS * REGULAR_HOURLY_COST
            + overtime_heads * SHIFT_HOURS * OVERTIME_HOURLY_COST,
            2,
        )
        cost_per_unit = round(labor_cost / max(processed_units, 1), 4)

        action = recommendation(
            staffing_gap,
            backlog_hours,
            upf,
            stow_rate,
            quality_defects,
            count_errors,
        )

        rows.append(
            {
                "work_date": current.isoformat(),
                "month": current.strftime("%b"),
                "month_number": current.month,
                "season": season,
                "shift_hours": SHIFT_HOURS,
                "forecasted_trailers": forecasted_trailers,
                "units_per_trailer": units_per_trailer,
                "forecasted_units": forecasted_units,
                "starting_backlog_units": starting_backlog,
                "available_units": available_units,
                "actual_headcount": actual_headcount,
                "required_headcount": required_headcount,
                "labor_hours": labor_hours,
                "stow_rate_uph": stow_rate,
                "tph": tph,
                "units_per_face": upf,
                "quality_defects_per_1000": quality_defects,
                "count_errors_per_1000": count_errors,
                "processed_units": processed_units,
                "ending_backlog_units": ending_backlog,
                "backlog_hours": backlog_hours,
                "labor_cost": labor_cost,
                "cost_per_unit": cost_per_unit,
                "staffing_gap": staffing_gap,
                "recommended_action": action,
            }
        )
        current += timedelta(days=1)

    return rows


def average(rows: list[dict[str, object]], field: str) -> float:
    return sum(float(row[field]) for row in rows) / len(rows)


def monthly_summary(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    summary: list[dict[str, object]] = []
    for month_number in range(1, 13):
        month_rows = [row for row in rows if row["month_number"] == month_number]
        summary.append(
            {
                "month": month_rows[0]["month"],
                "month_number": month_number,
                "season": month_rows[0]["season"],
                "forecasted_units": round(average(month_rows, "forecasted_units")),
                "processed_units": round(average(month_rows, "processed_units")),
                "ending_backlog_units": round(
                    average(month_rows, "ending_backlog_units")
                ),
                "backlog_hours": round(average(month_rows, "backlog_hours"), 1),
                "forecasted_trailers": round(
                    average(month_rows, "forecasted_trailers"), 1
                ),
                "actual_headcount": round(average(month_rows, "actual_headcount"), 1),
                "required_headcount": round(
                    average(month_rows, "required_headcount"), 1
                ),
                "stow_rate_uph": round(average(month_rows, "stow_rate_uph"), 1),
                "tph": round(average(month_rows, "tph")),
                "units_per_face": round(average(month_rows, "units_per_face"), 1),
                "quality_defects_per_1000": round(
                    average(month_rows, "quality_defects_per_1000"), 2
                ),
                "count_errors_per_1000": round(
                    average(month_rows, "count_errors_per_1000"), 2
                ),
                "cost_per_unit": round(average(month_rows, "cost_per_unit"), 4),
            }
        )
    return summary


def upf_summary(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    output: list[dict[str, object]] = []
    for band in range(10, 17):
        band_rows = [row for row in rows if round(float(row["units_per_face"])) == band]
        if not band_rows:
            continue
        output.append(
            {
                "upf": band,
                "stow_rate_uph": round(average(band_rows, "stow_rate_uph"), 1),
                "combined_errors_per_1000": round(
                    average(band_rows, "quality_defects_per_1000")
                    + average(band_rows, "count_errors_per_1000"),
                    2,
                ),
            }
        )
    return output


def build_dashboard_payload(rows: list[dict[str, object]]) -> dict[str, object]:
    actions = Counter(str(row["recommended_action"]) for row in rows)
    return {
        "metadata": {
            "title": "Inbound Stow Performance Dashboard",
            "period": "Jan 1–Dec 31, 2026",
            "disclaimer": (
                "Synthetic portfolio data. No confidential employer data is used."
            ),
            "targets": {
                "stow_rate_uph": STOW_RATE_TARGET,
                "units_per_face": UPF_TARGET,
                "quality_defects_per_1000": QUALITY_DEFECT_LIMIT,
                "count_errors_per_1000": COUNT_ERROR_LIMIT,
            },
            "assumptions": {
                "shift_hours": SHIFT_HOURS,
                "productive_utilization": PRODUCTIVE_UTILIZATION,
                "regular_hourly_cost": REGULAR_HOURLY_COST,
                "overtime_hourly_cost": OVERTIME_HOURLY_COST,
                "peak_months": ["Jan", "Oct", "Nov", "Dec"],
            },
        },
        "daily": rows,
        "monthly": monthly_summary(rows),
        "upf_relationship": upf_summary(rows),
        "action_counts": [
            {"action": action, "days": count}
            for action, count in actions.most_common()
        ],
    }


def write_outputs(rows: list[dict[str, object]]) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)

    csv_path = DATA_DIR / "inbound_stow_metrics.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    db_path = DATA_DIR / "inbound_stow.db"
    connection = sqlite3.connect(db_path)
    connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    columns = list(rows[0].keys())
    placeholders = ", ".join("?" for _ in columns)
    connection.executemany(
        f"INSERT INTO inbound_stow_daily ({', '.join(columns)}) VALUES ({placeholders})",
        [[row[column] for column in columns] for row in rows],
    )
    connection.commit()
    connection.close()

    payload = build_dashboard_payload(rows)
    json_path = PUBLIC_DATA_DIR / "dashboard_data.json"
    json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


if __name__ == "__main__":
    generated_rows = create_rows()
    write_outputs(generated_rows)
    print(f"Generated {len(generated_rows)} daily records.")
