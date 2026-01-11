#!/usr/bin/env python3
"""
Ericsson RAN Features Search Utility
Query features by acronym, name, parameter, domain, etc.
"""

import json
import sys
import argparse
from pathlib import Path
from typing import Any, Dict, List, Optional
from dataclasses import dataclass

@dataclass
class SearchConfig:
    """Configuration for search operations"""
    skill_path: str = ".claude/skills/ericsson-ran-features/references"

    def get_absolute_path(self) -> Path:
        """Get absolute path to skill data"""
        return Path(self.skill_path).resolve()


class FeatureDatabase:
    """Load and query Ericsson RAN feature database"""

    def __init__(self, skill_path: str = ".claude/skills/ericsson-ran-features/references"):
        self.skill_path = Path(skill_path).resolve()
        self.features: Dict[str, Dict[str, Any]] = {}
        self.parameters: Dict[str, List[Dict[str, Any]]] = {}
        self.counters: List[Dict[str, Any]] = []
        self.kpis: List[Dict[str, Any]] = []
        self.acronym_index: Dict[str, str] = {}
        self.category_index: Dict[str, List[str]] = {}
        self.search_index: Dict[str, List[str]] = {}

        self._load_data()

    def _load_json(self, filename: str) -> Any:
        """Load JSON file from skill path"""
        filepath = self.skill_path / filename
        if not filepath.exists():
            print(f"Warning: {filename} not found at {filepath}", file=sys.stderr)
            return {} if filename.endswith('index_') or filename == 'parameters.json' else []

        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _load_data(self):
        """Load all feature data"""
        # Load main features
        self.features = self._load_json('features.json')
        self.parameters = self._load_json('parameters.json')
        self.counters = self._load_json('counters.json')
        self.kpis = self._load_json('kpis.json')

        # Load indices
        self.acronym_index = self._load_json('index_acronym.json')
        self.category_index = self._load_json('index_categories.json')
        self.search_index = self._load_json('index_search.json')

    def search_by_acronym(self, acronym: str) -> Optional[Dict[str, Any]]:
        """Find feature by acronym"""
        acronym_upper = acronym.upper()

        # Search in acronym index
        for faj_code, feature_acronym in self.acronym_index.items():
            if feature_acronym.upper() == acronym_upper:
                return self.features.get(faj_code)

        # Direct search in features
        for faj_code, feature in self.features.items():
            if feature.get('acronym', '').upper() == acronym_upper:
                return feature

        return None

    def search_by_name(self, name: str) -> List[Dict[str, Any]]:
        """Find features by name substring"""
        name_lower = name.lower()
        results = []

        for faj_code, feature in self.features.items():
            if name_lower in feature.get('name', '').lower():
                results.append(feature)

        return results

    def search_by_parameter(self, param_name: str) -> List[Dict[str, Any]]:
        """Find features that use a parameter"""
        param_lower = param_name.lower()
        results = []

        for faj_code, feature in self.features.items():
            params = feature.get('params', [])
            if any(param_lower in p.lower() for p in params):
                results.append(feature)

        return results

    def search_by_domain(self, domain: str) -> List[Dict[str, Any]]:
        """Find features by domain/category"""
        domain_lower = domain.lower()
        results = []

        for faj_code, feature in self.features.items():
            # Check category
            if domain_lower in feature.get('category', '').lower():
                results.append(feature)
                continue

            # Check name contains domain
            if domain_lower in feature.get('name', '').lower():
                results.append(feature)

        return results

    def search_by_faj(self, faj_code: str) -> Optional[Dict[str, Any]]:
        """Find feature by FAJ code"""
        # Normalize FAJ code
        normalized = faj_code.replace(' ', '_')
        return self.features.get(normalized)

    def get_stats(self) -> Dict[str, int]:
        """Get database statistics"""
        return {
            'total_features': len(self.features),
            'total_parameters': len(self.parameters),
            'total_counters': len(self.counters),
            'total_kpis': len(self.kpis),
            'total_acronyms': len(self.acronym_index),
        }


