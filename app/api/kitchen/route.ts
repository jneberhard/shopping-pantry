import {getAuth} from '@/lib/auth';
import {getDb} from '@/lib/db';
import {cloudConfigured} from '@/lib/config';
import {saveKitchenSchema} from '@/lib/kitchen-schema';
import {loadKitchen,saveKitchen} from '@/lib/kitchen-store';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function session(request:Request){return getAuth().api.getSession({headers:request.headers});}
export async function GET(request:Request){
  if(!cloudConfigured())return json({error:'SETUP_REQUIRED'},503);
  try {const auth=await session(request);if(!auth)return json({error:'UNAUTHORIZED'},401);return json(await loadKitchen(getDb(),auth.user.id));}
  catch{return json({error:'DATABASE_UNAVAILABLE',message:'Your kitchen could not be loaded. Try again shortly.'},503);}
}
export async function PUT(request:Request){
  if(!cloudConfigured())return json({error:'SETUP_REQUIRED'},503);
  if(request.headers.get('origin')!==new URL(process.env.BETTER_AUTH_URL!).origin)return json({error:'INVALID_ORIGIN'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON_REQUIRED'},415);
  if(Number(request.headers.get('content-length'))>4000000)return json({error:'TOO_LARGE'},413);
  try {
    const auth=await session(request);if(!auth)return json({error:'UNAUTHORIZED'},401);
    const body=await request.text();if(body.length>4000000)return json({error:'TOO_LARGE'},413);
    let raw:unknown;try{raw=JSON.parse(body);}catch{return json({error:'INVALID_JSON'},400);}
    const parsed=saveKitchenSchema.safeParse(raw);
    if(!parsed.success)return json({error:'INVALID_KITCHEN',message:'Some kitchen data needs attention. Export a backup before trying again.',issues:parsed.error.issues.map(i=>({path:i.path,message:i.message}))},400);
    const result=await saveKitchen(getDb(),auth.user.id,parsed.data.revision,parsed.data.state);
    return json(result,result.conflict?409:200);
  }catch{return json({error:'DATABASE_UNAVAILABLE',message:'Your changes are still on this device. We will retry syncing.'},503);}
}
