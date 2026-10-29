param([switch]$LoadConfigOnly)
$ErrorActionPreference = 'Stop'

$configPath = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path -LiteralPath $configPath)) {
    throw 'Chưa có .env. Sao chép .env.example sang .env rồi nhập thông tin MySQL.'
}
foreach ($line in Get-Content -LiteralPath $configPath -Encoding UTF8) {
    if ($line -match '^\s*(DB_HOST|DB_PORT|DB_NAME|DB_USERNAME|DB_PASSWORD|FRONTEND_ORIGINS|PRODUCT_IMAGE_DIR)\s*=(.*)$') {
        $configKey = $Matches[1]
        $configValue = $Matches[2].Trim()
        if ($configValue.Length -ge 2 -and (($configValue.StartsWith('"') -and $configValue.EndsWith('"')) -or ($configValue.StartsWith("'") -and $configValue.EndsWith("'")))) {
            $configValue = $configValue.Substring(1, $configValue.Length - 2)
        }
        [Environment]::SetEnvironmentVariable($configKey, $configValue, 'Process')
    }
}
if ($env:DB_HOST -eq 'mysql') {
    throw 'Chạy ngoài Docker: sửa DB_HOST=localhost trong .env.'
}
if ($LoadConfigOnly) { return }

$mavenCommand = Get-Command mvn.cmd -ErrorAction SilentlyContinue
if ($mavenCommand) { $mavenPath = $mavenCommand.Source }
else {
    $wrapperCache = Join-Path $env:USERPROFILE '.m2/wrapper/dists'
    $cachedMaven = Get-ChildItem -Path $wrapperCache -Filter mvn.cmd -Recurse -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $cachedMaven) { throw 'Chưa tìm thấy Maven. Cài Maven và thêm thư mục bin vào PATH.' }
    $mavenPath = $cachedMaven.FullName
}
Push-Location (Join-Path $PSScriptRoot 'backend')
try {
    & $mavenPath spring-boot:run
    if ($LASTEXITCODE -ne 0) { throw 'Backend chưa khởi động thành công. Kiểm tra log phía trên.' }
}
finally { Pop-Location }
