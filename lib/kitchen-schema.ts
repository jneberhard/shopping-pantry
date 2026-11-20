import { z } from 'zod';
const id=z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const label=z.string().trim().min(1).max(100);
const unit=z.enum(['each','can','jar','bottle','bag','box','package','clove','slice','g','kg','oz','lb','ml','l','tsp','tbsp','cup']);
const quantity=z.number().finite().min(0).max(1000000);
const servings=z.number().int().min(1).max(100);
const day=z.iso.date();
const week=day.refine(d=>new Date(d+'T12:00:00Z').getUTCDay()===1,'Week must start on Monday.');
const ingredient=z.object({name:label,quantity:quantity.gt(0),unit});
const pantryItem=z.object({id,name:label,quantity,unit,category:label,location:z.enum(['Pantry','Fridge','Freezer','Counter']),expiry:z.union([day,z.literal('')]),packageQuantity:quantity.gt(0).nullish(),packageUnit:z.enum(['g','kg','oz','lb','ml','l','tsp','tbsp','cup']).nullish()}).refine(p=>(p.packageQuantity==null)===(p.packageUnit==null)&&(!p.packageQuantity||['can','jar','bottle','bag','box','package'].includes(p.unit)),'Enter a size and measurement unit for each package.');
const pantryEffect=z.object({ingredients:z.array(ingredient).min(1).max(100),recipeServings:servings,deductions:z.array(z.object({item:pantryItem,quantity:quantity.gt(0)})).max(1000)}).refine(effect=>new Set(effect.deductions.map(d=>d.item.id)).size===effect.deductions.length&&effect.deductions.every(d=>d.quantity<=d.item.quantity+1e-8),'Pantry deductions must match the recorded available stock.');
export const kitchenSchema=z.object({
  version:z.literal(1), demo:z.boolean().default(false),
  pantry:z.array(pantryItem).max(1000),
  recipes:z.array(z.object({id,name:label,description:z.string().max(300).default(''),category:label,minutes:z.number().int().min(1).max(1440),servings,image:z.union([z.literal(''),z.url().regex(/^https:\/\/images\.unsplash\.com\//)]).default(''),steps:z.string().trim().min(1).max(20000),ingredients:z.array(z.object({name:label,quantity:quantity.gt(0),unit})).min(1).max(100)})).max(500),
  plan:z.array(z.object({id,week,day:z.number().int().min(0).max(6),slot:z.enum(['Breakfast','Lunch','Dinner']),recipeId:id,servings})).max(3000),
  history:z.array(z.object({id,recipeId:id,recipeName:label,mealId:id.nullish().transform(v=>v??null),date:day,servings,notes:z.string().max(500).default(''),pantryEffect:pantryEffect.nullish().transform(v=>v??null)})).max(5000).default([]),
  custom:z.array(z.object({id,key:z.string().min(1).max(150),name:label,week,quantity:quantity.gt(0),unit,manual:z.literal(true).default(true)})).max(1000),
  checked:z.array(z.string().min(1).max(250)).max(5000),
}).superRefine((data,ctx)=>{
  for(const collection of ['pantry','recipes','plan','history','custom'] as const){const ids=data[collection].map(row=>row.id);if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',message:'Duplicate record IDs.',path:[collection]});}
  const recipes=new Set(data.recipes.map(r=>r.id));
  data.plan.forEach((m,i)=>{if(!recipes.has(m.recipeId))ctx.addIssue({code:'custom',message:'Planned recipe does not exist.',path:['plan',i,'recipeId']});});
  const slots=data.plan.map(m=>`${m.week}|${m.day}|${m.slot}`);
  if(new Set(slots).size!==slots.length)ctx.addIssue({code:'custom',message:'Only one recipe can be planned per meal slot.',path:['plan']});
  if(new Set(data.checked).size!==data.checked.length||new Set(data.custom.map(c=>c.key)).size!==data.custom.length)ctx.addIssue({code:'custom',message:'Duplicate shopping entries.',path:['checked']});
});
export type KitchenState=z.infer<typeof kitchenSchema>;
export const saveKitchenSchema=z.object({revision:z.number().int().min(0),state:kitchenSchema});
