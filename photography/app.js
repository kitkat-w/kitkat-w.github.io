const collections = [
  {
    id: "island-nostalgia",
    title: "Island nostalgia",
    years: "2022",
    medium: "Shot on HP 200 film.",
    coverIndex: 3,
    statement:
      "I spent much of my teenage life on an isolated island. During the pandemic, I returned with my family and revisited its coastlines. Despite the sun reflecting off the water, the island felt heavy with memory, etched into the volcanic rocks beneath my feet.",
    photos: [
      {
        src: "01_Island_nostalgia/01__482__1673513800-36550300.jpg",
        description: "Black-and-white photograph of a person facing sunlit water beneath a cloudy sky",
        location: "",
      },
      {
        src: "01_Island_nostalgia/02__483__1673513800-81215100.jpg",
        description: "Black-and-white photograph of waves washing around dark coastal rocks",
        location: "",
      },
      {
        src: "01_Island_nostalgia/04__490__1673513807-09622500.jpg",
        description: "Black-and-white photograph of a person with a camera and tripod among shoreline rocks",
        location: "",
      },
      {
        src: "01_Island_nostalgia/thumbnail_05__492__1673513808-34014000.jpg",
        description: "Black-and-white photograph of empty chairs and squid hanging to dry beside a rocky inlet",
        location: "",
      },
      {
        src: "01_Island_nostalgia/06__494__1673513809-73378000.jpg",
        description: "Black-and-white photograph of a photographer reflected in a large outdoor mirror",
        location: "",
      },
    ],
  },
  {
    id: "little-trip-on-water",
    title: "Little trip on water",
    years: "2023",
    statement: "A short journey seen from inside a boat.",
    photos: [
      {
        src: "02_Little_trip_on_water/DSC01667-2.jpg",
        description: "Passengers in a shaded boat cabin with a sunlit figure and green hillside visible through the window",
        location: "",
      },
      {
        src: "02_Little_trip_on_water/DSC01668-2.jpg",
        description: "Four passengers seated in front of a boat window overlooking blue water and a green hillside",
        location: "",
      },
      {
        src: "02_Little_trip_on_water/DSC01704-2.jpg",
        description: "A white boat on blue water framed by the curved edge of a cabin window, with green hills beyond",
        location: "",
      },
    ],
  },
];

const $ = (selector) => document.querySelector(selector);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const film = (roll) =>
  roll === 2
    ? '<svg class="film-icon" viewBox="0 0 32 40" aria-hidden="true"><path d="M6 5Q16 1 26 5L25 8Q16 11 7 8ZM8 9L8 32M24 9L24 32M6 33Q16 29 26 33L25 36Q16 39 7 36ZM9 17Q16 19 23 17M10 25L22 25"/></svg>'
    : '<svg class="film-icon" viewBox="0 0 34 40" aria-hidden="true"><path d="M5 8Q13 4 21 8L21 33Q13 37 5 33ZM5 8Q13 12 21 8M10 6V3H16V6M21 12L31 10V29L21 31M25 14L28 13M25 19L28 18M25 24L28 23M8 15L8 29"/></svg>';

const digits = { 0: "abcdef", 1: "bc", 2: "abdeg", 3: "abcdg", 4: "bcfg", 5: "acdfg", 6: "acdefg", 7: "abc", 8: "abcdefg", 9: "abcdfg" };
const segments = {
  a: "3,1 11,1 12,2 10,3 4,3 2,2",
  b: "12,3 13,4 13,10 12,11 11,10 11,5",
  c: "12,13 13,14 13,20 12,21 11,19 11,14",
  d: "3,21 11,21 12,22 10,23 4,23 2,22",
  e: "1,13 2,14 2,19 1,21 0,20 0,14",
  f: "1,3 2,5 2,10 1,11 0,10 0,4",
  g: "3,11 10,11 12,12 10,13 3,13 1,12",
};
function lcd(value) {
  return String(value)
    .padStart(2, "0")
    .split("")
    .map(
      (d) =>
        `<svg viewBox="0 0 14 24" aria-hidden="true">${Object.entries(segments)
          .map(([key, points]) => `<polygon points="${points}" fill="currentColor" opacity="${digits[d].includes(key) ? 1 : 0.045}"/>`)
          .join("")}</svg>`
    )
    .join("");
}

