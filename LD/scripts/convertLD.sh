. ../../venv/bin/activate

for tname in ../templates/*.hbs; do
    bname=$(basename "${tname}" .hbs)
    jname="../../srcdata/data/${bname}.json"
    jldname="../json-ld/${bname}-ld.json"
    python applyTemplate.py "${jname}" "${tname}" > "${jldname}"
done

for jldname in ../json-ld/*.json; do
    bname=$(basename "${jldname}" .json)
    ttlname="../ttl/${bname}.ttl"
    python convertTTL.py "${jldname}" "${ttlname}"
done