#!/bin/bash
# ONNX Face Detection Test - Installation and Run Script

set -e  # Exit on error

echo "============================================================"
echo "ONNX FACE DETECTION - INSTALLATION SCRIPT"
echo "============================================================"
echo ""

# Check if running on WSL
if grep -qi microsoft /proc/version; then
    echo "✓ Detected WSL environment"
fi

# Step 1: Install system dependencies
echo "Step 1: Installing system dependencies..."
echo "This requires sudo password."
sudo apt update
sudo apt install -y python3.12-venv python3-pip python3-dev

echo ""
echo "✓ System dependencies installed"
echo ""

# Step 2: Create virtual environment
echo "Step 2: Creating virtual environment..."
python3 -m venv venv_onnx

echo "✓ Virtual environment created"
echo ""

# Step 3: Activate and install Python packages
echo "Step 3: Installing Python packages..."
source venv_onnx/bin/activate

pip install --upgrade pip
pip install -r requirements_onnx.txt

echo ""
echo "✓ Python packages installed"
echo ""

# Step 4: Run the test
echo "============================================================"
echo "RUNNING ONNX TEST"
echo "============================================================"
echo ""
echo "Note: First run will download models (~300MB), please be patient..."
echo ""

python test_onnx_models.py

echo ""
echo "============================================================"
echo "INSTALLATION AND TEST COMPLETED"
echo "============================================================"
echo ""
echo "Next time, run the test with:"
echo "  source venv_onnx/bin/activate"
echo "  python test_onnx_models.py [optional-image-path]"
echo ""
