$ErrorActionPreference = "Stop"

$mediaRoot = $env:MEDIA_ROOT
if ([string]::IsNullOrWhiteSpace($mediaRoot)) {
    $mediaRoot = "$env:USERPROFILE\Developer\netflix-adaptive-stream-media"
}

New-Item -ItemType Directory -Force -Path "$mediaRoot\uploads" | Out-Null
New-Item -ItemType Directory -Force -Path "$mediaRoot\output" | Out-Null

Write-Host "Media directories ready at: $mediaRoot"
Write-Host "  uploads: $mediaRoot\uploads"
Write-Host "  output:  $mediaRoot\output"
