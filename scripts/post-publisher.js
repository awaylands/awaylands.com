'use strict';
const $=id=>document.getElementById(id);
let token; let plan; let busy=false;
async function api(url,options) {const r=await fetch(url,options);const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed.');return d;}
function disable(value) {busy=value;document.querySelectorAll('button,input').forEach(x=>x.disabled=value);if(plan?.mode==='site')$('publish').disabled=true;}
function extract(value) {const match=value.match(/\/project\/decc50a7-e43f-4c99-b5e9-cc327d2e1b93\/branch\/production\/data\/Story\/([0-9a-f-]{36})(?:[/?#]|$)/i);return match?.[1]||(/^[0-9a-f-]{36}$/i.test(value)?value:null);}
async function lookup() {
  $('error').textContent='';$('plan').hidden=true;disable(true);
  try {const id=extract($('story').value.trim());if(!id)throw new Error('Paste the production TakeShape editor link for a saved story.');plan=await api('/api/inspect?id='+id);$('title').textContent=plan.title;$('saved').textContent='Last saved: '+new Date(plan.updatedAt).toLocaleString();$('description').textContent=plan.mode==='post'?'This saved post can use quick publishing.':'This change affects other pages. Publish Site will update them together.';$('reasons').replaceChildren(...plan.reasons.map(reason=>{const li=document.createElement('li');li.textContent=reason;return li;}));$('plan').hidden=false;}catch(e){$('error').textContent=e.message;}finally{disable(false);}
}
async function poll(id) {const job=await api('/api/job?id='+id);$('message').textContent=job.message;$('status').textContent=job.status==='running'?'Publishing...':job.status==='published'?'Published':job.status==='uploaded'?'Uploaded; checking the public cache':'Publishing stopped';if(job.status==='running'){setTimeout(()=>poll(id).catch(showError),1500);return;}if(job.url){$('live').href=job.url;$('live').hidden=false;}disable(false);}
function showError(e){$('error').textContent=e.message;disable(false);}
async function publish(mode) {if(busy||!plan)return;disable(true);$('error').textContent='';$('progress').hidden=false;$('live').hidden=true;$('status').textContent='Starting publish...';$('message').textContent='Checking the saved version.';try{const job=await api('/api/publish',{method:'POST',headers:{'Content-Type':'application/json','X-Publisher-Token':token},body:JSON.stringify({id:plan.id,mode})});await poll(job.id);}catch(e){showError(e);}}
$('lookup').addEventListener('submit',e=>{e.preventDefault();lookup();});$('publish').addEventListener('click',()=>publish('post'));$('site').addEventListener('click',()=>publish('site'));
api('/api/session').then(session=>{token=session.token;const id=new URLSearchParams(location.search).get('story');if(id){$('story').value=`https://app.takeshape.io/project/decc50a7-e43f-4c99-b5e9-cc327d2e1b93/branch/production/data/Story/${id}`;lookup();}if(session.active){$('progress').hidden=false;disable(true);poll(session.active.id);}}).catch(showError);
