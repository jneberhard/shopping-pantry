import {getDb} from '@/lib/db';
import {cloudConfigured} from '@/lib/config';
import {calendarFeed,validFeedToken} from '@/lib/calendar-feed';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  if(!cloudConfigured()||!/^[a-zA-Z0-9_-]{1,100}\.[a-zA-Z0-9_-]{43}$/.test(token))return new Response('Calendar not found.',{status:404});
  try{
    const house=await getDb().household.findUnique({where:{id:token.split('.')[0]},include:{meals:{include:{recipe:{select:{name:true}}},orderBy:[{week:'asc'},{day:'asc'},{slot:'asc'}]},history:{select:{mealId:true,date:true}}}});
    if(!house||!validFeedToken(token,house.id,house.calendarFeedNonce,process.env.BETTER_AUTH_SECRET!))return new Response('Calendar not found.',{status:404});
    return new Response(calendarFeed(house),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="pantry-table.ics"','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'}});
  }catch{return new Response('Calendar temporarily unavailable.',{status:503});}
}
