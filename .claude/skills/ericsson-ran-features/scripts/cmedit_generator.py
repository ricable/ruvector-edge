#!/usr/bin/env python3
"""
cmedit CLI command generator for Ericsson RAN features.
Generates GET, SET, CREATE, DELETE, and ACTION commands from feature data.
"""

import argparse
import json
import sys
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional, List


@dataclass
class CmeditCommand:
    """Represents a single cmedit command."""
    operation: str      # get, set, action, create, delete
    scope: str          # Node/site/collection placeholder
    mo_class: str       # MO class name
    attribute: str      # Attribute name(s) - can be comma-separated for grouped
    value: str          # Value for set operations (optional)
    raw: str            # Full command string
    description: str    # Human-readable description
    attributes: List[str] = None  # List of attributes for grouped commands


@dataclass
class MOClassGroup:
    """Represents grouped parameters for an MO class."""
    mo_class: str
    attributes: List[str]
    param_types: dict  # attribute -> type (Introduced/Affecting/Affected)
    descriptions: dict  # attribute -> description


class CmeditGenerator:
    """Generates cmedit commands from feature data."""

    SITE_PLACEHOLDER = "<SITE_NAME>"
    VALUE_PLACEHOLDER = "<value>"

    def __init__(self, features: dict = None, scope_type: str = "site", collection_name: str = None):
        """
        Initialize the generator.

        Args:
            features: Features dictionary (optional, for lookups)
            scope_type: "site" or "collection"
            collection_name: Name of collection if scope_type is "collection"
        """
        self.features = features or {}
        self.scope_type = scope_type
        self.collection_name = collection_name

    def _get_scope(self) -> str:
        """Get the scope string based on configuration."""
        if self.scope_type == "collection" and self.collection_name:
            return f"--collection {self.collection_name}"
        return self.SITE_PLACEHOLDER

    def _get_scope_prefix(self) -> str:
        """Get scope prefix for commands."""
        if self.scope_type == "collection" and self.collection_name:
            return f"-co {self.collection_name}"
        return self.SITE_PLACEHOLDER

    def _group_params_by_mo_class(self, feature: dict, writable_only: bool = False) -> List[MOClassGroup]:
        """Group parameters by MO class."""
        mo_groups = {}  # mo_class -> MOClassGroup

        for param in feature.get('param_details', []):
            parts = param['name'].split('.')
            if len(parts) != 2:
                continue

            mo_class, attr = parts

            # Skip if we only want writable params
            if writable_only and param['type'] not in ('Introduced', 'Affecting'):
                continue

            if mo_class not in mo_groups:
                mo_groups[mo_class] = MOClassGroup(
                    mo_class=mo_class,
                    attributes=[],
                    param_types={},
                    descriptions={}
                )

            if attr not in mo_groups[mo_class].attributes:
                mo_groups[mo_class].attributes.append(attr)
                mo_groups[mo_class].param_types[attr] = param['type']
                mo_groups[mo_class].descriptions[attr] = param.get('description', '')

        return list(mo_groups.values())

    def generate_get_commands(self, feature: dict) -> List[CmeditCommand]:
        """Generate GET commands grouped by MO class."""
        commands = []
        scope = self._get_scope_prefix()

        mo_groups = self._group_params_by_mo_class(feature, writable_only=False)

        for group in mo_groups:
            if len(group.attributes) == 1:
                # Single attribute
                attr = group.attributes[0]
                cmd = f"cmedit get {scope} {group.mo_class}.{attr}"
                description = f"Read {attr} ({group.param_types[attr]})"
            else:
                # Multiple attributes - use grouped syntax
                attrs_str = ','.join(group.attributes)
                cmd = f"cmedit get {scope} {group.mo_class}.({attrs_str})"
                description = f"Read {len(group.attributes)} params from {group.mo_class}"

            commands.append(CmeditCommand(
                operation='get',
                scope=scope,
                mo_class=group.mo_class,
                attribute=','.join(group.attributes),
                value='',
                raw=cmd,
                description=description,
                attributes=group.attributes
            ))

        return commands

    def generate_get_all_commands(self, feature: dict) -> List[CmeditCommand]:
        """Generate GET commands to read all attributes of each MO class."""
        commands = []
        seen_mo = set()
        scope = self._get_scope_prefix()

        for mo_class in feature.get('mo_classes', []):
            if mo_class in seen_mo or mo_class == 'FeatureState':
                continue
            seen_mo.add(mo_class)

            cmd = f"cmedit get {scope} {mo_class}.*"
            commands.append(CmeditCommand(
                operation='get',
                scope=scope,
                mo_class=mo_class,
                attribute='*',
                value='',
                raw=cmd,
                description=f"Read all {mo_class} attributes"
            ))
        return commands

    def generate_set_commands(self, feature: dict) -> List[CmeditCommand]:
        """Generate SET commands grouped by MO class."""
        commands = []
        scope = self._get_scope_prefix()

        mo_groups = self._group_params_by_mo_class(feature, writable_only=True)

        for group in mo_groups:
            if len(group.attributes) == 1:
                # Single attribute
                attr = group.attributes[0]
                cmd = f"cmedit set {scope} {group.mo_class} {attr}={self.VALUE_PLACEHOLDER}"
                description = f"Set {attr}"
            else:
                # Multiple attributes - show grouped template
                attr_assignments = ','.join(f"{attr}={self.VALUE_PLACEHOLDER}" for attr in group.attributes)
                cmd = f"cmedit set {scope} {group.mo_class} {attr_assignments}"
                description = f"Set {len(group.attributes)} params on {group.mo_class}"

            commands.append(CmeditCommand(
                operation='set',
                scope=scope,
                mo_class=group.mo_class,
                attribute=','.join(group.attributes),
                value=self.VALUE_PLACEHOLDER,
                raw=cmd,
                description=description,
                attributes=group.attributes
            ))

        return commands

    def generate_activation_command(self, feature: dict) -> Optional[CmeditCommand]:
        """Generate feature activation command using CXC code."""
        cxc = feature.get('cxc')
        if not cxc:
            return None

        scope = self._get_scope_prefix()
        cmd = f"cmedit set {scope} FeatureState={cxc} featureState=ACTIVATED"
        return CmeditCommand(
            operation='action',
            scope=scope,
            mo_class='FeatureState',
            attribute='featureState',
            value='ACTIVATED',
            raw=cmd,
            description=f"Activate {feature.get('name', 'feature')}"
        )

    def generate_deactivation_command(self, feature: dict) -> Optional[CmeditCommand]:
        """Generate feature deactivation command."""
        cxc = feature.get('cxc')
        if not cxc:
            return None

        scope = self._get_scope_prefix()
        cmd = f"cmedit set {scope} FeatureState={cxc} featureState=DEACTIVATED"
        return CmeditCommand(
            operation='action',
            scope=scope,
            mo_class='FeatureState',
            attribute='featureState',
            value='DEACTIVATED',
            raw=cmd,
            description=f"Deactivate {feature.get('name', 'feature')}"
        )

    def generate_check_feature_state(self, feature: dict) -> Optional[CmeditCommand]:
        """Generate command to check current feature state."""
        cxc = feature.get('cxc')
        if not cxc:
            return None

        scope = self._get_scope_prefix()
        cmd = f"cmedit get {scope} FeatureState={cxc} featureState,licenseState,serviceState"
        return CmeditCommand(
            operation='get',
            scope=scope,
            mo_class='FeatureState',
            attribute='featureState,licenseState,serviceState',
            value='',
            raw=cmd,
            description="Check feature state and license"
        )

    def generate_all_commands(self, feature: dict) -> dict:
        """Generate all cmedit commands for a feature."""
        return {
            'feature': {
                'name': feature.get('name'),
                'acronym': feature.get('acronym'),
                'faj': feature.get('faj'),
                'cxc': feature.get('cxc'),
            },
            'get': self.generate_get_commands(feature),
            'get_all': self.generate_get_all_commands(feature),
            'set': self.generate_set_commands(feature),
            'activate': self.generate_activation_command(feature),
            'deactivate': self.generate_deactivation_command(feature),
            'check_state': self.generate_check_feature_state(feature),
        }


