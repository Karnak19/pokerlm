import { Suspense } from "react";
import RosterView from "./roster-view";

export default function RosterPage() {
  return (
    <Suspense>
      <RosterView />
    </Suspense>
  );
}
