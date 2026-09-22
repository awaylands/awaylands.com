export default function initDestinations3Postcards() {
  const root = document.querySelector('[data-d3-postcards]');
  if (!root || root.dataset.d3Ready === 'true') {
    return;
  }

  const cards = Array.prototype.slice.call(root.querySelectorAll('[data-d3-card]'));
  const prev = root.querySelector('[data-d3-prev]');
  const next = root.querySelector('[data-d3-next]');
  const interval = Number(root.dataset.d3Interval) || 10000;

  let active = 0;
  let timer;

  root.dataset.d3Ready = 'true';

  function updateCards() {
    cards.forEach((card, index) => {
      const offset = (index - active + cards.length) % cards.length;
      card.classList.toggle('is-active', offset === 0);
      card.setAttribute('data-d3-offset', offset);
    });
  }

  function schedule() {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      move('next');
    }, interval);
  }

  function move(direction) {
    if (!cards.length) {
      return;
    }

    active = direction === 'next' ?
      (active + 1) % cards.length :
      (active - 1 + cards.length) % cards.length;

    updateCards();
    schedule();
  }

  if (prev) {
    prev.addEventListener('click', event => {
      event.preventDefault();
      move('prev');
    });
  }

  if (next) {
    next.addEventListener('click', event => {
      event.preventDefault();
      move('next');
    });
  }

  updateCards();
  schedule();
}
