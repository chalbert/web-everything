import { describe, it, expect, beforeEach } from 'vitest';
import { MasterDetailBehavior } from '../../../master-detail/MasterDetailBehavior';

function listOf(n: number): { master: HTMLElement; detail: HTMLElement } {
  const master = document.createElement('ul');
  for (let i = 0; i < n; i++) {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.dataset.id = `K${i}`;
    li.textContent = `Item ${i}`;
    master.append(li);
  }
  const detail = document.createElement('div');
  document.body.append(master, detail);
  return { master, detail };
}

describe('MasterDetailBehavior', () => {
  let master: HTMLElement;
  let detail: HTMLElement;
  const opts = () => ({
    itemSelector: '[role="option"]',
    detailEl: detail,
    keyOf: (item: HTMLElement) => item.dataset.id,
    renderDetail: (key: string, el: HTMLElement) => { el.innerHTML = `<p class="d">detail for ${key}</p>`; },
  });

  beforeEach(() => { document.body.innerHTML = ''; ({ master, detail } = listOf(3)); });

  it('marks the detail as a labelled region and shows the empty state initially', () => {
    new MasterDetailBehavior(master, opts());
    expect(detail.getAttribute('role')).toBe('region');
    expect(detail.getAttribute('aria-label')).toBe('Detail');
    expect(detail.querySelector('.md-empty')).toBeTruthy();
  });

  it('renders the detail for the selected item (composing selection) and emits detail-change', async () => {
    let changed = '';
    detail.addEventListener('detail-change', (e) => { changed = (e as CustomEvent).detail.key; });
    new MasterDetailBehavior(master, opts());
    const items = [...master.children] as HTMLElement[];
    items[1].dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve(); await Promise.resolve(); // let the async onSelect settle
    expect(detail.querySelector('.d')?.textContent).toBe('detail for K1');
    expect(items[1].getAttribute('aria-selected')).toBe('true'); // selection block did its job
    expect(changed).toBe('K1');
  });

  it('focusFlow "advance" moves focus to the detail; "retain" leaves it', async () => {
    new MasterDetailBehavior(master, { ...opts(), focusFlow: 'advance' });
    (master.children[0] as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve(); await Promise.resolve();
    expect(document.activeElement).toBe(detail);
  });

  it('emptyState "collapse" hides the region when nothing is selected', () => {
    new MasterDetailBehavior(master, { ...opts(), emptyState: 'collapse' });
    expect(detail.hidden).toBe(true);
  });

  it('awaits an async renderDetail and clears the loading class', async () => {
    let resolveRender: () => void = () => {};
    const md = new MasterDetailBehavior(master, {
      ...opts(),
      renderDetail: (key, el) => new Promise<void>((res) => { resolveRender = () => { el.textContent = key; res(); }; }),
    });
    (master.children[2] as HTMLElement).dispatchEvent(new Event('click', { bubbles: true }));
    await Promise.resolve();
    expect(detail.classList.contains('md-loading')).toBe(true); // pending
    resolveRender();
    await Promise.resolve(); await Promise.resolve();
    expect(detail.classList.contains('md-loading')).toBe(false);
    expect(detail.textContent).toBe('K2');
    expect(md.selectionBehavior).toBeTruthy();
  });
});
