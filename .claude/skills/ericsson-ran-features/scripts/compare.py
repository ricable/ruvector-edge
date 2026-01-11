#!/usr/bin/env python3
"""
Feature comparison tool for Ericsson RAN features.
Compare multiple features side-by-side with dependency overlap analysis.

Usage:
  compare.py IFLB DUAC MCPC          # Compare by acronyms
  compare.py --faj "121 3009" "121 4219"  # Compare by FAJ codes
  compare.py IFLB DUAC --deps        # Include dependency overlap analysis
  compare.py IFLB DUAC --params      # Show parameter differences
"""

import argparse
import json
import sys
from pathlib import Path


def load_features() -> dict:
    """Load features index."""
    script_dir = Path(__file__).parent
    features_file = script_dir.parent / 'references' / 'features.json'

    if not features_file.exists():
        print("Error: features.json not found. Run build_index.py first.", file=sys.stderr)
        sys.exit(1)

    with open(features_file) as f:
        return json.load(f)


def find_feature(features: dict, query: str) -> tuple[str, dict] | None:
    """Find a feature by acronym or FAJ code."""
    query_upper = query.upper().strip()

    # Try as FAJ code first
    normalized_faj = 'FAJ_' + query.replace('FAJ ', '').replace(' ', '_').upper()
    if normalized_faj in features:
        return (normalized_faj, features[normalized_faj])

    # Try as acronym
    for faj_key, f in features.items():
        if f.get('acronym', '').upper() == query_upper:
            return (faj_key, f)

    # Try as partial name
    for faj_key, f in features.items():
        if query_upper in f['name'].upper():
            return (faj_key, f)

    return None


def format_comparison_table(features_list: list[tuple[str, dict]]) -> str:
    """Generate side-by-side comparison markdown table."""
    if len(features_list) < 2:
        return "Need at least 2 features to compare."

    headers = ["Aspect"]
    for faj_key, f in features_list:
        headers.append(f.get('acronym') or f['name'][:12])

    rows = [
        ["Name"] + [f['name'][:25] for _, f in features_list],
        ["FAJ"] + [f['faj'] for _, f in features_list],
        ["CXC"] + [f.get('cxc') or '-' for _, f in features_list],
        ["Access"] + ['/'.join(f.get('access', [])) or '-' for _, f in features_list],
        ["License"] + ['Yes' if f.get('license') else 'No' for _, f in features_list],
        ["Params"] + [str(len(f.get('params', []))) for _, f in features_list],
        ["Counters"] + [str(len(f.get('counters', []))) for _, f in features_list],
        ["Latest"] + [f.get('latest_release', '-') for _, f in features_list]
    ]

    lines = ["## Feature Comparison", ""]
    col_widths = [max(len(str(row[i])) for row in [headers] + rows) for i in range(len(headers))]

    lines.append("| " + " | ".join(h.ljust(w) for h, w in zip(headers, col_widths)) + " |")
    lines.append("|" + "|".join("-" * (w + 2) for w in col_widths) + "|")

    for row in rows:
        lines.append("| " + " | ".join(str(c).ljust(w) for c, w in zip(row, col_widths)) + " |")

    return '\n'.join(lines)


def analyze_dependency_overlap(features_list: list[tuple[str, dict]]) -> str:
    """Analyze dependency overlap between features."""
    lines = ["\n## Dependency Overlap Analysis", ""]

    # Collect all prerequisites
    prereqs_by_feature = {}
    all_prereqs = set()

    for faj_key, f in features_list:
        label = f.get('acronym') or f['name'][:12]
        prereqs = {d['faj'] for d in f.get('deps', []) if d.get('type') == 'Prerequisite'}
        prereqs_by_feature[label] = prereqs
        all_prereqs.update(prereqs)

    if not all_prereqs:
        lines.append("No prerequisites defined for any feature.")
        return '\n'.join(lines)

    # Find shared prerequisites
    shared = set.intersection(*prereqs_by_feature.values()) if prereqs_by_feature else set()
    if shared:
        lines.append(f"**Shared Prerequisites ({len(shared)}):**")
        for faj in sorted(shared):
            lines.append(f"- {faj}")
        lines.append("")

    # Find unique prerequisites per feature
    for label, prereqs in prereqs_by_feature.items():
        unique = prereqs - shared
        if unique:
            lines.append(f"**Unique to {label}:** {', '.join(sorted(unique))}")

    # Check for conflicts
    lines.append("\n### Conflict Check")
    conflicts_found = False
    for faj_key, f in features_list:
        label = f.get('acronym') or f['name'][:12]
        conflicts = [d['name'] for d in f.get('deps', []) if d.get('type') == 'Conflicting']
        if conflicts:
            lines.append(f"- **{label}** conflicts with: {', '.join(conflicts)}")
            conflicts_found = True

    if not conflicts_found:
        lines.append("No conflicts detected between compared features.")

    return '\n'.join(lines)


