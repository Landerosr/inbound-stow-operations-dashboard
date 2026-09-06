'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Boxes,
  Calculator,
  Clock,
  Code,
  Database,
  Gauge,
  PackageCheck,
  ShieldCheck,
  Truck,
  Users,
  RotateCcw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type DailyMetric = {
  work_date: string;
  month: string;
  month_number: number;
  season: 'Peak' | 'Non-Peak';
  shift_hours: number;
  forecasted_trailers: number;
  units_per_trailer: number;
  forecasted_units: number;
  starting_backlog_units: number;
  available_units: number;
  actual_headcount: number;
  required_headcount: number;
  labor_hours: number;
  stow_rate_uph: number;
  tph: number;
  units_per_face: number;
  quality_defects_per_1000: number;
  count_errors_per_1000: number;
  processed_units: number;
  ending_backlog_units: number;
  backlog_hours: number;
  labor_cost: number;
  cost_per_unit: number;
  staffing_gap: number;
  recommended_action: string;
};

type MonthlyMetric = {
  month: string;
  month_number: number;
  season: 'Peak' | 'Non-Peak';
  forecasted_units: number;
  processed_units: number;
  ending_backlog_units: number;
  backlog_hours: number;
  forecasted_trailers: number;
  actual_headcount: number;
  required_headcount: number;
  stow_rate_uph: number;
  tph: number;
  units_per_face: number;
  quality_defects_per_1000: number;
  count_errors_per_1000: number;
  cost_per_unit: number;
};

type DashboardData = {
  metadata: {
    title: string;
    period: string;
    disclaimer: string;
    targets: {
      stow_rate_uph: number;
      units_per_face: number;
      quality_defects_per_1000: number;
      count_errors_per_1000: number;
    };
    assumptions: {
      shift_hours: number;
      productive_utilization: number;
      regular_hourly_cost: number;
      overtime_hourly_cost: number;
      peak_months: string[];
    };
  };
  daily: DailyMetric[];
  monthly: MonthlyMetric[];
  upf_relationship: Array<{
    upf: number;
    stow_rate_uph: number;
    combined_errors_per_1000: number;
  }>;
  action_counts: Array<{ action: string; days: number }>;
};

type DashboardToolInput = { season?: string; month?: string };
type ScenarioInput = {
  incomingTrailers: number;
  unitsPerTrailer: number;
  volumeGoal: number;
  startingBacklogUnits: number;
  headcount: number;
  shiftHours: number;
  stowRate: number;
};

type ScenarioResult = {
  reserveUnits: number;
  reserveShortfall: number;
  goalShortfall: number;
  backlogDays: number;
  forecastedUnits: number;
  availableUnits: number;
  laborHours: number;
  capacityUnits: number;
  processedUnits: number;
  endingBacklogUnits: number;
  backlogHours: number;
  tph: number;
  requiredHeadcount: number;
  staffingGap: number;
  costPerUnit: number;
  recommendedAction: string;
};
type ModelContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => object;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};

const months = [
  ['all', 'All months'], ['1', 'January'], ['2', 'February'],
  ['3', 'March'], ['4', 'April'], ['5', 'May'], ['6', 'June'],
  ['7', 'July'], ['8', 'August'], ['9', 'September'],
  ['10', 'October'], ['11', 'November'], ['12', 'December'],
];

const colors = {
  cyan: '#34343a', amber: '#83838e', green: '#656570',
  red: '#b8b8c0', muted: '#c9c9cf', grid: '#e7e7eb',
};

const scenarioDefaults: ScenarioInput = {
  incomingTrailers: 15,
  unitsPerTrailer: 12_200,
  volumeGoal: 183_000,
  startingBacklogUnits: 183_000,
  headcount: 80,
  shiftHours: 10,
  stowRate: 260,
};

const PRODUCTIVE_UTILIZATION = 0.85;
const HOURLY_LABOR_COST = 22;

