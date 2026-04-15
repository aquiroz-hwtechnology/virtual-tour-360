/**
 * APP.JS — Controlador principal del Tour Virtual 360
 * =====================================================
 * Inicializa el visor panoramico usando Pannellum (open source),
 * carga la configuracion XML, gestiona el estado de la app
 * e integra todos los modulos.
 *
 * DEPENDENCIAS:
 *  - Pannellum (https://pannellum.org) — motor 360 open source
 *  - Leaflet.js — mini-mapa
 *  - router.js  — navegacion entre nodos
 *  - skin.js    — gestion de UI
 *  - gamification.js — logica del tour guiado
 */

'use strict';

// ═══════════════════════════════════════════
// ESTADO GLOBAL DE LA APLICACION
// ═══════════════════════════════════════════
const AppState = {
  currentNode: null,
  currentTime: 'morning',   // morning | afternoon | night
  tourMode:    null,         // free | guided
  tourData:    null,         // XML parseado
  viewer:      null,         // instancia Pannellum
  map:         null,         // instancia Leaflet
  mapMarker:   null,
  isLoading:   true,
  audioEnabled: true,
  nodes:       {},           // mapa id -> datos nodo
  groups:      [],
  programs:    [],
};

// ═══════════════════════════════════════════
// INICIALIZACION
// ═══════════════════════════════════════════
async function init() {
  try {
    // 1. Cargar configuracion del tour
    AppState.tourData = await loadTourConfig('config/tour.xml');
    parseTourData(AppState.tourData);

    // 2. Inicializar router (historial y navegacion por hash)
    Router.init();

    // 3. Construir menus laterales
    SkinController.buildBlocksMenu(AppState.groups, AppState.nodes);
    SkinController.buildProgramsMenu(AppState.programs, AppState.nodes);

    // 4. Vincular eventos UI
    bindUIEvents();

    // 5. Actualizar configuracion del sitio
    applyTourConfig(AppState.tourData);

    // 6. Ocultar loading y mostrar pantalla de inicio
    // (el usuario hace clic en loading screen para continuar)
    document.getElementById('loading-screen').style.opacity = '0.95';
    document.querySelector('.loading-text').textContent = 'Haz clic para empezar...';
    AppState.isLoading = false;

  } catch (err) {
    console.error('Error al inicializar el tour:', err);
    document.querySelector('.loading-text').textContent = 
      'Error al cargar el tour. Verifica tu configuracion.';
  }
}

// ═══════════════════════════════════════════
// CARGA DE CONFIGURACION XML
// ═══════════════════════════════════════════
async function loadTourConfig(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('No se pudo cargar ' + url);
  const text = await resp.text();
  const parser = new DOMParser();
  return parser.parseFromString(text, 'text/xml');
}

function parseTourData(doc) {
  const tour = doc.querySelector('tour');
  
  // Metadatos globales
  AppState.tourMeta = {
    start:       tour.getAttribute('start'),
    title:       tour.getAttribute('title'),
    institution: tour.getAttribute('institution'),
    website:     tour.getAttribute('website'),
    whatsapp:    tour.getAttribute('whatsapp'),
  };

  // Grupos (menu Bloques)
  AppState.groups = Array.from(doc.querySelectorAll('groups group')).map(g => ({
    id:    g.getAttribute('id'),
    label: g.getAttribute('label'),
    count: parseInt(g.getAttribute('count')) || 0,
  }));

  // Programas (menu Programas)
  AppState.programs = Array.from(doc.querySelectorAll('programs program')).map(p => ({
    id:    p.getAttribute('id'),
    label: p.getAttribute('label'),
    icon:  p.getAttribute('icon'),
    color: p.getAttribute('color'),
  }));

  // Nodos/Panoramas
  doc.querySelectorAll('panorama').forEach(pan => {
    const id = pan.getAttribute('id');
    AppState.nodes[id] = {
      id,
      label:       pan.getAttribute('label'),
      group:       pan.getAttribute('group'),
      program:     pan.getAttribute('program'),
      image:       pan.getAttribute('image'),
      preview:     pan.getAttribute('preview'),
      thumbnail:   pan.getAttribute('thumbnail'),
      lat:         parseFloat(pan.getAttribute('lat')) || 0,
      lng:         parseFloat(pan.getAttribute('lng')) || 0,
      description: pan.getAttribute('description'),
      audio:       pan.getAttribute('audio'),
      variants:    parseVariants(pan),
      hotspots:    parseHotspots(pan),
      neighbors:   Array.from(pan.querySelectorAll('neighbors neighbor')).map(n => n.getAttribute('id')),
    };
  });

  // Tours guiados
  AppState.guidedTours = Array.from(doc.querySelectorAll('guided_tours tour')).map(t => ({
    id:           t.getAttribute('id'),
    label:        t.getAttribute('label'),
    nodes:        t.getAttribute('nodes').split(','),
    total_clues:  parseInt(t.getAttribute('total_clues')) || 0,
  }));
}

