#!/bin/bash
# Elex Features Search Demo
# Test script for searching indexed Ericsson LTE/NR features

echo "=================================="
echo "  Elex Features Search Demo"
echo "=================================="
echo ""

NAMESPACE="elex-features"

echo "1. Memory Statistics"
echo "-------------------"
npx @claude-flow/cli@latest memory stats
echo ""

echo "2. List 10 Recent Entries"
echo "-------------------------"
npx @claude-flow/cli@latest memory list --namespace "$NAMESPACE" --limit 10
echo ""

echo "3. Search: MIMO sleep mode"
echo "--------------------------"
npx @claude-flow/cli@latest memory search --namespace "$NAMESPACE" --query "MIMO sleep mode" --limit 3
echo ""

echo "4. Search: Carrier aggregation"
echo "------------------------------"
npx @claude-flow/cli@latest memory search --namespace "$NAMESPACE" --query "carrier aggregation" --limit 3
echo ""

echo "5. Search: Handover optimization"
echo "-------------------------------"
npx @claude-flow/cli@latest memory search --namespace "$NAMESPACE" --query "handover optimization" --limit 3
echo ""

echo "6. Search: Energy saving"
echo "-----------------------"
npx @claude-flow/cli@latest memory search --namespace "$NAMESPACE" --query "energy saving" --limit 3
echo ""

echo "7. Search: Network synchronization"
echo "----------------------------------"
npx @claude-flow/cli@latest memory search --namespace "$NAMESPACE" --query "network synchronization" --limit 3
echo ""

echo "Demo Complete!"
