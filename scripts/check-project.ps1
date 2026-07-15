$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "====================================="
Write-Host " PILOT+ PROJECT DIAGNOSTIC"
Write-Host "====================================="
Write-Host ""

function Check($name, $command) {
    Write-Host ""
    Write-Host "[INFO] $name"
    try {
        Invoke-Expression $command
    }
    catch {
        Write-Host "[ERROR] $($_.Exception.Message)"
    }
}


# ROOT
Write-Host "[INFO] ROOT"
Get-Location


# NODE
Check "Node version" "node -v"

# NPM
Check "NPM version" "npm -v"


# PACKAGE
Write-Host ""
Write-Host "[INFO] package.json"

if(Test-Path "./package.json"){
    Write-Host "[OK] package.json found"
    Get-Content package.json
}
else{
    Write-Host "[ERROR] package.json missing"
}


# TREE
Write-Host ""
Write-Host "[INFO] SRC TREE"

if(Test-Path "./src"){
    tree src /F /A
}
else{
    Write-Host "[ERROR] src folder missing"
}


# NEXT
Write-Host ""
Write-Host "[INFO] Next.js"

if(Test-Path "./src/app"){
    Write-Host "[OK] App Router found"
}
else{
    Write-Host "[ERROR] src/app missing"
}


# TYPESCRIPT
Write-Host ""
Write-Host "[INFO] TypeScript"

if(Test-Path "./tsconfig.json"){
    Write-Host "[OK] tsconfig.json"
}
else{
    Write-Host "[ERROR] tsconfig.json missing"
}


# TAILWIND
Write-Host ""
Write-Host "[INFO] Tailwind"

if(Test-Path "./tailwind.config.ts"){
    Write-Host "[OK] tailwind.config.ts"
}
elseif(Test-Path "./postcss.config.mjs"){
    Write-Host "[INFO] Tailwind v4 detected"
}
else{
    Write-Host "[WARNING] Tailwind config not found"
}


# DEPENDENCIES
Write-Host ""
Write-Host "[INFO] Required packages"

npm list next react react-dom react-icons framer-motion tailwindcss


# PRISMA
Write-Host ""
Write-Host "[INFO] Prisma"

if(Test-Path "./src/database/prisma/schema.prisma"){
    Write-Host "[OK] Prisma schema found"
}
else{
    Write-Host "[ERROR] Prisma schema missing"
}


# ENV
Write-Host ""
Write-Host "[INFO] Environment"

if(Test-Path "./.env"){
    Write-Host "[OK] .env found"
    Get-Content .env
}
else{
    Write-Host "[WARNING] .env missing"
}


# GIT
Write-Host ""
Write-Host "[INFO] Git"

git status


Write-Host ""
Write-Host "====================================="
Write-Host " CHECK FINISHED"
Write-Host "====================================="