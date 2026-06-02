import { Suspense } from "react";
import RosterView from "./roster-view";

export default function RosterPage() {
  return (
    <Suspense fallback={<div className="py-10 text-muted-foreground">Loading…</div>}>
      <RosterView />
    </Suspense>
  );
}
