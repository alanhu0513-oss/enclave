/**
 * interactions.js — Micro-interactions engine for Enclave
 * Ripple clicks, button loading states, shield toggle glow,
 * scan pulse, success/error flash, card press feedback.
 */
(function () {
  'use strict';

  /* ─── Ripple Effect on All Clickable Elements ─── */
  function createRipple(e) {
    var el = e.currentTarget;
    var rect = el.getBoundingClientRect();
    var ripple = document.createElement('span');
    ripple.className = 'ui-ripple';
    var size = Math.max(rect.width, rect.height) * 2;
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
    el.appendChild(ripple);
    setTimeout(function () { ripple.remove(); }, 600);
  }

  function initRipples() {
    var targets = document.querySelectorAll(
      '.btn-primary, .btn-ghost, .btn-icon, .nav-item, .action-card, .shield-toggle, .alert-item-home, .badge, .plan-btn'
    );
    targets.forEach(function (el) {
      if (el._rippleInit) return;
      el._rippleInit = true;
      el.style.position = 'relative';
      el.style.overflow = 'hidden';
      el.addEventListener('click', createRipple);
    });
  }

  /* ─── Button Loading State ─── */
  function setButtonLoading(btn, isLoading, loadingText) {
    if (!btn) return;
    if (isLoading) {
      btn._origText = btn.innerHTML;
      btn._origDisabled = btn.disabled;
      btn.disabled = true;
      btn.classList.add('ui-loading');
      btn.innerHTML = '<span class="ui-spinner"></span>' + (loadingText || 'Processing...');
    } else {
      btn.disabled = btn._origDisabled || false;
      btn.classList.remove('ui-loading');
      if (btn._origText) btn.innerHTML = btn._origText;
    }
  }

  /* ─── Button Success Flash ─── */
  function flashSuccess(btn, text, duration) {
    if (!btn) return;
    var orig = btn.innerHTML;
    btn.classList.add('ui-success-flash');
    btn.innerHTML = text || '✓ Done';
    setTimeout(function () {
      btn.classList.remove('ui-success-flash');
      btn.innerHTML = orig;
    }, duration || 1800);
  }

  /* ─── Button Error Flash ─── */
  function flashError(btn, text, duration) {
    if (!btn) return;
    var orig = btn.innerHTML;
    btn.classList.add('ui-error-flash');
    btn.innerHTML = text || '✕ Failed';
    setTimeout(function () {
      btn.classList.remove('ui-error-flash');
      btn.innerHTML = orig;
    }, duration || 2000);
  }

  /* ─── Shield Toggle Glow ─── */
  function animateShieldToggle(card, isActive) {
    if (!card) return;
    card.classList.add('shield-animating');
    var ring = card.querySelector('.shield-pulse-ring');
    if (ring) {
      if (isActive) {
        ring.style.animation = 'none';
        ring.offsetHeight; // reflow
        ring.style.animation = '';
        card.classList.add('shield-activated');
      } else {
        card.classList.remove('shield-activated');
      }
    }
    setTimeout(function () { card.classList.remove('shield-animating'); }, 800);
  }

  /* ─── Scan Button Pulse ─── */
  function pulseScanButton() {
    var btn = document.getElementById('btn-scanner');
    if (!btn) return;
    btn.classList.add('ui-scanning');
  }

  function stopPulseScanButton() {
    var btn = document.getElementById('btn-scanner');
    if (!btn) return;
    btn.classList.remove('ui-scanning');
  }

  /* ─── Card Press (mousedown scale) ─── */
  function initCardPress() {
    var cards = document.querySelectorAll('.action-card, .shield-card, .card, .home-card');
    cards.forEach(function (card) {
      if (card._pressInit) return;
      card._pressInit = true;
      card.addEventListener('mousedown', function () { card.classList.add('ui-pressed'); });
      card.addEventListener('mouseup', function () { card.classList.remove('ui-pressed'); });
      card.addEventListener('mouseleave', function () { card.classList.remove('ui-pressed'); });
    });
  }

  /* ─── Tab Content Transition ─── */
  function animateTabIn(tabEl) {
    if (!tabEl) return;
    tabEl.classList.add('tab-entering');
    tabEl.offsetHeight; // reflow
    tabEl.classList.remove('tab-entering');
    tabEl.classList.add('tab-active');
    setTimeout(function () { tabEl.classList.remove('tab-active'); }, 400);
  }

  /* ─── Badge Unlock Celebration ─── */
  function celebrateUnlock(badgeEl) {
    if (!badgeEl) return;
    badgeEl.classList.add('badge-unlocking');
    // Create confetti burst
    for (var i = 0; i < 12; i++) {
      var particle = document.createElement('span');
      particle.className = 'confetti-particle';
      var angle = (i / 12) * 360;
      var dist = 30 + Math.random() * 20;
      particle.style.setProperty('--angle', angle + 'deg');
      particle.style.setProperty('--dist', dist + 'px');
      badgeEl.appendChild(particle);
      setTimeout(function (p) { return function () { p.remove(); }; }(particle), 700);
    }
    setTimeout(function () { badgeEl.classList.remove('badge-unlocking'); }, 1200);
  }

  /* ─── Toast Enter Animation ─── */
  function animateToast(toastEl) {
    if (!toastEl) return;
    toastEl.classList.add('toast-entering');
    setTimeout(function () { toastEl.classList.remove('toast-entering'); }, 400);
  }

  /* ─── Streak Increment Pop ─── */
  function popStreak() {
    var el = document.getElementById('streak-number');
    if (!el) return;
    el.classList.add('streak-pop');
    setTimeout(function () { el.classList.remove('streak-pop'); }, 500);
  }

  /* ─── Stat Counter Increment Animation ─── */
  function animateCounter(el, targetVal) {
    if (!el) return;
    var current = parseInt(el.textContent) || 0;
    if (current === targetVal) return;
    var diff = targetVal - current;
    var steps = Math.min(Math.abs(diff), 20);
    var stepTime = 300 / steps;
    var i = 0;
    var interval = setInterval(function () {
      i++;
      var progress = i / steps;
      var eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(current + diff * eased);
      if (i >= steps) {
        clearInterval(interval);
        el.textContent = targetVal;
      }
    }, stepTime);
  }

  /* ─── Expose globally ─── */
  window.EnclaveUI = {
    initRipples: initRipples,
    setButtonLoading: setButtonLoading,
    flashSuccess: flashSuccess,
    flashError: flashError,
    animateShieldToggle: animateShieldToggle,
    pulseScanButton: pulseScanButton,
    stopPulseScanButton: stopPulseScanButton,
    initCardPress: initCardPress,
    animateTabIn: animateTabIn,
    celebrateUnlock: celebrateUnlock,
    animateToast: animateToast,
    popStreak: popStreak,
    animateCounter: animateCounter
  };

  /* ─── Auto-init on DOM ready ─── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initRipples();
      initCardPress();
    });
  } else {
    initRipples();
    initCardPress();
  }

})();
