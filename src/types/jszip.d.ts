declare module 'jszip' {
  type JSZipAsyncType = 'string' | 'arraybuffer' | 'blob';

  interface JSZipFile {
    async<T extends JSZipAsyncType>(
      type: T,
    ): Promise<
      T extends 'string' ? string : T extends 'blob' ? Blob : ArrayBuffer
    >;
  }

  interface JSZipGenerateOptions {
    type: 'blob';
    compression?: 'STORE' | 'DEFLATE';
  }

  export default class JSZip {
    file(path: string): JSZipFile | null;
    file(path: string, data: string | Uint8Array | ArrayBuffer): this;
    generateAsync(options: JSZipGenerateOptions): Promise<Blob>;
    static loadAsync(data: ArrayBuffer): Promise<JSZip>;
  }
}
