"use client";

import { GoldButton, OutlineButton } from "@/components/ui";

export type ProfileSectionId =
  | "personal"
  | "medical"
  | "contacts"
  | "work"
  | "ids"
  | "address"
  | "insurance"
  | "policies"
  | "security";

type Props = {
  id: ProfileSectionId;
  titleEn: string;
  titleHi: string;
  editing: boolean;
  saving?: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
  /** Extra note under title */
  note?: string;
};

/** One editable card: Edit → Save / Cancel */
export function ProfileSectionCard({
  id,
  titleEn,
  titleHi,
  editing,
  saving,
  onEdit,
  onSave,
  onCancel,
  children,
  note,
}: Props) {
  return (
    <section
      id={`section-${id}`}
      data-testid={`profile-section-${id}`}
      className="space-y-3 rounded-xl border border-[var(--gold-border)] bg-black/20 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">
            {titleEn} / {titleHi}
          </h2>
          {note ? (
            <p className="mt-1 text-[11px] text-[var(--text-soft)]">{note}</p>
          ) : null}
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 rounded-lg border border-[var(--gold-border)] px-3 py-1.5 text-xs font-semibold text-[var(--gold)]"
            aria-label={`Edit ${titleEn}`}
          >
            ✏️ Edit
          </button>
        ) : null}
      </div>

      <div
        className={
          editing ? "space-y-3" : "space-y-3 pointer-events-none opacity-80"
        }
        aria-disabled={!editing}
      >
        {children}
      </div>

      {editing ? (
        <div className="flex gap-2 pt-1">
          <GoldButton
            className="flex-1"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save / सेव"}
          </GoldButton>
          <OutlineButton
            className="flex-1"
            disabled={saving}
            onClick={onCancel}
          >
            Cancel
          </OutlineButton>
        </div>
      ) : null}
    </section>
  );
}
