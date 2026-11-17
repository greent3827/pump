import {api} from './api.mjs';
import {handleAuthenticatedRequest} from './auth.mjs';
import {assets} from './assets.generated.mjs';
const secureHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
async function serve(request,env){const url=new URL(request.url),path=url.pathname;
 if(path==='/api/auth/config')return Response.json({ready:env.GOOGLE_AUTH_READY==='true'&&!!env.SUPABASE_URL&&!!env.SUPABASE_PUBLISHABLE_KEY},{headers:secureHeaders});
 if(path.startsWith('/api/'))return api(request,env);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const key=path==='/'?'/index.html':path;if(!(key in assets))return new Response('Not found',{status:404});
 return new Response(request.method==='HEAD'?null:assets[key],{headers:{...secureHeaders,'Content-Type':key.endsWith('.js')?'application/javascript; charset=utf-8':key.endsWith('.css')?'text/css; charset=utf-8':key.endsWith('.txt')?'text/plain; charset=utf-8':'text/html; charset=utf-8'}});
}
export default {async fetch(request,env){try{return await handleAuthenticatedRequest(request,env,serve)}catch{return Response.json({error:'요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'},{status:503,headers:secureHeaders})}}};
