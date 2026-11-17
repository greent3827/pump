export const AD_CLIENT='ca-pub-3778484976179591';
export const AD_SLOT='4865999546';
export async function advertisingConfig(env,user,country){
 // Approval is an operator-controlled server flag, never a query parameter.
 if(env.ADSENSE_READY!=='true')return {enabled:false,reason:'approval_pending'};
 // Start with Korea. Other countries stay off until their consent setup is ready.
 if(country!=='KR')return {enabled:false,reason:'region_unavailable'};
 if(!env.DB)return {enabled:false,reason:'account_unavailable'};
 if(user){const now=new Date().toISOString();const paid=await env.DB.prepare("SELECT 1 AS paid FROM subscriptions WHERE user_id = ? AND status IN ('active','canceled','past_due') AND period_start <= ? AND period_end > ?").bind(user,now,now).first();if(paid)return {enabled:false,reason:'subscriber'};}
 return {enabled:true,client:AD_CLIENT,slot:AD_SLOT};
}
