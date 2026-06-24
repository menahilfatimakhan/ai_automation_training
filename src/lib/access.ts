/**
 * Access model — a TypeScript mirror of the RLS policies, used for role-aware
 * ROUTING and UI gating (e.g. which dashboard to land on, which nav to show).
 *
 * RLS in Postgres is the ENFORCEMENT boundary; this module is for UX and must
 * never be relied on for security. The isolation tests assert the SQL policies
 * actually block cross-tenant reads; these predicates are unit-tested to keep
 * the UI consistent with those policies.
 */

export type Role = "closer" | "setter" | "client";

export interface Membership {
  clientId: string;
  role: Role;
}

export interface SessionContext {
  userId: string;
  isAdmin: boolean;
  memberships: Membership[];
}

/** Client ids the user can see at all (admin sees everything → handled by caller). */
export function memberClientIds(ctx: SessionContext): string[] {
  return [...new Set(ctx.memberships.map((m) => m.clientId))];
}

export function hasRole(ctx: SessionContext, clientId: string, role: Role): boolean {
  return ctx.memberships.some((m) => m.clientId === clientId && m.role === role);
}

export function isClientViewer(ctx: SessionContext, clientId: string): boolean {
  return hasRole(ctx, clientId, "client");
}

/**
 * Can this user SELECT an activity row (call / setter activity / lead) owned by
 * `ownerUserId` under `clientId`? Mirrors the *_select policies.
 */
export function canViewOwnedRow(
  ctx: SessionContext,
  clientId: string,
  ownerUserId: string | null,
): boolean {
  if (ctx.isAdmin) return true;
  const member = ctx.memberships.some((m) => m.clientId === clientId);
  if (!member) return false;
  // Client-role members see all rows for their client; others see only own.
  return isClientViewer(ctx, clientId) || ownerUserId === ctx.userId;
}

/** Can this user read client-level data (goals, ad metrics, KPIs)? */
export function canViewClientData(ctx: SessionContext, clientId: string): boolean {
  return ctx.isAdmin || ctx.memberships.some((m) => m.clientId === clientId);
}

/** Landing route for a session, by precedence: admin → closer → setter → client. */
export function landingRoute(ctx: SessionContext): string {
  if (ctx.isAdmin) return "/dashboard/master";
  const roles = new Set(ctx.memberships.map((m) => m.role));
  if (roles.has("closer")) return "/dashboard/sales";
  if (roles.has("setter")) return "/dashboard/setter";
  if (roles.has("client")) return "/dashboard/master";
  return "/login";
}

/** Which top-level dashboards are navigable for this session. */
export function navFor(ctx: SessionContext): {
  master: boolean;
  sales: boolean;
  setter: boolean;
  ads: boolean;
  callLogs: boolean;
  leads: boolean;
  admin: boolean;
} {
  const roles = new Set(ctx.memberships.map((m) => m.role));
  const anyMember = ctx.memberships.length > 0;
  return {
    master: ctx.isAdmin || anyMember,
    sales: ctx.isAdmin || roles.has("closer"),
    setter: ctx.isAdmin || roles.has("setter"),
    ads: ctx.isAdmin || anyMember,
    callLogs: ctx.isAdmin || roles.has("closer") || roles.has("client"),
    leads: ctx.isAdmin || roles.has("closer") || roles.has("setter"),
    admin: ctx.isAdmin,
  };
}
