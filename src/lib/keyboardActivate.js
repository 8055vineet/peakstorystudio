// Makes a clickable non-button element (a card that is a whole `<div>`)
// behave like a button for keyboard users: Enter and Space activate it, the
// way they activate a real button. Pair with `role="button"` and
// `tabIndex={0}` on the element so it is focusable and announced as a
// control in the first place.
export function activateOnKey(handler) {
  return (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handler();
  };
}
