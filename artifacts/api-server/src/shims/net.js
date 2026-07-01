export const isIP = (input) => {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(input)) return 4;
  if (input.includes(':')) return 6;
  return 0;
};
export const isIPv4 = (input) => isIP(input) === 4;
export const isIPv6 = (input) => isIP(input) === 6;
export class Socket {
  constructor() { throw new Error("net.Socket not available in CF Workers runtime"); }
}
export const createConnection = () => { throw new Error("net not available"); };
export const connect = () => { throw new Error("net not available"); };
export default { isIP, isIPv4, isIPv6, Socket, createConnection, connect };
