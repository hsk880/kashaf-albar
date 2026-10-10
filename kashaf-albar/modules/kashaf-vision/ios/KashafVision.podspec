require 'json'
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))
Pod::Spec.new do |s|
  s.name = 'KashafVision'
  s.version = package['version']
  s.summary = 'Offline species recognition module for Kashaf Albar'
  s.description = 'Local image classification with Apple Vision and Core ML.'
  s.license = { :type => 'MIT' }
  s.author = 'Kashaf Albar'
  s.homepage = 'https://example.invalid/kashaf-albar'
  s.platform = :ios, '15.0'
  s.swift_version = '5.9'
  s.source = { :path => '.' }
  s.source_files = '**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
end
