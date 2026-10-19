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

module OnlyOfficeRedmine
  # The hooks of the plugin.
  #
  # The Mermaid diagrams can be a part of the contents of the pages which are
  # not rendered by the plugin, such as the issues, the wiki pages, and the
  # rendered attachments, so the loader of the library is added to every page.
  # It renders a diagram only if the page has one.
  class Hooks < Redmine::Hook::ViewListener
    render_on :view_layouts_base_html_head, partial: "onlyoffice/mermaid"
  end
end
