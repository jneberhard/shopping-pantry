export const emptyKitchen=()=>({version:1,demo:false,pantry:[],recipes:[],plan:[],history:[],custom:[],checked:[]});
const clone=value=>JSON.parse(JSON.stringify(value));
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
export const equal=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const collections=['pantry','recipes','plan','history','custom'];

// Merge records changed independently on different devices. A changed/deleted record
// that was also edited elsewhere always requires an explicit choice.
export function mergeKitchen(base,local,remote){
  const merged=clone(remote),conflicts=[];
  // A cooking record and its pantry deductions form one change. Identical stock
  // totals from two different meals still conflict: merging would under-deduct.
  const effectChanges=state=>{
    const before=new Map(base.history.map(h=>[h.id,h])),after=new Map(state.history.map(h=>[h.id,h])),changed=[];
    for(const id of new Set([...before.keys(),...after.keys()])){
      const old=before.get(id),next=after.get(id);
      if(!equal(old?.pantryEffect,next?.pantryEffect))changed.push({id,effect:next?.pantryEffect,items:new Set([...(old?.pantryEffect?.deductions||[]),...(next?.pantryEffect?.deductions||[])].map(d=>d.item.id))});
    }
    return changed;
  };
  const hereEffects=effectChanges(local),thereEffects=effectChanges(remote);
  for(const here of hereEffects)for(const there of thereEffects){
    if(here.id===there.id&&equal(here.effect,there.effect))continue;
    if([...here.items].some(id=>there.items.has(id)))conflicts.push('Meals made on both devices used the same pantry stock.');
  }
  for(const collection of collections){
    const before=new Map(base[collection].map(r=>[r.id,r]));
    const here=new Map(local[collection].map(r=>[r.id,r]));
    const there=new Map(remote[collection].map(r=>[r.id,r]));
    const rows=[];
    for(const id of new Set([...there.keys(),...here.keys(),...before.keys()])){
      const b=before.get(id),l=here.get(id),r=there.get(id);
      const changedHere=!equal(b,l),changedThere=!equal(b,r);
      if(changedHere&&changedThere&&!equal(l,r))conflicts.push(`${collection}: ${l?.name||l?.recipeName||r?.name||r?.recipeName||id}`);
      const chosen=changedHere?l:r;if(chosen)rows.push(clone(chosen));
    }
    merged[collection]=rows;
  }
  const b=new Set(base.checked),l=new Set(local.checked),r=new Set(remote.checked);
  merged.checked=[...new Set([...b,...l,...r])].filter(k=>l.has(k)!==b.has(k)?l.has(k):r.has(k));
  merged.demo=local.demo!==base.demo?local.demo:remote.demo;
  const ids=new Set(merged.recipes.map(r=>r.id)),slots=new Set();
  for(const meal of merged.plan){if(!ids.has(meal.recipeId))conflicts.push('A planned recipe was removed on another device.');const slot=`${meal.week}|${meal.day}|${meal.slot}`;if(slots.has(slot))conflicts.push(`Two meals were added to ${meal.slot} on the same day.`);slots.add(slot);}
  const made=new Set();for(const record of merged.history){if(record.mealId){if(made.has(record.mealId))conflicts.push('The same planned meal was checked off on both devices.');made.add(record.mealId);}}
  return {state:merged,conflicts};
}