def format_commands_text(commands: dict) -> str:
    """Format commands as plain text with comments, grouped by MO class."""
    lines = []
    feat = commands['feature']

    lines.append(f"# {feat['name']} [{feat['acronym'] or ''}]")
    lines.append(f"# FAJ: {feat['faj']} | CXC: {feat['cxc'] or 'N/A'}")
    lines.append("")

    # Feature state check
    if commands['check_state']:
        lines.append("## Check Feature State")
        lines.append(commands['check_state'].raw)
        lines.append("")

    # GET commands grouped by MO class
    if commands['get']:
        lines.append("## Read Parameters (grouped by MO Class)")
        for cmd in commands['get']:
            lines.append(f"# {cmd.mo_class} ({len(cmd.attributes) if cmd.attributes else 1} params)")
            lines.append(cmd.raw)
        lines.append("")

    # SET commands grouped by MO class
    if commands['set']:
        lines.append("## Modify Parameters (grouped by MO Class)")
        for cmd in commands['set']:
            lines.append(f"# {cmd.mo_class} - {cmd.description}")
            lines.append(cmd.raw)
        lines.append("")

    # Activation/Deactivation
    if commands['activate']:
        lines.append("## Activation")
        lines.append(commands['activate'].raw)

    if commands['deactivate']:
        lines.append("")
        lines.append("## Deactivation")
        lines.append(commands['deactivate'].raw)

    return '\n'.join(lines)


