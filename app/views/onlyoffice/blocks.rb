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

class Views::OnlyOffice::Blocks < Views::Mustache
  extend T::Sig
  include Blocks::Assets

  self.template_file = File.join(template_path, "onlyoffice/blocks.mustache")

  sig { override.params(helpers: T.untyped).void }
  def initialize(helpers:)
    super
    @basename = ""
    @content = ""
    @convertible = false
    @save = Views::Action.new(label: I18n.t("onlyoffice_blocks_save"))
    @cancel = Views::Action.new(label: I18n.t("onlyoffice_blocks_cancel"))
  end

  sig { override.returns(String) }
  def inline
    "#{blocks_raw_assets}#{render.html_safe}"
  end

  sig { returns(String) }
  attr_accessor :basename

  # The Markdown representation of the document.
  sig { returns(String) }
  attr_accessor :content

  # Whether the document is converted to Markdown when it's opened and back
  # when it's saved.
  sig { returns(T::Boolean) }
  attr_accessor :convertible

  sig { returns(Views::Action) }
  attr_accessor :save

  sig { returns(Views::Action) }
  attr_accessor :cancel

  sig { returns(String) }
  def warning
    I18n.t("onlyoffice_blocks_warning")
  end

  # The interface strings used by the editor script.
  sig { returns(String) }
  def labels
    {
      error: I18n.t("onlyoffice_blocks_error"),
      modified: I18n.t("onlyoffice_blocks_modified"),
      placeholder: I18n.t("onlyoffice_blocks_placeholder"),
      saved: I18n.t("onlyoffice_blocks_saved"),
      saving: I18n.t("onlyoffice_blocks_saving")
    }.to_json
  end

  sig { returns(String) }
  def title
    "#{basename} — ONLYOFFICE"
  end
end
