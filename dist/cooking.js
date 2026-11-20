import {base,stockFor,normalize} from './logic.js';
const clone=value=>JSON.parse(JSON.stringify(value));
const round=value=>Number(Math.max(0,value).toFixed(9));
const sameItem=(a,b)=>normalize(a.name)===normalize(b.name)&&a.unit===b.unit&&(a.packageQuantity||null)===(b.packageQuantity||null)&&(a.packageUnit||null)===(b.packageUnit||null);

export function restorePantry(pantry,effect){
  const result=clone(pantry);
  for(const {item,quantity} of effect?.deductions||[]){
    const existing=result.find(p=>p.id===item.id&&sameItem(p,item))||result.find(p=>sameItem(p,item)&&p.location===item.location);
    if(existing)existing.quantity=round(existing.quantity+quantity);
    else result.push({...clone(item),id:result.some(p=>p.id===item.id)?crypto.randomUUID():item.id,quantity});
  }
  return result;
}

export function consumeIngredients(pantry,ingredients,recipeServings,servings){
  if(!Number.isFinite(servings)||servings<=0||!Number.isFinite(recipeServings)||recipeServings<=0)throw Error('Enter a valid number of servings.');
  const result=clone(pantry),deductions=[],shortages=[];
  for(const ingredient of ingredients){
    const required=base(ingredient.quantity,ingredient.unit);
    let remaining=required.quantity*servings/recipeServings;
    for(const item of result){
      const available=stockFor(item,ingredient.unit);
      if(normalize(item.name)!==normalize(ingredient.name)||available.dimension!==required.dimension||item.quantity<=0)continue;
      const used=Math.min(remaining,available.quantity);
      if(used<=0)continue;
      const quantity=round(used/available.factor);
      if(quantity<=0)continue;
      const prior=deductions.find(d=>d.item.id===item.id);
      if(prior)prior.quantity=round(prior.quantity+quantity);
      else deductions.push({item:clone(item),quantity});
      item.quantity=round(item.quantity-quantity);remaining=Math.max(0,remaining-used);
      if(remaining<1e-8)break;
    }
    if(remaining>1e-8)shortages.push({name:ingredient.name,unit:ingredient.unit,quantity:round(remaining/base(1,ingredient.unit).quantity)});
  }
  return {pantry:result.filter(p=>p.quantity>0||!deductions.some(d=>d.item.id===p.id)),deductions,shortages};
}

// Keep the exact ingredient snapshot and actual deductions for later corrections.
// Existing history without a pantry effect remains unchanged until explicitly applied.
export function recordCooking(state,record){
  const existing=state.history.find(h=>h.id===record.id)||(record.mealId&&state.history.find(h=>h.mealId===record.mealId));
  if(existing&&existing.recipeId===record.recipeId&&existing.servings===record.servings&&existing.pantryEffect){
    return {state:{...state,history:state.history.map(h=>h.id===existing.id?{...existing,...record,id:existing.id,pantryEffect:existing.pantryEffect}:h)},shortages:[]};
  }
  const recipe=state.recipes.find(r=>r.id===record.recipeId);
  const previous=existing?.recipeId===record.recipeId?existing.pantryEffect:null;
  if(!recipe&&!previous)throw Error('This recipe has been removed. Edit the date or notes, or select another recipe.');
  const ingredients=previous?.ingredients||recipe.ingredients,recipeServings=previous?.recipeServings||recipe.servings;
  const available=restorePantry(state.pantry,existing?.pantryEffect);
  const consumed=consumeIngredients(available,ingredients,recipeServings,record.servings);
  const saved={...record,id:existing?.id||record.id,pantryEffect:{ingredients:clone(ingredients),recipeServings,deductions:consumed.deductions}};
  return {state:{...state,pantry:consumed.pantry,history:[...state.history.filter(h=>h.id!==saved.id),saved]},shortages:consumed.shortages};
}
export function removeCooking(state,id){
  const record=state.history.find(h=>h.id===id);
  if(!record)return state;
  return {...state,pantry:restorePantry(state.pantry,record.pantryEffect),history:state.history.filter(h=>h.id!==id)};
}
