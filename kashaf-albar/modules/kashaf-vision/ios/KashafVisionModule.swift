import ExpoModulesCore
import Vision
import CoreML
import ImageIO
import UIKit
import CryptoKit

public class KashafVisionModule: Module {
  private let modelLock = NSLock()
  private var cachedModels: [String: VNCoreMLModel] = [:]

  private struct RemoteFile: Decodable {
    let path: String
    let type: String?
    let size: Int?
    let lfs: LFS?
    struct LFS: Decodable { let oid: String? }
  }
  private struct ModelSpec {
    let id: String
    let repo: String
    let packageHint: String?
    let displayName: String
    let classes: Int
    let maxBytes: Int
  }
  private let specs: [String: ModelSpec] = [
    "plants": ModelSpec(id: "plants", repo: "wabibito/Onyx-PlantNet300K-CoreML", packageHint: nil, displayName: "PlantNet-300K Core ML", classes: 1081, maxBytes: 150_000_000),
    "animals": ModelSpec(id: "animals", repo: "camstack/camstack-models", packageHint: "animalClassification/animal-classifier/coreml/animal-classifier.mlpackage", displayName: "CamStack Animal Classifier", classes: 8, maxBytes: 100_000_000),
    "birds": ModelSpec(id: "birds", repo: "camstack/camstack-models", packageHint: "animalClassification/bird-classifier/coreml/bird-classifier.mlpackage", displayName: "AIY Birds V1 Core ML", classes: 965, maxBytes: 100_000_000)
  ]

  public func definition() -> ModuleDefinition {
    Name("KashafVision")
    AsyncFunction("installModel") { (kind: String) async throws -> [String: Any] in
      try await self.installModel(kind: kind)
    }
    AsyncFunction("modelStatus") { (kind: String) -> [String: Any] in
      return self.modelStatus(kind: kind)
    }
    AsyncFunction("removeModel") { (kind: String) throws -> Bool in
      try self.removeModel(kind: kind)
      return true
    }
    AsyncFunction("classifyImage") { (imageUri: String, kind: String) throws -> [String: Any] in
      return try self.classifyImage(imageUri: imageUri, kind: kind)
    }
  }