function calculateScenario(input: ScenarioInput): ScenarioResult {
  const forecastedUnits = input.incomingTrailers * input.unitsPerTrailer;
  const availableUnits = forecastedUnits + input.startingBacklogUnits;
  const reserveUnits = input.volumeGoal;
  const releasableUnits = Math.max(0, availableUnits - reserveUnits);
  const laborHours = input.headcount * input.shiftHours;
  const productiveHours = laborHours * PRODUCTIVE_UTILIZATION;
  const capacityUnits = productiveHours * input.stowRate;
  const processedUnits = Math.min(input.volumeGoal, releasableUnits, capacityUnits);
  const endingBacklogUnits = Math.max(0, availableUnits - processedUnits);
  const backlogHours = endingBacklogUnits / Math.max(input.headcount * input.stowRate, 1);
  const tph = processedUnits / Math.max(input.shiftHours, 1);
  const requiredHeadcount = Math.ceil(
    Math.min(input.volumeGoal, releasableUnits) /
      Math.max(input.shiftHours * PRODUCTIVE_UTILIZATION * input.stowRate, 1),
  );
  const staffingGap = requiredHeadcount - input.headcount;
  const costPerUnit = (laborHours * HOURLY_LABOR_COST) / Math.max(processedUnits, 1);

  let recommendedAction = 'Maintain plan';
  if (availableUnits < reserveUnits) recommendedAction = 'Rebuild the reserve';
  else if (releasableUnits < input.volumeGoal) recommendedAction = 'More inbound volume needed';
  else if (staffingGap >= 12) recommendedAction = 'Add OT';
  else if (staffingGap >= 5) recommendedAction = 'Labor share';
  else if (staffingGap <= -10) recommendedAction = 'Consider VTO or labor share';
  else if (staffingGap > 0) recommendedAction = 'Use flex-trained team';

  return {
    reserveUnits,
    reserveShortfall: Math.max(0, reserveUnits - endingBacklogUnits),
    goalShortfall: Math.max(0, input.volumeGoal - processedUnits),
    backlogDays: reserveUnits > 0 ? endingBacklogUnits / reserveUnits : 0,
    forecastedUnits,
    availableUnits,
    laborHours,
    capacityUnits,
    processedUnits,
    endingBacklogUnits,
    backlogHours,
    tph,
    requiredHeadcount,
    staffingGap,
    costPerUnit,
    recommendedAction,
  };
}

function average(rows: DailyMetric[], key: keyof DailyMetric) {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + Number(row[key]), 0) / rows.length;
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact', maximumFractionDigits: 1,
  }).format(value);
}

function MetricCard({ icon: Icon, label, value, detail, status = 'neutral' }: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  status?: 'good' | 'watch' | 'neutral';
}) {
  return (
    <Card className="metric-card" size="sm">
      <CardHeader className="metric-header">
        <div>
          <CardDescription className="metric-label">{label}</CardDescription>
          <CardTitle className="metric-value">{value}</CardTitle>
        </div>
        <span className={`metric-icon metric-icon-${status}`}><Icon aria-hidden="true" /></span>
      </CardHeader>
      <CardContent>
        <p className={`metric-detail metric-detail-${status}`}>{detail}</p>
      </CardContent>
    </Card>
  );
}

function ChartShell({ title, description, children, className = '' }: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`chart-card ${className}`}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="chart-content">{children}</CardContent>
    </Card>
  );
}

