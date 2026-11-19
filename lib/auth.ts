import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { getDb } from './db';
import { cloudConfigured, recoveryConfigured } from './config';

let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  if (!cloudConfigured()) throw new Error('Account setup is required.');
  return instance ??= createAuth();
}
function createAuth() {
  return betterAuth({
    appName:'Pantry & Table',
    secret:process.env.BETTER_AUTH_SECRET,
    baseURL:process.env.BETTER_AUTH_URL,
    trustedOrigins:[new URL(process.env.BETTER_AUTH_URL!).origin],
    database:prismaAdapter(getDb(),{provider:'postgresql'}),
    emailAndPassword:{
      enabled:true, minPasswordLength:12, maxPasswordLength:128,
      revokeSessionsOnPasswordReset:true,
      ...(recoveryConfigured()?{sendResetPassword:async({user,url}:{user:{email:string};url:string})=>{
        const response=await fetch('https://api.resend.com/emails',{
          method:'POST', headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
          body:JSON.stringify({from:process.env.AUTH_EMAIL_FROM,to:user.email,subject:'Reset your Pantry & Table password',text:`Reset your password using this link:\n${url}\n\nIf you did not request this, you can ignore this email.`}),
        });
        if(!response.ok)throw new Error('Password recovery email could not be sent.');
      }}:{}),
    },
    session:{expiresIn:60*60*24*30,updateAge:60*60*24},
    rateLimit:{enabled:true,storage:'database',window:60,max:60,customRules:{'/sign-in/email':{window:60,max:10},'/sign-up/email':{window:60,max:5},'/request-password-reset':{window:60,max:3}}},
    advanced:{ipAddress:{ipAddressHeaders:process.env.VERCEL?['x-vercel-forwarded-for']:[]}},
  });
}
