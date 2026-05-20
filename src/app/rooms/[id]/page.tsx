import { Suspense } from "react";
import RoomView from "./room-view";

export default function RoomPage() {
  return (
    <Suspense>
      <RoomView />
    </Suspense>
  );
}
