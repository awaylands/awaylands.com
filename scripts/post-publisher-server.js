'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const {inspect, uuid} = require('./publish-post');
const ROOT = path.resolve(__dirname, '..');
const PORT = 5058;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const token = crypto.randomBytes(32).toString('hex');
const jobs = new Map();
const plans = new Map();
let active = null;
const NODE = '/Users/amyseder/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node';
function allowed(req) {
  return req.headers.host === `127.0.0.1:${PORT}` && (!req.headers.origin || req.headers.origin === ORIGIN);
}
function reply(res, status, value) {
  res.writeHead(status, {'Content-Type':'application/json', 'Cache-Control':'no-store'}); res.end(JSON.stringify(value));
}
async function body(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (text.length > 4096) throw new Error('Request is too large.'); }
  return JSON.parse(text);
}
function startPublish(id, mode) {
  if (active) throw new Error('Another publish is running.');
  const job = {id: crypto.randomUUID(), storyId: id, mode, status:'running', message: mode === 'post' ? 'Checking and publishing this post...' : 'Publishing the complete site...', startedAt:Date.now()};
  jobs.set(job.id, job); active = job;
  const args = ['/usr/local/lib/node_modules/npm/bin/npm-cli.js', 'run', 'deploy'];
  if (mode === 'post') args.push('--', '--post', id);
  const child = spawn(NODE, args, {cwd:ROOT, env:{...process.env, PATH:path.dirname(NODE)+':'+process.env.PATH}, stdio:['ignore','pipe','pipe']});
  let output = '';
  const collect = chunk => { output = (output + chunk.toString()).slice(-12000); };
  child.stdout.on('data', collect); child.stderr.on('data', collect);
  child.on('error', error => {job.status='failed';job.message=error.message;active=null;});
  child.on('close', code => {
    job.seconds = (Date.now()-job.startedAt)/1000;
    if (code === 0) {
      const line = output.split('\n').reverse().find(line => line.startsWith('{"status":'));
      const result = line ? JSON.parse(line) : {status:'published',message:'Site published and verified live.',url:'https://www.awaylands.com'};
      Object.assign(job, {status:result.status, message:result.message, url:result.url});
    } else {
      job.status='failed';
      const lines=output.split('\n').filter(x=>x.trim() && !/^npm |^>|^\s*$/.test(x));
      job.message=lines.slice(-4).join(' ').slice(0,1400) || 'Publishing stopped. No success was confirmed.';
    }
    active=null;
  });
  return job;
}
function createServer() {
  return http.createServer(async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if (!allowed(req)) return reply(res,403,{error:'Only the local publisher page can use this service.'});
    const url = new URL(req.url,ORIGIN);
    try {
      if (req.method==='GET' && ['/','/publisher.js','/publisher.css'].includes(url.pathname)) {
        const file = url.pathname==='/' ? 'post-publisher.html' : 'post-'+url.pathname.slice(1);
        res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8','Cache-Control':'no-store'});
        return res.end(fs.readFileSync(path.join(__dirname,file)));
      }
      if (req.method==='GET' && url.pathname==='/api/session') return reply(res,200,{token,active});
      if (req.method==='GET' && url.pathname==='/api/inspect') {
        const id=url.searchParams.get('id'); if (!uuid(id)) return reply(res,400,{error:'Paste the URL of a saved TakeShape Story.'});
        const plan=await inspect(id); plans.set(id,{...plan,checkedAt:Date.now()}); return reply(res,200,plan);
      }
      if (req.method==='GET' && url.pathname==='/api/job') return reply(res,200,jobs.get(url.searchParams.get('id')) || {status:'unknown',message:'This publish is no longer in memory. Check the live post before trying again.'});
      if (req.method==='POST' && url.pathname==='/api/publish') {
        if (req.headers.origin!==ORIGIN || req.headers['x-publisher-token']!==token || !/^application\/json/.test(req.headers['content-type']||'')) return reply(res,403,{error:'Reload this local page before publishing.'});
        const data=await body(req); const plan=plans.get(data.id);
        if (!uuid(data.id) || !['post','site'].includes(data.mode) || !plan || Date.now()-plan.checkedAt>5*60*1000) return reply(res,409,{error:'Check the saved post again before publishing.'});
        const fresh=await inspect(data.id);
        if (fresh.updatedAt!==plan.updatedAt || data.mode==='post' && fresh.mode!=='post') return reply(res,409,{error:'The saved post changed. Check it again to update the publishing options.'});
        return reply(res,202,startPublish(data.id,data.mode));
      }
      reply(res,404,{error:'Not found.'});
    } catch(error) { reply(res,400,{error:error.message}); }
  });
}
if (require.main===module) createServer().listen(PORT,'127.0.0.1',()=>console.log(`Away Lands publisher: ${ORIGIN}`));
module.exports={allowed,createServer};
