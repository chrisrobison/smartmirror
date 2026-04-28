'use strict';

const componentData = [
  {
    id: 'client-profile',
    title: 'Client Profile',
    detailType: 'facts',
    details: [
      ['Client', 'Sarah Mitchell'],
      ['Loyalty', 'Gold Member'],
      ['Last Visit', '5 Weeks Ago'],
      ['Preference', 'Warm balayage']
    ]
  },
  {
    id: 'appointments',
    title: 'Upcoming Appointments',
    detailType: 'menu',
    details: ['12:00 PM Jessica T. - Cut & Style', '1:30 PM Mark S. - Color Touch-Up', '3:00 PM Emily W. - Highlights']
  },
  {
    id: 'services-today',
    title: 'Services Today',
    detailType: 'facts',
    details: [
      ['Service', 'Balayage & Trim'],
      ['Stylist', 'Amanda'],
      ['Status', 'Color consultation']
    ]
  },
  {
    id: 'products-used',
    title: 'Products Used',
    detailType: 'menu',
    details: ['Color Protect Shampoo', 'Argan Oil Serum', 'Volumizing Spray']
  },
  {
    id: 'formula-board',
    title: 'Hair Color Settings',
    detailType: 'menu',
    details: ['Golden Blonde', '7G + 8G (30 Vol)', 'Tone slider: 54%', 'Warmth slider: 70%']
  },
  {
    id: 'before',
    title: 'Before',
    detailType: 'facts',
    details: [
      ['Base', 'Level 7 blonde'],
      ['Condition', 'Healthy ends'],
      ['Goal', 'Warmer dimension']
    ]
  },
  {
    id: 'live-preview',
    title: 'Live Preview',
    detailType: 'facts',
    details: [
      ['Tone', 'Golden blonde'],
      ['Depth', 'Dimensional'],
      ['Finish', 'Soft gloss']
    ]
  },
  {
    id: 'style-gallery',
    title: 'Style Gallery',
    detailType: 'menu',
    details: ['Long layers', 'Face frame', 'Soft waves', 'Dimensional blonde']
  },
  {
    id: 'retail-products',
    title: 'Retail Products',
    detailType: 'menu',
    details: ['Color Protect Shampoo', 'Argan Oil Serum', 'Volumizing Spray']
  },
  {
    id: 'salon-tips',
    title: 'Salon Tips',
    detailType: 'menu',
    details: ['Use sulfate-free care', 'Refresh gloss in 8 weeks', 'Protect tone from heat']
  }
];

class GestureController {
  constructor(providers = []) {
    this.providers = providers;
    this.handlers = [];
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
}

class KeyboardGestureFallback {
  start(emit) {
    this.onKeyDown = (event) => {
      const map = {
        ArrowLeft: 'swipeLeft',
        ArrowRight: 'swipeRight',
        Enter: 'fist',
        f: 'fist',
        F: 'fist',
        ' ': 'palmUp'
      };

      if (!map[event.key]) return;
      event.preventDefault();
      emit({ type: map[event.key], source: 'keyboard' });
    };

    this.externalGesture = (event) => {
      if (!event.detail || !event.detail.type) return;
      emit({
        type: event.detail.type,
        source: event.detail.source || 'external'
      });
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('smartmirror:gesture', this.externalGesture);
  }

  stop() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('smartmirror:gesture', this.externalGesture);
  }
}

class VisionGestureProvider {
  start() {
    // Connect the live recognizer by dispatching:
    // window.dispatchEvent(new CustomEvent('smartmirror:gesture', { detail: { type: 'palmUp' } }));
  }

  stop() {}
}

class SmartMirrorApp {
  constructor(components) {
    this.components = components;
    this.state = {
      clock: new Date(),
      selectionArmed: false,
      selectedIndex: 0,
      openComponentId: null,
      gestureLog: []
    };

    this.clockTime = document.getElementById('clockTime');
    this.clockDate = document.getElementById('clockDate');
    this.gestureLabel = document.getElementById('gestureLabel');
    this.selectedLabel = document.getElementById('selectedLabel');
    this.gestureLog = document.getElementById('gestureLog');
    this.detailTitle = document.getElementById('detailTitle');
    this.detailHint = document.getElementById('detailHint');
    this.detailContent = document.getElementById('detailContent');

    this.gestureController = new GestureController([new KeyboardGestureFallback(), new VisionGestureProvider()]);
  }

  start() {
    this.render();
    this.bindComponentClicks();
    this.gestureController.onGesture((gesture) => this.handleGesture(gesture));
    this.gestureController.start();
    this.startClock();
  }

