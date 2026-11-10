/* Observation-level comparisons. No projected distances enter these calculations. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VLMAnalysis=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function transition(truth,before,after){
    return before===truth?(after===truth?'steady':'new'):(after===truth?'fixed':'persistent');
  }
  function summarize(labels,before,after,indices){
    const counts={steady:0,fixed:0,new:0,persistent:0};
    for(const i of indices||labels.map((_,i)=>i))counts[transition(labels[i],before[i],after[i])]++;
    return {...counts,n:Object.values(counts).reduce((a,b)=>a+b,0),
      beforeErrors:counts.fixed+counts.persistent,afterErrors:counts.new+counts.persistent};
  }
  function neighbors(before,after){
    const a=new Set(before),b=new Set(after);
    return {retained:after.filter(i=>a.has(i)),arrived:after.filter(i=>!a.has(i)),
      departed:before.filter(i=>!b.has(i)),total:b.size};
  }
  return {transition,summarize,neighbors};
});
