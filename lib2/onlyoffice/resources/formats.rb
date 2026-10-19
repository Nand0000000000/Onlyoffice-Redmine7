#
# (c) Copyright Ascensio System SIA 2025
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# typed: true
# frozen_string_literal: true

require "json"
require "pathname"
require "sorbet-runtime"
require_relative "resource"

module OnlyOffice; end

module OnlyOffice::Resources
  class Formats
    All = T.type_alias do
      T::Set[Format]
    end
  end

  class Format < T::Struct
    prop :name,    String,           default: ""
    prop :type,    String,           default: ""
    prop :actions, T::Array[String], default: []
    prop :convert, T::Array[String], default: []
    prop :mime,    T::Array[String], default: []
    prop :order,   Integer,          default: 0
  end

  class Formats
    extend T::Sig
    extend Resource

    # The Markdown format was introduced in ONLYOFFICE Docs 9.0, but the pinned
    # version of the `document-formats` submodule doesn't contain it yet. The
    # definition below mirrors the upstream `onlyoffice-docs-formats.json` and
    # is ignored once the submodule is updated.
    #
    # The keys are strings, because the hash describes a JSON record and
    # `Format.from_hash` reads only strings.
    # rubocop:disable Style/StringHashKeys
    Markdown = T.let(
      {
        "name" => "md",
        "type" => "word",
        "actions" => ["view", "lossy-edit"],
        # rubocop:disable Layout/MultilineArrayLineBreaks
        "convert" => [
          "docx", "bmp", "docm", "dotm", "dotx", "epub", "fb2", "gif", "html",
          "jpg", "odt", "ott", "pdf", "pdfa", "png", "rtf", "txt"
        ],
        # rubocop:enable Layout/MultilineArrayLineBreaks
        "mime" => ["text/markdown"]
      }.freeze,
      T::Hash[String, T.untyped]
    )
    # rubocop:enable Style/StringHashKeys

    # Markdown stands before `mht` in the upstream `onlyoffice-docs-formats.json`,
    # so it's inserted there to keep the same order.
    MarkdownSuccessor = T.let("mht", String)

    # The formats which support the conversion to Markdown. The names which are
    # missing in the pinned submodule are simply not found in the list.
    # rubocop:disable Layout/MultilineArrayLineBreaks
    MarkdownConvertibles = T.let(
      [
        "doc", "docm", "docx", "dot", "dotm", "dotx", "epub", "fb2", "fodt",
        "hml", "htm", "html", "hwp", "hwpx", "mht", "mhtml", "odt", "ott",
        "ofd", "oxps", "pages", "pdf", "rtf", "stw", "sxw", "txt", "wps",
        "wpt", "xml", "xps"
      ].freeze,
      T::Array[String]
    )
    # rubocop:enable Layout/MultilineArrayLineBreaks

    @mutex = T.let(Mutex.new, Mutex)

    sig { void }
    def self.unread
      unless defined?(@read)
        return
      end
      remove_instance_variable(:@read)
    end

    sig { returns(Formats) }
    def self.read
      @mutex.synchronize do
        unless defined?(@read)
          @read = load
        end
      end
      @read
    end

    sig { returns(Formats) }
    private_class_method def self.load
      all = T.let(Set.new, All)
      contents = file.read
      list = JSON.parse(contents)
      insert_markdown(list)
      list.each do |item|
        format = Format.from_hash(item)

        # TODO: it should be in `formats.json`.
        case format.name
        when "docx"
          format.order = -4
        when "xlsx"
          format.order = -3
        when "pptx"
          format.order = -2
        when "docxf"
          format.order = -1
        else
          # use the default
        end

        all.add(format)
      end

      all.each do |format|
        markdownize(format)
      end

      new(all: all)
    end

    sig { params(list: T::Array[T.untyped]).void }
    private_class_method def self.insert_markdown(list)
      if list.any? { |item| item["name"] == Markdown["name"] }
        return
      end
      index = list.index { |item| item["name"] == MarkdownSuccessor }
      if index.nil?
        list.append(Markdown)
      else
        list.insert(index, Markdown)
      end
    end

    sig { params(format: Format).void }
    private_class_method def self.markdownize(format)
      unless MarkdownConvertibles.include?(format.name)
        return
      end
      name = T.cast(Markdown["name"], String)
      if format.convert.include?(name)
        return
      end
      # The `convert` array is shared with the cached `Format` instance of the
      # resource, so it must be copied before the modification.
      format.convert = format.convert.dup
      format.convert.append(name)
    end

    sig { returns(Pathname) }
    private_class_method def self.file
      directory.join("onlyoffice-docs-formats.json")
    end

    sig { override.returns(Pathname) }
    private_class_method def self.directory
      resources = super
      resources.join("document-formats")
    end

    sig { params(all: All).void }
    def initialize(all:)
      @all = all
    end

    sig { returns(T::Array[Format]) }
    def convertible
      @all.filter(&:convertible?)
    end

    sig { returns(T::Array[Format]) }
    def auto_convertible
      @all.filter(&:auto_convertible?)
    end

    sig { returns(T::Array[Format]) }
    def fillable
      @all.filter(&:fillable?)
    end

    sig { returns(T::Array[Format]) }
    def viewable
      @all.filter(&:viewable?)
    end

    sig { returns(T::Array[Format]) }
    def editable
      @all.filter(&:editable?)
    end

    sig { returns(T::Array[Format]) }
    def lossy_editable
      @all.filter(&:lossy_editable?)
    end

    sig { returns(T::Array[Format]) }
    def creatable
      @all.filter(&:creatable?)
    end

    sig { returns(T::Array[Format]) }
    def spreadsheets
      @all.filter(&:spreadsheet?)
    end

    sig { returns(T::Array[Format]) }
    def presentations
      @all.filter(&:presentation?)
    end

    sig { returns(T::Array[Format]) }
    def documents
      @all.filter(&:document?)
    end

    sig { returns(Format) }
    def default
      # The formats always include `docx`, as it's commonly used in many places by
      # default.
      docx!
    end

    sig { returns(Format) }
    private def docx!
      T.must(docx)
    end

    sig { returns(T.nilable(Format)) }
    private def docx
      @all.find do |format|
        format.extension == ".docx"
      end
    end

    sig { returns(All) }
    def all
      @all.dup
    end
  end

  class Format
    extend T::Sig

    sig { params(hash: T.untyped, strict: T.untyped).returns(Format) }
    def self.from_hash(hash, strict = nil)
      super(hash, strict)
    end

    sig { returns(T::Boolean) }
    def convertible?
      !convert.empty?
    end

    sig { returns(T::Boolean) }
    def auto_convertible?
      actions.include?("auto-convert")
    end

    sig { returns(T::Boolean) }
    def fillable?
      actions.include?("fill")
    end

    sig { returns(T::Boolean) }
    def viewable?
      actions.include?("view")
    end

    # The `render` action means the format is rendered by the plugin itself,
    # rather than sent to the Document Server.
    sig { returns(T::Boolean) }
    def renderable?
      actions.include?("render")
    end

    sig { returns(T::Boolean) }
    def editable?
      actions.include?("edit")
    end

    sig { returns(T::Boolean) }
    def lossy_editable?
      actions.include?("lossy-edit")
    end

    sig { returns(T::Boolean) }
    def spreadsheet?
      type == "cell"
    end

    sig { returns(T::Boolean) }
    def presentation?
      type == "slide"
    end

    sig { returns(T::Boolean) }
    def document?
      type == "word"
    end

    sig { returns(String) }
    def extension
      ".#{name}"
    end

    sig { void }
    def allow_editing
      unless actions.include?("lossy-edit")
        return
      end
      actions.delete("lossy-edit")
      actions.append("edit")
    end
  end
end
