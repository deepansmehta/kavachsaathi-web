import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KavachSaathi",
  robots: { index: false, follow: true },
};

export default function ComingSoonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
