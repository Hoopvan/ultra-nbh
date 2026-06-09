$env_content = Get-Content .env
foreach ($line in $env_content) {
    $parts = $line -split '=', 2
    $key = $parts[0].Trim()
    $val = $parts[1].Trim().Trim('"')
    Set-Variable -Name $key -Value $val
}

Write-Host "URL: $SUPABASE_URL"
Write-Host "KEY: $SUPABASE_ANON_KEY"

# Génère js-local/config.js avec les credentials substitués (gitignorée).
# Les autres modules dans js/ restent servis tels quels.
New-Item -ItemType Directory -Force -Path js-local | Out-Null
$configContent = Get-Content js/config.js -Raw
$configContent = $configContent -replace '\{\{SUPABASE_URL\}\}', $SUPABASE_URL
$configContent = $configContent -replace '\{\{SUPABASE_ANON_KEY\}\}', $SUPABASE_ANON_KEY
Set-Content js-local/config.js $configContent

# index-local.html : import map qui redirige /js/config.js → /js-local/config.js
$content = Get-Content index.html -Raw
$importMap = '<script type="importmap">{"imports":{"/js/config.js":"/js-local/config.js"}}</script>'
$content = $content -replace '(<script type="module")', "$importMap`n`$1"
Set-Content index-local.html $content

Write-Host "Build OK - ouvre index-local.html avec un serveur local"
