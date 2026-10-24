/**
 * Link to the My Profile → Policies section — reused from footer, Full
 * Details sticky bar, and the dashboard quick-links grid.
 */
export function editPoliciesHref(healthId?: string | null): string {
  const q = new URLSearchParams();
  if (healthId) q.set("health_id", healthId);
  q.set("section", "policies");
  return `/my-profile?${q.toString()}`;
}

export function EditPoliciesLink({
  healthId,
  className,
  style,
  children,
  testId,
}: {
  healthId?: string | null;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  testId?: string;
}) {
  return (
    <a
      href={editPoliciesHref(healthId)}
      className={className}
      style={style}
      data-testid={testId || "edit-policies-link"}
    >
      {children || "Edit policies / पॉलिसी बदलें"}
    </a>
  );
}
