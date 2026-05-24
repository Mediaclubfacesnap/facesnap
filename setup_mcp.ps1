# Automatically configure Claude Desktop MCP servers for GitHub and Supabase
# Run this script to update your claude_desktop_config.json

$githubToken = "YOUR_GITHUB_TOKEN"
$supabaseToken = "YOUR_SUPABASE_TOKEN"

# Define potential paths for claude_desktop_config.json on Windows
$paths = @(
    "$env:APPDATA\Claude\claude_desktop_config.json",
    "$env:LOCALAPPDATA\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json"
)

$updatedPaths = @()

foreach ($path in $paths) {
    $dir = Split-Path -Path $path
    if (Test-Path $dir) {
        Write-Host "Found Claude Desktop directory at: $dir"
        
        # Determine current JSON state
        $config = @{ "mcpServers" = @{} }
        if (Test-Path $path) {
            try {
                $content = Get-Content -Raw -Path $path -ErrorAction Stop
                if ($content -and $content.Trim() -ne "") {
                    $config = ConvertFrom-Json $content
                }
            } catch {
                Write-Warning "Failed to parse existing JSON at $path, creating new config."
            }
        }
        
        if (-not $config.PSObject.Properties['mcpServers']) {
            $config | Add-Member -MemberType NoteProperty -Name "mcpServers" -Value @{}
        }
        
        # Prepare Server Entries
        $githubServer = [ordered]@{
            "command" = "npx"
            "args" = @("-y", "@modelcontextprotocol/server-github")
            "env" = @{
                "GITHUB_PERSONAL_ACCESS_TOKEN" = $githubToken
            }
        }
        
        $supabaseServer = [ordered]@{
            "command" = "npx"
            "args" = @(
                "-y",
                "@supabase/mcp-server-supabase@latest",
                "--access-token",
                $supabaseToken
            )
        }
        
        # Update/Add mcpServers entries
        $config.mcpServers | Add-Member -MemberType NoteProperty -Name "github" -Value $githubServer -Force
        $config.mcpServers | Add-Member -MemberType NoteProperty -Name "supabase" -Value $supabaseServer -Force
        
        # Save back to config file
        try {
            $jsonString = ConvertTo-Json $config -Depth 100
            $jsonString | Out-File -FilePath $path -Encoding utf8 -Force
            Write-Host "Successfully updated config at: $path"
            $updatedPaths += $path
        } catch {
            Write-Error "Failed to write updated config to $path"
        }
    }
}

if ($updatedPaths.Count -eq 0) {
    # If no directories exist, let's create the standard one just in case they install it later
    $standardDir = "$env:APPDATA\Claude"
    $standardPath = "$env:APPDATA\Claude\claude_desktop_config.json"
    
    Write-Host "Creating standard Claude directory and config..."
    New-Item -ItemType Directory -Force -Path $standardDir | Out-Null
    
    $config = @{
        "mcpServers" = @{
            "github" = [ordered]@{
                "command" = "npx"
                "args" = @("-y", "@modelcontextprotocol/server-github")
                "env" = @{
                    "GITHUB_PERSONAL_ACCESS_TOKEN" = $githubToken
                }
            }
            "supabase" = [ordered]@{
                "command" = "npx"
                "args" = @(
                    "-y",
                    "@supabase/mcp-server-supabase@latest",
                    "--access-token",
                    $supabaseToken
                )
            }
        }
    }
    
    $jsonString = ConvertTo-Json $config -Depth 100
    $jsonString | Out-File -FilePath $standardPath -Encoding utf8 -Force
    Write-Host "Created standard config file at: $standardPath"
} else {
    Write-Host "Setup finished successfully!"
}
