#!/bin/bash
# Fast RAN Features Indexer - Direct Batch Processing
# Processes and indexes all 593 features efficiently

FEATURES_DIR="/Users/cedric/dev/2026/test-cfv3/.claude/skills/ericsson-ran-features/references"
CLI="npx -y @claude-flow/cli@latest memory"

echo "=========================================="
echo "🚀 Fast RAN Features Indexer"
echo "=========================================="
echo ""

# Get counts
TOTAL=$(jq 'length' "$FEATURES_DIR/features.json")
ACRONYMS=$(jq 'length' "$FEATURES_DIR/index_acronym.json")
CATEGORIES=$(jq 'length' "$FEATURES_DIR/index_categories.json")

echo "📊 Data to index:"
echo "  • Features: $TOTAL"
echo "  • Acronyms: $ACRONYMS"
echo "  • Categories: $CATEGORIES"
echo ""

# ============================================
# Index Categories
# ============================================
echo "[1/5] Categories..."
jq -c 'to_entries[]' "$FEATURES_DIR/index_categories.json" | while read -r cat; do
    key=$(echo "$cat" | jq -r '.key | ascii_downcase | gsub(" & "; "-"; gsub(" "; "-")')
    $CLI store --namespace ran-categories --key "$key" --value "$(echo "$cat" | jq -c)" > /dev/null 2>&1 &
done
wait
echo "  ✓ Categories indexed"
echo ""

# ============================================
# Index Acronyms (Background Batch)
# ============================================
echo "[2/5] Acronyms..."
jq -r 'to_entries[] | "\(.key)=\(.value)"' "$FEATURES_DIR/index_acronym.json" | \
    xargs -P 10 -I {} bash -c '
        k=$(echo "{}" | cut -d= -f1 | tr "[:upper:]" "[:lower:]");
        v=$(echo "{}" | cut -d= -f2-);
        npx -y @claude-flow/cli@latest memory store --namespace ran-acronyms --key "$k" --value "$v" > /dev/null 2>&1
    '
echo "  ✓ Acronyms indexed"
echo ""

# ============================================
# Index Features (Batch Process)
# ============================================
echo "[3/5] Features (this will take ~2-3 minutes)..."

# Process in batches of 50
BATCH=50
PROCESSED=0

jq -c 'to_entries[] | {id: .key, name: .value.name, acronym: .value.acronym, summary: .value.summary}' \
    "$FEATURES_DIR/features.json" | \
    split -l $BATCH - /tmp/feature_batch_

for batch in /tmp/feature_batch_*; do
    while read -r feature; do
        [ -z "$feature" ] && continue

        id=$(echo "$feature" | jq -r '.id')
        name=$(echo "$feature" | jq -r '.name')
        acronym=$(echo "$feature" | jq -r '.acronym')
        summary=$(echo "$feature" | jq -r '.summary // ""' | head -c 200)

        # Determine category
        cat="other"
        case "$id" in
            *121_4*) cat="carrier-aggregation" ;;
            *121_3*) cat="radio-resource-mgmt" ;;
            *121_5*) cat="nr-5g" ;;
            *121_0*) cat="other" ;;
            *121_1*) cat="other" ;;
            *121_2*) cat="other" ;;
        esac

        # Semantic text
        search_text="${name} ${acronym} ${summary}"

        # Store
        $CLI store --namespace ran-features --key "${cat}:${id}" --value "$search_text" > /dev/null 2>&1 &

        PROCESSED=$((PROCESSED + 1))
    done < "$batch"

    # Wait for batch to complete
    wait
    echo -ne "  Progress: $PROCESSED/$TOTAL\r"

    rm -f "$batch"
done

echo ""
echo "  ✓ Features indexed"
echo ""

# ============================================
# Index References
# ============================================
echo "[4/5] FAJ/CXC References..."

jq -c 'to_entries[] | {id: .key, faj: .value.faj, cxc: .value.cxc}' \
    "$FEATURES_DIR/features.json" | while read -r ref; do

    id=$(echo "$ref" | jq -r '.id')
    faj=$(echo "$ref" | jq -r '.faj // ""' | tr -d ' ')
    cxc=$(echo "$ref" | jq -r '.cxc // ""')

    [ -n "$faj" ] && $CLI store --namespace ran-faj --key "$faj" --value "$id" > /dev/null 2>&1 &
    [ -n "$cxc" ] && $CLI store --namespace ran-cxc --key "$cxc" --value "$id" > /dev/null 2>&1 &
done
wait
echo "  ✓ References indexed"
echo ""

# ============================================
# Metadata
# ============================================
echo "[5/5] Metadata..."

META="{
  \"total\": $TOTAL,
  \"acronyms\": $ACRONYMS,
  \"categories\": $CATEGORIES,
  \"indexed_at\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
  \"namespaces\": [\"ran-features\", \"ran-categories\", \"ran-acronyms\", \"ran-faj\", \"ran-cxc\"]
}"

$CLI store --namespace ran-index --key "metadata" --value "$META" > /dev/null 2>&1
echo "  ✓ Metadata created"
echo ""

# Cleanup
rm -f /tmp/feature_batch_* 2>/dev/null

echo "=========================================="
echo "✅ Indexing Complete!"
echo "=========================================="
echo ""
echo "🔍 Examples:"
echo "  $CLI search --query 'IFLB' --namespace ran-features"
echo "  $CLI retrieve --key 'iflb' --namespace ran-acronyms"
echo "  $CLI list --namespace ran-features --limit 10"
echo ""
