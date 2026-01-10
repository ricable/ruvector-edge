#!/usr/bin/env python3
"""
Build index from Ericsson RAN feature markdown files.
Generates features.json, parameters.json, counters.json, and other index files for the skill.
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Optional
import yaml


def extract_yaml_frontmatter(content: str) -> dict:
    """Extract YAML frontmatter from markdown content."""
    if content.startswith('---'):
        end = content.find('---', 3)
        if end != -1:
            yaml_content = content[3:end].strip()
            try:
                return yaml.safe_load(yaml_content) or {}
            except yaml.YAMLError:
                return {}
    return {}


def extract_feature_name(content: str) -> Optional[str]:
    """Extract feature name from the document title."""
    # Pattern: # \n\nFeature Name\n\nContents
    match = re.search(r'^# \s*\n\n([^\n]+)\n\nContents', content, re.MULTILINE)
    if match:
        return match.group(1).strip()

    # Alternative: look for the first # N Overview section
    match = re.search(r'^# \d+ ([^\n]+) Overview', content, re.MULTILINE)
    if match:
        return match.group(1).strip()

    return None


def extract_faj_code(content: str) -> Optional[str]:
    """Extract FAJ feature identity code from overview table.

    Handles format variations:
    | Feature Identity | FAJ XXX XXXX |
    | Feature Identity: | FAJ XXX XXXX |
    """
    # Pattern: | Feature Identity[:]? | FAJ XXX XXXX |
    match = re.search(r'\|\s*Feature Identity:?\s*\|\s*(FAJ\s+\d+\s+\d+)', content)
    if match:
        return match.group(1).strip()
    return None


def extract_cxc_code(content: str) -> Optional[str]:
    """Extract CXC activation code from Activate section."""
    # Pattern: FeatureState=CXC4XXXXXX
    match = re.search(r'FeatureState[=:]?\s*(CXC\d+)', content)
    if match:
        return match.group(1).strip()
    return None


def extract_access_type(content: str) -> list[str]:
    """Extract access types from overview table.

    Handles format variations with optional colon:
    | Access Type | LTE |
    | Access Type: | LTE |
    """
    # Pattern: | Access Type[:]? | LTE |
    match = re.search(r'\|\s*Access Type:?\s*\|\s*([^\|]+)\|', content)
    if match:
        access_str = match.group(1).strip()
        # Split by comma or slash
        types = re.split(r'[,/]', access_str)
        return [t.strip() for t in types if t.strip()]
    return []


def extract_licensing(content: str) -> bool:
    """Check if feature is license-controlled.

    Handles format variations with optional colon:
    | Licensing | license-controlled |
    | Licensing: | license-controlled |
    """
    match = re.search(r'\|\s*Licensing:?\s*\|\s*([^\|]+)\|', content)
    if match:
        return 'license-controlled' in match.group(1).lower()
    return False


def extract_value_package(content: str) -> tuple[Optional[str], Optional[str]]:
    """Extract value package name and identity.

    Handles table formatting variations:
    | Value Package Name     | ...  (standard)
    | Value Package                 Name     | ...  (with extra whitespace)
    | Value Package Name:     | ...  (with colon)
    """
    # Handle whitespace/newlines in column header, and optional colon
    name_match = re.search(r'\|\s*Value Package\s+Name:?\s*\|\s*([^\|]+)\|', content)
    id_match = re.search(r'\|\s*Value Package\s+Identity:?\s*\|\s*(FAJ\s+\d+\s+\d+)', content)

    name = name_match.group(1).strip() if name_match else None
    pkg_id = id_match.group(1).strip() if id_match else None

    return name, pkg_id


def extract_dependencies(content: str) -> list[dict]:
    """Extract feature dependencies from the Dependencies table."""
    deps = []

    # Find the Dependencies section
    dep_section = re.search(r'# \d+ Dependencies.*?(?=# \d+ |$)', content, re.DOTALL)
    if not dep_section:
        return deps

    section_text = dep_section.group(0)

    # Parse table rows - look for FAJ codes in Feature column
    # Pattern: | Feature Name (FAJ XXX XXXX) | Relationship | Description |
    rows = re.findall(
        r'\|\s*([^\|]+)\(FAJ\s+(\d+)\s+(\d+)\)[^\|]*\|\s*(Prerequisite|Related|Conflicting)\s*\|',
        section_text
    )

    for row in rows:
        feature_name = row[0].strip()
        faj_code = f"FAJ {row[1]} {row[2]}"
        relationship = row[3].strip()

        deps.append({
            'name': feature_name,
            'faj': faj_code,
            'type': relationship
        })

    return deps


def extract_parameters(content: str) -> list[dict]:
    """Extract parameters from the Parameters table including descriptions."""
    params = []

    # Find the Parameters section
    param_section = re.search(r'# \d+ Parameters.*?(?=# \d+ |$)', content, re.DOTALL)
    if not param_section:
        return params

    section_text = param_section.group(0)

    # Parse table rows with description
    # Pattern: | Parameter | Type | Description |
    rows = re.findall(
        r'\|\s*([A-Za-z][A-Za-z0-9]*\.[a-zA-Z][a-zA-Z0-9]*)\s*\|\s*(Introduced|Affecting|Affected)\s*\|\s*([^\|]+)\|',
        section_text
    )

    for row in rows:
        param_name = row[0].strip()
        param_type = row[1].strip()
        # Clean description: remove extra whitespace, limit length
        description = re.sub(r'\s+', ' ', row[2].strip())
        if len(description) > 200:
            description = description[:197] + '...'

        params.append({
            'name': param_name,
            'type': param_type,
            'description': description
        })

    # Fallback: if no rows with description found, try without description
    if not params:
        rows = re.findall(
            r'\|\s*([A-Za-z][A-Za-z0-9]*\.[a-zA-Z][a-zA-Z0-9]*)\s*\|\s*(Introduced|Affecting|Affected)\s*\|',
            section_text
        )
        for row in rows:
            params.append({
                'name': row[0].strip(),
                'type': row[1].strip(),
                'description': '-'
            })

    return params


def extract_inline_parameters(content: str) -> list[dict]:
    """Extract parameters mentioned inline in text (Feature Operation, Activation sections).

    Some features reference parameters from related features that aren't in the
    Parameters table but are mentioned in the document body.
    """
    params = []
    seen = set()

    # Look for MO.attribute patterns in relevant sections
    # Pattern: MOClass.attributeName (with proper casing)
    # Examples: ENodeBFunction.ulHeavyUeDetectTime, EUtranCellFDD.ulHeavyUeDetectEnabled
    param_pattern = r'\b([A-Z][a-zA-Z0-9]+(?:Function|Cell[A-Z]*|Relation|Profile|Config|Data|Carrier|Bearer)?)\.' \
                    r'([a-z][a-zA-Z0-9]+)\b'

    matches = re.findall(param_pattern, content)

    for match in matches:
        mo_class = match[0]
        attr_name = match[1]
        full_name = f"{mo_class}.{attr_name}"

        # Skip common false positives
        if attr_name in ('md', 'html', 'png', 'jpg', 'pdf', 'xml', 'json'):
            continue
        # Skip if it looks like a file extension or URL component
        if len(attr_name) < 3:
            continue

        if full_name not in seen:
            seen.add(full_name)
            params.append({
                'name': full_name,
                'type': 'Referenced',  # Mark as referenced (not in formal table)
                'description': 'Referenced in feature documentation'
            })

    return params


def extract_counters(content: str) -> list[str]:
    """Extract PM counters from the Performance section."""
    counters = []

    # Find the Performance section
    perf_section = re.search(r'# \d+ Performance.*?(?=# \d+ |$)', content, re.DOTALL)
    if not perf_section:
        return counters

    section_text = perf_section.group(0)

    # Look for counter patterns like EUtranCellFDD.pmXxx
    counter_matches = re.findall(r'([A-Za-z]+\.pm[A-Za-z0-9]+)', section_text)
    counters = list(set(counter_matches))

    return counters


def extract_counter_descriptions_from_tables(content: str) -> dict:
    """Extract counter descriptions, units, and types from Performance section tables.

    Looks for tables with format:
    | Counter | Description | Type | Unit |
    or similar variations.

    Returns dict: counter_name -> {description, unit, counter_type}
    """
    counter_info = {}

    # Find the Performance section
    perf_section = re.search(r'# \d+ Performance.*?(?=# \d+ |$)', content, re.DOTALL)
    if not perf_section:
        return counter_info

    section_text = perf_section.group(0)

    # Pattern 1: Full table format with Counter | Description | Type | Unit
    # Match rows like: | EUtranCellFDD.pmMimoSleepTime | Time in MIMO sleep | ACC | ms |
    pattern1 = re.findall(
        r'\|\s*([A-Za-z]+\.pm[A-Za-z0-9]+)\s*\|\s*([^|]+)\s*\|\s*(ACC|GAUGE|DER|CC|PDF|PEG)\s*\|\s*([^|]*)\s*\|',
        section_text,
        re.IGNORECASE
    )

    for match in pattern1:
        counter_name = match[0].strip()
        if counter_name not in counter_info:
            counter_info[counter_name] = {
                'description': match[1].strip()[:200],
                'counter_type': match[2].strip().upper(),
                'unit': match[3].strip() if match[3].strip() else None
            }

    # Pattern 2: Simpler format without type/unit - just Counter | Description
    # Only use if not already found in pattern 1
    pattern2 = re.findall(
        r'\|\s*([A-Za-z]+\.pm[A-Za-z0-9]+)\s*\|\s*([^|]{15,})\s*\|',
        section_text
    )

    for match in pattern2:
        counter_name = match[0].strip()
        if counter_name not in counter_info:
            desc = match[1].strip()
            # Skip if it looks like a header or separator
            if desc and not desc.startswith('-') and 'Description' not in desc:
                counter_info[counter_name] = {
                    'description': desc[:200],
                    'counter_type': None,
                    'unit': None
                }

    # Pattern 3: Look for inline descriptions in text
    # "pmCounterName - description text"
    inline_pattern = re.findall(
        r'\b(pm[A-Za-z0-9]+)\s*[-:]\s*([^.|\n]{20,100})',
        section_text
    )

    for match in inline_pattern:
        counter_short = match[0].strip()
        # Try to find full name with MO class
        for key in counter_info:
            if key.endswith('.' + counter_short):
                break
        else:
            # If not found, add as partial (will be matched later)
            if counter_short not in counter_info:
                counter_info[counter_short] = {
                    'description': match[1].strip()[:200],
                    'counter_type': None,
                    'unit': None
                }

    return counter_info


def extract_counters_detailed(content: str) -> list[dict]:
    """Extract detailed counter information with MO class, description, unit, and type."""
    counters = []

    # Find the Performance section
    perf_section = re.search(r'# \d+ Performance.*?(?=# \d+ |$)', content, re.DOTALL)
    if not perf_section:
        return counters

    section_text = perf_section.group(0)

    # Get counter descriptions from tables
    counter_descs = extract_counter_descriptions_from_tables(content)

    # Pattern: MOClass.pmCounterName
    counter_matches = re.findall(r'([A-Za-z][A-Za-z0-9]*)\.(pm[A-Za-z0-9]+)', section_text)

    seen = set()
    for match in counter_matches:
        mo_class = match[0]
        counter_name = match[1]
        full_name = f"{mo_class}.{counter_name}"

        if full_name not in seen:
            seen.add(full_name)

            # Get description info if available
            desc_info = counter_descs.get(full_name, counter_descs.get(counter_name, {}))

            counters.append({
                'name': counter_name,
                'mo_class': mo_class,
                'full_name': full_name,
                'description': desc_info.get('description'),
                'unit': desc_info.get('unit'),
                'counter_type': desc_info.get('counter_type')
            })

    return counters


def extract_kpis(content: str) -> list[dict]:
    """Extract KPIs from Performance section."""
    kpis = []

    # Find the Performance section
    perf_section = re.search(r'# \d+ Performance.*?(?=# \d+ |$)', content, re.DOTALL)
    if not perf_section:
        return kpis

    section_text = perf_section.group(0)

    # Look for KPI table: | KPI | Description |
    kpi_table = re.search(r'Table \d+\s+Key Performance Indicators.*?\n\n\|[^\n]+\|\n\|[-\s|]+\|(.*?)(?=\n\n[A-Z]|\n\n#|$)', section_text, re.DOTALL)
    if kpi_table:
        table_content = kpi_table.group(1)
        # Parse table rows
        rows = re.findall(r'\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|', table_content)
        for row in rows:
            name = row[0].strip()
            desc = row[1].strip()
            # Skip header/separator rows
            if name and not name.startswith('-') and name.lower() != 'kpi':
                desc = re.sub(r'\s+', ' ', desc)[:200]
                kpis.append({
                    'name': name,
                    'description': desc
                })

    return kpis


def extract_events(content: str) -> list[dict]:
    """Extract events from Performance section."""
    events = []

    # Find the Performance section
    perf_section = re.search(r'# \d+ Performance.*?(?=# \d+ |$)', content, re.DOTALL)
    if not perf_section:
        return events

    section_text = perf_section.group(0)

    # Find INTERNAL_EVENT patterns
    event_matches = re.findall(r'(INTERNAL_EVENT_[A-Z_]+)', section_text)

    seen = set()
    for event in event_matches:
        if event not in seen:
            seen.add(event)
            events.append({'name': event, 'type': 'internal_event'})

    # Find EVENT_PARAM patterns
    param_matches = re.findall(r'(EVENT_PARAM_[A-Z_]+)', section_text)
    for param in param_matches:
        if param not in seen:
            seen.add(param)
            events.append({'name': param, 'type': 'event_param'})

    return events


def extract_network_impact(content: str) -> dict:
    """Extract Network Impact section with subsections."""
    # Find the Network Impact section
    impact_section = re.search(r'# \d+ Network Impact.*?(?=# \d+ |$)', content, re.DOTALL)
    if not impact_section:
        return {}

    section_text = impact_section.group(0)

    result = {
        'capacity_performance': None,
        'mobility': None,
        'interfaces': None,
        'hardware': None,
        'other_network_elements': None
    }

    # Extract Capacity and Performance subsection
    cap_match = re.search(
        r'Capacity and Performance\s*\n\n(.*?)(?=\n\n(?:Mobility|Other Network Elements|Interfaces|Hardware|#)|\n\n[A-Z][a-z]+ [A-Z]|\Z)',
        section_text,
        re.DOTALL
    )
    if cap_match:
        text = re.sub(r'\s+', ' ', cap_match.group(1).strip())
        result['capacity_performance'] = text[:500] if len(text) > 500 else text

    # Extract Other Network Elements subsection
    one_match = re.search(
        r'Other Network Elements\s*\n\n(.*?)(?=\n\n(?:Mobility|Interfaces|Hardware|#)|\n\n[A-Z][a-z]+ [A-Z]|\Z)',
        section_text,
        re.DOTALL
    )
    if one_match:
        text = re.sub(r'\s+', ' ', one_match.group(1).strip())
        result['other_network_elements'] = text[:500] if len(text) > 500 else text

    # Extract Interfaces subsection
    int_match = re.search(
        r'Interfaces\s*\n\n(.*?)(?=\n\n(?:Mobility|Other Network Elements|Hardware|#)|\n\n[A-Z][a-z]+ [A-Z]|\Z)',
        section_text,
        re.DOTALL
    )
    if int_match:
        text = re.sub(r'\s+', ' ', int_match.group(1).strip())
        result['interfaces'] = text[:500] if len(text) > 500 else text

    return result


def extract_activation_procedure(content: str) -> dict:
    """Extract Activation procedure with prerequisites, steps, and post-task."""
    # Find the Activation section
    activate_section = re.search(
        r'# \d+ Activat(?:e|ing)[^\n]*\n(.*?)(?=# \d+ |$)',
        content,
        re.DOTALL
    )
    if not activate_section:
        return {}

    section_text = activate_section.group(1)

    result = {
        'prerequisites': [],
        'steps': [],
        'after_task': None
    }

    # Extract Prerequisites
    prereq_match = re.search(
        r'Prerequisites\s*\n\n(.*?)(?=\n\nSteps|\n\n\d+\.)',
        section_text,
        re.DOTALL
    )
    if prereq_match:
        prereq_text = prereq_match.group(1)
        # Parse bullet list
        prereqs = re.findall(r'[-*]\s+(.+?)(?=\n[-*]|\n\n|$)', prereq_text, re.DOTALL)
        result['prerequisites'] = [re.sub(r'\s+', ' ', p.strip()) for p in prereqs if p.strip()]

    # Extract Steps
    steps_match = re.search(
        r'Steps\s*\n\n(.*?)(?=\n\nAfter This Task|$)',
        section_text,
        re.DOTALL
    )
    if steps_match:
        steps_text = steps_match.group(1)
        # Parse numbered steps
        steps = re.findall(r'\d+\.\s+(.+?)(?=\n\d+\.|\n\n|$)', steps_text, re.DOTALL)
        result['steps'] = [re.sub(r'\s+', ' ', s.strip()) for s in steps if s.strip()]

    # Extract After This Task
    after_match = re.search(
        r'After This Task\s*\n\n(.+?)(?=\n\n#|$)',
        section_text,
        re.DOTALL
    )
    if after_match:
        result['after_task'] = re.sub(r'\s+', ' ', after_match.group(1).strip())

    return result


def extract_deactivation_procedure(content: str) -> dict:
    """Extract Deactivation procedure with prerequisites, steps, and post-task."""
    # Find the Deactivation section
    deactivate_section = re.search(
        r'# \d+ Deactivat(?:e|ing)[^\n]*\n(.*?)(?=# \d+ |# Appendix|$)',
        content,
        re.DOTALL
    )
    if not deactivate_section:
        return {}

    section_text = deactivate_section.group(1)

    result = {
        'prerequisites': [],
        'steps': [],
        'after_task': None
    }

    # Extract Prerequisites
    prereq_match = re.search(
        r'Prerequisites\s*\n\n(.*?)(?=\n\nSteps|\n\n\d+\.)',
        section_text,
        re.DOTALL
    )
    if prereq_match:
        prereq_text = prereq_match.group(1)
        prereqs = re.findall(r'[-*]\s+(.+?)(?=\n[-*]|\n\n|$)', prereq_text, re.DOTALL)
        result['prerequisites'] = [re.sub(r'\s+', ' ', p.strip()) for p in prereqs if p.strip()]
        # Also check for non-bullet prerequisites
        if not result['prerequisites']:
            text = prereq_match.group(1).strip()
            if text:
                result['prerequisites'] = [re.sub(r'\s+', ' ', text)]

    # Extract Steps
    steps_match = re.search(
        r'Steps\s*\n\n(.*?)(?=\n\nAfter This Task|$)',
        section_text,
        re.DOTALL
    )
    if steps_match:
        steps_text = steps_match.group(1)
        steps = re.findall(r'\d+\.\s+(.+?)(?=\n\d+\.|\n\n|$)', steps_text, re.DOTALL)
        result['steps'] = [re.sub(r'\s+', ' ', s.strip()) for s in steps if s.strip()]

    # Extract After This Task
    after_match = re.search(
        r'After This Task\s*\n\n(.+?)(?=\n\n#|$)',
        section_text,
        re.DOTALL
    )
    if after_match:
        result['after_task'] = re.sub(r'\s+', ' ', after_match.group(1).strip())

    return result


def extract_capacity_procedure(content: str) -> dict:
    """Extract Enable or Disable Capacity section for capacity-type features.

    Capacity features use "Enable or Disable Capacity" instead of
    "Activate/Deactivate the Feature" sections.
    """
    section = re.search(
        r'# \d+ Enable or Disable[^\n]*\n(.*?)(?=# \d+ |$)',
        content,
        re.DOTALL
    )
    if not section:
        return {}

    section_text = section.group(1)
    # Extract description text
    description = re.sub(r'\s+', ' ', section_text.strip())[:500]

    return {
        'type': 'capacity',
        'description': description,
        'auto_enabled': 'automatically' in description.lower()
    }


def extract_engineering_guidelines(content: str) -> dict:
    """Extract Engineering Guidelines section."""
    # Find Engineering Guidelines section
    eng_section = re.search(
        r'# \d+ Engineering Guidelines[^\n]*\n(.*?)(?=# \d+ |# Appendix|$)',
        content,
        re.DOTALL
    )
    if not eng_section:
        return {'has_guidelines': False, 'subsections': [], 'summary': None}

    section_text = eng_section.group(1)

    result = {
        'has_guidelines': True,
        'subsections': [],
        'summary': None
    }

    # Extract subsection headers (## N.N Title)
    subsections = re.findall(r'## \d+\.\d+ ([^\n]+)', section_text)
    result['subsections'] = [s.strip() for s in subsections]

    # Get first paragraph as summary
    first_para = re.search(r'^([^\n#]+)', section_text.strip())
    if first_para:
        text = first_para.group(1).strip()
        if text and len(text) > 20:  # Avoid empty/short content
            result['summary'] = re.sub(r'\s+', ' ', text)[:300]

    return result


def extract_change_history(content: str) -> list[dict]:
    """Extract Feature Change History from Appendix."""
    # Find the change history section
    history_section = re.search(
        r'# Appendix[^:]*: Feature Change History(.*?)$',
        content,
        re.DOTALL
    )
    if not history_section:
        return []

    section_text = history_section.group(1)

    changes = []

    # Pattern for individual change entries
    # ## Appendix A.a: 23.Q4: Enhancement Title
    # or ## Appendix A.a: 24.Q1.0: Enhancement Title
    entries = re.findall(
        r'## Appendix [A-Za-z]\.[a-z]+:\s*(\d{2}\.[Q]\d(?:\.\d)?):?\s*([^\n]+)',
        section_text
    )

    for entry in entries:
        release = entry[0]  # e.g., "23.Q4" or "24.Q1.0"
        title = entry[1].strip()

        changes.append({
            'release': release,
            'title': title
        })

    return changes


def extract_mo_classes(content: str) -> list[str]:
    """Extract all unique MO classes referenced in the document."""
    mo_classes = set()

    # Pattern for common MO class patterns in parameters/counters
    # Format: MOClassName.attribute or MOClassName.pmCounterName
    mo_matches = re.findall(
        r'\b([A-Z][a-zA-Z0-9]+(?:Function|Relation|Cell|Profile|Config|Data|Carrier|Bearer|Qci))[.\s]',
        content
    )
    mo_classes.update(mo_matches)

    # Common specific MO classes
    specific_patterns = [
        r'\b(EUtranCell(?:FDD|TDD))\b',
        r'\b(NRCell(?:DU|CU))\b',
        r'\b(GNBCUCPFunction)\b',
        r'\b(ENodeBFunction)\b',
        r'\b(LoadBalancingFunction)\b',
        r'\b(FeatureState)\b',
        r'\b(EUtranCellRelation)\b',
        r'\b(EUtranFreqRelation)\b',
        r'\b(NRSectorCarrier)\b',
        r'\b(QciProfile(?:Predefined|OperatorDefined)?)\b',
        r'\b(ReportConfig[A-Za-z]+)\b',
    ]

    for pattern in specific_patterns:
        matches = re.findall(pattern, content)
        mo_classes.update(matches)

    return sorted(list(mo_classes))


def extract_summary(content: str) -> Optional[str]:
    """Extract feature summary/description from the Overview section."""
    # Find the Summary section within Overview
    # Pattern: Summary followed by paragraph text until next heading or section
    summary_match = re.search(
        r'Summary\s*\n\n(.*?)(?=\n\n(?:Additional Information|#|\|))',
        content,
        re.DOTALL
    )
    if summary_match:
        summary = summary_match.group(1).strip()
        # Clean up: remove extra whitespace and newlines
        summary = re.sub(r'\s+', ' ', summary)
        # Limit to ~500 chars for index
        if len(summary) > 500:
            summary = summary[:497] + '...'
        return summary

    # Fallback: try first paragraph after Overview heading
    overview_match = re.search(
        r'# \d+ [^\n]+ Overview\s*\n\n([^\n|#]+)',
        content
    )
    if overview_match:
        summary = overview_match.group(1).strip()
        summary = re.sub(r'\s+', ' ', summary)
        if len(summary) > 500:
            summary = summary[:497] + '...'
        return summary

    return None


def generate_acronym(feature_name: str) -> Optional[str]:
    """Generate acronym from feature name.

    Examples:
        'Inter-Frequency Load Balancing' -> 'IFLB'
        'UE Throughput-Aware IFLB' -> 'UTA-IFLB' (preserves existing acronyms)
        'Dynamic UE Admission Control' -> 'DUAC'
        'Mobility Control at Poor Coverage' -> 'MCPC'
    """
    if not feature_name:
        return None

    # Skip common words (articles, prepositions, conjunctions)
    skip_words = {'a', 'an', 'the', 'at', 'by', 'for', 'in', 'of', 'on', 'to', 'with', 'and', 'or'}

    # Split on spaces
    words = re.split(r'[\s]+', feature_name)

    # First pass: generate simple acronym (just first letters)
    simple_parts = []
    for word in words:
        if word.lower() in skip_words:
            continue

        # Handle hyphenated words like "Throughput-Aware" or "Inter-Frequency"
        if '-' in word:
            sub_parts = word.split('-')
            for part in sub_parts:
                if part.lower() not in skip_words and part:
                    simple_parts.append(part[0].upper())
        elif word:
            simple_parts.append(word[0].upper())

    simple_acronym = ''.join(simple_parts) if simple_parts else None

    # Second pass: check for trailing known acronym to preserve (e.g., IFLB in "UE Throughput-Aware IFLB")
    # Only preserve if it's the last word and is a known pattern
    trailing_acronym = None
    if words and re.match(r'^[A-Z]{2,}(-[A-Z]+)*$', words[-1]):
        trailing_acronym = words[-1]

    # If there's a significant trailing acronym (3+ chars), preserve it with prefix
    if trailing_acronym and len(trailing_acronym) >= 3:
        # Generate prefix from preceding words
        prefix_words = words[:-1]
        prefix_parts = []
        for word in prefix_words:
            if word.lower() in skip_words:
                continue
            if '-' in word:
                sub_parts = word.split('-')
                for part in sub_parts:
                    if part.lower() not in skip_words and part:
                        prefix_parts.append(part[0].upper())
            # Skip small acronyms like "UE", "NR" in prefix - just take first letter
            elif re.match(r'^[A-Z]{2,3}$', word):
                prefix_parts.append(word[0])
            elif word:
                prefix_parts.append(word[0].upper())

        if prefix_parts:
            return ''.join(prefix_parts) + '-' + trailing_acronym

        return trailing_acronym

    return simple_acronym


def normalize_faj_key(faj: str) -> str:
    """Convert FAJ code to a normalized key format."""
    # FAJ 121 4219 -> FAJ_121_4219
    return faj.replace(' ', '_') if faj else ''


def build_dependency_graph(features: dict) -> dict:
    """Build a dependency graph with nodes, edges, and activation order.

    Returns:
        dict with:
        - nodes: feature info with in/out degree
        - edges: typed edges (prerequisite, related, conflicting)
        - activation_order: topological sort for each feature
    """
    nodes = {}
    edges = {
        'prerequisite': [],
        'related': [],
        'conflicting': []
    }

    # Build nodes and edges
    for faj_key, feature in features.items():
        nodes[faj_key] = {
            'name': feature['name'],
            'acronym': feature.get('acronym'),
            'cxc': feature.get('cxc'),
            'in_degree': 0,  # Will be computed
            'out_degree': 0
        }

        for dep in feature.get('deps', []):
            dep_faj = normalize_faj_key(dep.get('faj', ''))
            dep_type = dep.get('type', 'Related').lower()

            if dep_type == 'prerequisite':
                edges['prerequisite'].append({
                    'from': faj_key,
                    'to': dep_faj,
                    'label': 'requires'
                })
                nodes[faj_key]['out_degree'] += 1
            elif dep_type == 'related':
                edges['related'].append({
                    'from': faj_key,
                    'to': dep_faj,
                    'label': 'related'
                })
            elif dep_type == 'conflicting':
                edges['conflicting'].append({
                    'from': faj_key,
                    'to': dep_faj,
                    'label': 'conflicts'
                })

    # Compute in-degree
    for edge in edges['prerequisite']:
        to_node = edge['to']
        if to_node in nodes:
            nodes[to_node]['in_degree'] += 1

    # Compute activation order (topological sort) for each feature
    activation_order = {}
    for faj_key in features:
        order = compute_activation_order(faj_key, edges['prerequisite'], set())
        activation_order[faj_key] = order

    return {
        'nodes': nodes,
        'edges': edges,
        'activation_order': activation_order,
        'stats': {
            'total_nodes': len(nodes),
            'prerequisite_edges': len(edges['prerequisite']),
            'related_edges': len(edges['related']),
            'conflicting_edges': len(edges['conflicting'])
        }
    }


def compute_activation_order(faj_key: str, prereq_edges: list, visited: set) -> list:
    """Compute activation order using topological sort (DFS).

    Returns list of FAJ keys in order they should be activated.
    """
    if faj_key in visited:
        return []  # Avoid cycles

    visited.add(faj_key)
    order = []

    # Find prerequisites for this feature
    for edge in prereq_edges:
        if edge['from'] == faj_key:
            prereq = edge['to']
            # Recursively get order for prerequisite
            prereq_order = compute_activation_order(prereq, prereq_edges, visited.copy())
            for item in prereq_order:
                if item not in order:
                    order.append(item)

    # Add self at the end
    order.append(faj_key)
    return order


def process_markdown_file(file_path: Path, base_dir: Path) -> Optional[dict]:
    """Process a single markdown file and extract feature data."""
    try:
        content = file_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"Error reading {file_path}: {e}", file=sys.stderr)
        return None

    # Extract YAML frontmatter metadata
    yaml_meta = extract_yaml_frontmatter(content)

    # Extract all fields
    feature_name = extract_feature_name(content)
    faj_code = extract_faj_code(content)

    if not feature_name or not faj_code:
        # Skip files without proper feature metadata
        return None

    cxc_code = extract_cxc_code(content)
    access_types = extract_access_type(content)
    is_licensed = extract_licensing(content)
    vp_name, vp_id = extract_value_package(content)
    dependencies = extract_dependencies(content)

    # Extract parameters from table and inline references
    table_parameters = extract_parameters(content)
    inline_parameters = extract_inline_parameters(content)

    # Merge: table params take priority, add inline params that aren't in table
    seen_params = {p['name'] for p in table_parameters}
    parameters = table_parameters + [p for p in inline_parameters if p['name'] not in seen_params]

    counters = extract_counters(content)
    summary = extract_summary(content)
    acronym = generate_acronym(feature_name)

    # NEW: Enhanced extractions
    counters_detailed = extract_counters_detailed(content)
    kpis = extract_kpis(content)
    events = extract_events(content)
    network_impact = extract_network_impact(content)
    activation = extract_activation_procedure(content)
    deactivation = extract_deactivation_procedure(content)
    capacity_procedure = extract_capacity_procedure(content)
    engineering_guidelines = extract_engineering_guidelines(content)
    change_history = extract_change_history(content)
    mo_classes = extract_mo_classes(content)

    # Get relative file path
    rel_path = file_path.relative_to(base_dir)

    return {
        'name': feature_name,
        'acronym': acronym,
        'summary': summary,
        'faj': faj_code,
        'cxc': cxc_code,
        'access': access_types,
        'license': is_licensed,
        'value_package': {
            'name': vp_name,
            'faj': vp_id
        } if vp_name else None,
        'file': str(rel_path),

        # YAML Frontmatter Metadata
        'metadata': {
            'complexity_score': yaml_meta.get('complexity_score'),
            'quality_score': yaml_meta.get('quality_score'),
            'tables_extracted': yaml_meta.get('tables_extracted'),
            'images_extracted': yaml_meta.get('images_extracted'),
            'source_file': yaml_meta.get('source_file')
        } if yaml_meta else None,

        # Parameters
        'params': [p['name'] for p in parameters],
        'param_details': parameters,
        'mo_classes': mo_classes,

        # Dependencies
        'deps': dependencies,

        # Performance (counters, KPIs, events)
        'counters': counters,  # Backward compatible simple list
        'counter_details': counters_detailed,
        'kpis': kpis,
        'events': events,

        # NEW sections
        'network_impact': network_impact,
        'activation': activation,
        'deactivation': deactivation,
        'capacity_procedure': capacity_procedure if capacity_procedure else None,
        'engineering_guidelines': engineering_guidelines,
        'change_history': change_history,

        # Release tracking
        'releases': [ch['release'] for ch in change_history] if change_history else [],
        'latest_release': change_history[0]['release'] if change_history else None
    }


def extract_document_title(content: str) -> Optional[str]:
    """Extract title from first heading after frontmatter.

    Pattern matches: # \n\nTitle Text\n
    """
    match = re.search(r'^# \s*\n\n([^\n]+)', content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return None


def extract_document_sections(content: str) -> list[str]:
    """Extract section headings from table of contents or document."""
    sections = []
    # Look for TOC list items (- Section Name)
    toc_items = re.findall(r'^- ([^\n]+)$', content, re.MULTILINE)
    for item in toc_items[:20]:  # Limit to 20 sections
        # Clean up nested items
        item = item.strip().lstrip('- ')
        # Skip image references and empty items
        if item and not item.startswith('!['):
            sections.append(item)
    return sections


def classify_document_type(title: str, sections: list[str]) -> str:
    """Classify document type based on title and sections.

    Categories:
    - safety: Health, hazard, safety documentation
    - installation: Installation guides
    - upgrade: Upgrade and migration guides
    - troubleshooting: Troubleshooting, alarm, fault docs
    - configuration: Configuration and parameter docs
    - hardware: Hardware-related documentation
    - general: Everything else
    """
    title_lower = title.lower() if title else ''
    section_text = ' '.join(sections).lower()

    if any(kw in title_lower for kw in ['safety', 'hazard', 'health']):
        return 'safety'
    elif any(kw in title_lower for kw in ['installation', 'install']):
        return 'installation'
    elif any(kw in title_lower for kw in ['upgrade', 'migration']):
        return 'upgrade'
    elif any(kw in title_lower for kw in ['troubleshoot', 'alarm', 'fault']):
        return 'troubleshooting'
    elif any(kw in title_lower for kw in ['configuration', 'parameter']):
        return 'configuration'
    elif any(kw in section_text for kw in ['hardware', 'radio unit', 'antenna']):
        return 'hardware'
    else:
        return 'general'


def process_general_document(file_path: Path, base_dir: Path) -> Optional[dict]:
    """Process a general (non-feature) document.

    Used for files that don't have FAJ codes (safety docs, installation guides, etc.)
    """
    try:
        content = file_path.read_text(encoding='utf-8')
    except Exception as e:
        print(f"Error reading {file_path}: {e}", file=sys.stderr)
        return None

    yaml_meta = extract_yaml_frontmatter(content)
    title = extract_document_title(content)
    sections = extract_document_sections(content)

    if not title:
        return None

    doc_type = classify_document_type(title, sections)
    rel_path = file_path.relative_to(base_dir)
    doc_id = file_path.stem  # Filename without extension

    return {
        'id': doc_id,
        'title': title,
        'type': doc_type,
        'sections': sections,
        'file': str(rel_path),
        'metadata': {
            'complexity_score': yaml_meta.get('complexity_score'),
            'quality_score': yaml_meta.get('quality_score'),
            'tables_extracted': yaml_meta.get('tables_extracted'),
            'source_file': yaml_meta.get('source_file'),
            'source_zip': yaml_meta.get('source_zip')
        } if yaml_meta else None
    }


def build_counter_index(features: dict) -> dict:
    """Build reverse index from counter to features with descriptions.

    Enhanced structure includes:
    - name: short counter name (e.g., pmMimoSleepTime)
    - mo_class: MO class (e.g., EUtranCellFDD)
    - description: counter description (if available)
    - unit: measurement unit (e.g., ms, bytes)
    - counter_type: ACC, GAUGE, DER, CC, PDF, PEG
    - features: list of FAJ keys that use this counter
    """
    counters = {}

    for faj_key, feature in features.items():
        for counter in feature.get('counter_details', []):
            counter_name = counter['name']
            mo_class = counter['mo_class']
            full_name = counter['full_name']

            if full_name not in counters:
                counters[full_name] = {
                    'name': counter_name,
                    'mo_class': mo_class,
                    'description': counter.get('description'),
                    'unit': counter.get('unit'),
                    'counter_type': counter.get('counter_type'),
                    'features': []
                }
            else:
                # Update description/unit/type if we have better data
                if counter.get('description') and not counters[full_name].get('description'):
                    counters[full_name]['description'] = counter['description']
                if counter.get('unit') and not counters[full_name].get('unit'):
                    counters[full_name]['unit'] = counter['unit']
                if counter.get('counter_type') and not counters[full_name].get('counter_type'):
                    counters[full_name]['counter_type'] = counter['counter_type']

            if faj_key not in counters[full_name]['features']:
                counters[full_name]['features'].append(faj_key)

    return counters


def build_mo_class_index(features: dict) -> dict:
    """Build reverse index from MO class to features and parameters."""
    mo_classes = {}

    for faj_key, feature in features.items():
        # Track features by MO class
        for mo_class in feature.get('mo_classes', []):
            if mo_class not in mo_classes:
                mo_classes[mo_class] = {
                    'features': [],
                    'parameters': [],
                    'counters': []
                }
            if faj_key not in mo_classes[mo_class]['features']:
                mo_classes[mo_class]['features'].append(faj_key)

        # Track parameters by MO class
        for param in feature.get('param_details', []):
            parts = param['name'].split('.')
            if len(parts) >= 2:
                mo_class = parts[0]
                if mo_class not in mo_classes:
                    mo_classes[mo_class] = {'features': [], 'parameters': [], 'counters': []}
                if param['name'] not in mo_classes[mo_class]['parameters']:
                    mo_classes[mo_class]['parameters'].append(param['name'])

        # Track counters by MO class
        for counter in feature.get('counter_details', []):
            mo_class = counter['mo_class']
            if mo_class not in mo_classes:
                mo_classes[mo_class] = {'features': [], 'parameters': [], 'counters': []}
            if counter['full_name'] not in mo_classes[mo_class]['counters']:
                mo_classes[mo_class]['counters'].append(counter['full_name'])

    return mo_classes


def build_acronym_index(features: dict) -> dict:
    """Build lightweight acronym → FAJ lookup index."""
    index = {}
    for faj_key, feature in features.items():
        acronym = feature.get('acronym')
        if acronym:
            index[acronym] = faj_key
    return index


def build_cxc_index(features: dict) -> dict:
    """Build lightweight CXC → FAJ lookup index."""
    index = {}
    for faj_key, feature in features.items():
        cxc = feature.get('cxc')
        if cxc:
            index[cxc] = faj_key
    return index


def build_category_index(features: dict) -> dict:
    """Build category → [FAJ list] index for filtering by functional domain.

    Uses word boundary matching to avoid false positives like 'CA' matching 'WCDMA'.
    """
    import re

    # Category patterns with word boundaries for precise matching
    category_patterns = {
        'Carrier Aggregation': [
            r'\bcarrier\s+aggregation\b', r'\binter-band\b', r'\bintra-band\b',
            r'\b\d+\s*cc\b', r'\buplink\s+ca\b', r'\bdownlink\s+ca\b',
            r'\bcarrier\s+combination\b', r'\bdual\s+carrier\b'
        ],
        'Radio Resource Management': [
            r'\bload\s+balanc', r'\badmission\s+control\b', r'\bcongestion\b',
            r'\bscheduler\b', r'\bscheduling\b', r'\bresource\s+partitioning\b',
            r'\boffload\b', r'\btraffic\s+steering\b'
        ],
        'NR/5G': [
            r'\bnr\s', r'\b5g\b', r'\bnsa\b', r'\bsa\s', r'\ben-dc\b',
            r'\bdss\b', r'\bgnb\b', r'\bnr-dc\b', r'\bnrcell\b'
        ],
        'Transport & Connectivity': [
            r'\bfronthaul\b', r'\bbackhaul\b', r'\bx2\b', r'\bxn\b',
            r'\bs1\s', r'\bng\s+interface\b', r'\bethernet\b', r'\bvlan\b',
            r'\bf1\s', r'\be1\s', r'\bipv[46]\b'
        ],
        'MIMO & Antenna': [
            r'\bmimo\b', r'\bantenna\b', r'\bbeamforming\b', r'\bmassive\s+mimo\b',
            r'\btm[89]\b', r'\b[248]x[248]\b', r'\btransmission\s+mode\b',
            r'\blayer\s+beamforming\b'
        ],
        'Mobility & Handover': [
            r'\bmobility\b', r'\bhandover\b', r'\bneighbor\s+relation\b',
            r'\banr\b', r'\breselection\b', r'\brrc\s+connection\b',
            r'\binter-rat\b', r'\bintra-freq\b', r'\binter-freq\b'
        ],
        'Energy Saving': [
            r'\bsleep\s+mode\b', r'\benergy\s+sav', r'\bpower\s+sav',
            r'\bmicro\s+sleep\b', r'\bcell\s+sleep\b', r'\bmimo\s+sleep\b',
            r'\bshutdown\b', r'\befficiency\b'
        ],
        'Coverage & Capacity': [
            r'\bcoverage\b', r'\bcapacity\b', r'\bsector\b',
            r'\bextended\s+range\b', r'\bcell\s+config', r'\bextended\s+cell\b'
        ],
        'Voice & IMS': [
            r'\bvoice\b', r'\bvolte\b', r'\bvonr\b', r'\bcsfb\b',
            r'\bims\b', r'\bspeech\b', r'\bcs\s+fallback\b', r'\bevs\b'
        ],
        'UE Handling': [
            r'\bpaging\b', r'\bdrx\b', r'\bdtx\b', r'\bidle\s+mode\b',
            r'\bconnected\s+mode\b', r'\bue\s+handl', r'\bue\s+specific\b'
        ],
        'QoS & Scheduling': [
            r'\bqos\b', r'\bpriority\s+schedul', r'\bgbr\b',
            r'\bqci\b', r'\bbearer\b', r'\bquality\s+of\s+service\b'
        ],
        'Interference Management': [
            r'\binterference\b', r'\bicic\b', r'\beicic\b', r'\bcomp\b',
            r'\bmitigation\b', r'\binterference\s+management\b'
        ],
        'Timing & Sync': [
            r'\btiming\b', r'\bsynchronization\b', r'\bieee\s*1588\b',
            r'\bptp\b', r'\bgps\b', r'\bphase\s+sync\b', r'\btime\s+sync\b'
        ],
        'Security': [
            r'\bsecurity\b', r'\bencryption\b', r'\bauthentication\b',
            r'\bmacsec\b', r'\bcipher\b', r'\bipsec\b'
        ],
        'Self-Organizing Network': [
            r'\bson\b', r'\bautomated\s+neighbor\b', r'\bself-optim',
            r'\bauto-config', r'\bself-heal'
        ],
        'Positioning': [
            r'\bpositioning\b', r'\blocation\b', r'\btiming\s+advance\b',
            r'\bangle\s+of\s+arrival\b', r'\baoa\b', r'\butdoa\b'
        ]
    }

    index = {cat: [] for cat in category_patterns}
    index['Other'] = []

    for faj_key, feature in features.items():
        name = feature.get('name', '')
        summary = feature.get('summary', '') or ''
        text = (name + ' ' + summary).lower()

        categorized = False
        for category, patterns in category_patterns.items():
            if any(re.search(pat, text) for pat in patterns):
                index[category].append(faj_key)
                categorized = True
                break

        if not categorized:
            index['Other'].append(faj_key)

    # Remove empty categories
    return {k: v for k, v in index.items() if v}


def build_search_index(features: dict) -> dict:
    """Build inverted index for fast keyword search."""
    import re
    from collections import defaultdict

    # Term → [FAJ list] mapping
    terms = defaultdict(list)

    # Stop words to exclude
    stop_words = {'a', 'an', 'the', 'at', 'by', 'for', 'in', 'of', 'on', 'to', 'with', 'and', 'or', 'is', 'are', 'this', 'that'}

    for faj_key, feature in features.items():
        # Combine searchable text
        name = feature.get('name', '')
        summary = feature.get('summary', '') or ''
        text = name + ' ' + summary

        # Tokenize and normalize
        tokens = re.findall(r'[a-zA-Z]{2,}', text.lower())

        # Add to index
        seen = set()
        for token in tokens:
            if token not in stop_words and token not in seen:
                seen.add(token)
                terms[token].append(faj_key)

    # Extract quick lookup lists
    acronyms = sorted([f.get('acronym') for f in features.values() if f.get('acronym')])
    cxc_codes = sorted([f.get('cxc') for f in features.values() if f.get('cxc')])
    mo_classes = set()
    for f in features.values():
        mo_classes.update(f.get('mo_classes', []))

    return {
        'terms': dict(terms),
        'acronyms': acronyms,
        'cxc_codes': cxc_codes,
        'mo_classes': sorted(list(mo_classes))
    }


def build_release_index(features: dict) -> dict:
    """Build index by release version."""
    releases = {}

    for faj_key, feature in features.items():
        for change in feature.get('change_history', []):
            release = change['release']

            if release not in releases:
                releases[release] = {
                    'features': [],
                    'changes': []
                }

            if faj_key not in releases[release]['features']:
                releases[release]['features'].append(faj_key)

            releases[release]['changes'].append({
                'faj': faj_key,
                'feature_name': feature['name'],
                'title': change['title']
            })

    # Sort releases by version (newest first)
    def parse_release(r):
        match = re.match(r'(\d+)\.Q(\d)(?:\.(\d))?', r)
        if match:
            return (int(match.group(1)), int(match.group(2)), int(match.group(3) or 0))
        return (0, 0, 0)

    sorted_releases = dict(sorted(releases.items(), key=lambda x: parse_release(x[0]), reverse=True))
    return sorted_releases


def build_event_index(features: dict) -> dict:
    """Build reverse index from event name to features.

    Structure: {
        "INTERNAL_EVENT_UE_MOBILITY": {
            "type": "internal_event",
            "features": ["FAJ_121_xxxx", ...]
        }
    }
    """
    events = {}

    for faj_key, feature in features.items():
        for event in feature.get('events', []):
            event_name = event.get('name') if isinstance(event, dict) else str(event)
            event_type = event.get('type', 'unknown') if isinstance(event, dict) else 'internal_event'

            if event_name not in events:
                events[event_name] = {
                    'type': event_type,
                    'features': []
                }
            if faj_key not in events[event_name]['features']:
                events[event_name]['features'].append(faj_key)

    return events


def extract_kpi_keywords(text: str) -> list[str]:
    """Extract searchable keywords from KPI text."""
    keywords = set()
    text_lower = text.lower()

    # Common KPI terms
    kpi_terms = [
        'throughput', 'success rate', 'latency', 'availability',
        'retainability', 'accessibility', 'mobility', 'handover',
        'capacity', 'utilization', 'efficiency', 'e-rab', 'rrc',
        'pdcp', 'rlc', 'mac', 'uplink', 'downlink', 'ul', 'dl',
        'cell', 'ue', 'user', 'traffic', 'load', 'queue'
    ]

    for term in kpi_terms:
        if term in text_lower:
            keywords.add(term)

    return sorted(list(keywords))


def infer_kpi_name(raw_name: str, description: str = '') -> str:
    """Infer a short KPI name from raw text.

    If the raw_name is too long (likely a description), try to extract
    a meaningful short name from it.
    """
    # If it's already a reasonable name (< 50 chars), use it
    if len(raw_name) <= 50:
        return raw_name

    # Try to extract a recognizable KPI pattern from the text
    combined = raw_name + ' ' + description

    # Look for common KPI patterns
    patterns = [
        r'((?:E-RAB|RRC|PDCP|MAC)\s+\w+\s+(?:Rate|Success|Retainability))',
        r'((?:Mobility|Handover|Accessibility)\s+Success\s+Rate)',
        r'((?:Uplink|Downlink|UL|DL)\s+(?:MAC|Cell)?\s*Throughput)',
        r'(Cell\s+(?:Throughput|Availability|Capacity))',
        r'(\w+\s+Success\s+Rate)',
        r'(\w+\s+Throughput)',
        r'(\w+\s+Retainability)',
    ]

    for pattern in patterns:
        match = re.search(pattern, combined, re.IGNORECASE)
        if match:
            return match.group(1).strip()

    # If no pattern found, generate a short key from first few words
    words = raw_name.split()[:6]
    return ' '.join(words)[:50] + '...' if len(raw_name) > 50 else raw_name


def build_kpi_index(features: dict) -> dict:
    """Build reverse index from KPI name to features.

    Structure: {
        "Mobility Success Rate": {
            "description": "The Mobility Success Rate KPI...",
            "features": ["FAJ_121_xxxx", ...],
            "keywords": ["mobility", "success rate", ...]
        }
    }
    """
    kpis = {}

    for faj_key, feature in features.items():
        for kpi in feature.get('kpis', []):
            raw_name = kpi.get('name', '') if isinstance(kpi, dict) else str(kpi)
            kpi_desc = kpi.get('description', '') if isinstance(kpi, dict) else ''

            # Skip empty entries
            if not raw_name.strip():
                continue

            # Infer a proper KPI name if the raw name is too long
            kpi_name = infer_kpi_name(raw_name, kpi_desc)

            # Use raw_name as description if kpi_desc is empty
            full_description = kpi_desc if kpi_desc else raw_name

            # Extract searchable keywords
            keywords = extract_kpi_keywords(raw_name + ' ' + kpi_desc)

            if kpi_name not in kpis:
                kpis[kpi_name] = {
                    'description': full_description[:500],  # Truncate long descriptions
                    'features': [],
                    'keywords': keywords
                }
            else:
                # Merge keywords from duplicate entries
                existing_keywords = set(kpis[kpi_name].get('keywords', []))
                existing_keywords.update(keywords)
                kpis[kpi_name]['keywords'] = sorted(list(existing_keywords))

            if faj_key not in kpis[kpi_name]['features']:
                kpis[kpi_name]['features'].append(faj_key)

    return kpis


def build_guidelines_index(features: dict) -> dict:
    """Build index of engineering guidelines subsections for search.

    Structure: {
        "Configuration": ["FAJ_121_xxxx", ...],
        "Tuning Parameters": ["FAJ_121_xxxx", ...],
        ...
    }
    """
    subsections = {}

    for faj_key, feature in features.items():
        eg = feature.get('engineering_guidelines', {})
        if not eg.get('has_guidelines'):
            continue

        for subsection in eg.get('subsections', []):
            subsection_normalized = subsection.strip()
            if subsection_normalized not in subsections:
                subsections[subsection_normalized] = []
            if faj_key not in subsections[subsection_normalized]:
                subsections[subsection_normalized].append(faj_key)

    return subsections


def build_indexes(source_dir: Path, output_dir: Path):
    """Build feature and parameter indexes from markdown files."""
    features = {}
    parameters = {}
    skipped_files = []  # Track files without FAJ codes for document processing

    # Find all markdown files
    md_files = list(source_dir.rglob('*.md'))
    print(f"Found {len(md_files)} markdown files")

    processed = 0
    skipped = 0

    for md_file in md_files:
        feature_data = process_markdown_file(md_file, source_dir)

        if feature_data:
            faj_key = normalize_faj_key(feature_data['faj'])
            features[faj_key] = feature_data
            processed += 1

            # Build reverse parameter index
            for param in feature_data['param_details']:
                param_name = param['name']
                if param_name not in parameters:
                    parameters[param_name] = {
                        'features': [],
                        'types': {}
                    }
                parameters[param_name]['features'].append(faj_key)
                parameters[param_name]['types'][faj_key] = param['type']
        else:
            skipped_files.append(md_file)  # Collect skipped files for document processing
            skipped += 1

    print(f"Processed {processed} features, skipped {skipped} files")

    # Write features.json
    features_file = output_dir / 'features.json'
    with open(features_file, 'w', encoding='utf-8') as f:
        json.dump(features, f, indent=2, ensure_ascii=False)
    print(f"Wrote {features_file} ({len(features)} features)")

    # Write parameters.json
    params_file = output_dir / 'parameters.json'
    with open(params_file, 'w', encoding='utf-8') as f:
        json.dump(parameters, f, indent=2, ensure_ascii=False)
    print(f"Wrote {params_file} ({len(parameters)} parameters)")

    # NEW: Build and write counters.json
    counters_index = build_counter_index(features)
    counters_file = output_dir / 'counters.json'
    with open(counters_file, 'w', encoding='utf-8') as f:
        json.dump(counters_index, f, indent=2, ensure_ascii=False)
    print(f"Wrote {counters_file} ({len(counters_index)} counters)")

    # NEW: Build and write mo_classes.json
    mo_index = build_mo_class_index(features)
    mo_file = output_dir / 'mo_classes.json'
    with open(mo_file, 'w', encoding='utf-8') as f:
        json.dump(mo_index, f, indent=2, ensure_ascii=False)
    print(f"Wrote {mo_file} ({len(mo_index)} MO classes)")

    # NEW: Build and write releases.json
    releases_index = build_release_index(features)
    releases_file = output_dir / 'releases.json'
    with open(releases_file, 'w', encoding='utf-8') as f:
        json.dump(releases_index, f, indent=2, ensure_ascii=False)
    print(f"Wrote {releases_file} ({len(releases_index)} releases)")

    # NEW: Build and write dependency_graph.json
    dep_graph = build_dependency_graph(features)
    dep_graph_file = output_dir / 'dependency_graph.json'
    with open(dep_graph_file, 'w', encoding='utf-8') as f:
        json.dump(dep_graph, f, indent=2, ensure_ascii=False)
    stats = dep_graph['stats']
    print(f"Wrote {dep_graph_file} ({stats['total_nodes']} nodes, {stats['prerequisite_edges']} prereq edges)")

    # NEW: Build lightweight lookup indexes
    print("\nBuilding lightweight lookup indexes...")

    # Acronym index
    acronym_index = build_acronym_index(features)
    acronym_file = output_dir / 'index_acronym.json'
    with open(acronym_file, 'w', encoding='utf-8') as f:
        json.dump(acronym_index, f, indent=2, ensure_ascii=False)
    print(f"Wrote {acronym_file} ({len(acronym_index)} acronyms)")

    # CXC index
    cxc_index = build_cxc_index(features)
    cxc_file = output_dir / 'index_cxc.json'
    with open(cxc_file, 'w', encoding='utf-8') as f:
        json.dump(cxc_index, f, indent=2, ensure_ascii=False)
    print(f"Wrote {cxc_file} ({len(cxc_index)} CXC codes)")

    # Category index
    category_index = build_category_index(features)
    category_file = output_dir / 'index_categories.json'
    with open(category_file, 'w', encoding='utf-8') as f:
        json.dump(category_index, f, indent=2, ensure_ascii=False)
    cat_counts = {k: len(v) for k, v in category_index.items()}
    print(f"Wrote {category_file} ({len(category_index)} categories)")
    for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1]):
        print(f"  - {cat}: {count}")

    # Search index
    search_index = build_search_index(features)
    search_file = output_dir / 'index_search.json'
    with open(search_file, 'w', encoding='utf-8') as f:
        json.dump(search_index, f, indent=2, ensure_ascii=False)
    print(f"Wrote {search_file} ({len(search_index['terms'])} terms, {len(search_index['acronyms'])} acronyms)")

    # NEW: Events index
    print("\nBuilding additional indexes...")
    events_index = build_event_index(features)
    events_file = output_dir / 'events.json'
    with open(events_file, 'w', encoding='utf-8') as f:
        json.dump(events_index, f, indent=2, ensure_ascii=False)
    print(f"Wrote {events_file} ({len(events_index)} events)")

    # NEW: KPIs index
    kpis_index = build_kpi_index(features)
    kpis_file = output_dir / 'kpis.json'
    with open(kpis_file, 'w', encoding='utf-8') as f:
        json.dump(kpis_index, f, indent=2, ensure_ascii=False)
    print(f"Wrote {kpis_file} ({len(kpis_index)} KPIs)")

    # NEW: Engineering guidelines index
    guidelines_index = build_guidelines_index(features)
    guidelines_file = output_dir / 'index_guidelines.json'
    with open(guidelines_file, 'w', encoding='utf-8') as f:
        json.dump(guidelines_index, f, indent=2, ensure_ascii=False)
    print(f"Wrote {guidelines_file} ({len(guidelines_index)} guideline sections)")

    # Process skipped files as general documents
    documents = {}
    if skipped_files:
        print(f"\nProcessing {len(skipped_files)} general documents...")
        for doc_file in skipped_files:
            doc_data = process_general_document(doc_file, source_dir)
            if doc_data:
                documents[doc_data['id']] = doc_data

        # Write documents.json
        docs_file = output_dir / 'documents.json'
        with open(docs_file, 'w', encoding='utf-8') as f:
            json.dump(documents, f, indent=2, ensure_ascii=False)
        print(f"Wrote {docs_file} ({len(documents)} documents)")

        # Build document type index
        doc_types = {}
        for doc_id, doc in documents.items():
            doc_type = doc['type']
            if doc_type not in doc_types:
                doc_types[doc_type] = []
            doc_types[doc_type].append(doc_id)

        doc_types_file = output_dir / 'index_document_types.json'
        with open(doc_types_file, 'w', encoding='utf-8') as f:
            json.dump(doc_types, f, indent=2, ensure_ascii=False)
        print(f"Wrote {doc_types_file} ({len(doc_types)} document types)")
        for doc_type, doc_ids in sorted(doc_types.items(), key=lambda x: -len(x[1])):
            print(f"  - {doc_type}: {len(doc_ids)}")

    # Generate catalog.md
    generate_catalog(features, output_dir, documents)

    return features, parameters


def generate_catalog(features: dict, output_dir: Path, documents: dict = None):
    """Generate a human-readable catalog of features and documents."""
    catalog_file = output_dir / 'catalog.md'

    lines = [
        "# Ericsson RAN Features Catalog",
        "",
        f"Total features: {len(features)}",
        "",
        "| Feature | FAJ Code | CXC Code | Access | License |",
        "|---------|----------|----------|--------|---------|"
    ]

    # Sort by FAJ code
    for faj_key in sorted(features.keys()):
        f = features[faj_key]
        name = f['name'][:40] + '...' if len(f['name']) > 40 else f['name']
        access = '/'.join(f['access']) if f['access'] else '-'
        cxc = f['cxc'] or '-'
        license_str = 'Yes' if f['license'] else 'No'

        lines.append(f"| {name} | {f['faj']} | {cxc} | {access} | {license_str} |")

    # Add documents section if available
    if documents:
        lines.append("")
        lines.append("## General Documentation")
        lines.append("")
        lines.append(f"Total documents: {len(documents)}")
        lines.append("")
        lines.append("| Document | Type | File |")
        lines.append("|----------|------|------|")

        for doc_id in sorted(documents.keys()):
            d = documents[doc_id]
            title = d['title'][:50] + '...' if len(d['title']) > 50 else d['title']
            lines.append(f"| {title} | {d['type']} | {d['file']} |")

    lines.append("")

    with open(catalog_file, 'w', encoding='utf-8') as file:
        file.write('\n'.join(lines))

    print(f"Wrote {catalog_file}")


def main():
    parser = argparse.ArgumentParser(
        description='Build index from Ericsson RAN feature markdown files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  build_index.py                         # Use default paths
  build_index.py /path/to/source         # Custom source directory
  build_index.py /source /output         # Custom source and output directories

Default paths:
  Source: ../elex_features (relative to script)
  Output: ../references (relative to script)

Output files generated:
  features.json        - Full feature metadata
  parameters.json      - Parameter → features reverse index
  counters.json        - Counter → features reverse index
  mo_classes.json      - MO class → features/params/counters
  releases.json        - Release → changes index
  dependency_graph.json - Feature dependencies
  index_acronym.json   - Acronym → FAJ lookup
  index_cxc.json       - CXC → FAJ lookup
  index_categories.json - Domain categorization
  index_search.json    - Inverted search index
  documents.json       - General documentation index (non-feature docs)
  index_document_types.json - Documents grouped by type
  catalog.md           - Quick-scan feature and document list
        '''
    )
    parser.add_argument('source_dir', nargs='?', help='Source directory with markdown files')
    parser.add_argument('output_dir', nargs='?', help='Output directory for JSON files')

    args = parser.parse_args()

    # Default paths
    script_dir = Path(__file__).parent
    skill_dir = script_dir.parent

    # Source directory (elex_features)
    source_dir = Path(args.source_dir) if args.source_dir else skill_dir.parent / 'elex_features'

    # Output directory (references)
    output_dir = Path(args.output_dir) if args.output_dir else skill_dir / 'references'
    output_dir.mkdir(exist_ok=True)

    if not source_dir.exists():
        print(f"Error: Source directory not found: {source_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Source: {source_dir}")
    print(f"Output: {output_dir}")

    build_indexes(source_dir, output_dir)
    print("Done!")


if __name__ == '__main__':
    main()
