import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { KitchenState } from './kitchen-schema';

const include={pantry:{orderBy:{position:'asc'}},recipes:{orderBy:{position:'asc'},include:{ingredients:{orderBy:{position:'asc'}}}},meals:{orderBy:{position:'asc'}},history:{orderBy:{position:'asc'}},extras:{orderBy:{position:'asc'}},checks:true} as const;
type Loaded=Prisma.HouseholdGetPayload<{include:typeof include}>;
function snapshot(h:Loaded){
  return {revision:h.revision,householdId:h.id,name:h.name,state:{version:1 as const,demo:h.demo,
    pantry:h.pantry.map(({id,name,quantity,unit,category,location,expiry})=>({id,name,quantity,unit,category,location,expiry})),
    recipes:h.recipes.map(({id,name,description,category,minutes,servings,image,steps,ingredients})=>({id,name,description,category,minutes,servings,image,steps,ingredients:ingredients.map(({name,quantity,unit})=>({name,quantity,unit}))})),
    plan:h.meals.map(({id,week,day,slot,recipeId,servings})=>({id,week,day,slot,recipeId,servings})),
    history:h.history.map(({id,recipeId,recipeName,mealId,date,servings,notes})=>({id,recipeId,recipeName,mealId,date,servings,notes})),
    custom:h.extras.map(({id,key,name,week,quantity,unit})=>({id,key,name,week,quantity,unit,manual:true as const})),
    checked:h.checks.map(c=>c.key),
  }};
}
export async function loadKitchen(db:PrismaClient,userId:string){
  // The authenticated user determines the kitchen; no client household ID is trusted.
  const household=await db.household.upsert({where:{ownerId:userId},create:{ownerId:userId},update:{},include});
  return snapshot(household);
}
export async function saveKitchen(db:PrismaClient,userId:string,revision:number,state:KitchenState){
  const household=await db.household.findUniqueOrThrow({where:{ownerId:userId},select:{id:true}});
  const householdId=household.id;
  const changed=await db.$transaction(async tx=>{
    const updated=await tx.household.updateMany({where:{id:householdId,ownerId:userId,revision},data:{revision:{increment:1},demo:state.demo}});
    if(updated.count===0)return false;
    // One revision lock and one transaction keep purchases and related records atomic.
    await tx.plannedMeal.deleteMany({where:{householdId}});
    await tx.recipe.deleteMany({where:{householdId}});
    await tx.pantryItem.deleteMany({where:{householdId}});
    await tx.cookingRecord.deleteMany({where:{householdId}});
    await tx.shoppingExtra.deleteMany({where:{householdId}});
    await tx.shoppingCheck.deleteMany({where:{householdId}});
    if(state.pantry.length)await tx.pantryItem.createMany({data:state.pantry.map((row,position)=>({...row,householdId,position}))});
    if(state.recipes.length)await tx.recipe.createMany({data:state.recipes.map(({ingredients,...row},position)=>({...row,householdId,position}))});
    const ingredients=state.recipes.flatMap(r=>r.ingredients.map((i,position)=>({...i,householdId,recipeId:r.id,position})));
    if(ingredients.length)await tx.recipeIngredient.createMany({data:ingredients});
    if(state.plan.length)await tx.plannedMeal.createMany({data:state.plan.map((row,position)=>({...row,householdId,position}))});
    if(state.history.length)await tx.cookingRecord.createMany({data:state.history.map((row,position)=>({...row,householdId,position}))});
    if(state.custom.length)await tx.shoppingExtra.createMany({data:state.custom.map(({manual,...row},position)=>({...row,householdId,position}))});
    if(state.checked.length)await tx.shoppingCheck.createMany({data:state.checked.map(key=>({householdId,key}))});
    return true;
  },{maxWait:10000,timeout:30000});
  return {conflict:!changed,...await loadKitchen(db,userId)};
}
