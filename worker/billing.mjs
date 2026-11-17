// Test-mode billing only. No live key can pass this configuration boundary.
const PRICE=9900;
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
class BillingError extends Error{constructor(message,status=400){super(message);this.status=status}}
function configured(env){return env.TOSS_BILLING_MODE==='test'&&/^test_ck_/.test(env.TOSS_CLIENT_KEY||'')&&/^test_sk_/.test(env.TOSS_SECRET_KEY||'')&&/^[a-f0-9]{64}$/i.test(env.BILLING_ENCRYPTION_KEY||'')}
const sub=(db,user)=>db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').bind(user).first();
const statement=(db,sql,...values)=>db.prepare(sql).bind(...values);
const run=(db,sql,...values)=>statement(db,sql,...values).run();
function requireConfig(env){if(!configured(env))throw new BillingError('토스 자동결제 테스트 키와 서버 보안 설정을 준비 중입니다.',503)}
export function nextMonth(iso,anchor){const d=new Date(Date.parse(iso)+9*3600000);const y=d.getUTCFullYear(),m=d.getUTCMonth()+1;const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return new Date(Date.UTC(y,m,Math.min(anchor,last),d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds())-9*3600000).toISOString()}
async function cryptKey(env){return crypto.subtle.importKey('raw',Uint8Array.from(env.BILLING_ENCRYPTION_KEY.match(/../g),v=>parseInt(v,16)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
export async function seal(value,env){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},await cryptKey(env),new TextEncoder().encode(value));return btoa(String.fromCharCode(...iv))+'.'+btoa(String.fromCharCode(...new Uint8Array(bytes)))}
async function unseal(value,env){const [a,b]=value.split('.');const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(a),c=>c.charCodeAt(0))},await cryptKey(env),Uint8Array.from(atob(b),c=>c.charCodeAt(0)));return new TextDecoder().decode(bytes)}
async function toss(env,path,body,idempotency){let response;try{response=await fetch('https://api.tosspayments.com'+path,{method:body?'POST':'GET',headers:{Authorization:'Basic '+btoa(env.TOSS_SECRET_KEY+':'),'Content-Type':'application/json',...(idempotency?{'Idempotency-Key':idempotency}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(65000)})}catch{const e=new BillingError('결제 응답을 확인하지 못했습니다. 다시 확인해 주세요. 중복 결제하지 않도록 같은 주문을 유지합니다.',502);e.uncertain=true;throw e}let result;try{result=await response.json()}catch{const e=new BillingError('결제 응답을 확인할 수 없습니다. 잠시 후 다시 확인해 주세요.',502);e.uncertain=true;throw e}if(!response.ok){const e=new BillingError('토스 결제 처리에 실패했습니다. 결제 상태를 확인하거나 다른 테스트 카드로 다시 등록해 주세요.',502);e.code=String(result.code||'PROVIDER_ERROR').slice(0,80);e.uncertain=response.status>=500;throw e}return result}
async function locked(env,user,callback){const now=Date.now();const r=await run(env.DB,'UPDATE subscriptions SET lock_until = ? WHERE user_id = ? AND lock_until < ?',now+300000,user,now);if(!r.meta.changes)throw new BillingError('결제 처리 중입니다. 잠시 후 상태를 다시 확인해 주세요.',409);try{return await callback(await sub(env.DB,user))}finally{await run(env.DB,'UPDATE subscriptions SET lock_until = 0 WHERE user_id = ?',user)}}
async function charge(env,s){
 if(s.cancel_at_end||!s.billing_cipher)throw new BillingError('자동 결제가 중지되어 있습니다.',409);
 let order=s.current_order,p;
 if(order)p=await statement(env.DB,'SELECT * FROM subscription_payments WHERE order_id = ?',order).first();
 if(!p){if(s.period_end&&Date.parse(s.period_end)<Date.now()-14*86400000)throw new BillingError('결제일이 오래 지나 운영자 확인이 필요합니다. 추가 결제를 진행하지 않았습니다.',409);order=crypto.randomUUID();const now=new Date().toISOString(),start=s.period_end||now,anchor=s.anchor_day||new Date(Date.parse(start)+9*3600000).getUTCDate(),end=nextMonth(start,anchor);
  await run(env.DB,'INSERT INTO subscription_payments (order_id,user_id,amount,status,period_start,period_end,created_at) VALUES (?,?,?,\'pending\',?,?,?)',order,s.user_id,PRICE,start,end,now);
  await run(env.DB,'UPDATE subscriptions SET current_order = ?, anchor_day = ? WHERE user_id = ?',order,anchor,s.user_id);p={order_id:order,user_id:s.user_id,period_start:start,period_end:end,created_at:now,status:'pending'};
 }
 if(p.status==='succeeded'){await run(env.DB,"UPDATE subscriptions SET status = 'active', period_start = ?, period_end = ?, next_charge_at = ?, current_order = NULL, updated_at = ? WHERE user_id = ?",p.period_start,p.period_end,p.period_end,new Date().toISOString(),s.user_id);return;}
 if(Date.now()-Date.parse(p.created_at)>14*86400000)throw new BillingError('이 주문은 결제 내역 대사가 필요합니다. 추가 결제 없이 운영자에게 문의해 주세요.',409);
 let payment;
 try{
  // Reconcile an uncertain previous approval before sending the identical request again.
  if(p.status==='uncertain'){
   try{payment=await toss(env,'/v1/payments/orders/'+encodeURIComponent(order))}catch(e){if(e.code!=='NOT_FOUND_PAYMENT'&&e.code!=='NOT_FOUND')throw e}
  }
  if(!payment)payment=await toss(env,'/v1/billing/'+encodeURIComponent(await unseal(s.billing_cipher,env)),{amount:PRICE,customerKey:s.customer_key,orderId:order,orderName:'쇼츠플로우 월 구독 (테스트)'},order);
  if(payment.status!=='DONE'||payment.totalAmount!==PRICE||payment.orderId!==order||!payment.paymentKey||!payment.card){const e=new BillingError('결제 결과 검증이 필요합니다. 운영자에게 문의해 주세요.',502);e.uncertain=true;throw e}
  await run(env.DB,'UPDATE subscription_payments SET status = \'succeeded\', payment_key = ?, error_code = NULL WHERE order_id = ?',payment.paymentKey,order);
  await run(env.DB,'UPDATE subscriptions SET status = \'active\', period_start = ?, period_end = ?, next_charge_at = ?, current_order = NULL, updated_at = ? WHERE user_id = ?',p.period_start,p.period_end,p.period_end,new Date().toISOString(),s.user_id);
 }catch(e){if(payment?.status==='DONE')e.uncertain=true;await run(env.DB,'UPDATE subscription_payments SET status = ?, error_code = ? WHERE order_id = ?',e.uncertain?'uncertain':'failed',e.code||'CHECK_REQUIRED',order);await run(env.DB,'UPDATE subscriptions SET status = \'past_due\', updated_at = ? WHERE user_id = ?',new Date().toISOString(),s.user_id);throw e}
}
async function status(env,user){const s=await sub(env.DB,user);const payments=(await statement(env.DB,'SELECT order_id,amount,status,created_at,period_start,period_end FROM subscription_payments WHERE user_id = ? ORDER BY created_at DESC LIMIT 12',user).all()).results;return {mode:'test',amount:PRICE,configured:configured(env),schedulerReady:env.BILLING_SCHEDULER_READY==='true',subscription:s?{status:s.status,periodEnd:s.period_end,nextChargeAt:s.cancel_at_end?null:s.next_charge_at,cancelAtEnd:!!s.cancel_at_end,canChangeCard:s.status==='past_due'&&payments[0]?.status==='failed',canRetry:['past_due','pending'].includes(s.status)&&!!s.billing_cipher&&!s.cancel_at_end}:null,payments}}
export async function billingApi(request,env){const url=new URL(request.url),path=url.pathname;try{
 if(!env.DB)throw new BillingError('결제 저장소 준비 중입니다.',503);
 if(path==='/api/billing/run-due'){
  if(request.method!=='POST')return reply({error:'POST 요청이 필요합니다.'},405);
  if(!env.BILLING_CRON_TOKEN||request.headers.get('Authorization')!=='Bearer '+env.BILLING_CRON_TOKEN)return reply({error:'인증이 필요합니다.'},401);
  requireConfig(env);if(env.BILLING_SCHEDULER_READY!=='true')throw new BillingError('스케줄러가 아직 활성화되지 않았습니다.',503);
  const now=new Date().toISOString();const due=(await statement(env.DB,"SELECT user_id FROM subscriptions WHERE status = 'active' AND next_charge_at <= ? AND cancel_at_end = 0 LIMIT 5",now).all()).results;
  let succeeded=0,failed=0;for(const row of due){try{await locked(env,row.user_id,async s=>{if(s.status==='active'&&!s.cancel_at_end&&s.next_charge_at<=now){await charge(env,s);succeeded++}})}catch{failed++}}
  return reply({checked:due.length,succeeded,failed});
 }
 const user=request.headers.get('oai-authenticated-user-id');if(!user)return reply({error:'로그인 후 구독을 관리할 수 있습니다.'},401);
 if(path==='/api/billing/status'&&request.method==='GET')return reply(await status(env,user));
 if(request.method!=='POST')return reply({error:'지원하지 않는 요청입니다.'},405);
 if(request.headers.get('Origin')!==url.origin)return reply({error:'요청 출처가 일치하지 않습니다.'},403);
 if(!request.headers.get('Content-Type')?.includes('application/json'))return reply({error:'JSON 요청이 필요합니다.'},415);
 const raw=await request.text();if(raw.length>4096)return reply({error:'요청이 너무 큽니다.'},413);let body;try{body=JSON.parse(raw)}catch{return reply({error:'입력값을 확인해 주세요.'},400)}
 if(path==='/api/billing/cancel'){
  const result=await locked(env,user,async s=>{if(s.current_order)throw new BillingError('진행 중인 결제 상태를 먼저 확인해 주세요.',409);await run(env.DB,"UPDATE subscriptions SET cancel_at_end = 1, next_charge_at = NULL, status = 'canceled', billing_cipher = NULL, updated_at = ? WHERE user_id = ?",new Date().toISOString(),user);return {ok:true}});return reply(result);
 }
 requireConfig(env);
 if(path==='/api/billing/reset-failed'){await locked(env,user,async s=>{const p=s.current_order?await statement(env.DB,'SELECT * FROM subscription_payments WHERE order_id = ?',s.current_order).first():null;if(s.status!=='past_due'||p?.status!=='failed')throw new BillingError('결제 결과가 확정되지 않아 새 주문을 시작할 수 없습니다.',409);await run(env.DB,"UPDATE subscriptions SET current_order = NULL, billing_cipher = NULL, cancel_at_end = 1, status = 'canceled', updated_at = ? WHERE user_id = ?",new Date().toISOString(),user)});return reply({ok:true})}
 if(path==='/api/billing/start'){
  if(body.consent!==true)throw new BillingError('테스트 자동결제 조건을 확인해 주세요.');
  const now=new Date().toISOString();await run(env.DB,'INSERT INTO subscriptions (user_id,customer_key,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO NOTHING',user,crypto.randomUUID(),now);
  return reply(await locked(env,user,async s=>{if(s.period_end&&s.period_end>now)throw new BillingError('현재 이용 기간이 남아 있습니다.',409);if(s.current_order)throw new BillingError('기존 결제 상태를 먼저 확인해 주세요.',409);
   await run(env.DB,'UPDATE billing_sessions SET completed = 2 WHERE user_id = ?',user);const id=crypto.randomUUID();await run(env.DB,'INSERT INTO billing_sessions (id,user_id,customer_key,expires_at) VALUES (?,?,?,?)',id,user,s.customer_key,new Date(Date.now()+30*60000).toISOString());
   await run(env.DB,"UPDATE subscriptions SET status = 'awaiting_auth', cancel_at_end = 0, billing_cipher = NULL, period_start = NULL, period_end = NULL, anchor_day = NULL, updated_at = ? WHERE user_id = ?",now,user);
   return {clientKey:env.TOSS_CLIENT_KEY,customerKey:s.customer_key,successUrl:url.origin+'/?billing=success&session='+id,failUrl:url.origin+'/?billing=fail'};
  }));
 }
 if(path==='/api/billing/confirm'){
  if(typeof body.session!=='string'||typeof body.authKey!=='string'||body.authKey.length>300||typeof body.customerKey!=='string')throw new BillingError('인증 결과가 올바르지 않습니다.');
  const session=await statement(env.DB,'SELECT * FROM billing_sessions WHERE id = ? AND user_id = ?',body.session,user).first();
  if(!session||session.customer_key!==body.customerKey)throw new BillingError('현재 계정의 카드 등록 요청이 아닙니다.',403);
  if(session.completed===1)return reply({ok:true});if(session.completed!==0)throw new BillingError('이전 등록 요청입니다. 카드 등록을 다시 시작해 주세요.',409);
  if(session.expires_at<new Date().toISOString())throw new BillingError('카드 등록 요청이 만료되었습니다. 다시 시작해 주세요.');
  await locked(env,user,async s=>{
   if(s.status==='active')return;if(s.customer_key!==session.customer_key||s.cancel_at_end)throw new BillingError('이 등록 요청은 취소되었습니다.',409);
   if(!s.billing_cipher){const result=await toss(env,'/v1/billing/authorizations/issue',{authKey:body.authKey,customerKey:s.customer_key},session.id);if(!result.billingKey||result.customerKey!==s.customer_key)throw new BillingError('카드 등록 결과를 확인할 수 없습니다.',502);s.billing_cipher=await seal(result.billingKey,env);await run(env.DB,"UPDATE subscriptions SET billing_cipher = ?, status = 'pending' WHERE user_id = ?",s.billing_cipher,user)}
   await charge(env,s);await run(env.DB,'UPDATE billing_sessions SET completed = 1 WHERE id = ?',session.id);
  });return reply({ok:true});
 }
 if(path==='/api/billing/retry'){await locked(env,user,async s=>{if(!['past_due','pending'].includes(s.status)||!s.billing_cipher)throw new BillingError('재확인할 결제가 없습니다.',409);await charge(env,s)});return reply({ok:true})}
 return reply({error:'요청한 경로를 찾을 수 없습니다.'},404);
 }catch(e){return reply({error:e instanceof BillingError?e.message:'결제 상태를 처리하지 못했습니다. 잠시 후 다시 확인해 주세요.'},e.status||500)}}

