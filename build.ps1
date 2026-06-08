$env_content = Get-Content .env
foreach ($line in $env_content) {
    $parts = $line -split '=', 2
    $key = $parts[0].Trim()
    $val = $parts[1].Trim().Trim('"')
    Set-Variable -Name $key -Value $val
}

Write-Host "URL: $SUPABASE_URL"
Write-Host "KEY: $SUPABASE_ANON_KEY"

# app.js contient les placeholders {{SUPABASE_URL}}/{{SUPABASE_ANON_KEY}} :
# on écrit une copie locale substituée (gitignorée, comme index-local.html).
$appContent = Get-Content app.js -Raw
$appContent = $appContent -replace '\{\{SUPABASE_URL\}\}', $SUPABASE_URL
$appContent = $appContent -replace '\{\{SUPABASE_ANON_KEY\}\}', $SUPABASE_ANON_KEY
Set-Content app-local.js $appContent

# index-local.html pointe vers cette copie locale au lieu de app.js
$content = Get-Content index.html -Raw
$content = $content -replace '/app\.js', '/app-local.js'
Set-Content index-local.html $content

Write-Host "Build OK"