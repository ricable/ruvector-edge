#!/usr/bin/env python3
"""
Unified search CLI for Ericsson RAN features.
Search by name, FAJ code, CXC code, parameter, access type, or keyword.
Supports fuzzy matching, boolean queries, and multiple output formats.
"""

import argparse
import json
import re
import sys
import time
from difflib import SequenceMatcher
from pathlib import Path
from typing import Optional

# ============================================================================
# INDEX CACHING (Optimized with lightweight indexes)
# ============================================================================

_index_cache: dict = {}
_cache_ttl = 300  # 5 minutes


def get_cached_indexes(script_dir: Path) -> tuple[dict, dict, dict, dict, dict]:
    """Load indexes with caching (5-minute TTL)."""
    cache_key = str(script_dir)
    now = time.time()

    if cache_key in _index_cache:
        cached_time, data = _index_cache[cache_key]
        if now - cached_time < _cache_ttl:
            return data

    data = load_indexes(script_dir)
    _index_cache[cache_key] = (now, data)
    return data


def load_lightweight_indexes(script_dir: Path) -> dict:
    """Load only lightweight indexes for fast lookups (~50KB vs 4MB).

    Returns dict with: acronym_index, cxc_index, category_index, search_index
    """
    ref_dir = script_dir.parent / 'references'

    indexes = {
        'acronym': {},
        'cxc': {},
        'categories': {},
        'search': {}
    }

    # Load acronym index (~14KB)
    acronym_file = ref_dir / 'index_acronym.json'
    if acronym_file.exists():
        with open(acronym_file) as f:
            indexes['acronym'] = json.load(f)

    # Load CXC index (~12KB)
    cxc_file = ref_dir / 'index_cxc.json'
    if cxc_file.exists():
        with open(cxc_file) as f:
            indexes['cxc'] = json.load(f)

    # Load category index (~11KB)
    category_file = ref_dir / 'index_categories.json'
    if category_file.exists():
        with open(category_file) as f:
            indexes['categories'] = json.load(f)

    # Load search index (~500KB) - optional, only if needed
    search_file = ref_dir / 'index_search.json'
    if search_file.exists():
        with open(search_file) as f:
            indexes['search'] = json.load(f)

    return indexes


# Lightweight index cache (separate from full index cache)
_lightweight_cache: dict = {}


def get_lightweight_indexes(script_dir: Path) -> dict:
    """Get lightweight indexes with caching."""
    cache_key = str(script_dir) + '_lightweight'
    now = time.time()

    if cache_key in _lightweight_cache:
        cached_time, data = _lightweight_cache[cache_key]
        if now - cached_time < _cache_ttl:
            return data

    data = load_lightweight_indexes(script_dir)
    _lightweight_cache[cache_key] = (now, data)
    return data


def load_indexes(script_dir: Path) -> tuple[dict, dict, dict, dict, dict]:
    """Load all index files (full 4MB features.json when needed)."""
    ref_dir = script_dir.parent / 'references'

    features_file = ref_dir / 'features.json'
    params_file = ref_dir / 'parameters.json'
    counters_file = ref_dir / 'counters.json'
    mo_classes_file = ref_dir / 'mo_classes.json'
    releases_file = ref_dir / 'releases.json'

    if not features_file.exists():
        print(f"Error: features.json not found. Run build_index.py first.", file=sys.stderr)
        sys.exit(1)

    with open(features_file) as f:
        features = json.load(f)

    params = {}
    if params_file.exists():
        with open(params_file) as f:
            params = json.load(f)

    counters = {}
    if counters_file.exists():
        with open(counters_file) as f:
            counters = json.load(f)

    mo_classes = {}
    if mo_classes_file.exists():
        with open(mo_classes_file) as f:
            mo_classes = json.load(f)

    releases = {}
    if releases_file.exists():
        with open(releases_file) as f:
            releases = json.load(f)

    return features, params, counters, mo_classes, releases


def load_single_feature(script_dir: Path, faj_key: str) -> Optional[dict]:
    """Load a single feature from features.json by FAJ key.

    For small lookups, this loads the full file once and caches it.
    """
    features, _, _, _, _ = get_cached_indexes(script_dir)
    return features.get(faj_key)


def search_by_name(features: dict, query: str, limit: int = 10) -> list[dict]:
    """Fuzzy search features by name."""
    query_lower = query.lower()
    results = []

    for faj_key, feature in features.items():
        name_lower = feature['name'].lower()
        if query_lower in name_lower:
            # Score by position and length match
            pos = name_lower.find(query_lower)
            score = (100 - pos) + (len(query) / len(feature['name']) * 50)
            results.append((score, faj_key, feature))

    results.sort(reverse=True, key=lambda x: x[0])
    return [(r[1], r[2]) for r in results[:limit]]


def search_by_faj(features: dict, query: str) -> Optional[tuple[str, dict]]:
    """Exact search by FAJ code."""
    # Normalize query: FAJ 121 4219 -> FAJ_121_4219
    query_normalized = query.strip().upper().replace(' ', '_')

    # Handle partial matches (just the numbers)
    if not query_normalized.startswith('FAJ'):
        query_normalized = 'FAJ_' + query_normalized.replace(' ', '_')

    if query_normalized in features:
        return (query_normalized, features[query_normalized])

    # Try partial match
    for faj_key, feature in features.items():
        if query.replace(' ', '') in faj_key.replace('_', ''):
            return (faj_key, feature)

    return None


def search_by_cxc(features: dict, query: str, lightweight_indexes: dict = None) -> list[tuple[str, dict]]:
    """Search features by CXC activation code.

    Uses lightweight CXC index for O(1) exact match before falling back to scan.
    """
    query_upper = query.upper().strip()
    results = []

    # Try O(1) lookup using lightweight index first
    if lightweight_indexes and lightweight_indexes.get('cxc'):
        cxc_index = lightweight_indexes['cxc']
        if query_upper in cxc_index:
            faj_key = cxc_index[query_upper]
            if faj_key in features:
                return [(faj_key, features[faj_key])]

    # Fall back to substring search
    for faj_key, feature in features.items():
        if feature.get('cxc') and query_upper in feature['cxc'].upper():
            results.append((faj_key, feature))

    return results


def search_by_param(features: dict, params: dict, query: str, limit: int = 20) -> list[tuple[str, dict]]:
    """Search features by parameter name."""
    query_lower = query.lower()
    matching_params = []

    # Find matching parameters
    for param_name in params.keys():
        if query_lower in param_name.lower():
            matching_params.append(param_name)

    # Get features for those parameters
    feature_keys = set()
    for param_name in matching_params:
        for faj_key in params[param_name]['features']:
            feature_keys.add(faj_key)

    results = []
    for faj_key in feature_keys:
        if faj_key in features:
            results.append((faj_key, features[faj_key]))

    return results[:limit]


def search_by_access(features: dict, access_type: str) -> list[tuple[str, dict]]:
    """Filter features by access type (LTE, NR, WCDMA, GSM)."""
    access_upper = access_type.upper().strip()
    results = []

    for faj_key, feature in features.items():
        if access_upper in [a.upper() for a in feature.get('access', [])]:
            results.append((faj_key, feature))

    return sorted(results, key=lambda x: x[1]['name'])


def search_by_keyword(features: dict, keyword: str, limit: int = 20) -> list[tuple[str, dict]]:
    """Full-text keyword search across feature names and file paths."""
    keyword_lower = keyword.lower()
    results = []

    for faj_key, feature in features.items():
        score = 0
        name_lower = feature['name'].lower()

        if keyword_lower in name_lower:
            score += 100
            # Bonus for word boundary match
            if re.search(r'\b' + re.escape(keyword_lower) + r'\b', name_lower):
                score += 50

        # Check in parameter names
        for param in feature.get('params', []):
            if keyword_lower in param.lower():
                score += 20

        # Check in summary/description
        summary = feature.get('summary', '')
        if summary and keyword_lower in summary.lower():
            score += 30

        # Check in engineering guidelines
        eng_guide = feature.get('engineering_guidelines', {})
        if eng_guide:
            if eng_guide.get('summary') and keyword_lower in eng_guide['summary'].lower():
                score += 25
            # Check subsections
            for subsection in eng_guide.get('subsections', []):
                if keyword_lower in str(subsection).lower():
                    score += 15
                    break

        # Check in counter names
        for counter in feature.get('counters', []):
            if keyword_lower in counter.lower():
                score += 20
                break

        if score > 0:
            results.append((score, faj_key, feature))

    results.sort(reverse=True, key=lambda x: x[0])
    return [(r[1], r[2]) for r in results[:limit]]


