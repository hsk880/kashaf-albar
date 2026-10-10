// Native implementation is provided by KashafVisionModule.swift on Apple platforms.
export type NativePrediction = { label: string; confidence: number };
export type NativeRecognitionResponse = { predictions: NativePrediction[]; modelType: 'specialist-plants-iris' | 'specialist-coreml' | 'apple-vision-generic'; speciesLevel: boolean; message: string };
