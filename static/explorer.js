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
    classes: new Set(), errors: false, isolate: false, trails: true, bundle: true, fullTrails: false,
    strength: .45, opacity: .12, mode: 'pan', pinned: null, hover: null,
    detailLayer: 3, selected: new Set(), galleryPage: 0, confusion: null,
    transform: d3.zoomIdentity, playing: false, reveal: 3
  };
  let DATA, atlas, geometry, svg, ctx, zoom, brush;
  let timer = null, animation = null, animatePositions = null, brushBusy = false;
  let renderQueued = false, lastInspectorKey = '', lastMatrixKey = '', miniatureKey = '';
  const record = () => DATA.experiments[state.experiment];
  const epochIndex = () => state.epochs[state.task];
  const epoch = () => EPOCHS[epochIndex()];
  const seq = () => record().sequences[state.task === 't1' ? `t1-l${state.layer}` : `t2-e${epoch()}`];
  const focused = () => state.pinned ?? state.hover;
  const label = i => DATA.samples.labels[i];
  const prediction = i => record().predictions[epochIndex()][i];
  const isError = i => prediction(i) !== label(i);

  function included(i) {
    if (state.classes.size && !state.classes.has(label(i))) return false;
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
    if (!included(i)) return state.isolate ? 0 : .045;
    const hasSelection = focused() !== null || state.selected.size > 0;
    return hasSelection && !emphasized(i) ? .16 : .88;
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
    d3.select('#epoch-buttons').selectAll('button').data(EPOCHS).join('button')
      .attr('type', 'button').attr('aria-label', e => `Época ${e}`)
      .text(e => e).on('click', (_, e) => {stop(); setEpoch(EPOCHS.indexOf(e));});
    d3.select('#class-legend').selectAll('button').data(d3.range(10)).join('button')
      .attr('type', 'button').attr('aria-label', c => `Filtrar dígito ${c}`)
      .style('--class-color', c => COLORS[c]).text(c => c)
      .on('click', (_, c) => {
        stop();
        if (state.classes.has(c)) state.classes.delete(c); else state.classes.add(c);
        state.confusion = null;
        renderAll();
      });
    for (const [id, prop] of [['show-trails','trails'], ['bundle','bundle'], ['full-trails','fullTrails'], ['errors-only','errors'], ['isolate','isolate']]) {
      $(id).addEventListener('change', e => {state[prop] = e.target.checked; renderAll();});
    }
    $('strength').addEventListener('input', e => {state.strength = +e.target.value / 100; updateControls(); drawTrails();});
    $('opacity').addEventListener('input', e => {state.opacity = +e.target.value / 100; updateControls(); drawTrails();});
    $('layer').addEventListener('change', e => {const layer = +e.target.value; stop(); state.layer = layer; state.detailLayer = state.layer; miniatureKey = ''; renderAll(true);});
    $('experiment').addEventListener('change', e => {const experiment = e.target.value; stop(); state.experiment = experiment; state.confusion = null; miniatureKey = ''; renderAll(true);});
    $('prev').onclick = () => {stop(); setEpoch(Math.max(0, epochIndex()-1));};
    $('next').onclick = () => {stop(); setEpoch(Math.min(6, epochIndex()+1));};
    $('play').onclick = () => state.playing ? stop() : play();
    $('mode-pan').onclick = () => setMode('pan');
    $('mode-brush').onclick = () => {stop(); setMode('brush');};
    $('clear-filters').onclick = () => {
      state.classes.clear(); state.errors = false; state.isolate = false; state.confusion = null;
      renderAll();
    };
    $('clear-selection').onclick = () => {
      state.selected.clear(); state.pinned = null; state.hover = null; state.galleryPage = 0;
      renderAll();
    };
    $('reset-view').onclick = () => {state.transform = d3.zoomIdentity; svg.call(zoom.transform, d3.zoomIdentity);};
    $('unpin').onclick = () => {state.pinned = null; state.hover = null; renderAll();};
    $('gallery-prev').onclick = () => {state.galleryPage = Math.max(0, state.galleryPage-1); renderGallery();};
    $('gallery-next').onclick = () => {state.galleryPage++; renderGallery();};
    $('diagnostics').addEventListener('toggle', () => {if ($('diagnostics').open) renderMatrices();});
    document.querySelectorAll('[data-task]').forEach(b => b.onclick = () => setTask(b.dataset.task));
    $('help-open').onclick = () => $('help-dialog').showModal();
    $('method-open').onclick = () => $('method-dialog').showModal();
    document.querySelectorAll('.dialog-close').forEach(b => b.onclick = () => b.closest('dialog').close());
    document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', e => {if (e.target === dialog) dialog.close();}));
    const previews = [0, 104, 271, 419, 605, 801];
    makeTiles($('sample-preview'), previews, false);
  }

  function setupInteractions() {
    zoom = d3.zoom().scaleExtent([.7, 16])
      .filter(e => state.mode === 'pan' && (!e.button || e.type === 'wheel') && e.type !== 'dblclick')
      .on('zoom', e => {
        state.transform = e.transform;
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
    svg.append('g').attr('class','points');
    svg.append('g').attr('class','brush');
    svg.append('g').attr('class','plot-labels').attr('pointer-events','none');
    svg.on('mouseleave', () => {if (state.hover !== null) {state.hover = null; hideTooltip(); requestPlot(); updateInspector();}});
  }

  function setTask(task) {
    if (!['t1','t2'].includes(task)) return;
    stop(); state.task = task; state.hover = null; state.reveal = 3;
    state.detailLayer = task === 't1' ? state.layer : 3;
    state.confusion = null;
    miniatureKey = '';
    renderAll(true);
  }

  function setEpoch(index, animate=true) {
    index = Math.max(0, Math.min(6, index));
    const old = state.task === 't1' && geometry ? seq().frames[epochIndex()] : null;
    if (animation) {animation.stop(); animation = null;}
    animatePositions = null;
    state.epochs[state.task] = index;
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
        if (t === 1) {animation.stop(); animation = null; animatePositions = null;}
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
    $('experiment').value = state.experiment;
    $('layer').value = state.layer;
    $('layer-control').hidden = !temporal;
    $('epoch-label').textContent = temporal ? 'Época activa' : 'Época fija';
    $('task-note').textContent = temporal ? 'La capa permanece fija. Cambia el entrenamiento.' : 'La época permanece fija. Compara las cuatro capas.';
    $('play').textContent = state.playing ? 'Ⅱ Pausar' : temporal ? '▶ Recorrer épocas' : '▶ Recorrer capas';
    $('prev').disabled = epochIndex() === 0;
    $('next').disabled = epochIndex() === 6;
    for (const [id, prop] of [['show-trails','trails'],['bundle','bundle'],['full-trails','fullTrails'],['errors-only','errors'],['isolate','isolate']]) $(id).checked = state[prop];
    $('full-trails-control').hidden = !temporal;
    $('full-trails').disabled = !state.trails;
    $('strength-value').value = `${Math.round(state.strength*100)}%`;
    $('opacity-value').value = `${Math.round(state.opacity*100)}%`;
    $('strength').disabled = !state.bundle || !state.trails;
    $('opacity').disabled = !state.trails;
    $('time-legend').hidden = !temporal || (!state.fullTrails && epochIndex() === 0);
    $('time-legend-end').textContent = state.fullTrails ? '20' : epoch();
    const finalColor = d3.hsl(COLORS[0]);
    const rampStart = finalColor.copy({l:Math.max(.18,finalColor.l*.42)}).formatRgb();
    const rampEnd = finalColor.copy({l:Math.min(.67,finalColor.l)}).formatRgb();
    const shownEnd = d3.interpolateHsl(rampStart,rampEnd)(state.fullTrails ? 1 : epochIndex()/6);
    $('time-ramp').style.background = `linear-gradient(90deg,${rampStart},${shownEnd})`;
    $('epoch-strip').hidden = !temporal;
    d3.select('#epoch-buttons').selectAll('button').attr('aria-pressed', e => e === epoch());
    d3.select('#class-legend').selectAll('button').attr('aria-pressed', c => state.classes.has(c))
      .classed('is-muted', c => state.classes.size && !state.classes.has(c));
    document.querySelectorAll('[data-task]').forEach(b => b.setAttribute('aria-selected', b.dataset.task === state.task));
    $('chart-section').setAttribute('aria-labelledby', `tab-${state.task}`);
    $('chart-kicker').textContent = temporal ? 'EVOLUCIÓN DEL ENTRENAMIENTO' : 'REPRESENTACIONES ENTRE CAPAS';
    $('chart-title').textContent = temporal ? `Capa ${state.layer+1} · época ${epoch()}` : `Época ${epoch()} · cuatro capas`;
    const n = d3.range(1000).filter(included).length;
    const suffix = state.confusion ? ` · ${state.confusion[0]} → ${state.confusion[1]}` : '';
    $('visible-count').textContent = `${n.toLocaleString('es-PE')} / 1 000 imágenes${suffix}`;
    const q = seq().quality[temporal ? epochIndex() : state.detailLayer];
    $('quality-label').textContent = `${temporal?'':`Capa ${state.detailLayer+1} · `}NH₆ ${percent(q.neighborhood_hit)} · Trust₁₀ ${percent(q.trustworthiness)}`;
    $('quality-label').title = 'NH: vecinos de la misma clase en 2D. Trustworthiness: preservación de vecinos originales. Se evalúa la muestra completa, sin filtros.';
    $('chart-footnote').textContent = temporal
      ? state.fullTrails
        ? 'Recorrido completo 0–20: las curvas incluyen todas las épocas; los puntos muestran la época activa. El matiz indica clase y la luminancia indica avance.'
        : epochIndex() === 0
          ? 'Época 0: solo las posiciones iniciales, sin trayectorias. Avanza una época para empezar a construir el recorrido.'
          : `Recorrido acumulado 0–${epoch()}: cada curva sigue una imagen hasta la época activa, sin segmentos de épocas posteriores. Las miniaturas permiten comparar todos los estados.`
      : 'Cada curva conecta la misma imagen entre capas. Los haces se organizan por clase verdadera; su forma es una ayuda de lectura, no una conexión entre neuronas.';
  }

  function makeGeometry() {
    const temporal = state.task === 't1';
    $('plot-wrap').parentElement.classList.toggle('is-layers', !temporal);
    $('plot-wrap').style.height = temporal ? '' : '390px';
    const width = $('plot-wrap').clientWidth, height = $('plot-wrap').clientHeight;
    const margin = temporal ? {l:38,r:18,t:22,b:33} : {l:12,r:12,t:42,b:28};
    const gap = 30;
    const panelWidth = temporal ? width-margin.l-margin.r : (width-margin.l-margin.r-gap*3)/4;
    const panelHeight = height-margin.t-margin.b;
    const side = Math.min(panelWidth, panelHeight);
    const unit = side/2.16;
    const panels = d3.range(temporal ? 1 : 4).map(i => {
      const x = margin.l + i*(panelWidth+gap), y = margin.t;
      const xScale = d3.scaleLinear().domain([-1.08,1.08]).range([panelWidth/2-side/2,panelWidth/2+side/2]);
      const yScale = d3.scaleLinear().domain([-1.08,1.08]).range([panelHeight/2+side/2,panelHeight/2-side/2]);
      return {x,y,width:panelWidth,height:panelHeight,xScale,yScale,unit};
    });
    geometry = {width,height,panels,temporal,frames:seq().frames};
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
    updateControls(); makeGeometry(); renderPlot(); renderMiniatures(); updateInspector(); renderGallery();
    if ($('diagnostics').open) renderMatrices();
  }

  function requestPlot() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {renderQueued = false; renderPlot();});
  }

  function renderPlot() {if (geometry) {drawStructure(); drawTrails(); drawPoints();}}

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
        .call(d3.axisBottom(x).ticks(5).tickSize(-p.height).tickFormat(d3.format('.1f')));
      axes.append('g').attr('class','axis').attr('transform',`translate(${p.x},${p.y})`)
        .call(d3.axisLeft(y).ticks(5).tickSize(-p.width).tickFormat(d3.format('.1f')));
    }
    const labels = svg.select('.plot-labels'); labels.selectAll('*').remove();
    if (!temporal) {
      panels.forEach((p,i) => {
        labels.append('text').attr('class','layer-label').attr('x',p.x+p.width/2).attr('y',25).attr('text-anchor','middle').text(`CAPA ${i+1}`);
        labels.append('text').attr('class','projection-label').attr('x',p.x+p.width/2).attr('y',geometry.height-10).attr('text-anchor','middle').text('128 activaciones → 2D');
        if (i<3) labels.append('text').attr('class','projection-label').attr('x',p.x+p.width+15).attr('y',25).attr('text-anchor','middle').text('→');
      });
    } else {
      labels.append('text').attr('class','projection-label').attr('x',geometry.width-17).attr('y',geometry.height-7).attr('text-anchor','end').text('Proyección alineada · coordenadas relativas');
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
    if (!state.trails) return;
    const f = focused(), selected = state.selected;
    const stages = frames.length-1;
    const visibleStages = temporal ? (state.fullTrails ? stages : epochIndex()) : Math.min(stages,state.reveal);
    const alpha = state.bundle ? state.strength : 0;
    const drawOne = (i, stage, strong=false) => {
      const p0 = screen(frames[stage][i], temporal?0:stage);
      const p1 = screen(frames[stage+1][i], temporal?0:stage+1);
      const c0 = screen(centroids[stage][label(i)], temporal?0:stage);
      const c1 = screen(centroids[stage+1][label(i)], temporal?0:stage+1);
      if (!temporal) {
        const a = panels[stage], b = panels[stage+1];
        if (p0[0]<a.x || p0[0]>a.x+a.width || p0[1]<a.y || p0[1]>a.y+a.height || p1[0]<b.x || p1[0]>b.x+b.width || p1[1]<b.y || p1[1]>b.y+b.height) return;
      }
      const dx = p1[0]-p0[0], dy = p1[1]-p0[1];
      const cx0 = p0[0]+dx/3+(c0[0]-p0[0])*alpha;
      const cy0 = p0[1]+dy/3+(c0[1]-p0[1])*alpha;
      const cx1 = p1[0]-dx/3+(c1[0]-p1[0])*alpha;
      const cy1 = p1[1]-dy/3+(c1[1]-p1[1])*alpha;
      let opacity;
      if (strong) opacity = f !== null ? .96 : .68;
      else if (!included(i)) opacity = state.isolate ? 0 : state.opacity*.06;
      else opacity = (f !== null || selected.size) ? state.opacity*.2 : state.opacity;
      if (!opacity) return;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = strong ? 1.7 : .8;
      ctx.beginPath(); ctx.moveTo(...p0);
      if (state.bundle) ctx.bezierCurveTo(cx0,cy0,cx1,cy1,...p1); else ctx.lineTo(...p1);
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
        .attr('class',p=>`point${emphasized(p.i)?' is-focus':''}`)
        .attr('data-sample',p=>p.i).attr('data-id',p=>DATA.samples.ids[p.i]).attr('data-layer',p=>p.layer)
        .attr('transform',p=>`translate(${p.x},${p.y})`)
        .attr('d',p=>d3.symbol().type(isError(p.i)?d3.symbolTriangle:d3.symbolCircle).size(emphasized(p.i)?65:geometry.temporal?16:13)())
        .attr('fill',p=>COLORS[label(p.i)]).attr('opacity',p=>pointOpacity(p.i))
        .attr('pointer-events',p=>included(p.i)?'auto':'none')
        .on('mouseenter',function(e,p) {
          if (state.mode==='brush') return;
          state.hover=p.i; state.detailLayer=p.layer;
          showTooltip(e,p); requestPlot(); updateInspector(); updateControls();
        })
        .on('mousemove',function(e,p) {positionTooltip(e);})
        .on('mouseleave',function() {
          state.hover=null; hideTooltip(); requestPlot(); updateInspector();
        })
        .on('click',function(e,p) {e.stopPropagation(); pin(p.i,p.layer);});
      d3.select(this).selectAll('path.is-focus').raise();
    });
  }

  function showTooltip(event,p) {
    const tip=$('plot-tooltip'); tip.className='plot-tooltip'; tip.hidden=false;
    tip.innerHTML=`<b>Imagen #${DATA.samples.ids[p.i]}</b> · real ${label(p.i)}<small>Predicción ${prediction(p.i)} · capa ${p.layer+1} · época ${epoch()}</small>`;
    positionTooltip(event);
  }
  function positionTooltip(event) {
    const box=$('plot-wrap').getBoundingClientRect(), tip=$('plot-tooltip');
    tip.style.left=`${Math.min(geometry.width-tip.offsetWidth-10,Math.max(5,event.clientX-box.left+13))}px`;
    tip.style.top=`${Math.max(6,event.clientY-box.top-tip.offsetHeight-10)}px`;
  }
  function hideTooltip() {$('plot-tooltip').hidden=true;}

  function pin(i,layer=state.detailLayer) {
    if (!Number.isInteger(i) || i<0 || i>=1000) return;
    stop(); state.pinned=i; state.hover=null; state.detailLayer=layer;
    hideTooltip(); updateControls(); renderPlot(); updateInspector(); renderGallery();
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
    const i=focused();
    $('inspector-empty').hidden=i!==null;
    $('inspector-detail').hidden=i===null;
    if (i===null) {lastInspectorKey=''; return;}
    const l=state.task==='t1'?state.layer:state.detailLayer;
    const key=`${state.experiment}:${i}:${epoch()}:${l}:${state.pinned!==null}`;
    if (key===lastInspectorKey) return;
    lastInspectorKey=key;
    $('sample-id').textContent=`MNIST #${DATA.samples.ids[i]}${state.pinned!==null?' · FIJADA':''}`;
    $('unpin').hidden=state.pinned===null;
    drawDigit($('digit-image'),i);
    $('digit-image').setAttribute('aria-label',`Imagen MNIST ${DATA.samples.ids[i]}, dígito verdadero ${label(i)}`);
    $('true-label').textContent=label(i); $('pred-label').textContent=prediction(i);
    $('prediction-status').textContent=isError(i)?'△ error':'○ acierto';
    $('detail-epoch').textContent=`· época ${epoch()}`;
    const probs=record().probabilities[epochIndex()][i];
    const w=$('probability-bars').clientWidth||220, h=195, left=18, right=39;
    const scale=d3.scaleLinear().domain([0,1]).range([0,w-left-right]);
    const bars=d3.select('#probability-bars').attr('viewBox',`0 0 ${w} ${h}`);
    const rows=bars.selectAll('g').data(d3.range(10)).join(enter=> {
      const g=enter.append('g'); g.append('rect').attr('class','track'); g.append('rect').attr('class','bar');
      g.append('text').attr('class','label'); g.append('text').attr('class','value'); return g;
    }).attr('transform',c=>`translate(0,${c*19})`);
    rows.select('.track').attr('x',left).attr('y',3).attr('width',scale(1)).attr('height',9).attr('fill','#eeeee7');
    rows.select('.bar').attr('x',left).attr('y',3).attr('width',c=>Math.max(0,scale(probs[c]))).attr('height',9).attr('fill',c=>COLORS[c]);
    rows.select('.label').attr('x',1).attr('y',11).text(c=>c).attr('font-weight',c=>c===prediction(i)?700:400);
    rows.select('.value').attr('x',w-1).attr('y',11).attr('text-anchor','end').text(c=>`${Math.round(probs[c]*100)}%`);
    const history=d3.select('#prediction-history').selectAll('button').data(EPOCHS).join(enter=> {
      const b=enter.append('button').attr('type','button'); b.append('small'); b.append('span'); return b;
    }).attr('aria-pressed',e=>e===epoch()).classed('is-error',(e,j)=>record().predictions[j][i]!==label(i))
      .attr('aria-label',(e,j)=>`Época ${e}: predicción ${record().predictions[j][i]}`)
      .on('click',(_,e)=>{stop();setEpoch(EPOCHS.indexOf(e));});
    history.select('small').text(e=>`E${e}`);history.select('span').text((e,j)=>record().predictions[j][i]);
    $('neighbor-layer').textContent=`· capa ${l+1}`;
    makeTiles($('neighbors'),record().neighbors[`${epoch()}_${l}`][i]);
  }

  function renderGallery() {
    const ids=[...state.selected].filter(included);
    $('gallery-section').hidden=ids.length===0;
    if (!ids.length) return;
    const pages=Math.ceil(ids.length/30);
    state.galleryPage=Math.max(0,Math.min(state.galleryPage,pages-1));
    $('gallery-title').textContent=`${ids.length} imágenes seleccionadas`;
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
    const containers=d3.select('#matrix-grid').selectAll('div.matrix-item').data(['base','refined']).join(enter=> {
      const d=enter.append('div').attr('class','matrix-item');d.append('h3');d.append('p');d.append('svg').attr('role','img');return d;
    });
    containers.each(function(exp) {
      const block=d3.select(this), predictions=DATA.experiments[exp].predictions[epochIndex()];
      const counts=Array.from({length:10},()=>Array(10).fill(0));
      predictions.forEach((p,i)=>counts[label(i)][p]++);
      const cells=counts.flatMap((row,real)=>row.map((count,pred)=>({real,pred,count,value:count/100})));
      const m=DATA.meta.experiments[exp].history[epochIndex()];
      block.select('h3').text(exp==='base'?'Modelo base':'Modelo con dilatación');
      block.select('p').text(`Época ${epoch()} · prueba completa: ${percent(m.test_accuracy)} (n=10 000)`);
      const s=block.select('svg').attr('viewBox','0 0 290 285').attr('aria-label',`Matriz de confusión ${exp}, época ${epoch()}`);
      const color=d3.scaleSequential(d3.interpolatePurples).domain([0,1]);
      s.selectAll('rect.matrix-cell').data(cells).join('rect').attr('class','matrix-cell')
        .classed('active',d=>exp===state.experiment&&state.confusion?.[0]===d.real&&state.confusion?.[1]===d.pred)
        .attr('x',d=>28+d.pred*24).attr('y',d=>14+d.real*24).attr('width',23).attr('height',23)
        .attr('fill',d=>color(d.value)).on('click',(_,d)=> {
          stop();state.experiment=exp;state.classes.clear();state.errors=false;
          state.confusion=state.confusion?.[0]===d.real&&state.confusion?.[1]===d.pred?null:[d.real,d.pred];
          state.selected=new Set(d3.range(1000).filter(i=>state.confusion&&label(i)===d.real&&DATA.experiments[exp].predictions[epochIndex()][i]===d.pred));
          state.galleryPage=0;miniatureKey='';renderAll(true);
        }).selectAll('title').data(d=>[d]).join('title').text(d=>`Real ${d.real} → predicción ${d.pred}: ${d.count} imágenes (${Math.round(d.value*100)}%)`);
      s.selectAll('text.cell-value').data(cells.filter(d=>d.count>0)).join('text').attr('class','cell-value')
        .attr('x',d=>39.5+d.pred*24).attr('y',d=>29+d.real*24).attr('text-anchor','middle')
        .attr('fill',d=>d.value>.5?'#fff':'#4d425a').attr('pointer-events','none').text(d=>d.count);
      s.selectAll('text.row-label').data(d3.range(10)).join('text').attr('class','row-label').attr('x',17).attr('y',d=>29+d*24).attr('text-anchor','middle').text(d=>d);
      s.selectAll('text.col-label').data(d3.range(10)).join('text').attr('class','col-label').attr('x',d=>39.5+d*24).attr('y',267).attr('text-anchor','middle').text(d=>d);
      s.selectAll('text.axis-label').data([{x:148,y:281,text:'Clase predicha'}]).join('text').attr('class','axis-label').attr('x',d=>d.x).attr('y',d=>d.y).attr('text-anchor','middle').attr('fill','#687573').text(d=>d.text);
    });
    const base=DATA.meta.experiments.base.history[epochIndex()].test_accuracy;
    const refined=DATA.meta.experiments.refined.history[epochIndex()].test_accuracy;
    const delta=(refined-base)*100;
    $('refinement-result').textContent=`Intervención: dilatación 3×3 en el 25% del entrenamiento; prueba sin modificar. Diferencia de exactitud en época ${epoch()}: ${delta>=0?'+':''}${delta.toFixed(2)} puntos porcentuales. Un ensayo con semilla fija; no es una estimación de significancia estadística.`;
  }

  function makeMethod() {
    const meta=DATA.meta,base=meta.experiments.base.history.at(-1),ref=meta.experiments.refined.history.at(-1);
    $('method-content').innerHTML=`<p><b>Modelo:</b> MLP 784 → 128 → 128 → 128 → 128 → 10, ReLU y Adam. Semilla 42. Entrenamiento continuo durante 20 épocas, con instantáneas reales, incluida la época 0.</p>
      <p><b>Datos:</b> 50 000 imágenes de entrenamiento, 10 000 de validación y 10 000 de prueba. Se visualiza una muestra fija de 1 000 imágenes de prueba, 100 por dígito.</p>
      <p><b>Proyección:</b> AlignedUMAP no supervisado, 15 vecinos, min_dist 0.1 y regularización de alineación 0.01. Las etiquetas no intervienen en la proyección. Cada secuencia tiene un sistema de coordenadas propio; no se comparan posiciones absolutas entre capas seleccionadas o experimentos diferentes.</p>
      <p><b>Agrupamiento:</b> curvas Bézier atraídas hacia centroides de clase, conservando las posiciones medidas. Esta adaptación usa etiquetas verdaderas para organizar el dibujo. La existencia de haces no demuestra por sí misma que el modelo haya separado clases. No reproduce el algoritmo GPU CUBu del paper.</p>
      <p><b>Calidad:</b> NH₆ mide la fracción de vecinos de igual clase en 2D. Trust₁₀ mide preservación de vecindarios respecto de activaciones originales. La selección de vecinos del inspector se calcula en las activaciones originales.</p>
      <table><tr><td>Exactitud final · base · prueba completa</td><td>${percent(base.test_accuracy)}</td></tr><tr><td>Exactitud final · dilatación · prueba completa</td><td>${percent(ref.test_accuracy)}</td></tr><tr><td>Observaciones visualizadas</td><td>1 000 / 10 000</td></tr></table>
      <p><b>Límites:</b> la alineación regulariza el movimiento y puede atenuarlo. Distancias, áreas y curvas no son explicaciones causales. Las transiciones animadas interpolan posiciones: sus puntos intermedios no son estados del entrenamiento medidos. El refinamiento es un ensayo, no una mejora garantizada.</p>`;
  }

  boot();
})();
