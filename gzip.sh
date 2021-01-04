# match='.*\.(html|js|css|svg)$'
# size=10240

# fileSize() {
#     local file=$1
#     ls -l $1 | awk '{print $5}'
# }

# shouldGzip() {
#     local file=$1
#     if [[ ! $file =~ $match ]]; then
#         return 1
#     fi
#     if [ $(fileSize $file) -lt $size ]; then
#         return 1
#     fi
#     return 0
# }

# gzipFile() {
#     local file=$1
#     gzip --best -c $file >"$file.gz"
#     echo "$file.gz"
# }

# gzipfolder() {
#     local thisDir=$1
#     for i in $(ls $thisDir); do
#         local abs="$thisDir/$i"
#         if [ -f $abs ]; then
#             if (shouldGzip $abs); then
#                 gzipFile $abs
#             fi
#         elif [ -d $abs ]; then
#             gzipfolder $abs
#         else
#             echo "err: $abs"
#         fi
#     done
# }

# gzipfolder "$(pwd)/$1"

# find ./dist -name "*.gz" -type f -exec rm {} \;

find $1 \! -name "*.gz" -type f -size +10k -exec sh -c ' gzip --best -c "$0" > "$0".gz && echo "$0.gz"' {} \;
