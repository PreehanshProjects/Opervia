import { readFileSync } from 'node:fs';
const config=Object.fromEntries(readFileSync(new URL('../.env.local',import.meta.url),'utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).trim()];}));
const url=config.VITE_SUPABASE_URL;
const headers={apikey:config.VITE_SUPABASE_PUBLISHABLE_KEY};
const targets=[['auth','/auth/v1/settings'],...['business_profiles','customers','invoices','payments','expenses'].map(t=>[t,`/rest/v1/${t}?select=*&limit=0`]),...['create_invoice','record_payment','void_invoice'].map(name=>[name,`/rest/v1/rpc/${name}`,name==='void_invoice'?{invoice_uuid:null}:{payload:{}}])];
await Promise.all(targets.map(async([name,path,payload])=>{
 try {
 const res=await fetch(url+path,{headers:{...headers,'Content-Type':'application/json'},method:payload?'POST':'GET',...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(15000)});
 const data=await res.json();
 console.log(JSON.stringify({name,status:res.status,...(name==='auth'&&res.ok?{emailEnabled:data.external?.email,signupDisabled:data.disable_signup,emailAutoConfirmed:data.mailer_autoconfirm,anonymousEnabled:data.external?.anonymous_users}:res.ok?{result:'Accessible anonymously (review permissions before live use)'}:{code:data.code,message:data.message})}));
 }catch(error){console.log(JSON.stringify({name,error:error.message}));process.exitCode=1;}
}));
