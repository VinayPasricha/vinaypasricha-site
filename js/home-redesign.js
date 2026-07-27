(function () {
  "use strict";

  document.querySelectorAll(".book").forEach((book) => {
    const band = book.querySelector(".signal-band");
    const bookIndex = Number(book.dataset.bookIndex || 0);
    const color = book.dataset.signalColor || "#e11431";
    book.style.setProperty("--signal-color", color);
    if (!band || band.children.length) return;

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 30; i += 1) {
      const phase = i * 0.42;
      const raw =
        2 +
        12 *
          Math.pow(
            0.5 + 0.5 * Math.sin(phase + bookIndex * 2.1),
            1.6
          ) +
        1.2 * Math.sin(phase * 2.3);
      const bar = document.createElement("span");
      bar.style.height = `${Math.max(2, raw).toFixed(2)}px`;
      fragment.appendChild(bar);
    }
    band.appendChild(fragment);
  });

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const dividers = document.querySelectorAll(".pulse-divider");

  if (!reducedMotion && "IntersectionObserver" in window) {
    const dividerObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("divider-active");
          dividerObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.08 }
    );
    dividers.forEach((divider) => dividerObserver.observe(divider));
  }
})();
