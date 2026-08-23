param(
    [string]$SshHost = 'root@176.124.202.120',
    [string]$KeyPath = 'C:\Users\pasahdark\.ssh\pilot_plus_aeza_deploy_ed25519',
    [int]$RemotePort = 3001,
    [int]$LocalPort = 3001
)

$ErrorActionPreference = 'Stop'
$mutex = [System.Threading.Mutex]::new($false, 'Local\PilotPlusBotApiTunnel')

if (-not $mutex.WaitOne(0)) {
    exit 0
}

try {
    $ssh = (Get-Command ssh.exe -ErrorAction Stop).Source
    $logDirectory = Join-Path $PSScriptRoot '..\.codex-tmp'
    $logPath = Join-Path $logDirectory 'bot-tunnel.ssh.log'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

    while ($true) {
        & $ssh `
            -N `
            -E $logPath `
            -i $KeyPath `
            -o StrictHostKeyChecking=yes `
            -o ExitOnForwardFailure=yes `
            -o ServerAliveInterval=15 `
            -o ServerAliveCountMax=3 `
            -R "0.0.0.0:${RemotePort}:127.0.0.1:${LocalPort}" `
            $SshHost

        Start-Sleep -Seconds 5
    }
}
finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
