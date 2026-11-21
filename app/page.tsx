import { AccessGate } from "@/components/access-gate";
import { Workspace } from "@/components/workspace";

export default function HomePage() {
  return (
    <AccessGate>
      <Workspace />
    </AccessGate>
  );
}
