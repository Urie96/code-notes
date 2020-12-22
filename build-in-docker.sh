nodeVersion=14.15.0-alpine3.12

function build() {
    docker run --rm -v "$PWD":/usr/src/app -w /usr/src/app $nodeVersion npm run build
}

if (build); then
    docker run --rm -v "$PWD":/usr/src/app -w /usr/src/app $nodeVersion npm ci
    build
fi
