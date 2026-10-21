param(
    [string]$Message = "Update GreenRoute codebase"
)

Write-Host "[1/3] Staging files..." -ForegroundColor Cyan
git add .

Write-Host "[2/3] Committing changes: $Message..." -ForegroundColor Cyan
git commit -m "$Message"

Write-Host "[3/3] Pushing to GitHub (origin/main)..." -ForegroundColor Green
git push origin main

Write-Host "Done! Successfully pushed to GitHub." -ForegroundColor Green
