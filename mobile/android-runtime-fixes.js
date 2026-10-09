(() => {
  'use strict';

  if (window.__HIVE_ANDROID_RUNTIME_FIX_V1__) return;
  window.__HIVE_ANDROID_RUNTIME_FIX_V1__ = true;

  const routeByLabel = {
    home: 'home',
    hives: 'hives',
    actions: 'actions',
    insights: 'insights'
  };

  function currentBlockingModal() {
    return document.querySelector('#app > .modal');
  }

  // Android WebView fallback for the persistent bottom navigation.
  // We intentionally own these four stable routes in capture phase so a
  // dynamically-rendered inline onclick cannot strand the user.
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('#bottomnav .navitem') : null;
    if (!target || currentBlockingModal()) return;

    const label = String(target.textContent || '').trim().toLowerCase();
    const route = routeByLabel[label];
    if (!route || typeof window.go !== 'function') return;

    event.preventDefault();
    event.stopImmediatePropagation();
    window.go(route);
  }, true);

  function hardenHomeQuickModal(kind) {
    const modal = document.querySelector('#app > .modal.v215-more-modal');
    if (!modal) return;

    const copy = String(modal.textContent || '');
    if (!copy.includes('Choose the hive before starting this record.')) return;

    const select = modal.querySelector('#v2p2e5l-quick-hive');
    const buttons = Array.from(modal.querySelectorAll('button'));
    const continueButton = buttons.find((button) => String(button.textContent || '').trim() === 'Continue');
    const closeButton = buttons.find((button) => String(button.textContent || '').trim() === '✕');

    if (continueButton && !continueButton.dataset.androidBound) {
      continueButton.dataset.androidBound = '1';
      continueButton.removeAttribute('onclick');
      continueButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const hiveId = select ? String(select.value || '') : '';
        if (!hiveId) {
          if (typeof window.toast === 'function') window.toast('Select a hive');
          return;
        }

        if (typeof window.v2p2e5lStartHomeQuick === 'function') {
          window.v2p2e5lStartHomeQuick(kind, hiveId);
        }
      });
    }

    if (closeButton && !closeButton.dataset.androidBound) {
      closeButton.dataset.androidBound = '1';
      closeButton.removeAttribute('onclick');
      closeButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        modal.remove();
      });
    }
  }

  const originalHomeQuick = window.v2p2e5lHomeQuick;
  if (typeof originalHomeQuick === 'function') {
    window.v2p2e5lHomeQuick = function(kind) {
      const result = originalHomeQuick.apply(this, arguments);
      queueMicrotask(() => hardenHomeQuickModal(kind));
      return result;
    };
  }

  // Keep bottom navigation visually and interactively out of the way while
  // any app modal is open, then restore it when the modal disappears.
  const app = document.getElementById('app');
  const nav = document.getElementById('bottomnav');
  if (app && nav) {
    const syncNav = () => {
      const blocked = !!currentBlockingModal();
      nav.style.pointerEvents = blocked ? 'none' : '';
      nav.style.visibility = blocked ? 'hidden' : '';
      nav.setAttribute('aria-hidden', blocked ? 'true' : 'false');
    };

    new MutationObserver(syncNav).observe(app, { childList: true });
    syncNav();
  }

  // Android-only auth UI consistency. If a token refresh clears the session
  // while an already rendered screen remains, app.js hashchange intentionally
  // refuses to render protected routes. Without a visible auth fallback every
  // go() button appears dead although clicks are delivered.
  // This does not change any scientific routes, state, or entitlement rules.
  function showSignInForStaleProtectedView() {
    if (window.HIVEDASH_CONFIG?.REQUIRE_AUTH !== true ||
        typeof window.isAuthenticated !== 'function' ||
        window.isAuthenticated()) return false;
    const view = document.getElementById('view');
    if (!view || view.classList.contains('auth-view')) return false;
    const route = (location.hash || '#home').slice(1).split('/')[0];
    if (route === 'terms' || route === 'privacy') return false;
    if (typeof window.renderAuth !== 'function') return false;
    window.renderAuth('signin', 'Your session needs to be renewed. Sign in to continue.');
    return true;
  }

  // For navigation targets that modify the hash, restore a visible auth UI
  // instead of leaving the previous page stranded.
  window.addEventListener('hashchange', showSignInForStaleProtectedView);

  // For buttons that do not modify the hash, do not allow stale UI controls
  // to write local state after the authenticated session has disappeared.
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element
      ? event.target.closest('button,a,[role="button"],[onclick],input,select,textarea')
      : null;
    if (!target) return;
    if (showSignInForStaleProtectedView()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

})();
