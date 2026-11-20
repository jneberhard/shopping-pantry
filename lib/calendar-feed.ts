import {createHmac,timingSafeEqual} from 'node:crypto';

export function feedToken(householdId:string,nonce:string,secret:string){
  return `${householdId}.${createHmac('sha256',secret).update(`pantry-calendar:${householdId}:${nonce}`).digest('base64url')}`;
}
export function validFeedToken(token:string,householdId:string,nonce:string|null,secret:string){
  if(!nonce)return false;
  const expected=Buffer.from(feedToken(householdId,nonce,secret)),actual=Buffer.from(token);
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
const escapeText=(value:string)=>value.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'');
function fold(line:string){let part='',size=0;const lines=[];for(const char of line){const bytes=Buffer.byteLength(char);if(size+bytes>75){lines.push(part);part=' ';size=1;}part+=char;size+=bytes;}lines.push(part);return lines.join('\r\n');}
function dateFor(week:string,offset:number){const day=new Date(week+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+offset);return day.toISOString().slice(0,10).replaceAll('-','');}
type FeedKitchen={id:string;revision:number;updatedAt:Date;meals:{id:string;week:string;day:number;slot:string;servings:number;recipe:{name:string}}[];history:{mealId:string|null;date:string}[]};
export function calendarFeed(kitchen:FeedKitchen){
  const stamp=kitchen.updatedAt.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Pantry and Table//Meal Planner//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Pantry & Table meals'];
  for(const meal of kitchen.meals){
    const made=kitchen.history.find(h=>h.mealId===meal.id);
    lines.push('BEGIN:VEVENT',`UID:${kitchen.id}.${meal.id}@pantry-table`,`DTSTAMP:${stamp}`,`LAST-MODIFIED:${stamp}`,`SEQUENCE:${kitchen.revision}`,`DTSTART;VALUE=DATE:${dateFor(meal.week,meal.day)}`,`DTEND;VALUE=DATE:${dateFor(meal.week,meal.day+1)}`,`SUMMARY:${escapeText(`${made?'✓ Made · ':''}${meal.slot}: ${meal.recipe.name}`)}`,`DESCRIPTION:${escapeText(`${meal.servings} servings. ${made?'Made on '+made.date+'. ':''}Manage this meal in Pantry & Table.`)}`,'STATUS:CONFIRMED','TRANSP:TRANSPARENT','END:VEVENT');
  }
  lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