const gallery = $("#gallery");
const visibleStops = Math.min(3, collections.length);
const extraStops = Math.max(0, collections.length - visibleStops);
// A short wheel movement advances the journal, independent of screen height.
const scrollDistance = 120;
let selectedCollection = -1;
let activeCollection = 0;
let photoIndex = 0;
let touchStart = null;
let opener = null;
let previewAnimation = null;
let scrollFrame = 0;
let scrollChapter = 0;
let routeSelection = null;
let galleryScroll = 0;
let viewportHeight = window.innerHeight;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

collections.forEach((collection, index) => {
  const button = document.createElement("button");
  button.className = "collection-stop";
  button.dataset.preview = index;
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "collection-preview");
  button.innerHTML = `${film(index + 1)}<span class="stop-name hover-caret">${collection.title}</span><span class="stop-number">${
    collection.years
  }</span>`;
  button.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse" && !gallery.open && window.scrollY >= scrollDistance * 0.65) {
      routeSelection = null;
      selectCollection(index);
    }
  });
  button.addEventListener("focus", () => {
    // Tab navigation exposes off-screen stops; pointer focus waits for the click.
    if (button.matches(":focus-visible") && !gallery.open) revealCollection(index);
  });
  button.addEventListener("click", () => revealCollection(index));
  $("#thread-collections").append(button);
  const link = document.createElement("a");
  link.className = "hover-caret";
  link.href = `#series/${collection.id}`;
  link.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span> ${collection.title}`;
  $("#index-collections").append(link);
});
$("#position-number").innerHTML = lcd(collections.length);
$("#position-number").setAttribute("aria-label", String(collections.length));

function selectCollection(index) {
  const changed = index !== selectedCollection;
  selectedCollection = index;
  const collection = collections[index];
  const cover = collection.photos[collection.coverIndex ?? 0];
  if (changed) $("#preview-image").src = `assets/${cover.src}`;
  $("#preview-image").alt = cover.description;
  $("#preview-title").textContent = collection.title;
  if (window.scrollY >= scrollDistance * 0.65) $("#active-collection-title").textContent = collection.title;
  $("#preview-years").textContent = collection.years;
  $("#preview-open").dataset.open = index;
  $("#preview-open").setAttribute("aria-label", `Enter ${collection.title} collection`);
  document
    .querySelectorAll("[data-preview]")
    .forEach((button, i) => button.setAttribute("aria-expanded", String(i === index && window.scrollY >= scrollDistance * 0.65)));
  if (changed && window.scrollY >= scrollDistance * 0.65 && !reducedMotion.matches) {
    previewAnimation?.cancel();
    previewAnimation = $(".screen-sheet").animate(
      [
        { clipPath: `inset(0 0 ${$("#preview-image").getBoundingClientRect().height * 0.94}px 0)`, transform: "translateY(-18px)" },
        { clipPath: "inset(0 0 0% 0)", transform: "translateY(3px)", offset: 0.85 },
        { clipPath: "inset(0 0 0% 0)", transform: "translateY(0)" },
      ],
      { duration: 650, easing: "cubic-bezier(.22,.72,.16,1)" }
    );
  }
  if (changed) drawCord();
  if (changed && window.scrollY >= scrollDistance * 0.65) $("#announcement").textContent = `${collection.title}, ${collection.years}.`;
}
function updateScroll() {
  scrollFrame = 0;
  if (gallery.open) return;
  const progress = clamp(window.scrollY / scrollDistance);
  const position = clamp(window.scrollY / scrollDistance - 1, 0, collections.length - 1);
  const chapter = Math.round(position);
  const shift = clamp(position - (visibleStops - 1), 0, extraStops);
  const revealed = progress >= 0.65;
  const fade = reducedMotion.matches ? Number(revealed) : clamp((progress - 0.3) / 0.5);
  $("#collection-preview").style.opacity = progress > 0.3 ? 1 : 0;
  $(".screen-sheet").style.clipPath = `inset(0 0 ${(1 - fade) * $("#preview-image").getBoundingClientRect().height}px 0)`;
  $(".screen-sheet").style.transform = reducedMotion.matches ? "none" : `translateY(${(1 - fade) * -24}px)`;
  $(".preview-caption").style.opacity = fade;
  $(".pull-cord").style.opacity = fade;
  $("#collection-preview").inert = !revealed;
  $("#collection-preview").setAttribute("aria-hidden", String(!revealed));
  $(".intro-copy").style.opacity = reducedMotion.matches ? Number(!revealed) : 1 - clamp(progress / 0.7);
  $(".intro-copy").style.transform = reducedMotion.matches ? "none" : `translateY(${-progress * viewportHeight * 0.65}px)`;
  $(".intro-copy").inert = revealed;
  $(".intro-copy").setAttribute("aria-hidden", String(revealed));
  $(".statement").style.opacity = progress === 0 ? 0 : clamp(progress * 6);
  $(".statement").setAttribute("aria-hidden", String(progress === 0));
  $(".thread-belt").style.transform = `translateX(${(-shift * window.innerWidth) / visibleStops}px)`;
  $("#more-collections").textContent = selectedCollection === collections.length - 1 ? "← Back to the beginning" : "Next collection →";
  $("#more-collections").hidden = false;
  if (routeSelection !== null) {
    selectCollection(routeSelection);
  } else if (chapter !== scrollChapter || selectedCollection < 0 || progress === 0) {
    selectCollection(chapter);
  }
  scrollChapter = chapter;
  $("#active-collection-title").textContent = revealed ? collections[selectedCollection].title : "A PHOTO ARCHIVE";
  $("#more-collections").textContent = selectedCollection === collections.length - 1 ? "← Back to the beginning" : "Next collection →";
  drawCord();
  document
    .querySelectorAll("[data-preview]")
    .forEach((button, i) => button.setAttribute("aria-expanded", String(revealed && i === selectedCollection)));
}
function drawCord() {
  const sheet = $(".screen-sheet");
  const preview = $("#preview-image");
  if (preview.naturalWidth && preview.naturalHeight) {
    // Fit the full photograph to the available window area, including upscaling
    // smaller film scans so their displayed size isn't capped by pixel dimensions.
    const available = sheet.getBoundingClientRect();
    const scale = Math.min(available.width / preview.naturalWidth, available.height / preview.naturalHeight);
    preview.style.width = `${preview.naturalWidth * scale}px`;
    preview.style.height = `${preview.naturalHeight * scale}px`;
  }
  const image = $("#preview-image").getBoundingClientRect();
  $(".screen-sheet").style.setProperty("--photo-width", `${image.width}px`);
  $(".screen-sheet").style.setProperty("--photo-height", `${image.height}px`);
  $(".preview-caption").style.setProperty("--caption-width", `${Math.max(image.width, Math.min(560, window.innerWidth * 0.84))}px`);
  const stop = document.querySelector(`[data-preview="${Math.max(0, selectedCollection)}"] .film-icon`).getBoundingClientRect();
  const caption = $(".preview-caption").getBoundingClientRect();
  const x = Math.min(window.innerWidth - 14, Math.max(image.right, caption.right) + 18);
  const y = image.top;
  const targetX = clamp(stop.left + stop.width / 2, 8, window.innerWidth - 8);
  const targetY = stop.top;
  $(".pull-cord").setAttribute("viewBox", `0 0 ${window.innerWidth} ${viewportHeight}`);
  $("#pull-cord-path").setAttribute(
    "d",
    `M ${image.right} ${y} L ${x} ${y} C ${x + 8} ${y + 70}, ${x - 6} ${targetY - 65}, ${x} ${targetY - 35} C ${x + 12} ${targetY - 10}, ${
      targetX + 35
    } ${targetY - 12}, ${targetX} ${targetY} c -14 10 -16 -12 -3 -7 c 13 5 2 14 -3 7`
  );
}
$("#preview-image").addEventListener("load", scheduleScroll);
function scheduleScroll() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
}
function sizeScene() {
  viewportHeight = window.innerHeight;
  $("#journey").style.height = `${viewportHeight + collections.length * scrollDistance}px`;
  $(".thread-belt").style.width = `${(Math.max(visibleStops, collections.length) / visibleStops) * 100}%`;
  $("#thread-collections").style.gridTemplateColumns = `repeat(${Math.max(visibleStops, collections.length)}, minmax(0, 1fr))`;
  scheduleScroll();
}
function revealCollection(index, smooth = true) {
  routeSelection = index;
  selectCollection(index);
  window.scrollTo({ top: (1 + index) * scrollDistance, behavior: smooth && !reducedMotion.matches ? "smooth" : "instant" });
  updateScroll();
}
function clearPreview() {
  routeSelection = null;
  window.scrollTo({ top: 0, behavior: "instant" });
  updateScroll();
}
function go(nextStep) {
  location.hash = nextStep === 0 ? "intro" : `series/${collections[nextStep - 1].id}`;
}
function openCollection(index) {
  opener = document.activeElement;
  galleryScroll = window.scrollY;
  location.hash = `collection/${collections[index].id}/1`;
}
function changePhoto(index) {
  const count = collections[activeCollection].photos.length;
  index = Math.max(0, Math.min(count - 1, index));
  location.hash = `collection/${collections[activeCollection].id}/${index + 1}`;
}
function renderGallery(index, frame) {
  const changedSeries = activeCollection !== index || !gallery.open;
  const previousIndex = photoIndex;
  activeCollection = index;
  const collection = collections[index];
  photoIndex = Math.max(0, Math.min(collection.photos.length - 1, frame));
  const photo = collection.photos[photoIndex];
  $("#gallery-title").textContent = collection.title;
  $("#gallery-statement").textContent = collection.statement;
  $("#gallery-details").textContent = [collection.years, collection.medium].filter(Boolean).join("\n");
  $("#gallery-series-number").textContent = `COLLECTION / 00${index + 1}`;
  $("#gallery-path").textContent = `SELECTED / SERIES 00${index + 1}`;
  $("#gallery-image").src = `assets/${photo.src}`;
  $("#gallery-image").alt = photo.description;
  $("#photo-caption").textContent = String(photoIndex + 1).padStart(3, "0");
  $("#photo-location").textContent = photo.location;
  $("#sequence-label").textContent = `SEQUENCE / 001—00${collection.photos.length}`;
  $("#previous-photo").disabled = photoIndex === 0;
  $("#next-photo").disabled = photoIndex === collection.photos.length - 1;
  $("#next-collection").textContent = index === collections.length - 1 ? "Back to the beginning →" : "Next collection →";
  if (changedSeries) {
    $("#thumbnails").innerHTML = collection.photos
      .map((item, i) => `<button data-photo="${i}" aria-label="View photograph ${i + 1}"><img src="assets/${item.src}" alt="" /></button>`)
      .join("");
  }
  document.querySelectorAll("[data-photo]").forEach((button, i) => button.setAttribute("aria-current", String(i === photoIndex)));
  if (!gallery.open) {
    document.body.classList.add("gallery-open");
    gallery.showModal();
    gallery.scrollTop = 0;
    requestAnimationFrame(() => gallery.classList.add("visible"));
    $("#gallery-title").focus({ preventScroll: true });
  } else if (!reducedMotion.matches) {
    $("#gallery-image").animate(
      [
        { opacity: 0.25, transform: `translateX(${photoIndex >= previousIndex ? 16 : -16}px)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 400, easing: "ease-out" }
    );
  }
  $("#announcement").textContent = `${collection.title}. Photograph ${photoIndex + 1} of ${collection.photos.length}.`;
}
function closeGallery() {
  go(activeCollection + 1);
}
function route() {
  const parts = location.hash.slice(1).split("/");
  const index = collections.findIndex((collection) => collection.id === parts[1]);
  $("#collection-index").hidden = true;
  $("#index-toggle").setAttribute("aria-expanded", "false");
  if (parts[0] === "collection" && index >= 0) {
    revealCollection(index, false);
    renderGallery(index, (parseInt(parts[2], 10) || 1) - 1);
  } else {
    if (gallery.open) {
      gallery.classList.remove("visible");
      gallery.close();
      document.body.classList.remove("gallery-open");
      window.scrollTo({ top: galleryScroll, behavior: "instant" });
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    }
    if (parts[0] === "series" && index >= 0) revealCollection(index, false);
    else clearPreview();
  }
}

