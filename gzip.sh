# find ./dist -name "*.gz" -type f -exec rm {} \;

find $1 \! -name "*.gz" -type f -size +10k -exec sh -c ' gzip --best -c "$0" > "$0".gz && echo "$0.gz"' {} \;
