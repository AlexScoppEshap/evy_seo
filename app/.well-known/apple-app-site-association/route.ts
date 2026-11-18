import association from "@/content/associations/apple-app-site-association.json";
export const dynamic = "force-static";
export function GET() {
  return Response.json(association, {headers: {"Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff"}});
}
