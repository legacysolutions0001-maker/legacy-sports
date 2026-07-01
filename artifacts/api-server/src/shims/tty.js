export const isatty = () => false;
export class ReadStream {}
export class WriteStream {
  hasColors() { return false; }
}
export default { isatty, ReadStream, WriteStream };
