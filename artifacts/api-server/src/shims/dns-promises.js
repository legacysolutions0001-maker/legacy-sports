export const lookup = (hostname, opts) => {
  return Promise.resolve({ address: hostname, family: 4 });
};
export const resolve = (hostname) => Promise.resolve([hostname]);
export const resolve4 = (hostname) => Promise.resolve([hostname]);
export const resolve6 = (hostname) => Promise.resolve([]);
export default { lookup, resolve, resolve4, resolve6 };
