import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { readCitySelection, type CitySelection } from "./marketing-events";
export const getMarketingEvents = cache(async (): Promise<CitySelection> => {
  await connection();
  try {
    const { supabase, publicBackendUrl } = await import("./supabase");
    return await readCitySelection(supabase, publicBackendUrl);
  } catch {
    return { state: "unavailable", events: [], cities: [], selectedCity: null };
  }
});
