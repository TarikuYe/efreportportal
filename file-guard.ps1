# file-guard.ps1
# Run this in a separate terminal alongside `npm run dev`.
# It monitors all .tsx/.ts files in app/ and components/ and
# instantly restores any file that gets wiped to 0 bytes.

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$watchPaths = @("app", "components", "lib")
$debounce = @{}

Write-Host "[file-guard] Watching for wiped files in: $($watchPaths -join ', ')" -ForegroundColor Cyan
Write-Host "[file-guard] Press Ctrl+C to stop." -ForegroundColor DarkGray

while ($true) {
    foreach ($dir in $watchPaths) {
        $fullDir = Join-Path $projectRoot $dir
        if (-not (Test-Path $fullDir)) { continue }

        Get-ChildItem -Recurse -Path $fullDir -Include "*.tsx","*.ts" |
            Where-Object { $_.Length -eq 0 } |
            ForEach-Object {
                $relPath = $_.FullName.Replace("$projectRoot\", "").Replace("\", "/")
                $lastRestore = $debounce[$relPath]

                # Avoid restoring the same file more than once per 5 seconds
                if ($null -eq $lastRestore -or ((Get-Date) - $lastRestore).TotalSeconds -gt 5) {
                    $debounce[$relPath] = Get-Date
                    Write-Host "[file-guard] WIPE DETECTED: $relPath - restoring from git..." -ForegroundColor Red
                    git -C $projectRoot checkout HEAD -- $relPath 2>&1 | Out-Null
                    Write-Host "[file-guard] RESTORED: $relPath" -ForegroundColor Green
                }
            }
    }
    Start-Sleep -Milliseconds 800
}
