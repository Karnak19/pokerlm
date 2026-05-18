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

export default crons;