  private func normalizedKind(_ kind: String) throws -> String {
    guard specs[kind] != nil else { throw NSError(domain: "KashafVision", code: 1, userInfo: [NSLocalizedDescriptionKey: "نوع النموذج غير معروف."]) }
    return kind
  }
  private func modelDirectory() -> URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    return base.appendingPathComponent("KashafModels", isDirectory: true)
  }
  private func packageURL(kind: String) -> URL { modelDirectory().appendingPathComponent(kind == "plants" ? "PlantNet.mlpackage" : (kind == "birds" ? "Birds.mlpackage" : "Animals.mlpackage"), isDirectory: true) }
  private func compiledURL(kind: String) -> URL { modelDirectory().appendingPathComponent(kind == "plants" ? "PlantNet.mlmodelc" : (kind == "birds" ? "Birds.mlmodelc" : "Animals.mlmodelc"), isDirectory: true) }

  private func modelStatus(kind: String) -> [String: Any] {
    guard let k = try? normalizedKind(kind), let spec = specs[k] else { return ["installed": false, "message": "نوع النموذج غير معروف."] }
    let installed = FileManager.default.fileExists(atPath: compiledURL(kind: k).path) || FileManager.default.fileExists(atPath: packageURL(kind: k).appendingPathComponent("Manifest.json").path)
    return ["installed": installed, "model": spec.displayName, "classes": spec.classes, "sizeBytes": 0, "message": installed ? "النموذج موجود محليًا." : "النموذج غير مثبت."]
  }

  private func installModel(kind: String) async throws -> [String: Any] {
    let k = try normalizedKind(kind)
    guard let spec = specs[k] else { throw NSError(domain: "KashafVision", code: 2, userInfo: [NSLocalizedDescriptionKey: "إعداد النموذج غير موجود."]) }
    let fm = FileManager.default
    try fm.createDirectory(at: modelDirectory(), withIntermediateDirectories: true)
    if FileManager.default.fileExists(atPath: compiledURL(kind: k).path) {
      return ["installed": true, "model": spec.displayName, "classes": spec.classes, "sizeBytes": 0, "message": "النموذج مثبت مسبقًا."]
    }

    let treeURL = URL(string: "https://huggingface.co/api/models/\(spec.repo)/tree/main?recursive=true&expand=true")!
    var treeRequest = URLRequest(url: treeURL); treeRequest.timeoutInterval = 45
    let (treeData, treeResponse) = try await URLSession.shared.data(for: treeRequest)
    guard let treeHTTP = treeResponse as? HTTPURLResponse, (200...299).contains(treeHTTP.statusCode) else {
      throw NSError(domain: "KashafVision", code: 3, userInfo: [NSLocalizedDescriptionKey: "تعذر جلب قائمة ملفات النموذج من المصدر."])
    }
    let files = try JSONDecoder().decode([RemoteFile].self, from: treeData).filter { $0.type == "file" || $0.type == nil }
    let manifest: RemoteFile? = files.first { file in
      file.path.hasSuffix(".mlpackage/Manifest.json") && (spec.packageHint == nil || file.path.hasPrefix(spec.packageHint! + "/"))
    }
    guard let manifestFile = manifest, let range = manifestFile.path.range(of: ".mlpackage/Manifest.json") else {
      throw NSError(domain: "KashafVision", code: 4, userInfo: [NSLocalizedDescriptionKey: "لم يُعثر على ملف Manifest لنموذج Core ML في المستودع."])
    }
    let packageRoot = String(manifestFile.path.dropLast("/Manifest.json".count))
    let packageFiles = files.filter { $0.path.hasPrefix(packageRoot + "/") }
    guard !packageFiles.isEmpty, packageFiles.count < 500 else { throw NSError(domain: "KashafVision", code: 5, userInfo: [NSLocalizedDescriptionKey: "قائمة ملفات النموذج غير صالحة."]) }
    let totalBytes = packageFiles.reduce(0) { $0 + ($1.size ?? 0) }
    guard totalBytes > 0, totalBytes <= spec.maxBytes else { throw NSError(domain: "KashafVision", code: 6, userInfo: [NSLocalizedDescriptionKey: "حجم النموذج يتجاوز الحد المسموح أو لم يحدد المصدر حجمه."]) }

    let finalPackage = packageURL(kind: k)
    let staging = modelDirectory().appendingPathComponent("\(k).download.tmp", isDirectory: true)
    if fm.fileExists(atPath: staging.path) { try fm.removeItem(at: staging) }
    try fm.createDirectory(at: staging, withIntermediateDirectories: true)
    do {
      for file in packageFiles {
        let relative = String(file.path.dropFirst(packageRoot.count + 1))
        guard !relative.hasPrefix("/") && !relative.split(separator: "/").contains("..") else { throw NSError(domain: "KashafVision", code: 7, userInfo: [NSLocalizedDescriptionKey: "مسار ملف غير آمن داخل الحزمة."]) }
        let encodedPath = file.path.split(separator: "/").map { String($0).addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? String($0) }.joined(separator: "/")
        let remoteURL = URL(string: "https://huggingface.co/\(spec.repo)/resolve/main/\(encodedPath)?download=true")!
        var request = URLRequest(url: remoteURL); request.timeoutInterval = 90
        let (temp, response) = try await URLSession.shared.download(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else { throw NSError(domain: "KashafVision", code: 8, userInfo: [NSLocalizedDescriptionKey: "فشل تنزيل ملف من ملفات النموذج."]) }
        let data = try Data(contentsOf: temp)
        guard data.count <= spec.maxBytes else { throw NSError(domain: "KashafVision", code: 9, userInfo: [NSLocalizedDescriptionKey: "ملف النموذج أكبر من الحد المسموح."]) }
        if let expected = file.lfs?.oid, expected.hasPrefix("sha256:") {
          let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
          guard digest == String(expected.dropFirst(7)) else { throw NSError(domain: "KashafVision", code: 10, userInfo: [NSLocalizedDescriptionKey: "فشل التحقق من بصمة أحد ملفات النموذج."]) }
        }
        let dest = staging.appendingPathComponent(relative)
        try fm.createDirectory(at: dest.deletingLastPathComponent(), withIntermediateDirectories: true)
        try fm.copyItem(at: temp, to: dest)
      }
      let manifestURL = staging.appendingPathComponent("Manifest.json")
      guard fm.fileExists(atPath: manifestURL.path) else { throw NSError(domain: "KashafVision", code: 11, userInfo: [NSLocalizedDescriptionKey: "ملف Manifest غير موجود بعد التنزيل."]) }
      if fm.fileExists(atPath: finalPackage.path) { try fm.removeItem(at: finalPackage) }
      try fm.moveItem(at: staging, to: finalPackage)
      let compiled = try MLModel.compileModel(at: finalPackage)
      let finalCompiled = compiledURL(kind: k)
      if fm.fileExists(atPath: finalCompiled.path) { try fm.removeItem(at: finalCompiled) }
      try fm.moveItem(at: compiled, to: finalCompiled)
      // Smoke-load the model before reporting success.
      let config = MLModelConfiguration(); config.computeUnits = .all
      _ = try MLModel(contentsOf: finalCompiled, configuration: config)
      return ["installed": true, "model": spec.displayName, "classes": spec.classes, "sizeBytes": totalBytes, "message": "تم تنزيل النموذج والتحقق من ملفات الحزمة وتحميله محليًا. يلزم اختبار الدقة على الأنواع السعودية قبل الاعتماد عليه."]
    } catch {
      try? fm.removeItem(at: staging)
      throw error
    }
  }

  private func removeModel(kind: String) throws {
    let k = try normalizedKind(kind)
    for url in [packageURL(kind: k), compiledURL(kind: k)] where FileManager.default.fileExists(atPath: url.path) {
      try FileManager.default.removeItem(at: url)
    }
    modelLock.lock(); cachedModels.removeValue(forKey: k); modelLock.unlock()
  }

  private func classifyImage(imageUri: String, kind: String) throws -> [String: Any] {
    let k = try normalizedKind(kind)
    let imageURL = imageUri.hasPrefix("file://") ? (URL(string: imageUri) ?? URL(fileURLWithPath: imageUri)) : URL(fileURLWithPath: imageUri)
    guard FileManager.default.fileExists(atPath: imageURL.path) else { throw NSError(domain: "KashafVision", code: 12, userInfo: [NSLocalizedDescriptionKey: "لم يُعثر على ملف الصورة على الجهاز."]) }
    let modelURL = compiledURL(kind: k)
    guard FileManager.default.fileExists(atPath: modelURL.path) else {
      let handler = VNImageRequestHandler(url: imageURL, options: [:])
      let request = VNClassifyImageRequest(); 
      try handler.perform([request])
      let preds = (request.results ?? []).prefix(5).map { ["label": $0.identifier, "confidence": Double($0.confidence)] as [String: Any] }
      return ["predictions": preds, "modelType": "apple-vision-generic", "speciesLevel": false, "message": "النموذج المتخصص لهذه الفئة غير مثبت. هذه تصنيفات عامة وليست تحديدًا موثوقًا للنوع العلمي."]
    }
    let visionModel: VNCoreMLModel
    modelLock.lock()
    if let cached = cachedModels[k] { visionModel = cached; modelLock.unlock() }
    else {
      modelLock.unlock()
      let config = MLModelConfiguration(); config.computeUnits = .all
      let mlModel = try MLModel(contentsOf: modelURL, configuration: config)
      let loaded = try VNCoreMLModel(for: mlModel)
      modelLock.lock(); cachedModels[k] = loaded; modelLock.unlock()
      visionModel = loaded
    }
    let handler = VNImageRequestHandler(url: imageURL, options: [:])
    let request = VNCoreMLRequest(model: visionModel); 
    try handler.perform([request])
    let observations = (request.results as? [VNClassificationObservation] ?? []).prefix(5)
    let predictions = observations.map { ["label": $0.identifier, "confidence": Double($0.confidence)] as [String: Any] }
    let first = observations.first?.confidence ?? 0
    let second = observations.dropFirst().first?.confidence ?? 0
    let accepted = first >= 0.55 && (first - second) >= 0.08
    let name = specs[k]?.displayName ?? "نموذج محلي"
    return ["predictions": predictions, "modelType": k == "plants" ? "specialist-plants-coreml" : (k == "birds" ? "specialist-birds-coreml" : "specialist-animals-coreml"), "speciesLevel": accepted,
            "message": accepted ? "توقع من \(name). هذا النموذج عام وليس مُتحقق الدقة للأنواع السعودية؛ تأكد من مصدر متخصص." : "النتيجة غير مؤكدة. جرّب صورة أوضح أو صوّر تفاصيل إضافية."]
  }
}