function parseVariants(panoramaEl) {
  const variants = {};
  panoramaEl.querySelectorAll('variant').forEach(v => {
    variants[v.getAttribute('time')] = v.getAttribute('image');
  });
  return variants;
}

function parseHotspots(panoramaEl) {
  return Array.from(panoramaEl.querySelectorAll('hotspot')).map(h => ({
    type:       h.getAttribute('type'),
    target:     h.getAttribute('target'),
    label:      h.getAttribute('label'),
    yaw:        parseFloat(h.getAttribute('yaw')) || 0,
    pitch:      parseFloat(h.getAttribute('pitch')) || 0,
    icon:       h.getAttribute('icon') || 'circle',
    info_title: h.getAttribute('info_title'),
    info_text:  h.getAttribute('info_text'),
    info_image: h.getAttribute('info_image'),
    clue_id:    h.getAttribute('clue_id'),
    clue_text:  h.getAttribute('clue_text'),
  }));
}

function applyTourConfig(doc) {
  const meta = AppState.tourMeta;
  if (!meta) return;
  document.title = meta.title;
  const websiteBtn = document.getElementById('btn-website');
  if (websiteBtn && meta.website) websiteBtn.href = meta.website;
  const waBtn = document.getElementById('btn-whatsapp');
  if (waBtn && meta.whatsapp) {
    waBtn.onclick = () => window.open('https://wa.me/' + meta.whatsapp.replace(/\D/g,''));
  }
}

