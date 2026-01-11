#!/usr/bin/env python3
"""
Dependency chain resolver for Ericsson RAN features.
Shows prerequisites, related features, and conflicts.
"""

import argparse
import json
import sys
from pathlib import Path
from collections import defaultdict


def load_features(script_dir: Path) -> dict:
    """Load feature index."""
    ref_dir = script_dir.parent / 'references'
    features_file = ref_dir / 'features.json'

    if not features_file.exists():
        print(f"Error: features.json not found. Run build_index.py first.", file=sys.stderr)
        sys.exit(1)

    with open(features_file) as f:
        return json.load(f)


def normalize_faj(faj: str) -> str:
    """Normalize FAJ code to key format."""
    return faj.strip().upper().replace(' ', '_')


def find_feature(features: dict, query: str) -> tuple[str, dict] | None:
    """Find a feature by FAJ code, acronym, or name."""
    query = query.strip()

    # Try FAJ lookup first
    query_normalized = normalize_faj(query)
    if not query_normalized.startswith('FAJ'):
        query_normalized = 'FAJ_' + query_normalized.replace(' ', '_')

    if query_normalized in features:
        return (query_normalized, features[query_normalized])

    # Try exact acronym match (case-insensitive)
    query_upper = query.upper()
    for faj_key, feature in features.items():
        if feature.get('acronym', '').upper() == query_upper:
            return (faj_key, feature)

    # Try name contains match
    query_lower = query.lower()
    for faj_key, feature in features.items():
        if query_lower in feature['name'].lower():
            return (faj_key, feature)

    return None


def build_reverse_deps(features: dict) -> dict:
    """Build reverse dependency map (features that depend on each feature)."""
    reverse = defaultdict(list)

    for faj_key, feature in features.items():
        for dep in feature.get('deps', []):
            dep_faj = normalize_faj(dep['faj'])
            reverse[dep_faj].append({
                'faj': faj_key,
                'name': feature['name'],
                'type': dep['type']
            })

    return reverse


def get_prerequisites(feature: dict, features: dict, depth: int = 0, visited: set = None) -> list:
    """Get all prerequisites recursively."""
    if visited is None:
        visited = set()

    prereqs = []
    for dep in feature.get('deps', []):
        if dep['type'] == 'Prerequisite':
            dep_faj = normalize_faj(dep['faj'])

            if dep_faj in visited:
                continue
            visited.add(dep_faj)

            prereq_info = {
                'faj': dep['faj'],
                'name': dep['name'],
                'depth': depth
            }

            # Check if we have this feature in our index
            if dep_faj in features:
                prereq_info['in_index'] = True
                # Recurse to get nested prerequisites
                nested = get_prerequisites(features[dep_faj], features, depth + 1, visited)
                prereq_info['nested_prereqs'] = nested
            else:
                prereq_info['in_index'] = False
                prereq_info['nested_prereqs'] = []

            prereqs.append(prereq_info)

    return prereqs


def print_prereq_tree(prereqs: list, indent: int = 0):
    """Print prerequisites as a tree."""
    for p in prereqs:
        prefix = '  ' * indent + ('└─ ' if indent > 0 else '')
        status = '' if p.get('in_index') else ' [not in index]'
        print(f"{prefix}{p['name']} ({p['faj']}){status}")
        if p.get('nested_prereqs'):
            print_prereq_tree(p['nested_prereqs'], indent + 1)


