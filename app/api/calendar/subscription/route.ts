import {randomBytes} from 'node:crypto';
import {getAuth} from '@/lib/auth';
import {getDb} from '@/lib/db';
import {cloudConfigured} from '@/lib/config';
import {feedToken} from '@/lib/calendar-feed';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function handler(request:Request){
  if(!cloudConfigured())return json({error:'SETUP_REQUIRED'},503);
  if(request.method!=='GET'&&request.headers.get('origin')!==new URL(process.env.BETTER_AUTH_URL!).origin)return json({error:'INVALID_ORIGIN'},403);
  try{
    const session=await getAuth().api.getSession({headers:request.headers});if(!session)return json({error:'UNAUTHORIZED'},401);
    const db=getDb();
    let house=await db.household.upsert({where:{ownerId:session.user.id},create:{ownerId:session.user.id},update:{}});
    if(request.method==='POST'){
      const body=await request.text();if(body.length>100)return json({error:'INVALID_REQUEST'},400);
      let rotate=false;try{rotate=JSON.parse(body||'{}').rotate===true;}catch{return json({error:'INVALID_JSON'},400);}
      if(!house.calendarFeedNonce||rotate)house=await db.household.update({where:{id:house.id},data:{calendarFeedNonce:randomBytes(32).toString('base64url')}});
    }
    if(request.method==='DELETE')house=await db.household.update({where:{id:house.id},data:{calendarFeedNonce:null}});
    const url=house.calendarFeedNonce?`${new URL(process.env.BETTER_AUTH_URL!).origin}/api/calendar/feed/${feedToken(house.id,house.calendarFeedNonce,process.env.BETTER_AUTH_SECRET!)}`:null;
    return json({enabled:!!url,url});
  }catch{return json({error:'CALENDAR_UNAVAILABLE',message:'Calendar subscriptions could not be loaded. Please try again.'},503);}
}
export const GET=handler;
export const POST=handler;
export const DELETE=handler;