document.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-open]");
  const photoButton = event.target.closest("[data-photo]");
  if (openButton) openCollection(Number(openButton.dataset.open));
  if (photoButton) changePhoto(Number(photoButton.dataset.photo));
  if (!event.target.closest("#collection-index,#index-toggle")) {
    $("#collection-index").hidden = true;
    $("#index-toggle").setAttribute("aria-expanded", "false");
  }
});
$("#index-toggle").addEventListener("click", () => {
  const show = $("#collection-index").hidden;
  $("#collection-index").hidden = !show;
  $("#index-toggle").setAttribute("aria-expanded", String(show));
});
$("#close-gallery").addEventListener("click", closeGallery);
$("#previous-photo").addEventListener("click", () => changePhoto(photoIndex - 1));
$("#next-photo").addEventListener("click", () => changePhoto(photoIndex + 1));
$("#next-collection").addEventListener("click", () => go(activeCollection === collections.length - 1 ? 0 : activeCollection + 2));
gallery.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeGallery();
});
window.addEventListener("hashchange", route);
window.addEventListener("scroll", scheduleScroll, { passive: true });
window.addEventListener("resize", sizeScene);
window.addEventListener(
  "wheel",
  () => {
    if (!gallery.open) routeSelection = null;
  },
  { passive: true }
);
window.addEventListener(
  "touchstart",
  () => {
    if (!gallery.open) routeSelection = null;
  },
  { passive: true }
);
reducedMotion.addEventListener("change", scheduleScroll);
$("#begin-exploring").addEventListener("click", () => revealCollection(0));
$("#more-collections").addEventListener("click", () => {
  if (window.scrollY < scrollDistance * 0.65) revealCollection(0);
  else if (selectedCollection === collections.length - 1) clearPreview();
  else revealCollection(Math.max(0, selectedCollection + 1));
});
document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (["PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp", " "].includes(event.key) && !gallery.open) routeSelection = null;
  const threadStop = event.target.closest("[data-preview]");
  if (event.key === "Enter" && threadStop && !gallery.open) {
    event.preventDefault();
    openCollection(Number(threadStop.dataset.preview));
    return;
  }
  if (event.key === "Escape" && !gallery.open) {
    $("#collection-index").hidden = true;
    $("#index-toggle").setAttribute("aria-expanded", "false");
    if (event.target.closest("#collection-preview")) document.querySelector(`[data-preview="${selectedCollection}"]`)?.focus();
    clearPreview();
  }
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  const direction = event.key === "ArrowRight" ? 1 : -1;
  if (gallery.open) {
    event.preventDefault();
    changePhoto(photoIndex + direction);
  } else if (event.target.closest("#thread-collections")) {
    event.preventDefault();
    const index = (Number(event.target.closest("[data-preview]").dataset.preview) + direction + collections.length) % collections.length;
    document.querySelector(`[data-preview="${index}"]`).focus();
  }
});
function bindSwipe(element) {
  element.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length === 1) touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    },
    { passive: true }
  );
  element.addEventListener(
    "touchend",
    (event) => {
      if (!touchStart) return;
      const dx = event.changedTouches[0].clientX - touchStart.x;
      const dy = event.changedTouches[0].clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        const direction = dx < 0 ? 1 : -1;
        changePhoto(photoIndex + direction);
      }
    },
    { passive: true }
  );
}
// The hash chooses the entrance or collection, including after a reload.
history.scrollRestoration = "manual";
bindSwipe($(".main-photo"));
sizeScene();
route();
