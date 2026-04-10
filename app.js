'use strict';

const mockData = {
  currentClient: {
    id: 'CL-89314',
    name: 'Isabella Marquez',
    preferredName: 'Isa',
    loyaltyLevel: 'Gold Atelier',
    lastVisit: '2026-03-13',
    preferredStyle: 'Soft dimensional balayage with curtain layers',
    notes:
      'Prefers cool-beige finish, low fragrance products, and soft blowout movement. Wants brightness around face framing without harsh contrast.',
    allergies: 'Ammonia sensitivity (use low-ammonia line)',
    stylist: 'Camille R.',
    currentService: {
      name: 'Balayage Refresh + Gloss + Blowout',
      duration: '2h 15m',
      status: 'In Progress',
      step: 'Section 3 highlight paint + foil wrap'
    },
    formula: {
      name: 'Luminous Beige 7/13',
      breakdown: '30g 7N + 20g 8A + 10g clear gloss',
      developerVolume: '20 vol',
      mixRatio: '1:1.5',
      processingTime: 32
    },
    beforeImage:
      'https://images.unsplash.com/photo-1522336284037-91f7da073525?auto=format&fit=crop&w=900&q=80',
    previewImage:
      'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=900&q=80'
  },
  upcomingAppointments: [
    { time: '3:15 PM', clientName: 'Natalie Kim', service: 'Root Melt + Tone', stylist: 'Camille', status: 'confirmed' },
    { time: '4:00 PM', clientName: 'Jules Parker', service: 'Precision Bob Cut', stylist: 'Andre', status: 'check-in' },
    { time: '4:45 PM', clientName: 'Maya Patel', service: 'Gloss + Blowout', stylist: 'Nina', status: 'pending' },
    { time: '5:30 PM', clientName: 'Grace Lin', service: 'Full Highlight', stylist: 'Camille', status: 'processing' },
    { time: '6:15 PM', clientName: 'Sofia Santos', service: 'Color Correction Consult', stylist: 'Andre', status: 'confirmed' }
  ],
  products: [
    {
      name: 'Keratine Velvet Mask',
      category: 'Treatment',
      useType: 'Post-color hydration',
      image: 'https://images.unsplash.com/photo-1598662972299-5408ddb8a3dc?auto=format&fit=crop&w=220&q=80'
    },
    {
      name: 'LumiTone Color Shield',
      category: 'Shampoo',
      useType: 'Retail recommendation',
      image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=220&q=80'
    },
    {
      name: 'SilkMist Heat Veil',
      category: 'Styling',
      useType: 'Blowout protection',
      image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=220&q=80'
    }
  ],
  colorSettings: {
    baseShade: '7N',
    tone: 62,
    warmth: 38,
    liftLevel: 4,
    developerVolume: 20,
    mixRatio: '1:1.5',
    processingTime: 32,
    swatches: ['#4c3025', '#6a4537', '#8d6250', '#ba8a70', '#d0ad8c', '#ecd2ba']
  }
};

class StateStore {
  constructor(initialData) {
    this.state = {
      ...initialData,
      selectedTab: 'client',
      focusedIndex: 0,
      quickActionsOpen: false,
      previewZoom: 1,
      processingRemainingSeconds: initialData.colorSettings.processingTime * 60,
      attractMode: false,
      lastInteractionAt: Date.now()
    };
    this.listeners = [];
  }

  subscribe(listener) {
    this.listeners.push(listener);
    listener(this.state);
  }

  setState(partial) {
    this.state = { ...this.state, ...partial };
    this.state.lastInteractionAt = Date.now();
    this.listeners.forEach((listener) => listener(this.state));
  }

  getState() {
    return this.state;
  }
}

class AppointmentList {
  constructor(container) {
    this.container = container;
  }

  render(list) {
    this.container.innerHTML = list
      .map(
        (item) => `
        <article class="appointment-item" data-focusable="true" tabindex="0">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <span class="appointment-time">${item.time}</span>
            <span class="badge ${item.status}">${item.status}</span>
          </div>
          <p style="margin:8px 0 2px;font-weight:700;">${item.clientName}</p>
          <p class="muted" style="margin:0;font-size:.9rem;">${item.service} • ${item.stylist}</p>
        </article>
      `
      )
      .join('');
  }

  scroll(direction) {
    const delta = direction === 'up' ? -120 : 120;
    this.container.scrollBy({ top: delta, behavior: 'smooth' });
  }
}

