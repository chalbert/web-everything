/* reveal-nav.js — progressive enhancement for the W3C APG Disclosure Navigation
 * header (#645, the conform-to reference for #644).
 *
 * The CSS baseline (no JS) reveals each section's panel on :hover / :focus-within.
 * This script adds the APG semantics on top:
 *   - sets `.js-nav` on <html>, which drops the :focus-within reveal in favour of
 *     an aria-expanded-driven one, so Esc / outside-click can collapse a panel
 *     even while focus is still inside it (which :focus-within can't express).
 *     Pointer :hover stays as CSS sugar — a mouse user peeks a panel; a click pins it;
 *   - each head button is a real toggle: click / Enter / Space flips aria-expanded
 *     (opening one closes its siblings);
 *   - Escape closes the open section and returns focus to its head button;
 *   - clicking or moving focus outside the nav dismisses any open panel.
 *
 * Desktop only: below the mobile breakpoint the sections render as an inline
 * accordion (panels are CSS-static), so toggling is a no-op there.
 */
(function () {
  'use strict';
  var nav = document.getElementById('site-nav');
  if (!nav) return;
  var sections = Array.prototype.slice.call(nav.querySelectorAll('.nav-menu-section'));
  if (!sections.length) return;

  // Cut the mustard: hand the keyboard reveal to aria-expanded (see the CSS).
  document.documentElement.classList.add('js-nav');

  var isDesktop = function () { return window.matchMedia('(min-width: 941px)').matches; };
  var headOf = function (s) { return s.querySelector('.nav-menu-head'); };
  var isOpen = function (s) {
    var b = headOf(s);
    return !!b && b.getAttribute('aria-expanded') === 'true';
  };
  var setOpen = function (s, open) {
    var b = headOf(s);
    if (b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  var closeAll = function (except) {
    sections.forEach(function (s) { if (s !== except) setOpen(s, false); });
  };

  sections.forEach(function (s) {
    var btn = headOf(s);
    if (!btn) return;
    // Click / Enter / Space is the canonical disclosure control (a button gives
    // Enter + Space activation natively).
    btn.addEventListener('click', function () {
      if (!isDesktop()) return;          // mobile panels are inline/static
      var open = isOpen(s);
      closeAll(s);
      setOpen(s, !open);
    });
  });

  // Escape closes the open section and returns focus to its head.
  nav.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = sections.filter(isOpen)[0];
    if (open) {
      setOpen(open, false);
      var b = headOf(open);
      if (b) b.focus();
    }
  });

  // Clicking or moving focus outside the nav dismisses everything.
  document.addEventListener('click', function (e) {
    if (!nav.contains(e.target)) closeAll(null);
  });
  document.addEventListener('focusin', function (e) {
    if (!nav.contains(e.target)) closeAll(null);
  });
  // Crossing into the mobile layout: clear any open desktop state.
  window.addEventListener('resize', function () {
    if (!isDesktop()) closeAll(null);
  });
})();
