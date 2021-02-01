OUTPUT=dist
SRC_DIRS=docs

SRC_FILES=$(foreach src,$(SRC_DIRS),$(shell find $(src) -type f -print))

.PHONY: all build install

all: build
	@echo done

build: $(OUTPUT)

$(OUTPUT): node_modules $(SRC_FILES)
	npm run build
	touch $(OUTPUT)

node_modules: package-lock.json package.json
	npm ci
	touch node_modules