def search_by_acronym(features: dict, query: str, lightweight_indexes: dict = None) -> list[tuple[str, dict]]:
    """Search features by acronym (e.g., IFLB, DUAC, MCPC).

    Uses lightweight acronym index for O(1) exact match before falling back to scan.
    """
    query_upper = query.upper().strip()
    results = []

    # Minimum 2 characters for acronym search
    if len(query_upper) < 2:
        return results

    # Try O(1) lookup using lightweight index first (exact match)
    if lightweight_indexes and lightweight_indexes.get('acronym'):
        acronym_index = lightweight_indexes['acronym']
        if query_upper in acronym_index:
            faj_key = acronym_index[query_upper]
            if faj_key in features:
                return [(faj_key, features[faj_key])]

    # Fall back to fuzzy acronym matching
    for faj_key, feature in features.items():
        acronym = feature.get('acronym', '')
        if not acronym:
            continue

        acronym_upper = acronym.upper()

        # Exact match gets highest score
        if acronym_upper == query_upper:
            results.append((100, faj_key, feature))
        # Acronym ends with query (e.g., "IFLB" matches "UTA-IFLB")
        elif acronym_upper.endswith('-' + query_upper) or acronym_upper.endswith(query_upper):
            results.append((80, faj_key, feature))
        # Query contains the acronym as suffix (e.g., "CA-IFLB" query matches "IFLB")
        elif query_upper.endswith('-' + acronym_upper):
            results.append((70, faj_key, feature))
        # Check if query appears in feature name as a word boundary (not just substring)
        elif re.search(r'\b' + re.escape(query_upper) + r'\b', feature['name'].upper()):
            results.append((60, faj_key, feature))

    results.sort(reverse=True, key=lambda x: x[0])
    return [(r[1], r[2]) for r in results]


def search_by_counter(features: dict, counters: dict, query: str, limit: int = 20) -> list[tuple[str, dict]]:
    """Search features by counter/KPI name with improved matching.

    Supports:
    - Case-insensitive substring matching
    - Wildcard patterns (*, ?) using fnmatch
    - Smart scoring: exact > prefix > contains

    Searches both the full qualified name (MO.counter) and just the counter name.
    Also searches directly in feature counter lists for broader matching.
    """
    import fnmatch

    query_lower = query.lower()
    feature_scores = {}  # faj_key -> (score, match_counter)

    # Check if query contains wildcards
    has_wildcards = '*' in query or '?' in query
    if has_wildcards:
        pattern = query_lower

    # Method 1: Search in counters.json index with scoring
    for counter_name, counter_data in counters.items():
        counter_lower = counter_name.lower()
        short_name = counter_data.get('name', '').lower()

        score = 0
        if has_wildcards:
            if fnmatch.fnmatch(counter_lower, pattern) or fnmatch.fnmatch(short_name, pattern):
                score = 80
        else:
            # Exact match on short name (highest priority)
            if query_lower == short_name:
                score = 100
            # Prefix match on short name (e.g., "pmMimo" matches "pmMimoSleepTime")
            elif short_name.startswith(query_lower):
                score = 90
            # Exact match on full qualified name
            elif query_lower == counter_lower:
                score = 85
            # Prefix match on full name
            elif counter_lower.startswith(query_lower):
                score = 75
            # Substring match (case-insensitive)
            elif query_lower in counter_lower or query_lower in short_name:
                score = 60

        if score > 0:
            for faj_key in counter_data['features']:
                if faj_key not in feature_scores or feature_scores[faj_key][0] < score:
                    feature_scores[faj_key] = (score, counter_name)

    # Method 2: Direct search in feature counter lists (catches more matches)
    for faj_key, feature in features.items():
        for counter in feature.get('counters', []):
            counter_lower = counter.lower()
            score = 0
            if has_wildcards:
                if fnmatch.fnmatch(counter_lower, pattern):
                    score = 70
            elif query_lower in counter_lower:
                score = 50

            if score > 0:
                if faj_key not in feature_scores or feature_scores[faj_key][0] < score:
                    feature_scores[faj_key] = (score, counter)
                break

    # Sort by score (descending), then by feature name
    sorted_results = sorted(feature_scores.items(), key=lambda x: (-x[1][0], features.get(x[0], {}).get('name', '')))

    results = []
    for faj_key, (score, _) in sorted_results[:limit]:
        if faj_key in features:
            results.append((faj_key, features[faj_key]))

    return results


def search_by_mo_class(features: dict, mo_classes: dict, query: str, limit: int = 20) -> list[tuple[str, dict]]:
    """Search features by MO class name."""
    query_lower = query.lower()
    matching_mo_classes = []

    for mo_class, mo_data in mo_classes.items():
        # Case-insensitive matching
        if query_lower in mo_class.lower():
            matching_mo_classes.append((mo_class, mo_data))

    # Get unique features
    feature_keys = set()
    for mo_class, mo_data in matching_mo_classes:
        for faj_key in mo_data['features']:
            feature_keys.add(faj_key)

    results = []
    for faj_key in feature_keys:
        if faj_key in features:
            results.append((faj_key, features[faj_key]))

    return results[:limit]


def search_by_release(features: dict, releases: dict, query: str, limit: int = 20) -> list[tuple[str, dict]]:
    """Search features by release version (e.g., 23.Q4, 24.Q1)."""
    query_normalized = query.upper().replace(' ', '')
    results = []
    seen = set()

    for release, release_data in releases.items():
        # Match exact or partial release (e.g., "24" matches all 24.Qx)
        if query_normalized in release.upper().replace(' ', ''):
            for faj_key in release_data['features']:
                if faj_key in features and faj_key not in seen:
                    seen.add(faj_key)
                    results.append((faj_key, features[faj_key]))

    return results[:limit]


# ============================================================================
# FUZZY MATCHING
# ============================================================================

def fuzzy_score(query: str, target: str) -> float:
    """Return similarity score between 0 and 1 using SequenceMatcher."""
    return SequenceMatcher(None, query.lower(), target.lower()).ratio()


def search_by_name_fuzzy(features: dict, query: str, limit: int = 10,
                         threshold: float = 0.4) -> list[tuple[str, dict]]:
    """Fuzzy search features by name with typo tolerance."""
    query_lower = query.lower()
    results = []

    for faj_key, feature in features.items():
        name = feature['name']
        name_lower = name.lower()

        # Exact substring match (highest priority)
        if query_lower in name_lower:
            pos = name_lower.find(query_lower)
            score = 100 + (100 - pos) + (len(query) / len(name) * 50)
            results.append((score, faj_key, feature))
        else:
            # Fuzzy match on full name
            sim = fuzzy_score(query, name)
            if sim >= threshold:
                results.append((sim * 80, faj_key, feature))
            else:
                # Check individual words in the name
                words = name_lower.split()
                for word in words:
                    word_sim = fuzzy_score(query, word)
                    if word_sim >= threshold + 0.1:  # Slightly higher threshold for word match
                        results.append((word_sim * 60, faj_key, feature))
                        break

    results.sort(reverse=True, key=lambda x: x[0])
    return [(r[1], r[2]) for r in results[:limit]]


def search_by_acronym_fuzzy(features: dict, query: str, threshold: float = 0.6) -> list[tuple[str, dict]]:
    """Fuzzy search features by acronym with typo tolerance."""
    query_upper = query.upper().strip()
    results = []

    if len(query_upper) < 2:
        return results

    for faj_key, feature in features.items():
        acronym = feature.get('acronym', '')
        if not acronym:
            continue

        acronym_upper = acronym.upper()

        # Exact match gets highest score
        if acronym_upper == query_upper:
            results.append((100, faj_key, feature))
        # Acronym ends with query
        elif acronym_upper.endswith('-' + query_upper) or acronym_upper.endswith(query_upper):
            results.append((80, faj_key, feature))
        # Query contains the acronym as suffix
        elif query_upper.endswith('-' + acronym_upper):
            results.append((70, faj_key, feature))
        # Word boundary match in name
        elif re.search(r'\b' + re.escape(query_upper) + r'\b', feature['name'].upper()):
            results.append((60, faj_key, feature))
        else:
            # Fuzzy match on acronym
            sim = fuzzy_score(query_upper, acronym_upper)
            if sim >= threshold:
                results.append((sim * 50, faj_key, feature))

    results.sort(reverse=True, key=lambda x: x[0])
    return [(r[1], r[2]) for r in results]


