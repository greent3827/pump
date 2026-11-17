import {createServerClient,parseCookieHeader,serializeCookieHeader} from '@supabase/ssr';
import {advertisingConfig} from './advertising.mjs';
export function createAuthContext(request,env,clientFactory=createServerClient){
 const headers=new Headers({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'});
 if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return {client:null,headers};
 const client=clientFactory(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,{cookieOptions:{path:'/',sameSite:'lax',secure:true,httpOnly:true},cookies:{getAll(){return parseCookieHeader(request.headers.get('Cookie')||'')},setAll(cookies,cacheHeaders){for(const c of cookies)headers.append('Set-Cookie',serializeCookieHeader(c.name,c.value,{...c.options,path:'/',sameSite:'lax',secure:true,httpOnly:true}));for(const [key,value] of Object.entries(cacheHeaders||{}))headers.set(key,value)}}});
 return {client,headers};
}
function merge(response,headers){const output=new Response(response.body,response);for(const [key,value] of headers)if(key.toLowerCase()!=='set-cookie')output.headers.set(key,value);for(const value of headers.getSetCookie())output.headers.append('Set-Cookie',value);return output}
function redirect(location,headers){return merge(new Response(null,{status:303,headers:{Location:location}}),headers)}
function safeReturn(value){return /^\/(?!\/)[A-Za-z0-9/#?=&%._~-]*$/.test(value||'')&&!value.startsWith('/auth/')?value:'/#home'}
export async function handleAuthenticatedRequest(request,env,next,clientFactory){
 const url=new URL(request.url),context=createAuthContext(request,env,clientFactory),{client,headers}=context;
 const json=(body,status)=>merge(Response.json(body,{status}),headers);
 if(url.pathname==='/auth/google'){
  if(request.method!=='GET')return json({error:'지원하지 않는 요청입니다.'},405);
  if(!client||env.GOOGLE_AUTH_READY!=='true')return redirect('/?auth_error=not_ready#home',headers);
  const target=safeReturn(url.searchParams.get('next'));headers.append('Set-Cookie',serializeCookieHeader('sf-return',target,{path:'/',httpOnly:true,secure:true,sameSite:'lax',maxAge:1800}));
  const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:url.origin+'/auth/callback',scopes:'openid email profile',skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});
  if(error||!data.url)return redirect('/?auth_error=start_failed#home',headers);return redirect(data.url,headers);
 }
 if(url.pathname==='/auth/callback'){
  if(!client)return redirect('/?auth_error=not_ready#home',headers);
  const code=url.searchParams.get('code');if(!code)return redirect('/?auth_error=canceled#home',headers);
  const {error}=await client.auth.exchangeCodeForSession(code);if(error)return redirect('/?auth_error=callback_failed#home',headers);
  const {data:userData,error:userError}=await client.auth.getUser();if(userError||!userData.user?.email_confirmed_at)return redirect('/?auth_error=verification_failed#home',headers);
  const target=safeReturn(parseCookieHeader(request.headers.get('Cookie')||'').find(x=>x.name==='sf-return')?.value);headers.append('Set-Cookie',serializeCookieHeader('sf-return','',{path:'/',httpOnly:true,secure:true,sameSite:'lax',maxAge:0}));return redirect(target,headers);
 }
 if(url.pathname==='/auth/logout'){
  if(request.method!=='POST')return json({error:'POST 요청이 필요합니다.'},405);if(request.headers.get('Origin')!==url.origin)return json({error:'요청 출처가 일치하지 않습니다.'},403);
  if(client)await client.auth.signOut({scope:'local'});return redirect('/#home',headers);
 }
 // Incoming identity headers are never trusted on the public Cloudflare origin.
 const cleanHeaders=new Headers(request.headers);for(const name of [...cleanHeaders.keys()])if(name.toLowerCase().startsWith('oai-')||name.toLowerCase().startsWith('x-sf-'))cleanHeaders.delete(name);
 if(url.pathname==='/api/ads/config'){
  if(request.method!=='GET')return json({enabled:false},405);
  let adUser=null;
  const hasSession=parseCookieHeader(request.headers.get('Cookie')||'').some(c=>/^sb-.*-auth-token(?:\.\d+)?$/.test(c.name));
  if(hasSession){
   if(!client)return json({enabled:false,reason:'account_unavailable'},200);
   try{const {data,error}=await client.auth.getUser();const account=data?.user;if(error||!account?.id||!account.email_confirmed_at||!account.identities?.some(i=>i.provider==='google'))return json({enabled:false,reason:'account_unavailable'},200);adUser='google:'+account.id;}catch{return json({enabled:false,reason:'account_unavailable'},200)}
  }
  try{return json(await advertisingConfig(env,adUser,request.cf?.country),200)}catch{return json({enabled:false,reason:'account_unavailable'},200)}
 }
 if(url.pathname==='/api/billing/run-due'||url.pathname==='/api/auth/config')return merge(await next(new Request(request,{headers:cleanHeaders}),env),headers);
 if(!url.pathname.startsWith('/api/'))return merge(await next(new Request(request,{headers:cleanHeaders}),env),headers);
 if(!client)return json({error:'Google 로그인 연결을 준비 중입니다.'},503);
 const {data,error}=await client.auth.getUser();const user=data?.user;
 if(error||!user?.id||!user.email_confirmed_at)return json({error:'Google 로그인 후 이용할 수 있습니다.'},401);
 if(!user.identities?.some(identity=>identity.provider==='google'))return json({error:'Google 계정으로 로그인해 주세요.'},403);
 cleanHeaders.set('oai-authenticated-user-id','google:'+user.id);cleanHeaders.set('x-sf-email',user.email||'');
 if(url.pathname==='/api/me')return json({id:'google:'+user.id,email:user.email||'',provider:'google'},200);
 return merge(await next(new Request(request,{headers:cleanHeaders}),env),headers);
}