def show_dependencies(faj_key: str, feature: dict, features: dict, reverse_deps: dict):
    """Display all dependency information for a feature."""
    print(f"\n=== {feature['name']} ===")
    print(f"FAJ: {feature['faj']}")
    if feature.get('cxc'):
        print(f"CXC: {feature['cxc']}")
    print()

    deps = feature.get('deps', [])

    # Prerequisites
    prereqs = [d for d in deps if d['type'] == 'Prerequisite']
    print(f"PREREQUISITES ({len(prereqs)}):")
    if prereqs:
        for d in prereqs:
            dep_faj = normalize_faj(d['faj'])
            in_index = '✓' if dep_faj in features else '✗'
            print(f"  [{in_index}] {d['name']} ({d['faj']})")
    else:
        print("  None")
    print()

    # Full prerequisite tree
    full_prereqs = get_prerequisites(feature, features)
    if full_prereqs:
        print("PREREQUISITE CHAIN:")
        print_prereq_tree(full_prereqs)
        print()

    # Related features
    related = [d for d in deps if d['type'] == 'Related']
    print(f"RELATED FEATURES ({len(related)}):")
    if related:
        for d in related[:10]:
            print(f"  - {d['name']} ({d['faj']})")
        if len(related) > 10:
            print(f"  ... and {len(related) - 10} more")
    else:
        print("  None")
    print()

    # Conflicting features
    conflicts = [d for d in deps if d['type'] == 'Conflicting']
    print(f"CONFLICTS ({len(conflicts)}):")
    if conflicts:
        for d in conflicts:
            print(f"  ⚠ {d['name']} ({d['faj']})")
    else:
        print("  None")
    print()

    # Features that depend on this one
    dependents = reverse_deps.get(faj_key, [])
    print(f"DEPENDED ON BY ({len(dependents)}):")
    if dependents:
        # Group by type
        by_type = defaultdict(list)
        for d in dependents:
            by_type[d['type']].append(d)

        for rel_type in ['Prerequisite', 'Related', 'Conflicting']:
            items = by_type.get(rel_type, [])
            if items:
                print(f"  As {rel_type} ({len(items)}):")
                for d in items[:5]:
                    print(f"    - {d['name']} ({d['faj']})")
                if len(items) > 5:
                    print(f"    ... and {len(items) - 5} more")
    else:
        print("  None")


def show_conflicts(features: dict):
    """Show all features with conflicts."""
    print("\n=== FEATURES WITH CONFLICTS ===\n")

    conflicts_found = []
    for faj_key, feature in features.items():
        deps = feature.get('deps', [])
        conflicts = [d for d in deps if d['type'] == 'Conflicting']
        if conflicts:
            conflicts_found.append((feature['name'], feature['faj'], conflicts))

    conflicts_found.sort(key=lambda x: x[0])

    for name, faj, conflicts in conflicts_found:
        print(f"{name} ({faj}):")
        for c in conflicts:
            print(f"  ⚠ Conflicts with: {c['name']} ({c['faj']})")
        print()

    print(f"Total: {len(conflicts_found)} features with conflicts")


def get_all_prerequisites_flat(feature: dict, features: dict, visited: set = None) -> list:
    """Get all prerequisites recursively as a flat list."""
    if visited is None:
        visited = set()

    result = []
    for dep in feature.get('deps', []):
        if dep['type'] == 'Prerequisite':
            dep_faj = normalize_faj(dep['faj'])
            if dep_faj in visited:
                continue
            visited.add(dep_faj)

            prereq_info = {
                'faj': dep_faj,
                'name': dep['name'],
                'faj_display': dep['faj']
            }

            # Recurse first to get nested prerequisites
            if dep_faj in features:
                nested = get_all_prerequisites_flat(features[dep_faj], features, visited)
                result.extend(nested)

            result.append(prereq_info)

    return result


def compute_activation_order(feature_queries: list, features: dict) -> tuple[list, list, list]:
    """Compute the activation order for multiple features.

    Returns:
        - activation_order: List of features in correct activation sequence
        - conflicts: List of conflict pairs found
        - not_found: List of queries that couldn't be resolved
    """
    # Resolve all feature queries
    resolved = []
    not_found = []

    for query in feature_queries:
        result = find_feature(features, query)
        if result:
            resolved.append(result)
        else:
            not_found.append(query)

    if not resolved:
        return [], [], not_found

    # Collect all prerequisites and the target features
    all_features = {}  # faj_key -> {name, faj_display, is_target}
    conflicts = []

    for faj_key, feature in resolved:
        # Add this feature as a target
        all_features[faj_key] = {
            'name': feature['name'],
            'faj_display': feature['faj'],
            'acronym': feature.get('acronym'),
            'is_target': True
        }

        # Get all prerequisites
        prereqs = get_all_prerequisites_flat(feature, features)
        for p in prereqs:
            if p['faj'] not in all_features:
                all_features[p['faj']] = {
                    'name': p['name'],
                    'faj_display': p['faj_display'],
                    'acronym': None,
                    'is_target': False
                }

        # Check for conflicts
        for dep in feature.get('deps', []):
            if dep['type'] == 'Conflicting':
                conflict_faj = normalize_faj(dep['faj'])
                if conflict_faj in all_features:
                    conflicts.append((feature['name'], dep['name']))

    # Build dependency graph for topological sort
    graph = defaultdict(list)  # node -> list of nodes it depends on
    in_degree = defaultdict(int)

    for faj_key in all_features:
        if faj_key in features:
            feature = features[faj_key]
            for dep in feature.get('deps', []):
                if dep['type'] == 'Prerequisite':
                    dep_faj = normalize_faj(dep['faj'])
                    if dep_faj in all_features:
                        graph[faj_key].append(dep_faj)
                        in_degree[faj_key] += 1

    # Topological sort using Kahn's algorithm
    # Start with nodes that have no prerequisites
    queue = [f for f in all_features if in_degree[f] == 0]
    activation_order = []

    while queue:
        # Sort queue to ensure deterministic output
        queue.sort(key=lambda x: all_features[x]['name'])
        node = queue.pop(0)
        activation_order.append(all_features[node])
        activation_order[-1]['faj_key'] = node

        for dependent, deps in list(graph.items()):
            if node in deps:
                in_degree[dependent] -= 1
                if in_degree[dependent] == 0:
                    queue.append(dependent)

    return activation_order, conflicts, not_found


