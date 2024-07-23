export function debounce(fn: (...args: any[]) => void, delay: number) {
  let timeoutID: number | null = null;
  return function (...args: any[]) {
    if (timeoutID) {
      clearTimeout(timeoutID);
    }
    timeoutID = setTimeout(() => {
      fn(...args); // Directly calling the original function
      timeoutID = null;
    }, delay);
  };
}
