import type { BarMapLabel } from './littoral-series';

export function createBarLabelElement(label: BarMapLabel, onActivate: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'bar-map-label bar-map-label-' + label.kind;
  element.dataset.barAnnotation = label.kind;
  element.dataset.annotationBar = label.id;
  element.setAttribute('aria-label', (label.kind === 'change' ? 'Barra ' + label.id + ' · ' + label.explanation.title : label.text) + ' · Explicación');
  element.setAttribute('aria-expanded', 'false');
  element.setAttribute('aria-controls', 'bar-marker-explanation');
  element.title = 'Toca para entender esta marca';
  if (label.color) { if (label.kind === 'change') element.style.borderBottomColor = label.color; else element.style.borderLeftColor = label.color; }
  const title = document.createElement('strong');
  title.textContent = label.text;
  const info = document.createElement('i');
  info.textContent = 'i'; info.setAttribute('aria-hidden', 'true');
  title.appendChild(info);
  element.appendChild(title);
  if (label.detail) { const detail = document.createElement('span'); detail.textContent = label.detail; element.appendChild(detail); }
  if (label.change) { const change = document.createElement('small'); change.textContent = label.change; element.appendChild(change); }
  element.addEventListener('click', (event) => { event.stopPropagation(); onActivate(); });
  return element;
}

/** Same safe, short explanation in both renderers; never inject source strings as HTML. */
export function createBarExplanationElement(label: BarMapLabel, onClose: () => void): HTMLElement {
  const article = document.createElement('article');
  article.id = 'bar-marker-explanation';
  article.className = 'bar-marker-explanation';
  article.dataset.barHelp = label.kind;
  article.dataset.helpBar = label.id;
  article.dataset.helpCut = label.explanation.cutId ?? '';
  article.setAttribute('role', 'region');
  article.setAttribute('aria-label', label.explanation.title);
  article.setAttribute('aria-live', 'polite');
  const header = document.createElement('header');
  const title = document.createElement('h3'); title.textContent = label.explanation.title;
  const close = document.createElement('button'); close.type = 'button'; close.className = 'bar-help-close'; close.textContent = '×'; close.setAttribute('aria-label', 'Cerrar explicación de la marca'); close.addEventListener('click', onClose);
  header.appendChild(title); header.appendChild(close); article.appendChild(header);
  const list = document.createElement('ul');
  for (const point of label.explanation.points) {
    const item = document.createElement('li');
    const caption = document.createElement('strong'); caption.textContent = point.label ? point.label + ' ' : '';
    item.appendChild(caption); item.appendChild(document.createTextNode(point.text)); list.appendChild(item);
  }
  article.appendChild(list);
  const details = document.createElement('details'); details.className = 'bar-help-science';
  const summary = document.createElement('summary'); summary.textContent = 'Datos científicos y fuente';
  const technical = document.createElement('p'); technical.textContent = label.explanation.technical;
  details.appendChild(summary); details.appendChild(technical);
  if (label.explanation.sourceUrl) {
    const link = document.createElement('a'); link.textContent = label.explanation.sourceLabel ?? 'Consultar fuente'; link.href = label.explanation.sourceUrl; link.target = '_blank'; link.rel = 'noreferrer'; details.appendChild(link);
  }
  if (label.explanation.baselineSourceUrl && label.explanation.baselineSourceUrl !== label.explanation.sourceUrl) {
    const reference = document.createElement('a'); reference.textContent = 'Producto de referencia de 2021'; reference.href = label.explanation.baselineSourceUrl; reference.target = '_blank'; reference.rel = 'noreferrer'; details.appendChild(reference);
  }
  if (['current', 'baseline', 'change'].includes(label.kind)) {
    const review = document.createElement('a'); review.textContent = 'Revisión de marea y oleaje'; review.href = '/data/littoral/hydrodynamic-review.md'; review.target = '_blank'; review.rel = 'noreferrer'; details.appendChild(review);
  }
  article.appendChild(details);
  return article;
}
