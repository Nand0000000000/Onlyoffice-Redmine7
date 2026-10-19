.PHONY: help
help: # Show help information.
	@grep --extended-regexp "^[a-z-]+: #" "$(MAKEFILE_LIST)" | \
		awk 'BEGIN {FS = ": # "}; {printf "%-10s  %s\n", $$1, $$2}'

.PHONY: artifact
artifact: # Create an artifact.
	@tar \
		--directory .build \
		--file onlyoffice_redmine.tar.zst \
		--use-compress-program zstd \
		--create \
		--verbose \
		onlyoffice_redmine

.PHONY: build
build: # Build the plugin.
	@mkdir -p .build/onlyoffice_redmine
	@cp -r \
		app \
		assets \
		config \
		db \
		lib \
		lib2 \
		AUTHORS.md \
		CHANGELOG.md \
		init.rb \
		LICENSE \
		README.md \
		.build/onlyoffice_redmine
	@cp Gemfile.prod .build/onlyoffice_redmine/Gemfile
	@find .build/onlyoffice_redmine -name .git -delete

.PHONY: install
install: # Install development dependencies.
	@bundle install
	@bundle exec tapioca init

.PHONY: lint
lint: # Lint for the style.
	@bundle exec rubocop

.PHONY: notes
notes: # Generate release notes.
	@awk '/## [0-9]/{p++} p; /## [0-9]/{if (p > 1) exit}' CHANGELOG.md | \
		awk 'NR>2 {print last} {last=$$0}'

.PHONY: readme-formats
readme-formats: # Generate the formats table in README.md
	@bundle exec rake readme_formats

.PHONY: submodule
submodule: # Update submodules.
	@git submodule update --init --recursive

.PHONY: version
version: # Show a plugin version.
	@bundle exec rake version
