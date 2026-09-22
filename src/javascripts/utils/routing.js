const imageBaseUrl = 'https://images.takeshape.io';

export function getImageUrl(imagePath) {
  const path = typeof imagePath === 'object' ? imagePath.path : imagePath;

  if (!path) {
    return '';
  }

  return `${imageBaseUrl}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function storyPath(story) {
  return `/story/${story.slug || slugify(story.title)}`;
}
