'use client';
import {useState} from 'react';

export default function AccountPanel({configured,recovery}:{configured:boolean;recovery:boolean}){
  const [mode,setMode]=useState<'signin'|'signup'|'forgot'>('signin');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[showPassword,setShowPassword]=useState(false);
  function change(next:typeof mode){setMode(next);setError('');setNotice('');}
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(!configured)return;
    setBusy(true);setError('');setNotice('');
    const data=Object.fromEntries(new FormData(event.currentTarget));data.email=String(data.email).trim();
    const endpoint=mode==='signup'?'sign-up/email':mode==='forgot'?'request-password-reset':'sign-in/email';
    try{
      const response=await fetch('/api/auth/'+endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(mode==='forgot'?{email:data.email,redirectTo:location.origin+'/?reset-password=1'}:data)});
      if(!response.ok){setError(response.status===429?'Too many attempts. Please wait a minute and try again.':response.status>=500?'Account services are unavailable. Please try again shortly.':mode==='signin'?'Your email or password did not match. Please try again.':'We could not complete that request. Check your details or try signing in.');return;}
      if(mode==='forgot'){setNotice('If an account matches this email, a reset link is on its way.');return;}
      location.assign('/');
    }catch{setError('We could not connect. Check your internet connection and try again.');}
    finally{setBusy(false);}
  }
  return <div className="login-shell">
    <section className="login-story"><a href="/" className="login-brand"><img src="/icon.svg" alt=""/>pantry & table</a><div className="login-story-copy"><div className="eyebrow">YOUR KITCHEN, CONNECTED</div><h1>A little planning.<br/>A lot to come home to.</h1><p>Your pantry, favorite recipes, and week ahead.<br/>Together, wherever life takes you.</p><div className="login-features"><div><span>▤</span><p><strong>One kitchen. Every device.</strong>Start on your iPad. Pick up on your iPhone.</p></div><div><span>▦</span><p><strong>Good meals, remembered.</strong>Your meal plans and cooking history, kept together.</p></div><div><span>♧</span><p><strong>A list that keeps up.</strong>Shop for what you need, with what you have in mind.</p></div></div></div><small>Made for real life. And really good food.</small></section>
    <section className="login-form-side"><a className="login-back" href="/">Back to your kitchen</a><div className="login-form-wrap"><div className="eyebrow">A PLACE AT YOUR TABLE</div><h2>{mode==='signup'?'Make yourself at home.':mode==='forgot'?'A fresh start.':'Welcome back.'}</h2><p>{mode==='signup'?'Create an account to keep your kitchen with you.':mode==='forgot'?'We’ll send you a link to reset your password.':'Sign in to your kitchen. Pick up where you left off.'}</p>
      {!configured&&<div className="sync-banner" role="status">Cloud accounts are being prepared. You can keep using your local kitchen while setup is completed.</div>}
      {mode!=='forgot'&&<div className="login-tabs"><button onClick={()=>change('signin')} className={mode==='signin'?'active':''} type="button">Sign in</button><button onClick={()=>change('signup')} className={mode==='signup'?'active':''} type="button">Create account</button></div>}
      <form onSubmit={submit}>
        {mode==='signup'&&<label className="field"><span>Your name</span><input name="name" autoComplete="name" maxLength={100} required/></label>}
        <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required/></label>
        {mode!=='forgot'&&<label className="field"><span>Password</span><div className="password-input"><input name="password" type={showPassword?'text':'password'} autoComplete={mode==='signup'?'new-password':'current-password'} minLength={mode==='signup'?12:1} maxLength={128} required/><button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?'Hide':'Show'}</button></div></label>}
        {mode==='signup'&&<p className="help-text">Use at least 12 characters. You can import your saved local kitchen after signing in.</p>}
        {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="login-success" role="status">{notice}</p>}
        <button className="button primary login-submit" type="submit" disabled={busy||!configured}>{busy?'One moment…':mode==='signup'?'Create your account':mode==='forgot'?'Send reset link':'Sign in to your kitchen'}</button>
      </form>
      {mode==='signin'&&recovery&&<button className="text-button" onClick={()=>change('forgot')}>Forgot your password?</button>}
      {mode==='forgot'&&<button className="text-button" onClick={()=>change('signin')}>Back to sign in</button>}
      <p className="login-footnote">Your account keeps your kitchen private. Sign in with the same account on each device to sync your changes.</p>
    </div></section>
  </div>;
}
