export class AsyncLocalStorage {
  getStore() { return undefined; }
  run(store, callback, ...args) { return callback(...args); }
  enterWith() {}
  disable() {}
}
export class AsyncResource {
  constructor() {}
  bind(fn) { return fn; }
  runInAsyncScope(fn, thisArg, ...args) { return fn.apply(thisArg, args); }
}
export const createHook = () => ({ enable() {}, disable() {} });
export const executionAsyncId = () => 0;
export const triggerAsyncId = () => 0;
export default { AsyncLocalStorage, AsyncResource, createHook, executionAsyncId, triggerAsyncId };
