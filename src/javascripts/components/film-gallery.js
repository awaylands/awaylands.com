const getEmbedUrl = source => {
  if (!source) {
    return null;
  }

  const youtubeMatch = source.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
  if (youtubeMatch) {
    return `https://www.youtube-nocookie.com/embed/${youtubeMatch[1]}?autoplay=1&rel=0&modestbranding=1`;
  }

  const vimeoMatch = source.match(/vimeo\.com\/(?:video\/)?([0-9]+)/i);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&title=0&byline=0&portrait=0&dnt=1`;
  }

  return null;
};

const initFilmGallery = () => {
  const gallery = document.querySelector('[data-film-gallery]');
  if (!gallery || gallery.dataset.filmGalleryReady === 'true') {
    return;
  }

  const modal = gallery.querySelector('[data-film-modal]');
  const stage = gallery.querySelector('[data-film-stage]');
  const modalTitle = gallery.querySelector('[data-film-modal-title]');
  const modalCategory = gallery.querySelector('[data-film-modal-category]');
  const modalMeta = gallery.querySelector('[data-film-modal-meta]');
  const closeButton = gallery.querySelector('[data-film-close]');
  let returnFocus = null;

  gallery.dataset.filmGalleryReady = 'true';

  gallery.querySelectorAll('[data-film-filter]').forEach(button => {
    button.addEventListener('click', () => {
      const category = button.dataset.filmFilter;

      gallery.querySelectorAll('[data-film-filter]').forEach(filter => {
        filter.classList.toggle('is-active', filter === button);
      });
      gallery.querySelectorAll('[data-film-item]').forEach(item => {
        item.hidden = category !== 'all' && item.dataset.filmCategory !== category;
      });
    });
  });

  const closePlayer = () => {
    if (!modal || !modal.classList.contains('is-open')) {
      return;
    }
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-film-player');
    stage.innerHTML = '';
    if (returnFocus) {
      returnFocus.focus();
    }
  };

  gallery.querySelectorAll('[data-film-open]').forEach(link => {
    link.addEventListener('click', event => {
      const embedUrl = getEmbedUrl(link.href);
      if (!embedUrl || !modal || !stage) {
        return;
      }

      event.preventDefault();
      returnFocus = link;

      const iframe = document.createElement('iframe');
      iframe.src = embedUrl;
      iframe.title = link.dataset.filmTitle || 'Away Lands film';
      iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      iframe.allowFullscreen = true;
      stage.innerHTML = '';
      stage.appendChild(iframe);

      modalTitle.textContent = link.dataset.filmTitle || '';
      modalCategory.textContent = link.dataset.filmCategoryName || 'Film';
      modalMeta.textContent = 'Now playing';
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('has-film-player');
      closeButton.focus();
    });
  });

  if (closeButton) {
    closeButton.addEventListener('click', closePlayer);
  }
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closePlayer();
    }
  });
};

export default initFilmGallery;
