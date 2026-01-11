#!/usr/bin/env python3
"""
Elex Features - AgentDB Memory Indexer
Indexes 1,153 Ericsson LTE/4G network feature markdown files (45MB) into AgentDB
with vector embeddings for fast autonomous agent access.
"""

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
import time

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
FEATURES_DIR = PROJECT_ROOT / "docs" / "elex_features"

# Namespace for storage
NAMESPACE = "elex-features"

# Statistics
stats = {
    "files_processed": 0,
    "files_stored": 0,
    "files_skipped": 0,
    "errors": [],
    "start_time": time.time(),
    "total_size_bytes": 0
}


def parse_front_matter(content: str) -> tuple[Dict[str, Any], str]:
    """
    Parse YAML front matter from markdown content.
    Returns (metadata_dict, content_without_front_matter)
    """
    front_matter_pattern = r'^---\n(.*?)\n---\n(.*)$'
    match = re.match(front_matter_pattern, content, re.DOTALL)

    if match:
        yaml_text = match.group(1)
        main_content = match.group(2)

        # Parse YAML key-value pairs
        metadata = {}
        for line in yaml_text.split('\n'):
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip()
                value = value.strip()

                # Try to parse as various types
                if value.lower() == 'true':
                    value = True
                elif value.lower() == 'false':
                    value = False
                elif value.lower() == 'null' or value == '':
                    value = None
                elif value.startswith('[') and value.endswith(']'):
                    # List
                    value = [v.strip() for v in value[1:-1].split(',') if v.strip()]
                elif value.startswith('"') or value.startswith("'"):
                    value = value[1:-1]

                metadata[key] = value

        return metadata, main_content

    return {}, content


def extract_title(content: str) -> str:
    """
    Extract the title from markdown content.
    Looks for the first # heading or content at the start.
    """
    lines = content.split('\n')
    for line in lines:
        line = line.strip()
        if line.startswith('#'):
            return line.lstrip('#').strip()
        # Skip empty lines and image references
        elif line and not line.startswith('!') and not line.startswith('|'):
            return line[:100]  # First non-empty line as title
    return "Untitled Feature"


def extract_feature_identity(content: str) -> Optional[str]:
    """
    Extract FAJ/CXC feature identity from content if present.
    """
    # Look for "Feature Identity" or "FAJ" patterns
    faj_pattern = r'(?:Feature Identity|FAJ)\s*:?\s*([A-Z]{3}\s*\d+\s*\d+)'
    match = re.search(faj_pattern, content)
    if match:
        return match.group(1).replace(' ', '')
    return None


