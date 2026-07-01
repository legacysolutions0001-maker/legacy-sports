export const connect = () => { throw new Error("tls not available in CF Workers runtime"); };
export class TLSSocket {
  constructor() { throw new Error("TLSSocket not available"); }
}
export default { connect, TLSSocket };
