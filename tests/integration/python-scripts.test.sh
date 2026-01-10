#!/bin/bash

# Integration Tests: Python Scripts
# Tests all Python query and generator scripts

set -e

echo "======================================================================"
echo "Python Scripts Integration Tests"
echo "======================================================================"
echo ""

# Test 1: Search by acronym (brief format)
echo "TEST 1: search.py --acronym IFLB --brief"
echo "----------------------------------------------------------------------"
python3 scripts/search.py --acronym IFLB --brief
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAILED with exit code $EXIT_CODE"
  exit 1
fi
echo "✓ PASSED"
echo ""

# Test 2: Search by acronym (markdown format)
echo "TEST 2: search.py --acronym MSM --markdown"
echo "----------------------------------------------------------------------"
python3 scripts/search.py --acronym MSM --markdown | head -30
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAILED with exit code $EXIT_CODE"
  exit 1
fi
echo "✓ PASSED"
echo ""

# Test 3: Search by acronym (cmedit format)
echo "TEST 3: search.py --acronym MSM --cmedit"
echo "----------------------------------------------------------------------"
python3 scripts/search.py --acronym MSM --cmedit | head -20
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAILED with exit code $EXIT_CODE"
  exit 1
fi
echo "✓ PASSED"
echo ""

# Test 4: Search by parameter
echo "TEST 4: search.py --param sleepMode --brief"
echo "----------------------------------------------------------------------"
python3 scripts/search.py --param sleepMode --brief | head -15
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAILED with exit code $EXIT_CODE"
  exit 1
fi
echo "✓ PASSED"
echo ""

# Test 5: Search statistics
echo "TEST 5: search.py --stats"
echo "----------------------------------------------------------------------"
python3 scripts/search.py --stats
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAILED with exit code $EXIT_CODE"
  exit 1
fi
echo "✓ PASSED"
echo ""

# Test 6: Dependency tree (IFLB)
echo "TEST 6: deps.py IFLB (dependency tree)"
echo "----------------------------------------------------------------------"
python3 scripts/deps.py IFLB | head -40
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAILED with exit code $EXIT_CODE"
  exit 1
fi
echo "✓ PASSED"
echo ""

# Test 7: Show direct dependencies
echo "TEST 7: deps.py MSM --deps"
echo "----------------------------------------------------------------------"
python3 scripts/deps.py MSM --deps
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAILED with exit code $EXIT_CODE"
  exit 1
fi
echo "✓ PASSED"
echo ""

# Test 8: Find circular dependencies
echo "TEST 8: deps.py --cycles"
echo "----------------------------------------------------------------------"
python3 scripts/deps.py --cycles
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAILED with exit code $EXIT_CODE"
  exit 1
fi
echo "✓ PASSED"
echo ""

# Test 9: cmedit enable commands
echo "TEST 9: cmedit_generator.py --faj MSM --enable"
echo "----------------------------------------------------------------------"
python3 scripts/cmedit_generator.py --faj MSM --enable
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAILED with exit code $EXIT_CODE"
  exit 1
fi
echo "✓ PASSED"
echo ""

# Test 10: cmedit parameter commands
echo "TEST 10: cmedit_generator.py --faj IFLB --params"
echo "----------------------------------------------------------------------"
python3 scripts/cmedit_generator.py --faj IFLB --params | head -20
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAILED with exit code $EXIT_CODE"
  exit 1
fi
echo "✓ PASSED"
echo ""

# Test 11: cmedit deployment script (bash)
echo "TEST 11: cmedit_generator.py --faj MSM --format bash"
echo "----------------------------------------------------------------------"
python3 scripts/cmedit_generator.py --faj MSM --format bash | head -20
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAILED with exit code $EXIT_CODE"
  exit 1
fi
echo "✓ PASSED"
echo ""

# Test 12: cmedit deployment script (YAML)
echo "TEST 12: cmedit_generator.py --faj IFLB --format yaml"
echo "----------------------------------------------------------------------"
python3 scripts/cmedit_generator.py --faj IFLB --format yaml | head -20
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAILED with exit code $EXIT_CODE"
  exit 1
fi
echo "✓ PASSED"
echo ""

# Test 13: Validation commands
echo "TEST 13: cmedit_generator.py --faj MSM --validate"
echo "----------------------------------------------------------------------"
python3 scripts/cmedit_generator.py --faj MSM --validate
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAILED with exit code $EXIT_CODE"
  exit 1
fi
echo "✓ PASSED"
echo ""

# Test 14: Search by name
echo "TEST 14: search.py --name 'load balancing' --brief"
echo "----------------------------------------------------------------------"
python3 scripts/search.py --name "load balancing" --brief | head -20
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAILED with exit code $EXIT_CODE"
  exit 1
fi
echo "✓ PASSED"
echo ""

# Test 15: Impact analysis
echo "TEST 15: deps.py IFLB --impact"
echo "----------------------------------------------------------------------"
python3 scripts/deps.py IFLB --impact
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
  echo "FAILED with exit code $EXIT_CODE"
  exit 1
fi
echo "✓ PASSED"
echo ""

echo "======================================================================"
echo "All Python Scripts Tests Passed! ✓"
echo "======================================================================"
