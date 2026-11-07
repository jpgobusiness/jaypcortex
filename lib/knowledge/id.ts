import { randomBytes } from "node:crypto";

/** cuid-like id (text) para inserts manuais. */
export function createId(): string {
  return `c${Date.now().toString(36)}${randomBytes(8).toString("hex")}`;
}
