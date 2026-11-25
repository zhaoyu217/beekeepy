# Windows PowerShell 5.1+; local-only QA, no system cleanup, no data deletion.
# Requires private commercial/.env.local file created explicitly by operator.
$ErrorActionPreference='Stop'
$work = Split-Path -Parent $MyInvocation.MyCommand.Path
$settings=Join-Path $work '.env.local'
if(-not (Test-Path -LiteralPath $settings)) { throw '缺少 .env.local；请先按 commercial/deployment/LOCAL_SETUP_CN.md 配置，禁止使用默认密码。' }
Get-Content -LiteralPath $settings -Encoding UTF8 | ForEach-Object {
  $line=$_.Trim()
  if($line -eq '' -or $line.StartsWith('#')) { return }
  $pos=$line.IndexOf('=')
  if($pos -lt 1) { throw '配置文件存在非法行。' }
  $key=$line.Substring(0,$pos).Trim();$value=$line.Substring($pos+1)
  if($key -notmatch '^(BEE_|SUPABASE_|STRIPE_)[A-Z0-9_]+$') { throw "不允许的环境变量名: $key" }
  Set-Item -Path ("Env:"+$key) -Value $value
}
if(-not (Get-Command node -ErrorAction SilentlyContinue)){throw '没有找到 Node.js 22。'}
Push-Location $work
try {
  Write-Host '仅在本机 127.0.0.1 启动隔离 QA。不会访问真实支付平台，除非你主动设置 Stripe API 密钥。'
  node .\server\app.mjs
} finally { Pop-Location }
