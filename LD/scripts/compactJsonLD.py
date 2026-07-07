import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rdf_utils import compact_jsonld_file


def main():
    if len(sys.argv) != 2:
        print("Usage: python compactJsonLD.py <file.json>", file=sys.stderr)
        sys.exit(1)
    compact_jsonld_file(sys.argv[1])


if __name__ == "__main__":
    main()
