#!/bin/bash
# Ericsson RAN Features - Optimized Batch Indexer
# Processes 593 features efficiently with error handling

set -o pipefail

# Configuration
FEATURES_DIR="/Users/cedric/dev/2026/test-cfv3/.claude/skills/ericsson-ran-features/references"
CLI="npx -y @claude-flow/cli@latest"

# Counters
CATEGORIES_INDEXED=0
FEATURES_INDEXED=0
ACRONYMS_INDEXED=0
ERRORS=0

echo "=========================================="
echo "🚀 RAN Features Optimized Indexer"
echo "=========================================="
echo ""

# Verify data files exist
if [ ! -f "$FEATURES_DIR/features.json" ]; then
    echo "❌ Error: features.json not found"
    exit 1
fi

TOTAL_FEATURES=$(jq 'length' "$FEATURES_DIR/features.json")
echo "📊 Total Features: $TOTAL_FEATURES"
echo ""

# ============================================
# Step 1: Index Categories (Batch)
# ============================================
echo "[1/4] Indexing Categories..."

jq -c 'to_entries[]' "$FEATURES_DIR/index_categories.json" | while read -r entry; do
    category=$(echo "$entry" | jq -r '.key')
    category_key=$(echo "$category" | tr '[:upper:]' '[:lower:]' | sed 's/ & /-/g; s/ /-/g')
    feature_count=$(echo "$entry" | jq '.value | length')

    $CLI memory store \
        --namespace ran-categories \
        --key "$category_key" \
        --value "$(echo "$entry" | jq -c '.')" \
        2>&1 | grep -q "Stored successfully" && ((CATEGORIES_INDEXED++)) || ((ERRORS++))

    echo "  ✓ $category: $feature_count features"
done

echo "  Categories indexed: $CATEGORIES_INDEXED"
echo ""

# ============================================
# Step 2: Index Acronym Mappings (Fast Path)
# ============================================
echo "[2/4] Indexing Acronym Mappings..."

jq -r 'to_entries[] | "\(.key)\t\(.value)"' "$FEATURES_DIR/index_acronym.json" | while IFS=$'\t' read -r acronym faj_id; do
    [ -z "$acronym" ] && continue

    $CLI memory store \
        --namespace ran-acronyms \
        --key "$(echo "$acronym" | tr '[:upper:]' '[:lower:]')" \
        --value "$faj_id" \
        > /dev/null 2>&1 && ((ACRONYMS_INDEXED++))
done

echo "  Acronyms indexed: $ACRONYMS_INDEXED"
echo ""

# ============================================
# Step 3: Index Features with Semantic Data
# ============================================
echo "[3/4] Indexing Features (semantic)..."

# Get feature data with category mapping
jq -c 'to_entries[] | {faj_id: .key, name: .value.name, acronym: .value.acronym, faj: .value.faj, cxc: .value.cxc, summary: .value.summary}' \
    "$FEATURES_DIR/features.json" | while read -r feature; do

    faj_id=$(echo "$feature" | jq -r '.faj_id')
    name=$(echo "$feature" | jq -r '.name')
    acronym=$(echo "$feature" | jq -r '.acronym')
    summary=$(echo "$feature" | jq -r '.summary // ""' | cut -c1-300)
    faj_ref=$(echo "$feature" | jq -r '.faj // ""' | tr -d ' ')
    cxc_ref=$(echo "$feature" | jq -r '.cxc // ""')

    # Determine category from FAJ ID prefix (simple heuristic)
    category="other"
    case "$faj_id" in
        *121_4*) category="carrier-aggregation" ;;
        *121_3*) category="radio-resource-mgmt" ;;
        *121_5*) category="nr-5g" ;;
    esac

    # Create semantic searchable text
    searchable_text="${name} ${acronym} ${summary}"

    # Store primary feature entry
    $CLI memory store \
        --namespace ran-features \
        --key "${category}:${faj_id}" \
        --value "$searchable_text" \
        > /dev/null 2>&1 && ((FEATURES_INDEXED++))

    # Store FAJ reference
    if [ -n "$faj_ref" ] && [ "$faj_ref" != "null" ]; then
        $CLI memory store \
            --namespace ran-faj \
            --key "$faj_ref" \
            --value "$faj_id" \
            > /dev/null 2>&1
    fi

    # Store CXC reference
    if [ -n "$cxc_ref" ] && [ "$cxc_ref" != "null" ]; then
        $CLI memory store \
            --namespace ran-cxc \
            --key "$cxc_ref" \
            --value "$faj_id" \
            > /dev/null 2>&1
    fi

    # Progress indicator
    if [ $((FEATURES_INDEXED % 50)) -eq 0 ]; then
        echo "  Progress: $FEATURES_INDEXED/$TOTAL_FEATURES"
    fi
done

echo "  Features indexed: $FEATURES_INDEXED"
echo ""

# ============================================
# Step 4: Create Metadata
# ============================================
echo "[4/4] Creating search metadata..."

METADATA="{
  \"total_features\": $TOTAL_FEATURES,
  \"categories_indexed\": $CATEGORIES_INDEXED,
  \"acronyms_indexed\": $ACRONYMS_INDEXED,
  \"indexed_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
  \"namespaces\": {
    \"ran-features\": \"Primary feature storage (category:faj_id)\",
    \"ran-categories\": \"Category mappings\",
    \"ran-acronyms\": \"Acronym to FAJ mapping\",
    \"ran-faj\": \"FAJ reference lookup\",
    \"ran-cxc\": \"CXC reference lookup\"
  },
  \"examples\": [
    \"IFLB Inter-Frequency Load Balancing\",
    \"MSM MIMO Sleep Mode\",
    \"NR Dual Connectivity EN-DC\",
    \"Carrier Aggregation 4CC\"
  ]
}"

$CLI memory store \
    --namespace ran-index \
    --key "metadata" \
    --value "$METADATA" \
    > /dev/null 2>&1

echo "  ✓ Metadata created"
echo ""

# ============================================
# Summary
# ============================================
echo "=========================================="
echo "✅ Indexing Complete!"
echo "=========================================="
echo ""
echo "📊 Statistics:"
echo "  • Features:   $FEATURES_INDEXED"
echo "  • Categories: $CATEGORIES_INDEXED"
echo "  • Acronyms:   $ACRONYMS_INDEXED"
echo "  • Errors:     $ERRORS"
echo ""
echo "🔍 Search Examples:"
echo "  npx @claude-flow/cli@latest memory search --query 'IFLB load balancing' --namespace ran-features"
echo "  npx @claude-flow/cli@latest memory retrieve --key 'iflb' --namespace ran-acronyms"
echo "  npx @claude-flow/cli@latest memory list --namespace ran-features --limit 20"
echo ""
