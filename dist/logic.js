export const normalize=name=>name.trim().toLowerCase().replace(/\s+/g,' ');
const units={g:['mass',1],kg:['mass',1000],oz:['mass',28.3495],lb:['mass',453.592],ml:['volume',1],l:['volume',1000],tsp:['volume',4.92892],tbsp:['volume',14.7868],cup:['volume',236.588],each:['count',1]};
export function base(q,u){const [dimension,factor]=units[u]||[u,1];return {dimension,quantity:Number(q)*factor};}
export function stockFor(item,targetUnit){
  const direct=base(item.quantity,item.unit),target=base(1,targetUnit);
  if(direct.dimension===target.dimension)return {...direct,factor:base(1,item.unit).quantity};
  if(item.packageQuantity>0&&item.packageUnit){const packed=base(item.quantity*item.packageQuantity,item.packageUnit);if(packed.dimension===target.dimension)return {...packed,factor:base(item.packageQuantity,item.packageUnit).quantity};}
  return {...direct,factor:base(1,item.unit).quantity};
}
export function shoppingList(pantry,recipes,plan,week,history=[]){
  const completed=new Set(history.map(h=>h.mealId).filter(Boolean)),needs=new Map();
  for(const meal of plan.filter(p=>p.week===week&&!completed.has(p.id))){const recipe=recipes.find(r=>r.id===meal.recipeId);if(!recipe)continue;for(const item of recipe.ingredients){const b=base(item.quantity,item.unit),key=normalize(item.name)+'|'+b.dimension;const current=needs.get(key)||{key,name:item.name,unit:item.unit,dimension:b.dimension,required:0,available:0,recipes:[]};current.required+=b.quantity*meal.servings/recipe.servings;if(!current.recipes.includes(recipe.name))current.recipes.push(recipe.name);needs.set(key,current);}}
  const stock=pantry.map(p=>({...p}));
  for(const need of needs.values()){let remaining=need.required;for(const item of stock){const available=stockFor(item,need.unit);if(normalize(item.name)!==normalize(need.name)||available.dimension!==need.dimension)continue;const used=Math.min(remaining,Math.max(0,available.quantity));need.available+=used;item.quantity=Math.max(0,item.quantity-used/available.factor);remaining=Math.max(0,remaining-used);if(remaining<1e-8)break;}}
  return [...needs.values()].map(n=>({...n,quantity:Math.max(0,n.required-n.available)/base(1,n.unit).quantity})).filter(n=>n.quantity>0.001);
}
export function monday(date=new Date()){const d=new Date(date);d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return dateKey(d);}
export function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function shiftWeek(week,delta){const d=new Date(week+'T12:00:00');d.setDate(d.getDate()+delta*7);return dateKey(d);}
