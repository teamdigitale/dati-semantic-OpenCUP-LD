import sys
from rdflib import Graph
import json

srcfile=sys.argv[1]
dstfile=sys.argv[2]

g=Graph()

with open (srcfile, 'r') as f:
    d=json.load(f)
    g.parse(data=d, format='json-ld')
    g.serialize(format='turtle',destination=dstfile)