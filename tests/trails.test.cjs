const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {controls}=require('../static/trails.js');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../static/data/dataset.json'),'utf8'));
const labels=data.samples.labels;

function curveAt(a,b,c,t) {
  const s=1-t;
  return [0,1].map(k=>s*s*s*a[k]+3*s*s*t*c.first[k]+3*s*t*t*c.second[k]+t*t*t*b[k]);
}
function length(a,b,c) {
  let previous=a,total=0;
  for(let j=1;j<=80;j++) {
    const current=curveAt(a,b,c,j/80);
    total+=Math.hypot(current[0]-previous[0],current[1]-previous[1]);previous=current;
  }
  return total;
}
function centroids(frames) {
  return frames.map(frame=>Array.from({length:10},(_,cls)=> {
    let x=0,y=0,n=0;
    frame.forEach((p,i)=>{if(labels[i]===cls){x+=p[0];y+=p[1];n++;}});
    return [x/n,y/n];
  }));
}

test('coincident endpoints produce no artificial excursion; zero force is straight',()=> {
  const same=controls([1,2],[1,2],[100,100],[-100,-100],1);
  assert.deepEqual(same.first,[1,2]);assert.deepEqual(same.second,[1,2]);
  assert.equal(same.distance,0);
  const flat=controls([0,0],[3,0],[0,100],[3,100],0);
  assert.deepEqual(flat.first,[1,0]);assert.deepEqual(flat.second,[2,0]);
});

test('near-stationary points cannot create a large loop toward a remote centroid',()=> {
  const a=[0,0],b=[.0001,0],c=controls(a,b,[10,10],[10,10],1);
  assert.ok(length(a,b,c)<=c.distance*1.2);
  let previous=-Infinity;
  for(let j=0;j<=80;j++) {
    const p=curveAt(a,b,c,j/80);
    assert.ok(p[0]>=previous-1e-12);previous=p[0];
    assert.ok(Math.abs(p[1])<=c.distance*.25+1e-12);
  }
});

test('audited images keep measured endpoints and lose their exaggerated detours',()=> {
  for(const [id,layer,start] of [[1393,3,1],[2787,3,4],[6071,1,4]]) {
    const index=data.samples.ids.indexOf(id);
    const frames=data.experiments.base.sequences[`t1-l${layer}`].frames;
    const centers=centroids(frames),a=frames[start][index],b=frames[start+1][index];
    const c=controls(a,b,centers[start][labels[index]],centers[start+1][labels[index]],.45);
    assert.deepEqual(curveAt(a,b,c,0),a);
    assert.deepEqual(curveAt(a,b,c,1),b);
    assert.ok(length(a,b,c)/c.distance<1.2,`MNIST #${id} must not acquire a loop`);
  }
});

test('all published temporal segments remain bounded at maximum grouping strength',()=> {
  let checked=0;
  for(const experiment of Object.values(data.experiments)) {
    for(let layer=0;layer<4;layer++) {
      const frames=experiment.sequences[`t1-l${layer}`].frames,centers=centroids(frames);
      for(let stage=0;stage<6;stage++) for(let i=0;i<1000;i++) {
        const a=frames[stage][i],b=frames[stage+1][i],c=controls(a,b,centers[stage][labels[i]],centers[stage+1][labels[i]],1);
        if(c.distance===0)continue;
        const dx=(b[0]-a[0])/c.distance,dy=(b[1]-a[1])/c.distance;
        let previous=-Infinity;
        for(let j=0;j<=12;j++) {
          const p=curveAt(a,b,c,j/12),vx=p[0]-a[0],vy=p[1]-a[1];
          const along=vx*dx+vy*dy,across=Math.abs(-vx*dy+vy*dx);
          assert.ok(Number.isFinite(along)&&Number.isFinite(across));
          assert.ok(along>=previous-1e-8&&along<=c.distance+1e-8);
          assert.ok(across<=.25*c.distance+1e-8);
          previous=along;
        }
        checked++;
      }
    }
  }
  assert.ok(checked>47000);
});
