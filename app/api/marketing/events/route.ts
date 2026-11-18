import { getMarketingCity } from '@/lib/marketing-cities';
import { readMarketingEvents } from '@/lib/marketing-events';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'};
export async function GET(request: Request) {
  const params=new URL(request.url).searchParams;
  const city=getMarketingCity(params.get('city')??'');
  if(!city || [...params.keys()].length!==1) return Response.json({error:'Invalid city'}, {status:400,headers});
  try {
    const {supabase,publicBackendUrl}=await import('@/lib/supabase');
    const result=await readMarketingEvents(supabase,publicBackendUrl,new Date(),city);
    return Response.json(result,{status:result.state==='unavailable'?503:200,headers});
  } catch {return Response.json({state:'unavailable',events:[]},{status:503,headers});}
}
