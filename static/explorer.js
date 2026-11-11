/* Original implementation. Design precedents and limitations: docs/design.md. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const EPOCHS = [0, 1, 2, 5, 10, 15, 20];
  const T1_EPOCHS = EPOCHS.filter(epoch => epoch !== 2);
  const PLAYBACK_INTERVAL = 1100;
  const epochLabel = epoch => epoch === 0 ? 'Inicialización' : `Época ${epoch}`;
  const COLORS = d3.schemeTableau10;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const percent = v => `${(100 * v).toFixed(1)}%`;
  const formatAccuracyChange = new Intl.NumberFormat('es-ES', {
    signDisplay: 'exceptZero', minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const state = {
    task: 't1', experiment: 'base', layer: 3, epochs: {t1: 0, t2: 6},
    classes: new Set(), errors: false, hideInitial: false,
    strength: VLMTrails.DEFAULT_STRENGTH, opacity: .24, mode: 'pan', pinned: null, hover: null, hoverLayer: 3,
    detailLayer: 3, selected: new Set(), galleryPage: 0, confusion: null,
    transform: d3.zoomIdentity, playing: false, reveal: 3, selectionOpacity: .85,
    compare: false, reference: 5, outcome: null, origin: null, regions: true, neighborLinks: false, compareOpacity: .6,
    layerView: 'explore', activeLayer: 3, referenceLayer: 0
  };
  let DATA, initialDraw, atlas, geometry, svg, ctx, zoom, brush;
  let timer = null, animation = null, animatePositions = null, brushBusy = false;
  let matrixPreview = null;
  let pendingEpochReference = null;
  let showAccuracyChanges = false;
  let hoveredEdge = null;
  const mapEdges = {trails: [], comparisons: [], neighbors: []};
  const edgeHitContext = document.createElement('canvas').getContext('2d');
  edgeHitContext.lineCap = 'round';
  let renderQueued = false, lastInspectorKey = '', lastMatrixKey = '', miniatureKey = '';
  const contourCache=new Map();
  const comparing=()=>state.task==='t1'&&state.compare;
  const exploringLayers=()=>state.task==='t2'&&state.layerView==='explore';
  const trailOpacity=()=>comparing()?state.compareOpacity:exploringLayers()?state.selectionOpacity:state.opacity;
  const outcomeOf=i=>VLMAnalysis.transition(label(i),record().predictions[state.reference][i],prediction(i));
  const record = () => DATA.experiments[state.experiment];
  const epochIndex = () => state.epochs[state.task];
  const epoch = () => EPOCHS[epochIndex()];
  const firstTrailStage = () => state.task === 't1' && state.hideInitial ? 1 : 0;
  const originReference = () => {
    if (state.task !== 't1') return null;
    if (comparing()) return state.reference !== epochIndex() ? state.reference : null;
    return epochIndex() > 1 ? 1 : null;
  };
  const seq = () => record().sequences[state.task === 't1' ? `t1-l${state.layer}` : `t2-e${epoch()}`];
  const layerComparing = () => state.task==='t2' && state.layerView==='compare';
  const panelFrame = p => geometry.temporal ? epochIndex() : p.frameIndex;
  const focused = () => {
    if(state.pinned!==null && included(state.pinned))return state.pinned;
    return null;
  };
  const label = i => DATA.samples.labels[i];
  const prediction = i => record().predictions[epochIndex()][i];
  const usesInitialDraw = () => epochIndex() === 0;
  const displayedDigits = () => usesInitialDraw() ? initialDraw : record().predictions[epochIndex()];
  const displayedDigit = i => displayedDigits()[i];
  const isDisplayedError = i => displayedDigit(i) !== label(i);
  const matchesConfusion = (i, real, pred) => label(i) === real && displayedDigit(i) === pred;
  const mapIncluded = i => matrixPreview ? matchesConfusion(i, matrixPreview.real, matrixPreview.pred) : included(i);

  function passesBaseFilters(i) {
    if (state.classes.size && !state.classes.has(label(i))) return false;
    if (comparing() && state.outcome && outcomeOf(i)!==state.outcome) return false;
    if (state.errors && !isDisplayedError(i)) return false;
    if (state.confusion && !matchesConfusion(i, ...state.confusion)) return false;
    return true;
  }

  function matchesOrigin(i) {
    if (state.origin === null) return true;
    const reference = originReference();
    return reference === null || record().predictions[reference][i] === state.origin;
  }

  function included(i) {
    return passesBaseFilters(i) && matchesOrigin(i);
  }

  function emphasized(i) {
    const f = focused();
    if (f !== null) return i === f;
    return state.selected.size ? state.selected.has(i) : false;
  }

  function pointOpacity(i) {
    if (matrixPreview) return mapIncluded(i) ? .95 : .07;
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
      const random = d3.randomLcg(DATA.meta.seed);
      initialDraw = DATA.samples.ids.map(() => Math.floor(random() * 10));
      atlas = new Image();
      atlas.src = window.VLM_ATLAS || '/static/data/digits.png';
      await atlas.decode();
      svg = d3.select('#plot');
      ctx = $('trails-canvas').getContext('2d');
      buildControls();
      setupInteractions();
      $('loading').hidden = true;
      makeMethod();
      window.addEventListener('hashchange', showPage);
      showPage();
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

  function showPage() {
    const page = location.hash.slice(1);
    const isDocumentation = page === 'guia' || page === 'metodo';
    $('guia').hidden = page !== 'guia';
    $('metodo').hidden = page !== 'metodo';
    $('documentation').hidden = !isDocumentation;
    const wasHidden = $('workspace').hidden;
    if (isDocumentation && !wasHidden) stop();
    $('workspace').hidden = isDocumentation;
    if (isDocumentation) {
      $('documentation').scrollTop = 0;
    } else if (wasHidden) {
      renderAll();
      $('chart-section').focus({preventScroll:true});
    }
  }

  function buildControls() {
    d3.select('#reference-epoch').selectAll('option').data(EPOCHS).join('option').attr('value',(_,i)=>i).text(epochLabel);
    $('reference-epoch').onchange=e=>{const reference=+e.target.value;stop();pendingEpochReference=null;state.reference=reference;state.origin=null;state.selected.clear();state.hover=null;renderAll();};
    $('compare-on').onchange=e=>{const checked=e.target.checked;stop();pendingEpochReference=null;state.compare=checked;state.origin=null;state.outcome=null;state.selected.clear();state.hover=null;renderAll();};
    $('regions-on').onchange=e=>{state.regions=e.target.checked;renderPlot();};
    $('explore-learning').onclick=()=>{stop();pendingEpochReference=null;if(state.task==='t2'){state.layerView='compare';state.referenceLayer=0;state.activeLayer=3;state.detailLayer=3;renderAll(true);return;}state.task='t1';state.layer=3;state.reference=5;state.compare=true;state.origin=null;state.outcome=null;state.classes.clear();state.errors=false;state.confusion=null;state.pinned=null;state.hover=null;state.selected.clear();state.epochs.t1=6;miniatureKey='';renderAll(true);};
    $('neighbor-links').onclick=()=>{state.neighborLinks=!state.neighborLinks;updateInspector();renderPlot();};
    document.querySelectorAll('[data-layer-view]').forEach(b=>b.onclick=()=>{
      stop();state.layerView=b.dataset.layerView;state.detailLayer=state.activeLayer;state.hover=null;miniatureKey='';renderAll(true);
    });
    $('reference-layer').onchange=e=>{const layer=+e.target.value,old=state.referenceLayer;stop();state.referenceLayer=layer;state.detailLayer=state.detailLayer===old?layer:state.activeLayer;state.hover=null;lastInspectorKey='';renderAll();};
    $('save-evidence').onclick=saveEvidence;
    $('toggle-accuracy-changes').onclick = () => {
      showAccuracyChanges = !showAccuracyChanges;
      renderEvolution();
    };
    const explorer = $('explorer-layout');
    const jumpTo = target => {
      explorer.scrollTop += target.getBoundingClientRect().top - explorer.getBoundingClientRect().top;
      target.focus({preventScroll:true});
    };
    document.querySelectorAll('a.narrow-link').forEach(link => {
      link.onclick = event => {
        event.preventDefault();
        jumpTo($(link.hash.slice(1)));
      };
    });
    d3.select('#epoch-select').selectAll('option').data(EPOCHS).join('option').attr('value',e=>e).text(epochLabel);
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
    for (const [id, prop] of [['hide-initial','hideInitial'], ['errors-only','errors']]) {
      $(id).addEventListener('change', e => {state[prop] = e.target.checked; renderAll();});
    }
    $('strength').addEventListener('input', e => {
      state.strength = +e.target.value / 100;
      updateControls(); drawTrails(); drawHoverRoute();
    });
    $('opacity').addEventListener('input', e => {if(comparing())state.compareOpacity=+e.target.value/100;else if(exploringLayers())state.selectionOpacity=+e.target.value/100;else state.opacity = +e.target.value / 100; updateControls(); drawTrails();drawComparison();drawLayerWaypoints();drawHoverRoute();});
    $('layer').addEventListener('change', e => {const layer = +e.target.value; stop(); state.layer = layer; state.detailLayer = state.layer; miniatureKey = ''; renderAll(true);});
    $('play').onclick = () => state.playing ? stop() : play();
    $('mode-pan').onclick = () => setMode('pan');
    $('mode-brush').onclick = () => {stop(); setMode('brush');};
    $('clear-filters').onclick = () => {
      if (state.confusion) state.selected.clear();
      state.classes.clear(); state.errors = false; state.confusion = null; state.outcome = null; state.origin = null;
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
    document.querySelectorAll('[data-task]').forEach(b => b.onclick = () => {
      setTask(b.dataset.task);
      $('explorer-layout').scrollTop = 0;
    });
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
    svg.append('g').attr('class','layer-waypoints').attr('pointer-events','none');
    svg.append('g').attr('class','neighbor-marks').attr('pointer-events','none');
    svg.append('g').attr('class','edge-hover-marks').attr('pointer-events','none');
    svg.append('g').attr('class','points');
    svg.append('g').attr('class','point-hover-marks').attr('pointer-events','none');
    svg.append('g').attr('class','class-references').attr('pointer-events','none');
    svg.append('g').attr('class','brush');
    svg.append('g').attr('class','plot-labels').attr('pointer-events','none');
    svg.on('pointermove.hover', event => {
      if (state.mode === 'brush' || event.buttons) {setMapHover(null);return;}
      const point = event.target.closest('.point');
      if (point) {
        const {i, layer} = point.__data__;
        setMapHover(i, layer);
        return;
      }
      const edge = nearestEdge(d3.pointer(event, svg.node()));
      setMapHover(edge?.i ?? null, edge?.layer, edge);
    }).on('mouseleave.hover', () => setMapHover(null))
      .on('click.select-edge', event => {
        if (state.mode === 'brush' || event.defaultPrevented) return;
        const edge = nearestEdge(d3.pointer(event, svg.node()));
        if (edge) toggleMapPin(edge.i, edge.layer);
      });
  }

  function setTask(task) {
    if (!['t1','t2'].includes(task)) return;
    stop(); pendingEpochReference = null; state.task = task; state.hover = null; state.reveal = 3;
    state.detailLayer = task === 't1' ? state.layer : state.activeLayer;
    state.confusion = null; state.outcome = null; state.origin = null;
    miniatureKey = '';
    renderAll(true);
  }

  function setEpoch(index, animate=true) {
    pendingEpochReference = null;
    index = Math.max(0, Math.min(EPOCHS.length - 1, index));
    const from = epochIndex();
    state.epochs[state.task] = index;
    if (originReference() === null) state.origin = null;
    if (state.confusion) {
      if ((from === 0) !== usesInitialDraw()) {
        state.confusion = null;
        state.galleryPage = 0;
      }
      state.selected = new Set(state.confusion ? d3.range(DATA.samples.ids.length)
        .filter(i => matchesConfusion(i, ...state.confusion)) : []);
    }
    state.hover = null;
    state.reveal = 3;
    renderTransition(from, index, animate && state.task === 't1' && !comparing(), state.task === 't2');
  }

  function setLayer(layer, animate=true) {
    const from = state.activeLayer;
    state.activeLayer=layer;state.detailLayer=layer;state.hover=null;state.reveal=layer;
    renderTransition(from, layer, animate && !layerComparing());
  }

  function renderTransition(from, to, animate, reset=false) {
    if (animation) animation.stop();
    animation = null;
    const steps = Math.abs(to - from);
    const shouldAnimate = animate && geometry && !reducedMotion && steps > 0;
    animatePositions = shouldAnimate ? seq().frames[from] : null;
    renderAll(reset);
    if (!shouldAnimate) return;

    const direction = Math.sign(to - from);
    const duration = 700;
    animation = d3.timer(elapsed => {
      if (elapsed >= duration) {
        animation.stop();
        animation = null;
        animatePositions = null;
        renderPlot();
        return;
      }
      const progress = d3.easeCubicInOut(elapsed / duration) * steps;
      const step = Math.min(steps - 1, Math.floor(progress));
      const frame = from + direction * step;
      const stage = Math.min(frame, frame + direction);
      const t = direction > 0 ? progress - step : 1 - (progress - step);
      const start = geometry.frames[stage], end = geometry.frames[stage + 1];
      const focus = focused();
      const bend = state.strength > 0 && trailOpacity() > 0;
      animatePositions = start.map((p, i) => {
        const q = end[i];
        const hasTrail = mapIncluded(i) && (!exploringLayers() || (!matrixPreview && (focus === null ? state.selected.has(i) : i === focus)));
        return bend && hasTrail
          ? VLMTrails.pointAt(p, q, trailControls(stage, i), t)
          : [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      });
      drawPoints();
      drawClassReferences();
    });
  }

  function play() {
    if (state.playing) return;
    if (pendingEpochReference !== null) {
      pendingEpochReference = null;
      renderMiniatures();
    }
    if (state.task === 't1' && epoch() === T1_EPOCHS.at(-1)) setEpoch(0, false);
    if (state.task === 't2') {
      if(layerComparing()){state.layerView='explore';state.detailLayer=state.activeLayer;renderAll(true);}
      if(state.activeLayer>=3)setLayer(0,false);
    }
    state.playing = true;
    updateControls();
    const advance = () => {
      if (!state.playing) return;
      if (state.task === 't1') {
        const nextEpoch = T1_EPOCHS.find(value => value > epoch());
        if (nextEpoch === undefined) {stop(); return;}
        setEpoch(EPOCHS.indexOf(nextEpoch));
      } else {
        setLayer(state.activeLayer+1);
        if (state.activeLayer >= 3) {state.playing=false;updateControls();return;}
      }
      timer = setTimeout(advance, PLAYBACK_INTERVAL);
    };
    timer = setTimeout(advance, PLAYBACK_INTERVAL);
  }

  function stop() {
    state.playing = false;
    clearTimeout(timer); timer = null;
    if (animation) {animation.stop(); animation = null; animatePositions = null; renderPlot();}
    if (DATA) updateControls();
  }

  function setMode(mode) {
    state.mode = mode;
    setMapHover(null);
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
    $('layer-view-bar').hidden=temporal;
    $('layer-strip').hidden=temporal;
    $('reference-layer-control').hidden=!layerComparing();
    $('reference-layer').value=state.referenceLayer;
    document.querySelectorAll('[data-layer-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layerView===state.layerView)));
    $('layer-view-hint').textContent=layerComparing()?'A: referencia · B: capa elegida abajo. La selección se comparte.':state.layerView==='flow'?'Las curvas reúnen el recorrido 1 → capa activa en un mismo mapa.':'Elige una capa abajo. Pasa sobre un punto para ver su recorrido.';
    $('explore-learning').textContent=temporal?'Investigar 15 → 20':'Comparar capas 1 y 4';
    $('explore-learning').title=temporal?'Ver qué imágenes mejoran o empiezan a fallar entre las épocas 15 y 20.':'Comparar las representaciones de la primera y la última capa.';
    $('play').disabled=comparing();
    $('play').textContent = comparing()?'Comparación A → B':state.playing ? 'Ⅱ Pausar' : temporal ? '▶ Reproducir' : '▶ Recorrer capas';
    for (const [id, prop] of [['hide-initial','hideInitial'],['errors-only','errors']]) $(id).checked = state[prop];
    const noLayerTrails=layerComparing();
    $('strength').closest('label').hidden=comparing()||noLayerTrails;
    $('trails-heading').closest('section').hidden=noLayerTrails;
    $('trails-heading').textContent=comparing()?'Conexiones A → B':!temporal&&state.layerView==='explore'?'Recorrido entre capas':'Trayectorias';
    $('hide-initial-control').hidden = !temporal||comparing();
    $('hide-initial').disabled = !trailOpacity()||comparing();
    $('strength-value').value = state.strength===0?'0% · Rectas':`${Math.round(state.strength*100)}%`;
    const shownOpacity=trailOpacity();
    $('opacity-value').value = shownOpacity===0?'0% · Ocultas':`${Math.round(shownOpacity*100)}%`;
    $('opacity').value=Math.round(shownOpacity*100);
    $('strength').disabled = !shownOpacity||comparing();
    const firstStage = firstTrailStage();
    $('time-legend').hidden = !shownOpacity || comparing() || (temporal?epochIndex()<=firstStage:layerComparing()||state.activeLayer===0);
    $('time-legend').firstElementChild.textContent=temporal?epochLabel(EPOCHS[firstStage]):'Capa 1';
    $('time-legend-end').textContent = temporal?epoch():state.activeLayer+1;
    const finalColor = d3.hsl(COLORS[0]);
    const rampStart = finalColor.copy({l:Math.max(.18,finalColor.l*.42)}).formatRgb();
    const rampEnd = finalColor.copy({l:Math.min(.67,finalColor.l)}).formatRgb();
    const ramp = d3.interpolateHsl(rampStart,rampEnd);
    const shownStart = ramp(temporal?firstStage/(EPOCHS.length-1):0);
    const shownEnd = ramp(temporal?epochIndex()/(EPOCHS.length-1):state.activeLayer/3);
    $('time-ramp').style.background = `linear-gradient(90deg,${shownStart},${shownEnd})`;
    $('epoch-strip').hidden = !temporal;
    d3.select('#class-legend').selectAll('button').attr('aria-pressed', c => state.classes.has(c))
      .classed('is-muted', c => state.classes.size && !state.classes.has(c));
    document.querySelectorAll('[data-task]').forEach(b => b.setAttribute('aria-selected', b.dataset.task === state.task));
    $('chart-section').setAttribute('aria-labelledby', `tab-${state.task}`);
    const layerLabel = layerComparing()
      ? `Capas ${state.referenceLayer+1} y ${state.activeLayer+1}`
      : `Capa ${(temporal ? state.layer : state.activeLayer)+1}`;
    $('chart-title').textContent = `${layerLabel} · ${epochLabel(epoch())}`;
    const n = d3.range(1000).filter(included).length;
    $('inspector-empty').querySelector('p').textContent=n===0?'Ninguna imagen cumple esta combinación. Limpia los filtros o elige otro tipo de cambio.':'Pasa sobre un punto para ver su recorrido. Haz clic en el punto o su arista para fijar la imagen o soltarla.';
    const suffix = state.confusion ? ` · ${usesInitialDraw() ? 'sorteo ' : ''}${state.confusion.join(' → ')}` : '';
    $('visible-count').textContent = `${n.toLocaleString('es-PE')} / 1 000 imágenes${suffix}`;
    $('symbol-source').hidden = !usesInitialDraw();
    const showOriginMarkers = state.origin !== null && !comparing() && trailOpacity();
    $('origin-marker-key').hidden = !showOriginMarkers;
    if (showOriginMarkers) $('origin-marker-key').textContent = ` · ○ Origen en época ${EPOCHS[originReference()]}`;
    const q = seq().quality[temporal ? epochIndex() : state.detailLayer];
    $('quality-label').textContent = `${temporal?'':`Capa ${state.detailLayer+1} · `}NH₆ ${percent(q.neighborhood_hit)} · Trust₁₀ ${percent(q.trustworthiness)}`;
    $('quality-label').title = 'NH: vecinos de la misma clase en 2D. Trustworthiness: preservación de vecinos originales. Se evalúa la muestra completa, sin filtros.';
    renderComparisonControls(); renderOrigins(); renderEvolution();
    updateActionVisibility();
    $('chart-footnote').textContent = pendingEpochReference !== null
      ? `A · ${epochLabel(EPOCHS[pendingEpochReference])}. Haz ⌘ + clic en otra miniatura para elegir B.`
      : comparing()?`A · ${epochLabel(EPOCHS[state.reference])} ○ → B · ${epochLabel(epoch())} ●. Selecciona un cambio o fija una imagen.`:temporal
      ? epochIndex() === 0
        ? 'Red antes de entrenar. Elige una miniatura para avanzar.'
        : epochIndex() === firstStage
          ? 'Primer tramo oculto. Elige una época posterior para ver trayectorias.'
          : `Recorrido desde la ${epochLabel(EPOCHS[firstStage]).toLowerCase()} hasta la época ${epoch()}. Cada curva sigue la misma imagen.`
      : layerComparing()?'Mismas imágenes y escala en ambos mapas · Fija una imagen o selecciona una región para compararlas.':state.layerView==='flow'?`Recorrido 1 → ${state.activeLayer+1} · Las curvas siguen imágenes, no conexiones entre neuronas. El brillo indica profundidad.`:'Cada punto es una imagen · Pasa sobre un punto para seguirlo entre capas. La forma indica la predicción final del modelo.';
  }

  function updateActionVisibility() {
    $('clear-filters').disabled = !(state.classes.size || state.errors || state.confusion || state.outcome || state.origin !== null);
    $('clear-selection').hidden = state.selected.size === 0 && state.pinned===null;
    $('reset-view').hidden = state.transform.k === 1 && state.transform.x === 0 && state.transform.y === 0;
    $('fit-focus').hidden=false;
    $('fit-focus').textContent=focused()!==null?'Encuadrar imagen':state.classes.size||state.errors||state.confusion||state.selected.size||state.outcome||state.origin!==null?'Encuadrar filtro':'Encuadrar estado';
    $('fit-focus').title='Amplía y centra los casos mostrados.';
  }

  function fitFocus() {
    const points=[];
    const entries=state.task==='t1'?(comparing()?[state.reference,epochIndex()]:trailOpacity()?d3.range(Math.min(firstTrailStage(),epochIndex()),epochIndex()+1):[epochIndex()]).map(l=>({frame:geometry.frames[l],panel:geometry.panels[0]})):layerComparing()?geometry.panels.map(p=>({frame:geometry.frames[p.frameIndex],panel:p})):d3.range(state.activeLayer+1).filter(l=>trailOpacity()&&(focused()!==null||state.selected.size||state.layerView==='flow')||l===state.activeLayer).map(l=>({frame:geometry.frames[l],panel:geometry.panels[0]}));
    entries.forEach(({frame,panel})=>frame.forEach((p,i)=>{
      if(!included(i)||(state.selected.size&&!state.selected.has(i)))return;
      if(focused()!==null&&i!==focused())return;
      points.push([panel.xScale(p[0]),panel.yScale(p[1])]);
    }));
    // Keep the selected image's true and displayed class anchors in view as spatial context.
    const focus=focused();
    if(focus!==null)entries.forEach(({frame,panel})=>{
      for(const c of new Set([label(focus),displayedDigit(focus)])){
        const cohort=frame.filter((_,i)=>label(i)===c);
        points.push([panel.xScale(d3.median(cohort,p=>p[0])),panel.yScale(d3.median(cohort,p=>p[1]))]);
      }
    });
    if(!points.length)return;
    const p=geometry.panels[0],xs=d3.extent(points,a=>a[0]),ys=d3.extent(points,a=>a[1]);
    const k=Math.min(12,(focus!==null?.8:.9)*Math.min(p.width/Math.max(12,xs[1]-xs[0]),p.height/Math.max(12,ys[1]-ys[0])));
    const transform=d3.zoomIdentity.translate(p.width/2,p.height/2).scale(Math.max(.7,k)).translate(-(xs[0]+xs[1])/2,-(ys[0]+ys[1])/2);
    svg.call(zoom.transform,transform);
  }

  function makeGeometry() {
    const temporal = state.task === 't1';
    $('plot-wrap').parentElement.classList.toggle('is-layers', !temporal);
    const width = $('plot-wrap').clientWidth, height = $('plot-wrap').clientHeight;
    const legend = $('map-class-key');
    const right = width - legend.offsetLeft + 15;
    const margin = temporal ? {l:25,r:right,t:18,b:26} : {l:20,r:right,t:layerComparing()?35:20,b:26};
    const gap = 24;
    const count=layerComparing()?2:1;
    const rows=layerComparing()&&width<650?2:1,columns=count/rows;
    const panelWidth = (width-margin.l-margin.r-gap*(columns-1))/columns;
    const panelHeight = (height-margin.t-margin.b-gap*(rows-1))/rows;
    // Fit the complete sequence once: preserve isotropic distance and a stable frame across epochs.
    const frames=seq().frames,all=frames.flat(),extentX=d3.extent(all,p=>p[0]),extentY=d3.extent(all,p=>p[1]);
    const pad=Math.max(extentX[1]-extentX[0],extentY[1]-extentY[0])*.04;
    const domainX=[extentX[0]-pad,extentX[1]+pad],domainY=[extentY[0]-pad,extentY[1]+pad];
    const unit=Math.min(panelWidth/(domainX[1]-domainX[0]),panelHeight/(domainY[1]-domainY[0]));
    const centerX=(domainX[0]+domainX[1])/2,centerY=(domainY[0]+domainY[1])/2;
    const panels = d3.range(count).map(i => {
      const row=rows===2?i:0,column=rows===2?0:i;
      const x = margin.l + column*(panelWidth+gap), y = margin.t+row*(panelHeight+gap);
      const xScale = d3.scaleLinear().domain(domainX).range(domainX.map(v=>panelWidth/2+(v-centerX)*unit));
      const yScale = d3.scaleLinear().domain(domainY).range(domainY.map(v=>panelHeight/2-(v-centerY)*unit));
      return {x,y,width:panelWidth,height:panelHeight,xScale,yScale,unit,frameIndex:temporal?epochIndex():layerComparing()?(i===0?state.referenceLayer:state.activeLayer):state.activeLayer};
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
      geometry.panels.forEach((panel,j) => {
        const frame=!layerComparing()&&animatePositions?animatePositions:geometry.frames[panel.frameIndex];
        frame.forEach((p,i) => {const [x,y] = screen(p,j); points.push({i,x,y,panel:j,layer:panel.frameIndex});});
      });
    }
    return points;
  }

  function renderAll(reset=false) {
    if (!DATA || !svg || $('workspace').hidden) return;
    if (reset) {state.transform = d3.zoomIdentity; svg.property('__zoom',d3.zoomIdentity);}
    updateControls(); updateInspector(); makeGeometry(); renderMatrix();
    renderPlot(); renderMiniatures(); renderGallery();
  }

  function requestPlot() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {renderQueued = false; renderPlot();});
  }

  function renderPlot() {
    if (!geometry) return;
    drawStructure(); drawTrails(); drawRegions(); drawComparison(); drawLayerWaypoints();
    drawNeighborLinks(); drawHoverRoute(); drawPoints(); drawClassReferences();
  }

  function drawClassReferences() {
    if(animatePositions)svg.select('.class-regions').attr('visibility','hidden');
    const groups=svg.select('.class-references').selectAll('g.reference-panel').data(geometry.panels).join('g')
      .attr('class','reference-panel').attr('clip-path',(_,l)=>`url(#panel-clip-${l})`);
    groups.each(function(panel,l){
      const frame=(geometry.temporal||!layerComparing())&&animatePositions?animatePositions:geometry.frames[panelFrame(panel)];
      const q=seq().quality[panelFrame(panel)].neighborhood_hit;
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
      }).attr('aria-label',n=>`Referencia de la clase ${n.c}, mediana de sus 100 imágenes`)
        .attr('opacity',n=>matrixPreview&&n.c!==matrixPreview.real?.4:null);
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
      .attr('fill',layerComparing()?'#f9f9f4':'none').attr('rx',3);
    const axes = svg.select('.axes'); axes.selectAll('*').remove();
    if (!layerComparing()) {
      const p = panels[0], x = state.transform.rescaleX(p.xScale), y = state.transform.rescaleY(p.yScale);
      axes.append('g').attr('class','axis').attr('transform',`translate(${p.x},${p.y+p.height})`)
        .call(d3.axisBottom(x).ticks(4).tickSize(-p.height).tickFormat(()=>''));
      axes.append('g').attr('class','axis').attr('transform',`translate(${p.x},${p.y})`)
        .call(d3.axisLeft(y).ticks(4).tickSize(-p.width).tickFormat(()=>''));
    }
    const labels = svg.select('.plot-labels'); labels.selectAll('*').remove();
    if (layerComparing()) {
      panels.forEach((p,i) => {
        const quality=seq().quality[p.frameIndex];
        labels.append('text').attr('class','layer-label').attr('x',p.x+5).attr('y',p.y-12).text(`${i===0?'A':'B'} · CAPA ${p.frameIndex+1}`);
        labels.append('text').attr('class','projection-label').attr('x',p.x+p.width-5).attr('y',p.y-12).attr('text-anchor','end').text(`NH ${percent(quality.neighborhood_hit)}`);
      });
    } else {
      labels.append('text').attr('class','projection-label').attr('x',panels[0].x+panels[0].width).attr('y',geometry.height-7).attr('text-anchor','end').text('Dimensión 1 · AlignedUMAP');
      labels.append('text').attr('class','projection-label').attr('transform',`translate(${panels[0].x-8},${geometry.height/2}) rotate(-90)`).attr('text-anchor','middle').text('Dimensión 2');
    }
  }

  function trailControls(stage, i) {
    const {frames,centroids} = geometry;
    const c = label(i);
    return VLMTrails.controls(frames[stage][i], frames[stage+1][i], centroids[stage][c], centroids[stage+1][c], state.strength);
  }

  function traceEdge(path, points) {
    path.moveTo(...points[0]);
    if (points.length === 2) {
      path.lineTo(...points[1]);
    } else {
      for (let i = 1; i < points.length; i += 3) {
        path.bezierCurveTo(...points[i], ...points[i+1], ...points[i+2]);
      }
    }
    return path;
  }

  function registerEdge(group, i, layer, panel, points, color = COLORS[label(i)]) {
    const path = traceEdge(new Path2D(), points);
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const [x, y] of points) {
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    mapEdges[group].push({i, layer, panel, points, path, color, left, right, top, bottom});
    return path;
  }

  function nearestEdge([x, y]) {
    if (!geometry || matrixPreview) return null;
    const panel = geometry.panels.findIndex((_, index) => inPanel({x, y, panel:index}));
    if (panel === -1) return null;

    let closest = null;
    let radius = 4;
    // Test the drawn curve inside its control-point bounds and favor the closest visible edge.
    for (const edges of [mapEdges.neighbors, mapEdges.comparisons, mapEdges.trails]) {
      for (let i = edges.length - 1; i >= 0; i--) {
        const edge = edges[i];
        if (edge.panel !== panel || x < edge.left-radius || x > edge.right+radius ||
            y < edge.top-radius || y > edge.bottom+radius) continue;
        edgeHitContext.lineWidth = radius * 2;
        if (!edgeHitContext.isPointInStroke(edge.path, x, y)) continue;

        closest = edge;
        let lower = 0;
        while (radius - lower > .5) {
          const middle = (lower + radius) / 2;
          edgeHitContext.lineWidth = middle * 2;
          if (edgeHitContext.isPointInStroke(edge.path, x, y)) radius = middle;
          else lower = middle;
        }
        if (radius <= .5) return closest;
      }
    }
    return closest;
  }

  function setMapHover(i, layer, edge = null) {
    if (i === state.hover && (i === null || layer === state.hoverLayer) && edge === hoveredEdge) return;
    state.hover = i;
    if (i !== null) state.hoverLayer = layer;
    hoveredEdge = edge;
    drawHoverRoute();
    markHover();
    updateInspector();
  }

  function drawHoverRoute() {
    const i = state.hover;
    const segments = [];
    let reference = null;
    if (hoveredEdge) {
      segments.push(hoveredEdge.points);
    } else if (geometry && i !== null && !matrixPreview && !animatePositions &&
               included(i) && trailOpacity() && !layerComparing()) {
      if (comparing()) {
        reference = screen(geometry.frames[state.reference][i], 0);
        segments.push([reference, screen(geometry.frames[epochIndex()][i], 0)]);
      } else {
        const end = geometry.temporal ? epochIndex() : state.activeLayer;
        for (let stage = firstTrailStage(); stage < end; stage++) {
          const points = trailPoints(i, stage);
          if (points) segments.push(points);
        }
      }
    }

    const outline = d3.path();
    for (const points of segments) traceEdge(outline, points);
    const color = i === null ? null : d3.color(hoveredEdge?.color ?? COLORS[label(i)]).darker(.65);
    const panel = hoveredEdge?.panel ?? 0;
    const group = svg.select('.edge-hover-marks').attr('clip-path', `url(#panel-clip-${panel})`);
    group.selectAll('path').data(segments.length ? ['halo','line'] : []).join('path')
      .attr('class', type => `edge-hover-${type}`)
      .attr('d', outline.toString()).attr('stroke', type => type === 'halo' ? 'var(--surface)' : color);
    group.selectAll('circle').data(reference ? [reference] : []).join('circle')
      .attr('class', 'edge-hover-reference').attr('cx', p => p[0]).attr('cy', p => p[1]).attr('r', 4.5)
      .attr('stroke', color);
  }

  function trailPoints(i, stage) {
    const {frames} = geometry;
    const p0 = screen(frames[stage][i], 0);
    const p1 = screen(frames[stage+1][i], 0);
    if (p0[0] === p1[0] && p0[1] === p1[1]) return null;
    if (state.strength === 0) return [p0, p1];

    const curve = trailControls(stage, i);
    const [a,b] = curve.firstHalf.map(p => screen(p, 0));
    const [c,d] = curve.secondHalf.map(p => screen(p, 0));
    return [p0, a, b, screen(curve.middle, 0), c, d, p1];
  }

  function trailHalves(points) {
    if (points.length > 2) return [points.slice(0, 4), points.slice(3)];
    const [a, b] = points;
    const middle = a.map((value, axis) => (value + b[axis]) / 2);
    return [[a, middle], [middle, b]];
  }

  function halfCenter(points) {
    const start = points[0], end = points.at(-1);
    if (points.length === 2) return start.map((value, axis) => (value + end[axis]) / 2);
    return start.map((value, axis) => (value + 3*points[1][axis] + 3*points[2][axis] + end[axis]) / 8);
  }

  function countNearbyTrails(trails) {
    const radiusSquared = 12 ** 2;
    for (const group of d3.group(trails, trail => label(trail.i)).values()) {
      for (let i = 0; i < group.length; i++) {
        const a = group[i];
        for (let j = 0; j < i; j++) {
          const b = group[j];
          for (let half = 0; half < 2; half++) {
            const dx = a.centers[half][0] - b.centers[half][0];
            const dy = a.centers[half][1] - b.centers[half][1];
            if (dx*dx + dy*dy > radiusSquared) continue;
            a.counts[half]++;
            b.counts[half]++;
          }
        }
      }
    }
  }

  function drawTrails() {
    if (!geometry) return;
    if (hoveredEdge) setMapHover(null);
    mapEdges.trails = [];
    const {width,height,frames,temporal,panels} = geometry;
    ctx.clearRect(0,0,width,height);
    const baseOpacity = trailOpacity();
    if (!baseOpacity || comparing() || layerComparing()) return;

    const focus = focused(), selected = state.selected;
    const layer = temporal ? state.layer : state.activeLayer;
    const stages = frames.length - 1;
    const end = temporal ? epochIndex() : state.activeLayer;
    const first = firstTrailStage();
    const contextOpacity = baseOpacity * (focus !== null || selected.size ? .18 : 1);
    const selectedOpacity = exploringLayers() ? baseOpacity : Math.min(1, baseOpacity * (focus !== null ? 8 : 5.7));

    const draw = ({i, points, halves, counts}, stage, opacity) => {
      const p0 = points[0], p1 = points.at(-1);
      const path = registerEdge('trails', i, layer, 0, points);
      const color = d3.hsl(COLORS[label(i)]);
      const dark = color.copy({l:Math.max(.18,color.l*.42)}).formatRgb();
      const light = color.copy({l:Math.min(.67,color.l)}).formatRgb();
      const ramp = d3.interpolateHsl(dark,light);
      const gradient = ctx.createLinearGradient(p0[0],p0[1],p1[0]+.001,p1[1]+.001);
      gradient.addColorStop(0,ramp(stage/stages));
      gradient.addColorStop(1,ramp((stage+1)/stages));
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = gradient;

      const widths = counts?.map(count => 2.1 + .7 * Math.min(4, Math.floor(Math.log2(count))));
      if (!widths || widths[0] === widths[1]) {
        ctx.lineWidth = widths?.[0] ?? 3.6;
        ctx.stroke(path);
        return;
      }
      halves.forEach((half, index) => {
        ctx.lineWidth = widths[index];
        ctx.stroke(traceEdge(new Path2D(), half));
      });
    };

    const panel = panels[0];
    ctx.save();
    ctx.beginPath();
    ctx.rect(panel.x, panel.y, panel.width, panel.height);
    ctx.clip();
    ctx.lineCap = 'round';
    if (temporal || state.layerView === 'flow') {
      for (let stage = first; stage < end; stage++) {
        const trails = [];
        for (let i = 0; i < DATA.samples.ids.length; i++) {
          if (!mapIncluded(i) || (!matrixPreview && emphasized(i))) continue;
          const points = trailPoints(i, stage);
          if (!points) continue;
          const halves = trailHalves(points);
          trails.push({i, points, halves, centers: halves.map(halfCenter), counts: [1, 1]});
        }
        countNearbyTrails(trails);
        for (const trail of trails) draw(trail, stage, contextOpacity);
      }
    }
    if (!matrixPreview) {
      const ids = focus === null ? [...selected].filter(included) : [focus];
      for (let stage = first; stage < end; stage++) {
        for (const i of ids) {
          const points = trailPoints(i, stage);
          if (points) draw({i, points}, stage, selectedOpacity);
        }
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawPoints() {
    if (!geometry) return;
    const points = pointData();
    const showFocus = i => !matrixPreview && emphasized(i);
    const groups = svg.select('.points').selectAll('g.panel-points').data(geometry.panels).join('g')
      .attr('class','panel-points').attr('clip-path',(_,i)=>`url(#panel-clip-${i})`);
    groups.each(function(_, panelIndex) {
      const local = points.filter(p=>p.panel===panelIndex);
      d3.select(this).selectAll('path.point').data(local,p=>p.i).join('path')
        .attr('class',p=>`point${showFocus(p.i)?' is-focus':''}${state.hover===p.i?' is-hover':''}`)
        .attr('data-sample',p=>p.i).attr('data-id',p=>DATA.samples.ids[p.i]).attr('data-layer',p=>p.layer)
        .attr('transform',p=>`translate(${p.x},${p.y})`)
        .attr('d', p => {
          const error = isDisplayedError(p.i);
          const size = showFocus(p.i) ? 90 : !mapIncluded(p.i) ? 12 : error ? 38 : geometry.temporal ? 22 : geometry.panels.length === 1 ? 26 : 22;
          return d3.symbol().type(error ? d3.symbolTriangle : d3.symbolCircle).size(size)();
        })
        .attr('fill',p=>mapIncluded(p.i)?COLORS[label(p.i)]:'#aab5b0').attr('opacity',p=>pointOpacity(p.i))
        .attr('pointer-events',p=>included(p.i)?'auto':'none')
        .on('mouseenter',function(e,p) {
          if (state.mode==='brush') return;
          setMapHover(p.i, p.layer);
        })
        .on('mouseleave', () => setMapHover(null))
        .on('click', (event, p) => {
          event.stopPropagation();
          toggleMapPin(p.i, p.layer);
        });
      d3.select(this).selectAll('path.is-focus').raise();
    });
    drawPointHover(points.filter(p => p.i === state.hover));
  }

  function markHover() {
    const points = svg.select('.points').selectAll('.point').classed('is-hover', p => p.i === state.hover);
    drawPointHover(points.filter(p => p.i === state.hover).data());
  }

  function drawPointHover(points) {
    const rings = svg.select('.point-hover-marks').selectAll('g').data(points, p => p.panel).join(enter => {
      const group = enter.append('g');
      group.append('circle').attr('class','point-hover-halo');
      group.append('circle').attr('class','point-hover-ring');
      return group;
    }).attr('clip-path', p => `url(#panel-clip-${p.panel})`);
    for (const name of ['point-hover-halo','point-hover-ring']) {
      rings.select(`.${name}`).attr('cx', p => p.x).attr('cy', p => p.y).attr('r', 6.5);
    }
  }

  function drawLayerWaypoints(){
    const i=focused(),marks=[];
    if(!matrixPreview&&state.task==='t2'&&!layerComparing()&&i!==null&&trailOpacity()){
      for(let l=0;l<state.activeLayer;l++)marks.push({l,p:screen(geometry.frames[l][i],0)});
    }
    const group=svg.select('.layer-waypoints').attr('clip-path','url(#panel-clip-0)');
    const nodes=group.selectAll('g.layer-waypoint').data(marks,d=>d.l).join(enter=>{const g=enter.append('g').attr('class','layer-waypoint');g.append('circle');g.append('text');return g;})
      .attr('transform',d=>`translate(${d.p})`).attr('data-layer',d=>d.l).attr('data-sample',i);
    nodes.select('circle').attr('r',7).attr('fill','#fffefa').attr('stroke',i===null?'none':COLORS[label(i)]).attr('stroke-width',1.8);
    nodes.select('text').attr('text-anchor','middle').attr('dy','.35em').text(d=>d.l+1);
  }

  function toggleMapPin(i, layer) {
    if (state.pinned !== i || state.detailLayer !== layer) {
      pin(i, layer);
      return;
    }
    state.pinned = null;
    state.hover = null;
    renderAll();
  }

  function pin(i,layer=state.detailLayer) {
    if (!Number.isInteger(i) || i<0 || i>=1000) return;
    stop(); state.pinned=i; state.hover=null; state.detailLayer=layer;
    renderAll();
  }

  function drawDigit(canvas,i) {
    const size=28, cols=40, c=canvas.getContext('2d');
    c.clearRect(0,0,canvas.width,canvas.height);
    c.imageSmoothingEnabled=false;
    c.drawImage(atlas,(i%cols)*size,Math.floor(i/cols)*size,size,size,0,0,canvas.width,canvas.height);
  }

  function makeTiles(container,indices) {
    const assignment = usesInitialDraw() ? 'sorteo' : 'predicción';
    const tiles=d3.select(container).selectAll('button').data(indices,i=>i).join(enter=> {
      const b=enter.append('button').attr('type','button').attr('class','digit-tile');
      b.append('canvas').attr('width',28).attr('height',28).attr('aria-hidden','true');
      b.append('span');
      return b;
    });
    tiles.classed('selected',i=>i===state.pinned)
      .attr('aria-label',i=>`Inspeccionar imagen ${DATA.samples.ids[i]}, clase ${label(i)}, ${assignment} ${displayedDigit(i)}`)
      .attr('title',i=>`#${DATA.samples.ids[i]} · real ${label(i)} → ${assignment} ${displayedDigit(i)}`)
      .on('click',(_,i)=>pin(i));
    tiles.select('span').text(i=>`${label(i)} → ${displayedDigit(i)}`);
    tiles.select('canvas').each(function(i){drawDigit(this,i);});
  }

  function updateInspector() {
    const i=state.hover??state.pinned;
    $('inspector-empty').hidden=i!==null;
    $('inspector-detail').hidden=i===null;
    if (i===null) {lastInspectorKey='';$('preview-status').textContent='Vista previa';$('unpin').hidden=true;$('neighbor-links').disabled=true;return;}
    const l=state.task==='t1'?state.layer:state.hover!==null?state.hoverLayer:state.detailLayer;
    const preview=state.hover!==null&&state.hover!==state.pinned;
    const key=`${state.experiment}:${i}:${epoch()}:${l}:${included(i)}:${preview}:${state.pinned}:${comparing()}:${state.reference}:${state.neighborLinks}:${state.layerView}:${state.referenceLayer}`;
    if (key===lastInspectorKey) return;
    lastInspectorKey=key;
    $('sample-id').textContent=`MNIST #${DATA.samples.ids[i]}${included(i)?'':' · fuera del filtro'}`;
    $('preview-status').textContent=preview||state.pinned===null?'Vista previa':'Fijada';
    $('unpin').hidden=state.pinned===null;
    drawDigit($('digit-image'),i);
    $('digit-image').setAttribute('aria-label',`Imagen MNIST ${DATA.samples.ids[i]}, dígito verdadero ${label(i)}`);
    $('true-label').textContent=label(i); $('pred-label').textContent=displayedDigit(i);
    $('displayed-digit-label').textContent = usesInitialDraw() ? 'Sorteado' : 'Predicción';
    $('prediction-status').textContent=isDisplayedError(i)?'△ error':'○ acierto';
    $('detail-epoch').textContent=`· ${epochLabel(epoch())}`;
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
    const predictionsByEpoch = record().predictions;
    const trainedPredictions = T1_EPOCHS.slice(1)
      .map(epoch => ({epoch, digit: predictionsByEpoch[EPOCHS.indexOf(epoch)][i]}));
    const history=d3.select('#prediction-history').selectAll('.prediction-cell').data(trainedPredictions).join(enter=> {
      const b=enter.append('span').attr('class','prediction-cell');b.append('small');b.append('span');return b;
    }).classed('is-active', d => d.epoch === epoch()).classed('is-error', d => d.digit !== label(i))
      .attr('aria-label', d => `${epochLabel(d.epoch)}, predicción ${d.digit}`);
    history.select('small').text(d => `E${d.epoch}`);
    history.select('span').text(d => d.digit);
    $('neighbor-layer').textContent=`· capa ${l+1}`;
    const now=record().neighbors[`${epoch()}_${l}`][i];
    makeTiles($('neighbors'),now);
    const baseLayer=layerComparing()?(l===state.referenceLayer?state.activeLayer:state.referenceLayer):0;
    const baseline=comparing()?record().neighbors[`${EPOCHS[state.reference]}_${l}`][i]:state.task==='t2'?record().neighbors[`${epoch()}_${baseLayer}`][i]:null;
    renderNeighborComparison(baseline,now,l,baseLayer);
    $('sample-comparison').hidden=!comparing();
    $('sample-comparison').textContent=comparing()?`Predicción del modelo: ${record().predictions[state.reference][i]} → ${prediction(i)} · real ${label(i)}`:'';
    if(baseline){
      const changed=VLMAnalysis.neighbors(baseline,now),baseName=comparing()?epochLabel(EPOCHS[state.reference]).toLowerCase():`capa ${baseLayer+1}`;
      $('neighbor-change').textContent=`Conserva ${changed.retained.length}/6 vecinos respecto a ${baseName}. ${changed.arrived.length} nuevos.`;
      d3.select('#neighbors').selectAll('button').classed('neighbor-arrived',j=>changed.arrived.includes(j)).attr('title',j=>`#${DATA.samples.ids[j]} · ${changed.arrived.includes(j)?'nuevo vecino':'vecino conservado'} · clase ${label(j)}`);
    }else{$('neighbor-change').textContent='Seis vecinos en las activaciones originales.';d3.select('#neighbors').selectAll('button').classed('neighbor-arrived',false);}
    $('neighbor-links').disabled=state.pinned===null;
    $('neighbor-links').setAttribute('aria-pressed',String(state.neighborLinks));
    $('neighbor-links').textContent=state.neighborLinks?'Ocultar vínculos de vecinos':'Conectar vecinos en el mapa';
  }

  function renderNeighborComparison(before,now,layer,baseLayer){
    const active=before!==null&&(comparing()?state.reference!==epochIndex():layer!==baseLayer);
    $('neighbor-comparison').hidden=!active;if(!active)return;
    $('neighbor-comparison-title').textContent=comparing()?'Vecinos por época':'Vecinos por capa';
    const shortEpoch = value => value === 0 ? 'Ini.' : `Ép. ${value}`;
    const rows=[{name:comparing()?shortEpoch(EPOCHS[state.reference]):`Capa ${baseLayer+1}`,ids:before},{name:comparing()?shortEpoch(epoch()):`Capa ${layer+1}`,ids:now}];
    const width=$('neighbor-comparison-chart').clientWidth||300,left=62,step=(width-left)/6;
    const chart=d3.select('#neighbor-comparison-chart').attr('viewBox',`0 0 ${width} 72`).attr('aria-label',rows.map(r=>`${r.name}: vecinos de clases ${r.ids.map(label).join(', ')}`).join('. '));
    const groups=chart.selectAll('g').data(rows).join('g').attr('transform',(_,j)=>`translate(0,${j*35})`);
    groups.selectAll('text.row-name').data(r=>[r]).join('text').attr('class','row-name').attr('x',0).attr('y',20).text(r=>r.name);
    groups.each(function(row){
      const g=d3.select(this),cells=row.ids.map((i,k)=>({i,k}));
      g.selectAll('rect').data(cells).join('rect').attr('x',d=>left+d.k*step).attr('y',3).attr('width',step-3).attr('height',26).attr('rx',2).attr('fill',d=>COLORS[label(d.i)]).attr('fill-opacity',.22);
      g.selectAll('text.neighbor-class').data(cells).join('text').attr('class','neighbor-class').attr('x',d=>left+(d.k+.5)*step-1.5).attr('y',21).attr('text-anchor','middle').text(d=>label(d.i));
    });
  }

  function renderGallery() {
    const ids = state.selected.size ? [...state.selected].filter(included)
      : (comparing() && state.outcome) || state.origin !== null ? d3.range(DATA.samples.ids.length).filter(included) : [];
    $('gallery-section').hidden=ids.length===0;
    if (!ids.length) return;
    const pages=Math.ceil(ids.length/30);
    state.galleryPage=Math.max(0,Math.min(state.galleryPage,pages-1));
    const useDraw = usesInitialDraw() && Boolean(state.confusion);
    const galleryLabel = useDraw ? 'imágenes del sorteo' : state.origin !== null ? 'imágenes de este origen'
      : state.selected.size ? 'imágenes seleccionadas' : 'casos de este cambio';
    $('gallery-title').textContent = `${ids.length} ${galleryLabel}`;
    $('gallery-page').textContent=`${state.galleryPage+1} / ${pages}`;
    $('gallery-prev').disabled=state.galleryPage===0;
    $('gallery-next').disabled=state.galleryPage===pages-1;
    makeTiles($('gallery'),ids.slice(state.galleryPage*30,(state.galleryPage+1)*30));
  }

  function selectEpochMiniature(event, value) {
    const index = EPOCHS.indexOf(value);
    if (!event.metaKey) {
      stop();
      setEpoch(index);
      return;
    }
    if (pendingEpochReference === null || pendingEpochReference === index) {
      pendingEpochReference = index;
      stop();
      renderMiniatures();
      return;
    }

    stop();
    state.reference = pendingEpochReference;
    state.origin = null;
    state.compare = true;
    state.outcome = null;
    state.selected.clear();
    setEpoch(index, false);
  }

  function renderMiniatures() {
    if (state.task!=='t1') {renderLayerMiniatures();return;}
    const key=`${state.experiment}:${state.layer}:${$('epoch-strip').clientWidth}`;
    const reference = EPOCHS[pendingEpochReference ?? (comparing() ? state.reference : -1)];
    const comparisonTarget = comparing() && pendingEpochReference === null ? epoch() : null;
    const buttons=d3.select('#epoch-strip').selectAll('button').data(T1_EPOCHS).join(enter=> {
      const b=enter.append('button').attr('class','miniature').attr('type','button');
      b.append('span').attr('class','epoch-role').attr('aria-hidden','true');
      b.append('canvas').attr('aria-hidden','true');
      const label = b.append('span').attr('class','mini-label');
      const initial = label.filter(e=>e===0);
      initial.append('span').attr('class','initial-label').text(epochLabel(0));
      initial.append('span').attr('class','initial-label-short').text('Inicio');
      const trained = label.filter(e=>e!==0);
      trained.append('span').attr('class','epoch-word').text('ÉPOCA');
      trained.append('span').text(e=>e);
      return b;
    }).attr('aria-pressed',e=>e===epoch()).attr('aria-label',e=>e===0?'Ver inicialización':`Ver época ${e}`)
      .classed('is-reference', e => e === reference)
      .on('click', selectEpochMiniature);
    buttons.select('.epoch-role').text(e => e === reference ? (e === comparisonTarget ? 'A/B' : 'A') : e === comparisonTarget ? 'B' : '');
    if (key===miniatureKey) return;
    miniatureKey=key;
    const frames=seq().frames;
    buttons.select('canvas').each(function(e) {
      const width=Math.max(34,this.clientWidth),height=this.clientHeight,dpr=window.devicePixelRatio||1;
      this.width=width*dpr;this.height=height*dpr;
      const c=this.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,width,height);
      const side=Math.min(width-4,height-4),x=d3.scaleLinear().domain([-1.08,1.08]).range([(width-side)/2,(width+side)/2]);
      const y=d3.scaleLinear().domain([-1.08,1.08]).range([(height+side)/2,(height-side)/2]);
      c.globalAlpha=.72;
      frames[EPOCHS.indexOf(e)].forEach((p,i)=>{c.fillStyle=COLORS[label(i)];c.beginPath();c.arc(x(p[0]),y(p[1]),.8,0,Math.PI*2);c.fill();});
    });
  }

  function renderLayerMiniatures(){
    const frames=seq().frames,quality=seq().quality;
    const buttons=d3.select('#layer-strip').selectAll('button').data(d3.range(4)).join(enter=>{
      const b=enter.append('button').attr('type','button').attr('class','layer-miniature');
      b.append('canvas').attr('aria-hidden','true');const t=b.append('span');t.append('strong');t.append('small');return b;
    }).attr('aria-label',l=>`Ver capa ${l+1}`).attr('aria-pressed',l=>l===state.activeLayer)
      .classed('is-reference',l=>layerComparing()&&l===state.referenceLayer)
      .on('click',(_,l)=>{stop();setLayer(l);});
    buttons.select('strong').text(l=>`Capa ${l+1}`);buttons.select('small').text(l=>`NH ${percent(quality[l].neighborhood_hit)}`);
    const key=`layers:${epoch()}:${$('layer-strip').clientWidth}`;if(key===miniatureKey)return;miniatureKey=key;
    const all=frames.flat(),xs=d3.extent(all,p=>p[0]),ys=d3.extent(all,p=>p[1]);
    buttons.select('canvas').each(function(l){
      const width=this.clientWidth,height=this.clientHeight,dpr=window.devicePixelRatio||1;this.width=width*dpr;this.height=height*dpr;
      const c=this.getContext('2d');c.scale(dpr,dpr);
      const unit=.88*Math.min(width/(xs[1]-xs[0]),height/(ys[1]-ys[0]));
      c.globalAlpha=.65;frames[l].forEach((p,i)=>{c.fillStyle=COLORS[label(i)];c.beginPath();c.arc(width/2+(p[0]-(xs[0]+xs[1])/2)*unit,height/2-(p[1]-(ys[0]+ys[1])/2)*unit,.8,0,Math.PI*2);c.fill();});
    });
  }

  function renderMatrix() {
    const key = `${state.task}:${epoch()}:${state.experiment}:${state.confusion?.join('-')}`;
    if (key === lastMatrixKey) return;
    lastMatrixKey = key;
    matrixPreview = null;

    const digits = d3.range(10);
    const counts = digits.map(() => digits.map(() => 0));
    const predictions = displayedDigits();
    predictions.forEach((pred, i) => counts[label(i)][pred]++);
    const cells = counts.flatMap((row, real) => {
      const total = d3.sum(row);
      return row.map((count, pred) => ({real, pred, count, fraction: total ? count / total : 0}));
    });
    const active = d => state.confusion?.[0] === d.real && state.confusion?.[1] === d.pred;
    const describe = d => `${d.real} → ${d.pred} · ${d.count} ${d.count === 1 ? 'imagen' : 'imágenes'}`;
    const useDraw = usesInitialDraw();
    const sampleSize = d3.format(',d')(predictions.length).replaceAll(',', ' ');
    const hint = useDraw ? 'Cada imagen recibe un dígito al azar del 0 al 9.' : 'Pasa sobre una celda para previsualizar. Haz clic para filtrar.';
    const selected = cells.find(active);
    const status = selected ? describe(selected) : hint;
    const showStatus = value => { $('matrix-status').textContent = value; };
    const previewCell = d => {
      matrixPreview = d?.count ? d : null;
      showStatus(d ? describe(d) : status);
      requestPlot();
    };
    $('matrix-epoch').textContent = useDraw ? 'Inicialización · sorteo' : `${epochLabel(epoch())} · ${sampleSize} imágenes`;
    const metrics = DATA.meta.experiments[state.experiment].history[epochIndex()];
    const drawAccuracy = d3.sum(digits, digit => counts[digit][digit]) / predictions.length;
    $('matrix-accuracy').textContent = useDraw ? `Acierto por azar · ${percent(drawAccuracy)} de ${sampleSize} imágenes`
      : `Exactitud · muestra ${percent(metrics.sample_accuracy)} · prueba ${percent(metrics.test_accuracy)} (10 000)`;
    showStatus(status);

    const selectCell = d => {
      if (!d.count && !active(d)) return;
      stop();
      state.confusion = active(d) ? null : [d.real, d.pred];
      state.classes.clear();
      state.errors = false;
      state.outcome = null;
      state.origin = null;
      state.hover = null;
      state.pinned = null;
      state.galleryPage = 0;
      state.selected = new Set(d3.range(predictions.length).filter(i => state.confusion && included(i)));
      renderAll();
      $('inspector-scroll').scrollTop = 0;
    };

    const s = d3.select('#matrix-grid').attr('viewBox', '0 0 252 242')
      .attr('aria-label', useDraw ? 'Filas de clase real y columnas de dígito sorteado' : 'Filas de clase real y columnas de clase predicha');
    const color = d3.scaleSequential(d3.interpolatePurples).domain([0, 1]);
    const x = col => 30 + col * 21;
    const y = row => 2 + row * 21;

    s.selectAll('rect.matrix-cell').data(cells).join('rect').attr('class', 'matrix-cell')
      .classed('active', active)
      .attr('x', d => x(d.pred)).attr('y', d => y(d.real)).attr('width', 20).attr('height', 20)
      .attr('fill', d => color(d.fraction)).attr('role', 'button')
      .attr('aria-label', d => `Clase real ${d.real}, ${useDraw ? 'sorteado' : 'predicha'} ${d.pred}, ${d.count} imágenes`)
      .attr('aria-pressed', active).attr('aria-disabled', d => !d.count && !active(d))
      .attr('tabindex', d => d.count || active(d) ? 0 : null)
      .on('pointerenter', (event, d) => {if (event.pointerType !== 'touch') previewCell(d);})
      .on('focus', (event, d) => {if (event.currentTarget.matches(':focus-visible')) previewCell(d);})
      .on('pointerleave blur', () => previewCell(null))
      .on('click', (_, d) => selectCell(d))
      .on('keydown', (event, d) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectCell(d);
      });

    s.selectAll('text.cell-value').data(cells.filter(d => d.count > 0)).join('text')
      .attr('class', 'cell-value').attr('x', d => x(d.pred) + 10).attr('y', d => y(d.real) + 10)
      .attr('fill', d => d.fraction > .5 ? '#fff' : '#4d425a').text(d => d.count);
    s.selectAll('text.row-label').data(digits).join('text').attr('class', 'row-label')
      .attr('x', 20).attr('y', d => y(d) + 10).text(d => d);
    s.selectAll('text.col-label').data(digits).join('text').attr('class', 'col-label')
      .attr('x', d => x(d) + 10).attr('y', 221).text(d => d);
    s.selectAll('text.axis-label').data([
      {x: 7, y: 106, transform: 'rotate(-90 7 106)', label: 'Clase real'},
      {x: 134, y: 235, transform: null, label: useDraw ? 'Dígito sorteado' : 'Clase predicha'}
    ]).join('text').attr('class', 'axis-label').attr('x', d => d.x).attr('y', d => d.y)
      .attr('transform', d => d.transform).text(d => d.label);
  }

  function comparisonStats(){
    const ids=d3.range(DATA.samples.ids.length).filter(i=>(!state.classes.size||state.classes.has(label(i)))&&matchesOrigin(i));
    return VLMAnalysis.summarize(DATA.samples.labels,record().predictions[state.reference],record().predictions[epochIndex()],ids);
  }

  function renderComparisonControls(){
    const active=comparing();
    $('comparison-controls').hidden=state.task!=='t1';
    $('compare-on').checked=state.compare;
    $('reference-epoch-control').hidden=!active;
    $('reference-epoch').value=state.reference;$('reference-epoch').disabled=!active;
    $('regions-on').checked=state.regions;
    $('comparison-direction').textContent = pendingEpochReference !== null
      ? `A · ${epochLabel(EPOCHS[pendingEpochReference])}. Elige B con ⌘ + clic.`
      : active ? `A · ${epochLabel(EPOCHS[state.reference])} → B · ${epochLabel(epoch())}.`
        : 'Usa ⌘ + clic en dos miniaturas para comparar.';
    $('transition-filters').hidden=!active;
    const stats=comparisonStats();
    const names={fixed:'Pasan a acierto',new:'Empiezan a fallar',persistent:'Siguen fallando',steady:'Siguen acertando'};
    const buttons=d3.select('#transition-filters').selectAll('button').data(['fixed','new','persistent','steady']).join(enter=>{
      const b=enter.append('button').attr('type','button');b.append('strong');b.append('span');return b;
    }).attr('data-outcome',d=>d).attr('aria-pressed',d=>d===state.outcome).attr('aria-label',d=>`${names[d]}: ${stats[d]} imágenes`)
      .on('click',(_,d)=>{$('app').classList.remove('detail-dismissed');stop();state.outcome=state.outcome===d?null:d;state.errors=false;state.confusion=null;state.selected.clear();state.pinned=null;state.hover=null;renderAll();});
    buttons.select('strong').text(d=>stats[d]);buttons.select('span').text(d=>names[d]);
    const subset = state.origin !== null ? ` con origen ${state.origin}` : state.classes.size ? ' de las clases elegidas' : '';
    $('comparison-summary').textContent=active?`${stats.beforeErrors} → ${stats.afterErrors} errores · ${stats.n} imágenes${subset}.`:'';
  }

  function renderOrigins() {
    const reference = originReference();
    const hasSubset = state.classes.size || state.errors || state.confusion || state.outcome ||
      state.selected.size || state.origin !== null;
    $('trajectory-origins').hidden = reference === null || !hasSubset;
    if ($('trajectory-origins').hidden) return;

    const predictions = record().predictions[reference];
    const cohort = state.selected.size ? [...state.selected] : d3.range(predictions.length);
    const ids = cohort.filter(passesBaseFilters);
    const counts = d3.rollup(ids, group => group.length, i => predictions[i]);
    const rows = d3.range(10).map(digit => ({digit, count: counts.get(digit) ?? 0}))
      .filter(row => row.count || row.digit === state.origin)
      .sort((a, b) => b.count - a.count || a.digit - b.digit);

    $('origin-reference').textContent = `Predicción del modelo · ${epochLabel(EPOCHS[reference])} · ${ids.length} imágenes`;
    const buttons = d3.select('#origin-groups').selectAll('button').data(rows, row => row.digit).join(enter => {
      const button = enter.append('button').attr('type','button');
      button.append('span').attr('class','origin-digit');
      button.append('span').attr('class','origin-count');
      return button;
    }).order().attr('aria-pressed', row => row.digit === state.origin)
      .attr('aria-label', ({digit, count}) => `Origen ${digit}, ${count} ${count === 1 ? 'imagen' : 'imágenes'}`)
      .style('--origin-share', row => percent(ids.length ? row.count / ids.length : 0))
      .on('click', (_, row) => {
        stop();
        state.origin = state.origin === row.digit ? null : row.digit;
        state.hover = null;
        state.pinned = null;
        state.galleryPage = 0;
        renderAll();
      });
    buttons.select('.origin-digit').text(row => row.digit);
    buttons.select('.origin-count').text(row => row.count);
  }

  function drawRegions(){
    svg.select('.class-regions').attr('visibility',animatePositions?'hidden':null);
    const groups=svg.select('.class-regions').selectAll('g.region-panel').data(geometry.panels).join('g')
      .attr('class','region-panel').attr('clip-path',(_,l)=>`url(#panel-clip-${l})`)
      .attr('display',()=>!state.regions?'none':null);
    groups.each(function(panel,l){
      const fi=panelFrame(panel),frame=geometry.frames[fi];
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
        .attr('opacity',d=>matrixPreview&&d.c!==matrixPreview.real?.4:null)
        .attr('stroke',d=>COLORS[d.c]).attr('stroke-width',d=>state.classes.has(d.c)?1.3:.8)
        .attr('stroke-opacity',d=>state.classes.size&&!state.classes.has(d.c)?.15:.4);
    });
  }

  function drawComparison(){
    mapEdges.comparisons = [];
    const group=svg.select('.comparison-marks').attr('clip-path','url(#panel-clip-0)');
    const comparison = comparing();
    const reference = comparison ? state.reference : originReference();
    const showOrigins = state.origin !== null && reference !== null && trailOpacity();
    let ids=[];
    if ((comparison || showOrigins) && !matrixPreview) {
      if (focused() !== null) ids = [focused()];
      else if (state.selected.size) ids = [...state.selected].filter(included);
      else if (showOrigins || (state.outcome && state.outcome !== 'steady')) ids = d3.range(DATA.samples.ids.length).filter(included);
    }
    const pairs=ids.map(i=>({i,a:screen(geometry.frames[reference][i],0),b:screen(geometry.frames[epochIndex()][i],0)}));
    const links = comparison ? pairs : [];
    if (state.compareOpacity) {
      for (const {i,a,b} of links) registerEdge('comparisons', i, state.layer, 0, [a,b]);
    }
    group.selectAll('line.comparison-link').data(links,d=>d.i).join('line').attr('class','comparison-link')
      .attr('x1',d=>d.a[0]).attr('y1',d=>d.a[1]).attr('x2',d=>d.b[0]).attr('y2',d=>d.b[1])
      .attr('stroke',d=>COLORS[label(d.i)]).attr('stroke-width',focused()!==null?3.6:2.3).attr('stroke-opacity',state.compareOpacity)
      .attr('stroke-dasharray','3 3');
    group.selectAll('circle.reference-point').data(pairs,d=>d.i).join('circle').attr('class','reference-point')
      .attr('data-sample',d=>d.i).attr('cx',d=>d.a[0]).attr('cy',d=>d.a[1]).attr('r',comparison ? 4.5 : 3)
      .attr('fill','#fffefa').attr('stroke',d=>COLORS[label(d.i)]).attr('stroke-width',1.6);
  }

  function drawNeighborLinks(){
    mapEdges.neighbors = [];
    const pinned=focused(),links=[];
    if(!matrixPreview&&state.neighborLinks&&pinned!==null){
      geometry.panels.forEach((panel,l)=>{
        const layer=geometry.temporal?state.layer:panel.frameIndex,frame=geometry.frames[panelFrame(panel)];
        const a=screen(frame[pinned],l);
        for(const i of record().neighbors[`${epoch()}_${layer}`][pinned]) {
          const b = screen(frame[i],l);
          links.push({i,l,a,b});
          registerEdge('neighbors', i, layer, l, [a,b], '#435d67');
        }
      });
    }
    const groups=svg.select('.neighbor-marks').selectAll('g').data(geometry.panels).join('g').attr('clip-path',(_,l)=>`url(#panel-clip-${l})`);
    groups.each(function(_,l){
      const local=links.filter(d=>d.l===l),g=d3.select(this);
      g.selectAll('line').data(local,d=>d.i).join('line').attr('x1',d=>d.a[0]).attr('y1',d=>d.a[1]).attr('x2',d=>d.b[0]).attr('y2',d=>d.b[1]).attr('stroke','#435d67').attr('stroke-width',1.1).attr('stroke-opacity',.7);
      g.selectAll('circle.neighbor-ring').data(local,d=>d.i).join('circle').attr('class','neighbor-ring').attr('cx',d=>d.b[0]).attr('cy',d=>d.b[1]).attr('r',5).attr('fill','none').attr('stroke',d=>COLORS[label(d.i)]).attr('stroke-width',1.6);
    });
  }

  function renderAccuracyChanges(history) {
    const changes = d3.pairs(history.slice(-4)).map(([before, after]) => ({
      interval: `${before.epoch} → ${after.epoch}`,
      sample: Math.round((after.sample_accuracy - before.sample_accuracy) * 10000) / 100,
      test: Math.round((after.test_accuracy - before.test_accuracy) * 10000) / 100
    }));
    const format = value => `${formatAccuracyChange.format(value)} pp`;
    const latest = changes.at(-1);
    $('latest-accuracy-change').textContent = `${latest.interval} · Muestra ${format(latest.sample)} · Prueba ${format(latest.test)}`;

    const rows = d3.select('#accuracy-change-rows').selectAll('tr').data(changes, change => change.interval)
      .join(enter => {
        const row = enter.append('tr');
        row.append('th').attr('scope', 'row');
        row.append('td').attr('class', 'accuracy-sample');
        row.append('td').attr('class', 'accuracy-test');
        return row;
      });
    rows.select('th').text(change => change.interval);
    for (const metric of ['sample', 'test']) {
      rows.select(`.accuracy-${metric}`)
        .classed('accuracy-gain', change => change[metric] > 0)
        .classed('accuracy-loss', change => change[metric] < 0)
        .text(change => format(change[metric]));
    }
  }

  function renderEvolution(){
    const temporal = state.task === 't1';
    const changesVisible = temporal && showAccuracyChanges;
    const history = DATA.meta.experiments[state.experiment].history;
    $('evolution-chart').toggleAttribute('hidden', changesVisible);
    $('accuracy-changes').hidden = !changesVisible;
    $('evolution-scale').hidden = temporal;
    $('latest-accuracy-change').hidden = !temporal || changesVisible;
    const toggle = $('toggle-accuracy-changes');
    toggle.hidden = !temporal;
    toggle.textContent = changesVisible ? 'Ver curva' : 'Ver cambios';
    toggle.setAttribute('aria-expanded', String(changesVisible));
    $('evolution-title').textContent = changesVisible ? 'Cambios de exactitud'
      : temporal ? 'Separación y aciertos' : 'Representación por capa';
    if (temporal) renderAccuracyChanges(history);
    if (changesVisible) {
      $('evolution-current').textContent = 'Cambio entre épocas medidas, en puntos porcentuales.';
      $('evolution-note').textContent = 'Muestra fija de 1 000 imágenes. Prueba completa de 10 000.';
      return;
    }

    const width=$('evolution-chart').clientWidth||300;
    const height=$('evolution-chart').clientHeight||174,bottom=height-31;
    const indices=d3.range(temporal?EPOCHS.length:4);
    const x=d3.scalePoint().domain(indices).range([38,width-13]),y=d3.scaleLinear().domain([0,1]).range([bottom,30]);
    const values=temporal?[
      {name:'Exactitud',color:'#202d32',v:history.map(h=>h.sample_accuracy)},
      {name:'NH',color:'#287f8e',v:seq().quality.map(q=>q.neighborhood_hit)}
    ]:[{name:'NH',color:'#287f8e',v:seq().quality.map(q=>q.neighborhood_hit)},
       {name:'Fidelidad',color:'#202d32',v:seq().quality.map(q=>q.trustworthiness)}];
    const chart=d3.select('#evolution-chart').attr('viewBox',`0 0 ${width} ${height}`);chart.selectAll('*').remove();
    values.forEach((d,j)=>{const left=38+j*(width-38)/2;chart.append('line').attr('x1',left).attr('x2',left+14).attr('y1',10).attr('y2',10).attr('stroke',d.color).attr('stroke-width',2.3);chart.append('text').attr('x',left+20).attr('y',14).text(d.name);});
    chart.append('g').attr('class','evolution-axis').attr('transform','translate(38,0)').call(d3.axisLeft(y).tickValues([0,.5,1]).tickFormat(d3.format('.0%')).tickSize(-(width-51))).call(g=>g.select('.domain').remove());
    chart.append('g').attr('class','evolution-axis').attr('transform',`translate(0,${bottom})`).call(d3.axisBottom(x).tickFormat(i=>temporal?(i===0?'Ini.':EPOCHS[i]):`C${i+1}`).tickSize(0)).call(g=>g.select('.domain').remove());
    if(comparing())chart.append('line').attr('class','reference-cursor').attr('x1',x(state.reference)).attr('x2',x(state.reference)).attr('y1',29).attr('y2',bottom).attr('stroke','#8a9891').attr('stroke-dasharray','3 3');
    if(temporal)chart.append('line').attr('x1',x(epochIndex())).attr('x2',x(epochIndex())).attr('y1',29).attr('y2',bottom).attr('stroke','#aab5b0');
    values.forEach(d=>{
      chart.append('path').attr('d',d3.line().x((_,i)=>x(i)).y(y)(d.v)).attr('fill','none').attr('stroke',d.color).attr('stroke-width',2);
      chart.append('g').selectAll('circle').data(d.v).join('circle').attr('cx',(_,i)=>x(i)).attr('cy',y).attr('r',(_,i)=>temporal&&i===epochIndex()?3.6:2.1).attr('fill',d.color).append('title').text((v,i)=>`${temporal?epochLabel(EPOCHS[i]):'Capa '+(i+1)} · ${d.name}: ${percent(v)}`);
    });
    const current=temporal?epochIndex():state.detailLayer;
    const describe=(i,preview=false)=>`${preview?'Consulta · ':''}${temporal?epochLabel(EPOCHS[i]):'Capa '+(i+1)} · ${values.map(d=>`${d.name} ${percent(d.v[i])}`).join(' · ')}`;
    $('evolution-current').textContent=describe(current);
    chart.attr('aria-label',temporal?'Evolución de exactitud y NH; pasa para consultar sin cambiar la época':'Calidad por capa; pasa para consultar sin cambiar la capa')
      .on('pointermove',event=>{
        const px=d3.pointer(event,chart.node())[0],i=d3.least(indices,(a,b)=>Math.abs(x(a)-px)-Math.abs(x(b)-px));
        $('latest-accuracy-change').hidden = true;
        $('evolution-current').textContent=describe(i,true);
        chart.selectAll('line.evolution-hover').data([i]).join('line').attr('class','evolution-hover').attr('x1',x(i)).attr('x2',x(i)).attr('y1',29).attr('y2',bottom).attr('stroke','#687573').attr('stroke-dasharray','2 3').attr('pointer-events','none');
      }).on('pointerleave',()=>{
        chart.selectAll('.evolution-hover').remove();
        $('evolution-current').textContent=describe(current);
        $('latest-accuracy-change').hidden = !temporal || showAccuracyChanges;
      });
    $('evolution-note').textContent=temporal?'1 000 imágenes · NH: vecinos de igual clase en 2D. Checkpoints con intervalos desiguales.':'NH: mezcla por clase. Fidelidad: trustworthiness de los vecinos originales. Muestra completa.';
  }

  async function saveEvidence(){
    stop();matrixPreview=null;renderPlot();
    $('save-evidence').disabled=true;$('evidence-status').textContent='Preparando evidencia…';
    try{
      // Keep the capture and the reported state together throughout asynchronous image decoding.
      const snapshot={task:state.task,layer:(state.task==='t1'?state.layer:state.activeLayer)+1,epoch:epoch(),reference:comparing()?EPOCHS[state.reference]:null,
        layerView:state.task==='t2'?state.layerView:null,comparedLayers:layerComparing()?[state.referenceLayer+1,state.activeLayer+1]:null,
        hideInitial:state.task==='t1'&&!comparing()&&state.hideInitial,
        ...(state.origin !== null ? {origin: {epoch: EPOCHS[originReference()], prediction: state.origin}} : {}),
        outcome:state.outcome,classes:[...state.classes],errorsOnly:state.errors,confusion:state.confusion,
        ...(usesInitialDraw() ? {symbolSource:'uniform_random_baseline'} : {}),
        ...(usesInitialDraw() && state.confusion ? {confusionSource:'uniform_random_baseline'} : {}),
        visible:d3.range(1000).filter(included).map(i=>DATA.samples.ids[i]),selection:[...state.selected].filter(included).map(i=>DATA.samples.ids[i]),comparison:comparing()?comparisonStats():null,
        seed:DATA.meta.seed,projection:DATA.meta.projection.name,quality:seq().quality,
        sample:state.pinned===null?null:{id:DATA.samples.ids[state.pinned],truth:label(state.pinned),prediction:prediction(state.pinned),
          referencePrediction:comparing()?record().predictions[state.reference][state.pinned]:null,
          neighbors:record().neighbors[`${epoch()}_${state.task==='t1'?state.layer:state.detailLayer}`][state.pinned].map(i=>DATA.samples.ids[i])}};
      if(snapshot.sample){
        const selected=state.pinned,layer=state.task==='t1'?state.layer:state.detailLayer;
        if (snapshot.symbolSource) snapshot.sample.drawnDigit = initialDraw[selected];
        const baseLayer=layerComparing()?(layer===state.referenceLayer?state.activeLayer:state.referenceLayer):0;
        const reference=comparing()?record().neighbors[`${EPOCHS[state.reference]}_${layer}`][selected]:state.task==='t2'?record().neighbors[`${epoch()}_${baseLayer}`][selected]:null;
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
      const stage = epochLabel(snapshot.epoch);
      const title=snapshot.task==='t2'?`${snapshot.comparedLayers?'Capas '+snapshot.comparedLayers.join(' y '):'Capa '+snapshot.layer} · ${stage}`:snapshot.reference===null?`T1 · ${stage}`:`${epochLabel(snapshot.reference)} → ${stage} · capa ${snapshot.layer}`;
      const stats=snapshot.comparison;
      const drawNote = snapshot.symbolSource ? `<p>Las formas del mapa indican si el dígito sorteado coincide con la clase real.${
        snapshot.confusionSource ? ` Filtro de la matriz · ${snapshot.confusion[0]} → ${snapshot.confusion[1]}.` : ''
      }${snapshot.sample ? ` Dígito sorteado de la imagen fijada · ${snapshot.sample.drawnDigit}.` : ''}</p>` : '';
      const content=`<!doctype html><html lang="es"><meta charset="utf-8"><title>Evidencia · ${title}</title><style>body{max-width:1100px;margin:35px auto;padding:0 24px;font:16px/1.7 system-ui;color:#202d32}h1{font:36px Georgia}img{max-width:100%;border:1px solid #ddd}small{color:#687573}pre{white-space:pre-wrap;font-size:12px;background:#f7f5f0;padding:18px}strong{color:#245d70}</style><h1>${title}</h1><p>MNIST · ${snapshot.visible.length} imágenes cumplen los filtros de una cohorte fija de 1 000. ${snapshot.selection.length} seleccionadas.</p>${drawNote}${stats?`<p><strong>${stats.fixed}</strong> pasan de error a acierto; <strong>${stats.new}</strong> de acierto a error; <strong>${stats.persistent}</strong> siguen erradas y ${stats.steady} siguen correctas. Errores: ${stats.beforeErrors} → ${stats.afterErrors}. Cálculo sobre ${stats.n} imágenes de las clases y los orígenes elegidos.</p>`:''}${snapshot.sample?`<img alt="Imagen original seleccionada" src="${snapshot.sample.image}" style="width:96px;image-rendering:pixelated"><p>Ejemplo fijado: <b>MNIST #${snapshot.sample.id}</b>, etiqueta ${snapshot.sample.truth}, predicción ${snapshot.sample.referencePrediction===null?'':snapshot.sample.referencePrediction+' → '}${snapshot.sample.prediction}. ${snapshot.sample.retainedNeighbors===null?'':`Conserva ${snapshot.sample.retainedNeighbors.length}/6 vecinos originales respecto a la referencia.`}</p>`:''}<figure><img alt="Mapa y selección capturados" src="${canvas.toDataURL('image/png')}"><figcaption>Posiciones de AlignedUMAP. El color indica clase verdadera; ○ referencia y símbolo lleno estado activo al comparar.</figcaption></figure><p>Los vecinos se calculan en activaciones originales. Los contornos muestran concentración estimada en 2D, no regiones de decisión. Distancias y trayectorias no demuestran causalmente aprendizaje; la alineación puede atenuar cambios. Las transiciones de clasificación sí se obtienen de predicciones medidas.</p><small>Visual Learning Models · evidencia exportada localmente. Semilla ${snapshot.seed}. No se modificaron ni eliminaron ejemplos difíciles.</small><details><summary>Datos para verificar y reproducir la selección</summary><pre>${JSON.stringify(snapshot,null,2)}</pre></details><script id="evidence-data" type="application/json">${JSON.stringify(snapshot)}</script></html>`;
      const blobURL=URL.createObjectURL(new Blob([content],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=blobURL;a.download=`evidencia-${snapshot.task}-${snapshot.reference===null?'':snapshot.reference+'-'}${snapshot.epoch}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(blobURL),1000);
      $('evidence-status').textContent='Evidencia guardada con mapa, selección y datos.';
    }catch(e){$('evidence-status').textContent='No se pudo exportar: '+e.message;}
    finally{$('save-evidence').disabled=false;}
  }

  function makeMethod() {
    const meta=DATA.meta,base=meta.experiments.base.history.at(-1);
    $('method-content').innerHTML=`<p><b>Modelo:</b> MLP 784 → 128 → 128 → 128 → 128 → 10, ReLU y Adam. Semilla 42. Entrenamiento continuo durante 20 épocas, con mediciones desde la inicialización.</p>
      <p><b>Datos:</b> 50 000 imágenes de entrenamiento, 10 000 de validación y 10 000 de prueba. Se visualiza una muestra fija de 1 000 imágenes de prueba, 100 por dígito.</p>
      <p><b>Proyección:</b> AlignedUMAP no supervisado, 15 vecinos, min_dist 0.1 y regularización de alineación 0.01. Las etiquetas no intervienen en la proyección. Cada secuencia tiene un sistema de coordenadas propio; no se comparan posiciones absolutas entre secuencias distintas.</p>
      <p><b>Agrupamiento:</b> curvas Bézier atraídas hacia centroides de clase, conservando las posiciones medidas. La desviación está limitada respecto de la distancia entre extremos y no retrocede a lo largo de su conexión. Así se evitan arcos grandes en imágenes casi inmóviles. El trazo se ensancha donde pasan varias curvas de la misma clase en el mismo tramo. Esta adaptación usa etiquetas verdaderas para organizar el dibujo. La existencia de haces no demuestra por sí misma que el modelo haya separado clases. No reproduce el algoritmo GPU CUBu del paper.</p>
      <p><b>Comparación:</b> A y B usan posiciones medidas de la misma secuencia. En T2, Explorar amplía una capa, Comparar enlaza selecciones entre dos mapas sin conexiones que los atraviesen y Recorrido resume capas en un espacio compartido. Las curvas se detienen en la capa activa. Los números sobre una trayectoria fijada identifican sus capas anteriores. La predicción y la forma del punto siempre corresponden a la salida final del modelo: no se han entrenado clasificadores por capa. Los grupos de cambio de T1 se calculan con predicciones y etiquetas reales, no con distancias 2D. Los contornos son densidades por clase con ancho y umbral fijos; no fronteras de decisión.</p>
      <p><b>Inicialización.</b> Las activaciones provienen de la red antes de entrenar. En esta corrida, la inicialización favorece ligeramente al 9 en la salida. El modelo elige la clase con mayor puntuación y asigna 992 de las 1 000 imágenes al 9, aunque la puntuación máxima media es de 10.6%. El primer tramo conecta la inicialización con el estado tras una época de entrenamiento. La secuencia de miniaturas salta de la época 1 a la 5. El recorrido incluye la posición medida en la época 2. Puedes ocultar el primer tramo para examinar los cambios a partir de la época 1.</p>
      <p><b>Calidad:</b> NH₆ mide la fracción de vecinos de igual clase en 2D. Trust₁₀ mide preservación de vecindarios respecto de activaciones originales. La selección de vecinos del inspector se calcula en las activaciones originales.</p>
      <table><tr><td>Exactitud final · prueba completa</td><td>${percent(base.test_accuracy)}</td></tr><tr><td>Observaciones visualizadas</td><td>1 000 / 10 000</td></tr></table>
      <p><b>Límites:</b> la alineación regulariza el movimiento y puede atenuarlo. Distancias, áreas y curvas no son explicaciones causales. Las transiciones animadas interpolan posiciones: sus puntos intermedios no son estados del entrenamiento medidos.</p>`;
  }

  boot();
})();
