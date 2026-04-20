'use strict';

const componentData = [
  {
    id: 'client-profile',
    zone: 'top',
    title: 'Client Profile',
    summary: 'Allergies, target look, and visit notes.',
    accent: '#63d8ff',
    detailType: 'facts',
    details: [
      ['Client', 'Isabella Marquez'],
      ['Look', 'Soft dimensional balayage + curtain layers'],
      ['Allergy', 'Ammonia sensitivity'],
      ['Stylist', 'Camille R.']
    ]
  },
  {
    id: 'appointments',
    zone: 'top',
    title: 'Appointments',
    summary: 'Timeline for the next 3 guests.',
    accent: '#a8c0ff',
    detailType: 'menu',
    details: ['3:15 PM Natalie Kim - Root Melt + Tone', '4:00 PM Jules Parker - Precision Bob', '4:45 PM Maya Patel - Gloss + Blowout']
  },
  {
    id: 'formula-board',
    zone: 'left',
    title: 'Formula Board',
    summary: 'Current mix and process controls.',
    accent: '#6bf0b6',
    detailType: 'menu',
    details: ['Adjust tone slider', 'Adjust warmth slider', 'Restart processing timer', 'Save formula snapshot']
  },
  {
    id: 'processing-timer',
    zone: 'left',
    title: 'Processing Timer',
    summary: 'Remaining: 31m',
    accent: '#f2c46d',
    detailType: 'facts',
    details: [
      ['Target', '32 minutes'],
      ['Remaining', '31 minutes'],
      ['Developer', '20 vol']
    ]
  },
  {
    id: 'preview-gallery',
    zone: 'right',
    title: 'Preview Gallery',
    summary: 'Before vs predicted finish.',
    accent: '#ffb08e',
    detailType: 'gallery',
    details: [
      'https://images.unsplash.com/photo-1522336284037-91f7da073525?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=900&q=80'
    ]
  },
  {
    id: 'retail-reco',
    zone: 'right',
    title: 'Retail Reco',
    summary: 'Products likely to convert post-service.',
    accent: '#f199ff',
    detailType: 'menu',
    details: ['LumiTone Color Shield', 'Keratine Velvet Mask', 'SilkMist Heat Veil']
  },
  {
    id: 'quick-actions',
    zone: 'bottom',
    title: 'Quick Actions',
    summary: 'Hands-free macros for salon flow.',
    accent: '#86ffe2',
    detailType: 'menu',
    details: ['Notify front desk', 'Mark paint section complete', 'Add rinse reminder', 'Flag client check-out prep']
  },
  {
    id: 'notes',
    zone: 'bottom',
    title: 'Session Notes',
    summary: 'Voice-ready notes and reminders.',
    accent: '#82abff',
    detailType: 'facts',
    details: [
      ['Reminder', 'Client requests cooler finish in front frame'],
      ['Inventory', 'Low stock: 8A toner'],
      ['Follow-up', 'Book 8-week gloss refresh']
    ]
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

    this.rails = {
      top: document.getElementById('topRail'),
      left: document.getElementById('leftRail'),
      right: document.getElementById('rightRail'),
      bottom: document.getElementById('bottomRail')
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
    this.gestureController.onGesture((gesture) => this.handleGesture(gesture));
    this.gestureController.start();
    this.startClock();
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
    this.renderRails();
    this.renderDetailPanel();
    this.renderStatus();
    this.renderGestureLog();
  }

  renderRails() {
    this.rails.top.innerHTML = this.renderCardsForZone('top');
    this.rails.left.innerHTML = this.renderCardsForZone('left');
    this.rails.right.innerHTML = this.renderCardsForZone('right');
    this.rails.bottom.innerHTML = this.renderCardsForZone('bottom');

    Object.values(this.rails).forEach((rail) => {
      rail.querySelectorAll('.component-card').forEach((card) => {
        card.addEventListener('click', () => {
          const id = card.dataset.id;
          const idx = this.components.findIndex((item) => item.id === id);
          if (idx < 0) return;
          this.state.selectionArmed = true;
          this.state.selectedIndex = idx;
          this.state.openComponentId = id;
          this.logGesture(`mouse open: ${this.components[idx].title}`);
          this.render();
        });
      });
    });
  }

  renderCardsForZone(zone) {
    return this.components
      .filter((component) => component.zone === zone)
      .map((component) => this.renderCard(component))
      .join('');
  }

  renderCard(component) {
    const selectedComponent = this.getSelectedComponent();
    const isSelected = this.state.selectionArmed && selectedComponent.id === component.id;
    const isOpen = this.state.openComponentId === component.id;
    const selectedClass = isSelected ? 'is-selected' : '';
    const openClass = isOpen ? 'is-open' : '';

    return `
      <article
        class="component-card ${selectedClass} ${openClass}"
        data-id="${component.id}"
        style="--component-accent:${component.accent}"
      >
        <p class="component-kicker">${component.zone.toUpperCase()}</p>
        <h3>${component.title}</h3>
        <p class="component-summary">${component.summary}</p>
      </article>
    `;
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
      return;
    }

    const item = this.components.find((component) => component.id === this.state.openComponentId);
    if (!item) return;

    this.detailTitle.textContent = `${item.title} Detail`;
    this.detailHint.textContent = 'Component expanded. Swipe to switch target, then fist to open another.';

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

    if (item.detailType === 'gallery') {
      this.detailContent.innerHTML = `
        <div class="detail-gallery">
          ${item.details.map((url, index) => `<img src="${url}" alt="Preview sample ${index + 1}" />`).join('')}
        </div>
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
