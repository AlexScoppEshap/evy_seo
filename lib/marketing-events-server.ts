import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { readMarketingEvents, type EventSelection } from "./marketing-events";
export const getMarketingEvents = cache(async (): Promise<EventSelection> => {
  await connection();
  try {
    const { supabase, publicBackendUrl } = await import("./supabase");
    return await readMarketingEvents(supabase, publicBackendUrl);
  } catch {
    return { state: "unavailable", events: [] };
  }
});