# ============================================================================
# BOOLEAN SEARCH
# ============================================================================

def parse_boolean_query(query: str) -> tuple[str, list[str], list[str]]:
    """Parse query into (operator, include_terms, exclude_terms).

    Supports: "term1 AND term2", "term1 OR term2", "term1 NOT term2"
    """
    query = query.strip()

    if ' AND ' in query.upper():
        terms = re.split(r'\s+AND\s+', query, flags=re.IGNORECASE)
        return ('AND', [t.strip() for t in terms], [])
    elif ' OR ' in query.upper():
        terms = re.split(r'\s+OR\s+', query, flags=re.IGNORECASE)
        return ('OR', [t.strip() for t in terms], [])
    elif ' NOT ' in query.upper():
        parts = re.split(r'\s+NOT\s+', query, flags=re.IGNORECASE)
        return ('NOT', [parts[0].strip()], [t.strip() for t in parts[1:]])
    else:
        return ('SINGLE', [query], [])


def search_by_keyword_boolean(features: dict, query: str, limit: int = 20) -> list[tuple[str, dict]]:
    """Multi-keyword search with boolean operators (AND, OR, NOT)."""
    op, include, exclude = parse_boolean_query(query)
    results = []

    for faj_key, feature in features.items():
        # Build searchable text - include access types, counters, and engineering guidelines for NOT filtering
        eng_guide = feature.get('engineering_guidelines', {})
        eng_text = eng_guide.get('summary', '') if eng_guide else ''
        searchable = f"{feature['name']} {feature.get('summary', '')} {' '.join(feature.get('params', []))} {' '.join(feature.get('access', []))} {' '.join(feature.get('counters', []))} {eng_text}".lower()

        match = False
        if op == 'AND':
            match = all(term.lower() in searchable for term in include)
        elif op == 'OR':
            match = any(term.lower() in searchable for term in include)
        elif op == 'NOT':
            match = include[0].lower() in searchable and not any(t.lower() in searchable for t in exclude)
        else:  # SINGLE
            match = include[0].lower() in searchable

        if match:
            # Calculate score based on matches
            score = 0
            name_lower = feature['name'].lower()
            for term in include:
                if term.lower() in name_lower:
                    score += 100
                elif term.lower() in searchable:
                    score += 30
            results.append((score, faj_key, feature))

    results.sort(reverse=True, key=lambda x: x[0])
    return [(r[1], r[2]) for r in results[:limit]]


def list_releases(releases: dict) -> list[tuple[str, int]]:
    """List all available releases with feature counts."""
    return [(release, len(data['features'])) for release, data in releases.items()]


def search_by_event(features: dict, query: str, limit: int = 20) -> list[tuple[str, dict]]:
    """Search features by event name (INTERNAL_EVENT_*, EVENT_PARAM_*)."""
    query_upper = query.upper()
    results = []

    for faj_key, feature in features.items():
        events = feature.get('events', [])
        matched = False
        for event in events:
            event_name = event.get('name', '') if isinstance(event, dict) else str(event)
            if query_upper in event_name.upper():
                matched = True
                break
        if matched:
            results.append((faj_key, feature))

    # Sort by name for consistent ordering
    results.sort(key=lambda x: x[1]['name'])
    return results[:limit]


def load_kpis_index(script_dir: Path) -> dict:
    """Load kpis.json index."""
    kpis_file = script_dir.parent / 'references' / 'kpis.json'
    if kpis_file.exists():
        with open(kpis_file) as f:
            return json.load(f)
    return {}


def search_by_kpi(features: dict, query: str, limit: int = 20, script_dir: Path = None) -> list[tuple[str, dict]]:
    """Search features by KPI name, description, or keywords."""
    query_lower = query.lower()
    results = []
    feature_scores = {}  # Track scores for ranking

    # First, try searching the kpis.json index (has keywords)
    if script_dir:
        kpis_index = load_kpis_index(script_dir)
        for kpi_name, kpi_data in kpis_index.items():
            score = 0
            # Match in KPI name
            if query_lower in kpi_name.lower():
                score += 100
            # Match in description
            if query_lower in kpi_data.get('description', '').lower():
                score += 50
            # Match in keywords
            for keyword in kpi_data.get('keywords', []):
                if query_lower in keyword.lower() or keyword.lower() in query_lower:
                    score += 30

            if score > 0:
                for faj_key in kpi_data.get('features', []):
                    if faj_key in features:
                        feature_scores[faj_key] = max(feature_scores.get(faj_key, 0), score)

    # Also search directly in feature kpis (in case index is outdated)
    for faj_key, feature in features.items():
        kpis = feature.get('kpis', [])
        for kpi in kpis:
            kpi_name = kpi.get('name', '') if isinstance(kpi, dict) else str(kpi)
            kpi_desc = kpi.get('description', '') if isinstance(kpi, dict) else ''
            if query_lower in kpi_name.lower() or query_lower in kpi_desc.lower():
                feature_scores[faj_key] = max(feature_scores.get(faj_key, 0), 50)
                break

    # Sort by score and return
    sorted_keys = sorted(feature_scores.keys(), key=lambda k: (-feature_scores[k], features[k]['name']))
    results = [(faj_key, features[faj_key]) for faj_key in sorted_keys[:limit]]

    return results


def search_by_domain(features: dict, domain: str, lightweight_indexes: dict, limit: int = 20) -> list[tuple[str, dict]]:
    """Search features by functional domain/category."""
    categories = lightweight_indexes.get('categories', {})
    domain_lower = domain.lower()

    # Find matching categories (partial match)
    matching_fajs = []
    for cat_name, faj_list in categories.items():
        if domain_lower in cat_name.lower():
            matching_fajs.extend(faj_list)

    # Remove duplicates and get features
    seen = set()
    results = []
    for faj in matching_fajs:
        if faj not in seen and faj in features:
            seen.add(faj)
            results.append((faj, features[faj]))

    results.sort(key=lambda x: x[1]['name'])
    return results[:limit]


def list_domains(lightweight_indexes: dict) -> list[tuple[str, int]]:
    """List all available domains/categories with feature counts."""
    categories = lightweight_indexes.get('categories', {})
    return sorted([(cat, len(fajs)) for cat, fajs in categories.items()], key=lambda x: x[0])


def search_by_package(features: dict, query: str, limit: int = 20) -> list[tuple[str, dict]]:
    """Search features by value package name or FAJ code."""
    query_lower = query.lower()
    results = []

    for faj_key, feature in features.items():
        vp = feature.get('value_package')
        if not vp:
            continue

        # Match by package name or FAJ (handle None values)
        vp_name = (vp.get('name') or '').lower()
        vp_faj = (vp.get('faj') or '').lower()

        if query_lower in vp_name or query_lower in vp_faj:
            # Score by match quality
            score = 0
            if query_lower == vp_name:
                score = 100  # Exact name match
            elif query_lower in vp_name:
                score = 80  # Partial name match
            elif query_lower in vp_faj:
                score = 60  # FAJ match
            results.append((score, faj_key, feature))

    results.sort(reverse=True, key=lambda x: (x[0], x[2]['name']))
    return [(r[1], r[2]) for r in results[:limit]]


def list_packages(features: dict) -> list[tuple[str, str, int]]:
    """List all unique value packages with counts."""
    packages = {}
    for feature in features.values():
        vp = feature.get('value_package')
        if vp and vp.get('name'):
            key = (vp['name'], vp.get('faj', ''))
            packages[key] = packages.get(key, 0) + 1

    return sorted([(name, faj, count) for (name, faj), count in packages.items()], key=lambda x: x[0])


