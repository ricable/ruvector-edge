#!/usr/bin/env python3
"""
Audit data quality and report gaps for Ericsson RAN features.
Generates reports on missing data, distribution stats, and orphan features.

Usage:
  audit.py                  # Full audit report
  audit.py --gaps           # Show only features with missing data
  audit.py --stats          # Show only statistics
  audit.py --orphans        # Show features with no dependencies
  audit.py --json           # Output as JSON
"""

import argparse
import json
import sys
from collections import Counter
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


def analyze_gaps(features: dict) -> dict:
    """Analyze data gaps in features."""
    total = len(features)
    gaps = {
        'missing_cxc': [],
        'missing_deps': [],
        'missing_counters': [],
        'missing_params': [],
        'missing_summary': [],
        'missing_activation': [],
        'missing_acronym': []
    }

    for faj_key, f in features.items():
        if not f.get('cxc'):
            gaps['missing_cxc'].append(faj_key)
        if not f.get('deps'):
            gaps['missing_deps'].append(faj_key)
        if not f.get('counters'):
            gaps['missing_counters'].append(faj_key)
        if not f.get('params'):
            gaps['missing_params'].append(faj_key)
        if not f.get('summary'):
            gaps['missing_summary'].append(faj_key)
        if not f.get('activation') or not f['activation'].get('steps'):
            gaps['missing_activation'].append(faj_key)
        if not f.get('acronym'):
            gaps['missing_acronym'].append(faj_key)

    return {
        'total': total,
        'gaps': {k: len(v) for k, v in gaps.items()},
        'gap_lists': gaps
    }


def analyze_stats(features: dict) -> dict:
    """Generate statistics about the feature dataset."""
    access_counts = Counter()
    license_counts = Counter()
    param_counts = []
    counter_counts = []
    dep_counts = []

    for f in features.values():
        # Access types
        for access in f.get('access', ['Unknown']):
            access_counts[access] += 1

        # License
        license_counts['Licensed' if f.get('license') else 'Unlicensed'] += 1

        # Counts
        param_counts.append(len(f.get('params', [])))
        counter_counts.append(len(f.get('counters', [])))
        dep_counts.append(len(f.get('deps', [])))

    return {
        'access_distribution': dict(access_counts.most_common()),
        'license_distribution': dict(license_counts),
        'parameters': {
            'total': sum(param_counts),
            'avg_per_feature': round(sum(param_counts) / len(param_counts), 1) if param_counts else 0,
            'max': max(param_counts) if param_counts else 0,
            'features_with_params': sum(1 for c in param_counts if c > 0)
        },
        'counters': {
            'total': sum(counter_counts),
            'avg_per_feature': round(sum(counter_counts) / len(counter_counts), 1) if counter_counts else 0,
            'max': max(counter_counts) if counter_counts else 0,
            'features_with_counters': sum(1 for c in counter_counts if c > 0)
        },
        'dependencies': {
            'avg_per_feature': round(sum(dep_counts) / len(dep_counts), 1) if dep_counts else 0,
            'features_with_deps': sum(1 for c in dep_counts if c > 0)
        }
    }


def find_orphans(features: dict) -> list[str]:
    """Find features with no dependencies and not depended upon."""
    # Build reverse dependency map
    depended_upon = set()
    for f in features.values():
        for dep in f.get('deps', []):
            dep_faj = dep.get('faj', '').replace(' ', '_')
            if dep_faj.startswith('FAJ'):
                depended_upon.add(dep_faj)

    orphans = []
    for faj_key, f in features.items():
        has_deps = bool(f.get('deps'))
        is_depended_upon = faj_key in depended_upon
        if not has_deps and not is_depended_upon:
            orphans.append(faj_key)

    return orphans


def find_top_features(features: dict, by: str = 'params', limit: int = 10) -> list[tuple]:
    """Find top features by param/counter count."""
    if by == 'params':
        items = [(f['name'], f.get('acronym'), len(f.get('params', []))) for f in features.values()]
    else:
        items = [(f['name'], f.get('acronym'), len(f.get('counters', []))) for f in features.values()]

    items.sort(key=lambda x: x[2], reverse=True)
    return items[:limit]