def format_commands_markdown(commands: dict) -> str:
    """Format commands as markdown with tables and code blocks, grouped by MO class."""
    lines = []
    feat = commands['feature']

    lines.append(f"### cmedit Commands for {feat['name']}")
    if feat['acronym']:
        lines[-1] += f" [{feat['acronym']}]"
    lines.append("")
    lines.append(f"**FAJ:** {feat['faj']} | **CXC:** {feat['cxc'] or 'N/A'}")
    lines.append("")

    # Feature state check
    if commands['check_state']:
        lines.append("#### Check Feature State")
        lines.append("```bash")
        lines.append(commands['check_state'].raw)
        lines.append("```")
        lines.append("")

    # GET commands grouped by MO class
    if commands['get']:
        lines.append("#### Read Parameters (by MO Class)")
        lines.append("")
        lines.append("| MO Class | Parameters | Command |")
        lines.append("|----------|------------|---------|")
        for cmd in commands['get']:
            attr_count = len(cmd.attributes) if cmd.attributes else 1
            attrs_display = f"{attr_count} params" if attr_count > 1 else cmd.attribute
            # Truncate long commands in table
            cmd_display = cmd.raw if len(cmd.raw) < 80 else cmd.raw[:77] + "..."
            lines.append(f"| {cmd.mo_class} | {attrs_display} | `{cmd_display}` |")
        lines.append("")

        # Also show full commands in code block for copy-paste
        lines.append("```bash")
        for cmd in commands['get']:
            lines.append(f"# {cmd.mo_class}")
            lines.append(cmd.raw)
        lines.append("```")
        lines.append("")

    # SET commands grouped by MO class
    if commands['set']:
        lines.append("#### Modify Parameters (by MO Class)")
        lines.append("```bash")
        for cmd in commands['set']:
            lines.append(f"# {cmd.mo_class} - {cmd.description}")
            lines.append(cmd.raw)
        lines.append("```")
        lines.append("")

    # Activation/Deactivation
    if commands['activate'] or commands['deactivate']:
        lines.append("#### Feature Activation/Deactivation")
        lines.append("```bash")
        if commands['activate']:
            lines.append("# Activate feature")
            lines.append(commands['activate'].raw)
        if commands['deactivate']:
            lines.append("")
            lines.append("# Deactivate feature")
            lines.append(commands['deactivate'].raw)
        lines.append("```")

    return '\n'.join(lines)


