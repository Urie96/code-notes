# find ./dist -name "*.gz" -type f | xargs rm

gz() {
  gzip --best -c $1 >$1.gz
}

find $1 \! -name "*.gz" -type f -size +10k | xargs gz
