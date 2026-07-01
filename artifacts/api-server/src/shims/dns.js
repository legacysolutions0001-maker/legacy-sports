export const lookup = (hostname, opts, cb) => {
  if (typeof opts === 'function') { cb = opts; }
  if (cb) cb(null, hostname, 4);
};
export const resolve = (hostname, cb) => { if (cb) cb(null, [hostname]); };
export const resolve4 = (hostname, cb) => { if (cb) cb(null, [hostname]); };
export default { lookup, resolve, resolve4 };