def search_by_guideline(features: dict, query: str, limit: int = 20) -> list[tuple[str, dict]]:
    """Search features by engineering guidelines content."""
    query_lower = query.lower()
    results = []

    for faj_key, feature in features.items():
        eg = feature.get('engineering_guidelines', {})
        if not eg or not eg.get('has_guidelines'):
            continue

        score = 0
        # Check summary (handle None)
        summary = eg.get('summary') or ''
        if query_lower in summary.lower():
            score += 50

        # Check subsections
        subsections = eg.get('subsections') or []
        for subsection in subsections:
            if subsection and query_lower in str(subsection).lower():
                score += 30
                break

        if score > 0:
            results.append((score, faj_key, feature))

    results.sort(reverse=True, key=lambda x: (x[0], x[2]['name']))
    return [(r[1], r[2]) for r in results[:limit]]


# ============================================================================
# DOCUMENT SEARCH FUNCTIONS
# ============================================================================

def load_documents(script_dir: Path) -> dict:
    """Load documents.json index."""
    doc_file = script_dir.parent / 'references' / 'documents.json'
    if doc_file.exists():
        with open(doc_file) as f:
            return json.load(f)
    return {}


def load_document_types(script_dir: Path) -> dict:
    """Load index_document_types.json."""
    types_file = script_dir.parent / 'references' / 'index_document_types.json'
    if types_file.exists():
        with open(types_file) as f:
            return json.load(f)
    return {}


def search_by_doc_type(documents: dict, doc_types: dict, doc_type: str, limit: int = 10) -> list[tuple[str, dict]]:
    """Search documents by type (safety, hardware, troubleshooting, configuration, installation, upgrade, general)."""
    type_lower = doc_type.lower().strip()
    results = []

    # Check if type exists in index
    if type_lower in doc_types:
        doc_ids = doc_types[type_lower]
        for doc_id in doc_ids[:limit]:
            if doc_id in documents:
                results.append((doc_id, documents[doc_id]))
    else:
        # Partial match on type
        for type_name, doc_ids in doc_types.items():
            if type_lower in type_name.lower():
                for doc_id in doc_ids:
                    if doc_id in documents and len(results) < limit:
                        results.append((doc_id, documents[doc_id]))

    return results


def search_by_doc_title(documents: dict, query: str, limit: int = 10) -> list[tuple[str, dict]]:
    """Fuzzy search documents by title."""
    query_lower = query.lower()
    results = []

    for doc_id, doc in documents.items():
        title = doc.get('title', '').lower()
        if query_lower in title:
            # Score by match quality
            pos = title.find(query_lower)
            score = (100 - pos) + (len(query) / max(len(title), 1) * 50)
            results.append((score, doc_id, doc))

    results.sort(reverse=True, key=lambda x: x[0])
    return [(r[1], r[2]) for r in results[:limit]]


def list_document_types(doc_types: dict) -> list[tuple[str, int]]:
    """List all available document types with counts."""
    return sorted([(dtype, len(doc_ids)) for dtype, doc_ids in doc_types.items()], key=lambda x: (-x[1], x[0]))


def format_document_brief(doc: dict) -> str:
    """Format document for brief output."""
    lines = []
    lines.append(f"  Title: {doc.get('title', 'Unknown')}")
    lines.append(f"  Type:  {doc.get('type', 'Unknown')}")
    lines.append(f"  ID:    {doc.get('id', 'Unknown')}")
    if doc.get('file'):
        lines.append(f"  File:  {doc['file']}")
    return '\n'.join(lines)


def format_document_verbose(doc: dict) -> str:
    """Format document for verbose output."""
    lines = []
    lines.append(f"Title: {doc.get('title', 'Unknown')}")
    lines.append(f"Type:  {doc.get('type', 'Unknown')}")
    lines.append(f"ID:    {doc.get('id', 'Unknown')}")
    if doc.get('file'):
        lines.append(f"File:  {doc['file']}")

    if doc.get('sections'):
        # Filter out image extensions from sections
        sections = [s for s in doc['sections'] if not s.startswith('.')]
        if sections:
            lines.append(f"\nSections ({len(sections)}):")
            for section in sections[:10]:
                lines.append(f"  - {section}")
            if len(sections) > 10:
                lines.append(f"  ... (+{len(sections) - 10} more)")

    if doc.get('metadata'):
        meta = doc['metadata']
        lines.append(f"\nMetadata:")
        if 'complexity_score' in meta:
            lines.append(f"  Complexity: {meta['complexity_score']}")
        if 'quality_score' in meta:
            lines.append(f"  Quality:    {meta['quality_score']}")
        if 'tables_extracted' in meta:
            lines.append(f"  Tables:     {meta['tables_extracted']}")

    return '\n'.join(lines)


# ============================================================================
# CROSS-REFERENCE QUERIES (NEW)
# ============================================================================

def normalize_faj_key(faj: str) -> str:
    """Normalize FAJ code to index key format: FAJ_121_4219."""
    faj = faj.strip().upper()
    if faj.startswith('FAJ'):
        faj = faj[3:].strip()
    # Remove any remaining FAJ prefix and normalize
    faj = faj.replace('_', ' ').strip()
    parts = faj.split()
    if len(parts) >= 2:
        return f"FAJ_{parts[0]}_{parts[1]}"
    return f"FAJ_{faj.replace(' ', '_')}"


def search_depends_on(features: dict, faj: str, limit: int = 10) -> list[tuple[str, dict]]:
    """Find all features that depend on (have as prerequisite) the given FAJ."""
    target_faj = normalize_faj_key(faj)
    results = []

    for faj_key, feature in features.items():
        for dep in feature.get('deps', []):
            dep_faj = normalize_faj_key(dep.get('faj', ''))
            if dep_faj == target_faj and dep.get('type') == 'Prerequisite':
                results.append((faj_key, feature))
                break

    results.sort(key=lambda x: x[1]['name'])
    return results[:limit]


def search_required_by(features: dict, faj: str, limit: int = 10) -> list[tuple[str, dict]]:
    """Find all prerequisites (features required by) the given FAJ."""
    target_faj = normalize_faj_key(faj)
    feature = features.get(target_faj)
    if not feature:
        return []

    results = []
    for dep in feature.get('deps', []):
        if dep.get('type') == 'Prerequisite':
            dep_faj = normalize_faj_key(dep.get('faj', ''))
            if dep_faj in features:
                results.append((dep_faj, features[dep_faj]))

    results.sort(key=lambda x: x[1]['name'])
    return results[:limit]


def search_conflicts_with(features: dict, faj: str, limit: int = 10) -> list[tuple[str, dict]]:
    """Find all features that conflict with the given FAJ (bidirectional)."""
    target_faj = normalize_faj_key(faj)
    conflicts = set()

    # Check features that have this FAJ as conflicting
    for faj_key, feature in features.items():
        for dep in feature.get('deps', []):
            if dep.get('type') == 'Conflicting':
                dep_faj = normalize_faj_key(dep.get('faj', ''))
                if dep_faj == target_faj:
                    conflicts.add(faj_key)
                elif faj_key == target_faj:
                    conflicts.add(dep_faj)

    results = [(faj_key, features[faj_key]) for faj_key in conflicts if faj_key in features]
    results.sort(key=lambda x: x[1]['name'])
    return results[:limit]


# ============================================================================
# DEPLOYMENT SCRIPT GENERATION (NEW)
# ============================================================================

def generate_activation_script(feature: dict, site_name: str = '<SITE>') -> str:
    """Generate complete activation script with prerequisites."""
    lines = []
    lines.append("#!/bin/bash")
    lines.append(f"# Activation script for: {feature['name']}")
    lines.append(f"# FAJ: {feature['faj']}")
    lines.append(f"# CXC: {feature.get('cxc', 'N/A')}")
    lines.append("")

    # Prerequisites check
    prereqs = [d for d in feature.get('deps', []) if d.get('type') == 'Prerequisite']
    if prereqs:
        lines.append("# Prerequisites - verify these are active first:")
        for p in prereqs:
            lines.append(f"# - {p.get('name', 'Unknown')} ({p.get('faj', 'N/A')})")
        lines.append("")

    # Activation steps from documentation
    activation = feature.get('activation', {})
    if activation.get('prerequisites'):
        lines.append("# Prerequisites from documentation:")
        for prereq in activation['prerequisites'][:5]:
            lines.append(f"# - {prereq}")
        lines.append("")

    if activation.get('steps'):
        lines.append("# Activation steps from documentation:")
        for i, step in enumerate(activation['steps'][:5], 1):
            lines.append(f"# Step {i}: {step}")
        lines.append("")

    # cmedit activation command
    lines.append("# cmedit activation command:")
    if feature.get('cxc'):
        lines.append(f"cmedit set {site_name} FeatureState=={feature['cxc']} featureState=ACTIVATED")
    else:
        lines.append(f"# No CXC code available - check ENM for FeatureState MO")

    # Key parameters to verify/configure
    if feature.get('params'):
        lines.append("")
        lines.append("# Key parameters to configure:")
        mo_groups = {}
        for param in feature['params'][:10]:
            if '.' in param:
                mo, attr = param.split('.', 1)
                mo_groups.setdefault(mo, []).append(attr)
        for mo, attrs in list(mo_groups.items())[:5]:
            if len(attrs) == 1:
                lines.append(f"# cmedit get {site_name} {mo}.{attrs[0]}")
            else:
                lines.append(f"# cmedit get {site_name} {mo}.({','.join(attrs[:5])})")

    return '\n'.join(lines)


