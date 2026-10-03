declare module '@mediapipe/camera_utils' {
  export class Camera {
    constructor(
      videoElement: HTMLVideoElement,
      options: {
        onFrame: () => Promise<void> | void;
        width?: number;
        height?: number;
      }
    );
    start(): Promise<void>;
    stop(): Promise<void>;
  }
}

declare module '@mediapipe/face_mesh' {
  export interface NormalizedLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
  }

  export interface Results {
    multiFaceLandmarks: NormalizedLandmark[][];
    image: HTMLVideoElement | HTMLCanvasElement | ImageBitmap;
  }

  export interface Options {
    maxNumFaces?: number;
    refineLandmarks?: boolean;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
    selfieMode?: boolean;
  }

  export class FaceMesh {
    constructor(config?: { locateFile?: (file: string) => string });
    setOptions(options: Options): void;
    onResults(callback: (results: Results) => void): void;
    send(input: { image: HTMLVideoElement | HTMLCanvasElement | ImageBitmap | ImageData }): Promise<void>;
    close(): Promise<void>;
  }
}
