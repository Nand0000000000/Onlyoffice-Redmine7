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
  # The block editor stores the documents as Markdown, so the documents of the
  # other formats are converted to Markdown when they are opened and back to
  # their format when they are saved.
  #
  # The conversion back is done by the Document Server, which fetches the
  # document from a URL. The Markdown is therefore written to a temporary file,
  # which is served to the Document Server and removed after the conversion.
  module BlockEditor
    extend T::Sig

    # How long (in seconds) the Markdown is kept for the conversion.
    PendingLifetime = T.let(5 * 60, Integer)

    # The name of the temporary files which are created for the conversion.
    PendingName = T.let(/\A[0-9a-f]{32}\z/.freeze, Regexp)

    sig { returns(Pathname) }
    def self.pending_dir
      Rails.root.join("tmp", "onlyoffice_blocks")
    end

    # Stores the Markdown and returns the identifier, which is used to fetch it
    # back for the conversion.
    sig { params(text: String).returns(String) }
    def self.store_pending(text)
      dir = pending_dir
      FileUtils.mkdir_p(dir)

      id = SecureRandom.hex(16)
      File.binwrite(dir.join("#{id}.md"), text)

      id
    end

    # The path to the stored Markdown, or `nil` if it doesn't exist or has
    # expired.
    sig { params(id: String).returns(T.nilable(Pathname)) }
    def self.pending(id)
      unless PendingName.match?(id)
        return nil
      end

      path = pending_dir.join("#{id}.md")
      unless path.file?
        return nil
      end

      if path.mtime < Time.now - PendingLifetime
        return nil
      end

      path
    end

    sig { params(id: String).void }
    def self.delete_pending(id)
      unless PendingName.match?(id)
        return
      end

      FileUtils.rm_f(pending_dir.join("#{id}.md"))
    end
  end
end
