(()=>{
 const box=document.getElementById('guideAd'),choice=document.getElementById('adChoice');
 let loaded=false,checking=false;
 function preference(){try{return localStorage.getItem('sf-guide-ad-consent-v1')}catch{return null}}
 function remember(value){try{localStorage.setItem('sf-guide-ad-consent-v1',value)}catch{}}
 function stop(){box.hidden=true;choice.hidden=true;}
 async function check(){
  if(checking)return;checking=true;
  try{
   const r=await fetch('/api/ads/config',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!r.ok){stop();return}const config=await r.json();
   if(!config.enabled){stop();if(loaded)location.reload();return}
   if(preference()==='declined'){stop();return}
   if(preference()!=='accepted'){choice.hidden=false;box.hidden=true;return}
   choice.hidden=true;if(loaded){box.hidden=false;return}
   if(!/^ca-pub-\d{16}$/.test(config.client)||!/^\d+$/.test(config.slot)){stop();return}
   const unit=document.createElement('ins');unit.className='adsbygoogle';unit.style.display='block';unit.dataset.adClient=config.client;unit.dataset.adSlot=config.slot;unit.dataset.adFormat='auto';unit.dataset.fullWidthResponsive='true';
   box.querySelector('.ad-unit').replaceChildren(unit);box.hidden=false;loaded=true;
   const script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+config.client;
   script.onload=()=>{(window.adsbygoogle=window.adsbygoogle||[]).push({});};script.onerror=()=>{stop()};document.head.append(script);
  }catch{stop()}finally{checking=false}
 }
 document.getElementById('adAccept').onclick=()=>{remember('accepted');check()};
 document.getElementById('adDecline').onclick=()=>{remember('declined');stop()};
 document.getElementById('adPreferences').onclick=()=>{remember('');if(loaded){location.reload();return}check()};
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&loaded)box.hidden=true;if(document.visibilityState==='visible')check()});
 window.addEventListener('pageshow',()=>check());check();
})();
