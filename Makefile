UUID = custom-launcher@nexus.dev
EXT_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SYSTEM_SCHEMA_DIR = $(HOME)/.local/share/glib-2.0/schemas

.PHONY: all compile install zip clean

all: compile

compile:
	glib-compile-schemas schemas/

install: compile
	mkdir -p $(EXT_DIR)
	mkdir -p $(SYSTEM_SCHEMA_DIR)
	cp -r metadata.json stylesheet.css extension.js schemas $(EXT_DIR)
	cp schemas/org.gnome.shell.extensions.custom-launcher.gschema.xml $(SYSTEM_SCHEMA_DIR)/
	glib-compile-schemas $(SYSTEM_SCHEMA_DIR)/
	@echo "Installed $(UUID) and registered GSettings schemas successfully!"

clean:
	rm -f schemas/gschemas.compiled
	rm -f $(UUID).shell-extension.zip