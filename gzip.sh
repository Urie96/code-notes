size=10k
pattern="\.(js|css|html|svg)$"

dir=$1

find $dir -type f -size +$size | egrep $pattern | xargs -I {} sh -c ' gzip --best -c "{}" > "{}".gz && echo "{}.gz"' | wc -l | xargs -I {} echo "{} files compressed"

# find ./dist -type f | egrep "\.gz$" | xargs -I {} sh -c "rm {} && echo {}" | wc -l | xargs -I {} echo "{} files deleted"

# find $1 \! -name "*.gz" -type f -size +10k | xargs sh -c ' gzip --best -c "{}" > "{}".gz && echo "{}.gz"'
