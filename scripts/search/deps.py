#!/usr/bin/env python3
"""
Dependency Graph Analyzer for Ericsson RAN Features
Analyzes feature dependencies, conflicts, and relationships.
"""

import json
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Set, Optional
from collections import defaultdict, deque


class DependencyAnalyzer:
    """Analyze feature dependencies and relationships"""

    def __init__(self, skill_path: str = ".claude/skills/ericsson-ran-features/references"):
        self.skill_path = Path(skill_path).resolve()
        self.features: Dict[str, Dict] = {}
        self.dependency_graph: Dict[str, List[str]] = defaultdict(list)
        self.conflict_graph: Dict[str, List[str]] = defaultdict(list)
        self.feature_by_acronym: Dict[str, str] = {}

        self._load_data()

    def _load_json(self, filename: str) -> any:
        """Load JSON file"""
        filepath = self.skill_path / filename
        if not filepath.exists():
            return {} if 'index' in filename else []

        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _load_data(self):
        """Load feature and dependency data"""
        # Load features
        self.features = self._load_json('features.json')

        # Load dependency graph - it has complex structure with edges grouped by type
        dep_graph = self._load_json('dependency_graph.json')
        if isinstance(dep_graph, dict) and 'edges' in dep_graph:
            # Build dependency map from edges
            for edge_type, edges in dep_graph['edges'].items():
                if isinstance(edges, list):
                    for edge in edges:
                        from_node = edge.get('from')
                        to_node = edge.get('to')
                        if from_node and to_node:
                            if from_node not in self.dependency_graph:
                                self.dependency_graph[from_node] = []
                            self.dependency_graph[from_node].append(to_node)
        elif isinstance(dep_graph, dict):
            # Fallback for simpler structure
            self.dependency_graph = dep_graph

        # Build acronym index - acronym maps TO faj code
        acronym_index = self._load_json('index_acronym.json')
        for acronym, faj_code in acronym_index.items():
            self.feature_by_acronym[acronym.upper()] = faj_code

    def get_feature_by_acronym(self, acronym: str) -> Optional[str]:
        """Get FAJ code by acronym"""
        return self.feature_by_acronym.get(acronym.upper())

    def get_dependencies(self, faj_code: str, recursive: bool = False) -> List[str]:
        """Get features that a feature depends on"""
        direct_deps = self.dependency_graph.get(faj_code, [])

        if not recursive:
            return direct_deps

        # Recursive dependency resolution with cycle detection
        visited = set()
        to_visit = deque(direct_deps)
        all_deps = []

        while to_visit:
            current = to_visit.popleft()
            if current in visited:
                continue

            visited.add(current)
            all_deps.append(current)

            # Add dependencies of this feature
            for dep in self.dependency_graph.get(current, []):
                if dep not in visited:
                    to_visit.append(dep)

        return all_deps

    def get_dependents(self, faj_code: str, recursive: bool = False) -> List[str]:
        """Get features that depend on this feature"""
        dependents = []

        for feature, deps in self.dependency_graph.items():
            if faj_code in deps:
                dependents.append(feature)

        if not recursive:
            return dependents

        # Recursive dependent resolution
        visited = set()
        to_visit = deque(dependents)
        all_dependents = []

        while to_visit:
            current = to_visit.popleft()
            if current in visited:
                continue

            visited.add(current)
            all_dependents.append(current)

            # Find dependents of this feature
            for feature, deps in self.dependency_graph.items():
                if current in deps and feature not in visited:
                    to_visit.append(feature)

        return all_dependents

    def find_cycles(self) -> List[List[str]]:
        """Find circular dependencies"""
        cycles = []
        visited = set()

        def dfs_cycle(node: str, path: Set[str], stack: List[str]) -> Optional[List[str]]:
            """DFS to find cycles"""
            visited.add(node)
            path.add(node)
            stack.append(node)

            for neighbor in self.dependency_graph.get(node, []):
                if neighbor not in visited:
                    result = dfs_cycle(neighbor, path.copy(), stack.copy())
                    if result:
                        return result
                elif neighbor in path:
                    # Found a cycle
                    cycle_start = stack.index(neighbor)
                    return stack[cycle_start:] + [neighbor]

            path.remove(node)
            stack.pop()
            return None

        for node in self.dependency_graph:
            if node not in visited:
                cycle = dfs_cycle(node, set(), [])
                if cycle and cycle not in cycles:
                    cycles.append(cycle)

        return cycles

    def get_impact_analysis(self, faj_code: str) -> Dict:
        """Analyze impact of changing a feature"""
        return {
            'feature': faj_code,
            'name': self.features.get(faj_code, {}).get('name', 'Unknown'),
            'dependents': self.get_dependents(faj_code, recursive=True),
            'impact_count': len(self.get_dependents(faj_code, recursive=True)),
            'direct_dependents': self.get_dependents(faj_code, recursive=False),
        }

    def format_dependency_tree(self, faj_code: str, max_depth: int = 3) -> str:
        """Format dependencies as a tree"""
        lines = []
        feature = self.features.get(faj_code, {})
        lines.append(f"Feature: {feature.get('name', 'Unknown')} ({faj_code})")
        lines.append("")

        def add_deps(code: str, prefix: str = "", depth: int = 0):
            if depth >= max_depth:
                return

            deps = self.dependency_graph.get(code, [])
            if not deps:
                return

            for i, dep in enumerate(deps):
                is_last = i == len(deps) - 1
                connector = "└── " if is_last else "├── "
                dep_feature = self.features.get(dep, {})
                lines.append(f"{prefix}{connector}{dep_feature.get('name', 'Unknown')} ({dep})")

                next_prefix = prefix + ("    " if is_last else "│   ")
                add_deps(dep, next_prefix, depth + 1)

        lines.append("Dependencies:")
        add_deps(faj_code)
        return '\n'.join(lines)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Dependency Graph Analyzer')
    parser.add_argument('query', nargs='?', help='FAJ code or acronym to analyze')
    parser.add_argument('--skill-path', default='.claude/skills/ericsson-ran-features/references')
    parser.add_argument('--deps', action='store_true', help='Show direct dependencies')
    parser.add_argument('--all-deps', action='store_true', help='Show all dependencies (recursive)')
    parser.add_argument('--dependents', action='store_true', help='Show what depends on this')
    parser.add_argument('--impact', action='store_true', help='Show impact analysis')
    parser.add_argument('--cycles', action='store_true', help='Find circular dependencies')
    parser.add_argument('--tree', action='store_true', help='Show dependency tree')

    args = parser.parse_args()

    try:
        analyzer = DependencyAnalyzer(args.skill_path)
    except Exception as e:
        print(f"Error loading database: {e}", file=sys.stderr)
        return 1

    # Find cycles if requested
    if args.cycles:
        cycles = analyzer.find_cycles()
        if cycles:
            print("Circular dependencies found:")
            for cycle in cycles:
                print(f"  {' -> '.join(cycle)}")
        else:
            print("No circular dependencies found")
        return 0

    if not args.query:
        parser.print_help()
        return 1

    # Resolve acronym to FAJ code if needed
    faj_code = args.query
    if not faj_code.startswith('FAJ'):
        resolved = analyzer.get_feature_by_acronym(args.query)
        if resolved:
            faj_code = resolved
        else:
            # Try as direct FAJ code
            faj_code = args.query.replace(' ', '_')

    # Verify feature exists
    if faj_code not in analyzer.features:
        print(f"Feature not found: {args.query}", file=sys.stderr)
        return 1

    # Show dependency tree (default)
    if args.tree or (not args.deps and not args.all_deps and not args.dependents and not args.impact):
        print(analyzer.format_dependency_tree(faj_code))
        return 0

    # Show direct dependencies
    if args.deps:
        deps = analyzer.get_dependencies(faj_code, recursive=False)
        if deps:
            print(f"Direct dependencies of {faj_code}:")
            for dep in deps:
                feature = analyzer.features.get(dep, {})
                print(f"  {feature.get('name', 'Unknown')} ({dep})")
        else:
            print(f"No direct dependencies found for {faj_code}")
        return 0

    # Show all dependencies (recursive)
    if args.all_deps:
        deps = analyzer.get_dependencies(faj_code, recursive=True)
        if deps:
            print(f"All dependencies of {faj_code} ({len(deps)} total):")
            for dep in deps:
                feature = analyzer.features.get(dep, {})
                print(f"  {feature.get('name', 'Unknown')} ({dep})")
        else:
            print(f"No dependencies found for {faj_code}")
        return 0

    # Show dependents
    if args.dependents:
        dependents = analyzer.get_dependents(faj_code, recursive=True)
        if dependents:
            print(f"Features that depend on {faj_code} ({len(dependents)} total):")
            for dep in dependents:
                feature = analyzer.features.get(dep, {})
                print(f"  {feature.get('name', 'Unknown')} ({dep})")
        else:
            print(f"No features depend on {faj_code}")
        return 0

    # Show impact analysis
    if args.impact:
        impact = analyzer.get_impact_analysis(faj_code)
        print(f"Impact Analysis for {impact['name']}:")
        print(f"  Direct dependents: {len(impact['direct_dependents'])}")
        print(f"  Total impact: {impact['impact_count']} features affected")
        if impact['direct_dependents']:
            print("\n  Direct dependents:")
            for dep in impact['direct_dependents']:
                feature = analyzer.features.get(dep, {})
                print(f"    - {feature.get('name', 'Unknown')} ({dep})")
        return 0

    return 0


if __name__ == '__main__':
    sys.exit(main())
