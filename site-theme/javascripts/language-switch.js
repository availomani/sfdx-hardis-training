/*
 * Keeps the translate widget pointing at the page being read.
 *
 * site-overrides/partials/alternate.html writes the right link into the widget
 * when a page is served. But the theme navigates without reloading, and what it
 * swaps is the container, the logo and the header title, never the rest of the
 * header. So the widget keeps the links of the page the reader first landed on:
 * open the home page, walk to Lab 2.2 through the menu, click Français, and you
 * are back on the French home page instead of on Lab 2.2 in French.
 *
 * This rebuilds the links on every page change, from where the reader now is.
 * Every locale mirrors labs/en/, so the same page in another language is the
 * same path with the language swapped, and a page that sits in no language, the
 * backlog or the badges, falls back to the home page of that language, which
 * each link carries in data-course-home.
 *
 * The language of the page and the root of the site come from the menu, which
 * the theme does swap: site-overrides/partials/nav.html writes them there.
 *
 * Checked by scripts/verify/check-language-switch.mjs, which walks to a lab
 * through the menu before clicking the widget, because a page opened directly
 * has the right links either way.
 */
(function () {
  "use strict";

  function retarget() {
    var links = document.querySelectorAll("a.md-select__link[hreflang]");
    if (links.length === 0) {
      return;
    }
    var menu = document.querySelector(".md-nav--primary[data-course-lang]");
    if (!menu) {
      return;
    }
    var lang = menu.getAttribute("data-course-lang");
    var base = new URL(menu.getAttribute("data-course-base") || ".", window.location.href).pathname;
    if (base.slice(-1) !== "/") {
      base += "/";
    }
    // What is left of the path once the site root and the language are taken off
    var prefix = base + lang + "/";
    var here = window.location.pathname;
    var rest = here.indexOf(prefix) === 0 ? here.slice(prefix.length) : null;

    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var other = link.getAttribute("hreflang");
      var home = link.getAttribute("data-course-home");
      if (!other) {
        continue;
      }
      if (rest === null) {
        if (home) {
          link.setAttribute("href", home);
        }
        continue;
      }
      link.setAttribute("href", base + other + "/" + rest);
    }
  }

  if (typeof document$ !== "undefined" && document$.subscribe) {
    document$.subscribe(retarget);
  } else {
    document.addEventListener("DOMContentLoaded", retarget);
  }
})();
