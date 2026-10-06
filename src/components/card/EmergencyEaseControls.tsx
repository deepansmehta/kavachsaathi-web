"use client";

import { ElderlyToggle, ReadAloudButton } from "@/components/ElderlyMode";

export function EmergencyEaseControls({
  elderlyOn,
  readText,
}: {
  elderlyOn: boolean;
  readText: string;
}) {
  if (!elderlyOn) return null;
  return (
    <div style={{ marginTop: 16, textAlign: "center" }}>
      <ElderlyToggle enabled />
      <ReadAloudButton enabled text={readText} />
    </div>
  );
}
