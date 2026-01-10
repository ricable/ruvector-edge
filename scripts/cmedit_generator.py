#!/usr/bin/env python3
"""
cmedit Command Generator for Ericsson RAN Features
Generates configuration commands for feature deployment
"""

import json
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime


class CMEditGenerator:
    """Generate cmedit configuration commands"""

    def __init__(self, skill_path: str = ".claude/skills/ericsson-ran-features/references"):
        self.skill_path = Path(skill_path).resolve()
        self.features: Dict[str, Dict] = {}
        self.parameters: Dict[str, Dict] = {}
        self.mo_classes: Dict[str, Dict] = {}

        self._load_data()

    def _load_json(self, filename: str) -> any:
        """Load JSON file"""
        filepath = self.skill_path / filename
        if not filepath.exists():
            return {} if 'index' in filename else []

        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _load_data(self):
        """Load feature data"""
        self.features = self._load_json('features.json')
        self.parameters = self._load_json('parameters.json')
        self.mo_classes = self._load_json('mo_classes.json')

        # Build acronym index for lookups
        acronym_index = self._load_json('index_acronym.json')
        self.acronym_to_faj = {}
        for acronym, faj_code in acronym_index.items():
            self.acronym_to_faj[acronym.upper()] = faj_code

    def get_feature(self, faj_code: str) -> Optional[Dict]:
        """Get feature by FAJ code"""
        normalized = faj_code.replace(' ', '_')
        return self.features.get(normalized)

    def generate_enable_commands(self, faj_code: str) -> List[str]:
        """Generate commands to enable a feature"""
        feature = self.get_feature(faj_code)
        if not feature:
            return []

        commands = []
        acronym = feature.get('acronym', 'FEATURE')

        commands.append(f"# Enable {acronym} ({faj_code})")
        commands.append(f"cmedit get {faj_code}/enabled")
        commands.append(f"cmedit set {faj_code}/enabled true")
        commands.append(f"# Verify")
        commands.append(f"cmedit get {faj_code}/enabled")

        return commands

    def generate_parameter_commands(self, faj_code: str) -> List[str]:
        """Generate parameter configuration commands"""
        feature = self.get_feature(faj_code)
        if not feature:
            return []

        commands = []
        params = feature.get('params', [])

        if not params:
            return commands

        commands.append(f"# Configure parameters for {feature.get('name', 'Feature')}")
        commands.append("")

        for param in params[:10]:  # Sample first 10
            # Parse parameter path
            if '.' in param:
                mo_class, param_name = param.rsplit('.', 1)
                commands.append(f"# Configure {param_name} in {mo_class}")
                commands.append(f"cmedit set {param} <value>")
            else:
                commands.append(f"cmedit set {param} <value>")

        if len(params) > 10:
            commands.append(f"# ... {len(params) - 10} more parameters available")

        return commands

    def generate_deployment_script(self, faj_code: str, format_type: str = 'script') -> str:
        """Generate deployment script for a feature"""
        feature = self.get_feature(faj_code)
        if not feature:
            return ""

        acronym = feature.get('acronym', 'FEATURE')
        name = feature.get('name', 'Unknown')
        cxc = feature.get('cxc', 'Unknown')

        lines = []

        if format_type == 'bash':
            lines.append("#!/bin/bash")
            lines.append("")
            lines.append(f"# Deployment script for {acronym}")
            lines.append(f"# Feature: {name}")
            lines.append(f"# FAJ: {faj_code}")
            lines.append(f"# CXC: {cxc}")
            lines.append("")
            lines.append("set -e  # Exit on error")
            lines.append("")

            lines.extend(self.generate_enable_commands(faj_code))
            lines.append("")
            lines.extend(self.generate_parameter_commands(faj_code))
            lines.append("")
            lines.append("# Commit changes")
            lines.append("cmedit commit -m 'Enable ${FEATURE_NAME}'")
            lines.append("")
            lines.append("echo 'Deployment complete'")

        elif format_type == 'terraform':
            lines.append('# Terraform configuration for Ericsson RAN feature')
            lines.append(f'# Feature: {name}')
            lines.append(f'# FAJ: {faj_code}')
            lines.append('')
            lines.append('terraform {')
            lines.append('  required_providers {')
            lines.append('    ericsson = {')
            lines.append('      source = "ericsson/ericsson"')
            lines.append('      version = "~> 1.0"')
            lines.append('    }')
            lines.append('  }')
            lines.append('}')
            lines.append('')
            lines.append('resource "ericsson_feature" "feature" {')
            lines.append(f'  faj_code = "{faj_code}"')
            lines.append(f'  enabled = true')
            lines.append('')
            lines.append('  # Parameters')
            for param in feature.get('params', [])[:5]:
                param_name = param.split('.')[-1] if '.' in param else param
                lines.append(f'  {param_name} = var.{param_name}')
            lines.append('}')

        elif format_type == 'yaml':
            lines.append('---')
            lines.append(f'feature: {acronym}')
            lines.append(f'name: {name}')
            lines.append(f'faj_code: {faj_code}')
            lines.append(f'cxc_code: {cxc}')
            lines.append('')
            lines.append('configuration:')
            lines.append('  enabled: true')
            lines.append('  parameters:')
            for param in feature.get('params', [])[:10]:
                param_name = param.split('.')[-1] if '.' in param else param
                lines.append(f'    {param_name}: null  # Configure value')
            if len(feature.get('params', [])) > 10:
                lines.append(f'    # ... {len(feature.get("params", [])) - 10} more parameters')

        else:  # Default script format
            lines.append(f"# Deployment script for {acronym}")
            lines.append(f"# Feature: {name}")
            lines.append(f"# FAJ: {faj_code}")
            lines.append(f"# CXC: {cxc}")
            lines.append(f"# Generated: {datetime.now().isoformat()}")
            lines.append("")
            lines.extend(self.generate_enable_commands(faj_code))
            lines.append("")
            lines.extend(self.generate_parameter_commands(faj_code))

        return '\n'.join(lines)

    def generate_validation_commands(self, faj_code: str) -> List[str]:
        """Generate validation commands for a feature"""
        feature = self.get_feature(faj_code)
        if not feature:
            return []

        commands = []
        acronym = feature.get('acronym', 'FEATURE')

        commands.append(f"# Validation commands for {acronym}")
        commands.append(f"cmedit get {faj_code}/enabled")
        commands.append(f"cmedit get {faj_code}/status")

        params = feature.get('params', [])
        if params:
            commands.append(f"# Verify key parameters")
            for param in params[:5]:
                commands.append(f"cmedit get {param}")

        return commands


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='cmedit Command Generator')
    parser.add_argument('--faj', required=True, help='FAJ code (e.g., "121 3094")')
    parser.add_argument('--skill-path', default='.claude/skills/ericsson-ran-features/references')
    parser.add_argument('--format', choices=['script', 'bash', 'terraform', 'yaml'], default='script',
                       help='Output format')
    parser.add_argument('--enable', action='store_true', help='Generate enable commands only')
    parser.add_argument('--params', action='store_true', help='Generate parameter commands only')
    parser.add_argument('--validate', action='store_true', help='Generate validation commands')

    args = parser.parse_args()

    try:
        generator = CMEditGenerator(args.skill_path)
    except Exception as e:
        print(f"Error loading database: {e}", file=sys.stderr)
        return 1

    # Resolve acronym to FAJ code if needed
    faj_code = args.faj
    if not faj_code.startswith('FAJ') and not faj_code.startswith('121'):
        # Try as acronym
        resolved = generator.acronym_to_faj.get(faj_code.upper())
        if resolved:
            faj_code = resolved
        else:
            # Try as direct FAJ code
            faj_code = args.faj.replace(' ', '_')
    else:
        # Normalize FAJ code
        faj_code = args.faj.replace(' ', '_')

    # Verify feature exists
    if not generator.get_feature(faj_code):
        print(f"Feature not found: {args.faj}", file=sys.stderr)
        return 1

    # Generate output
    if args.enable:
        commands = generator.generate_enable_commands(faj_code)
        for cmd in commands:
            print(cmd)
    elif args.params:
        commands = generator.generate_parameter_commands(faj_code)
        for cmd in commands:
            print(cmd)
    elif args.validate:
        commands = generator.generate_validation_commands(faj_code)
        for cmd in commands:
            print(cmd)
    else:
        # Generate deployment script
        script = generator.generate_deployment_script(faj_code, args.format)
        print(script)

    return 0


if __name__ == '__main__':
    sys.exit(main())
