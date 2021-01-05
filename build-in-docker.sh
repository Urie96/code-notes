nodeVersion=node:14.15.0-alpine3.12

docker run --rm -v "$PWD":/usr/src/app -w /usr/src/app $nodeVersion npm run ci-build
npm run sw
npm run gzip
