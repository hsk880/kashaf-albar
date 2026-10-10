import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

export type RecognitionPrediction = { label: string; confidence: number };
export type RecognitionKind = 'plants' | 'animals' | 'birds';
export type RecognitionResult = {
  predictions: RecognitionPrediction[];
  engine: 'specialist-plants-coreml' | 'specialist-animals-coreml' | 'specialist-birds-coreml' | 'apple-vision-generic';
  speciesLevel: boolean;
  message: string;
};
type NativeResponse = { predictions: RecognitionPrediction[]; modelType: RecognitionResult['engine']; speciesLevel: boolean; message: string };
type KashafVisionNativeModule = {
  classifyImage(imageUri: string, kind: RecognitionKind): Promise<NativeResponse>;
  installModel(kind: RecognitionKind): Promise<{installed:boolean;model:string;classes:number;sizeBytes:number;message:string}>;
  modelStatus(kind: RecognitionKind): Promise<{installed:boolean;model:string;classes:number;sizeBytes:number;message?:string}>;
  removeModel(kind: RecognitionKind): Promise<boolean>;
};
let nativeModule: KashafVisionNativeModule | null = null;
function getNativeModule(): KashafVisionNativeModule {
  if (Platform.OS !== 'ios') throw new Error('محرك النماذج المحلي مهيأ حاليًا للآيفون فقط؛ يلزم دمج واختبار محرك Android منفصل.');
  if (!nativeModule) nativeModule = requireNativeModule<KashafVisionNativeModule>('KashafVision');
  return nativeModule;
}
export async function installRecognitionModel(kind: RecognitionKind) { return getNativeModule().installModel(kind); }
export async function recognitionModelStatus(kind: RecognitionKind) { return getNativeModule().modelStatus(kind); }
export async function removeRecognitionModel(kind: RecognitionKind) { return getNativeModule().removeModel(kind); }
export async function recognizeImageLocally(imageUri: string, kind: RecognitionKind = 'plants'): Promise<RecognitionResult> {
  const result = await getNativeModule().classifyImage(imageUri, kind);
  const predictions = (result.predictions ?? []).filter(item => typeof item.label === 'string' && Number.isFinite(item.confidence)).map(item => ({label:item.label,confidence:Math.max(0,Math.min(1,item.confidence))})).slice(0,5);
  return {predictions, engine: result.modelType, speciesLevel: result.speciesLevel === true, message: result.message || (predictions.length ? 'تم تحليل الصورة محليًا.' : 'لم يستطع النموذج تحديد تصنيف واضح.')};
}
