import json
import sqlite3
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class DashboardDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload = json.loads(
            (ROOT / "public" / "data" / "dashboard_data.json").read_text()
        )
        cls.rows = cls.payload["daily"]

    def test_full_year_is_present(self):
        self.assertEqual(len(self.rows), 365)

    def test_peak_headcount_is_higher(self):
        peak = [row["actual_headcount"] for row in self.rows if row["season"] == "Peak"]
        non_peak = [
            row["actual_headcount"] for row in self.rows if row["season"] == "Non-Peak"
        ]
        self.assertGreater(sum(peak) / len(peak), 160)
        self.assertLess(sum(non_peak) / len(non_peak), 90)

    def test_core_metrics_are_valid(self):
        for row in self.rows:
            self.assertGreater(row["processed_units"], 0)
            self.assertGreater(row["stow_rate_uph"], 0)
            self.assertGreaterEqual(row["ending_backlog_units"], 0)
            self.assertGreater(row["cost_per_unit"], 0)

    def test_sqlite_matches_json(self):
        connection = sqlite3.connect(ROOT / "data" / "inbound_stow.db")
        count = connection.execute("SELECT COUNT(*) FROM inbound_stow_daily").fetchone()[0]
        connection.close()
        self.assertEqual(count, len(self.rows))


if __name__ == "__main__":
    unittest.main()

