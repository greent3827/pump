import {billingApi} from './billing.mjs';
const FREE_LIMIT=10;
const paidSql="EXISTS (SELECT 1 FROM subscriptions WHERE user_id = ? AND status IN ('active','canceled','past_due') AND period_start <= ? AND period_end > ?)";
async function usage(db,user,count,now=new Date().toISOString()){
 const paid=await db.prepare('SELECT 1 AS paid WHERE '+paidSql).bind(user,now,now).first();
 return {plan:paid?'studio':'free',used:count,limit:paid?null:FREE_LIMIT,canCreate:!!paid||count<FREE_LIMIT};
}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function validate(data){
 if(!data||!Array.isArray(data.items)||data.items.length>5000||typeof data.demo!=='boolean')return false;
 const ids=new Set();
 for(const x of data.items){
  if(!x||typeof x.id!=='string'||!/^SF-[A-Za-z0-9-]{1,80}$/.test(x.id)||ids.has(x.id))return false;ids.add(x.id);
  if(typeof x.topic!=='string'||!x.topic.trim()||x.topic.length>160)return false;
  if(!Number.isInteger(x.status)||x.status<0||x.status>4)return false;
  for(const k of ['clicks','commission'])if(!Number.isSafeInteger(x[k])||x[k]<0)return false;
  for(const k of ['product','affiliate','script','date','video'])if(typeof x[k]!=='string'||x[k].length>(k==='script'?20000:2000))return false;
  for(const k of ['affiliate','video'])if(x[k]){try{if(!['http:','https:'].includes(new URL(x[k]).protocol))return false}catch{return false}}
  if(x.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(x.date)||isNaN(Date.parse(x.date))))return false;
 }
 return true;
}
export async function api(request,env){
 if(new URL(request.url).pathname.startsWith('/api/billing/'))return billingApi(request,env);
 const user=request.headers.get('oai-authenticated-user-id');
 if(!user)return json({error:'로그인이 필요해요.'},401);
 const url=new URL(request.url);
 if(url.pathname==='/api/me'&&request.method==='GET')return json({id:user});
 if(url.pathname!=='/api/workspace')return json({error:'요청한 경로를 찾을 수 없어요.'},404);
 if(!env.DB)return json({error:'저장소 연결을 준비 중이에요.'},503);
 try{
  if(request.method==='GET'){
   const row=await env.DB.prepare('SELECT payload, revision, updated_at FROM workspaces WHERE user_id = ?').bind(user).first();
   const data=row?JSON.parse(row.payload):null;
   return json({data,revision:row?.revision||0,updatedAt:row?.updated_at||null,usage:await usage(env.DB,user,data?.items.length||0)});
  }
  if(request.method!=='PUT')return json({error:'지원하지 않는 요청이에요.'},405);
  if(request.headers.get('Origin')!==url.origin)return json({error:'요청 출처를 확인할 수 없어요.'},403);
  if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON 형식으로 보내주세요.'},415);
  if(Number(request.headers.get('content-length'))>3000000)return json({error:'저장 용량이 너무 커요.'},413);
  const text=await request.text();if(text.length>3000000)return json({error:'저장 용량이 너무 커요.'},413);
  let input;try{input=JSON.parse(text)}catch{return json({error:'올바른 JSON이 아니에요.'},400)}
  if(!Number.isSafeInteger(input.revision)||input.revision<0||!validate(input.data))return json({error:'입력값을 확인해 주세요.'},400);
  const now=new Date().toISOString(),payload=JSON.stringify(input.data);
  const result=input.revision===0?
   await env.DB.prepare('INSERT INTO workspaces (user_id, payload, revision, updated_at) SELECT ?, ?, 1, ? WHERE (? <= 10 OR '+paidSql+') ON CONFLICT(user_id) DO NOTHING').bind(user,payload,now,input.data.items.length,user,now,now).run():
   await env.DB.prepare("UPDATE workspaces SET payload = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ? AND (? <= 10 OR NOT EXISTS (SELECT 1 FROM json_each(?, '$.items') AS incoming WHERE NOT EXISTS (SELECT 1 FROM json_each(workspaces.payload, '$.items') AS existing WHERE json_extract(existing.value, '$.id') = json_extract(incoming.value, '$.id'))) OR "+paidSql+')').bind(payload,now,user,input.revision,input.data.items.length,payload,user,now,now).run();
  if(result.meta.changes!==1){
   const row=await env.DB.prepare('SELECT payload, revision FROM workspaces WHERE user_id = ?').bind(user).first();
   if((row?.revision||0)===input.revision){const current=row?JSON.parse(row.payload).items:[],ids=new Set(current.map(x=>x.id));const access=await usage(env.DB,user,current.length);if(access.plan==='free'&&input.data.items.length>FREE_LIMIT&&input.data.items.some(x=>!ids.has(x.id)))return json({code:'CONTENT_LIMIT_REACHED',error:'무료 플랜은 콘텐츠 10개까지 저장할 수 있어요. 11번째부터 월 9,900원 구독이 필요합니다.',usage:access},402);}
   return json({error:'다른 기기의 변경 사항이 있어요. 최신 데이터를 불러온 후 다시 시도해 주세요.'},409);
  }
  return json({revision:input.revision+1,updatedAt:now,usage:await usage(env.DB,user,input.data.items.length)});
 }catch(e){return json({error:'서버 저장에 실패했어요. 잠시 후 다시 시도해 주세요.'},500)}
}