def run_memory_store(key: str, value: str) -> bool:
    """Store data in AgentDB memory using -v flag for value"""
    try:
        cmd = [
            "npx", "@claude-flow/cli@latest", "memory", "store",
            "--namespace", NAMESPACE,
            "--key", key,
            "--value", value
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            stats["files_stored"] += 1
            return True
        else:
            stats["errors"].append(f"Failed to store {key}: {result.stderr[:200]}")
            return False
    except subprocess.TimeoutExpired:
        stats["errors"].append(f"Timeout storing {key}")
        return False
    except Exception as e:
        stats["errors"].append(f"Error storing {key}: {str(e)}")
        return False


def process_markdown_file(file_path: Path, relative_path: str) -> bool:
    """
    Process a single markdown file and store in AgentDB.
    """
    try:
        # Read file content
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        stats["files_processed"] += 1
        stats["total_size_bytes"] += file_path.stat().st_size

        # Parse front matter
        metadata, main_content = parse_front_matter(content)

        # Extract title and feature info
        title = extract_title(main_content)
        feature_identity = extract_feature_identity(main_content)

        # Create searchable text (first 1000 chars for embedding)
        searchable_text = main_content[:1000]

        # Create value JSON
        value_data = {
            "title": title,
            "feature_identity": feature_identity,
            "content": main_content[:5000],  # Store more content for retrieval
            "metadata": metadata,
            "file_path": str(relative_path),
            "original_filename": file_path.name,
            "file_size_bytes": file_path.stat().st_size
        }

        value_json = json.dumps(value_data, ensure_ascii=False)

        # Store in AgentDB
        # Use relative path as key (remove .md extension)
        key = str(relative_path).replace('/', '__').replace('\\', '__')
        if key.endswith('.md'):
            key = key[:-3]

        if run_memory_store(key, value_json):
            return True

        return False

    except Exception as e:
        stats["errors"].append(f"Error processing {file_path}: {str(e)}")
        return False


def index_directory(directory: Path, base_path: Path) -> List[Path]:
    """
    Recursively find all markdown files in a directory.
    """
    md_files = []
    for item in directory.iterdir():
        if item.is_file() and item.suffix == '.md':
            md_files.append(item)
        elif item.is_dir():
            md_files.extend(index_directory(item, base_path))
    return md_files


def main():
    """Main indexing workflow"""
    print("=" * 80)
    print(" Elex Features - AgentDB Memory Indexer")
    print("=" * 80)
    print(f" Features Directory: {FEATURES_DIR}")
    print(f" Namespace: {NAMESPACE}")

    if not FEATURES_DIR.exists():
        print(f"\n ERROR: Features directory not found: {FEATURES_DIR}")
        return 1

    # Find all markdown files
    print("\n Scanning for markdown files...")
    md_files = []
    for item in FEATURES_DIR.iterdir():
        if item.is_dir():
            md_files.extend(index_directory(item, FEATURES_DIR))

    print(f" Found {len(md_files):,} markdown files")

    if not md_files:
        print("\n No markdown files found to process.")
        return 0

    # Process files
    print("\n Indexing files...")
    batch_size = 10

    for i, md_file in enumerate(md_files):
        relative_path = md_file.relative_to(FEATURES_DIR)

        # Progress indicator
        if (i + 1) % batch_size == 0 or i == 0:
            progress = ((i + 1) / len(md_files)) * 100
            elapsed = time.time() - stats["start_time"]
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            eta = (len(md_files) - i - 1) / rate if rate > 0 else 0
            print(f"  Progress: {i + 1}/{len(md_files)} ({progress:.1f}%) | Stored: {stats['files_stored']} | Rate: {rate:.2f} files/sec | ETA: {eta:.0f}s")
            sys.stdout.flush()

        if process_markdown_file(md_file, relative_path):
            pass  # Success tracked in stats

    # Print statistics
    elapsed = time.time() - stats["start_time"]
    size_mb = stats["total_size_bytes"] / (1024 * 1024)

    print("\n" + "=" * 80)
    print(" Indexing Statistics")
    print("=" * 80)
    print(f"  Files Processed:     {stats['files_processed']:,}")
    print(f"  Files Stored:        {stats['files_stored']:,}")
    print(f"  Files Skipped:       {stats['files_skipped']:,}")
    print(f"  Total Size:          {size_mb:.2f} MB")
    print(f"  Errors:              {len(stats['errors'])}")
    print(f"  Elapsed Time:        {elapsed:.2f}s")
    print(f"  Average Time/File:   {elapsed / max(stats['files_processed'], 1):.3f}s")

    if stats["errors"]:
        print(f"\n Errors encountered:")
        for error in stats["errors"][:10]:
            print(f"  - {error}")
        if len(stats["errors"]) > 10:
            print(f"  ... and {len(stats['errors']) - 10} more")

    print("\n Indexing Complete!")
    print("\n Example Searches:")
    print(f"  npx @claude-flow/cli@latest memory search --query 'network synchronization' --namespace {NAMESPACE}")
    print(f"  npx @claude-flow/cli@latest memory search --query 'MIMO sleep mode' --namespace {NAMESPACE}")
    print(f"  npx @claude-flow/cli@latest memory list --namespace {NAMESPACE} --limit 10")
    print(f"  npx @claude-flow/cli@latest memory stats")

    return 0


if __name__ == "__main__":
    sys.exit(main())
