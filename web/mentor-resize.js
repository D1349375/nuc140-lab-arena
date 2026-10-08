'use strict';

function initMentorResize() {
  const panel = document.getElementById('right-panel');
  const board = document.getElementById('simulator-panel');
  const mentor = document.getElementById('mentor-panel');
  const divider = document.getElementById('mentor-divider');
  const preferences = {};
  for (const axis of ['column', 'row']) {
    const ratio = readStorage('nuc140:split:right:' + axis, null);
    preferences[axis] = Number.isFinite(ratio) && ratio > 0 && ratio < 1 ? ratio : null;
  }
  let drag = null;
  const axis = () => getComputedStyle(panel).flexDirection === 'row' ? 'row' : 'column';
  const extent = element => element.getBoundingClientRect()[axis() === 'row' ? 'width' : 'height'];
  const bounds = () => {
    const total = Math.max(0, extent(panel) - extent(divider));
    const row = axis() === 'row';
    const min = Math.min(row ? 200 : 160, total / 2);
    return { total, min, max: Math.max(min, total - Math.min(row ? 200 : 140, total / 2)) };
  };
  const applySize = size => {
    const limits = bounds();
    size = Math.round(Math.max(limits.min, Math.min(limits.max, size)));
    if (!panel.classList.contains('has-split')) panel.classList.add('has-split');
    board.style.flexBasis = size + 'px';
    divider.setAttribute('aria-valuemin', Math.round(limits.min / limits.total * 100));
    divider.setAttribute('aria-valuemax', Math.round(limits.max / limits.total * 100));
    divider.setAttribute('aria-valuenow', Math.round(size / limits.total * 100));
    divider.setAttribute('aria-valuetext', `模擬板占 ${Math.round(size / limits.total * 100)}%，其餘為 AI 導師`);
    return limits.total ? size / limits.total : 0.5;
  };
  const clearSize = () => {
    if (panel.classList.contains('has-split')) panel.classList.remove('has-split');
    board.style.flexBasis = '';
  };
  const finish = event => {
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    const previous = drag;
    drag = null;
    if (divider.hasPointerCapture(previous.pointerId)) divider.releasePointerCapture(previous.pointerId);
    divider.classList.remove('dragging');
    document.body.classList.remove('resizing-mentor');
    document.body.style.removeProperty('--mentor-resize-cursor');
    writeStorage('nuc140:split:right:' + previous.axis, preferences[previous.axis]);
  };
  const refresh = () => {
    const unavailable = board.classList.contains('is-collapsed') || mentor.classList.contains('is-collapsed');
    divider.hidden = unavailable;
    if (unavailable || !extent(panel)) {
      finish();
      clearSize();
      return;
    }
    const direction = axis(), horizontal = direction === 'column';
    if (drag && drag.axis !== direction) finish();
    divider.setAttribute('aria-orientation', horizontal ? 'horizontal' : 'vertical');
    divider.title = `${horizontal ? '上下' : '左右'}拖曳調整大小；雙擊恢復預設，也可用方向鍵調整`;
    clearSize();
    const { total, min, max } = bounds();
    const preferred = preferences[direction];
    const current = extent(board);
    if (preferred !== null || current < min || current > max) applySize(preferred !== null ? preferred * total : current);
    else {
      divider.setAttribute('aria-valuemin', Math.round(min / total * 100));
      divider.setAttribute('aria-valuemax', Math.round(max / total * 100));
      divider.setAttribute('aria-valuenow', Math.round(current / total * 100));
      divider.setAttribute('aria-valuetext', `模擬板占 ${Math.round(current / total * 100)}%，其餘為 AI 導師`);
    }
  };
  divider.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || drag || divider.hidden) return;
    event.preventDefault();
    const direction = axis();
    drag = { pointerId: event.pointerId, axis: direction, start: direction === 'row' ? event.clientX : event.clientY, size: extent(board) };
    divider.setPointerCapture(event.pointerId);
    divider.classList.add('dragging');
    document.body.classList.add('resizing-mentor');
    document.body.style.setProperty('--mentor-resize-cursor', direction === 'row' ? 'col-resize' : 'row-resize');
  });
  divider.addEventListener('pointermove', event => {
    if (drag?.pointerId !== event.pointerId) return;
    const position = drag.axis === 'row' ? event.clientX : event.clientY;
    preferences[drag.axis] = applySize(drag.size + position - drag.start);
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) divider.addEventListener(event, finish);
  divider.addEventListener('keydown', event => {
    const direction = axis();
    const moves = direction === 'row' ? { ArrowLeft: -1, ArrowRight: 1 } : { ArrowUp: -1, ArrowDown: 1 };
    if (!(event.key in moves) && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const limits = bounds();
    const next = event.key === 'Home' ? limits.min : event.key === 'End' ? limits.max : extent(board) + moves[event.key] * (event.shiftKey ? 50 : 10);
    preferences[direction] = applySize(next);
    writeStorage('nuc140:split:right:' + direction, preferences[direction]);
  });
  divider.addEventListener('dblclick', () => {
    preferences[axis()] = null;
    writeStorage('nuc140:split:right:' + axis(), null);
    refresh();
  });
  new ResizeObserver(refresh).observe(panel);
  let collapseState = '';
  new MutationObserver(() => {
    const state = String(board.classList.contains('is-collapsed')) + '/' + String(mentor.classList.contains('is-collapsed'));
    if (state === collapseState) return;
    collapseState = state;
    refresh();
  }).observe(panel, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', refresh);
  refresh();
}