export class KitchenSync {
  constructor({fetcher=globalThis.fetch.bind(globalThis),storage=globalThis.localStorage,onState=()=>{},onStatus=()=>{},onUser=()=>{}}={}){
    Object.assign(this,{fetcher,storage,onState,onStatus,onUser});
    this.user=null;this.configured=false;this.recovery=false;this.status='checking';this.local=emptyKitchen();this.base=emptyKitchen();this.revision=0;this.dirty=false;this.busy=false;this.generation=0;this.conflict=null;
  }
  notify(status){this.status=status;this.onStatus(status,this);}
  cacheKey(){return 'pantry-table-account-'+this.user.id;}
  persist(){if(!this.user)return;try{this.storage.setItem(this.cacheKey(),JSON.stringify({state:this.local,base:this.base,revision:this.revision}));}catch{this.storageFailed=true;}}
  async request(url,options={}){return this.fetcher(url,{...options,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});}
  async start(){
    const generation=++this.generation;
    try{
      const setupResponse=await this.request('/api/setup');if(!setupResponse.ok)throw Error();
      const setup=await setupResponse.json();if(generation!==this.generation)return;
      this.configured=setup.configured;this.recovery=setup.recovery;
      if(!setup.configured){this.notify('setup');return;}
      const response=await this.request('/api/auth/get-session');if(!response.ok)throw Error();
      const session=await response.json();if(generation!==this.generation)return;
      this.user=session?.user||null;this.onUser(this.user);
      if(!this.user){this.notify('guest');return;}
      this.base=emptyKitchen();this.local=emptyKitchen();this.revision=0;this.conflict=null;
      try{const cached=JSON.parse(this.storage.getItem(this.cacheKey()));if(cached?.state?.version===1&&cached?.base?.version===1&&Number.isInteger(cached.revision)){this.local=cached.state;this.base=cached.base;this.revision=cached.revision;}}catch{}
      this.dirty=!equal(this.local,this.base);this.onState(clone(this.local));this.notify('loading');
      await this.sync();
    }catch{if(generation===this.generation)this.notify(this.user?'offline':'unavailable');}
  }
  setLocal(state){
    if(!this.user)return;
    this.local=clone(state);this.dirty=!equal(this.local,this.base);this.persist();
    if(this.conflict){this.notify('conflict');return;}
    this.notify(this.dirty?'pending':'synced');
    clearTimeout(this.timer);this.timer=setTimeout(()=>this.sync(),500);
  }
  reconcile(remote,base=this.base){
    const result=mergeKitchen(base,this.local,remote.state);
    if(result.conflicts.length){this.conflict={remote,conflicts:result.conflicts};this.notify('conflict');return false;}
    this.local=result.state;this.base=clone(remote.state);this.revision=remote.revision;this.dirty=!equal(this.local,this.base);
    this.persist();this.onState(clone(this.local));return true;
  }
  async sync(){
    if(!this.user||this.busy||this.conflict)return;
    this.busy=true;const generation=this.generation;let retry=false;
    try{
      const sent=clone(this.local),wasDirty=this.dirty;
      this.notify('syncing');
      const response=await this.request('/api/kitchen',wasDirty?{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:this.revision,state:sent})}:{});
      if(generation!==this.generation)return;
      if(response.status===401){this.notify('reauth');return;}
      if(response.status===400||response.status===413){this.notify('invalid');return;}
      if(!response.ok&&response.status!==409)throw Error();
      const remote=await response.json();if(generation!==this.generation)return;
      if(!remote.state||!Number.isInteger(remote.revision))throw Error();
      if(!this.reconcile(remote,wasDirty&&response.ok?sent:this.base))return;
      this.notify(this.dirty?'pending':'synced');retry=this.dirty;
    }catch{if(generation===this.generation)this.notify('offline');}
    finally{this.busy=false;if(retry){clearTimeout(this.timer);this.timer=setTimeout(()=>this.sync(),500);}}
  }
  resolveConflict(choice){
    if(!this.conflict)return;
    const {remote}=this.conflict;
    // Both complete versions stay available for export before choosing.
    if(choice==='cloud')this.local=clone(remote.state);
    this.base=clone(remote.state);this.revision=remote.revision;this.conflict=null;this.dirty=!equal(this.local,this.base);
    this.persist();this.onState(clone(this.local));this.notify(this.dirty?'pending':'synced');this.sync();
  }
  async signOut(){
    if(this.dirty||this.busy||this.conflict)throw new Error('Wait for syncing to finish, or resolve the conflict, before signing out.');
    const response=await this.request('/api/auth/sign-out',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw new Error('Could not sign out. Please try again.');
    ++this.generation;clearTimeout(this.timer);this.user=null;this.conflict=null;this.onUser(null);this.notify('guest');
  }
}
