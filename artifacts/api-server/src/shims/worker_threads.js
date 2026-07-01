export class Worker extends EventTarget {
  constructor() { super(); throw new Error("Worker not available in CF Workers"); }
}
export const isMainThread = true;
export const parentPort = null;
export const workerData = null;
export const threadId = 0;
export const receiveMessageOnPort = () => null;
export const MessageChannel = class MessageChannel {};
export const MessagePort = class MessagePort {};
export default { Worker, isMainThread, parentPort, workerData, threadId };
