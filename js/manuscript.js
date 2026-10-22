(() => {
  'use strict';
  const sourceSpreads = window.BOOK_SPREADS;
  let spreads = [], sourceFirst = [];
  const $ = id => document.getElementById(id);
  const intro = $('intro'), reader = $('reader'), book = $('book'), shell = $('bookShell');
  const left = $('leftPage'), right = $('rightPage');
  const toc = $('tocPanel');
  const mobileQuery = matchMedia('(max-width: 479px)');
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0, side = 0, opening = false, opened = false, turning = false, activeAnimation = null;
  let turnToken = 0;
  const roman = ['I', 'II', 'III', 'IV'];
  const chapterStarts = [2, 4, 6, 8];
  const normalize = n => String(n).padStart(2, '0');

  function paginate(html, measure) {
    const source = document.createElement('div');
    source.innerHTML = html;
    const pages = [];
    measure.replaceChildren();
    const fits = () => measure.scrollHeight <= measure.clientHeight + 1;
    const save = () => { if (measure.childNodes.length) pages.push(measure.innerHTML); measure.replaceChildren(); };
    function split(node, offset) {
      const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let text, remaining = offset;
      while ((text = walk.nextNode())) {
        if (remaining <= text.length) break;
        remaining -= text.length;
      }
      if (!text) return [node.cloneNode(true), null];
      const head = document.createRange(), tail = document.createRange();
      head.selectNodeContents(node); head.setEnd(text, remaining);
      tail.selectNodeContents(node); tail.setStart(text, remaining);
      const a = node.cloneNode(false), b = node.cloneNode(false);
      a.append(head.cloneContents()); b.append(tail.cloneContents());
      if (node.matches('.dropcap')) b.classList.add('continued-paragraph');
      return [a, b.textContent.trim() ? b : null];
    }
    const queue = [...source.children];
    while (queue.length) {
      const node = queue.shift();
      measure.append(node);
      if (node.matches('.cover-manuscript,.chapter-card')) {
        for (let scale = .95; !fits() && scale >= .2; scale -= .05) node.style.zoom = scale.toFixed(2);
      }
      if (fits()) continue;
      node.remove();
      const words = [...node.textContent.matchAll(/\s+/g)].map(m => m.index + m[0].length);
      const canSplit = /^(P|UL|OL|DIV)$/.test(node.tagName) && !node.matches('.cover-manuscript,.chapter-card,.rule,.ornament,.paper-grid');
      if (canSplit && words.length > 8) {
        let lo = 0, hi = words.length - 1, best = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const [part] = split(node, words[mid]);
          measure.append(part);
          const ok = fits(); part.remove();
          if (ok) { best = mid; lo = mid + 1; } else hi = mid - 1;
        }
        if (best >= 6) {
          const [head, tail] = split(node, words[best]);
          measure.append(head); save();
          if (tail) queue.unshift(tail);
          continue;
        }
      }
      if (measure.children.length) { save(); queue.unshift(node); }
      else { measure.append(node); save(); }
    }
    save();
    return pages.length ? pages : [''];
  }

  function repaginate() {
    const remembered = spreads[current]?.sourceIndex || 0;
    const probe = left.cloneNode(false);
    probe.removeAttribute('id');
    probe.className = 'page pagination-probe';
    probe.style.cssText = `position:fixed;left:-20000px;top:0;display:block;width:${book.clientWidth / (mobileQuery.matches ? 1 : 2)}px;height:${book.clientHeight}px;visibility:hidden;pointer-events:none`;
    const measure = document.createElement('div'); measure.className = 'content'; probe.append(measure); document.body.append(probe);
    spreads = []; sourceFirst = [];
    sourceSpreads.forEach((source, sourceIndex) => {
      sourceFirst.push(spreads.length);
      const leftPages = paginate(source.left, measure), rightPages = paginate(source.right, measure);
      const entries = [];
      if (/chapter-illus/.test(source.right)) {
        entries.push({ html: leftPages.shift(), origin: 'left' }, { html: rightPages.shift(), origin: 'right' });
      }
      entries.push(...leftPages.map(html => ({ html, origin: 'left' })), ...rightPages.map(html => ({ html, origin: 'right' })));
      for (let i = 0; i < entries.length; i += 2) {
        spreads.push({ title: source.title, sourceIndex, left: entries[i].html, right: entries[i + 1]?.html || '',
          origins: [entries[i].origin, entries[i + 1]?.origin || 'blank'] });
      }
    });
    probe.remove();
    current = sourceFirst[remembered]; side = 0;
    render();
    $('tocLinks').querySelectorAll('[data-spread]').forEach(button => {
      button.querySelector('small').textContent = normalize(sourceFirst[Number(button.dataset.spread)] * 2 + 1);
    });
  }

  function fill(page, spreadIndex, pageSide) {
    const content = page.querySelector('.content');
    content.innerHTML = spreads[spreadIndex][pageSide ? 'right' : 'left'];
    content.dataset.origin = `${spreads[spreadIndex].sourceIndex}:${spreads[spreadIndex].origins[pageSide]}`;
    content.scrollTop = 0;
    for (const frame of content.querySelectorAll('.chapter-illus')) {
      const match = /url\(["']?([^"')]+)["']?\)/.exec(frame.style.backgroundImage);
      if (!match) continue;
      const img = new Image();
      img.src = match[1];
      img.alt = `Illustration de ${spreads[spreadIndex].title}`;
      img.decoding = 'async';
      img.loading = 'eager';
      frame.style.backgroundImage = 'none';
      frame.append(img);
    }
    page.querySelector('.folio').textContent = normalize(spreadIndex * 2 + pageSide + 1);
  }

  function updateChrome() {
    const index = current * 2 + (mobileQuery.matches ? side : 0);
    $('prevBtn').disabled = index === 0;
    $('nextBtn').disabled = mobileQuery.matches ? index === spreads.length * 2 - 1 : current === spreads.length - 1;
    $('leftEdge').disabled = $('prevBtn').disabled;
    $('rightEdge').disabled = $('nextBtn').disabled;
    $('chapterIndicator').textContent = spreads[current].title;
    $('counter').textContent = mobileQuery.matches ? `FOLIO ${normalize(index + 1)} / ${normalize(spreads.length * 2)}`
      : `FOLIOS ${normalize(index + 1)} — ${normalize(index + 2)}`;
    $('progressBar').style.width = `${(index + (mobileQuery.matches ? 1 : 2)) / (spreads.length * 2) * 100}%`;
    document.querySelectorAll('[data-spread]').forEach(button => {
      const n = Number(button.dataset.spread);
      const isChapter = button.closest('.chapter-rail');
      const source = spreads[current].sourceIndex;
      const active = source === n || (isChapter && source === n + 1);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    book.dataset.spread = String(spreads[current].sourceIndex);
    book.dataset.sheet = String(current);
    book.dataset.side = String(side);
    book.setAttribute('aria-label', spreads[current].title);
  }

  function render() {
    fill(left, current, 0);
    fill(right, current, 1);
    left.classList.toggle('active-mobile', side === 0);
    right.classList.toggle('active-mobile', side === 1);
    left.inert = mobileQuery.matches && side !== 0;
    right.inert = mobileQuery.matches && side !== 1;
    updateChrome();
    // Only the neighboring illustration is warmed, never all chapter images.
    const next = spreads[current + 1]?.right.match(/url\(['"]?([^'"\)]+)/);
    if (next) { const img = new Image(); img.src = next[1]; }
  }

  function turnFace(source, name) {
    const face = source.cloneNode(true);
    face.removeAttribute('id');
    face.removeAttribute('inert');
    face.className = `turn-face page ${name}`;
    face.setAttribute('aria-hidden', 'true');
    face.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    return face;
  }

  async function navigate(target, targetSide = 0) {
    if (!opened || turning || target < 0 || target >= spreads.length) return;
    if (target === current && targetSide === side) return;
    if (motionQuery.matches) {
      current = target; side = targetSide; render(); return;
    }
    turning = true;
    window.dispatchEvent(new Event('zaoki:turn'));
    const token = ++turnToken;
    const forward = target * 2 + targetSide > current * 2 + side;
    const leaf = document.createElement('div');
    leaf.className = `turn-leaf ${forward ? 'forward' : 'backward'}`;
    leaf.setAttribute('aria-hidden', 'true');
    let front, back;
    if (mobileQuery.matches) {
      front = turnFace(side === 0 ? left : right, 'front');
      back = turnFace(targetSide === 0 ? left : right, 'back');
      fill(back, target, targetSide);
      fill(targetSide === 0 ? left : right, target, targetSide);
      left.classList.toggle('active-mobile', targetSide === 0);
      right.classList.toggle('active-mobile', targetSide === 1);
    } else {
      front = turnFace(forward ? right : left, 'front');
      back = turnFace(forward ? left : right, 'back');
      fill(back, target, forward ? 0 : 1);
      fill(forward ? right : left, target, forward ? 1 : 0);
    }
    leaf.append(front, back);
    book.append(leaf);
    shell.classList.add('turning');
    const angle = forward ? -180 : 180;
    activeAnimation = leaf.animate([
      { transform: 'rotateY(0deg)', filter: 'brightness(1)' },
      { transform: `rotateY(${angle * .48}deg)`, filter: 'brightness(.76)', offset: .52 },
      { transform: `rotateY(${angle}deg)`, filter: 'brightness(1)' }
    ], { duration: mobileQuery.matches ? 540 : 760, easing: 'cubic-bezier(.32,.05,.24,1)', fill: 'forwards' });
    try { await activeAnimation.finished; } catch { /* Resize cancels the old leaf. */ }
    leaf.remove();
    if (token !== turnToken) return;
    current = target; side = targetSide;
    turning = false; activeAnimation = null;
    shell.classList.remove('turning');
    render();
  }

  function step(direction) {
    if (mobileQuery.matches) {
      const index = current * 2 + side + direction;
      if (index >= 0 && index < spreads.length * 2) navigate(Math.floor(index / 2), index % 2);
    } else navigate(current + direction);
  }

  function finishOpening() {
    if (opened) return;
    opened = true;
    reader.inert = false;
    window.dispatchEvent(new Event('zaoki:opened'));
    document.body.classList.remove('is-closed');
    intro.classList.add('hide');
    book.tabIndex = -1;
    book.focus({ preventScroll: true });
    setTimeout(() => intro.remove(), 850);
  }

  function open() {
    if (opening) return;
    opening = true;
    intro.classList.add('opening');
    const animation = window.zaokiHand?.play();
    if (animation) animation.then(finishOpening, finishOpening);
    else {
      window.zaokiHand?.dispose();
      setTimeout(finishOpening, motionQuery.matches ? 220 : 2050);
    }
    // The reading experience remains reachable even after an unexpected renderer failure.
    setTimeout(finishOpening, 4700);
  }

  function showToc() {
    if (!opened) return;
    toc.showModal();
  }

  $('tocLinks').innerHTML = sourceSpreads.map((spread, i) =>
    `<button type="button" data-spread="${i}"><span>${spread.navTitle}</span><small>${normalize(i * 2 + 1)}</small></button>`).join('');
  document.querySelectorAll('[data-spread]').forEach(button => button.addEventListener('click', () => {
    if (toc.open) toc.close();
    navigate(sourceFirst[Number(button.dataset.spread)]);
  }));
  $('closedBook').addEventListener('click', open);
  $('closedBook').addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
  });
  $('titleLink').addEventListener('click', event => { event.preventDefault(); navigate(0); });
  $('prevBtn').addEventListener('click', () => step(-1));
  $('nextBtn').addEventListener('click', () => step(1));
  $('leftEdge').addEventListener('click', () => step(-1));
  $('rightEdge').addEventListener('click', () => step(1));
  $('tocBtn').addEventListener('click', showToc);
  $('ribbonToc').addEventListener('click', showToc);
  $('closeToc').addEventListener('click', () => toc.close());
  toc.addEventListener('click', event => { if (event.target === toc) {
    const r = toc.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) toc.close();
  }});
  $('closeBook').addEventListener('click', () => location.reload());
  window.addEventListener('keydown', event => {
    if (!opened || toc.open || event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
  });
  let touch = null;
  book.addEventListener('touchstart', event => {
    const p = event.changedTouches[0]; touch = { x: p.clientX, y: p.clientY };
  }, { passive: true });
  book.addEventListener('touchend', event => {
    if (!touch) return;
    const p = event.changedTouches[0], dx = p.clientX - touch.x, dy = p.clientY - touch.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    touch = null;
  }, { passive: true });
  book.addEventListener('touchcancel', () => { touch = null; }, { passive: true });
  mobileQuery.addEventListener('change', () => {
    ++turnToken;
    activeAnimation?.cancel();
    activeAnimation = null; turning = false;
    book.querySelectorAll('.turn-leaf').forEach(leaf => leaf.remove());
    shell.classList.remove('turning');
    side = 0; repaginate();
  });
  shell.addEventListener('pointermove', event => {
    if (mobileQuery.matches || motionQuery.matches || turning || event.pointerType !== 'mouse') return;
    const r = shell.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width - .5;
    const y = (event.clientY - r.top) / r.height - .5;
    shell.style.transform = `rotateX(${3 - y * 1.1}deg) rotateY(${x * 1.4}deg)`;
  });
  shell.addEventListener('pointerleave', () => { shell.style.transform = ''; });
  let resizeTimer, lastSize = '';
  const observer = new ResizeObserver(() => {
    const size = `${book.clientWidth}:${book.clientHeight}`;
    if (size === lastSize) return;
    lastSize = size;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      ++turnToken; activeAnimation?.cancel(); turning = false;
      book.querySelectorAll('.turn-leaf').forEach(leaf => leaf.remove());
      shell.classList.remove('turning');
      repaginate();
    }, 120);
  });
  repaginate();
  observer.observe(book);
})();
