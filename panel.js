const wrapper = document.querySelector("#wrapper");
const header = document.querySelector("#header");
const btnMinimize = document.querySelector("#btn-minimize");
const iconMinimize = document.querySelector("#minimize-icon");
const btnDark = document.querySelector("#btn-dark");
const iconDark = document.querySelector("#dark-icon");
const btnSave = document.querySelector("#btn-save");
const btnFullscreen = document.querySelector("#btn-fullscreen");
const iconFullscreen = document.querySelector("#fullscreen-icon");

let isPointerDown = false;
let offsetX = 0;
let offsetY = 0;

btnMinimize.addEventListener("click", (e) => {
  e.stopPropagation(); 
  const headerHeight = `${header.clientHeight}px`;
  if (!wrapper.style.height || wrapper.style.height !== headerHeight) {
    wrapper.style.height = headerHeight;
    wrapper.classList.add('overflow-hidden');
    iconMinimize.classList.remove('fa-minus');
    iconMinimize.classList.add('fa-plus');
  } else {
    wrapper.style.height = '';
    wrapper.classList.remove('overflow-hidden');
    iconMinimize.classList.remove('fa-plus');
    iconMinimize.classList.add('fa-minus');
  }
});

btnDark.addEventListener("click", () => {
  const html = document.documentElement;
  if (html.classList.contains('dark')) {
    html.classList.remove('dark');
    iconDark.classList.remove('fa-moon');
    iconDark.classList.add('fa-sun');
  } else {
    html.classList.add('dark');
    iconDark.classList.remove('fa-sun');
    iconDark.classList.add('fa-moon');
  }
});

// Fullscreen API Logic
btnFullscreen.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((err) => {
      console.log(`Error attempting to enable fullscreen: ${err.message}`);
    });
    iconFullscreen.classList.remove('fa-expand');
    iconFullscreen.classList.add('fa-compress');
  } else {
    document.exitFullscreen();
    iconFullscreen.classList.remove('fa-compress');
    iconFullscreen.classList.add('fa-expand');
  }
});

header.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  isPointerDown = true;
  const rect = wrapper.getBoundingClientRect();
  offsetX = e.clientX - rect.left;
  offsetY = e.clientY - rect.top;
  wrapper.style.transition = 'none';
  wrapper.classList.remove("left-2", "top-2", "md:left-5", "md:top-5"); 
  wrapper.style.margin = "0"; 
  wrapper.style.left = rect.left + "px";
  wrapper.style.top = rect.top + "px";
});

document.addEventListener("pointermove", (e) => {
  if (!isPointerDown) return;
  e.preventDefault();
  wrapper.style.left = (e.clientX - offsetX) + "px";
  wrapper.style.top = (e.clientY - offsetY) + "px";
});

document.addEventListener("pointerup", () => {
  if (isPointerDown) {
      isPointerDown = false;
      wrapper.style.transition = 'all 0.1s ease-in-out';
  }
});

btnSave.addEventListener("click", async () => {
    try {
        const module = await import('https://esm.sh/save-svg-as-png');
        const saveSvg = module.saveSvgAsPng || module.default.saveSvgAsPng || module.default;
        saveSvg(document.getElementById("freehand-canvas"), "image.png");
    } catch (e) {
        console.error("Export failed:", e);
        alert("Failed to export image. Check console.");
    }
});