class FormulaController {
  constructor(container, onApply) {
    this.container = container;
    this.onApply = onApply;
  }

  render(clientFormula, settings, remainingSeconds) {
    const mm = Math.floor(remainingSeconds / 60);
    const ss = remainingSeconds % 60;
    this.container.innerHTML = `
      <h2 class="formula-title">${clientFormula.name}</h2>
      <p class="formula-breakdown">${clientFormula.breakdown}</p>
      <p class="muted" style="margin:0 0 8px;">Developer ${settings.developerVolume} vol • Mix ${settings.mixRatio}</p>

      <div class="slider-group">
        ${this.slider('Tone', 'tone', settings.tone)}
        ${this.slider('Warmth', 'warmth', settings.warmth)}
        ${this.slider('Lift', 'liftLevel', settings.liftLevel, 1, 10)}
      </div>

      <p style="margin:12px 0 8px;font-weight:700;">Swatches</p>
      <div class="swatches">
        ${settings.swatches.map((color) => `<span class="swatch" style="background:${color}" title="${color}"></span>`).join('')}
      </div>

      <p style="margin:0 0 10px;">Processing Timer: <strong id="processingTimer">${mm}:${String(ss).padStart(2, '0')}</strong></p>
      <button class="apply-btn pulse" id="applyPreviewBtn" data-focusable="true">Apply Preview</button>
    `;

    this.container.querySelectorAll('input[type="range"]').forEach((input) => {
      input.addEventListener('input', (event) => {
        const name = event.target.name;
        const value = Number(event.target.value);
        const valueNode = this.container.querySelector(`[data-value="${name}"]`);
        if (valueNode) valueNode.textContent = value;
        this.onApply({ [name]: value }, false);
      });
    });

    this.container.querySelector('#applyPreviewBtn').addEventListener('click', () => this.onApply({}, true));
  }

  slider(label, name, value, min = 0, max = 100) {
    return `
      <label class="slider-row">
        <span>${label}</span>
        <input type="range" name="${name}" min="${min}" max="${max}" value="${value}" />
        <span data-value="${name}">${value}</span>
      </label>
    `;
  }
}

class PreviewController {
  constructor(container) {
    this.container = container;
  }

  render(beforeImage, previewImage, zoom) {
    this.container.innerHTML = `
      <article class="preview-card" data-focusable="true" tabindex="0">
        <span class="preview-label">Before</span>
        <img src="${beforeImage}" alt="Client before" />
      </article>
      <article class="preview-card" data-focusable="true" tabindex="0">
        <span class="preview-label">Live Preview</span>
        <img src="${previewImage}" alt="Client color preview" style="transform:scale(${zoom});" />
      </article>
    `;
  }
}

class PanelManager {
  constructor(panelElements, tabButtons) {
    this.panels = panelElements;
    this.tabButtons = tabButtons;
    this.order = ['client', 'services', 'formula', 'preview', 'appointments', 'products', 'settings'];
  }

  setActive(tab) {
    this.tabButtons.forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));

    this.panels.forEach((panel) => {
      const panelName = panel.dataset.panel;
      panel.classList.toggle(
        'active-panel',
        panelName === tab || (tab === 'products' && panelName === 'services') || (tab === 'client' && panelName === 'client')
      );
    });
  }

  next(current, direction) {
    const currentIndex = this.order.indexOf(current);
    if (currentIndex < 0) return this.order[0];
    if (direction === 'left') return this.order[(currentIndex + 1) % this.order.length];
    return this.order[(currentIndex - 1 + this.order.length) % this.order.length];
  }
}

class KeyboardGestureFallback {
  start(emit) {
    this.onKeyDown = (event) => {
      const map = {
        ArrowLeft: 'swipeLeft',
        ArrowRight: 'swipeRight',
        ArrowUp: 'swipeUp',
        ArrowDown: 'swipeDown',
        Enter: 'dwellSelect',
        ' ': 'openPalm',
        '+': 'zoomIn',
        '=': 'zoomIn',
        '-': 'zoomOut'
      };
      if (map[event.key]) {
        if (event.key !== 'Enter') event.preventDefault();
        emit({ type: map[event.key], source: 'keyboard' });
      }
    };
    window.addEventListener('keydown', this.onKeyDown);
  }

  stop() {
    window.removeEventListener('keydown', this.onKeyDown);
  }
}

