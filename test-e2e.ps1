#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════
# Orion IDE — Comprehensive E2E Test Suite (PowerShell)
# Tests every service endpoint, code execution, and integration
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = 'SilentlyContinue'
$pass = 0; $fail = 0; $skip = 0

function Test-Endpoint {
    param([string]$Name, [string]$Url, [string]$Method = 'GET', $Body, 
          [int[]]$ExpectStatus = @(200), [string]$ExpectContains, [switch]$IsJson)
    
    try {
        $params = @{ Uri = $Url; Method = $Method; UseBasicParsing = $true; TimeoutSec = 15 }
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 5)
            $params.ContentType = 'application/json'
        }
        $r = Invoke-WebRequest @params
        
        if ($ExpectStatus -contains $r.StatusCode) {
            if ($ExpectContains -and ($r.Content -notmatch [regex]::Escape($ExpectContains))) {
                $script:fail++
                Write-Host "  ❌ $Name — Expected content '$ExpectContains' not found" -ForegroundColor Red
                return $false
            }
            $script:pass++
            $detail = if ($r.Content.Length -gt 120) { $r.Content.Substring(0,120) + '...' } else { $r.Content }
            Write-Host "  ✅ $Name → $($r.StatusCode) | $detail" -ForegroundColor Green
            return $true
        } else {
            $script:fail++
            Write-Host "  ❌ $Name — Expected $($ExpectStatus -join '/'), got $($r.StatusCode)" -ForegroundColor Red
            return $false
        }
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -and ($ExpectStatus -contains $status)) {
            $script:pass++
            Write-Host "  ✅ $Name → $status (expected rejection)" -ForegroundColor Green
            return $true
        }
        $script:fail++
        Write-Host "  ❌ $Name — $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Test-CodeExecution {
    param([string]$Lang, [string]$Version, [string]$File, [string]$Code, [string]$Expect)
    
    $body = @{
        language = $Lang; version = $Version
        files = @(@{ name = $File; content = $Code })
    }
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:2000/api/v2/execute" -Method POST `
            -Body ($body | ConvertTo-Json -Depth 5) -ContentType 'application/json' `
            -UseBasicParsing -TimeoutSec 30
        $data = $r.Content | ConvertFrom-Json
        $stdout = ($data.run.stdout -replace "`n","").Trim()
        if ($stdout -match [regex]::Escape($Expect)) {
            $script:pass++
            Write-Host "  ✅ Execute $Lang → `"$stdout`" (exit $($data.run.code))" -ForegroundColor Green
            return $true
        } else {
            $stderr = $data.run.stderr
            $script:fail++
            Write-Host "  ❌ Execute $Lang — Expected `"$Expect`", got `"$stdout`" | stderr: $stderr" -ForegroundColor Red
            return $false
        }
    } catch {
        $script:fail++
        Write-Host "  ❌ Execute $Lang — $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# ═══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ORION IDE — COMPREHENSIVE E2E API TEST SUITE" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── 1. API GATEWAY ─────────────────────────────────────
Write-Host "── 1. API GATEWAY ──────────────────────────────────" -ForegroundColor Yellow
Test-Endpoint "Gateway /health — all services ok" "http://localhost:3000/health" -ExpectContains '"status":"ok"'

# ── 2. AUTH SERVICE ────────────────────────────────────
Write-Host "`n── 2. AUTH SERVICE ─────────────────────────────────" -ForegroundColor Yellow
Test-Endpoint "Auth service health" "http://localhost:3001/health"
Test-Endpoint "Auth Google OAuth redirect" "http://localhost:3000/api/auth/google" -ExpectStatus @(302, 200)
Test-Endpoint "Auth refresh rejects without cookie" "http://localhost:3000/api/auth/refresh" -Method POST -ExpectStatus @(401, 403)

# ── 3. DRIVE SERVICE ──────────────────────────────────
Write-Host "`n── 3. DRIVE SERVICE ────────────────────────────────" -ForegroundColor Yellow
Test-Endpoint "Drive service health" "http://localhost:3002/health"
Test-Endpoint "Drive /projects rejects without auth" "http://localhost:3000/api/drive/projects" -ExpectStatus @(401, 403)

# ── 4. EDITOR SERVICE ─────────────────────────────────
Write-Host "`n── 4. EDITOR SERVICE ───────────────────────────────" -ForegroundColor Yellow
Test-Endpoint "Editor service health" "http://localhost:3003/health"

# ── 5. EXECUTION SERVICE ──────────────────────────────
Write-Host "`n── 5. EXECUTION SERVICE (Piston) ───────────────────" -ForegroundColor Yellow
Test-Endpoint "Execution service health" "http://localhost:3004/health"
Test-Endpoint "Piston API reachable" "http://localhost:2000/api/v2/runtimes"
Test-Endpoint "Execution /execute/languages" "http://localhost:3004/execute/languages"

# Get installed runtimes
$runtimesRaw = (Invoke-WebRequest -Uri "http://localhost:2000/api/v2/runtimes" -UseBasicParsing -TimeoutSec 10).Content
$runtimes = $runtimesRaw | ConvertFrom-Json
$installedLangs = @{}
foreach ($rt in $runtimes) { $installedLangs[$rt.language] = $rt.version }
Write-Host "  📦 Installed runtimes: $($runtimes.Count) — $($installedLangs.Keys -join ', ')" -ForegroundColor Cyan

# Test code execution for each installed language
Write-Host "`n── 5b. CODE EXECUTION TESTS ────────────────────────" -ForegroundColor Yellow

$codeTests = @(
    @{Lang='python';   File='main.py';   Code='print("Hello from Python!")';         Expect='Hello from Python!'}
    @{Lang='javascript'; File='index.js'; Code='console.log("Hello from JavaScript!")'; Expect='Hello from JavaScript!'}
    @{Lang='typescript'; File='index.ts'; Code='console.log("Hello from TypeScript!")'; Expect='Hello from TypeScript!'}
    @{Lang='bash';     File='script.sh'; Code='echo "Hello from Bash!"';             Expect='Hello from Bash!'}
    @{Lang='ruby';     File='main.rb';   Code='puts "Hello from Ruby!"';             Expect='Hello from Ruby!'}
    @{Lang='go';       File='main.go';   Code="package main`nimport `"fmt`"`nfunc main() { fmt.Println(`"Hello from Go!`") }"; Expect='Hello from Go!'}
    @{Lang='c++';      File='main.cpp';  Code="#include <iostream>`nint main() { std::cout << `"Hello from C++!`" << std::endl; return 0; }"; Expect='Hello from C++!'}
    @{Lang='c';        File='main.c';    Code="#include <stdio.h>`nint main() { printf(`"Hello from C!\n`"); return 0; }"; Expect='Hello from C!'}
    @{Lang='java';     File='Main.java'; Code='public class Main { public static void main(String[] args) { System.out.println("Hello from Java!"); } }'; Expect='Hello from Java!'}
    @{Lang='rust';     File='main.rs';   Code='fn main() { println!("Hello from Rust!"); }'; Expect='Hello from Rust!'}
    @{Lang='php';      File='index.php'; Code='<?php echo "Hello from PHP!";';       Expect='Hello from PHP!'}
    @{Lang='csharp';   File='Main.cs';   Code='using System; class Program { static void Main() { Console.WriteLine("Hello from C#!"); } }'; Expect='Hello from C#!'}
    @{Lang='lua';      File='main.lua';  Code='print("Hello from Lua!")';            Expect='Hello from Lua!'}
    @{Lang='perl';     File='main.pl';   Code='print "Hello from Perl!\n";';         Expect='Hello from Perl!'}
    @{Lang='r';        File='main.r';    Code='cat("Hello from R!\n")';              Expect='Hello from R!'}
    @{Lang='dart';     File='main.dart'; Code='void main() { print("Hello from Dart!"); }'; Expect='Hello from Dart!'}
)

foreach ($t in $codeTests) {
    if (-not $installedLangs.ContainsKey($t.Lang)) {
        $script:skip++
        Write-Host "  ⏭️  Execute $($t.Lang) — Runtime not installed" -ForegroundColor DarkGray
        continue
    }
    Test-CodeExecution -Lang $t.Lang -Version $installedLangs[$t.Lang] -File $t.File -Code $t.Code -Expect $t.Expect
}

# ── 6. TERMINAL SERVICE ───────────────────────────────
Write-Host "`n── 6. TERMINAL SERVICE ─────────────────────────────" -ForegroundColor Yellow
Test-Endpoint "Terminal service health" "http://localhost:3007/health"

# ── 7. AGENT SERVICE ──────────────────────────────────
Write-Host "`n── 7. AGENT SERVICE (AI) ───────────────────────────" -ForegroundColor Yellow
Test-Endpoint "Agent service health" "http://localhost:3005/health"
Test-Endpoint "Agent /pipeline rejects without auth" "http://localhost:3000/api/agents/pipeline" -Method POST -ExpectStatus @(401, 403) -Body @{prompt='test'}

# ── 8. NOTIFICATION SERVICE ───────────────────────────
Write-Host "`n── 8. NOTIFICATION SERVICE ─────────────────────────" -ForegroundColor Yellow
Test-Endpoint "Notification service health" "http://localhost:3006/health"

# ── 9. FRONTEND ───────────────────────────────────────
Write-Host "`n── 9. FRONTEND ────────────────────────────────────" -ForegroundColor Yellow
Test-Endpoint "Frontend serves HTML" "http://localhost:3010/" -ExpectContains '<div id="root">'
Test-Endpoint "Frontend proxies /api" "http://localhost:3010/api/auth/refresh" -Method POST -ExpectStatus @(401, 403, 502)

# ═══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  RESULTS: $pass passed | $fail failed | $skip skipped" -ForegroundColor $(if ($fail -eq 0) {'Green'} else {'Red'})
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