  bindComponentClicks() {
    document.querySelectorAll('.component-card[data-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const idx = this.components.findIndex((item) => item.id === card.dataset.id);
        if (idx < 0) return;

        this.state.selectionArmed = true;
        this.state.selectedIndex = idx;
        this.state.openComponentId = card.dataset.id;
        this.logGesture(`mouse open: ${this.components[idx].title}`);
        this.render();
      });
    });
  }

  startClock() {
    const tick = () => {
      this.state.clock = new Date();
      this.renderClock();
    };

    tick();
    setInterval(tick, 1000);
  }

  renderClock() {
    const now = this.state.clock;
    this.clockTime.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    this.clockDate.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  }

  render() {
    this.renderClock();
    this.renderDetailPanel();
    this.renderStatus();
    this.renderGestureLog();
    this.renderComponentStates();
  }

  renderComponentStates() {
    const selectedComponent = this.getSelectedComponent();

    document.querySelectorAll('.component-card[data-id]').forEach((card) => {
      card.classList.toggle('is-selected', this.state.selectionArmed && selectedComponent.id === card.dataset.id);
      card.classList.toggle('is-open', this.state.openComponentId === card.dataset.id);
    });
  }

  renderStatus() {
    const selected = this.getSelectedComponent();
    this.selectedLabel.textContent = this.state.selectionArmed ? `Selected: ${selected.title}` : 'Selected: none';
  }

  renderDetailPanel() {
    const selected = this.getSelectedComponent();

    if (!this.state.openComponentId) {
      this.detailTitle.textContent = this.state.selectionArmed ? selected.title : 'No component open';
      this.detailHint.textContent = this.state.selectionArmed
        ? 'Make a fist to open this component.'
        : 'Raise palm to arm selection. Swipe to choose. Make a fist to open.';
      this.detailContent.innerHTML = '<p class="detail-empty">Waiting for gesture selection...</p>';
      this.detailTitle.parentElement.classList.remove('has-content');
      return;
    }

    const item = this.components.find((component) => component.id === this.state.openComponentId);
    if (!item) return;

    this.detailTitle.textContent = `${item.title} Detail`;
    this.detailHint.textContent = 'Component expanded. Swipe to switch target, then fist to open another.';
    this.detailTitle.parentElement.classList.add('has-content');

    if (item.detailType === 'menu') {
      this.detailContent.innerHTML = `
        <ul class="detail-menu">
          ${item.details.map((entry) => `<li>${entry}</li>`).join('')}
        </ul>
      `;
      return;
    }

    if (item.detailType === 'facts') {
      this.detailContent.innerHTML = `
        <dl class="detail-facts">
          ${item.details.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}
        </dl>
      `;
      return;
    }

    this.detailContent.innerHTML = '<p class="detail-empty">No content available.</p>';
  }

  renderGestureLog() {
    if (!this.state.gestureLog.length) {
      this.gestureLog.innerHTML = '<p class="log-empty">No gestures yet.</p>';
      return;
    }

    this.gestureLog.innerHTML = this.state.gestureLog
      .slice(-6)
      .reverse()
      .map((entry) => `<p class="log-entry">${entry}</p>`)
      .join('');
  }

  handleGesture(gesture) {
    const type = this.normalizeGestureType(gesture.type);
    const source = gesture.source || 'unknown';
    this.gestureLabel.textContent = `Gesture: ${type} (${source})`;

    switch (type) {
      case 'palmUp':
        this.state.selectionArmed = true;
        this.state.openComponentId = null;
        this.logGesture('palm up: selection armed');
        break;
      case 'swipeLeft':
        this.moveSelection(1);
        this.logGesture('swipe left: next component');
        break;
      case 'swipeRight':
        this.moveSelection(-1);
        this.logGesture('swipe right: previous component');
        break;
      case 'fist':
        this.openSelectedComponent();
        break;
      default:
        this.logGesture(`${type}: ignored`);
        break;
    }

    this.render();
  }

  normalizeGestureType(type) {
    const map = {
      Open_Palm: 'palmUp',
      openPalm: 'palmUp',
      palmUp: 'palmUp',
      swipeLeft: 'swipeLeft',
      swipeRight: 'swipeRight',
      Closed_Fist: 'fist',
      closedFist: 'fist',
      fist: 'fist',
      dwellSelect: 'fist'
    };

    return map[type] || type;
  }

  moveSelection(delta) {
    if (!this.state.selectionArmed) {
      this.logGesture('swipe ignored: raise palm first');
      return;
    }

    this.state.selectedIndex = (this.state.selectedIndex + delta + this.components.length) % this.components.length;
  }

  openSelectedComponent() {
    if (!this.state.selectionArmed) {
      this.logGesture('fist ignored: selection not armed');
      return;
    }

    const selected = this.getSelectedComponent();

    if (this.state.openComponentId === selected.id) {
      this.state.openComponentId = null;
      this.logGesture(`fist: closed ${selected.title}`);
      return;
    }

    this.state.openComponentId = selected.id;
    this.logGesture(`fist: opened ${selected.title}`);
  }

  getSelectedComponent() {
    return this.components[this.state.selectedIndex] || this.components[0];
  }

  logGesture(message) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.state.gestureLog.push(`${time} - ${message}`);
    if (this.state.gestureLog.length > 32) this.state.gestureLog.shift();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new SmartMirrorApp(componentData);
  app.start();
});