def generate_verification_script(feature: dict, site_name: str = '<SITE>') -> str:
    """Generate post-activation verification commands."""
    lines = []
    lines.append(f"# Verification script for: {feature['name']}")
    lines.append(f"# FAJ: {feature['faj']}")
    lines.append("")

    # Check feature state
    lines.append("# 1. Verify feature state:")
    if feature.get('cxc'):
        lines.append(f"cmedit get {site_name} FeatureState=={feature['cxc']} featureState,licenseState,serviceState")
    else:
        lines.append("# No CXC code - check feature state manually")
    lines.append("")

    # Check key parameters
    if feature.get('params'):
        lines.append("# 2. Verify key parameters:")
        mo_groups = {}
        for param in feature['params'][:15]:
            if '.' in param:
                mo, attr = param.split('.', 1)
                mo_groups.setdefault(mo, []).append(attr)
        for mo, attrs in list(mo_groups.items())[:7]:
            if len(attrs) == 1:
                lines.append(f"cmedit get {site_name} {mo}.{attrs[0]}")
            else:
                lines.append(f"cmedit get {site_name} {mo}.({','.join(attrs[:5])})")
        lines.append("")

    # Suggested counters to monitor
    if feature.get('counters'):
        lines.append("# 3. Counters to monitor (check after activation):")
        for counter in feature['counters'][:5]:
            if '.' in counter:
                mo, pm = counter.split('.', 1)
                lines.append(f"# - {mo}.{pm}")
            else:
                lines.append(f"# - {counter}")
        lines.append("")

    # KPIs to track
    if feature.get('kpis'):
        lines.append("# 4. KPIs to track:")
        for kpi in feature['kpis'][:5]:
            kpi_name = kpi.get('name', str(kpi))
            lines.append(f"# - {kpi_name}")

    return '\n'.join(lines)


# ============================================================================
# UTILITIES
# ============================================================================

def truncate_smart(text: str, max_len: int = 50, suffix: str = '..') -> str:
    """Truncate text at word boundary with ellipsis.

    Args:
        text: Text to truncate
        max_len: Maximum length including suffix
        suffix: Suffix to append when truncated

    Returns:
        Truncated text at word boundary, or original if fits
    """
    if not text or len(text) <= max_len:
        return text

    # Reserve space for suffix
    target_len = max_len - len(suffix)

    # Try to break at word boundary
    truncated = text[:target_len]

    # Find last space
    last_space = truncated.rfind(' ')

    # If no space found or truncation would be too short, just cut
    if last_space == -1 or last_space < target_len // 2:
        return truncated.rstrip() + suffix

    return truncated[:last_space].rstrip() + suffix


# ============================================================================
# OUTPUT FORMATTERS
# ============================================================================

def format_feature_brief(faj_key: str, feature: dict) -> str:
    """Format feature as structured brief (3-6 lines with key facts)."""
    lines = []

    # Line 1: Name with acronym
    name_line = feature['name']
    if feature.get('acronym'):
        name_line += f" [{feature['acronym']}]"
    lines.append(name_line)

    # Line 2: Identifiers and metadata
    meta_parts = [feature['faj']]
    if feature.get('cxc'):
        meta_parts.append(feature['cxc'])
    if feature.get('access'):
        meta_parts.append('/'.join(feature['access']))
    if feature.get('license'):
        meta_parts.append("License: Yes")
    else:
        meta_parts.append("License: No")
    lines.append(' | '.join(meta_parts))

    # Line 3: Stats - params, counters, prereqs
    stats_parts = []
    param_count = len(feature.get('params', []))
    counter_count = len(feature.get('counters', []))
    stats_parts.append(f"Params: {param_count}")
    stats_parts.append(f"Counters: {counter_count}")

    # Add prerequisites summary with smart truncation
    prereqs = [d['name'] for d in feature.get('deps', []) if d.get('type') == 'Prerequisite']
    if prereqs:
        prereq_str = ', '.join(truncate_smart(p, 18) for p in prereqs[:2])
        if len(prereqs) > 2:
            prereq_str += f" (+{len(prereqs) - 2})"
        stats_parts.append(f"Prereqs: {prereq_str}")
    else:
        stats_parts.append("Prereqs: None")
    lines.append(' | '.join(stats_parts))

    # Line 4: Activation command (if CXC available)
    if feature.get('cxc'):
        lines.append(f"Activate: cmedit set <SITE> FeatureState={feature['cxc']} featureState=ACTIVATED")

    # Line 5: Conflicts (if any)
    conflicts = [d['name'] for d in feature.get('deps', []) if d.get('type') == 'Conflicting']
    if conflicts:
        conflict_str = truncate_smart(', '.join(conflicts), 50)
        lines.append(f"Conflicts: {conflict_str}")

    # Line 6: Engineering Guidelines availability
    eg = feature.get('engineering_guidelines', {})
    if eg.get('has_guidelines'):
        eg_sections = eg.get('subsections', [])
        if eg_sections:
            sections_str = ', '.join(eg_sections[:3])
            if len(eg_sections) > 3:
                sections_str += f" (+{len(eg_sections)-3})"
            lines.append(f"Eng Guidelines: {sections_str}")
        else:
            lines.append("Eng Guidelines: Available")

    return '\n'.join(lines)


def format_comparison_table(features_list: list[tuple[str, dict]]) -> str:
    """Generate side-by-side comparison markdown table."""
    if len(features_list) < 2:
        return "Need at least 2 features to compare. Use --compare with multiple results."

    # Build header with acronyms or short names
    headers = ["Aspect"]
    for faj_key, f in features_list:
        label = f.get('acronym') or f['name'][:12]
        headers.append(label)

    # Build rows
    rows = []

    # FAJ codes
    rows.append(["FAJ"] + [f['faj'] for _, f in features_list])

    # CXC codes
    rows.append(["CXC"] + [f.get('cxc') or '-' for _, f in features_list])

    # Access type
    rows.append(["Access"] + ['/'.join(f.get('access', [])) or '-' for _, f in features_list])

    # License
    rows.append(["License"] + ['Yes' if f.get('license') else 'No' for _, f in features_list])

    # Parameters count
    rows.append(["Params"] + [str(len(f.get('params', []))) for _, f in features_list])

    # Counters count
    rows.append(["Counters"] + [str(len(f.get('counters', []))) for _, f in features_list])

    # Prerequisites
    def get_prereqs(f):
        prereqs = [d['name'][:10] for d in f.get('deps', []) if d.get('type') == 'Prerequisite']
        return ', '.join(prereqs[:2]) if prereqs else '-'
    rows.append(["Prerequisites"] + [get_prereqs(f) for _, f in features_list])

    # Conflicts
    def get_conflicts(f):
        conflicts = [d['name'][:10] for d in f.get('deps', []) if d.get('type') == 'Conflicting']
        return ', '.join(conflicts[:2]) if conflicts else '-'
    rows.append(["Conflicts"] + [get_conflicts(f) for _, f in features_list])

    # Latest release
    rows.append(["Latest Release"] + [f.get('latest_release', '-') for _, f in features_list])

    # Format as markdown table
    lines = ["## Feature Comparison", ""]

    # Calculate column widths for alignment
    col_widths = [max(len(str(row[i])) for row in [headers] + rows) for i in range(len(headers))]

    # Header row
    header_line = "| " + " | ".join(h.ljust(w) for h, w in zip(headers, col_widths)) + " |"
    lines.append(header_line)

    # Separator row
    sep_line = "|" + "|".join("-" * (w + 2) for w in col_widths) + "|"
    lines.append(sep_line)

    # Data rows
    for row in rows:
        row_line = "| " + " | ".join(str(cell).ljust(w) for cell, w in zip(row, col_widths)) + " |"
        lines.append(row_line)

    return '\n'.join(lines)


