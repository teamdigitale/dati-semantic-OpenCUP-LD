import json
import sys
from pathlib import Path

from rdflib import Graph

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rdf_utils import serialize_turtle

srcfile = sys.argv[1]
dstfile = sys.argv[2]

g = Graph()

with open(srcfile, "r") as f:
    d = json.load(f)
    g.parse(data=d, format="json-ld")
    serialize_turtle(g, dstfile)