def format_brief(feature: Dict[str, Any]) -> str:
    """Format feature as brief output"""
    lines = [
        f"Name: {feature.get('name', 'N/A')}",
        f"Acronym: {feature.get('acronym', 'N/A')}",
        f"FAJ: {feature.get('faj', 'N/A')}",
        f"CXC: {feature.get('cxc', 'N/A')}",
        f"Access: {', '.join(feature.get('access', []))}",
        f"Parameters: {len(feature.get('params', []))}",
    ]
    return '\n'.join(lines)


def format_markdown(feature: Dict[str, Any]) -> str:
    """Format feature as markdown"""
    lines = [
        f"# {feature.get('name', 'Unknown Feature')}",
        "",
        f"**Acronym:** {feature.get('acronym', 'N/A')}",
        f"**FAJ Code:** {feature.get('faj', 'N/A')}",
        f"**CXC Code:** {feature.get('cxc', 'N/A')}",
        f"**License Required:** {feature.get('license', False)}",
        "",
        "## Summary",
        f"{feature.get('summary', 'No summary available')}",
        "",
        "## Access Technology",
        f"- {', '.join(feature.get('access', ['Unknown']))}",
        "",
        "## Parameters",
        f"Total: {len(feature.get('params', []))}",
        "",
    ]

    # Add first 10 parameters
    params = feature.get('params', [])[:10]
    if params:
        lines.append("### Sample Parameters")
        for param in params:
            lines.append(f"- `{param}`")
        if len(feature.get('params', [])) > 10:
            lines.append(f"- ... and {len(feature.get('params', [])) - 10} more parameters")

    return '\n'.join(lines)


def format_cmedit(feature: Dict[str, Any]) -> str:
    """Format feature as cmedit commands"""
    faj = feature.get('faj', '').replace(' ', '_')
    acronym = feature.get('acronym', 'UNKNOWN')

    lines = [
        f"# cmedit commands for {acronym} ({faj})",
        "",
        "# Configuration access",
        f"cmedit get {faj}/config",
        f"cmedit set {faj}/enabled true",
        "",
        "# Parameter configuration",
    ]

    # Add sample parameter commands
    for param in feature.get('params', [])[:5]:
        lines.append(f"cmedit set {param} <value>")

    if len(feature.get('params', [])) > 5:
        lines.append(f"# ... {len(feature.get('params', [])) - 5} more parameters available")

    return '\n'.join(lines)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Ericsson RAN Features Search Utility'
    )
    parser.add_argument('--skill-path', default='.claude/skills/ericsson-ran-features/references',
                       help='Path to skill data')
    parser.add_argument('--acronym', help='Search by feature acronym (e.g., IFLB, MSM)')
    parser.add_argument('--name', help='Search by feature name')
    parser.add_argument('--param', help='Search by parameter name')
    parser.add_argument('--domain', help='Search by domain/category')
    parser.add_argument('--faj', help='Search by FAJ code')
    parser.add_argument('--stats', action='store_true', help='Show database statistics')
    parser.add_argument('--brief', action='store_true', help='Brief output format')
    parser.add_argument('--markdown', action='store_true', help='Markdown output format')
    parser.add_argument('--cmedit', action='store_true', help='cmedit commands output')

    args = parser.parse_args()

    # Load database
    try:
        db = FeatureDatabase(args.skill_path)
    except Exception as e:
        print(f"Error loading database: {e}", file=sys.stderr)
        return 1

    # Show stats if requested
    if args.stats:
        stats = db.get_stats()
        for key, value in stats.items():
            print(f"{key}: {value}")
        return 0

    # Perform search
    result = None
    results = []

    if args.acronym:
        result = db.search_by_acronym(args.acronym)
        if result:
            results = [result]
    elif args.name:
        results = db.search_by_name(args.name)
    elif args.param:
        results = db.search_by_parameter(args.param)
    elif args.domain:
        results = db.search_by_domain(args.domain)
    elif args.faj:
        result = db.search_by_faj(args.faj)
        if result:
            results = [result]

    if not results:
        print("No features found", file=sys.stderr)
        return 1

    # Format output
    for i, feature in enumerate(results):
        if i > 0:
            print("\n" + "="*70 + "\n")

        if args.markdown:
            print(format_markdown(feature))
        elif args.cmedit:
            print(format_cmedit(feature))
        else:  # Default brief format
            print(format_brief(feature))

    return 0


if __name__ == '__main__':
    sys.exit(main())
