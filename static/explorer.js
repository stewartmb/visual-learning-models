/* Original implementation. Design precedents and limitations: docs/design.md. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const EPOCHS = [0, 1, 2, 5, 10, 15, 20];
  const COLORS = d3.schemeTableau10;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const percent = v => `${(100 * v).toFixed(1)}%`;
  const state = {
    task: 't1', experiment: 'base', layer: 3, epochs: {t1: 0, t2: 6},
    classes: new Set(), errors: false, trails: true, bundle: true, fullTrails: false, dimInitial: false,
    strength: .45, opacity: .12, mode: 'pan', pinned: null, hover: null, hoverLayer: 3,
    detailLayer: 3, selected: new Set(), galleryPage: 0, confusion: null,
    transform: d3.zoomIdentity, playing: false, reveal: 3,
    compare: false, reference: 5, outcome: null, regions: true, neighborLinks: false, compareOpacity: .6
  };
  let DATA, atlas, geometry, svg, ctx, zoom, brush;
  let timer = null, animation = null, animatePositions = null, brushBusy = false;
  let renderQueued = false, lastInspectorKey = '', lastMatrixKey = '', miniatureKey = '';
  const contourCache=new Map();
  const comparing=()=>state.task==='t1'&&state.compare;
  const outcomeOf=i=>VLMAnalysis.transition(label(i),record().predictions[state.reference][i],prediction(i));
  const record = () => DATA.experiments[state.experiment];
  const epochIndex = () => state.epochs[state.task];
  const epoch = () => EPOCHS[epochIndex()];
  const seq = () => record().sequences[state.task === 't1' ? `t1-l${state.layer}` : `t2-e${epoch()}`];
  const focused = () => {
    if(state.pinned!==null && included(state.pinned))return state.pinned;
    return null;
  };
  const label = i => DATA.samples.labels[i];
  const prediction = i => record().predictions[epochIndex()][i];
  const isError = i => prediction(i) !== label(i);

  function included(i) {
    if (state.classes.size && !state.classes.has(label(i))) return false;
    if (comparing() && state.outcome && outcomeOf(i)!==state.outcome) return false;
    if (state.errors && !isError(i)) return false;
    if (state.confusion && (label(i) !== state.confusion[0] || prediction(i) !== state.confusion[1])) return false;
    return true;
  }

  function emphasized(i) {
    const f = focused();
    if (f !== null) return i === f;
    return state.selected.size ? state.selected.has(i) : false;
  }

  function pointOpacity(i) {
    if (!included(i)) return focused()!==null?.035:.16;
    const hasSelection = focused() !== null || state.selected.size > 0;
    return hasSelection && !emphasized(i) ? .14 : .9;
  }

  async function boot() {
    try {
      DATA = window.VLM_DATA || await fetch('/api/data').then(r => {
        if (!r.ok) throw new Error('Los datos todavía se están preparando. Vuelve a cargar en un momento.');
        return r.json();
      });
      atlas = new Image();
      atlas.src = window.VLM_ATLAS || '/static/data/digits.png';
      await atlas.decode();
      svg = d3.select('#plot');
      ctx = $('trails-canvas').getContext('2d');
      buildControls();
      setupInteractions();
      $('loading').hidden = true;
      $('workspace').hidden = false;
      renderAll(true);
      makeMethod();
      let pending;
      new ResizeObserver(() => {
        clearTimeout(pending);
        pending = setTimeout(() => {miniatureKey = ''; renderAll();}, 100);
      }).observe($('chart-section'));
      // Read-only access makes data/interaction QA possible without exposing credentials.
      window.VLM = {getState: () => ({...state, classes: [...state.classes], selected: [...state.selected],
        transform: {k: state.transform.k, x: state.transform.x, y: state.transform.y}}),
        data: DATA, setTask, setEpoch, selectSample: i => pin(i), render: renderAll};
    } catch (err) {
      $('loading').hidden = true;
      $('error').hidden = false;
      $('error').textContent = err.message;
      console.error(err);
    }
  }

  function buildControls() {
    const closeControls=()=>{$('app').classList.remove('controls-open');$('controls-scrim').hidden=true;$('controls-toggle').setAttribute('aria-expanded','false');};
    $('controls-toggle').onclick=()=>{const open=$('app').classList.toggle('controls-open');$('controls-scrim').hidden=!open;$('controls-toggle').setAttribute('aria-expanded',String(open));};
    $('controls-scrim').onclick=closeControls;
    d3.select('#reference-epoch').selectAll('option').data(EPOCHS).join('option').attr('value',(_,i)=>i).text(e=>`Época ${e}`);
    $('reference-epoch').onchange=e=>{const reference=+e.target.value;stop();state.reference=reference;state.selected.clear();state.hover=null;renderAll();};
    $('compare-on').onchange=e=>{const checked=e.target.checked;stop();state.compare=checked;state.outcome=null;state.selected.clear();state.hover=null;renderAll();};
    $('regions-on').onchange=e=>{state.regions=e.target.checked;renderPlot();};
    $('explore-learning').onclick=()=>{stop();state.task='t1';state.layer=3;state.reference=5;state.compare=true;state.outcome=null;state.classes.clear();state.errors=false;state.confusion=null;state.pinned=null;state.hover=null;state.selected.clear();state.epochs.t1=6;miniatureKey='';renderAll(true);};
    $('neighbor-links').onclick=()=>{state.neighborLinks=!state.neighborLinks;updateInspector();renderPlot();};
    $('save-evidence').onclick=saveEvidence;
    $('inspector-close').onclick=()=>$('app').classList.add('detail-dismissed');
    d3.select('#epoch-select').selectAll('option').data(EPOCHS).join('option').attr('value',e=>e).text(e=>e);
    $('epoch-select').onchange = e => {const index=EPOCHS.indexOf(+e.target.value);stop();setEpoch(index);};
    d3.select('#class-legend').selectAll('button').data(d3.range(10)).join('button')
      .attr('type', 'button').attr('aria-label', c => `Filtrar dígito ${c}`)
      .style('--class-color', c => COLORS[c]).text(c => c)
      .on('click', (_, c) => {
        stop();
        if (state.classes.has(c)) state.classes.delete(c); else state.classes.add(c);
        state.confusion = null;
        renderAll();
      });
    for (const [id, prop] of [['dim-initial','dimInitial'], ['errors-only','errors']]) {
      $(id).addEventListener('change', e => {state[prop] = e.target.checked; renderAll();});
    }
    $('trail-style').onchange = e => {state.trails=e.target.value!=='off';state.bundle=e.target.value==='bundled';renderAll();};
    $('trail-scope').onchange = e => {state.fullTrails=e.target.value==='full';renderAll();};
    $('strength').addEventListener('input', e => {state.strength = +e.target.value / 100; updateControls(); drawTrails();});
    $('opacity').addEventListener('input', e => {if(comparing())state.compareOpacity=+e.target.value/100;else state.opacity = +e.target.value / 100; updateControls(); drawTrails();drawComparison();});
    $('layer').addEventListener('change', e => {const layer = +e.target.value; stop(); state.layer = layer; state.detailLayer = state.layer; miniatureKey = ''; renderAll(true);});
    $('play').onclick = () => state.playing ? stop() : play();
    $('mode-pan').onclick = () => setMode('pan');
    $('mode-brush').onclick = () => {stop(); setMode('brush');};
    $('clear-filters').onclick = () => {
      state.classes.clear(); state.errors = false; state.confusion = null;state.outcome=null;
      renderAll();
    };
    $('clear-selection').onclick = () => {
      state.selected.clear(); state.pinned = null; state.hover = null; state.galleryPage = 0;
      renderAll();
    };
    $('reset-view').onclick = () => {state.transform = d3.zoomIdentity; svg.call(zoom.transform, d3.zoomIdentity);};
    $('fit-focus').onclick = fitFocus;
    $('unpin').onclick = () => {state.pinned = null; state.hover = null; renderAll();};
    $('gallery-prev').onclick = () => {state.galleryPage = Math.max(0, state.galleryPage-1); renderGallery();};
    $('gallery-next').onclick = () => {state.galleryPage++; renderGallery();};
    $('diagnostics-open').onclick = () => {$('diagnostics').showModal();renderMatrices();};
    document.querySelectorAll('[data-task]').forEach(b => b.onclick = () => setTask(b.dataset.task));
    $('help-open').onclick = () => $('help-dialog').showModal();
    $('method-open').onclick = () => $('method-dialog').showModal();
    document.querySelectorAll('.dialog-close').forEach(b => b.onclick = () => b.closest('dialog').close());
    document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', e => {if (e.target === dialog) dialog.close();}));
  }

  function setupInteractions() {
    zoom = d3.zoom().scaleExtent([.7, 16])
      .filter(e => state.mode === 'pan' && (!e.button || e.type === 'wheel') && e.type !== 'dblclick')
      .on('zoom', e => {
        state.transform = e.transform;
        updateActionVisibility();
        requestPlot();
      });
    svg.call(zoom);
    brush = d3.brush().on('end', e => {
      if (brushBusy || !e.selection) return;
      const [[x0,y0],[x1,y1]] = e.selection;
      const selected = new Set();
      for (const p of pointData()) {
        if (included(p.i) && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && inPanel(p)) selected.add(p.i);
      }
      state.selected = selected;
      state.pinned = null;
      state.hover = null;
      state.galleryPage = 0;
      brushBusy = true;
      svg.select('.brush').call(brush.move, null);
      brushBusy = false;
      renderAll();
    });
    svg.append('defs');
    svg.append('g').attr('class','backgrounds');
    svg.append('g').attr('class','axes');
    svg.append('g').attr('class','class-regions').attr('pointer-events','none');
    svg.append('g').attr('class','comparison-marks').attr('pointer-events','none');
    svg.append('g').attr('class','neighbor-marks').attr('pointer-events','none');
    svg.append('g').attr('class','points');
    svg.append('g').attr('class','class-references').attr('pointer-events','none');
    svg.append('g').attr('class','brush');
    svg.append('g').attr('class','plot-labels').attr('pointer-events','none');
    svg.on('mouseleave', () => {if (state.hover !== null) {state.hover = null; markHover();updateInspector();}});
  }

  function setTask(task) {
    if (!['t1','t2'].includes(task)) return;
    stop(); state.task = task; state.hover = null; state.reveal = 3;
    state.detailLayer = task === 't1' ? state.layer : 3;
    state.confusion = null;state.outcome=null;
    miniatureKey = '';
    renderAll(true);
  }

  function setEpoch(index, animate=true) {
    index = Math.max(0, Math.min(6, index));
    const old = state.task === 't1' && geometry ? seq().frames[epochIndex()] : null;
    if (animation) {animation.stop(); animation = null;}
    animatePositions = null;
    state.epochs[state.task] = index;
    if(state.confusion)state.selected=new Set(d3.range(1000).filter(i=>label(i)===state.confusion[0]&&prediction(i)===state.confusion[1]));
    state.hover = null;
    state.reveal = 3;
    if (state.task === 't2') state.transform = d3.zoomIdentity;
    renderAll(state.task === 't2');
    if (old && animate && !reducedMotion && state.task === 't1') {
      const next = seq().frames[index];
      const duration = Math.min(700, +$('speed').value * .66);
      animation = d3.timer(elapsed => {
        const t = d3.easeCubicInOut(Math.min(1, elapsed / duration));
        animatePositions = old.map((p,i) => [p[0]+(next[i][0]-p[0])*t, p[1]+(next[i][1]-p[1])*t]);
        drawPoints();
        drawClassReferences();
        if (t === 1) {animation.stop(); animation = null; animatePositions = null;renderPlot();}
      });
    }
  }

  function play() {
    if (state.playing) return;
    if (state.task === 't1' && epochIndex() === 6) setEpoch(0, false);
    if (state.task === 't2' && state.reveal >= 3) {state.reveal = 0; renderPlot();}
    state.playing = true;
    updateControls();
    const advance = () => {
      if (!state.playing) return;
      if (state.task === 't1') {
        if (epochIndex() >= 6) {stop(); return;}
        setEpoch(epochIndex()+1);
      } else {
        state.reveal++;
        renderPlot();
        if (state.reveal >= 3) {stop(); return;}
      }
      timer = setTimeout(advance, +$('speed').value);
    };
    timer = setTimeout(advance, +$('speed').value);
  }

  function stop() {
    state.playing = false;
    clearTimeout(timer); timer = null;
    if (animation) {animation.stop(); animation = null; animatePositions = null; renderPlot();}
    if (DATA) updateControls();
  }

  function setMode(mode) {
    state.mode = mode;
    $('mode-pan').setAttribute('aria-pressed', mode === 'pan');
    $('mode-brush').setAttribute('aria-pressed', mode === 'brush');
    svg.style('cursor', mode === 'brush' ? 'crosshair' : 'grab');
    svg.select('.brush').style('display', mode === 'brush' ? null : 'none');
    svg.select('.points').style('pointer-events', mode === 'brush' ? 'none' : null);
  }

  function updateControls() {
    if (!DATA) return;
    const temporal = state.task === 't1';
    $('layer').value = state.layer;
    $('layer-control').hidden = !temporal;
    $('epoch-control').hidden = temporal;
    $('epoch-select').value = epoch();
    $('play').disabled=comparing();
    $('play').textContent = comparing()?'Comparación A → B':state.playing ? 'Ⅱ Pausar' : temporal ? '▶ Reproducir' : '▶ Recorrer capas';
    for (const [id, prop] of [['dim-initial','dimInitial'],['errors-only','errors']]) $(id).checked = state[prop];
    $('trail-style').value = comparing()?'straight':!state.trails?'off':state.bundle?'bundled':'straight';
    $('trail-style').disabled=comparing();$('trail-style').closest('label').hidden=comparing();
    $('strength').closest('label').hidden=comparing();
    $('trails-heading').textContent=comparing()?'Conexiones A → B':'Trayectorias';
    $('trail-scope').value = state.fullTrails?'full':'current';
    $('full-trails-control').hidden = !temporal||comparing();
    $('trail-scope').disabled = !state.trails||comparing();
    $('dim-initial-control').hidden = !temporal||comparing();
    $('dim-initial').disabled = !state.trails||comparing();
    $('strength-value').value = `${Math.round(state.strength*100)}%`;
    $('opacity-value').value = `${Math.round((comparing()?state.compareOpacity:state.opacity)*100)}%`;
    $('opacity').value=Math.round((comparing()?state.compareOpacity:state.opacity)*100);
    $('strength').disabled = !state.bundle || !state.trails||comparing();
    $('opacity').disabled = !state.trails;
    $('time-legend').hidden = comparing() || !temporal || (!state.fullTrails && epochIndex() === 0);
    $('time-legend-end').textContent = state.fullTrails ? '20' : epoch();
    const finalColor = d3.hsl(COLORS[0]);
    const rampStart = finalColor.copy({l:Math.max(.18,finalColor.l*.42)}).formatRgb();
    const rampEnd = finalColor.copy({l:Math.min(.67,finalColor.l)}).formatRgb();
    const shownEnd = d3.interpolateHsl(rampStart,rampEnd)(state.fullTrails ? 1 : epochIndex()/6);
    $('time-ramp').style.background = `linear-gradient(90deg,${rampStart},${shownEnd})`;
    $('epoch-strip').hidden = !temporal;
    d3.select('#class-legend').selectAll('button').attr('aria-pressed', c => state.classes.has(c))
      .classed('is-muted', c => state.classes.size && !state.classes.has(c));
    document.querySelectorAll('[data-task]').forEach(b => b.setAttribute('aria-selected', b.dataset.task === state.task));
    $('chart-section').setAttribute('aria-labelledby', `tab-${state.task}`);
    $('chart-title').textContent = temporal ? `Capa ${state.layer+1} · época ${epoch()}` : `Época ${epoch()} · cuatro capas`;
    const n = d3.range(1000).filter(included).length;
    $('inspector-empty').querySelector('p').textContent=n===0?'Ninguna imagen cumple esta combinación. Limpia los filtros o elige otro tipo de cambio.':'Pasa sobre un punto para ver su imagen y predicción. Haz clic para fijarlo.';
    const suffix = state.confusion ? ` · ${state.confusion[0]} → ${state.confusion[1]}` : '';
    $('visible-count').textContent = `${n.toLocaleString('es-PE')} / 1 000 imágenes${suffix}`;
    const q = seq().quality[temporal ? epochIndex() : state.detailLayer];
    $('quality-label').textContent = `${temporal?'':`Capa ${state.detailLayer+1} · `}NH₆ ${percent(q.neighborhood_hit)} · Trust₁₀ ${percent(q.trustworthiness)}`;
    $('quality-label').title = 'NH: vecinos de la misma clase en 2D. Trustworthiness: preservación de vecinos originales. Se evalúa la muestra completa, sin filtros.';
    renderComparisonControls();renderEvolution();
    updateActionVisibility();
    $('chart-footnote').textContent = comparing()?`A: época ${EPOCHS[state.reference]} ○ → B: época ${epoch()} ● · Posiciones medidas. Selecciona un cambio o fija una imagen.`:temporal
      ? state.fullTrails
        ? 'Recorrido completo 0–20 · Los puntos corresponden a la época activa.'
        : epochIndex() === 0
          ? 'Época 0 · Red sin entrenamiento. Elige una miniatura para avanzar.'
          : `Recorrido acumulado 0–${epoch()} · Cada curva sigue la misma imagen.`
      : 'Las conexiones siguen la misma imagen entre las cuatro capas.';
  }

  function updateActionVisibility() {
    $('clear-filters').disabled = !(state.classes.size || state.errors || state.confusion || state.outcome);
    $('clear-selection').hidden = state.selected.size === 0;
    $('reset-view').hidden = state.transform.k === 1 && state.transform.x === 0 && state.transform.y === 0;
    $('fit-focus').hidden=false;
    $('fit-focus').textContent=state.classes.size||state.errors||state.confusion||state.selected.size||state.outcome?'Encuadrar filtro':'Encuadrar estado';
    $('fit-focus').title='Amplía y centra los casos mostrados.';
  }

  function fitFocus() {
    const points=[];
    const frames=state.task==='t1'?(comparing()?[geometry.frames[state.reference],geometry.frames[epochIndex()]]:state.trails?geometry.frames.slice(0,state.fullTrails?7:epochIndex()+1):[geometry.frames[epochIndex()]]):geometry.frames;
    frames.forEach((frame,l)=>frame.forEach((p,i)=>{
      if(!included(i)||(state.selected.size&&!state.selected.has(i)))return;
      const panel=geometry.panels[state.task==='t1'?0:l];
      points.push([panel.xScale(p[0]),panel.yScale(p[1])]);
    }));
    if(!points.length)return;
    const p=geometry.panels[0],xs=d3.extent(points,a=>a[0]),ys=d3.extent(points,a=>a[1]);
    const k=Math.min(12,.9*Math.min(p.width/Math.max(12,xs[1]-xs[0]),p.height/Math.max(12,ys[1]-ys[0])));
    const transform=d3.zoomIdentity.translate(p.width/2,p.height/2).scale(Math.max(.7,k)).translate(-(xs[0]+xs[1])/2,-(ys[0]+ys[1])/2);
    svg.call(zoom.transform,transform);
  }

  function makeGeometry() {
    const temporal = state.task === 't1';
    $('plot-wrap').parentElement.classList.toggle('is-layers', !temporal);
    const width = $('plot-wrap').clientWidth, height = $('plot-wrap').clientHeight;
    const margin = temporal ? {l:25,r:12,t:18,b:26} : {l:8,r:8,t:30,b:15};
    const gap = 22;
    const rows=!temporal&&height>width*.5?2:1,columns=temporal?1:4/rows;
    const panelWidth = (width-margin.l-margin.r-gap*(columns-1))/columns;
    const panelHeight = (height-margin.t-margin.b-gap*(rows-1))/rows;
    // Fit the complete sequence once: preserve isotropic distance and a stable frame across epochs.
    const frames=seq().frames,all=frames.flat(),extentX=d3.extent(all,p=>p[0]),extentY=d3.extent(all,p=>p[1]);
    const pad=Math.max(extentX[1]-extentX[0],extentY[1]-extentY[0])*.04;
    const domainX=[extentX[0]-pad,extentX[1]+pad],domainY=[extentY[0]-pad,extentY[1]+pad];
    const unit=Math.min(panelWidth/(domainX[1]-domainX[0]),panelHeight/(domainY[1]-domainY[0]));
    const centerX=(domainX[0]+domainX[1])/2,centerY=(domainY[0]+domainY[1])/2;
    const panels = d3.range(temporal ? 1 : 4).map(i => {
      const row=rows===2&&i>=2?1:0,column=rows===2?(i<2?i:3-i):i;
      const x = margin.l + column*(panelWidth+gap), y = margin.t+row*(panelHeight+gap);
      const xScale = d3.scaleLinear().domain(domainX).range(domainX.map(v=>panelWidth/2+(v-centerX)*unit));
      const yScale = d3.scaleLinear().domain(domainY).range(domainY.map(v=>panelHeight/2-(v-centerY)*unit));
      return {x,y,width:panelWidth,height:panelHeight,xScale,yScale,unit};
    });
    geometry = {width,height,panels,temporal,rows,frames:seq().frames};
    geometry.centroids = geometry.frames.map(frame => d3.range(10).map(c => {
      const points = frame.filter((_,i) => label(i) === c);
      return [d3.mean(points,p=>p[0]), d3.mean(points,p=>p[1])];
    }));
    const dpr = window.devicePixelRatio || 1;
    const canvas = $('trails-canvas');
    canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    svg.attr('viewBox',`0 0 ${width} ${height}`).attr('width',width).attr('height',height);
    svg.select('defs').selectAll('clipPath').data(panels).join('clipPath').attr('id',(_,i)=>`panel-clip-${i}`)
      .selectAll('rect').data(p=>[p]).join('rect').attr('x',p=>p.x).attr('y',p=>p.y).attr('width',p=>p.width).attr('height',p=>p.height);
    brush.extent([[0,0],[width,height]]);
    svg.select('.brush').call(brush);
    setMode(state.mode);
  }

  function screen(p, panelIndex) {
    const panel = geometry.panels[panelIndex];
    return [panel.x+state.transform.applyX(panel.xScale(p[0])), panel.y+state.transform.applyY(panel.yScale(p[1]))];
  }

  function inPanel(p) {
    const panel = geometry.panels[p.panel];
    return p.x >= panel.x && p.x <= panel.x+panel.width && p.y >= panel.y && p.y <= panel.y+panel.height;
  }

  function pointData() {
    const points = [];
    if (geometry.temporal) {
      (animatePositions || geometry.frames[epochIndex()]).forEach((p,i) => {
        const [x,y] = screen(p,0); points.push({i,x,y,panel:0,layer:state.layer});
      });
    } else {
      geometry.frames.forEach((frame,l) => {
        if (l > state.reveal) return;
        frame.forEach((p,i) => {const [x,y] = screen(p,l); points.push({i,x,y,panel:l,layer:l});});
      });
    }
    return points;
  }

  function renderAll(reset=false) {
    if (!DATA || !svg) return;
    if (reset) {state.transform = d3.zoomIdentity; svg.property('__zoom',d3.zoomIdentity);}
    updateControls(); updateInspector(); makeGeometry(); renderPlot(); renderMiniatures(); renderGallery();
    if ($('diagnostics').open) renderMatrices();
  }

  function requestPlot() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {renderQueued = false; renderPlot();});
  }

  function renderPlot() {if (geometry) {drawStructure(); drawTrails();drawRegions();drawComparison();drawNeighborLinks();drawPoints();drawClassReferences();}}

  function drawClassReferences() {
    if(animatePositions)svg.select('.class-regions').attr('visibility','hidden');
    const groups=svg.select('.class-references').selectAll('g.reference-panel').data(geometry.panels).join('g')
      .attr('class','reference-panel').attr('clip-path',(_,l)=>`url(#panel-clip-${l})`)
      .attr('display',(_,l)=>!geometry.temporal&&l>state.reveal?'none':null);
    groups.each(function(panel,l){
      const frame=geometry.temporal?(animatePositions||geometry.frames[epochIndex()]):geometry.frames[l];
      const q=seq().quality[geometry.temporal?epochIndex():l].neighborhood_hit;
      const classes=q<.6?[...state.classes]:d3.range(10);
      const nodes=classes.map(c=>{
        const points=frame.filter((_,i)=>label(i)===c);
        const anchor=screen([d3.median(points,p=>p[0]),d3.median(points,p=>p[1])],l);
        return {c,ax:anchor[0],ay:anchor[1],x:anchor[0]+12,y:anchor[1]-13};
      }).filter(n=>n.ax>=panel.x&&n.ax<=panel.x+panel.width&&n.ay>=panel.y&&n.ay<=panel.y+panel.height);
      if(nodes.length){
        const simulation=d3.forceSimulation(nodes).force('x',d3.forceX(n=>n.ax+12).strength(.25))
          .force('y',d3.forceY(n=>n.ay-13).strength(.25)).force('collision',d3.forceCollide(12)).stop();
        for(let t=0;t<24;t++)simulation.tick();
      }
      nodes.forEach(n=>{n.x=Math.max(panel.x+12,Math.min(panel.x+panel.width-12,n.x));n.y=Math.max(panel.y+12,Math.min(panel.y+panel.height-12,n.y));});
      const refs=d3.select(this).selectAll('g.class-reference').data(nodes,n=>n.c).join(enter=>{
        const g=enter.append('g').attr('class','class-reference');g.append('line');g.append('text');return g;
      }).attr('aria-label',n=>`Referencia de la clase ${n.c}, mediana de sus 100 imágenes`);
      refs.select('line').attr('x1',n=>n.ax).attr('y1',n=>n.ay).attr('x2',n=>n.x).attr('y2',n=>n.y).attr('stroke',n=>COLORS[n.c]);
      refs.select('text').attr('x',n=>n.x).attr('y',n=>n.y).text(n=>n.c);
      refs.style('display',state.regions?null:'none');
    });
  }

  function drawStructure() {
    const {panels,temporal} = geometry;
    const bg = svg.select('.backgrounds');
    bg.selectAll('rect').data(temporal ? [] : panels).join('rect')
      .attr('x',p=>p.x).attr('y',p=>p.y).attr('width',p=>p.width).attr('height',p=>p.height)
      .attr('fill','none').attr('rx',3);
    const axes = svg.select('.axes'); axes.selectAll('*').remove();
    if (temporal) {
      const p = panels[0], x = state.transform.rescaleX(p.xScale), y = state.transform.rescaleY(p.yScale);
      axes.append('g').attr('class','axis').attr('transform',`translate(${p.x},${p.y+p.height})`)
        .call(d3.axisBottom(x).ticks(4).tickSize(-p.height).tickFormat(()=>''));
      axes.append('g').attr('class','axis').attr('transform',`translate(${p.x},${p.y})`)
        .call(d3.axisLeft(y).ticks(4).tickSize(-p.width).tickFormat(()=>''));
    }
    const labels = svg.select('.plot-labels'); labels.selectAll('*').remove();
    if (!temporal) {
      panels.forEach((p,i) => {
        labels.append('text').attr('class','layer-label').attr('x',p.x+p.width/2).attr('y',p.y-9).attr('text-anchor','middle').text(`CAPA ${i+1}`);
        if (i<3){
          const next=panels[i+1],vertical=next.y!==p.y;
          const x=vertical?p.x+p.width/2:next.x>p.x?(p.x+p.width+next.x)/2:(next.x+next.width+p.x)/2;
          const y=vertical?(p.y+p.height+next.y)/2+3:p.y-9;
          labels.append('text').attr('class','projection-label').attr('x',x).attr('y',y).attr('text-anchor','middle').text(vertical?'↓':next.x>p.x?'→':'←');
        }
      });
    } else {
      labels.append('text').attr('class','projection-label').attr('x',geometry.width-17).attr('y',geometry.height-7).attr('text-anchor','end').text('Dimensión 1 · AlignedUMAP');
      labels.append('text').attr('class','projection-label').attr('transform',`translate(15,${geometry.height/2}) rotate(-90)`).attr('text-anchor','middle').text('Dimensión 2');
    }
  }

  function drawTrails() {
    if (!geometry) return;
    const {width,height,frames,centroids,temporal,panels} = geometry;
    ctx.clearRect(0,0,width,height);
    if (!temporal) {
      ctx.globalAlpha = 1;
      panels.forEach((p,i) => {ctx.fillStyle = i%2 ? '#f5f5ef' : '#f9f9f4';ctx.fillRect(p.x,p.y,p.width,p.height);});
    }
    if (!state.trails || comparing()) return;
    const f = focused(), selected = state.selected;
    const stages = frames.length-1;
    const visibleStages = temporal ? (state.fullTrails ? stages : epochIndex()) : Math.min(stages,state.reveal);
    const alpha = state.bundle ? state.strength : 0;
    const drawOne = (i, stage, strong=false) => {
      if(!included(i))return;
      const p0 = screen(frames[stage][i], temporal?0:stage);
      const p1 = screen(frames[stage+1][i], temporal?0:stage+1);
      const c0 = screen(centroids[stage][label(i)], temporal?0:stage);
      const c1 = screen(centroids[stage+1][label(i)], temporal?0:stage+1);
      if (!temporal) {
        const a = panels[stage], b = panels[stage+1];
        if (p0[0]<a.x || p0[0]>a.x+a.width || p0[1]<a.y || p0[1]>a.y+a.height || p1[0]<b.x || p1[0]>b.x+b.width || p1[1]<b.y || p1[1]>b.y+b.height) return;
      }
      const curve = VLMTrails.controls(p0,p1,c0,c1,alpha);
      if (curve.distance === 0) return;
      let opacity;
      if (strong) opacity = f !== null ? .96 : .68;
      else {
        const base=state.classes.size||state.errors||state.confusion?Math.max(.3,state.opacity):state.opacity;
        opacity=(f!==null||selected.size)?base*.18:base;
      }
      if (temporal && stage === 0 && state.dimInitial && !strong) opacity *= .12;
      if (!opacity) return;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = strong ? 2 : 1;
      ctx.beginPath(); ctx.moveTo(...p0);
      if (state.bundle) ctx.bezierCurveTo(...curve.first,...curve.second,...p1); else ctx.lineTo(...p1);
      if (temporal) {
        const color = d3.hsl(COLORS[label(i)]);
        const dark = color.copy({l:Math.max(.18,color.l*.42)}).formatRgb();
        const light = color.copy({l:Math.min(.67,color.l)}).formatRgb();
        const ramp = d3.interpolateHsl(dark,light);
        const gradient = ctx.createLinearGradient(p0[0],p0[1],p1[0]+.001,p1[1]+.001);
        gradient.addColorStop(0,ramp(stage/stages)); gradient.addColorStop(1,ramp((stage+1)/stages));
        ctx.strokeStyle = gradient;
      } else ctx.strokeStyle = COLORS[label(i)];
      ctx.stroke();
    };
    if (temporal) {const p=panels[0];ctx.save();ctx.beginPath();ctx.rect(p.x,p.y,p.width,p.height);ctx.clip();}
    for (let s=0;s<visibleStages;s++) {
      for (let i=0;i<1000;i++) if (!emphasized(i)) drawOne(i,s);
    }
    for (let s=0;s<visibleStages;s++) {
      if (f !== null) drawOne(f,s,true);
      else for (const i of selected) if (included(i)) drawOne(i,s,true);
    }
    if (temporal) ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawPoints() {
    if (!geometry) return;
    const points = pointData();
    const groups = svg.select('.points').selectAll('g.panel-points').data(geometry.panels).join('g')
      .attr('class','panel-points').attr('clip-path',(_,i)=>`url(#panel-clip-${i})`);
    groups.each(function(_, panelIndex) {
      const local = points.filter(p=>p.panel===panelIndex);
      d3.select(this).selectAll('path.point').data(local,p=>p.i).join('path')
        .attr('class',p=>`point${emphasized(p.i)?' is-focus':''}${state.hover===p.i?' is-hover':''}`)
        .attr('data-sample',p=>p.i).attr('data-id',p=>DATA.samples.ids[p.i]).attr('data-layer',p=>p.layer)
        .attr('transform',p=>`translate(${p.x},${p.y})`)
        .attr('d',p=>d3.symbol().type(isError(p.i)?d3.symbolTriangle:d3.symbolCircle).size(emphasized(p.i)?90:!included(p.i)?12:isError(p.i)?34:geometry.temporal?22:18)())
        .attr('fill',p=>included(p.i)?COLORS[label(p.i)]:'#aab5b0').attr('opacity',p=>pointOpacity(p.i))
        .attr('pointer-events',p=>included(p.i)?'auto':'none')
        .on('mouseenter',function(e,p) {
          if (state.mode==='brush') return;
          state.hover=p.i;state.hoverLayer=p.layer;
          markHover();updateInspector();
        })
        .on('mouseleave',function() {
          state.hover=null;markHover();updateInspector();
        })
        .on('click',function(e,p) {e.stopPropagation(); pin(p.i,p.layer);});
      d3.select(this).selectAll('path.is-focus').raise();
    });
  }

  function markHover(){svg.select('.points').selectAll('.point').classed('is-hover',p=>p.i===state.hover);}

  function pin(i,layer=state.detailLayer) {
    if (!Number.isInteger(i) || i<0 || i>=1000) return;
    $('app').classList.remove('detail-dismissed');
    stop(); state.pinned=i; state.hover=null; state.detailLayer=layer;
    renderAll();
  }

  function drawDigit(canvas,i) {
    const size=28, cols=40, c=canvas.getContext('2d');
    c.clearRect(0,0,canvas.width,canvas.height);
    c.imageSmoothingEnabled=false;
    c.drawImage(atlas,(i%cols)*size,Math.floor(i/cols)*size,size,size,0,0,canvas.width,canvas.height);
  }

  function makeTiles(container,indices,withLabels=true) {
    const tiles=d3.select(container).selectAll('button').data(indices,i=>i).join(enter=> {
      const b=enter.append('button').attr('type','button').attr('class','digit-tile');
      b.append('canvas').attr('width',28).attr('height',28).attr('aria-hidden','true');
      if (withLabels) b.append('span');
      return b;
    });
    tiles.classed('selected',i=>i===state.pinned)
      .attr('aria-label',i=>`Inspeccionar imagen ${DATA.samples.ids[i]}, clase ${label(i)}, predicción ${prediction(i)}`)
      .attr('title',i=>`#${DATA.samples.ids[i]} · real ${label(i)} → predicción ${prediction(i)}`)
      .on('click',(_,i)=>pin(i));
    tiles.select('span').text(i=>`${label(i)} → ${prediction(i)}`);
    tiles.select('canvas').each(function(i){drawDigit(this,i);});
  }

  function updateInspector() {
    const i=state.hover??state.pinned;
    $('inspector-empty').hidden=i!==null;
    $('inspector-detail').hidden=i===null;
    $('app').classList.toggle('has-preview',i!==null);
    if (i===null) {lastInspectorKey='';$('preview-status').textContent='Vista previa';$('unpin').hidden=true;$('neighbor-links').disabled=true;return;}
    const l=state.task==='t1'?state.layer:state.hover!==null?state.hoverLayer:state.detailLayer;
    const preview=state.hover!==null&&state.hover!==state.pinned;
    const key=`${state.experiment}:${i}:${epoch()}:${l}:${included(i)}:${preview}:${state.pinned}:${comparing()}:${state.reference}:${state.neighborLinks}`;
    if (key===lastInspectorKey) return;
    lastInspectorKey=key;
    $('sample-id').textContent=`MNIST #${DATA.samples.ids[i]}${included(i)?'':' · fuera del filtro'}`;
    $('preview-status').textContent=preview||state.pinned===null?'Vista previa':'Fijada';
    $('unpin').hidden=state.pinned===null;
    drawDigit($('digit-image'),i);
    $('digit-image').setAttribute('aria-label',`Imagen MNIST ${DATA.samples.ids[i]}, dígito verdadero ${label(i)}`);
    $('true-label').textContent=label(i); $('pred-label').textContent=prediction(i);
    $('prediction-status').textContent=isError(i)?'△ error':'○ acierto';
    $('detail-epoch').textContent=`· época ${epoch()}`;
    const probs=record().probabilities[epochIndex()][i];
    const w=$('probability-bars').clientWidth||220, left=18, right=43;
    const ranking=d3.range(10).sort((a,b)=>probs[b]-probs[a]).slice(0,3);
    if(!ranking.includes(label(i)))ranking.push(label(i));
    const h=ranking.length*20;
    const scale=d3.scaleLinear().domain([0,1]).range([0,w-left-right]);
    const bars=d3.select('#probability-bars').attr('viewBox',`0 0 ${w} ${h}`).style('height',`${h}px`);
    const rows=bars.selectAll('g').data(ranking,c=>c).join(enter=> {
      const g=enter.append('g'); g.append('rect').attr('class','track'); g.append('rect').attr('class','bar');
      g.append('text').attr('class','label'); g.append('text').attr('class','value'); return g;
    }).attr('transform',(c,j)=>`translate(0,${j*20})`);
    rows.select('.track').attr('x',left).attr('y',3).attr('width',scale(1)).attr('height',9).attr('fill','#eeeee7');
    rows.select('.bar').attr('x',left).attr('y',3).attr('width',c=>Math.max(0,scale(probs[c]))).attr('height',9).attr('fill',c=>COLORS[c]);
    rows.select('.label').attr('x',1).attr('y',11).text(c=>c).attr('font-weight',c=>c===prediction(i)?700:400);
    rows.select('.value').attr('x',w-1).attr('y',11).attr('text-anchor','end').text(c=>`${(probs[c]*100).toFixed(1)}%`);
    const history=d3.select('#prediction-history').selectAll('.prediction-cell').data(EPOCHS).join(enter=> {
      const b=enter.append('span').attr('class','prediction-cell');b.append('small');b.append('span');return b;
    }).classed('is-active',e=>e===epoch()).classed('is-error',(e,j)=>record().predictions[j][i]!==label(i))
      .attr('aria-label',(e,j)=>`Época ${e}: predicción ${record().predictions[j][i]}`);
    history.select('small').text(e=>`E${e}`);history.select('span').text((e,j)=>record().predictions[j][i]);
    $('neighbor-layer').textContent=`· capa ${l+1}`;
    const now=record().neighbors[`${epoch()}_${l}`][i];
    makeTiles($('neighbors'),now);
    const baseline=comparing()?record().neighbors[`${EPOCHS[state.reference]}_${l}`][i]:state.task==='t2'?record().neighbors[`${epoch()}_0`][i]:null;
    $('sample-comparison').hidden=!comparing();
    $('sample-comparison').textContent=comparing()?`Predicción: ${record().predictions[state.reference][i]} → ${prediction(i)} · real ${label(i)}`:'';
    if(baseline){
      const changed=VLMAnalysis.neighbors(baseline,now),baseName=comparing()?`época ${EPOCHS[state.reference]}`:'capa 1';
      $('neighbor-change').textContent=`Conserva ${changed.retained.length}/6 vecinos respecto a ${baseName}. ${changed.arrived.length} nuevos.`;
      d3.select('#neighbors').selectAll('button').classed('neighbor-arrived',j=>changed.arrived.includes(j)).attr('title',j=>`#${DATA.samples.ids[j]} · ${changed.arrived.includes(j)?'nuevo vecino':'vecino conservado'} · clase ${label(j)}`);
    }else{$('neighbor-change').textContent='Seis vecinos en las activaciones originales.';d3.select('#neighbors').selectAll('button').classed('neighbor-arrived',false);}
    $('neighbor-links').disabled=state.pinned===null;
    $('neighbor-links').setAttribute('aria-pressed',String(state.neighborLinks));
    $('neighbor-links').textContent=state.neighborLinks?'Ocultar vínculos de vecinos':'Conectar vecinos en el mapa';
  }

  function renderGallery() {
    const ids=state.selected.size?[...state.selected].filter(included):comparing()&&state.outcome?d3.range(1000).filter(included):[];
    $('gallery-section').hidden=ids.length===0;
    $('app').classList.toggle('has-gallery',ids.length>0);
    if (!ids.length) return;
    const pages=Math.ceil(ids.length/30);
    state.galleryPage=Math.max(0,Math.min(state.galleryPage,pages-1));
    $('gallery-title').textContent=`${ids.length} ${state.selected.size?'imágenes seleccionadas':'casos de este cambio'}`;
    $('gallery-page').textContent=`${state.galleryPage+1} / ${pages}`;
    $('gallery-prev').disabled=state.galleryPage===0;
    $('gallery-next').disabled=state.galleryPage===pages-1;
    makeTiles($('gallery'),ids.slice(state.galleryPage*30,(state.galleryPage+1)*30));
  }

  function renderMiniatures() {
    if (state.task!=='t1') return;
    const key=`${state.experiment}:${state.layer}:${$('epoch-strip').clientWidth}`;
    const buttons=d3.select('#epoch-strip').selectAll('button').data(EPOCHS).join(enter=> {
      const b=enter.append('button').attr('class','miniature').attr('type','button');
      b.append('canvas').attr('aria-hidden','true');
      const label=b.append('span').attr('class','mini-label');label.append('span').attr('class','epoch-word').text('ÉPOCA');label.append('span').attr('class','epoch-number');
      return b;
    }).attr('aria-pressed',e=>e===epoch()).attr('aria-label',e=>`Ver época ${e}`)
      .on('click',(_,e)=>{stop();setEpoch(EPOCHS.indexOf(e));});
    buttons.select('.epoch-number').text(e=>e);
    if (key===miniatureKey) return;
    miniatureKey=key;
    const frames=seq().frames;
    buttons.select('canvas').each(function(_,j) {
      const width=Math.max(34,this.clientWidth),height=this.clientHeight,dpr=window.devicePixelRatio||1;
      this.width=width*dpr;this.height=height*dpr;
      const c=this.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,width,height);
      const side=Math.min(width-4,height-4),x=d3.scaleLinear().domain([-1.08,1.08]).range([(width-side)/2,(width+side)/2]);
      const y=d3.scaleLinear().domain([-1.08,1.08]).range([(height+side)/2,(height-side)/2]);
      c.globalAlpha=.72;
      frames[j].forEach((p,i)=>{c.fillStyle=COLORS[label(i)];c.beginPath();c.arc(x(p[0]),y(p[1]),.8,0,Math.PI*2);c.fill();});
    });
  }

  function renderMatrices() {
    const key=`${epoch()}:${state.experiment}:${state.confusion?.join('-')}`;
    if (key===lastMatrixKey) return;
    lastMatrixKey=key;
    const containers=d3.select('#matrix-grid').selectAll('div.matrix-item').data(['base']).join(enter=> {
      const d=enter.append('div').attr('class','matrix-item');d.append('h3');d.append('p');d.append('svg').attr('role','img');return d;
    });
    containers.each(function(exp) {
      const block=d3.select(this), predictions=DATA.experiments[exp].predictions[epochIndex()];
      const counts=Array.from({length:10},()=>Array(10).fill(0));
      predictions.forEach((p,i)=>counts[label(i)][p]++);
      const cells=counts.flatMap((row,real)=>row.map((count,pred)=>({real,pred,count,value:count/100})));
      const m=DATA.meta.experiments[exp].history[epochIndex()];
      block.select('h3').text('Clasificación de dígitos MNIST');
      block.select('p').text(`Época ${epoch()} · prueba completa: ${percent(m.test_accuracy)} (n=10 000)`);
      const s=block.select('svg').attr('viewBox','0 0 290 285').attr('aria-label',`Matriz de confusión ${exp}, época ${epoch()}`);
      const color=d3.scaleSequential(d3.interpolatePurples).domain([0,1]);
      s.selectAll('rect.matrix-cell').data(cells).join('rect').attr('class','matrix-cell')
        .classed('active',d=>exp===state.experiment&&state.confusion?.[0]===d.real&&state.confusion?.[1]===d.pred)
        .attr('x',d=>28+d.pred*24).attr('y',d=>14+d.real*24).attr('width',23).attr('height',23)
        .attr('fill',d=>color(d.value)).on('click',(_,d)=> {
          stop();state.experiment=exp;state.classes.clear();state.errors=false;state.outcome=null;
          state.confusion=state.confusion?.[0]===d.real&&state.confusion?.[1]===d.pred?null:[d.real,d.pred];
          state.selected=new Set(d3.range(1000).filter(i=>state.confusion&&label(i)===d.real&&DATA.experiments[exp].predictions[epochIndex()][i]===d.pred));
          state.galleryPage=0;miniatureKey='';renderAll(true);
          $('diagnostics').close();
        }).selectAll('title').data(d=>[d]).join('title').text(d=>`Real ${d.real} → predicción ${d.pred}: ${d.count} imágenes (${Math.round(d.value*100)}%)`);
      s.selectAll('text.cell-value').data(cells.filter(d=>d.count>0)).join('text').attr('class','cell-value')
        .attr('x',d=>39.5+d.pred*24).attr('y',d=>29+d.real*24).attr('text-anchor','middle')
        .attr('fill',d=>d.value>.5?'#fff':'#4d425a').attr('pointer-events','none').text(d=>d.count);
      s.selectAll('text.row-label').data(d3.range(10)).join('text').attr('class','row-label').attr('x',17).attr('y',d=>29+d*24).attr('text-anchor','middle').text(d=>d);
      s.selectAll('text.col-label').data(d3.range(10)).join('text').attr('class','col-label').attr('x',d=>39.5+d*24).attr('y',267).attr('text-anchor','middle').text(d=>d);
      s.selectAll('text.axis-label').data([{x:148,y:281,text:'Clase predicha'}]).join('text').attr('class','axis-label').attr('x',d=>d.x).attr('y',d=>d.y).attr('text-anchor','middle').attr('fill','#687573').text(d=>d.text);
    });
  }

  function comparisonStats(){
    const ids=d3.range(DATA.samples.ids.length).filter(i=>!state.classes.size||state.classes.has(label(i)));
    return VLMAnalysis.summarize(DATA.samples.labels,record().predictions[state.reference],record().predictions[epochIndex()],ids);
  }

  function renderComparisonControls(){
    const active=comparing();
    $('app').classList.toggle('is-comparing',active);
    $('comparison-controls').hidden=state.task!=='t1';
    $('compare-on').checked=state.compare;
    $('reference-epoch').value=state.reference;$('reference-epoch').disabled=!active;
    $('regions-on').checked=state.regions;
    $('comparison-direction').textContent=active?`A ${EPOCHS[state.reference]} → B ${epoch()} · B se elige abajo.`:'B se elige en las miniaturas.';
    $('transition-filters').hidden=!active;
    const stats=comparisonStats();
    const names={fixed:'Pasan a acierto',new:'Empiezan a fallar',persistent:'Siguen fallando',steady:'Siguen acertando'};
    const buttons=d3.select('#transition-filters').selectAll('button').data(['fixed','new','persistent','steady']).join(enter=>{
      const b=enter.append('button').attr('type','button');b.append('strong');b.append('span');return b;
    }).attr('data-outcome',d=>d).attr('aria-pressed',d=>d===state.outcome).attr('aria-label',d=>`${names[d]}: ${stats[d]} imágenes`)
      .on('click',(_,d)=>{$('app').classList.remove('detail-dismissed');stop();state.outcome=state.outcome===d?null:d;state.errors=false;state.confusion=null;state.selected.clear();state.pinned=null;state.hover=null;renderAll();});
    buttons.select('strong').text(d=>stats[d]);buttons.select('span').text(d=>names[d]);
    $('comparison-summary').textContent=active?`${stats.beforeErrors} → ${stats.afterErrors} errores · ${stats.n} imágenes${state.classes.size?' de las clases elegidas':''}.`:'';
  }

  function drawRegions(){
    svg.select('.class-regions').attr('visibility',animatePositions?'hidden':null);
    const groups=svg.select('.class-regions').selectAll('g.region-panel').data(geometry.panels).join('g')
      .attr('class','region-panel').attr('clip-path',(_,l)=>`url(#panel-clip-${l})`)
      .attr('display',(_,l)=>!state.regions||(!geometry.temporal&&l>state.reveal)?'none':null);
    groups.each(function(_,l){
      const fi=geometry.temporal?epochIndex():l,frame=geometry.frames[fi];
      const classes=seq().quality[fi].neighborhood_hit<.6?[...state.classes]:d3.range(10);
      const shapes=classes.map(c=>{
        const key=`${state.experiment}:${state.task}:${state.task==='t1'?state.layer:epoch()}:${fi}:${c}`;
        if(!contourCache.has(key)){
          const points=frame.filter((_,i)=>label(i)===c).map(p=>[(p[0]+1.04)*512/2.08,(1.04-p[1])*512/2.08]);
          // One fixed density level and bandwidth, in normalized coordinates, across every state.
          const region=d3.contourDensity().size([512,512]).bandwidth(9).thresholds([.008])(points)[0];
          contourCache.set(key,region);
        }
        return {c,shape:contourCache.get(key)};
      });
      const projection=d3.geoTransform({point(x,y){const p=screen([x*2.08/512-1.04,1.04-y*2.08/512],l);this.stream.point(...p);}});
      const path=d3.geoPath(projection);
      d3.select(this).selectAll('path.class-region').data(shapes,d=>d.c).join('path').attr('class','class-region')
        .attr('data-class',d=>d.c).attr('d',d=>path(d.shape)).attr('fill',d=>COLORS[d.c]).attr('fill-opacity',.025)
        .attr('stroke',d=>COLORS[d.c]).attr('stroke-width',d=>state.classes.has(d.c)?1.3:.8)
        .attr('stroke-opacity',d=>state.classes.size&&!state.classes.has(d.c)?.15:.4);
    });
  }

  function drawComparison(){
    const group=svg.select('.comparison-marks').attr('clip-path','url(#panel-clip-0)');
    let ids=[];
    if(comparing()){
      if(focused()!==null)ids=[focused()];
      else if(state.selected.size)ids=[...state.selected].filter(included);
      else if(state.outcome&&state.outcome!=='steady')ids=d3.range(1000).filter(included);
    }
    const pairs=ids.map(i=>({i,a:screen(geometry.frames[state.reference][i],0),b:screen(geometry.frames[epochIndex()][i],0)}));
    group.selectAll('line.comparison-link').data(state.trails?pairs:[],d=>d.i).join('line').attr('class','comparison-link')
      .attr('x1',d=>d.a[0]).attr('y1',d=>d.a[1]).attr('x2',d=>d.b[0]).attr('y2',d=>d.b[1])
      .attr('stroke',d=>COLORS[label(d.i)]).attr('stroke-width',1.25).attr('stroke-opacity',state.compareOpacity)
      .attr('stroke-dasharray','3 3');
    group.selectAll('circle.reference-point').data(pairs,d=>d.i).join('circle').attr('class','reference-point')
      .attr('data-sample',d=>d.i).attr('cx',d=>d.a[0]).attr('cy',d=>d.a[1]).attr('r',4.5)
      .attr('fill','#fffefa').attr('stroke',d=>COLORS[label(d.i)]).attr('stroke-width',1.6);
  }

  function drawNeighborLinks(){
    const pinned=focused(),links=[];
    if(state.neighborLinks&&pinned!==null){
      geometry.panels.forEach((_,l)=>{
        if(!geometry.temporal&&l>state.reveal)return;
        const layer=geometry.temporal?state.layer:l,frame=geometry.frames[geometry.temporal?epochIndex():l];
        const a=screen(frame[pinned],l);
        for(const i of record().neighbors[`${epoch()}_${layer}`][pinned])links.push({i,l,a,b:screen(frame[i],l)});
      });
    }
    const groups=svg.select('.neighbor-marks').selectAll('g').data(geometry.panels).join('g').attr('clip-path',(_,l)=>`url(#panel-clip-${l})`);
    groups.each(function(_,l){
      const local=links.filter(d=>d.l===l),g=d3.select(this);
      g.selectAll('line').data(local,d=>d.i).join('line').attr('x1',d=>d.a[0]).attr('y1',d=>d.a[1]).attr('x2',d=>d.b[0]).attr('y2',d=>d.b[1]).attr('stroke','#435d67').attr('stroke-width',.8).attr('stroke-opacity',.7);
      g.selectAll('circle.neighbor-ring').data(local,d=>d.i).join('circle').attr('class','neighbor-ring').attr('cx',d=>d.b[0]).attr('cy',d=>d.b[1]).attr('r',5).attr('fill','none').attr('stroke',d=>COLORS[label(d.i)]).attr('stroke-width',1.6);
    });
  }

  function renderEvolution(){
    const temporal=state.task==='t1',width=$('evolution-chart').clientWidth||300,height=174;
    const x=d3.scalePoint().domain(d3.range(temporal?7:4)).range([38,width-13]),y=d3.scaleLinear().domain([0,1]).range([143,30]);
    const values=temporal?[
      {name:'Exactitud',color:'#202d32',v:DATA.meta.experiments.base.history.map(h=>h.sample_accuracy)},
      {name:'NH',color:'#287f8e',v:seq().quality.map(q=>q.neighborhood_hit)}
    ]:[{name:'NH',color:'#287f8e',v:seq().quality.map(q=>q.neighborhood_hit)},
       {name:'Fidelidad',color:'#202d32',v:seq().quality.map(q=>q.trustworthiness)}];
    const chart=d3.select('#evolution-chart').attr('viewBox',`0 0 ${width} ${height}`);chart.selectAll('*').remove();
    $('evolution-title').textContent=temporal?'Separación y aciertos':'Representación por capa';
    values.forEach((d,j)=>{const left=38+j*(width-38)/2;chart.append('line').attr('x1',left).attr('x2',left+14).attr('y1',10).attr('y2',10).attr('stroke',d.color).attr('stroke-width',2.3);chart.append('text').attr('x',left+20).attr('y',14).text(d.name);});
    chart.append('g').attr('class','evolution-axis').attr('transform','translate(38,0)').call(d3.axisLeft(y).tickValues([0,.5,1]).tickFormat(d3.format('.0%')).tickSize(-(width-51))).call(g=>g.select('.domain').remove());
    chart.append('g').attr('class','evolution-axis').attr('transform','translate(0,143)').call(d3.axisBottom(x).tickFormat(i=>temporal?EPOCHS[i]:`C${i+1}`).tickSize(0)).call(g=>g.select('.domain').remove());
    if(comparing())chart.append('line').attr('class','reference-cursor').attr('x1',x(state.reference)).attr('x2',x(state.reference)).attr('y1',29).attr('y2',143).attr('stroke','#8a9891').attr('stroke-dasharray','3 3');
    if(temporal)chart.append('line').attr('x1',x(epochIndex())).attr('x2',x(epochIndex())).attr('y1',29).attr('y2',143).attr('stroke','#aab5b0');
    values.forEach(d=>{
      chart.append('path').attr('d',d3.line().x((_,i)=>x(i)).y(y)(d.v)).attr('fill','none').attr('stroke',d.color).attr('stroke-width',2);
      chart.append('g').selectAll('circle').data(d.v).join('circle').attr('cx',(_,i)=>x(i)).attr('cy',y).attr('r',(_,i)=>temporal&&i===epochIndex()?3.6:2.1).attr('fill',d.color).append('title').text((v,i)=>`${temporal?'Época '+EPOCHS[i]:'Capa '+(i+1)} · ${d.name}: ${percent(v)}`);
    });
    const current=temporal?epochIndex():state.detailLayer;
    const describe=(i,preview=false)=>`${preview?'Consulta · ':''}${temporal?'Época '+EPOCHS[i]:'Capa '+(i+1)} · ${values.map(d=>`${d.name} ${percent(d.v[i])}`).join(' · ')}`;
    $('evolution-current').textContent=describe(current);
    chart.attr('aria-label',temporal?'Evolución de exactitud y NH; pasa para consultar sin cambiar la época':'Calidad por capa; pasa para consultar sin cambiar la capa')
      .on('pointermove',event=>{
        const px=d3.pointer(event,chart.node())[0],i=d3.least(d3.range(temporal?7:4),(a,b)=>Math.abs(x(a)-px)-Math.abs(x(b)-px));
        $('evolution-current').textContent=describe(i,true);
        chart.selectAll('line.evolution-hover').data([i]).join('line').attr('class','evolution-hover').attr('x1',x(i)).attr('x2',x(i)).attr('y1',29).attr('y2',143).attr('stroke','#687573').attr('stroke-dasharray','2 3').attr('pointer-events','none');
      }).on('pointerleave',()=>{chart.selectAll('.evolution-hover').remove();$('evolution-current').textContent=describe(current);});
    $('evolution-note').textContent=temporal?'1 000 imágenes · NH: vecinos de igual clase en 2D. Checkpoints con intervalos desiguales.':'NH: mezcla por clase. Fidelidad: trustworthiness de los vecinos originales. Muestra completa.';
  }

  async function saveEvidence(){
    stop();$('save-evidence').disabled=true;$('evidence-status').textContent='Preparando evidencia…';
    try{
      // Keep the capture and the reported state together throughout asynchronous image decoding.
      const snapshot={task:state.task,layer:state.layer+1,epoch:epoch(),reference:comparing()?EPOCHS[state.reference]:null,
        outcome:state.outcome,classes:[...state.classes],errorsOnly:state.errors,confusion:state.confusion,
        visible:d3.range(1000).filter(included).map(i=>DATA.samples.ids[i]),selection:[...state.selected].filter(included).map(i=>DATA.samples.ids[i]),comparison:comparing()?comparisonStats():null,
        seed:DATA.meta.seed,projection:DATA.meta.projection.name,quality:seq().quality,
        sample:state.pinned===null?null:{id:DATA.samples.ids[state.pinned],truth:label(state.pinned),prediction:prediction(state.pinned),
          referencePrediction:comparing()?record().predictions[state.reference][state.pinned]:null,
          neighbors:record().neighbors[`${epoch()}_${state.task==='t1'?state.layer:state.detailLayer}`][state.pinned].map(i=>DATA.samples.ids[i])}};
      if(snapshot.sample){
        const selected=state.pinned,layer=state.task==='t1'?state.layer:state.detailLayer;
        const reference=comparing()?record().neighbors[`${EPOCHS[state.reference]}_${layer}`][selected]:state.task==='t2'?record().neighbors[`${epoch()}_0`][selected]:null;
        snapshot.sample.referenceNeighbors=reference?reference.map(i=>DATA.samples.ids[i]):null;
        snapshot.sample.retainedNeighbors=reference?reference.filter(i=>record().neighbors[`${epoch()}_${layer}`][selected].includes(i)).map(i=>DATA.samples.ids[i]):null;
        const digit=document.createElement('canvas');digit.width=digit.height=28;drawDigit(digit,selected);snapshot.sample.image=digit.toDataURL('image/png');
      }
      const width=geometry.width,height=geometry.height;
      const canvas=document.createElement('canvas');canvas.width=width*2;canvas.height=height*2;
      const c=canvas.getContext('2d');c.scale(2,2);c.fillStyle='#fffefa';c.fillRect(0,0,width,height);c.drawImage($('trails-canvas'),0,0,width,height);
      const clone=$('plot').cloneNode(true),style=document.createElementNS('http://www.w3.org/2000/svg','style');
      style.textContent='.axis line{stroke:#e8e9e2}.axis path{stroke:none}.point{stroke:#ffffff80;stroke-width:.4}.point.is-focus{stroke:#202d32;stroke-width:1.8}.class-reference line{stroke-width:.7;opacity:.55}.class-reference text{font:12px monospace;fill:#202d32;text-anchor:middle;dominant-baseline:central;paint-order:stroke;stroke:#fffefa;stroke-width:3px}.layer-label,.projection-label{font:10px monospace;fill:#687573}';clone.prepend(style);
      const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'}));
      const overlay=new Image();try{overlay.src=url;await overlay.decode();c.drawImage(overlay,0,0,width,height);}finally{URL.revokeObjectURL(url);}
      const title=snapshot.reference===null?`${snapshot.task.toUpperCase()} · época ${snapshot.epoch}`:`Época ${snapshot.reference} → ${snapshot.epoch} · capa ${snapshot.layer}`;
      const stats=snapshot.comparison;
      const content=`<!doctype html><html lang="es"><meta charset="utf-8"><title>Evidencia · ${title}</title><style>body{max-width:1100px;margin:35px auto;padding:0 24px;font:16px/1.7 system-ui;color:#202d32}h1{font:36px Georgia}img{max-width:100%;border:1px solid #ddd}small{color:#687573}pre{white-space:pre-wrap;font-size:12px;background:#f7f5f0;padding:18px}strong{color:#245d70}</style><h1>${title}</h1><p>MNIST · ${snapshot.visible.length} imágenes cumplen los filtros de una cohorte fija de 1 000. ${snapshot.selection.length} seleccionadas por región.</p>${stats?`<p><strong>${stats.fixed}</strong> pasan de error a acierto; <strong>${stats.new}</strong> de acierto a error; <strong>${stats.persistent}</strong> siguen erradas y ${stats.steady} siguen correctas. Errores: ${stats.beforeErrors} → ${stats.afterErrors}. Cálculo sobre ${stats.n} imágenes de las clases elegidas, independiente de otros filtros.</p>`:''}${snapshot.sample?`<img alt="Imagen original seleccionada" src="${snapshot.sample.image}" style="width:96px;image-rendering:pixelated"><p>Ejemplo fijado: <b>MNIST #${snapshot.sample.id}</b>, etiqueta ${snapshot.sample.truth}, predicción ${snapshot.sample.referencePrediction===null?'':snapshot.sample.referencePrediction+' → '}${snapshot.sample.prediction}. ${snapshot.sample.retainedNeighbors===null?'':`Conserva ${snapshot.sample.retainedNeighbors.length}/6 vecinos originales respecto a la referencia.`}</p>`:''}<figure><img alt="Mapa y selección capturados" src="${canvas.toDataURL('image/png')}"><figcaption>Posiciones de AlignedUMAP. El color indica clase verdadera; ○ referencia y símbolo lleno estado activo al comparar.</figcaption></figure><p>Los vecinos se calculan en activaciones originales. Los contornos muestran concentración estimada en 2D, no regiones de decisión. Distancias y trayectorias no demuestran causalmente aprendizaje; la alineación puede atenuar cambios. Las transiciones de clasificación sí se obtienen de predicciones medidas.</p><small>Visual Learning Models · evidencia exportada localmente. Semilla ${snapshot.seed}. No se modificaron ni eliminaron ejemplos difíciles.</small><details><summary>Datos para verificar y reproducir la selección</summary><pre>${JSON.stringify(snapshot,null,2)}</pre></details><script id="evidence-data" type="application/json">${JSON.stringify(snapshot)}</script></html>`;
      const blobURL=URL.createObjectURL(new Blob([content],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=blobURL;a.download=`evidencia-${snapshot.task}-${snapshot.reference===null?'':snapshot.reference+'-'}${snapshot.epoch}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(blobURL),1000);
      $('evidence-status').textContent='Evidencia guardada con mapa, selección y datos.';
    }catch(e){$('evidence-status').textContent='No se pudo exportar: '+e.message;}
    finally{$('save-evidence').disabled=false;}
  }

  function makeMethod() {
    const meta=DATA.meta,base=meta.experiments.base.history.at(-1);
    $('method-content').innerHTML=`<p><b>Modelo:</b> MLP 784 → 128 → 128 → 128 → 128 → 10, ReLU y Adam. Semilla 42. Entrenamiento continuo durante 20 épocas, con instantáneas reales, incluida la época 0.</p>
      <p><b>Datos:</b> 50 000 imágenes de entrenamiento, 10 000 de validación y 10 000 de prueba. Se visualiza una muestra fija de 1 000 imágenes de prueba, 100 por dígito.</p>
      <p><b>Proyección:</b> AlignedUMAP no supervisado, 15 vecinos, min_dist 0.1 y regularización de alineación 0.01. Las etiquetas no intervienen en la proyección. Cada secuencia tiene un sistema de coordenadas propio; no se comparan posiciones absolutas entre secuencias distintas.</p>
      <p><b>Agrupamiento:</b> curvas Bézier atraídas hacia centroides de clase, conservando las posiciones medidas. La desviación está limitada respecto de la distancia entre extremos y no retrocede a lo largo de su conexión. Así se evitan arcos grandes en imágenes casi inmóviles. Esta adaptación usa etiquetas verdaderas para organizar el dibujo. La existencia de haces no demuestra por sí misma que el modelo haya separado clases. No reproduce el algoritmo GPU CUBu del paper.</p>
      <p><b>Comparación:</b> A y B usan posiciones medidas de la misma secuencia. Los grupos de cambio se calculan con predicciones y etiquetas reales, no con distancias 2D. Un error persistente puede cambiar de clase predicha sin llegar a acertar. Los contornos son densidades por clase con ancho y umbral fijos; no fronteras de decisión. La exactitud de la curva usa las mismas 1 000 imágenes que NH.</p>
      <p><b>Época 0:</b> corresponde a la red inicial sin entrenamiento, no a una proyección de píxeles originales. El tramo 0→1 permite comparar esa referencia con el primer estado entrenado. Se puede atenuar su dibujo de contexto para examinar cambios posteriores; seleccionar una imagen recupera todo su recorrido visible.</p>
      <p><b>Calidad:</b> NH₆ mide la fracción de vecinos de igual clase en 2D. Trust₁₀ mide preservación de vecindarios respecto de activaciones originales. La selección de vecinos del inspector se calcula en las activaciones originales.</p>
      <table><tr><td>Exactitud final · prueba completa</td><td>${percent(base.test_accuracy)}</td></tr><tr><td>Observaciones visualizadas</td><td>1 000 / 10 000</td></tr></table>
      <p><b>Límites:</b> la alineación regulariza el movimiento y puede atenuarlo. Distancias, áreas y curvas no son explicaciones causales. Las transiciones animadas interpolan posiciones: sus puntos intermedios no son estados del entrenamiento medidos.</p>`;
  }

  boot();
})();
