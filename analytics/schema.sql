DROP TABLE IF EXISTS inbound_stow_daily;

CREATE TABLE inbound_stow_daily (
  work_date TEXT PRIMARY KEY,
  month TEXT NOT NULL,
  month_number INTEGER NOT NULL,
  season TEXT NOT NULL,
  shift_hours REAL NOT NULL,
  forecasted_trailers INTEGER NOT NULL,
  units_per_trailer INTEGER NOT NULL,
  forecasted_units INTEGER NOT NULL,
  starting_backlog_units INTEGER NOT NULL,
  available_units INTEGER NOT NULL,
  actual_headcount INTEGER NOT NULL,
  required_headcount INTEGER NOT NULL,
  labor_hours REAL NOT NULL,
  stow_rate_uph REAL NOT NULL,
  tph REAL NOT NULL,
  units_per_face REAL NOT NULL,
  quality_defects_per_1000 REAL NOT NULL,
  count_errors_per_1000 REAL NOT NULL,
  processed_units INTEGER NOT NULL,
  ending_backlog_units INTEGER NOT NULL,
  backlog_hours REAL NOT NULL,
  labor_cost REAL NOT NULL,
  cost_per_unit REAL NOT NULL,
  staffing_gap INTEGER NOT NULL,
  recommended_action TEXT NOT NULL
);

