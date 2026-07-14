import React from 'react';

const ORDER_HEADER_MARKER = 'À Cmd';
const INDEXED_INPUT_SELECTOR = 'tbody tr input[tabindex]';

const isOrderTable = (table: HTMLTableElement): boolean =>
  Array.from(table.querySelectorAll('th')).some(header =>
    (header.textContent ?? '').replace(/\s+/g, ' ').includes(ORDER_HEADER_MARKER)
  );

const getIndexedInputsByColumn = (table: HTMLTableElement): HTMLInputElement[][] => {
  const columns: HTMLInputElement[][] = [];

  table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach(row => {
    const rowInputs = Array.from(row.querySelectorAll<HTMLInputElement>('input[tabindex]'));
    rowInputs.forEach((input, columnIndex) => {
      if (!columns[columnIndex]) columns[columnIndex] = [];
      columns[columnIndex].push(input);
    });
  });

  return columns;
};

const isVisibleAndEnabled = (input: HTMLInputElement): boolean =>
  !input.disabled && input.getClientRects().length > 0;

const normalizeOrderTableTabIndexes = (): void => {
  document.querySelectorAll<HTMLTableElement>('table').forEach(table => {
    if (!isOrderTable(table)) return;

    let nextTabIndex = 1;
    getIndexedInputsByColumn(table).forEach(columnInputs => {
      columnInputs.forEach(input => {
        if (input.tabIndex !== nextTabIndex) input.tabIndex = nextTabIndex;
        nextTabIndex += 1;
      });
    });
  });
};

const OrderFieldNavigationGuard: React.FC = () => {
  React.useEffect(() => {
    let frameId: number | null = null;

    const scheduleNormalization = () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        frameId = null;
        normalizeOrderTableTabIndexes();
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      if (!(event.target instanceof HTMLInputElement)) return;

      const input = event.target;
      const table = input.closest('table');
      if (!(table instanceof HTMLTableElement) || !isOrderTable(table)) return;
      if (!input.matches(INDEXED_INPUT_SELECTOR)) return;

      normalizeOrderTableTabIndexes();
      const orderedVisibleInputs = getIndexedInputsByColumn(table)
        .flat()
        .filter(isVisibleAndEnabled);
      const currentIndex = orderedVisibleInputs.indexOf(input);
      const nextInput = currentIndex >= 0 ? orderedVisibleInputs[currentIndex + 1] : undefined;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (nextInput) {
        nextInput.focus();
        nextInput.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    };

    const observer = new MutationObserver(scheduleNormalization);
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', scheduleNormalization);
    scheduleNormalization();

    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', scheduleNormalization);
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, []);

  return null;
};

export default OrderFieldNavigationGuard;
