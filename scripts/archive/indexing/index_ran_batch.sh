#!/bin/bash
# Ericsson RAN Features - Batch Indexer for AgentDB
# Fast batch indexing of 593 RAN features with semantic embeddings

set -e

# Configuration
FEATURES_DIR="/Users/cedric/dev/2026/test-cfv3/.claude/skills/ericsson-ran-features/references"
CLI="npx @claude-flow/cli@latest"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}🚀 RAN Features Batch Indexer${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Statistics
TOTAL_FEATURES=$(jq 'length' "$FEATURES_DIR/features.json")
TOTAL_CATEGORIES=$(jq 'length' "$FEATURES_DIR/index_categories.json")
TOTAL_ACRONYMS=$(jq 'length' "$FEATURES_DIR/index_acronym.json")

echo -e "📊 Data Overview:"
echo -e "  • Features:    ${GREEN}${TOTAL_FEATURES}${NC}"
echo -e "  • Categories:  ${GREEN}${TOTAL_CATEGORIES}${NC}"
echo -e "  • Acronyms:    ${GREEN}${TOTAL_ACRONYMS}${NC}"
echo ""

# Step 1: Index Categories
echo -e "${YELLOW}[1/5] Indexing Categories...${NC}"
jq -r 'to_entries[] | @json' "$FEATURES_DIR/index_categories.json" | while IFS= read -r entry; do
    category=$(echo "$entry" | jq -r '.key')
    category_key=$(echo "$category" | tr '[:upper:]' '[:lower:]' | sed 's/ & /-/g; s/ /-/g')
    feature_count=$(echo "$entry" | jq '.value | length')

    $CLI memory store \
        --namespace ran-categories \
        --key "$category_key" \
        --value "$entry" \
        > /dev/null 2>&1

    echo -e "  ✓ ${category}: ${feature_count} features"
done

echo -e "${GREEN}✓ Categories indexed${NC}"
echo ""

# Step 2: Index Acronym Mappings
echo -e "${YELLOW}[2/5] Indexing Acronym Mappings...${NC}"
jq -r 'to_entries[] | "\(.key)=\(.value)"' "$FEATURES_DIR/index_acronym.json" | while IFS='=' read -r acronym faj_id; do
    $CLI memory store \
        --namespace ran-acronyms \
        --key "$(echo "$acronym" | tr '[:upper:]' '[:lower:]')" \
        --value "$faj_id" \
        > /dev/null 2>&1
done

echo -e "${GREEN}✓ Acronym mappings indexed${NC}"
echo ""

# Step 3: Index Features (Batch)
echo -e "${YELLOW}[3/5] Indexing Features (this may take a while)...${NC}"

# Process features in batches by category
jq -r 'to_entries[] | @json' "$FEATURES_DIR/index_categories.json" | while IFS= read -r cat_entry; do
    category=$(echo "$cat_entry" | jq -r '.key')
    category_key=$(echo "$category" | tr '[:upper:]' '[:lower:]' | sed 's/ & /-/g; s/ /-/g')
    feature_list=$(echo "$cat_entry" | jq -r '.value[]')

    echo -ne "  ${category}: 0/${TOTAL_FEATURES}"

    count=0
    echo "$feature_list" | while IFS= read -r faj_id; do
        # Get feature data
        feature_data=$(jq -r --arg id "$faj_id" '.[$id]' "$FEATURES_DIR/features.json")

        # Create searchable text
        name=$(echo "$feature_data" | jq -r '.name // ""')
        acronym=$(echo "$feature_data" | jq -r '.acronym // ""')
        summary=$(echo "$feature_data" | jq -r '.summary // ""' | cut -c1-200)

        searchable_text="${name} ${acronym} ${summary}"

        # Store primary entry
        $CLI memory store \
            --namespace ran-features \
            --key "${category_key}:${faj_id}" \
            --value "$searchable_text" \
            > /dev/null 2>&1

        # Store acronym reference
        if [ -n "$acronym" ] && [ "$acronym" != "null" ]; then
            $CLI memory store \
                --namespace ran-acronym-map \
                --key "$(echo "$acronym" | tr '[:upper:]' '[:lower:]')" \
                --value "$faj_id" \
                > /dev/null 2>&1
        fi

        count=$((count + 1))
        if [ $((count % 10)) -eq 0 ]; then
            echo -ne "\r  ${category}: ${count}/${TOTAL_FEATURES}"
        fi
    done

    echo -ne "\r  ${category}: ${TOTAL_FEATURES}/${TOTAL_FEATURES}\n"
done

echo -e "${GREEN}✓ Features indexed${NC}"
echo ""

# Step 4: Index FAJ and CXC References
echo -e "${YELLOW}[4/5] Indexing FAJ and CXC References...${NC}"

jq -r 'to_entries[] | @json' "$FEATURES_DIR/features.json" | while IFS= read -r entry; do
    faj_id=$(echo "$entry" | jq -r '.key')
    faj_ref=$(echo "$entry" | jq -r '.value.faj // ""' | tr -d ' ')
    cxc_ref=$(echo "$entry" | jq -r '.value.cxc // ""')

    if [ -n "$faj_ref" ] && [ "$faj_ref" != "null" ]; then
        $CLI memory store \
            --namespace ran-faj \
            --key "$faj_ref" \
            --value "$faj_id" \
            > /dev/null 2>&1
    fi

    if [ -n "$cxc_ref" ] && [ "$cxc_ref" != "null" ]; then
        $CLI memory store \
            --namespace ran-cxc \
            --key "$cxc_ref" \
            --value "$faj_id" \
            > /dev/null 2>&1
    fi
done

echo -e "${GREEN}✓ References indexed${NC}"
echo ""

# Step 5: Create Metadata
echo -e "${YELLOW}[5/5] Creating Search Metadata...${NC}"

METADATA='{
  "total_features": 593,
  "categories": 15,
  "parameters": 9432,
  "counters": 3368,
  "kpis": 752,
  "mo_classes": 199,
  "releases": 49,
  "indexed_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "namespaces": {
    "ran-features": "Primary feature storage by category:faj_id",
    "ran-categories": "Category mappings with feature counts",
    "ran-acronyms": "Acronym to FAJ ID mapping",
    "ran-acronym-map": "Complete acronym mappings",
    "ran-faj": "FAJ reference to FAJ ID",
    "ran-cxc": "CXC reference to FAJ ID"
  },
  "search_examples": [
    "IFLB load balancing",
    "MIMO sleep mode",
    "carrier aggregation 4CC",
    "handover optimization",
    "NR dual connectivity"
  ]
}'

$CLI memory store \
    --namespace ran-index \
    --key "metadata" \
    --value "$METADATA" \
    > /dev/null 2>&1

echo -e "${GREEN}✓ Metadata created${NC}"
echo ""

# Final Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Indexing Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "📊 Indexed:"
echo -e "  • ${TOTAL_FEATURES} features across ${TOTAL_CATEGORIES} categories"
echo -e "  • ${TOTAL_ACRONYMS} acronym mappings"
echo -e "  • FAJ and CXC reference indices"
echo -e "  • Semantic search metadata"
echo ""
echo -e "🔍 Example Searches:"
echo -e "  $CLI memory search --query 'IFLB load balancing' --namespace ran-features"
echo -e "  $CLI memory search --query 'MIMO sleep' --namespace ran-features"
echo -e "  $CLI memory retrieve --key 'iflb' --namespace ran-acronyms"
echo -e "  $CLI memory list --namespace ran-features --limit 10"
echo ""
