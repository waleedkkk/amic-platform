import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { resolveSessionUser } from "../localAuth";
export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};
export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // Local email/password auth session. Resolution failures are non-fatal:
  // public procedures stay public and protected ones reject the call.
  let user: User | null = null;
  try {
    user = await resolveSessionUser(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
