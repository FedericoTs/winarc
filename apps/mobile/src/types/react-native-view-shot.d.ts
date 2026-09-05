/**
 * Type shim for react-native-view-shot. The package ships its TypeScript
 * source as its types, and that source does not typecheck against this React
 * Native. Metro still bundles the real module; only the compiler sees this.
 */
export interface CaptureOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'jpg' | 'webm' | 'raw';
  quality?: number;
  result?: 'tmpfile' | 'base64' | 'data-uri' | 'zip-base64';
  snapshotContentContainer?: boolean;
  fileName?: string;
}
export function captureRef(view: unknown, options?: CaptureOptions): Promise<string>;
export function captureScreen(options?: CaptureOptions): Promise<string>;
export function releaseCapture(uri: string): void;