def format_commands_script(commands: dict, site_name: str = "<SITE_NAME>") -> str:
    """Format commands as executable shell script, grouped by MO class."""
    lines = []
    feat = commands['feature']

    lines.append("#!/bin/bash")
    lines.append(f"# cmedit commands for {feat['name']} [{feat['acronym'] or ''}]")
    lines.append(f"# FAJ: {feat['faj']} | CXC: {feat['cxc'] or 'N/A'}")
    lines.append("# Generated by ericsson-ran-features skill")
    lines.append("# Commands are grouped by MO Class for efficiency")
    lines.append("")
    lines.append(f'SITE="{site_name}"')
    lines.append("")

    # Check feature state
    if commands['check_state']:
        cmd = commands['check_state'].raw.replace("<SITE_NAME>", "$SITE")
        lines.append("# Check current feature state")
        lines.append('echo "Checking feature state..."')
        lines.append(cmd)
        lines.append("")

    # GET commands grouped by MO class
    if commands['get']:
        lines.append("# Read current parameter values (grouped by MO Class)")
        for cmd in commands['get']:
            cmd_str = cmd.raw.replace("<SITE_NAME>", "$SITE")
            attr_count = len(cmd.attributes) if cmd.attributes else 1
            lines.append(f'echo "Reading {cmd.mo_class} ({attr_count} params)..."')
            lines.append(cmd_str)
        lines.append("")

    # SET commands grouped by MO class (commented by default for safety)
    if commands['set']:
        lines.append("# Modify parameters (uncomment and set values to execute)")
        lines.append("# Commands are grouped by MO Class")
        for cmd in commands['set']:
            cmd_str = cmd.raw.replace("<SITE_NAME>", "$SITE")
            lines.append(f"# {cmd.mo_class}:")
            lines.append(f"# {cmd_str}")
        lines.append("")

    # Activation (commented by default for safety)
    if commands['activate']:
        cmd = commands['activate'].raw.replace("<SITE_NAME>", "$SITE")
        lines.append("# Activate feature (uncomment to execute)")
        lines.append(f"# {cmd}")

    if commands['deactivate']:
        cmd = commands['deactivate'].raw.replace("<SITE_NAME>", "$SITE")
        lines.append("")
        lines.append("# Deactivate feature (uncomment to execute)")
        lines.append(f"# {cmd}")

    return '\n'.join(lines)


def format_commands_json(commands: dict) -> str:
    """Format commands as JSON for automation."""
    def cmd_to_dict(cmd):
        if cmd is None:
            return None
        return asdict(cmd)

    output = {
        'feature': commands['feature'],
        'commands': {
            'get': [cmd_to_dict(c) for c in commands['get']],
            'get_all': [cmd_to_dict(c) for c in commands['get_all']],
            'set': [cmd_to_dict(c) for c in commands['set']],
            'activate': cmd_to_dict(commands['activate']),
            'deactivate': cmd_to_dict(commands['deactivate']),
            'check_state': cmd_to_dict(commands['check_state']),
        }
    }
    return json.dumps(output, indent=2, ensure_ascii=False)


def load_features(script_dir: Path) -> dict:
    """Load features index."""
    ref_dir = script_dir.parent / 'references'
    features_file = ref_dir / 'features.json'

    if not features_file.exists():
        print(f"Error: features.json not found at {features_file}", file=sys.stderr)
        sys.exit(1)

    with open(features_file) as f:
        return json.load(f)


