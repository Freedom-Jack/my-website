'use strict';
// Paints the scenes researcher's draft sketches into the wireframe strips, framed the way the round-4 spec says:
// wide (>= 1200 px): the whole scene, with mist swallowing whatever would sit under the title block;
// narrower: a crop centred on the scene's one focus (Home: the traveller; Work: the bridge).
(function () {
  const vw = document.documentElement.clientWidth;
  const wide = vw >= 1200;
  const D = Math.min(3, window.devicePixelRatio || 1);
  const info = (window.__strip = {});
  document.querySelectorAll('.strip[data-scene]').forEach((strip) => {
    const c = strip.querySelector('canvas');
    const W = strip.clientWidth, H = strip.clientHeight;
    const kind = strip.dataset.scene;
    const head = strip.parentElement.querySelector('.head');
    if (kind === 'work') {
      const fx = 813; // bridge centre in the 1440 x 560 world
      let x0, y0, opts = { colour: { mode: 'qinglu', k: 0.5, mistK: 0.5 } };
      if (wide) {
        x0 = STRIP.WW - W; // right edge of the scene at the right edge of the screen
        y0 = Math.min(STRIP.WH - H, 545 - H);
        const textRight = head.getBoundingClientRect().left + Math.min(580, head.scrollWidth) - strip.getBoundingClientRect().left;
        opts.mistLeft = [textRight + x0 - 140, textRight + x0 + 140]; // recompose by mist: nothing figurative under the text
        info.work = { textRight: Math.round(textRight), mistLeftScreen: [Math.round(textRight - 140), Math.round(textRight + 140)] };
      } else {
        x0 = Math.max(0, Math.min(STRIP.WW - W, fx - W * 0.5));
        y0 = Math.max(0, 548 - H);
      }
      STRIP.paintMarket(c, { x0, y0, w: W, h: H, dpr: Math.min(D, 2) }, opts);
      c.style.left = '0px'; c.style.top = '0px';
      info.workView = { x0: Math.round(x0), y0: Math.round(y0), W, H };
    } else if (kind === 'home') {
      // the colour study's row B (misted blue-green, traveller and hut) is 1440 x 300 world px
      STRIP.paintStudy(c, { mode: 'qinglu', k: 0.52, mistK: 0.55 }, { traveller: true });
      let s, left, top;
      if (wide) { s = Math.max(1, H / 330); left = W - 1440 * s; top = H - 300 * s; }
      else { s = vw < 640 ? 0.85 : 1.0; const tx = 1024, ty = 270; left = W * 0.62 - tx * s; top = H * 0.80 - ty * s; top = Math.max(H - 300 * s, Math.min(0, top)); }
      c.style.transformOrigin = '0 0'; c.style.transform = `scale(${s})`;
      c.style.left = left + 'px'; c.style.top = top + 'px';
      info.home = { scale: +s.toFixed(2), travellerPx: Math.round(16 * s / 1.0), W, H };
    }
  });
  document.documentElement.dataset.painted = '1';
})();
