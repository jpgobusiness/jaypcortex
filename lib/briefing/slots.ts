import { zonedParts } from "../activities/dates";

export function overlapMinutes(a0: Date, a1: Date, b0: Date, b1: Date) {
  const s = Math.max(a0.getTime(), b0.getTime());
  const e = Math.min(a1.getTime(), b1.getTime());
  return Math.max(0, Math.round((e - s) / 60000));
}

export type TimeSlot = { start: Date; end: Date };

export function computeFreeSlots(windowStart: Date, windowEnd: Date, busy: TimeSlot[]): TimeSlot[] {
  const free: TimeSlot[] = [];
  let cursor = new Date(windowStart.getTime());
  const sorted = busy
    .filter((b) => b.end > windowStart && b.start < windowEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const b of sorted) {
    if (b.start > cursor) free.push({ start: new Date(cursor), end: new Date(b.start) });
    if (b.end > cursor) cursor = new Date(b.end);
  }
  if (cursor < windowEnd) free.push({ start: cursor, end: new Date(windowEnd) });
  return free;
}

export type PlanTask = { id: string; title: string; minutes: number; energy?: string | null };

export function placeTasksInSlots(slots: TimeSlot[], tasks: PlanTask[], dayEnd: Date): {
  activityId: string;
  title: string;
  start: string;
  end: string;
  minutes: number;
}[] {
  const plan: { activityId: string; title: string; start: string; end: string; minutes: number }[] = [];
  const mutable = slots.map((s) => ({ start: new Date(s.start), end: new Date(s.end) }));
  const morningFirst = tasks.filter((t) => t.energy === "alta");
  const rest = tasks.filter((t) => t.energy !== "alta");
  const ordered = [...morningFirst, ...rest];
  let worked = 0;
  for (const slot of mutable) {
    for (const task of ordered) {
      if (plan.some((p) => p.activityId === task.id)) continue;
      const hour = zonedParts(slot.start).h;
      if (task.energy === "alta" && hour >= 12) continue;
      const mins = task.minutes || 30;
      const slotMin = Math.round((slot.end.getTime() - slot.start.getTime()) / 60000);
      if (slotMin < mins) continue;
      const start = new Date(slot.start.getTime());
      const end = new Date(start.getTime() + mins * 60000);
      if (end > slot.end || end > dayEnd) continue;
      plan.push({ activityId: task.id, title: task.title, start: start.toISOString(), end: end.toISOString(), minutes: mins });
      slot.start = new Date(end.getTime() + 10 * 60000);
      worked += mins;
      if (worked >= 90) {
        slot.start = new Date(slot.start.getTime() + 10 * 60000);
        worked = 0;
      }
    }
  }
  for (const slot of mutable) {
    for (const task of ordered) {
      if (plan.some((p) => p.activityId === task.id)) continue;
      const mins = task.minutes || 30;
      const slotMin = Math.round((slot.end.getTime() - slot.start.getTime()) / 60000);
      if (slotMin < mins) continue;
      const start = new Date(slot.start.getTime());
      const end = new Date(start.getTime() + mins * 60000);
      if (end > slot.end || end > dayEnd) continue;
      plan.push({ activityId: task.id, title: task.title, start: start.toISOString(), end: end.toISOString(), minutes: mins });
      slot.start = new Date(end.getTime() + 10 * 60000);
    }
  }
  return plan;
}
