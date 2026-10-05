export type ScenarioInput = {
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
const PRODUCTIVE_UTILIZATION = 0.85;
const HOURLY_LABOR_COST = 22;

export function calculateScenario(input: ScenarioInput): ScenarioResult {
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

export function forecastProduction(input: ScenarioInput) {
  const plan = calculateScenario(input);
  const hourlyCapacity = input.headcount * PRODUCTIVE_UTILIZATION * input.stowRate;
  const limit = Math.min(input.volumeGoal, Math.max(0, plan.availableUnits - plan.reserveUnits));
  const hours = new Set(Array.from({ length: 25 }, (_, hour) => hour));
  hours.add(Math.min(24, input.shiftHours));
  if (hourlyCapacity > 0) hours.add(Math.min(24, input.shiftHours, limit / hourlyCapacity));
  return [...hours].sort((a, b) => a - b).map(hour => ({
    hour,
    production: Math.min(limit, hourlyCapacity * Math.min(hour, input.shiftHours)),
    goal: input.volumeGoal,
  }));
}