def find_feature(features: dict, query: str) -> tuple:
    """Find feature by FAJ, CXC, or name/acronym."""
    query_normalized = query.strip().upper().replace(' ', '_')

    # Try FAJ lookup
    if not query_normalized.startswith('FAJ'):
        faj_key = 'FAJ_' + query_normalized.replace(' ', '_')
    else:
        faj_key = query_normalized

    if faj_key in features:
        return (faj_key, features[faj_key])

    # Try CXC lookup
    query_upper = query.upper().strip()
    for faj_key, feature in features.items():
        if feature.get('cxc') and query_upper == feature['cxc'].upper():
            return (faj_key, feature)

    # Try acronym lookup (exact match)
    query_lower = query.lower()
    for faj_key, feature in features.items():
        if feature.get('acronym', '').lower() == query_lower:
            return (faj_key, feature)

    # Try name lookup (contains)
    for faj_key, feature in features.items():
        if query_lower in feature['name'].lower():
            return (faj_key, feature)

    return (None, None)


def main():
    parser = argparse.ArgumentParser(
        description='Generate cmedit CLI commands for Ericsson RAN features',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Generate commands for a feature by FAJ
  cmedit_generator.py --faj "FAJ 121 4219"
  cmedit_generator.py --faj "121 4219"

  # Generate by CXC code
  cmedit_generator.py --cxc CXC4011808

  # Generate by acronym or name
  cmedit_generator.py --name "IFLB"
  cmedit_generator.py --name "MIMO Sleep"

  # Output formats
  cmedit_generator.py --faj "121 4219" --format text      # Plain text (default)
  cmedit_generator.py --faj "121 4219" --format markdown  # Markdown tables
  cmedit_generator.py --faj "121 4219" --format script    # Shell script
  cmedit_generator.py --faj "121 4219" --format json      # JSON for automation

  # Collection-scoped commands
  cmedit_generator.py --faj "121 4219" --scope collection --collection-name "my_cells"

  # Specify site name for script output
  cmedit_generator.py --faj "121 4219" --format script --site "PARIS_NORTH_LTE"
        '''
    )

    # Feature selection
    parser.add_argument('--faj', '-f', help='Feature FAJ code (e.g., "FAJ 121 4219" or "121 4219")')
    parser.add_argument('--cxc', '-c', help='Feature CXC activation code (e.g., CXC4011808)')
    parser.add_argument('--name', '-n', help='Feature name or acronym (e.g., "IFLB" or "MIMO Sleep")')

    # Output format
    parser.add_argument('--format', '-F', choices=['text', 'markdown', 'script', 'json'],
                       default='text', help='Output format (default: text)')

    # Scope options
    parser.add_argument('--scope', '-S', choices=['site', 'collection'],
                       default='site', help='Scope type (default: site)')
    parser.add_argument('--collection-name', '-C',
                       help='Collection name (required if scope is collection)')
    parser.add_argument('--site', '-s', default='<SITE_NAME>',
                       help='Site/node name to use in script output (default: <SITE_NAME>)')

    args = parser.parse_args()

    # Validate collection scope
    if args.scope == 'collection' and not args.collection_name:
        print("Error: --collection-name is required when --scope is collection", file=sys.stderr)
        sys.exit(1)

    # Load features
    script_dir = Path(__file__).parent
    features = load_features(script_dir)

    # Find feature
    query = args.faj or args.cxc or args.name
    if not query:
        parser.print_help()
        sys.exit(1)

    faj_key, feature = find_feature(features, query)
    if not feature:
        print(f"Feature not found: {query}", file=sys.stderr)
        sys.exit(1)

    # Generate commands
    generator = CmeditGenerator(
        features=features,
        scope_type=args.scope,
        collection_name=args.collection_name
    )
    commands = generator.generate_all_commands(feature)

    # Format and output
    if args.format == 'text':
        print(format_commands_text(commands))
    elif args.format == 'markdown':
        print(format_commands_markdown(commands))
    elif args.format == 'script':
        print(format_commands_script(commands, args.site))
    elif args.format == 'json':
        print(format_commands_json(commands))


if __name__ == '__main__':
    main()