def generate_mermaid_diagram(faj_key: str, feature: dict, features: dict, reverse_deps: dict) -> str:
    """Generate a mermaid flowchart diagram for feature dependencies.

    Produces a mermaid graph showing:
    - Prerequisites as solid arrows pointing to this feature
    - Conflicts as red dashed lines
    - Dependents (features that depend on this one) as solid arrows from this feature
    """
    lines = ["```mermaid", "flowchart TD"]

    # Add styling
    lines.append("    %% Styling")
    lines.append("    classDef target fill:#4a90d9,stroke:#2c5282,color:white")
    lines.append("    classDef prereq fill:#48bb78,stroke:#276749,color:white")
    lines.append("    classDef conflict fill:#fc8181,stroke:#c53030,color:white")
    lines.append("    classDef dependent fill:#9f7aea,stroke:#6b46c1,color:white")
    lines.append("")

    # Helper to create safe node IDs
    def node_id(faj: str) -> str:
        return faj.replace(' ', '_').replace('-', '_')

    # Helper to create node labels
    def node_label(name: str, acronym: str = None, faj: str = None) -> str:
        if acronym:
            return f"{acronym}"
        short_name = name[:25] + '..' if len(name) > 25 else name
        return short_name

    # Main feature node
    main_id = node_id(faj_key)
    main_label = node_label(feature['name'], feature.get('acronym'), feature['faj'])
    lines.append(f"    %% Target feature")
    lines.append(f"    {main_id}[\"{main_label}<br/><small>{feature['faj']}</small>\"]")
    lines.append(f"    class {main_id} target")
    lines.append("")

    deps = feature.get('deps', [])

    # Prerequisites (arrows from prereq to this feature)
    prereqs = [d for d in deps if d['type'] == 'Prerequisite']
    if prereqs:
        lines.append("    %% Prerequisites")
        for d in prereqs:
            dep_id = node_id(normalize_faj(d['faj']))
            dep_feature = features.get(normalize_faj(d['faj']), {})
            dep_label = node_label(d['name'], dep_feature.get('acronym'), d['faj'])
            lines.append(f"    {dep_id}[\"{dep_label}<br/><small>{d['faj']}</small>\"]")
            lines.append(f"    {dep_id} -->|requires| {main_id}")
            lines.append(f"    class {dep_id} prereq")
        lines.append("")

    # Conflicts (dashed red lines)
    conflicts = [d for d in deps if d['type'] == 'Conflicting']
    if conflicts:
        lines.append("    %% Conflicts")
        for d in conflicts:
            dep_id = node_id(normalize_faj(d['faj']))
            dep_feature = features.get(normalize_faj(d['faj']), {})
            dep_label = node_label(d['name'], dep_feature.get('acronym'), d['faj'])
            lines.append(f"    {dep_id}[\"{dep_label}<br/><small>{d['faj']}</small>\"]")
            lines.append(f"    {main_id} -.-x|conflicts| {dep_id}")
            lines.append(f"    class {dep_id} conflict")
        lines.append("")

    # Dependents (features that depend on this one, limit to 5)
    dependents = reverse_deps.get(faj_key, [])
    prereq_dependents = [d for d in dependents if d['type'] == 'Prerequisite'][:5]
    if prereq_dependents:
        lines.append("    %% Dependents (features requiring this)")
        for d in prereq_dependents:
            dep_id = node_id(d['faj'])
            dep_feature = features.get(d['faj'], {})
            dep_label = node_label(d['name'], dep_feature.get('acronym'))
            lines.append(f"    {dep_id}[\"{dep_label}\"]")
            lines.append(f"    {main_id} -->|enables| {dep_id}")
            lines.append(f"    class {dep_id} dependent")
        if len([d for d in dependents if d['type'] == 'Prerequisite']) > 5:
            lines.append(f"    more_deps([+{len([d for d in dependents if d['type'] == 'Prerequisite']) - 5} more])")
            lines.append(f"    {main_id} --> more_deps")
        lines.append("")

    lines.append("```")
    return '\n'.join(lines)


