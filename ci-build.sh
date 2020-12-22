function build() {
    npm run build
}

if (! build); then
    npm ci
    build
fi
