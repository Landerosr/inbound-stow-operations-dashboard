-- Monthly operating summary used by the dashboard.
SELECT
  month_number,
  month,
  season,
  ROUND(AVG(stow_rate_uph), 1) AS avg_stow_rate_uph,
  ROUND(AVG(units_per_face), 1) AS avg_units_per_face,
  ROUND(AVG(actual_headcount), 1) AS avg_headcount,
  ROUND(AVG(tph), 0) AS avg_tph,
  ROUND(AVG(ending_backlog_units), 0) AS avg_backlog_units,
  ROUND(AVG(backlog_hours), 1) AS avg_backlog_hours,
  ROUND(AVG(quality_defects_per_1000), 2) AS avg_quality_defects_per_1000,
  ROUND(AVG(count_errors_per_1000), 2) AS avg_count_errors_per_1000,
  ROUND(AVG(cost_per_unit), 4) AS avg_cost_per_unit
FROM inbound_stow_daily
GROUP BY month_number, month, season
ORDER BY month_number;

-- Shows which staffing action was recommended most often.
SELECT
  recommended_action,
  COUNT(*) AS shift_days
FROM inbound_stow_daily
GROUP BY recommended_action
ORDER BY shift_days DESC;

-- Demonstrates the relationship between UPF, quality, and stow rate.
SELECT
  ROUND(units_per_face, 0) AS upf_band,
  ROUND(AVG(stow_rate_uph), 1) AS avg_stow_rate_uph,
  ROUND(AVG(quality_defects_per_1000 + count_errors_per_1000), 2)
    AS combined_errors_per_1000
FROM inbound_stow_daily
GROUP BY ROUND(units_per_face, 0)
ORDER BY upf_band;