def format_feature(faj_key: str, feature: dict, verbose: bool = False) -> str:
    """Format a feature for display."""
    # Build name line with acronym if available
    name_line = f"  {feature['name']}"
    if feature.get('acronym'):
        name_line += f" [{feature['acronym']}]"

    lines = [
        name_line,
        f"    FAJ: {feature['faj']}",
    ]

    if feature.get('cxc'):
        lines.append(f"    CXC: {feature['cxc']}")

    if feature.get('access'):
        lines.append(f"    Access: {'/'.join(feature['access'])}")

    # Show summary (truncated for non-verbose)
    if feature.get('summary'):
        summary = feature['summary']
        if not verbose and len(summary) > 150:
            summary = summary[:147] + '...'
        lines.append(f"    Summary: {summary}")

    lines.append(f"    File: {feature['file']}")

    if verbose:
        if feature.get('license'):
            lines.append(f"    License: Required")

        if feature.get('value_package'):
            vp = feature['value_package']
            lines.append(f"    Value Package: {vp['name']} ({vp['faj']})")

        if feature.get('params'):
            lines.append(f"    Parameters ({len(feature['params'])}):")
            for p in feature['params'][:5]:
                lines.append(f"      - {p}")
            if len(feature['params']) > 5:
                lines.append(f"      ... and {len(feature['params']) - 5} more")

        if feature.get('deps'):
            lines.append(f"    Dependencies ({len(feature['deps'])}):")
            for d in feature['deps'][:3]:
                lines.append(f"      - [{d['type']}] {d['name']} ({d['faj']})")
            if len(feature['deps']) > 3:
                lines.append(f"      ... and {len(feature['deps']) - 3} more")

    return '\n'.join(lines)


