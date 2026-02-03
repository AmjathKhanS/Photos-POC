#!/bin/bash
# Wrapper script to run Windows Python from WSL with proper path conversion

# Get the Windows Python executable
PYTHON_EXE="/mnt/d/Photos Ai/photo-viewer/venv_onnx/Scripts/python.exe"

# Convert WSL paths in arguments to Windows paths
args=()
for arg in "$@"; do
    if [[ $arg == /mnt/* ]]; then
        # Convert /mnt/x/path to X:/path (use forward slashes, Windows Python handles them)
        win_path=$(echo "$arg" | sed 's|^/mnt/\([a-z]\)/|\U\1\E:/|')
        args+=("$win_path")
    else
        args+=("$arg")
    fi
done

# Execute Windows Python with converted paths
"$PYTHON_EXE" "${args[@]}"
