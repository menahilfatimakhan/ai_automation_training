import { describe, expect, it } from "vitest";
import {
  canViewClientData,
  canViewOwnedRow,
  landingRoute,
  navFor,
  type SessionContext,
} from "@/lib/access";

const A = "client-a";
const B = "client-b";

const admin: SessionContext = { userId: "admin", isAdmin: true, memberships: [] };
const closerA: SessionContext = {
  userId: "closer-a",
  isAdmin: false,
  memberships: [{ clientId: A, role: "closer" }],
};
const setterA: SessionContext = {
  userId: "setter-a",
  isAdmin: false,
  memberships: [{ clientId: A, role: "setter" }],
};
const clientViewerA: SessionContext = {
  userId: "viewer-a",
  isAdmin: false,
  memberships: [{ clientId: A, role: "client" }],
};

describe("access model (mirror of RLS for UI/routing)", () => {
  it("admin can view any client's data and rows", () => {
    expect(canViewClientData(admin, A)).toBe(true);
    expect(canViewClientData(admin, B)).toBe(true);
    expect(canViewOwnedRow(admin, B, "someone")).toBe(true);
  });

  it("a member cannot view a client they don't belong to", () => {
    expect(canViewClientData(closerA, B)).toBe(false);
    expect(canViewOwnedRow(closerA, B, "closer-a")).toBe(false);
  });

  it("closer sees only their own owned rows within their client", () => {
    expect(canViewOwnedRow(closerA, A, "closer-a")).toBe(true);
    expect(canViewOwnedRow(closerA, A, "other-closer")).toBe(false);
  });

  it("setter sees only their own owned rows within their client", () => {
    expect(canViewOwnedRow(setterA, A, "setter-a")).toBe(true);
    expect(canViewOwnedRow(setterA, A, "someone-else")).toBe(false);
  });

  it("client-role viewer sees all rows for its own client (read-only)", () => {
    expect(canViewOwnedRow(clientViewerA, A, "any-owner")).toBe(true);
    expect(canViewOwnedRow(clientViewerA, B, "any-owner")).toBe(false);
  });

  it("routes land each role on the right dashboard", () => {
    expect(landingRoute(admin)).toBe("/dashboard/master");
    expect(landingRoute(closerA)).toBe("/dashboard/sales");
    expect(landingRoute(setterA)).toBe("/dashboard/setter");
    expect(landingRoute(clientViewerA)).toBe("/dashboard/master");
  });

  it("nav is gated by role", () => {
    expect(navFor(closerA).admin).toBe(false);
    expect(navFor(admin).admin).toBe(true);
    expect(navFor(setterA).sales).toBe(false);
    expect(navFor(setterA).setter).toBe(true);
  });
});
