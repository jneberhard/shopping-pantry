import {cloudConfigured,recoveryConfigured} from '@/lib/config';
export const dynamic='force-dynamic';
export function GET(){return Response.json({configured:cloudConfigured(),recovery:recoveryConfigured()},{headers:{'Cache-Control':'no-store'}});}
