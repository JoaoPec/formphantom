# Script para empacotar a extensão FormPhantom em um arquivo .zip
# pronto para envio à Chrome Web Store.

$ErrorActionPreference = "Stop"

# Lê a versão do manifest.json
$manifest = Get-Content -Raw -Path "manifest.json" | ConvertFrom-Json
$version = $manifest.version

# Define nome do arquivo e pasta de saída
$distFolder = "dist"
$outputFile = "$distFolder\formphantom-v$version.zip"

# Cria a pasta dist se não existir
if (-not (Test-Path -Path $distFolder)) {
    New-Item -ItemType Directory -Path $distFolder | Out-Null
}

# Remove o zip anterior, se existir
if (Test-Path -Path $outputFile) {
    Remove-Item -Path $outputFile -Force
}

# Arquivos e pastas que fazem parte da extensão
$itemsToInclude = @(
    "manifest.json",
    "background.js",
    "popup",
    "content_scripts",
    "styles",
    "lib",
    "icons"
)

# Verifica se todos os itens existem
foreach ($item in $itemsToInclude) {
    if (-not (Test-Path -Path $item)) {
        Write-Error "Item necessário não encontrado: $item"
    }
}

# Cria o zip temporário com os itens
$tempZip = "$env:TEMP\formphantom-temp-$version.zip"
if (Test-Path -Path $tempZip) {
    Remove-Item -Path $tempZip -Force
}

Compress-Archive -Path $itemsToInclude -DestinationPath $tempZip -Force

# Move para a pasta dist
Move-Item -Path $tempZip -Destination $outputFile -Force

Write-Host ""
Write-Host "Pacote criado com sucesso: $outputFile" -ForegroundColor Green
Write-Host "Versão: $version" -ForegroundColor Cyan
Write-Host ""