class MockGestureProvider {
  start(emit) {
    this.timer = setInterval(() => {
      const random = Math.random();
      if (random > 0.985) emit({ type: 'openPalm', source: 'mock' });
    }, 1000);
    this.emit = emit;
  }

  stop() {
    clearInterval(this.timer);
  }
}

class VisionGestureProvider {
  start() {
    // Placeholder adapter for real hand-tracking integration.
  }

  stop() {}
}

class GestureController {
  constructor(providers = []) {
    this.providers = providers;
    this.handlers = [];
    this.dwellMs = 1500;
    this.activeDwellTimer = null;
    this.activeDwellInterval = null;
  }

  onGesture(handler) {
    this.handlers.push(handler);
  }

  start() {
    this.providers.forEach((provider) => provider.start((gesture) => this.emit(gesture)));
  }

  emit(gesture) {
    this.handlers.forEach((handler) => handler(gesture));
  }

  beginDwell(targetId, onProgress, onComplete) {
    this.stopDwell();
    const start = Date.now();
    this.activeDwellInterval = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / this.dwellMs);
      onProgress(progress);
      if (progress >= 1) {
        this.stopDwell();
        onComplete(targetId);
      }
    }, 80);
  }

  stopDwell() {
    clearInterval(this.activeDwellInterval);
    clearTimeout(this.activeDwellTimer);
  }
}

class CameraController {
  constructor(videoElement, statusElement, zoneElement) {
    this.videoElement = videoElement;
    this.statusElement = statusElement;
    this.zoneElement = zoneElement;
    this.stream = null;
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.setStatus('Camera unavailable in this browser');
      return;
    }

    const secureContext = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!secureContext) {
      this.setStatus('Camera needs HTTPS or localhost');
      return;
    }

    this.setStatus('Requesting camera permission...');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1080 },
          height: { ideal: 1920 }
        }
      });

      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();
      this.zoneElement.classList.add('has-camera');
      this.setStatus('Live camera connected');
    } catch (error) {
      const message = this.getErrorMessage(error);
      this.zoneElement.classList.remove('has-camera');
      this.setStatus(message);
    }
  }

  getErrorMessage(error) {
    if (!error || !error.name) return 'Camera unavailable';
    if (error.name === 'NotAllowedError') return 'Camera blocked. Allow access in browser settings.';
    if (error.name === 'NotFoundError') return 'No camera device found';
    if (error.name === 'NotReadableError') return 'Camera is busy in another app';
    return 'Camera could not start';
  }

  setStatus(text) {
    this.statusElement.textContent = text;
  }
}

class SalonMirrorUI {
  constructor(store) {
    this.store = store;
    this.clientRoot = document.getElementById('clientProfile');
    this.serviceRoot = document.getElementById('servicesToday');
    this.productRoot = document.getElementById('productRecommendations');
    this.quickActions = document.getElementById('quickActions');
    this.gestureLabel = document.getElementById('gestureLabel');
    this.dwellRing = document.getElementById('dwellProgress');
    this.dwellText = document.getElementById('dwellText');
    this.clockTime = document.getElementById('clockTime');
    this.clockDate = document.getElementById('clockDate');
    this.idleOverlay = document.getElementById('idleOverlay');
    this.idleClock = document.getElementById('idleClock');
    this.idleDate = document.getElementById('idleDate');
    this.cameraElement = document.getElementById('mirrorCamera');
    this.cameraStatus = document.getElementById('cameraStatus');
    this.reflectionZone = document.querySelector('.reflection-zone');

    this.tabButtons = Array.from(document.querySelectorAll('.action-btn'));
    this.panelCards = Array.from(document.querySelectorAll('.grid-card'));

    this.appointmentList = new AppointmentList(document.getElementById('upcomingAppointments'));
    this.previewController = new PreviewController(document.getElementById('previewSection'));
    this.formulaController = new FormulaController(document.getElementById('colorSettings'), (patch, forceApply) => {
      const current = this.store.getState().colorSettings;
      this.store.setState({ colorSettings: { ...current, ...patch } });
      if (forceApply) this.flashGesture('Preview applied');
    });

    this.panelManager = new PanelManager(this.panelCards, this.tabButtons);
    this.cameraController = new CameraController(this.cameraElement, this.cameraStatus, this.reflectionZone);
    this.focusables = [];
  }

