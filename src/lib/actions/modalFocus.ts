/** Contain focus in an overlay and temporarily disable its background. */
export function modalFocus(node: HTMLElement) {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const disabled: { node: HTMLElement; inert: boolean }[] = [];
  let branch: HTMLElement = node;
  while (branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (sibling !== branch && sibling instanceof HTMLElement) {
        disabled.push({ node: sibling, inert: sibling.inert });
        sibling.inert = true;
      }
    }
    branch = branch.parentElement;
  }
  const focusable = () => [...node.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]')]
    .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0 && !element.closest('[inert]'));
  (focusable()[0] ?? node).focus();
  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const items = focusable();
    const first = items[0] ?? node;
    const last = items.at(-1) ?? node;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === node)) {
      event.preventDefault(); first.focus();
    }
  }
  node.addEventListener('keydown', onKeydown);
  return { destroy() {
    node.removeEventListener('keydown', onKeydown);
    for (const item of disabled) item.node.inert = item.inert;
    if (previous?.isConnected) previous.focus();
  } };
}
