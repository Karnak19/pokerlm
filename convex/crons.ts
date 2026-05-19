import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "resolve stuck turns",
  { minutes: 1 },
  internal.maintenance.resolveStuckTurns,
);

crons.interval(
  "archive idle rooms",
  { hours: 1 },
  internal.maintenance.archiveIdleRooms,
);

crons.interval(
  "snapshot elo history",
  { hours: 2 },
  internal.maintenance.snapshotEloHistory,
);

export default crons;
