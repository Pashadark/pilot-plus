$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "====================================="
Write-Host " PILOT-PLUS FULL STACK CHECK"
Write-Host "====================================="
Write-Host ""

function OK($msg) {
    Write-Host "[OK]  $msg" -ForegroundColor Green
}

function ERR($msg) {
    Write-Host "[ERR] $msg" -ForegroundColor Red
}

function INFO($msg) {
    Write-Host ""
    Write-Host "[INFO] $msg" -ForegroundColor Cyan
}


# Docker
INFO "Docker"

docker version *> $null

if ($LASTEXITCODE -eq 0) {
    OK "Docker работает"
}
else {
    ERR "Docker недоступен"
}


# Containers
INFO "Containers"

docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"


# PostgreSQL container

INFO "Postgres container"

$pg = docker ps --filter "name=pilot-postgres" --format "{{.Names}}"

if ($pg -eq "pilot-postgres") {
    OK "pilot-postgres найден"
}
else {
    ERR "pilot-postgres отсутствует"
}


# Ports

INFO "Port 5433"

netstat -ano | findstr ":5433"


# ENV

INFO ".env"

if (Test-Path ".env") {

    OK ".env найден"

    Get-Content .env

}
else {

    ERR ".env отсутствует"

}



# Docker postgres env

INFO "Docker postgres users"

docker exec pilot-postgres env | findstr POSTGRES



# Database connection

INFO "Database connection"


docker exec -e PGPASSWORD=pilot pilot-postgres `
psql -h 127.0.0.1 -U pilot -d pilot `
-c "SELECT current_user, current_database(), version();"



# Roles

INFO "Postgres roles"


docker exec pilot-postgres `
psql -U pilot -d pilot `
-c "\du"



# Extensions

INFO "PostGIS"

docker exec pilot-postgres `
psql -U pilot -d pilot `
-c "SELECT extname FROM pg_extension;"



# Tables

INFO "Tables"

docker exec pilot-postgres `
psql -U pilot -d pilot `
-c "\dt"



# Prisma

INFO "Prisma version"

npx prisma -v


INFO "Prisma validate"

npx prisma validate


INFO "Prisma generate"

npx prisma generate


INFO "Prisma migrations"

if(Test-Path "prisma/migrations")
{
    Get-ChildItem prisma/migrations
}
else
{
    Write-Host "No migrations yet"
}



# Logs

INFO "Postgres errors"

docker logs pilot-postgres --tail 50 | findstr "ERROR FATAL"



Write-Host ""
Write-Host "====================================="
Write-Host " CHECK FINISHED"
Write-Host "====================================="