def format_feature_markdown(faj_key: str, feature: dict, full: bool = True) -> str:
    """Format feature as comprehensive markdown technical brief."""
    lines = []

    # Header with acronym
    header = f"## {feature['name']}"
    if feature.get('acronym'):
        header += f" [{feature['acronym']}]"
    lines.append(header)
    lines.append("")

    # Metadata line: FAJ | CXC | Access | License
    meta = f"**FAJ:** {feature['faj']}"
    if feature.get('cxc'):
        meta += f" | **CXC:** {feature['cxc']}"
    if feature.get('access'):
        meta += f" | **Access:** {'/'.join(feature['access'])}"
    if feature.get('license'):
        meta += " | **License:** Required"
    lines.append(meta)
    lines.append("")

    # Summary
    if feature.get('summary'):
        summary = feature['summary']
        if len(summary) > 400:
            summary = summary[:397] + '...'
        lines.append(summary)
        lines.append("")

    # Dependencies section
    lines.append("### Dependencies")
    deps = feature.get('deps', [])
    prereqs = [d for d in deps if d.get('type') == 'Prerequisite']
    related = [d for d in deps if d.get('type') == 'Related']
    conflicts = [d for d in deps if d.get('type') == 'Conflicting']

    if prereqs:
        prereq_str = ', '.join(f"{d['name']} ({d['faj']})" for d in prereqs)
        lines.append(f"- **Prerequisites:** {prereq_str}")
    if related:
        related_names = [d['name'] for d in related[:5]]
        related_str = ', '.join(related_names)
        if len(related) > 5:
            related_str += f" (+{len(related) - 5} more)"
        lines.append(f"- **Related:** {related_str}")
    if conflicts:
        conflict_str = ', '.join(d['name'] for d in conflicts)
        lines.append(f"- **Conflicts:** {conflict_str}")
    if not deps:
        lines.append("None")
    lines.append("")

    # Network Impact section (NEW)
    if full and feature.get('network_impact'):
        ni = feature['network_impact']
        has_impact = any([ni.get('capacity_performance'), ni.get('other_network_elements'), ni.get('interfaces')])
        if has_impact:
            lines.append("### Network Impact")
            if ni.get('capacity_performance'):
                text = ni['capacity_performance']
                if len(text) > 200:
                    text = text[:197] + '...'
                lines.append(f"**Capacity/Performance:** {text}")
            if ni.get('other_network_elements'):
                text = ni['other_network_elements']
                if len(text) > 200:
                    text = text[:197] + '...'
                lines.append(f"**Other Network Elements:** {text}")
            if ni.get('interfaces'):
                text = ni['interfaces']
                if len(text) > 200:
                    text = text[:197] + '...'
                lines.append(f"**Interfaces:** {text}")
            lines.append("")

    # Activation section (ENHANCED)
    if full and feature.get('activation'):
        act = feature['activation']
        lines.append("### Activation")
        if act.get('prerequisites'):
            lines.append("**Prerequisites:**")
            for prereq in act['prerequisites'][:3]:
                lines.append(f"- {prereq}")
        if act.get('steps'):
            lines.append("**Steps:**")
            for i, step in enumerate(act['steps'][:5], 1):
                lines.append(f"{i}. {step}")
        if act.get('after_task'):
            lines.append(f"**After:** {act['after_task']}")
        lines.append("")
    elif feature.get('cxc'):
        lines.append("### Activation")
        lines.append(f"Set `FeatureState.featureState` to `ACTIVATED` in `FeatureState={feature['cxc']}` MO")
        lines.append("")

    # Deactivation section (NEW)
    if full and feature.get('deactivation') and feature['deactivation'].get('steps'):
        deact = feature['deactivation']
        lines.append("### Deactivation")
        for i, step in enumerate(deact['steps'][:3], 1):
            lines.append(f"{i}. {step}")
        lines.append("")

    # Parameters table
    lines.append("### Parameters")
    lines.append("")
    param_details = feature.get('param_details', [])
    if param_details:
        lines.append("| Parameter | Type | Description |")
        lines.append("|-----------|------|-------------|")
        for p in param_details[:15]:  # Limit to 15 params
            name = p.get('name', '-')
            ptype = p.get('type', '-')
            desc = p.get('description', '-')
            if desc and len(desc) > 60:
                desc = desc[:57] + '...'
            lines.append(f"| {name} | {ptype} | {desc} |")
        if len(param_details) > 15:
            lines.append(f"| ... | | (+{len(param_details) - 15} more) |")
    else:
        lines.append("No parameters defined")
    lines.append("")

    # Counters table
    counter_details = feature.get('counter_details', [])
    if counter_details:
        lines.append("### Counters")
        lines.append("")
        lines.append("| Counter | MO Class |")
        lines.append("|---------|----------|")
        for c in counter_details[:10]:
            lines.append(f"| {c['name']} | {c['mo_class']} |")
        if len(counter_details) > 10:
            lines.append(f"| ... | (+{len(counter_details) - 10} more) |")
        lines.append("")

    # KPIs section (NEW)
    kpis = feature.get('kpis', [])
    if kpis:
        lines.append("### KPIs")
        lines.append("")
        lines.append("| KPI | Description |")
        lines.append("|-----|-------------|")
        for kpi in kpis[:5]:
            name = kpi['name'][:50] if len(kpi['name']) > 50 else kpi['name']
            desc = kpi['description'][:80] if kpi['description'] else '-'
            lines.append(f"| {name} | {desc} |")
        lines.append("")

    # Engineering Guidelines section (NEW)
    if full and feature.get('engineering_guidelines', {}).get('has_guidelines'):
        eg = feature['engineering_guidelines']
        lines.append("### Engineering Guidelines")
        if eg.get('summary'):
            lines.append(eg['summary'])
        if eg.get('subsections'):
            lines.append("**Sections:** " + ', '.join(eg['subsections'][:5]))
        lines.append("")

    # Change History section (NEW)
    if full and feature.get('change_history'):
        lines.append("### Change History")
        lines.append("")
        lines.append("| Release | Change |")
        lines.append("|---------|--------|")
        for ch in feature['change_history'][:5]:
            title = ch['title'][:60] if len(ch['title']) > 60 else ch['title']
            lines.append(f"| {ch['release']} | {title} |")
        if len(feature['change_history']) > 5:
            lines.append(f"| ... | (+{len(feature['change_history']) - 5} more) |")
        lines.append("")

    # Source file reference
    lines.append(f"**Source:** `{feature['file']}`")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Search Ericsson RAN features',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Search modes
  search.py --acronym IFLB             # Search by acronym (Inter-Frequency Load Balancing)
  search.py --name "load balancing"    # Match feature names
  search.py --name "lod blancng" -z    # Fuzzy match with typo tolerance
  search.py --faj "121 4219"           # Exact FAJ lookup
  search.py --cxc "CXC4012349"         # Lookup by activation code
  search.py --param "lbTp"             # Features using parameter
  search.py --access LTE               # Filter by access type
  search.py --keyword "handover"       # Full-text search
  search.py --keyword "MIMO AND sleep" # Boolean search (AND/OR/NOT)
  search.py --counter "pmLb"           # Features with counters matching pattern
  search.py --mo "EUtranCellFDD"       # Features using MO class
  search.py --release "24.Q4"          # Features changed in release
  search.py --list-releases            # List all available releases

  # Output options
  search.py --acronym IFLB --brief     # Structured 3-5 line output (fast lookup)
  search.py --acronym IFLB --verbose   # Show full details
  search.py --acronym IFLB --markdown  # Full markdown with cmedit commands
  search.py --acronym IFLB --cmedit    # Generate cmedit CLI commands only
  search.py --acronym IFLB --json      # JSON output
  search.py --access LTE --compare     # Side-by-side comparison table
        '''
    )

    # Existing search modes
    parser.add_argument('--acronym', '-A', help='Search by feature acronym (e.g., IFLB, DUAC, MCPC)')
    parser.add_argument('--name', '-n', help='Fuzzy search by feature name')
    parser.add_argument('--faj', '-f', help='Exact search by FAJ code')
    parser.add_argument('--cxc', '-c', help='Search by CXC activation code')
    parser.add_argument('--param', '-p', help='Search by parameter name')
    parser.add_argument('--access', '-a', help='Filter by access type (LTE, NR, WCDMA, GSM)')
    parser.add_argument('--keyword', '-k', help='Full-text keyword search')

    # NEW search modes
    parser.add_argument('--counter', '-C', help='Search by counter/KPI name')
    parser.add_argument('--mo', '-M', help='Search by MO class name')
    parser.add_argument('--release', '-R', help='Search by release version (e.g., 24.Q4)')
    parser.add_argument('--list-releases', action='store_true', help='List all available releases')

    # Additional search modes
    parser.add_argument('--event', '-E', help='Search by event name (e.g., INTERNAL_EVENT_UE_MOBILITY)')
    parser.add_argument('--kpi', '-K', help='Search by KPI name or description')
    parser.add_argument('--domain', '-D', help='Search by functional domain (e.g., "Energy Saving", "Carrier Aggregation")')
    parser.add_argument('--list-domains', action='store_true', help='List all available domains/categories')
    parser.add_argument('--package', '-P', help='Search by value package name or FAJ (e.g., "LTE Base Package", "FAJ 801")')
    parser.add_argument('--list-packages', action='store_true', help='List all available value packages')
    parser.add_argument('--guideline', '-G', help='Search within engineering guidelines content')

    # Document search modes
    parser.add_argument('--doc-type', help='Search by document type (safety, hardware, troubleshooting, configuration, installation, upgrade, general)')
    parser.add_argument('--doc-title', help='Search by document title')
    parser.add_argument('--list-doc-types', action='store_true', help='List all available document types')

    # Cross-reference queries (NEW)
    parser.add_argument('--depends-on', metavar='FAJ', help='Find features that depend on this FAJ')
    parser.add_argument('--required-by', metavar='FAJ', help='Find prerequisites for this FAJ')
    parser.add_argument('--conflicts-with', metavar='FAJ', help='Find conflicting features for this FAJ')

    # Deployment script generation (NEW)
    parser.add_argument('--activation-script', action='store_true', help='Generate full activation script with prerequisites')
    parser.add_argument('--verification-script', action='store_true', help='Generate post-activation verification commands')

    # Search modifiers
    parser.add_argument('--fuzzy', '-z', action='store_true',
                       help='Enable fuzzy matching for --name and --acronym (typo tolerant)')

    # Output options
    parser.add_argument('--limit', '-l', type=int, default=10, help='Max results (default: 10)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Show detailed output')
    parser.add_argument('--json', '-j', action='store_true', help='Output as JSON')
    parser.add_argument('--markdown', '-m', action='store_true', help='Output as full markdown technical brief (includes cmedit commands)')
    parser.add_argument('--brief', '-b', action='store_true', help='Structured brief output (3-5 lines with key facts)')
    parser.add_argument('--compare', action='store_true', help='Side-by-side comparison table (use with multi-result searches)')
    parser.add_argument('--cmedit', action='store_true', help='Generate cmedit CLI commands for the feature(s)')
    parser.add_argument('--export', choices=['csv', 'json'], help='Export results to CSV or JSON format')

    args = parser.parse_args()

    # Input validation - reject empty string queries
    def validate_query(value, flag_name):
        if value is not None and value.strip() == '':
            print(f"Error: {flag_name} cannot be empty. Use --help for available options.", file=sys.stderr)
            sys.exit(1)

    validate_query(args.name, '--name')
    validate_query(args.acronym, '--acronym')
    validate_query(args.faj, '--faj')
    validate_query(args.cxc, '--cxc')
    validate_query(args.param, '--param')
    validate_query(args.access, '--access')
    validate_query(args.keyword, '--keyword')
    validate_query(args.counter, '--counter')
    validate_query(args.mo, '--mo')
    validate_query(args.release, '--release')
    validate_query(args.event, '--event')
    validate_query(args.kpi, '--kpi')
    validate_query(args.domain, '--domain')
    validate_query(args.package, '--package')
    validate_query(args.guideline, '--guideline')
    validate_query(getattr(args, 'doc_type', None), '--doc-type')
    validate_query(getattr(args, 'doc_title', None), '--doc-title')
    validate_query(getattr(args, 'depends_on', None), '--depends-on')
    validate_query(getattr(args, 'required_by', None), '--required-by')
    validate_query(getattr(args, 'conflicts_with', None), '--conflicts-with')

    # Load indexes (with caching for repeated calls)
    script_dir = Path(__file__).parent
    features, params, counters, mo_classes, releases = get_cached_indexes(script_dir)

    # Load lightweight indexes for fast O(1) lookups
    lightweight_indexes = get_lightweight_indexes(script_dir)

    # Handle list-releases
    if args.list_releases:
        print("Available releases:\n")
        release_list = list_releases(releases)
        for release, count in release_list:
            print(f"  {release:12} ({count} features)")
        print(f"\nTotal: {len(release_list)} releases")
        return

    # Handle list-domains
    if args.list_domains:
        print("Available domains/categories:\n")
        domain_list = list_domains(lightweight_indexes)
        for domain, count in domain_list:
            print(f"  {domain:35} ({count} features)")
        print(f"\nTotal: {len(domain_list)} categories")
        return

    # Handle list-packages
    if args.list_packages:
        print("Available value packages:\n")
        package_list = list_packages(features)
        for name, faj, count in package_list:
            print(f"  {name:45} {faj:15} ({count} features)")
        print(f"\nTotal: {len(package_list)} unique packages")
        return

    # Handle list-doc-types
    if args.list_doc_types:
        doc_types = load_document_types(script_dir)
        if not doc_types:
            print("No document types index found. Run build_index.py first.", file=sys.stderr)
            sys.exit(1)
        print("Available document types:\n")
        type_list = list_document_types(doc_types)
        for dtype, count in type_list:
            print(f"  {dtype:20} ({count} documents)")
        print(f"\nTotal: {sum(c for _, c in type_list)} documents in {len(type_list)} categories")
        return

    # Handle document search modes (separate from feature search)
    if args.doc_type or args.doc_title:
        documents = load_documents(script_dir)
        doc_types = load_document_types(script_dir)

        if not documents:
            print("No documents index found. Run build_index.py first.", file=sys.stderr)
            sys.exit(1)

        doc_results = []
        if args.doc_type:
            doc_results = search_by_doc_type(documents, doc_types, args.doc_type, args.limit)
            if not doc_results:
                available = list(doc_types.keys())
                print(f"No documents found for type: {args.doc_type}")
                print(f"Available types: {', '.join(sorted(available))}")
                sys.exit(1)

        elif args.doc_title:
            doc_results = search_by_doc_title(documents, args.doc_title, args.limit)
            if not doc_results:
                print(f"No documents found with title matching: {args.doc_title}")
                sys.exit(1)

        # Output document results
        print(f"Found {len(doc_results)} document(s):\n")
        for doc_id, doc in doc_results:
            if args.verbose:
                print(format_document_verbose(doc))
                print("-" * 60)
            elif args.json:
                print(json.dumps({doc_id: doc}, indent=2))
            else:
                print(format_document_brief(doc))
                print()
        return

    results = []

    # Execute search based on arguments
    if args.faj:
        result = search_by_faj(features, args.faj)
        if result:
            results = [result]
        else:
            print(f"No feature found with FAJ code: {args.faj}")
            sys.exit(1)

    elif args.cxc:
        results = search_by_cxc(features, args.cxc, lightweight_indexes)
        if not results:
            print(f"No feature found with CXC code: {args.cxc}")
            sys.exit(1)

    elif args.acronym:
        if args.fuzzy:
            results = search_by_acronym_fuzzy(features, args.acronym)
        else:
            results = search_by_acronym(features, args.acronym, lightweight_indexes)
        if not results:
            print(f"No feature found with acronym: {args.acronym}")
            sys.exit(1)
        results = results[:args.limit]

    elif args.name:
        if args.fuzzy:
            results = search_by_name_fuzzy(features, args.name, args.limit)
        else:
            results = search_by_name(features, args.name, args.limit)

    elif args.param:
        results = search_by_param(features, params, args.param, args.limit)

    elif args.access:
        results = search_by_access(features, args.access)
        if not results:
            # Show available access types
            available = set()
            for f in features.values():
                available.update(f.get('access', []))
            print(f"No features found for access type: {args.access}")
            print(f"Available types: {', '.join(sorted(available))}")
            sys.exit(1)
        results = results[:args.limit]

    elif args.keyword:
        # Auto-detect boolean operators
        if any(op in args.keyword.upper() for op in [' AND ', ' OR ', ' NOT ']):
            results = search_by_keyword_boolean(features, args.keyword, args.limit)
        else:
            results = search_by_keyword(features, args.keyword, args.limit)

    # NEW search modes
    elif args.counter:
        results = search_by_counter(features, counters, args.counter, args.limit)
        if not results:
            print(f"No features found with counter matching: {args.counter}")
            sys.exit(1)

    elif args.mo:
        results = search_by_mo_class(features, mo_classes, args.mo, args.limit)
        if not results:
            print(f"No features found with MO class matching: {args.mo}")
            sys.exit(1)

    elif args.release:
        results = search_by_release(features, releases, args.release, args.limit)
        if not results:
            print(f"No features found for release: {args.release}")
            sys.exit(1)

    # Additional search modes
    elif args.event:
        results = search_by_event(features, args.event, args.limit)
        if not results:
            print(f"No features found with event matching: {args.event}")
            print("Tip: Try partial matches like 'INTERNAL_EVENT' or 'MIMO'")
            sys.exit(1)

    elif args.kpi:
        results = search_by_kpi(features, args.kpi, args.limit, script_dir)
        if not results:
            print(f"No features found with KPI matching: {args.kpi}")
            print("Tip: Try broader terms like 'Success' or 'Rate'")
            sys.exit(1)

    elif args.domain:
        results = search_by_domain(features, args.domain, lightweight_indexes, args.limit)
        if not results:
            # Show available domains
            domain_list = list_domains(lightweight_indexes)
            print(f"No features found for domain: {args.domain}")
            print(f"Available domains: {', '.join([d[0] for d in domain_list])}")
            sys.exit(1)

    elif args.package:
        results = search_by_package(features, args.package, args.limit)
        if not results:
            print(f"No features found for package: {args.package}")
            print("Tip: Use --list-packages to see all available value packages")
            sys.exit(1)

    elif args.guideline:
        results = search_by_guideline(features, args.guideline, args.limit)
        if not results:
            print(f"No features found with engineering guidelines matching: {args.guideline}")
            print("Tip: Try broader terms like 'configuration' or 'power'")
            sys.exit(1)

    # Cross-reference queries (NEW)
    elif args.depends_on:
        results = search_depends_on(features, args.depends_on, args.limit)
        if not results:
            print(f"No features found that depend on: {args.depends_on}")
            print("Tip: This FAJ may not be a prerequisite for any other feature")

    elif args.required_by:
        results = search_required_by(features, args.required_by, args.limit)
        if not results:
            print(f"No prerequisites found for: {args.required_by}")
            print("Tip: This feature may not have any prerequisites, or FAJ not found")

    elif args.conflicts_with:
        results = search_conflicts_with(features, args.conflicts_with, args.limit)
        if not results:
            print(f"No conflicting features found for: {args.conflicts_with}")
            print("Tip: This feature may not conflict with any other feature")

    else:
        parser.print_help()
        sys.exit(1)

    # Output results
    if args.export:
        if args.export == 'csv':
            import csv
            import io
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(['FAJ', 'Name', 'Acronym', 'CXC', 'Access', 'License', 'Params', 'Counters', 'Events', 'KPIs'])
            for faj_key, feature in results:
                writer.writerow([
                    feature['faj'],
                    feature['name'],
                    feature.get('acronym', ''),
                    feature.get('cxc', ''),
                    '/'.join(feature.get('access', [])),
                    'Yes' if feature.get('license') else 'No',
                    len(feature.get('params', [])),
                    len(feature.get('counters', [])),
                    len(feature.get('events', [])),
                    len(feature.get('kpis', []))
                ])
            print(output.getvalue().strip())
        else:  # json export
            output = {faj_key: feature for faj_key, feature in results}
            print(json.dumps(output, indent=2, ensure_ascii=False))
    elif args.json:
        output = {faj_key: feature for faj_key, feature in results}
        print(json.dumps(output, indent=2, ensure_ascii=False))
    elif args.compare:
        # Side-by-side comparison table
        print(format_comparison_table(results))
    elif args.brief:
        # Structured brief output (3-5 lines per feature)
        print(f"\nFound {len(results)} result(s):\n")
        for i, (faj_key, feature) in enumerate(results):
            print(format_feature_brief(faj_key, feature))
            if i < len(results) - 1:
                print("\n" + "-" * 40 + "\n")
    elif args.markdown:
        # Markdown output includes cmedit commands by default
        from cmedit_generator import CmeditGenerator, format_commands_markdown
        generator = CmeditGenerator(features)
        for i, (faj_key, feature) in enumerate(results):
            print(format_feature_markdown(faj_key, feature))
            # Auto-include cmedit commands in markdown output
            print("")
            commands = generator.generate_all_commands(feature)
            print(format_commands_markdown(commands))
            if i < len(results) - 1:
                print("\n---\n")
    elif args.cmedit:
        # Standalone cmedit output
        from cmedit_generator import CmeditGenerator, format_commands_text
        generator = CmeditGenerator(features)
        for i, (faj_key, feature) in enumerate(results):
            commands = generator.generate_all_commands(feature)
            print(format_commands_text(commands))
            if i < len(results) - 1:
                print("\n" + "=" * 60 + "\n")
    elif args.activation_script:
        # Generate activation script (NEW)
        for i, (faj_key, feature) in enumerate(results):
            print(generate_activation_script(feature))
            if i < len(results) - 1:
                print("\n" + "=" * 60 + "\n")
    elif args.verification_script:
        # Generate verification script (NEW)
        for i, (faj_key, feature) in enumerate(results):
            print(generate_verification_script(feature))
            if i < len(results) - 1:
                print("\n" + "=" * 60 + "\n")
    else:
        print(f"\nFound {len(results)} result(s):\n")
        for faj_key, feature in results:
            print(format_feature(faj_key, feature, args.verbose))
            print()


if __name__ == '__main__':
    main()
