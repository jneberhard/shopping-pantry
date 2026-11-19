import {getAuth} from '@/lib/auth';
import {cloudConfigured} from '@/lib/config';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handler(request:Request){
  if(!cloudConfigured())return Response.json({message:'Cloud accounts are not configured yet.'},{status:503});
  try {return await getAuth().handler(request);}catch{return Response.json({message:'Accounts are temporarily unavailable. Please try again.'},{status:503});}
}
export const GET=handler;
export const POST=handler;
