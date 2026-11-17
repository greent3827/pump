import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import fs from 'node:fs';
const html=fs.readFileSync('web/index.html','utf8'),script=fs.readFileSync('web/app.js','utf8');
const tick=()=>new Promise(r=>setTimeout(r,15));
const quotaItems=n=>Array.from({length:n},(_,i)=>({id:'SF-'+i,topic:'기획 '+i,product:'',affiliate:'',script:'',date:'',video:'',status:0,clicks:0,commission:0}));
async function setup(seed=null,plan='free'){
 const dom=new JSDOM(html,{url:'https://example.test',runScripts:'outside-only'});const w=dom.window;
 w.structuredClone=structuredClone;w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 let server=seed,revision=0,conflict=false;
 const usage=()=>({plan,used:server?.items.length||0,limit:plan==='free'?10:null,canCreate:plan==='studio'||(server?.items.length||0)<10});
 w.fetch=async(path,options={})=>{if(path==='/api/me')return {ok:true,json:async()=>({id:'test-user'})};if(options.method==='PUT'){if(conflict)return {ok:false,status:409,json:async()=>({error:'다른 기기에서 변경했어요'})};const input=JSON.parse(options.body);assert.equal(input.revision,revision);server=input.data;revision++;return {ok:true,json:async()=>({revision,usage:usage()})}}return {ok:true,json:async()=>({data:server,revision,usage:usage()})}};
 w.eval(script);await tick();return {w,dom,getServer:()=>server,setConflict:()=>{conflict=true}};
}
test('the tenth free content saves and the eleventh opens a reversible subscription prompt',async()=>{const e=await setup({items:quotaItems(9),demo:false}),d=e.w.document;try{d.querySelector('#add').click();const f=d.querySelector('#form');f.elements.topic.value='열 번째 기획';f.dispatchEvent(new e.w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(e.getServer().items.length,10);d.querySelector('#backWorkspace').click();d.querySelector('#add').click();assert.ok(d.querySelector('#paywall').open);assert.equal(d.querySelector('#editor').open,false);d.querySelector('#paywallLater').click();assert.equal(d.querySelector('#paywall').open,false);d.querySelector('[data-nav="all"]').click();d.querySelector('[data-edit="SF-0"]').click();assert.equal(d.querySelector('#editor').open,true)}finally{e.dom.window.close()}});
test('sample preview does not use a slot but saving a sample at limit requires subscription',async()=>{const e=await setup({items:quotaItems(10),demo:false}),d=e.w.document;try{d.querySelector('#trySample').click();assert.match(d.querySelector('#planUsage').textContent,/10 \/ 10/);d.querySelector('[data-edit="SF-003"]').click();assert.ok(d.querySelector('#paywall').open);assert.equal(e.getServer().items.length,10)}finally{e.dom.window.close()}});
test('paid users can create beyond ten without seeing the free limit prompt',async()=>{const e=await setup({items:quotaItems(11),demo:false},'studio'),d=e.w.document;try{d.querySelector('#add').click();assert.ok(d.querySelector('#editor').open);assert.equal(d.querySelector('#paywall').open,false);assert.equal(d.querySelector('#planUpgrade').hidden,true)}finally{e.dom.window.close()}});
test('home prioritizes next work, navigation and all three library views work',async()=>{
 const {w,dom}=await setup(),d=w.document;assert.equal(d.querySelector('#homeView').hidden,false);assert.equal(d.querySelector('#welcome').hidden,false);d.querySelector('#trySample').click();assert.match(d.querySelector('.focusbody h2').textContent,/조명/);assert.equal(d.querySelector('#demo').hidden,false);
 d.querySelector('[data-nav="all"]').click();assert.equal(d.querySelectorAll('.contentcard').length,7);
 d.querySelector('#tableview').click();assert.equal(d.querySelectorAll('tbody tr').length,7);
 d.querySelector('#boardview').click();assert.equal(d.querySelectorAll('.boardcol').length,5);
 d.querySelector('#tabs [data-filter="4"]').click();assert.equal(d.querySelectorAll('.boardcard').length,2);
 for(const nav of ['calendar','analytics','home']){d.querySelector('nav [data-nav="'+nav+'"]').click();assert.match(d.querySelector('#pagetitle').textContent,/./)}dom.window.close();
});
test('template creates an editable draft; guided inputs persist all fields and reopen',async()=>{
 const {w,dom,getServer}=await setup(),d=w.document;
 d.querySelector('[data-template="0"]').click();const form=d.querySelector('#form');assert.ok(d.querySelector('#editor').open);assert.match(form.elements.script.value,/해결/);
 form.elements.topic.value='새 테스트 콘텐츠';form.elements.product.value='테스트 상품';form.elements.affiliate.value='https://example.com/item';
 d.querySelector('#nextStep').click();assert.equal(form.elements.script.closest('label').hidden,false);form.elements.status.value='2';
 d.querySelector('#nextStep').click();form.elements.date.value='2026-11-10';form.elements.video.value='https://example.com/video';form.elements.clicks.value='12';form.elements.commission.value='3000';
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(d.querySelector('#editor').open,false);
 const saved=getServer().items[0];assert.equal(saved.topic,'새 테스트 콘텐츠');assert.equal(saved.commission,3000);assert.equal(saved.clicks,12);assert.equal(saved.status,2);
 d.querySelector('[data-edit="'+saved.id+'"]').click();assert.equal(form.elements.video.value,'https://example.com/video');assert.equal(form.elements.script.closest('label').hidden,false);dom.window.close();
});
test('failed conflicting save keeps the editor draft intact',async()=>{
 const {w,dom,setConflict,getServer}=await setup(),d=w.document;d.querySelector('#add').click();const f=d.querySelector('#form');f.elements.topic.value='보존할 대본';f.elements.script.value='수정한 내용';setConflict();f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(d.querySelector('#editor').open,true);assert.equal(f.elements.script.value,'수정한 내용');assert.equal(getServer(),null);assert.equal(d.querySelector('#editorError').hidden,false);dom.window.close();
});
test('required hidden planning field returns to correct step; empty state is usable',async()=>{
 const {w,dom,getServer}=await setup(),d=w.document;d.querySelector('#trySample').click();d.querySelector('#start').click();await tick();assert.equal(getServer(),null);assert.match(d.querySelector('#syncMobile').textContent,/서버 데이터/);assert.ok(d.querySelector('[data-new]'));d.querySelector('[data-new]').click();d.querySelector('[data-step="2"]').click();const f=d.querySelector('#form');f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(f.elements.topic.closest('label').hidden,false);assert.ok(d.querySelector('#editor').open);dom.window.close();
});

test('first content requires only a topic, removes examples, and continues into script',async()=>{
 const {w,dom,getServer}=await setup(),d=w.document;d.querySelector('#firstCreate').click();const f=d.querySelector('#form');f.elements.topic.value='내 첫 쇼츠';f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(getServer().items.length,1);assert.equal(getServer().demo,false);assert.equal(d.querySelector('#success').open,true);d.querySelector('#continueScript').click();assert.equal(f.elements.script.closest('label').hidden,false);assert.equal(f.elements.topic.value,'내 첫 쇼츠');dom.window.close();
});
test('closing preserves draft; resume restores values and step; previous returns to planning',async()=>{
 const {w,dom}=await setup(),d=w.document;d.querySelector('#skipWelcome').click();d.querySelector('#add').click();const f=d.querySelector('#form');f.elements.topic.value='중단한 기획';f.elements.script.value='내 대본';f.dispatchEvent(new w.Event('input',{bubbles:true}));d.querySelector('#nextStep').click();d.querySelector('#close').click();assert.ok(d.querySelector('#resumeDraft'));d.querySelector('#resumeDraft').click();assert.equal(f.elements.topic.value,'중단한 기획');assert.equal(f.elements.script.value,'내 대본');assert.equal(f.elements.script.closest('label').hidden,false);d.querySelector('#prevStep').click();assert.equal(f.elements.topic.closest('label').hidden,false);dom.window.close();
});
test('sample copy saves a real record without importing sample metrics or deleting existing work',async()=>{
 const real={id:'SF-001',topic:'기존 작업',status:0,product:'',affiliate:'',script:'',date:'',video:'',clicks:0,commission:0};
 const {w,dom,getServer}=await setup({items:[real],demo:false}),d=w.document;
 // The explicit sample entry is available again through the first-use panel only for empty accounts.
 d.querySelector('#trySample').click();d.querySelector('[data-edit="SF-003"]').click();const f=d.querySelector('#form');f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(getServer().items.length,2);assert.ok(getServer().items.some(x=>x.topic==='기존 작업'));assert.equal(getServer().items.filter(x=>x.sample).length,0);assert.equal(getServer().items[0].clicks,0);assert.equal(getServer().items[0].commission,0);dom.window.close();
});
