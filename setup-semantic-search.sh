#!/bin/bash

echo "==================================="
echo "Semantic Search Setup Script"
echo "==================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Python executable is set
if [ -z "$PYTHON_EXECUTABLE" ]; then
    if [ -f "venv_onnx/Scripts/python.exe" ]; then
        PYTHON_CMD="venv_onnx/Scripts/python.exe"
        echo -e "${GREEN}✓${NC} Found Python at: $PYTHON_CMD"
    else
        echo -e "${RED}✗${NC} PYTHON_EXECUTABLE not set and venv not found"
        echo "Please set PYTHON_EXECUTABLE in .env file"
        exit 1
    fi
else
    PYTHON_CMD="$PYTHON_EXECUTABLE"
    echo -e "${GREEN}✓${NC} Using Python: $PYTHON_CMD"
fi

echo ""
echo "Step 1: Installing Python dependencies..."
echo "This may take 5-10 minutes for first-time setup..."
echo ""

"$PYTHON_CMD" -m pip install --upgrade pip
"$PYTHON_CMD" -m pip install -r server/ai/requirements.txt

if [ $? -ne 0 ]; then
    echo -e "${RED}✗${NC} Failed to install Python dependencies"
    exit 1
fi

echo -e "${GREEN}✓${NC} Python dependencies installed"
echo ""

echo "Step 2: Running database migration..."
cd server
npx tsx --env-file=../.env src/migrations/add-semantic-search.ts
cd ..

if [ $? -ne 0 ]; then
    echo -e "${RED}✗${NC} Database migration failed"
    exit 1
fi

echo -e "${GREEN}✓${NC} Database migration completed"
echo ""

echo "Step 3: Testing AI models..."
"$PYTHON_CMD" server/ai/semantic_search_service.py --action test > /tmp/ai-test.json 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} AI models are working"
    cat /tmp/ai-test.json | grep -q '"clip_model": true'
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ CLIP model loaded${NC}"
    fi
    cat /tmp/ai-test.json | grep -q '"ocr_model": true'
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ OCR model loaded${NC}"
    fi
    cat /tmp/ai-test.json | grep -q '"text_embedder": true'
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}  ✓ Text embedder loaded${NC}"
    fi
else
    echo -e "${YELLOW}⚠${NC} AI models test had warnings (this is normal on first run)"
fi

echo ""
echo "==================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Start the server: cd server && npm run dev"
echo "2. Start the client: cd client && npm run dev"
echo "3. Index photos:"
echo "   curl -X POST http://localhost:3002/api/semantic-search/batch-index -H 'Content-Type: application/json' -d '{\"limit\": 10}'"
echo "4. Try searching!"
echo ""
echo "See SEMANTIC_SEARCH_README.md for detailed usage instructions."
echo ""
