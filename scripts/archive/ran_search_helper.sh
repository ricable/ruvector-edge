#!/bin/bash
# Ericsson RAN Features - Quick Search Helper
# Fast semantic search for RAN features

CLI="npx @claude-flow/cli@latest memory"

show_help() {
    echo "Ericsson RAN Features - Quick Search"
    echo ""
    echo "Usage: $0 [query]"
    echo ""
    echo "Examples:"
    echo "  $0 IFLB load balancing"
    echo "  $0 MIMO sleep mode"
    echo "  $0 carrier aggregation 4CC"
    echo "  $0 5G NR dual connectivity"
    echo "  $0 handover optimization"
    echo ""
    echo "Or use specific namespaces:"
    echo "  $0 --acronym MSM"
    echo "  $0 --category carrier-aggregation"
    echo ""
}

if [ $# -eq 0 ]; then
    show_help
    exit 0
fi

# Check for flags
case "$1" in
    --help|-h)
        show_help
        exit 0
        ;;
    --acronym)
        shift
        $CLI retrieve --key "$(echo "$1" | tr '[:upper:]' '[:lower:]')" --namespace ran-acronyms
        exit $?
        ;;
    --category)
        shift
        $CLI retrieve --key "$(echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/ /-/g')" --namespace ran-categories
        exit $?
        ;;
    --stats)
        echo "=== RAN Features Index Statistics ==="
        echo ""
        echo "Features:"
        $CLI list --namespace ran-features 2>&1 | grep "Showing"
        echo ""
        echo "Acronyms:"
        $CLI list --namespace ran-acronyms 2>&1 | grep "Showing"
        echo ""
        echo "Categories:"
        $CLI list --namespace ran-categories 2>&1 | grep "Showing"
        echo ""
        exit 0
        ;;
esac

# Default: semantic search
QUERY="$*"
echo "Searching for: $QUERY"
echo ""
$CLI search --query "$QUERY" --namespace ran-features --limit 10
