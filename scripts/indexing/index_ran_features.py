#!/usr/bin/env python3
"""
Ericsson RAN Features - AgentDB Memory Indexer
Indexes 593 RAN features with semantic embeddings for fast autonomous agent access
"""

import json
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Any
import time

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
FEATURES_DIR = PROJECT_ROOT / ".claude/skills/ericsson-ran-features/references"

# Statistics
stats = {
    "features_stored": 0,
    "categories_stored": 0,
    "acronyms_indexed": 0,
    "faj_indexed": 0,
    "cxc_indexed": 0,
    "parameters_indexed": 0,
    "errors": [],
    "start_time": time.time()
}

def run_memory_store(namespace: str, key: str, value: str) -> bool:
    """Store data in AgentDB memory"""
    try:
        cmd = [
            "npx", "@claude-flow/cli@latest", "memory", "store",
            "--namespace", namespace,
            "--key", key,
            "--value", value
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            stats["features_stored"] += 1
            return True
        else:
            stats["errors"].append(f"Failed to store {key}: {result.stderr}")
            return False
    except Exception as e:
        stats["errors"].append(f"Error storing {key}: {str(e)}")
        return False

def load_json_file(filename: str) -> Any:
    """Load JSON file from features directory"""
    path = FEATURES_DIR / filename
    with open(path, 'r') as f:
        return json.load(f)

def index_categories(categories: Dict[str, List[str]]):
    """Index feature categories"""
    print("\n📁 Indexing Categories...")

    for category, features in categories.items():
        category_key = category.lower().replace(" & ", "-").replace(" ", "-")
        category_value = json.dumps({
            "name": category,
            "feature_count": len(features),
            "features": features[:10],  # First 10 as preview
            "all_features": features
        })

        if run_memory_store("ran-categories", category_key, category_value):
            stats["categories_stored"] += 1
            print(f"  ✓ {category}: {len(features)} features")

    print(f"✓ Indexed {stats['categories_stored']} categories")

def index_features_by_category(features: Dict[str, Any], categories: Dict[str, List[str]]):
    """Index features grouped by category for efficient batch processing"""
    print("\n🔖 Indexing Features by Category...")

    # Create reverse mapping: FAJ_ID -> category
    faj_to_category = {}
    for category, faj_list in categories.items():
        for faj_id in faj_list:
            faj_to_category[faj_id] = category

    # Index each feature
    for faj_id, feature_data in features.items():
        category = faj_to_category.get(faj_id, "Other")

        # Create semantic searchable value
        searchable_text = f"{feature_data.get('name', '')} {feature_data.get('acronym', '')} {feature_data.get('summary', '')}"

        feature_value = json.dumps({
            "faj_id": faj_id,
            "name": feature_data.get("name", ""),
            "acronym": feature_data.get("acronym", ""),
            "faj": feature_data.get("faj", ""),
            "cxc": feature_data.get("cxc", ""),
            "category": category,
            "summary": feature_data.get("summary", "")[:500],  # Truncate for storage
            "access": feature_data.get("access", []),
            "license": feature_data.get("license", False),
            "params_count": len(feature_data.get("params", [])),
            "complexity_score": feature_data.get("metadata", {}).get("complexity_score", 0),
            "quality_score": feature_data.get("metadata", {}).get("quality_score", 0)
        })

        # Store with multiple keys for different access patterns
        category_prefix = category.lower().replace(" & ", "-").replace(" ", "-")

        # Primary: category:faj_id
        run_memory_store("ran-features", f"{category_prefix}:{faj_id}", searchable_text)

        # Secondary: acronym
        acronym = feature_data.get("acronym", "")
        if acronym:
            run_memory_store("ran-acronyms", acronym.lower(), faj_id)
            stats["acronyms_indexed"] += 1

        # Tertiary: FAJ reference
        faj_ref = feature_data.get("faj", "")
        if faj_ref:
            run_memory_store("ran-faj", faj_ref.replace(" ", ""), faj_id)
            stats["faj_indexed"] += 1

        # Quaternary: CXC reference
        cxc_ref = feature_data.get("cxc", "")
        if cxc_ref:
            run_memory_store("ran-cxc", cxc_ref, faj_id)
            stats["cxc_indexed"] += 1

    print(f"✓ Indexed {stats['features_stored']} feature entries")

def index_acronym_mapping(acronym_index: Dict[str, str]):
    """Index acronym to FAJ mapping"""
    print("\n🔤 Indexing Acronym Mappings...")

    for acronym, faj_id in acronym_index.items():
        mapping_value = json.dumps({
            "acronym": acronym,
            "faj_id": faj_id
        })
        run_memory_store("ran-acronym-map", acronym.lower(), faj_id)

    print(f"✓ Indexed {len(acronym_index)} acronym mappings")

def index_parameters(parameters: Dict[str, Any]):
    """Index parameters and their feature relationships"""
    print("\n⚙️  Indexing Parameters...")

    # Group parameters by their logical class
    param_classes = {}
    for param_name, param_data in parameters.items():
        if isinstance(param_data, dict) and "class" in param_data:
            param_class = param_data["class"]
            if param_class not in param_classes:
                param_classes[param_class] = []
            param_classes[param_class].append(param_name)

    # Store parameter class mappings
    for param_class, params in param_classes.items():
        class_value = json.dumps({
            "class": param_class,
            "param_count": len(params),
            "sample_params": params[:5]
        })
        run_memory_store("ran-param-classes", param_class.lower(), class_value)

    stats["parameters_indexed"] = len(param_classes)
    print(f"✓ Indexed {stats['parameters_indexed']} parameter classes")

def create_search_index():
    """Create consolidated search index with all access patterns"""
    print("\n🔍 Creating Search Index...")

    search_index = {
        "total_features": 593,
        "categories": 15,
        "access_patterns": [
            "acronym -> feature",
            "faj -> feature",
            "cxc -> feature",
            "category -> features",
            "parameter -> features"
        ],
        "namespaces": {
            "ran-features": "Primary feature storage by category",
            "ran-categories": "Category mappings and feature lists",
            "ran-acronyms": "Acronym to FAJ ID mapping",
            "ran-faj": "FAJ reference to FAJ ID mapping",
            "ran-cxc": "CXC reference to FAJ ID mapping",
            "ran-acronym-map": "Complete acronym mappings",
            "ran-param-classes": "Parameter class groupings"
        },
        "example_queries": [
            "IFLB load balancing",
            "MIMO sleep mode",
            "carrier aggregation 4CC",
            "handover A3 event"
        ]
    }

    run_memory_store("ran-index", "metadata", json.dumps(search_index))
    print("✓ Search index metadata created")

def main():
    """Main indexing workflow"""
    print("=" * 80)
    print("🚀 Ericsson RAN Features - AgentDB Memory Indexer")
    print("=" * 80)
    print(f"📂 Features Directory: {FEATURES_DIR}")

    # Load all data
    print("\n📖 Loading data files...")
    features = load_json_file("features.json")
    categories = load_json_file("index_categories.json")
    acronyms = load_json_file("index_acronym.json")
    parameters = load_json_file("parameters.json")

    print(f"  ✓ {len(features)} features")
    print(f"  ✓ {len(categories)} categories")
    print(f"  ✓ {len(acronyms)} acronyms")
    print(f"  ✓ {len(parameters)} parameters")

    # Index all data
    index_categories(categories)
    index_features_by_category(features, categories)
    index_acronym_mapping(acronyms)
    index_parameters(parameters)
    create_search_index()

    # Print statistics
    elapsed = time.time() - stats["start_time"]
    print("\n" + "=" * 80)
    print("📊 Indexing Statistics")
    print("=" * 80)
    print(f"  Features Stored:     {stats['features_stored']:,}")
    print(f"  Categories:          {stats['categories_stored']}")
    print(f"  Acronyms Indexed:    {stats['acronyms_indexed']}")
    print(f"  FAJ References:      {stats['faj_indexed']}")
    print(f"  CXC References:      {stats['cxc_indexed']}")
    print(f"  Parameter Classes:   {stats['parameters_indexed']}")
    print(f"  Errors:              {len(stats['errors'])}")
    print(f"  Elapsed Time:        {elapsed:.2f}s")

    if stats["errors"]:
        print(f"\n⚠️  Errors encountered:")
        for error in stats["errors"][:5]:
            print(f"  - {error}")
        if len(stats["errors"]) > 5:
            print(f"  ... and {len(stats['errors']) - 5} more")

    print("\n✅ Indexing Complete!")
    print("\n🔍 Example Searches:")
    print("  npx @claude-flow/cli@latest memory search --query 'IFLB load balancing' --namespace ran-features")
    print("  npx @claude-flow/cli@latest memory search --query 'MIMO sleep' --namespace ran-features")
    print("  npx @claude-flow/cli@latest memory retrieve --key 'iflb' --namespace ran-acronyms")

    return 0

if __name__ == "__main__":
    sys.exit(main())