def show_activation_order(feature_queries: list, features: dict):
    """Display the activation order for multiple features."""
    activation_order, conflicts, not_found = compute_activation_order(feature_queries, features)

    print("\n=== ACTIVATION ORDER ===\n")

    if not_found:
        print("Features not found:")
        for q in not_found:
            print(f"  ✗ {q}")
        print()

    if conflicts:
        print("⚠ CONFLICTS DETECTED:")
        for f1, f2 in conflicts:
            print(f"  ⚠ {f1} conflicts with {f2}")
        print()

    if activation_order:
        print("Activation sequence:")
        for i, f in enumerate(activation_order, 1):
            marker = "→" if f['is_target'] else " "
            acronym = f" [{f['acronym']}]" if f.get('acronym') else ""
            print(f"  {i}. {marker} {f['name']}{acronym} ({f['faj_display']})")

        # Summary
        targets = [f for f in activation_order if f['is_target']]
        prereqs = [f for f in activation_order if not f['is_target']]
        print(f"\nSummary: {len(prereqs)} prerequisite(s) + {len(targets)} target feature(s)")
    else:
        print("No features to activate.")


def main():
    parser = argparse.ArgumentParser(
        description='Show dependencies for Ericsson RAN features',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  deps.py "FAJ 121 4219"                    # Show dependencies for feature
  deps.py "IFLB"                            # Search by name
  deps.py --reverse "FAJ 121 3009"          # Features that depend on this
  deps.py --conflicts                       # List all features with conflicts
  deps.py --json "FAJ 121 4219"             # Output as JSON
  deps.py --mermaid IFLB                    # Generate mermaid diagram
  deps.py --activation-order IFLB DUAC MSM  # Compute activation sequence
        '''
    )

    parser.add_argument('query', nargs='*', help='FAJ code(s) or feature name(s)')
    parser.add_argument('--reverse', '-r', action='store_true',
                       help='Show features that depend on the specified feature')
    parser.add_argument('--conflicts', '-c', action='store_true',
                       help='Show all features with conflicts')
    parser.add_argument('--json', '-j', action='store_true',
                       help='Output as JSON')
    parser.add_argument('--mermaid', '-m', action='store_true',
                       help='Generate mermaid diagram for visualization')
    parser.add_argument('--activation-order', '-a', action='store_true',
                       help='Compute activation order for multiple features')

    args = parser.parse_args()

    # Load features
    script_dir = Path(__file__).parent
    features = load_features(script_dir)
    reverse_deps = build_reverse_deps(features)

    if args.conflicts:
        show_conflicts(features)
        return

    if args.activation_order:
        if not args.query:
            print("Error: --activation-order requires at least one feature")
            sys.exit(1)
        show_activation_order(args.query, features)
        return

    if not args.query:
        parser.print_help()
        sys.exit(1)

    # For single feature operations, use first query
    query = args.query[0] if args.query else None

    # Find the feature
    result = find_feature(features, query)
    if not result:
        print(f"Feature not found: {query}")
        sys.exit(1)

    faj_key, feature = result

    if args.json:
        output = {
            'feature': feature,
            'reverse_deps': reverse_deps.get(faj_key, [])
        }
        print(json.dumps(output, indent=2, ensure_ascii=False))
    elif args.mermaid:
        diagram = generate_mermaid_diagram(faj_key, feature, features, reverse_deps)
        print(diagram)
    elif args.reverse:
        dependents = reverse_deps.get(faj_key, [])
        print(f"\nFeatures that depend on {feature['name']} ({feature['faj']}):\n")
        if dependents:
            for d in dependents:
                print(f"  [{d['type']}] {d['name']} ({d['faj']})")
        else:
            print("  None")
    else:
        show_dependencies(faj_key, feature, features, reverse_deps)


if __name__ == '__main__':
    main()
