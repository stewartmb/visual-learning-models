const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.env.QA_OUTPUT||'test-results/layout');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true}),results=[];
 for(const viewport of [{width:1512,height:1050},{width:1800,height:1050},{width:1280,height:800}]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.VLM_URL||'http://127.0.0.1:5123/');await page.waitForFunction(()=>window.VLM);await page.waitForTimeout(150);
  const bounds=async()=>page.evaluate(()=>Object.fromEntries(['plot-wrap','evolution-chart','inspector-scroll'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{x:r.x,y:r.y,width:r.width,height:r.height}]})));
  const initial=await bounds();assert.ok(initial['evolution-chart'].width>=300);assert.ok(initial['evolution-chart'].height>=170);
  assert.ok(initial['evolution-chart'].y<180,'The support chart must remain at the top');
  const control=await page.locator('#layer').boundingBox();assert.ok(control.height>=34);assert.ok(control.width>=200);
  await page.locator('[aria-label="Ver época 2"]').click();await page.waitForTimeout(750);
  const scale=()=>page.evaluate(()=>{
   const frame=VLM.data.experiments.base.sequences['t1-l3'].frames[VLM.getState().epochs.t1];
   const point=i=>{const m=document.querySelector(`.point[data-sample="${i}"]`).transform.baseVal.consolidate().matrix;return [m.e,m.f]};
   const a=point(0),b=point(1);return {x:(b[0]-a[0])/(frame[1][0]-frame[0][0]),y:(b[1]-a[1])/(frame[1][1]-frame[0][1])};
  });
  const s2=await scale();assert.ok(Math.abs(s2.x+s2.y)<.005,'Projection must remain isotropic');
  const occupied=await page.locator('.point').evaluateAll(es=>{const ps=es.map(e=>e.transform.baseVal.consolidate().matrix);return {width:Math.max(...ps.map(p=>p.e))-Math.min(...ps.map(p=>p.e)),height:Math.max(...ps.map(p=>p.f))-Math.min(...ps.map(p=>p.f))};});
  assert.ok(occupied.width/initial['plot-wrap'].width>.6,'The epoch 2 map should use the majority of its width without stretching');
  await page.screenshot({path:out+`/epoch2-${viewport.width}.png`,fullPage:true});
  await page.locator('[aria-label="Ver época 20"]').click();await page.waitForTimeout(750);
  const s20=await scale();assert.ok(Math.abs(s2.x-s20.x)<.005,'Changing epoch must preserve the sequence scale');
  const chart=await page.locator('#evolution-chart').boundingBox();await page.mouse.move(chart.x+chart.width*.6,chart.y+80);
  assert.match(await page.locator('#evolution-current').innerText(),/Consulta/);assert.equal(await page.evaluate(()=>VLM.getState().epochs.t1),6);
  await page.mouse.move(5,5);assert.match(await page.locator('#evolution-current').innerText(),/^Época 20/);
  const index=await page.evaluate(()=>VLM.data.samples.ids.indexOf(1393));await page.locator(`.point[data-sample="${index}"]`).dispatchEvent('mouseenter');
  await page.locator(`.point[data-sample="${index}"]`).dispatchEvent('click');
  const inspected=await bounds();assert.deepEqual(inspected['plot-wrap'],initial['plot-wrap']);assert.deepEqual(inspected['evolution-chart'],initial['evolution-chart']);
  await page.locator('#inspector-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);const scrolled=await bounds();assert.deepEqual(scrolled['evolution-chart'],initial['evolution-chart']);
  await page.screenshot({path:out+`/inspection-${viewport.width}.png`,fullPage:true});
  assert.deepEqual(errors,[]);results.push({viewport,map:initial['plot-wrap'],chart:initial['evolution-chart'],epoch2Occupancy:occupied,isotropicScale:s2.x});await page.close();
 }
 const tablet=await browser.newPage({viewport:{width:772,height:1050}});
 await tablet.goto(process.env.VLM_URL||'http://127.0.0.1:5123/');await tablet.waitForFunction(()=>window.VLM);await tablet.waitForTimeout(150);
 const tabletMap=await tablet.locator('#plot-wrap').boundingBox(),tabletChart=await tablet.locator('#evolution-chart').boundingBox();
 assert.ok(tabletMap.width>700&&tabletMap.height>500);assert.ok(tabletChart.y>tabletMap.y+tabletMap.height);
 await tablet.click('#controls-toggle');assert.equal(await tablet.locator('#controls-toggle').getAttribute('aria-expanded'),'true');await tablet.click('#controls-toggle');
 assert.deepEqual(await tablet.locator('#plot-wrap').boundingBox(),tabletMap);
 await tablet.locator('.point').first().dispatchEvent('mouseenter');assert.equal(await tablet.locator('#inspector-scroll').isVisible(),true);
 assert.deepEqual(await tablet.locator('#evolution-chart').boundingBox(),tabletChart);
 await tablet.click('#inspector-close');assert.equal(await tablet.locator('#inspector-scroll').isVisible(),false);assert.equal(await tablet.locator('#evolution-chart').isVisible(),true);
 assert.deepEqual(await tablet.locator('#plot-wrap').boundingBox(),tabletMap);assert.ok(await tablet.evaluate(()=>document.documentElement.scrollWidth)<=772);
 results.push({viewport:{width:772,height:1050},map:tabletMap,chart:tabletChart});await tablet.close();
 fs.writeFileSync(out+'/layout-result.json',JSON.stringify(results,null,2));console.log('Layout checks passed at three desktop sizes and tablet width.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
