$env_content = Get-Content .env
foreach ($line in $env_content) {
    $parts = $line -split '=', 2
    $key = $parts[0].Trim()
    $val = $parts[1].Trim().Trim('"')
    Set-Variable -Name $key -Value $val
}

Write-Host "URL: $SUPABASE_URL"
Write-Host "KEY: $SUPABASE_ANON_KEY"

$content = Get-Content index.html -Raw
$content = $content -replace '\{\{SUPABASE_URL\}\}', $SUPABASE_URL
$content = $content -replace '\{\{SUPABASE_ANON_KEY\}\}', $SUPABASE_ANON_KEY
Set-Content index-local.html $content

Write-Host "Build OK"