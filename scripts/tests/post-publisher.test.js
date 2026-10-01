'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {parse} = require('graphql');
const fs = require('node:fs');
const path = require('node:path');
const {singleStoryQuery,classify,storyPath,mergeIndex,sitemapUpdate,validateStory} = require('../publish-post');
const {allowed}=require('../post-publisher-server');
const id='6fa65414-a920-42fd-991d-6a1b2288eaad';
const story={title:'Example',slug:'example',_status:'enabled',_enabledAt:'2026-01-01',isImportant:true,mainCategory:[{title:'Travel'}],category:[{title:'Guides'}],location:[],continent:[],social:{title:''},tout:{dek:'Example preview',image:{path:'image.jpg'}}};
const old={title:'Example',url:'/story/example',enabledAt:'2026-01-01',isImportant:true,mainCategories:['Travel'],subcategories:['Guides'],locations:[],continents:[],image:'https://images.example/image.jpg?w=960',socialTitle:''};
const search={type:'story',url:'/story/example',dek:'Example preview'};
test('a text edit stays on the post-only path; site-affecting edits never do',()=>{
 assert.equal(classify(story,old,search).mode,'post');
 for(const edit of [{title:'Changed'},{slug:'renamed'},{_status:'disabled'},{isImportant:false},{_enabledAt:'2026-02-01'},{category:[]},{mainCategory:[]},{location:[{title:'France'}]},{tout:{dek:'New preview',image:{path:'image.jpg'}}},{tout:{dek:'Example preview',image:{path:'new.jpg'}}}])assert.equal(classify({...story,...edit},old,search).mode,'site',JSON.stringify(edit));
 assert.equal(classify(story,null,null).mode,'site');
});
test('reject path traversal and unsafe story IDs',()=>{
 for(const slug of ['../film','a/b','%2e%2e','x?y',''])assert.throws(()=>storyPath({...story,slug}));
 assert.throws(()=>singleStoryQuery('query{getStoryList{items{title}}}','bad'));
});
test('all three actual queries become a single getStory request',()=>{
 for(const file of ['stories.graphql','search.graphql','story-titles.graphql']){
  const q=singleStoryQuery(fs.readFileSync(path.join(__dirname,'../../src/templates/data',file),'utf8'),id);
  const doc=parse(q);const fields=doc.definitions[0].selectionSet.selections;
  assert.equal(fields.length,1);assert.equal(fields[0].name.value,'getStory');assert.equal(fields[0].arguments[0].value.value,id);
  assert(!q.includes('getStoryList('));
 }
});
test('index patch preserves every other post and rejects ambiguous matches',()=>{
 const another={url:'/story/another',content:'unchanged'};
 const result=mergeIndex([search,another],{...search,content:'edited'},'/story/example/');
 assert.equal(result[1],another);assert.equal(result[0].content,'edited');
 assert.throws(()=>mergeIndex([search,search],search,'/story/example'));
 assert.throws(()=>mergeIndex([another],search,'/story/example'));
});
test('sitemap patch touches only the existing canonical story',()=>{
 const xml='<urlset><url><loc>https://www.awaylands.com/story/example/</loc><lastmod>old</lastmod></url><url><loc>https://www.awaylands.com/film/</loc></url></urlset>';
 assert.equal(sitemapUpdate(xml,'https://www.awaylands.com/story/example/','2026-10-01T10:00:00Z'),xml.replace('old','2026-10-01T10:00:00Z'));
 assert.throws(()=>sitemapUpdate(xml,'https://www.awaylands.com/story/missing/','2026-10-01T10:00:00Z'));
});
test('local service rejects external origins and DNS rebinding hosts',()=>{
 assert(allowed({headers:{host:'127.0.0.1:5058',origin:'http://127.0.0.1:5058'}}));
 for(const headers of [{host:'evil.example:5058'},{host:'127.0.0.1:5058',origin:'https://evil.example'},{host:'127.0.0.1:5058',origin:'null'}])assert(!allowed({headers}));
});
test('publication rejects missing advertising markup',()=>{
 assert.throws(()=>validateStory('<html></html>',{},'https://www.awaylands.com/story/example/'),/Mediavine/);
});
