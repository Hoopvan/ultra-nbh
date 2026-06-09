$env_content = Get-Content .env
foreach ($line in $env_content) {
    $parts = $line -split '=', 2
    $key = $parts[0].Trim()
    $val = $parts[1].Trim().Trim('"')
    Set-Variable -Name $key -Value $val
}

Write-Host "URL: $SUPABASE_URL"
Write-Host "KEY: $SUPABASE_ANON_KEY"

# Copie js/ -> js-local/ et substitue les credentials dans config.js
if (Test-Path js-local) { Remove-Item -Recurse -Force js-local }
Copy-Item -Recurse js js-local

$configContent = Get-Content js-local/config.js -Raw
$configContent = $configContent -replace '\{\{SUPABASE_URL\}\}', $SUPABASE_URL
$configContent = $configContent -replace '\{\{SUPABASE_ANON_KEY\}\}', $SUPABASE_ANON_KEY
Set-Content js-local/config.js $configContent

# index-local.html : pointe sur /js-local/main.js au lieu de /js/main.js
$content = Get-Content index.html -Raw
$content = $content -replace '/js/main\.js', '/js-local/main.js'
Set-Content index-local.html $content

Write-Host "Build OK - ouvre index-local.html avec un serveur local"
