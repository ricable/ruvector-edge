#!/usr/bin/env python3
"""
Validate feature coexistence for Ericsson RAN features.
Check if a set of features can be activated together without conflicts.

Usage:
  validate.py IFLB DUAC MSM                # Check by acronyms
  validate.py --faj "121 3009" "121 4219"  # Check by FAJ codes
  validate.py --file features.txt          # Read from file (one per line)
  validate.py IFLB DUAC --verbose          # Detailed conflict analysis
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


def normalize_faj(faj: str) -> str:
    """Normalize FAJ code to key format."""
    faj = faj.strip().upper()
    if faj.startswith('FAJ'):
        faj = faj[3:].strip()
    faj = faj.replace('_', ' ').strip()
    parts = faj.split()
    if len(parts) >= 2:
        return f"FAJ_{parts[0]}_{parts[1]}"
    return f"FAJ_{faj.replace(' ', '_')}"


def find_feature(features: dict, query: str) -> tuple[str, dict] | None:
    """Find a feature by FAJ code, acronym, or name."""
    query = query.strip()

    # Try FAJ lookup
    query_normalized = normalize_faj(query)
    if query_normalized in features:
        return (query_normalized, features[query_normalized])

    # Try with FAJ prefix
    if not query.upper().startswith('FAJ'):
        query_normalized = normalize_faj(f"FAJ {query}")
        if query_normalized in features:
            return (query_normalized, features[query_normalized])

    # Try acronym match (exact)
    query_upper = query.upper()
    for faj_key, feature in features.items():
        if feature.get('acronym', '').upper() == query_upper:
            return (faj_key, feature)

    # Try acronym partial match (for compound acronyms like UTA-IFLB)
    for faj_key, feature in features.items():
        acronym = feature.get('acronym', '').upper()
        if acronym.endswith('-' + query_upper) or acronym.endswith(query_upper):
            return (faj_key, feature)

    # Try name match (partial, case-insensitive)
    query_lower = query.lower()
    for faj_key, feature in features.items():
        if query_lower in feature['name'].lower():
            return (faj_key, feature)

    return None


def validate_coexistence(feature_queries: list, features: dict) -> dict:
    """Validate if features can coexist.

    Returns:
        dict with:
        - can_coexist: bool
        - resolved: list of resolved features
        - not_found: list of queries that couldn't be resolved
        - conflicts: list of conflict pairs
        - conflict_details: detailed conflict info
        - missing_prerequisites: dict of feature -> missing prereqs
        - warnings: list of potential issues
    """
    result = {
        'can_coexist': True,
        'resolved': [],
        'not_found': [],
        'conflicts': [],
        'conflict_details': [],
        'missing_prerequisites': {},
        'warnings': []
    }

    # Resolve all queries
    resolved_features = {}
    for query in feature_queries:
        found = find_feature(features, query)
        if found:
            faj_key, feature = found
            resolved_features[faj_key] = feature
            result['resolved'].append({
                'query': query,
                'faj': faj_key,
                'name': feature['name'],
                'acronym': feature.get('acronym')
            })
        else:
            result['not_found'].append(query)

    if not resolved_features:
        result['can_coexist'] = False
        return result

    # Check for direct conflicts
    resolved_faj_set = set(resolved_features.keys())

    for faj_key, feature in resolved_features.items():
        for dep in feature.get('deps', []):
            if dep.get('type') == 'Conflicting':
                conflict_faj = normalize_faj(dep.get('faj', ''))

                # Check if conflict is in our set
                if conflict_faj in resolved_faj_set:
                    conflict_pair = tuple(sorted([faj_key, conflict_faj]))
                    if conflict_pair not in result['conflicts']:
                        result['conflicts'].append(conflict_pair)
                        result['conflict_details'].append({
                            'feature1': {
                                'faj': faj_key,
                                'name': feature['name'],
                                'acronym': feature.get('acronym')
                            },
                            'feature2': {
                                'faj': conflict_faj,
                                'name': dep['name'],
                                'acronym': resolved_features.get(conflict_faj, {}).get('acronym')
                            }
                        })
                        result['can_coexist'] = False

    # Check for missing prerequisites
    for faj_key, feature in resolved_features.items():
        missing = []
        for dep in feature.get('deps', []):
            if dep.get('type') == 'Prerequisite':
                prereq_faj = normalize_faj(dep.get('faj', ''))
                if prereq_faj not in resolved_faj_set:
                    # Check if prereq exists in features index
                    if prereq_faj in features:
                        missing.append({
                            'faj': prereq_faj,
                            'name': dep['name'],
                            'in_index': True
                        })
                    else:
                        missing.append({
                            'faj': prereq_faj,
                            'name': dep['name'],
                            'in_index': False
                        })

        if missing:
            result['missing_prerequisites'][faj_key] = {
                'feature_name': feature['name'],
                'acronym': feature.get('acronym'),
                'missing': missing
            }
            result['warnings'].append(
                f"{feature.get('acronym') or feature['name']} requires {len(missing)} prerequisite(s) not in list"
            )

    return result


def print_validation_result(result: dict, verbose: bool = False):
    """Print validation result."""
    print("\n" + "=" * 60)
    print("FEATURE COEXISTENCE VALIDATION")
    print("=" * 60)

    # Show resolved features
    print(f"\nFeatures checked ({len(result['resolved'])}):")
    for f in result['resolved']:
        acronym = f" [{f['acronym']}]" if f.get('acronym') else ""
        print(f"  + {f['name']}{acronym} ({f['faj']})")

    # Show not found
    if result['not_found']:
        print(f"\nNot found ({len(result['not_found'])}):")
        for q in result['not_found']:
            print(f"  x {q}")

    # Show conflicts
    if result['conflicts']:
        print(f"\n{'!'*40}")
        print("CONFLICTS DETECTED")
        print('!'*40)
        for detail in result['conflict_details']:
            f1, f2 = detail['feature1'], detail['feature2']
            a1 = f" [{f1['acronym']}]" if f1.get('acronym') else ""
            a2 = f" [{f2['acronym']}]" if f2.get('acronym') else ""
            print(f"  {f1['name']}{a1}")
            print(f"    CONFLICTS WITH")
            print(f"  {f2['name']}{a2}")
            print()

    # Show missing prerequisites
    if result['missing_prerequisites'] and verbose:
        print(f"\n{'-'*40}")
        print("MISSING PREREQUISITES (warnings)")
        print('-'*40)
        for faj_key, info in result['missing_prerequisites'].items():
            name = info.get('acronym') or info['feature_name']
            print(f"  {name}:")
            for prereq in info['missing']:
                status = "" if prereq['in_index'] else " [not in index]"
                print(f"    - Requires: {prereq['name']} ({prereq['faj']}){status}")

    # Summary
    print("\n" + "=" * 60)
    if result['can_coexist']:
        print("RESULT: Features CAN coexist")
        if result['warnings']:
            print(f"        ({len(result['warnings'])} warning(s) - check prerequisites)")
    else:
        print("RESULT: Features CANNOT coexist")
        print(f"        {len(result['conflicts'])} conflict(s) detected")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description='Validate Ericsson RAN feature coexistence',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  validate.py IFLB DUAC MSM                # Check by acronyms
  validate.py --faj "121 3009" "121 4219"  # Check by FAJ codes
  validate.py IFLB DUAC --verbose          # Detailed analysis
  validate.py --json IFLB DUAC             # JSON output
        '''
    )

    parser.add_argument('features', nargs='*', help='Feature acronyms or names')
    parser.add_argument('--faj', nargs='+', help='FAJ codes to check')
    parser.add_argument('--file', '-f', help='Read features from file (one per line)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Show detailed analysis')
    parser.add_argument('--json', '-j', action='store_true', help='Output as JSON')

    args = parser.parse_args()

    # Collect queries
    queries = []
    if args.faj:
        queries.extend(args.faj)
    if args.features:
        queries.extend(args.features)
    if args.file:
        try:
            with open(args.file) as f:
                queries.extend([line.strip() for line in f if line.strip()])
        except Exception as e:
            print(f"Error reading file: {e}", file=sys.stderr)
            sys.exit(1)

    if len(queries) < 2:
        print("Error: Need at least 2 features to validate coexistence")
        print("Usage: validate.py IFLB DUAC MSM")
        sys.exit(1)

    # Load data and validate
    features = load_features()
    result = validate_coexistence(queries, features)

    if args.json:
        # Convert tuples to lists for JSON serialization
        result['conflicts'] = [list(c) for c in result['conflicts']]
        print(json.dumps(result, indent=2))
    else:
        print_validation_result(result, args.verbose)

    # Exit code: 0 if can coexist, 1 if conflicts
    sys.exit(0 if result['can_coexist'] else 1)


if __name__ == '__main__':
    main()
