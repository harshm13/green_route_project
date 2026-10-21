param(
    [string]$Message = "Update GreenRoute codebase"
)

Write-Host "📦 Staging all files..." -ForegroundColor Cyan
git add .

Write-Host "💾 Committing changes: '$Message'..." -ForegroundColor Cyan
git commit -m $Message

Write-Host "🚀 Pushing to GitHub (origin/main)..." -ForegroundColor Green
git push origin main

Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
