const test=require('node:test'),assert=require('node:assert/strict');
const {transition,summarize,neighbors}=require('../static/learning.js');
const data=require('../static/data/dataset.json'),labels=data.samples.labels,pred=data.experiments.base.predictions;
test('classification transitions distinguish truth from agreement between predictions',()=>{
 assert.equal(transition(5,3,5),'fixed');assert.equal(transition(5,5,3),'new');
 assert.equal(transition(5,3,9),'persistent');assert.equal(transition(5,5,5),'steady');
});
test('measured epoch 15 to 20 changes explain the net increase in errors',()=>{
 assert.deepEqual(summarize(labels,pred[5],pred[6]),{fixed:6,new:8,persistent:20,steady:966,n:1000,beforeErrors:26,afterErrors:28});
});
test('every pair partitions the cohort, respects class filtering, and reverses correctly',()=>{
 for(let a=0;a<7;a++)for(let b=0;b<7;b++){
  const all=summarize(labels,pred[a],pred[b]),reverse=summarize(labels,pred[b],pred[a]);
  assert.equal(all.n,1000);assert.equal(all.fixed,reverse.new);assert.equal(all.new,reverse.fixed);
  assert.equal(all.beforeErrors,pred[a].filter((p,i)=>p!==labels[i]).length);
  assert.equal(all.afterErrors,pred[b].filter((p,i)=>p!==labels[i]).length);
  const ids=labels.flatMap((v,i)=>v===5?[i]:[]),part=summarize(labels,pred[a],pred[b],ids);assert.equal(part.n,100);
  if(a===b){assert.equal(all.fixed,0);assert.equal(all.new,0);}
 }
});
test('neighbor changes compare original IDs, regardless of their projected locations or order',()=>{
 assert.deepEqual(neighbors([1,2,3,4,5,6],[6,7,3,8,9,10]),{retained:[6,3],arrived:[7,8,9,10],departed:[1,2,4,5],total:6});
 for(const rows of Object.values(data.experiments.base.neighbors))for(const row of rows){
  const same=neighbors(row,row.slice().reverse());assert.equal(same.retained.length,6);assert.equal(same.arrived.length,0);
 }
});