def print_report(features: dict, show_gaps: bool = True, show_stats: bool = True, show_orphans: bool = True):
    """Print full audit report."""
    total = len(features)
    print("=" * 60)
    print("ERICSSON RAN FEATURES DATA QUALITY AUDIT")
    print("=" * 60)
    print(f"\nTotal Features: {total}\n")

    if show_gaps:
        gap_analysis = analyze_gaps(features)
        print("-" * 40)
        print("DATA GAPS")
        print("-" * 40)
        gaps = gap_analysis['gaps']
        for gap_type, count in sorted(gaps.items(), key=lambda x: x[1], reverse=True):
            label = gap_type.replace('missing_', '').replace('_', ' ').title()
            pct = count / total * 100
            bar = '#' * int(pct / 5)
            print(f"  {label:15} {count:4} ({pct:5.1f}%) {bar}")
        print()

    if show_stats:
        stats = analyze_stats(features)
        print("-" * 40)
        print("ACCESS TYPE DISTRIBUTION")
        print("-" * 40)
        for access, count in stats['access_distribution'].items():
            pct = count / total * 100
            print(f"  {access:12} {count:4} ({pct:5.1f}%)")
        print()

        print("-" * 40)
        print("LICENSE DISTRIBUTION")
        print("-" * 40)
        for license_type, count in stats['license_distribution'].items():
            pct = count / total * 100
            print(f"  {license_type:12} {count:4} ({pct:5.1f}%)")
        print()

        print("-" * 40)
        print("PARAMETER STATISTICS")
        print("-" * 40)
        ps = stats['parameters']
        print(f"  Total parameters:     {ps['total']}")
        print(f"  Avg per feature:      {ps['avg_per_feature']}")
        print(f"  Max per feature:      {ps['max']}")
        print(f"  Features with params: {ps['features_with_params']}")
        print()

        print("-" * 40)
        print("COUNTER STATISTICS")
        print("-" * 40)
        cs = stats['counters']
        print(f"  Total counters:         {cs['total']}")
        print(f"  Avg per feature:        {cs['avg_per_feature']}")
        print(f"  Max per feature:        {cs['max']}")
        print(f"  Features with counters: {cs['features_with_counters']}")
        print()

        print("-" * 40)
        print("TOP 5 FEATURES BY PARAMETER COUNT")
        print("-" * 40)
        for name, acronym, count in find_top_features(features, 'params', 5):
            label = f"[{acronym}]" if acronym else ""
            print(f"  {count:3} params - {name[:40]} {label}")
        print()

        print("-" * 40)
        print("TOP 5 FEATURES BY COUNTER COUNT")
        print("-" * 40)
        for name, acronym, count in find_top_features(features, 'counters', 5):
            label = f"[{acronym}]" if acronym else ""
            print(f"  {count:3} counters - {name[:40]} {label}")
        print()

    if show_orphans:
        orphans = find_orphans(features)
        print("-" * 40)
        print(f"ORPHAN FEATURES (no dependencies)")
        print("-" * 40)
        print(f"  Total orphans: {len(orphans)} ({len(orphans)/total*100:.1f}%)")
        print()


def main():
    parser = argparse.ArgumentParser(description='Audit Ericsson RAN features data quality')
    parser.add_argument('--gaps', action='store_true', help='Show only gap analysis')
    parser.add_argument('--stats', action='store_true', help='Show only statistics')
    parser.add_argument('--orphans', action='store_true', help='Show only orphan features')
    parser.add_argument('--json', '-j', action='store_true', help='Output as JSON')

    args = parser.parse_args()

    features = load_features()

    if args.json:
        report = {
            'total_features': len(features),
            'gaps': analyze_gaps(features),
            'stats': analyze_stats(features),
            'orphans': find_orphans(features)
        }
        print(json.dumps(report, indent=2))
        return

    # Determine what to show
    show_gaps = args.gaps or not (args.stats or args.orphans)
    show_stats = args.stats or not (args.gaps or args.orphans)
    show_orphans = args.orphans or not (args.gaps or args.stats)

    print_report(features, show_gaps, show_stats, show_orphans)


if __name__ == '__main__':
    main()
