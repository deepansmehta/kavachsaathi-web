import { LAUNCH_DATE, isLaunched } from "@/lib/launchConfig";

export { LAUNCH_DATE, isLaunched } from "@/lib/launchConfig";

export type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Whole seconds remaining until launch */
  totalSeconds: number;
  done: boolean;
};

export function getTimeLeft(now = new Date()): TimeLeft {
  const ms = LAUNCH_DATE.getTime() - now.getTime();
  const diff = Math.max(0, ms);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    done: ms <= 0,
  };
}

/** @deprecated use isLaunched from launchConfig */
export function hasLaunched(now = new Date()) {
  return isLaunched(now);
}
