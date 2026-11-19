import {cloudConfigured,recoveryConfigured} from '@/lib/config';
import AccountPanel from './panel';
export const dynamic='force-dynamic';
export default function Login(){return <AccountPanel configured={cloudConfigured()} recovery={recoveryConfigured()}/>;}
