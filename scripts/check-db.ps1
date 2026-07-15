$ErrorActionPreference = "Continue"

Write-Host "====================================="
Write-Host " PILOT-PLUS DATABASE DIAGNOSTIC"
Write-Host "====================================="

function OK($msg) {
    Write-Host "[OK]  $msg" -ForegroundColor Green
}

function ERR($msg) {
    Write-Host "[ERR] $msg" -ForegroundColor Red
}

function INFO($msg) {
    Write-Host "[INFO] $msg" -ForegroundColor Cyan
}


Write-Host ""
INFO "Current directory"
Get-Location


# Docker
Write-Host ""
INFO "Docker"

docker version > $null 2>&1

if ($LASTEXITCODE -eq 0) {
    OK "Docker работает"
}
else {
    ERR "Docker недоступен"
}


# Containers
Write-Host ""
INFO "Docker containers"

docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"


# Postgres container
Write-Host ""
INFO "Checking pilot-postgres"

$container = docker ps --filter "name=pilot-postgres" --format "{{.Names}}"

if ($container -eq "pilot-postgres") {
    OK "pilot-postgres найден"
}
else {
    ERR "pilot-postgres не найден"
}


# Ports
Write-Host ""
INFO "Listening ports"

netstat -ano | findstr ":5432"
netstat -ano | findstr ":5433"
netstat -ano | findstr ":55432"


# Processes
Write-Host ""
INFO "Postgres processes"

tasklist | findstr postgres


# ENV
Write-Host ""
INFO ".env"

if (Test-Path ".env") {

    OK ".env найден"

    Get-Content .env

}
else {

    ERR ".env отсутствует"

}


# Prisma schema

Write-Host ""
INFO "Prisma schema"

$schema = "src/database/prisma/schema.prisma"

if (Test-Path $schema) {

    OK "schema найден"

    Get-Content $schema

}
else {

    ERR "schema не найден"

}


# Prisma config

Write-Host ""
INFO "Prisma config"

if (Test-Path "prisma.config.ts") {

    OK "prisma.config.ts найден"

    Get-Content prisma.config.ts

}
else {

    INFO "prisma.config.ts отсутствует"

}


# Docker inspect

Write-Host ""
INFO "Docker postgres inspect"

docker inspect pilot-postgres |
Select-String "POSTGRES"


# PostgreSQL inside container

Write-Host ""
INFO "Postgres internal connection"


docker exec pilot-postgres psql -U pilot -d pilot -c `
"SELECT current_user, version();" 


# Roles

Write-Host ""
INFO "Postgres roles"

docker exec pilot-postgres psql -U pilot -d pilot -c "\du"


# HBA

Write-Host ""
INFO "pg_hba.conf"

docker exec pilot-postgres bash -c `
"cat /var/lib/postgresql/data/pg_hba.conf | grep -v '^#' | grep -v '^$'"


# Logs

Write-Host ""
INFO "Last postgres logs"

docker logs pilot-postgres --tail 100


# Prisma

Write-Host ""
INFO "Prisma version"

npx prisma -v


Write-Host ""
INFO "Prisma validate"

npx prisma validate


Write-Host ""
INFO "Prisma db pull"

npx prisma db pull


Write-Host ""
Write-Host "====================================="
Write-Host " FINISHED"
Write-Host "====================================="