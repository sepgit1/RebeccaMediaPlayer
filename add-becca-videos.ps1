# Script to add Becca Bear videos to the media player

$sourceDir = "C:\Users\solar\Desktop\beccaBear"
$targetDir = "c:\Users\solar\Desktop\media player\videos"

# Create videos directory if it doesn't exist
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
    Write-Host "✓ Created videos directory"
}

# Copy all MP4 files
$mp4Files = Get-ChildItem -Path $sourceDir -Filter "*.mp4"
$copiedCount = 0

foreach ($file in $mp4Files) {
    $targetPath = Join-Path $targetDir $file.Name
    Copy-Item -Path $file.FullName -Destination $targetPath -Force
    Write-Host "✓ Copied: $($file.Name)"
    $copiedCount++
}

Write-Host ""
Write-Host "✓ Successfully copied $copiedCount MP4 files!"
Write-Host "Videos are now in: $targetDir"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Reload your media player app (Ctrl+Shift+R for hard refresh)"
Write-Host "2. Upload the videos folder or refresh the app cache"