  mount() {
    this.tabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        this.store.setState({ selectedTab: button.dataset.tab });
      });
    });

    this.store.subscribe((state) => this.render(state));
    this.startClock();
  }

  startCamera() {
    this.cameraController.start();
  }

  render(state) {
    const client = state.currentClient;
    this.clientRoot.innerHTML = `
      <p class="welcome">Welcome back, ${client.preferredName}</p>
      <div class="client-header">
        <div class="avatar">${client.preferredName[0]}</div>
        <div>
          <h2 class="client-name">${client.name}</h2>
          <p class="muted" style="margin:2px 0 0;">${client.loyaltyLevel}</p>
        </div>
      </div>
      <ul class="meta-list">
        <li><strong>Last Visit:</strong> ${this.formatDate(client.lastVisit)}</li>
        <li><strong>Preferred Style:</strong> ${client.preferredStyle}</li>
        <li><strong>Stylist:</strong> ${client.stylist}</li>
        <li><strong>Allergies:</strong> ${client.allergies}</li>
        <li><strong>Notes:</strong> ${client.notes}</li>
      </ul>
    `;

    this.serviceRoot.innerHTML = `
      <h2 class="panel-title">Today's Service</h2>
      <article class="service-box">
        <p style="margin:0 0 8px;font-size:1.03rem;font-weight:700;">${client.currentService.name}</p>
        <p style="margin:0 0 8px;"><span class="badge in-progress">${client.currentService.status}</span></p>
        <p class="muted" style="margin:0 0 5px;">Duration: ${client.currentService.duration}</p>
        <p class="muted" style="margin:0 0 5px;">Current Step: ${client.currentService.step}</p>
        <p class="muted" style="margin:0;">Stylist: ${client.stylist}</p>
      </article>
    `;

    this.productRoot.innerHTML = state.products
      .map(
        (product) => `
      <article class="product-card" data-focusable="true" tabindex="0">
        <img class="product-thumb" src="${product.image}" alt="${product.name}" />
        <div>
          <p style="margin:0;font-weight:700;">${product.name}</p>
          <p class="muted" style="margin:0;font-size:.83rem;">${product.category} • ${product.useType}</p>
        </div>
      </article>
    `
      )
      .join('');

    this.appointmentList.render(state.upcomingAppointments);
    this.formulaController.render(client.formula, state.colorSettings, state.processingRemainingSeconds);
    this.previewController.render(client.beforeImage, client.previewImage, state.previewZoom);

    this.panelManager.setActive(state.selectedTab);
    this.quickActions.classList.toggle('open', state.quickActionsOpen);
    this.quickActions.setAttribute('aria-hidden', String(!state.quickActionsOpen));

    this.idleOverlay.classList.toggle('hidden', !state.attractMode);

    this.refreshFocusables(state.focusedIndex);
  }

  refreshFocusables(index = 0) {
    this.focusables = Array.from(document.querySelectorAll('[data-focusable="true"]'));
    this.focusables.forEach((element) => element.classList.remove('focused'));
    const target = this.focusables[index % this.focusables.length];
    if (target) {
      target.classList.add('focused');
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  focusNext(step) {
    const state = this.store.getState();
    if (!this.focusables.length) return;
    const next = (state.focusedIndex + step + this.focusables.length) % this.focusables.length;
    this.store.setState({ focusedIndex: next });
  }

  setGestureLabel(text) {
    this.gestureLabel.textContent = `Gesture: ${text}`;
  }

  setDwellProgress(progress) {
    const circumference = 126;
    this.dwellRing.style.strokeDashoffset = String(circumference - circumference * progress);
    this.dwellText.textContent = progress >= 1 ? 'Selected' : `Hold to select ${(progress * 100).toFixed(0)}%`;
  }

  resetDwell() {
    this.dwellRing.style.strokeDashoffset = '126';
    this.dwellText.textContent = 'Hold to select';
  }

  scrollActivePanel(direction) {
    const selected = this.store.getState().selectedTab;
    if (selected === 'appointments') {
      this.appointmentList.scroll(direction);
      return;
    }
    const activePanel = document.querySelector(`.grid-card[data-panel="${selected}"]`) || document.querySelector('.grid-card.active-panel');
    if (activePanel) activePanel.scrollBy({ top: direction === 'up' ? -120 : 120, behavior: 'smooth' });
  }

  flashGesture(message) {
    this.setGestureLabel(message);
    setTimeout(() => this.setGestureLabel('idle'), 1200);
  }

  startClock() {
    const update = () => {
      const now = new Date();
      const timeText = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const dateText = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
      this.clockTime.textContent = timeText;
      this.clockDate.textContent = dateText;
      this.idleClock.textContent = timeText;
      this.idleDate.textContent = dateText;
    };
    update();
    setInterval(update, 1000);
  }

  formatDate(value) {
    return new Date(`${value}T12:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

class App {
  constructor(data) {
    this.store = new StateStore(data);
    this.ui = new SalonMirrorUI(this.store);
    this.gestureController = new GestureController([
      new MockGestureProvider(),
      new KeyboardGestureFallback(),
      new VisionGestureProvider()
    ]);
    this.inactivityMs = 45000;
    this.processingInterval = null;
  }

  start() {
    this.ui.mount();
    this.ui.startCamera();
    this.gestureController.onGesture((gesture) => this.handleGesture(gesture));
    this.gestureController.start();
    this.bindQuickActionButtons();
    this.bindPointerWake();
    this.startProcessingTimer();
    this.startInactivityWatcher();
  }

  handleGesture(gesture) {
    const state = this.store.getState();

    if (state.attractMode) {
      this.store.setState({ attractMode: false });
      this.ui.setGestureLabel('session restored');
    }

    this.ui.setGestureLabel(`${gesture.type} (${gesture.source})`);

    switch (gesture.type) {
      case 'swipeLeft': {
        const nextTab = this.ui.panelManager.next(state.selectedTab, 'left');
        this.store.setState({ selectedTab: nextTab });
        this.ui.focusNext(1);
        break;
      }
      case 'swipeRight': {
        const nextTab = this.ui.panelManager.next(state.selectedTab, 'right');
        this.store.setState({ selectedTab: nextTab });
        this.ui.focusNext(-1);
        break;
      }
      case 'swipeUp':
        this.ui.scrollActivePanel('up');
        break;
      case 'swipeDown':
        this.ui.scrollActivePanel('down');
        break;
      case 'openPalm':
        this.store.setState({ quickActionsOpen: !state.quickActionsOpen });
        break;
      case 'zoomIn':
        this.adjustZoom(0.08);
        break;
      case 'zoomOut':
        this.adjustZoom(-0.08);
        break;
      case 'dwellSelect':
        this.performDwellSelection();
        break;
      default:
        break;
    }
  }

  performDwellSelection() {
    const { focusedIndex } = this.store.getState();
    this.gestureController.beginDwell(
      focusedIndex,
      (progress) => this.ui.setDwellProgress(progress),
      () => {
        const target = this.ui.focusables[focusedIndex];
        if (target) target.click();
        this.ui.flashGesture('item selected');
        this.ui.resetDwell();
      }
    );
  }

  adjustZoom(delta) {
    const state = this.store.getState();
    const nextZoom = Math.min(1.7, Math.max(0.8, Number((state.previewZoom + delta).toFixed(2))));
    this.store.setState({ previewZoom: nextZoom, selectedTab: 'preview' });
  }

  bindPointerWake() {
    ['mousemove', 'mousedown', 'touchstart'].forEach((eventName) => {
      window.addEventListener(eventName, () => {
        const state = this.store.getState();
        if (state.attractMode) this.store.setState({ attractMode: false });
        else this.store.setState({});
      });
    });
  }

  bindQuickActionButtons() {
    const actions = Array.from(document.querySelectorAll('.quick-btn'));
    actions.forEach((button) => {
      button.addEventListener('click', () => {
        const label = button.textContent.trim();
        if (label === 'Start Processing Timer') {
          const minutes = this.store.getState().colorSettings.processingTime;
          this.store.setState({ processingRemainingSeconds: minutes * 60, quickActionsOpen: false });
        } else {
          this.store.setState({ quickActionsOpen: false });
        }
        this.ui.flashGesture(label);
      });
    });
  }

  startInactivityWatcher() {
    setInterval(() => {
      const state = this.store.getState();
      if (!state.attractMode && Date.now() - state.lastInteractionAt > this.inactivityMs) {
        this.store.setState({ attractMode: true, quickActionsOpen: false });
      }
    }, 2000);
  }

  startProcessingTimer() {
    this.processingInterval = setInterval(() => {
      const { processingRemainingSeconds } = this.store.getState();
      if (processingRemainingSeconds <= 0) return;
      this.store.setState({ processingRemainingSeconds: processingRemainingSeconds - 1 });
    }, 1000);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new App(mockData);
  app.start();
});