// ═══════════════════════════════════════════
// VISOR PANORAMICO
// (Requiere Pannellum cargado en index.html)
// Para instalarlo: npm install pannellum
// o via CDN: <script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
// ═══════════════════════════════════════════
function initViewer(nodeId) {
  const node = AppState.nodes[nodeId];
  if (!node) return;

  // Obtener imagen segun hora del dia
  const imageUrl = node.variants[AppState.currentTime] || node.image;

  // Si Pannellum esta disponible
  if (typeof pannellum !== 'undefined') {
    if (AppState.viewer) {
      AppState.viewer.destroy();
    }

    const hotspotConfig = node.hotspots
      .filter(h => h.type === 'nav' || h.type === 'info' || h.type === 'game')
      .map(h => ({
        pitch:      h.pitch,
        yaw:        h.yaw,
        type:       h.type === 'nav' ? 'scene' : 'info',
        sceneId:    h.target,
        text:       h.label,
        cssClass:   'custom-hotspot hotspot-' + h.type,
        clickHandlerFunc: (e, args) => handleHotspotClick(h),
        clickHandlerArgs: h,
      }));

    AppState.viewer = pannellum.viewer('panorama-canvas', {
      type:           'equirectangular',
      panorama:       imageUrl,
      autoLoad:       true,
      autoRotate:     -1,
      autoRotateInactivityDelay: 3000,
      compass:        false,
      showZoomCtrl:   false,
      showFullscreenCtrl: false,
      keyboardZoom:   true,
      mouseZoom:      true,
      hotSpots:       hotspotConfig,
      onLoad: () => updateMapPosition(node),
    });

  } else {
    // Fallback: mostrar imagen equirectangular directamente
    const canvas = document.getElementById('panorama-canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = imageUrl;
    console.warn('Pannellum no encontrado. Usando fallback de imagen plana.');
    console.warn('Instala Pannellum: https://pannellum.org/documentation/overview/');
  }

  // Renderizar hotspots en la capa DOM (alternativa sin Pannellum)
  renderHotspotsDOM(node);
  
  // Actualizar estado
  AppState.currentNode = nodeId;
  updateActiveMenuItem(nodeId);
  updateNavProgress();
  
  // Actualizar mapa
  if (AppState.map && node.lat && node.lng) {
    updateMapPosition(node);
  }
}

function renderHotspotsDOM(node) {
  const layer = document.getElementById('hotspots-layer');
  layer.innerHTML = '';
  // Solo renderiza si Pannellum NO esta presente (evitar duplicados)
  if (typeof pannellum !== 'undefined') return;

  node.hotspots.forEach(h => {
    // Posicion aproximada en pantalla (proyeccion simple para demo)
    const x = 50 + (h.yaw / 180) * 30;
    const y = 50 - (h.pitch / 90) * 30;

    const el = document.createElement('div');
    el.className = 'hotspot';
    el.setAttribute('data-type', h.type);
    el.style.left = x + '%';
    el.style.top  = y + '%';
    el.innerHTML = '<span class="hotspot-label">' + h.label + '</span>';
    el.addEventListener('click', () => handleHotspotClick(h));
    layer.appendChild(el);
  });
}

function handleHotspotClick(hotspot) {
  switch (hotspot.type) {
    case 'nav':
      if (hotspot.target) navigateTo(hotspot.target);
      break;
    case 'info':
      SkinController.showInfoModal(hotspot);
      break;
    case 'game':
      GameController.collectClue(hotspot.clue_id, hotspot.clue_text);
      break;
    case 'video':
      // Abrir video en modal (implementar segun necesidad)
      break;
  }
}

// ═══════════════════════════════════════════
// NAVEGACION
// ═══════════════════════════════════════════
function navigateTo(nodeId) {
  if (!AppState.nodes[nodeId]) {
    console.warn('Nodo no encontrado:', nodeId);
    return;
  }
  Router.push(nodeId);
  initViewer(nodeId);
  
  // Audio del espacio
  if (AppState.audioEnabled && AppState.nodes[nodeId].audio) {
    playSpaceAudio(AppState.nodes[nodeId].audio);
  }
}

function navigateNext() {
  const nodeIds = Object.keys(AppState.nodes);
  const idx = nodeIds.indexOf(AppState.currentNode);
  if (idx === -1 || nodeIds.length < 2) return;
  const next = nodeIds[(idx + 1) % nodeIds.length];
  navigateTo(next);
}

function navigatePrev() {
  const nodeIds = Object.keys(AppState.nodes);
  const idx = nodeIds.indexOf(AppState.currentNode);
  if (idx === -1 || nodeIds.length < 2) return;
  const prev = nodeIds[(idx - 1 + nodeIds.length) % nodeIds.length];
  navigateTo(prev);
}

function updateNavProgress() {
  const nodeIds = Object.keys(AppState.nodes);
  const idx = nodeIds.indexOf(AppState.currentNode);
  const pct = nodeIds.length > 1 ? idx / (nodeIds.length - 1) : 0;
  const dot = document.getElementById('progress-dot');
  if (dot) dot.style.left = (pct * 100) + '%';
}

// ═══════════════════════════════════════════
// MINI-MAPA (LEAFLET)
// ═══════════════════════════════════════════
function initMap(nodes) {
  const mapEl = document.getElementById('leaflet-map');
  if (!mapEl || typeof L === 'undefined') return;

  // Coordenadas del campus [lat, lng] (ajustar a tu institucion)
  const center = [6.234, -75.536];

  AppState.map = L.map('leaflet-map', {
    center: center,
    zoom: 17,
    zoomControl: true,
    attributionControl: false,
    dragging: true,
  });

  // Tiles OpenStreetMap (gratuito)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(AppState.map);

  // O usar imagen del campus como overlay:
  // const bounds = [[-75.540, 6.230], [-75.530, 6.240]];
  // L.imageOverlay('images/campus-map.png', bounds).addTo(AppState.map);

  // Marcador de posicion
  const icon = L.divIcon({
    className: 'map-position-marker',
    iconSize: [14, 14],
  });
  AppState.mapMarker = L.marker(center, { icon }).addTo(AppState.map);

  // Agregar todos los nodos como marcadores
  Object.values(nodes).forEach(node => {
    if (!node.lat || !node.lng) return;
    const marker = L.circleMarker([node.lat, node.lng], {
      radius: 5,
      fillColor: '#008374',
      color: 'white',
      weight: 1.5,
      fillOpacity: 0.8,
    }).addTo(AppState.map);
    marker.bindTooltip(node.label, { permanent: false });
    marker.on('click', () => navigateTo(node.id));
  });
}

function updateMapPosition(node) {
  if (!AppState.map || !AppState.mapMarker) return;
  if (!node.lat || !node.lng) return;
  AppState.mapMarker.setLatLng([node.lat, node.lng]);
  AppState.map.panTo([node.lat, node.lng]);
}

// ═══════════════════════════════════════════
// AUDIO
// ═══════════════════════════════════════════
let currentAudio = null;
function playSpaceAudio(src) {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  currentAudio = new Audio(src);
  currentAudio.volume = 0.4;
  currentAudio.play().catch(() => {});
}

// ═══════════════════════════════════════════
// MENU LATERAL — HELPERS
// ═══════════════════════════════════════════
function updateActiveMenuItem(nodeId) {
  document.querySelectorAll('.node-item').forEach(el => {
    el.classList.toggle('active', el.dataset.nodeId === nodeId);
  });
  // Scroll al item activo
  const active = document.querySelector('.node-item.active');
  if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ═══════════════════════════════════════════
// EVENTOS DE UI
// ═══════════════════════════════════════════
function bindUIEvents() {
  // Loading screen
  document.getElementById('loading-screen').addEventListener('click', onLoadingClick);

  // Flechas de navegacion
  document.getElementById('btn-prev').addEventListener('click', navigatePrev);
  document.getElementById('btn-next').addEventListener('click', navigateNext);

  // Selector de hora
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.currentTime = btn.dataset.time;
      if (AppState.currentNode) initViewer(AppState.currentNode);
    });
  });

  // Tabs del sidebar
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // Boton compartir
  document.getElementById('btn-share').addEventListener('click', () => {
    navigator.clipboard.writeText(location.href).then(() => {
      SkinController.showToast('Link copiado en el portapapeles');
    });
  });

  // Boton audio
  document.getElementById('btn-audio').addEventListener('click', () => {
    AppState.audioEnabled = !AppState.audioEnabled;
    const btn = document.getElementById('btn-audio');
    btn.textContent = AppState.audioEnabled ? '🔊' : '🔇';
    if (!AppState.audioEnabled && currentAudio) {
      currentAudio.pause();
    }
  });

  // Boton ajustes -> instrucciones
  document.getElementById('btn-settings').addEventListener('click', () => {
    SkinController.showModal('modal-instructions');
  });

  // Boton mensajes -> modal signup
  document.getElementById('btn-messages').addEventListener('click', () => {
    SkinController.showModal('modal-signup');
  });

  // Cerrar modales
  document.getElementById('btn-close-clue').addEventListener('click', () => SkinController.hideModal('modal-clue'));
  document.getElementById('btn-close-reward').addEventListener('click', () => SkinController.hideModal('modal-reward'));
  document.getElementById('btn-close-signup').addEventListener('click', () => SkinController.hideModal('modal-signup'));
  document.getElementById('btn-close-instructions').addEventListener('click', onInstructionsClosed);
  document.getElementById('btn-close-info').addEventListener('click', () => SkinController.hideModal('modal-info'));

  // Seleccion de modo de tour
  document.querySelectorAll('.tour-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      AppState.tourMode = btn.dataset.mode;
      SkinController.hideModal('modal-tour-mode');
      if (AppState.tourMode === 'guided') {
        GameController.startGuidedTour('tour_general');
      }
      startTour();
    });
  });

  // Recompensa
  document.getElementById('btn-open-reward').addEventListener('click', () => {
    SkinController.hideModal('modal-reward');
    SkinController.showModal('modal-signup');
  });

  // Teclado
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') navigateNext();
    if (e.key === 'ArrowLeft')  navigatePrev();
    if (e.key === 'Escape')     SkinController.closeAllModals();
  });
}

function onLoadingClick() {
  if (AppState.isLoading) return;
  const screen = document.getElementById('loading-screen');
  screen.style.opacity = '0';
  setTimeout(() => {
    screen.classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    initMap(AppState.nodes);
    SkinController.showModal('modal-tour-mode');
  }, 400);
}

function onInstructionsClosed() {
  SkinController.hideModal('modal-instructions');
}

function startTour() {
  const startNode = AppState.tourMeta?.start || Object.keys(AppState.nodes)[0];
  if (startNode) {
    initViewer(startNode);
  }
}

// ═══════════════════════════════════════════
// ARRANQUE
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', init);