function NumberField({ label, field, value, setScenario, suffix, step = 1 }: {
  label: string;
  field: keyof ScenarioInput;
  value: number;
  setScenario: React.Dispatch<React.SetStateAction<ScenarioInput>>;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="scenario-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            setScenario((current) => ({
              ...current,
              [field]: Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0,
            }));
          }}
        />
        {suffix ? <small>{suffix}</small> : null}
      </div>
    </label>
  );
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [season, setSeason] = useState('all');
  const [month, setMonth] = useState('all');
  const [scenario, setScenario] = useState<ScenarioInput>(scenarioDefaults);
  const scenarioResult = useMemo(() => calculateScenario(scenario), [scenario]);

  useEffect(() => {
    void fetch('./data/dashboard_data.json')
      .then((response) => response.json())
      .then((payload) => setData(payload as DashboardData))
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const validSeasons = new Set(['all', 'Peak', 'Non-Peak']);
    const validMonths = new Set(months.map(([value]) => value));

    void Promise.resolve(
      context.registerTool(
        {
          name: 'configure_dashboard_view',
          title: 'Configure dashboard view',
          description: 'Set the visible season and month filters on the inbound-stow dashboard.',
          inputSchema: {
            type: 'object',
            properties: {
              season: { type: 'string', enum: ['all', 'Peak', 'Non-Peak'] },
              month: { type: 'string', enum: months.map(([value]) => value) },
            },
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            const requested = input as DashboardToolInput;
            const nextSeason = requested.season ?? 'all';
            const nextMonth = requested.month ?? 'all';
            if (!validSeasons.has(nextSeason) || !validMonths.has(nextMonth)) {
              throw new Error('Invalid dashboard filter.');
            }
            setSeason(nextSeason);
            setMonth(nextMonth);
            return { season: nextSeason, month: nextMonth };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);

    void Promise.resolve(
      context.registerTool(
        {
          name: 'calculate_inbound_plan',
          title: 'Calculate inbound plan',
          description: 'Calculate a trailer-based inbound plan while retaining one daily volume goal as backlog reserve.',
          inputSchema: {
            type: 'object',
            properties: {
              incomingTrailers: { type: 'number', minimum: 0 },
              unitsPerTrailer: { type: 'number', minimum: 0 },
              volumeGoal: { type: 'number', minimum: 0 },
              startingBacklogUnits: { type: 'number', minimum: 0 },
              headcount: { type: 'number', minimum: 0 },
              shiftHours: { type: 'number', minimum: 0 },
              stowRate: { type: 'number', minimum: 0 },
            },
            required: Object.keys(scenarioDefaults),
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            const requested = input as ScenarioInput;
            const values = Object.values(requested);
            if (values.length !== Object.keys(scenarioDefaults).length || values.some((value) => !Number.isFinite(value) || value < 0)) {
              throw new Error('All planning inputs must be valid non-negative numbers.');
            }
            setScenario(requested);
            return calculateScenario(requested);
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);

    return () => lifecycle.abort();
  }, []);

  const filteredDaily = useMemo(() => {
    if (!data) return [];
    return data.daily.filter((row) =>
      (season === 'all' || row.season === season) &&
      (month === 'all' || row.month_number === Number(month)),
    );
  }, [data, month, season]);

  const filteredMonthly = useMemo(() => {
    if (!data) return [];
    return data.monthly.filter((row) =>
      (season === 'all' || row.season === season) &&
      (month === 'all' || row.month_number === Number(month)),
    );
  }, [data, month, season]);

  if (!data) {
    return <main className="loading-screen"><Activity className="animate-pulse" /><p>Loading operating model…</p></main>;
  }

  const target = data.metadata.targets;
  const avgRate = average(filteredDaily, 'stow_rate_uph');
  const avgUpf = average(filteredDaily, 'units_per_face');
  const avgHeadcount = average(filteredDaily, 'actual_headcount');
  const avgRequiredHeadcount = average(filteredDaily, 'required_headcount');
  const avgTph = average(filteredDaily, 'tph');
  const avgTrailers = average(filteredDaily, 'forecasted_trailers');
  const avgBacklog = average(filteredDaily, 'ending_backlog_units');
  const avgBacklogHours = average(filteredDaily, 'backlog_hours');
  const avgCost = average(filteredDaily, 'cost_per_unit');
  const avgQuality = average(filteredDaily, 'quality_defects_per_1000');
  const avgCount = average(filteredDaily, 'count_errors_per_1000');

  const decisionCounts = filteredDaily.reduce<Record<string, number>>((counts, row) => {
    counts[row.recommended_action] = (counts[row.recommended_action] || 0) + 1;
    return counts;
  }, {});
  const leadingDecision = Object.entries(decisionCounts).sort((a, b) => b[1] - a[1])[0] || ['Maintain plan', 0];

  const trendData = month === 'all'
    ? filteredMonthly.map((row) => ({
        label: row.month, forecast: row.forecasted_units, processed: row.processed_units,
        backlog: row.ending_backlog_units, actualHeadcount: row.actual_headcount,
        requiredHeadcount: row.required_headcount,
      }))
    : filteredDaily.filter((_, index) => index % 3 === 0).map((row) => ({
        label: row.work_date.slice(5), forecast: row.forecasted_units,
        processed: row.processed_units, backlog: row.ending_backlog_units,
        actualHeadcount: row.actual_headcount, requiredHeadcount: row.required_headcount,
      }));

  const qualityData = filteredMonthly.map((row) => ({
    month: row.month, quality: row.quality_defects_per_1000,
    count: row.count_errors_per_1000, rate: row.stow_rate_uph,
  }));

  const actionRows = Object.entries(decisionCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">RL</div>
          <div>
            <p className="eyebrow">Operations analytics case study</p>
            <h1>Inbound Stow Control Tower</h1>
          </div>
        </div>
        <div className="header-meta">
          <Badge className="status-badge"><span className="status-dot" /> Synthetic data</Badge>
          <p>Rodolfo Landeros · 2026 operating model</p>
        </div>
      </header>

      <section className="control-row" aria-label="Dashboard controls">
        <div>
          <p className="section-kicker">Decision support</p>
          <h2>Plan today. Protect tomorrow.</h2>
          <p>Balance incoming trailers, staffing, and a full day of work in reserve.</p>
        </div>
        <div className="filters">
          <label htmlFor="season-filter">Season
            <NativeSelect id="season-filter" aria-label="Filter by season" value={season} onChange={(event) => { setSeason(event.target.value); setMonth('all'); }}>
              <NativeSelectOption value="all">All seasons</NativeSelectOption>
              <NativeSelectOption value="Peak">Peak</NativeSelectOption>
              <NativeSelectOption value="Non-Peak">Non-Peak</NativeSelectOption>
            </NativeSelect>
          </label>
          <label htmlFor="month-filter">Month
            <NativeSelect id="month-filter" aria-label="Filter by month" value={month} onChange={(event) => setMonth(event.target.value)}>
              {months.filter(([value]) => value === 'all' || season === 'all' || data.monthly.some((row) => row.season === season && row.month_number === Number(value))).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
            </NativeSelect>
          </label>
        </div>
      </section>

      <section className="scenario-planner" aria-labelledby="scenario-heading">
        <Card className="scenario-input-card">
          <CardHeader className="scenario-card-header">
            <div>
              <p className="section-kicker">Live planning tool</p>
              <CardTitle id="scenario-heading">Build today&apos;s plan</CardTitle>
              <CardDescription>Adjust your shift. See the plan respond.</CardDescription>
            </div>
            <button className="reset-button" type="button" onClick={() => setScenario(scenarioDefaults)}>
              <RotateCcw aria-hidden="true" /> Reset sample
            </button>
          </CardHeader>
          <CardContent>
            <div className="scenario-fieldset">
              <div className="scenario-group">
                <div className="quick-plan" aria-label="Quick staffing and arrival adjustments">
                  <span>Try a change</span>
                  <div>
                    <button type="button" onClick={() => setScenario(s => ({ ...s, headcount: s.headcount + 5 }))}>+5 people</button>
                    <button type="button" disabled={scenario.headcount < 5} onClick={() => setScenario(s => ({ ...s, headcount: Math.max(0, s.headcount - 5) }))}>−5 people</button>
                    <button type="button" onClick={() => setScenario(s => ({ ...s, incomingTrailers: s.incomingTrailers + 1 }))}>+1 trailer</button>
                    <button type="button" disabled={scenario.incomingTrailers < 1} onClick={() => setScenario(s => ({ ...s, incomingTrailers: Math.max(0, s.incomingTrailers - 1) }))}>−1 trailer</button>
                  </div>
                </div>
                <h3>Today&apos;s inputs</h3>
                <div className="scenario-input-grid">
                  <NumberField label="Volume goal" field="volumeGoal" value={scenario.volumeGoal} setScenario={setScenario} suffix="units" />
                  <NumberField label="Headcount" field="headcount" value={scenario.headcount} setScenario={setScenario} />
                  <NumberField label="Estimated stow rate" field="stowRate" value={scenario.stowRate} setScenario={setScenario} suffix="UPH" />
                  <NumberField label="Shift length" field="shiftHours" value={scenario.shiftHours} setScenario={setScenario} suffix="hours" step={0.5} />
                  <NumberField label="Starting backlog" field="startingBacklogUnits" value={scenario.startingBacklogUnits} setScenario={setScenario} suffix="units" />
                  <NumberField label="Incoming trailers today" field="incomingTrailers" value={scenario.incomingTrailers} setScenario={setScenario} />
                </div>
                <details className="planning-details"><summary>Trailer estimate & assumptions</summary>
                  <NumberField label="Estimated units per trailer" field="unitsPerTrailer" value={scenario.unitsPerTrailer} setScenario={setScenario} suffix="units" />
                  <p className="scenario-assumption-note">Reserve = one daily volume goal. Assumes trailers are available during the shift, 85% productive time, and $22/hour labor cost. Arrival timing and overtime premiums are not modeled.</p>
                </details>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="scenario-result-card" aria-live="polite">
          <CardHeader>
            <div className="scenario-result-heading">
              <div>
                <p className="section-kicker">Recommended response</p>
                <CardTitle>{scenarioResult.recommendedAction}</CardTitle>
              </div>
              <span><Calculator aria-hidden="true" /></span>
            </div>
            <CardDescription>{scenarioResult.goalShortfall > 0 ? `${compact(scenarioResult.goalShortfall)} units below today's goal under this plan.` : 'Today’s goal is covered with tomorrow’s reserve protected.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="scenario-result-grid">
              <div><span>Tomorrow’s reserve</span><strong>{scenarioResult.backlogDays.toFixed(2)} days</strong></div>
              <div><span>Incoming volume</span><strong>{compact(scenarioResult.forecastedUnits)}</strong></div>
              <div><span>Total work available</span><strong>{compact(scenarioResult.availableUnits)}</strong></div>
              <div><span>Shift capacity</span><strong>{compact(scenarioResult.capacityUnits)}</strong></div>
              <div><span>Planned processing</span><strong>{compact(scenarioResult.processedUnits)}</strong></div>
              <div><span>Ending backlog</span><strong>{compact(scenarioResult.endingBacklogUnits)}</strong></div>
              <div><span>Backlog hours</span><strong>{scenarioResult.backlogHours.toFixed(1)}</strong></div>
              <div><span>HC for available plan</span><strong>{scenarioResult.requiredHeadcount}</strong></div>
              <div><span>Staffing gap</span><strong>{scenarioResult.staffingGap > 0 ? '+' : ''}{scenarioResult.staffingGap}</strong></div>
              <div><span>Throughput</span><strong>{compact(scenarioResult.tph)} TPH</strong></div>
              <div><span>Labor hours</span><strong>{scenarioResult.laborHours.toFixed(0)}</strong></div>
              <div><span>Cost per unit</span><strong>{scenarioResult.processedUnits > 0 ? `$${scenarioResult.costPerUnit.toFixed(3)}` : '—'}</strong></div>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="control-row"><div><p className="section-kicker">Historical case study</p><h2>Performance over time</h2><p>Synthetic shift data, filtered by season and month. Separate from your live plan above.</p></div></div>
      <section className="metric-grid" aria-label="Key performance indicators">
        <MetricCard icon={Gauge} label="Stow rate" value={`${avgRate.toFixed(1)} UPH`} detail={`${avgRate >= target.stow_rate_uph ? 'At/above' : 'Below'} ${target.stow_rate_uph} target`} status={avgRate >= target.stow_rate_uph ? 'good' : 'watch'} />
        <MetricCard icon={Boxes} label="Units per face" value={avgUpf.toFixed(1)} detail={`${avgUpf >= target.units_per_face ? 'At/above' : 'Below'} ${target.units_per_face} target`} status={avgUpf >= target.units_per_face ? 'good' : 'watch'} />
        <MetricCard icon={Users} label="Headcount" value={avgHeadcount.toFixed(1)} detail={`${compact(average(filteredDaily, 'labor_hours'))} labor hrs · ${Math.abs(avgRequiredHeadcount - avgHeadcount).toFixed(1)} ${avgRequiredHeadcount > avgHeadcount ? 'below' : 'above'} need`} status={Math.abs(avgRequiredHeadcount - avgHeadcount) <= 5 ? 'good' : 'watch'} />
        <MetricCard icon={Activity} label="Throughput" value={`${compact(avgTph)} TPH`} detail={`${compact(avgTph * data.metadata.assumptions.shift_hours)} units per 10-hour shift`} />
        <MetricCard icon={Truck} label="Inbound forecast" value={`${avgTrailers.toFixed(1)} trailers`} detail={`${compact(average(filteredDaily, 'forecasted_units'))} units · ${compact(average(filteredDaily, 'units_per_trailer'))}/trailer`} />
        <MetricCard icon={Clock} label="Backlog" value={`${compact(avgBacklog)} units`} detail={`${avgBacklogHours.toFixed(1)} hours · ${(avgBacklog / Math.max(average(filteredDaily, 'units_per_trailer'), 1)).toFixed(1)} trailers`} status={avgBacklogHours <= 1.5 ? 'good' : 'watch'} />
      </section>

      <section className="primary-grid">
        <ChartShell title="Volume plan vs. processed units" description="Forecasted trailer units, units completed, and ending backlog" className="volume-chart">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <ComposedChart data={trendData} margin={{ left: 4, right: 8, top: 10, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={48} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e2e5', color: '#222226' }} />
              <Legend />
              <Bar dataKey="forecast" name="Forecast units" fill={colors.muted} radius={[3, 3, 0, 0]} />
              <Bar dataKey="processed" name="Processed units" fill={colors.cyan} radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="backlog" name="Backlog units" stroke={colors.amber} strokeWidth={2.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartShell>

        <Card className="decision-card">
          <CardHeader>
            <div className="decision-title-row">
              <div><p className="section-kicker">Recommended response</p><CardTitle>{leadingDecision[0]}</CardTitle></div>
              <span className="decision-icon"><AlertTriangle aria-hidden="true" /></span>
            </div>
            <CardDescription>Most frequent rule-based decision for the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="decision-stat"><strong>{leadingDecision[1]}</strong><span>of {filteredDaily.length} shift-days</span></div>
            <div className="decision-rules">
              <div><span>Capacity gap</span><strong>{(avgRequiredHeadcount - avgHeadcount).toFixed(1)} people</strong></div>
              <div><span>Combined errors</span><strong>{(avgQuality + avgCount).toFixed(2)} / 1K</strong></div>
              <div><span>Labor cost</span><strong>${avgCost.toFixed(3)} / unit</strong></div>
            </div>
            <p className="decision-note">Actions are prioritized by backlog and staffing need, then quality and UPF. Options include OT, VTO, labor share, flex-trained associates, coaching, and quality review.</p>
          </CardContent>
        </Card>
      </section>

      <section className="secondary-grid">
        <ChartShell title="Staffing vs. modeled need" description="Actual headcount compared with required headcount">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={trendData} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e2e5', color: '#222226' }} />
              <Legend />
              <Line type="monotone" dataKey="actualHeadcount" name="Actual HC" stroke={colors.cyan} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="requiredHeadcount" name="Required HC" stroke={colors.amber} strokeWidth={2.5} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell title="UPF and rate relationship" description="Higher units per face generally supports stronger stow rates">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <ScatterChart margin={{ left: 0, right: 14, top: 10, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} />
              <XAxis dataKey="upf" name="UPF" type="number" domain={[9, 17]} tickLine={false} />
              <YAxis dataKey="stow_rate_uph" name="Stow rate" type="number" domain={[230, 285]} tickLine={false} width={38} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#ffffff', border: '1px solid #e2e2e5', color: '#222226' }} />
              <ReferenceLine x={target.units_per_face} stroke={colors.amber} strokeDasharray="4 4" />
              <ReferenceLine y={target.stow_rate_uph} stroke={colors.green} strokeDasharray="4 4" />
              <Scatter data={data.upf_relationship} fill={colors.cyan} />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartShell>

        <ChartShell title="Quality, count errors, and rate" description="Lower errors support faster stow rates and stronger TPH">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart data={qualityData} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
              <CartesianGrid stroke={colors.grid} vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis yAxisId="errors" tickLine={false} axisLine={false} width={28} />
              <YAxis yAxisId="rate" orientation="right" domain={[240, 275]} tickLine={false} axisLine={false} width={32} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e2e5', color: '#222226' }} />
              <Legend />
              <Bar yAxisId="errors" dataKey="quality" name="Quality defects" stackId="errors" fill={colors.amber} />
              <Bar yAxisId="errors" dataKey="count" name="Count errors" stackId="errors" fill={colors.red} radius={[3, 3, 0, 0]} />
              <Line yAxisId="rate" type="monotone" dataKey="rate" name="Stow rate" stroke={colors.cyan} strokeWidth={2.25} dot={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartShell>
      </section>

      <section className="detail-grid">
        <Card className="table-card">
          <CardHeader><CardTitle>Decision frequency</CardTitle><CardDescription>How often each operating response was triggered</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Response</TableHead><TableHead className="text-right">Days</TableHead><TableHead className="text-right">Share</TableHead></TableRow></TableHeader>
              <TableBody>{actionRows.map(([action, days]) => (
                <TableRow key={action}><TableCell>{action}</TableCell><TableCell className="text-right">{days}</TableCell><TableCell className="text-right">{((days / Math.max(filteredDaily.length, 1)) * 100).toFixed(1)}%</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="method-card">
          <CardHeader><CardTitle>How the model works</CardTitle><CardDescription>Connecting operating data with daily labor decisions</CardDescription></CardHeader>
          <CardContent><ol className="method-list">
            <li><Truck /><div><strong>Forecast work</strong><span>Incoming trailers × units per trailer + starting backlog</span></div></li>
            <li><Users /><div><strong>Estimate capacity</strong><span>Headcount × shift length × 85% productive time × stow rate</span></div></li>
            <li><PackageCheck /><div><strong>Protect tomorrow</strong><span>Retain one daily volume goal before allocating today’s work</span></div></li>
            <li><ShieldCheck /><div><strong>Recommend action</strong><span>OT, VTO, labor share, cross-training, coaching, or audit</span></div></li>
          </ol></CardContent>
        </Card>

        <Card className="assumption-card">
          <CardHeader><CardTitle>Model assumptions</CardTitle><CardDescription>Transparent inputs used for this case study</CardDescription></CardHeader>
          <CardContent><dl className="assumption-list">
            <div><dt>Sample shift length</dt><dd>10 hours</dd></div>
            <div><dt>Productive time</dt><dd>85%</dd></div>
            <div><dt>Peak headcount</dt><dd>~170 associates</dd></div>
            <div><dt>Non-peak headcount</dt><dd>~80 associates</dd></div>
            <div><dt>Quality threshold</dt><dd>≤ 5 combined / 1K</dd></div>
            <div><dt>Cost assumptions</dt><dd>$22 regular · $33 OT</dd></div>
          </dl></CardContent>
        </Card>
      </section>

      <footer className="dashboard-footer">
        <p>{data.metadata.disclaimer}</p>
        <div><span><Code /> Python</span><span><Database /> SQL / SQLite</span><span><Activity /> React / Recharts</span></div>
      </footer>
    </main>
  );
}