def analyze_parameter_differences(features_list: list[tuple[str, dict]]) -> str:
    """Analyze parameter differences between features."""
    lines = ["\n## Parameter Analysis", ""]

    params_by_feature = {}
    all_params = set()

    for faj_key, f in features_list:
        label = f.get('acronym') or f['name'][:12]
        params = set(f.get('params', []))
        params_by_feature[label] = params
        all_params.update(params)

    if not all_params:
        lines.append("No parameters defined for any feature.")
        return '\n'.join(lines)

    # Shared parameters
    shared = set.intersection(*params_by_feature.values()) if params_by_feature else set()
    if shared:
        lines.append(f"**Shared Parameters ({len(shared)}):**")
        for p in sorted(shared)[:10]:
            lines.append(f"- {p}")
        if len(shared) > 10:
            lines.append(f"- ... and {len(shared) - 10} more")
        lines.append("")

    # Unique parameters per feature
    for label, params in params_by_feature.items():
        unique = params - shared
        if unique:
            lines.append(f"**Unique to {label} ({len(unique)}):**")
            for p in sorted(unique)[:5]:
                lines.append(f"- {p}")
            if len(unique) > 5:
                lines.append(f"- ... and {len(unique) - 5} more")
            lines.append("")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Compare Ericsson RAN features',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  compare.py IFLB DUAC MCPC          # Compare by acronyms
  compare.py --faj "121 3009" "121 4219"  # Compare by FAJ codes
  compare.py IFLB DUAC --deps        # Include dependency overlap
  compare.py IFLB DUAC --params      # Show parameter differences
  compare.py IFLB DUAC --all         # Full analysis
        '''
    )

    parser.add_argument('features', nargs='*', help='Feature acronyms or names to compare')
    parser.add_argument('--faj', nargs='+', help='Compare by FAJ codes')
    parser.add_argument('--deps', action='store_true', help='Analyze dependency overlap')
    parser.add_argument('--params', action='store_true', help='Analyze parameter differences')
    parser.add_argument('--all', action='store_true', help='Full analysis (deps + params)')
    parser.add_argument('--json', '-j', action='store_true', help='Output as JSON')

    args = parser.parse_args()

    features = load_features()

    # Collect features to compare
    queries = args.faj if args.faj else args.features
    if not queries or len(queries) < 2:
        print("Error: Need at least 2 features to compare.")
        print("Usage: compare.py IFLB DUAC MCPC")
        sys.exit(1)

    features_list = []
    for query in queries:
        result = find_feature(features, query)
        if result:
            features_list.append(result)
        else:
            print(f"Warning: Feature not found: {query}", file=sys.stderr)

    if len(features_list) < 2:
        print("Error: Need at least 2 valid features to compare.")
        sys.exit(1)

    if args.json:
        output = {
            'features': {faj: f for faj, f in features_list},
            'comparison': {
                'shared_prereqs': list(set.intersection(*[
                    {d['faj'] for d in f.get('deps', []) if d.get('type') == 'Prerequisite'}
                    for _, f in features_list
                ]) if features_list else set())
            }
        }
        print(json.dumps(output, indent=2))
        return

    # Print comparison
    print(format_comparison_table(features_list))

    if args.deps or args.all:
        print(analyze_dependency_overlap(features_list))

    if args.params or args.all:
        print(analyze_parameter_differences(features_list))


if __name__ == '__main__':
    main()
